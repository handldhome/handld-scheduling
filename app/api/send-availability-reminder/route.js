import { getAllTechnicians, getAllAvailability, isSettingEnabled } from '@/lib/db'
import { format, addDays, parseISO } from 'date-fns'
import { isAdminRequest, isCronRequest, unauthorized } from '@/lib/admin-auth'
import { sendSms, normalizeE164, withHandldPrefix, isWithinTextingHours, nextTextingWindow } from '@/lib/sms'

async function sendReminders(request) {
  try {
    // Automated sends can be switched off from the admin dashboard (Texts tab)
    // via handld.app_settings — no deploy needed.
    if (!(await isSettingEnabled('availability_texts'))) {
      return Response.json({
        success: true,
        skipped: true,
        message: 'Availability texts are turned off (Texts tab in the admin dashboard).'
      })
    }

    // Parse request body
    let reminderOnly = false // If true, only send to techs who haven't submitted

    try {
      const body = await request.json()
      reminderOnly = body.reminderOnly === true
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Fetch all technicians and availability
    const [technicians, availability] = await Promise.all([
      getAllTechnicians(),
      getAllAvailability()
    ])

    // Calculate the date range we're checking for (next 7 days starting from tomorrow)
    const today = new Date()
    const next7Days = []
    for (let i = 1; i <= 7; i++) {
      next7Days.push(format(addDays(today, i), 'yyyy-MM-dd'))
    }

    // Group availability dates by tech to see who has submitted
    const availabilityDatesByTech = {}
    availability.forEach(record => {
      if (!record.technicianId || !record.date) return

      try {
        const recordDateStr = format(parseISO(record.date), 'yyyy-MM-dd')
        // Check if this availability record is within the next 7 days
        if (next7Days.includes(recordDateStr)) {
          if (!availabilityDatesByTech[record.technicianId]) {
            availabilityDatesByTech[record.technicianId] = new Set()
          }
          availabilityDatesByTech[record.technicianId].add(recordDateStr)
        }
      } catch {
        // Skip invalid dates
      }
    })

    // Helper to check if tech has complete 7-day coverage
    const hasComplete7DayCoverage = (techId) => {
      const techDates = availabilityDatesByTech[techId]
      if (!techDates) return false
      // Check if they have an entry for each of the next 7 days
      return next7Days.every(date => techDates.has(date))
    }

    // Filter active technicians with phone numbers, minus anyone switched off
    // individually in the admin dashboard's Texts tab, minus anyone who has
    // not consented to texts yet
    const techsOptedOut = technicians.filter(tech => tech.active && !tech.availabilityTextsEnabled)
    const techsNoConsent = technicians.filter(tech => tech.active && tech.phone && tech.availabilityTextsEnabled && !tech.smsConsentAt)
    const activeTechsWithPhone = technicians.filter(tech => tech.active && tech.phone && tech.availabilityTextsEnabled && tech.smsConsentAt)

    // Skip techs who have already submitted availability for all of the next 7 days
    const techsWithCompleteCoverage = activeTechsWithPhone.filter(tech => hasComplete7DayCoverage(tech.id))
    const techsToText = activeTechsWithPhone.filter(tech => !hasComplete7DayCoverage(tech.id))

    const results = {
      reminderOnly,
      totalActiveTechs: technicians.filter(t => t.active).length,
      techsWithCompleteCoverage: techsWithCompleteCoverage.length,
      techsToText: techsToText.length,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      details: [],
      skippedForCoverage: techsWithCompleteCoverage.map(t => `${t.firstName} ${t.lastName}`),
      skippedTurnedOff: techsOptedOut.map(t => `${t.firstName} ${t.lastName}`),
      skippedNoConsent: techsNoConsent.map(t => ({ id: t.id, name: `${t.firstName} ${t.lastName}` })),
      skippedOptOut: []
    }

    // Build message based on type
    const messageText = reminderOnly
      ? `Hey! Just a reminder - please submit your availability for the next two weeks. We need this to schedule your jobs. Thanks!`
      : `Hey! Please submit your availability for the next two weeks using the link below. Thanks!`
    const messageType = reminderOnly ? 'availability_reminder' : 'availability_request'

    // Send text to each tech
    for (const tech of techsToText) {
      const name = `${tech.firstName} ${tech.lastName}`
      const phoneNumber = normalizeE164(tech.phone)

      if (!phoneNumber) {
        results.skippedCount++
        results.details.push({ techId: tech.id, name, success: false, error: 'Invalid phone number' })
        continue
      }

      try {
        const availabilityLink = `https://availability.handldhome.com/tech/${tech.id}/availability`
        const fullMessage = withHandldPrefix(`${messageText}\n\n${availabilityLink}`)

        const r = await sendSms({
          to: phoneNumber,
          body: fullMessage,
          recipientType: 'technician',
          messageType
        })

        if (r.status === 'sent') {
          results.successCount++
          results.details.push({ techId: tech.id, name, success: true, messageId: r.sid, logError: r.logError })
        } else if (r.status === 'skipped_opt_out') {
          results.skippedCount++
          results.skippedOptOut.push({ id: tech.id, name })
          results.details.push({ techId: tech.id, name, success: false, error: r.error, logError: r.logError })
        } else {
          results.failedCount++
          results.details.push({ techId: tech.id, name, success: false, error: r.error, logError: r.logError })
        }

      } catch (error) {
        results.failedCount++
        results.details.push({ techId: tech.id, name, success: false, error: error.message })
      }
    }

    return Response.json({
      success: true,
      message: `Availability ${reminderOnly ? 'reminders' : 'requests'} sent to ${results.successCount} tech(s). ${results.techsWithCompleteCoverage} tech(s) skipped (already submitted for next 7 days).${results.skippedNoConsent.length ? ` ${results.skippedNoConsent.length} tech(s) skipped (no SMS consent).` : ''}`,
      ...results
    })

  } catch (error) {
    console.error('Error sending availability reminders:', error)
    return Response.json({
      success: false,
      error: 'Failed to send availability reminders',
      details: error.message
    }, { status: 500 })
  }
}

// Manual send from the admin dashboard
export async function POST(request) {
  if (!isAdminRequest(request)) return unauthorized()
  return sendReminders(request)
}

// GET handler for Vercel cron. Requires CRON_SECRET (fails closed).
// Automated sends never fire between 21:00 and 07:59 PT.
export async function GET(request) {
  if (!isCronRequest(request)) return unauthorized()

  if (!isWithinTextingHours()) {
    return Response.json({ success: true, skipped: 'quiet_hours', nextWindow: nextTextingWindow().toISOString() })
  }

  // Check if this is a reminder-only request (Tuesday)
  const url = new URL(request.url)
  const reminderOnly = url.searchParams.get('reminderOnly') === 'true'

  // Create a mock request with the reminderOnly flag
  const mockRequest = {
    json: async () => ({ reminderOnly }),
    headers: request.headers
  }

  return sendReminders(mockRequest)
}
