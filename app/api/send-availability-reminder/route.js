import twilio from 'twilio'
import { getAllTechnicians, getAllAvailability } from '@/lib/db'
import { format, addDays, parseISO } from 'date-fns'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

const formatPhoneNumber = (phone) => {
  if (!phone) return null

  let phoneStr = phone
  if (Array.isArray(phone)) {
    phoneStr = phone[0]
  }

  if (typeof phoneStr !== 'string') {
    phoneStr = String(phoneStr)
  }

  const cleaned = phoneStr.replace(/\D/g, '')

  if (cleaned.length === 10) {
    return `+1${cleaned}`
  }

  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`
  }

  if (phoneStr.startsWith('+')) {
    return phoneStr
  }

  return null
}

export async function POST(request) {
  try {
    // Parse request body
    let reminderOnly = false // If true, only send to techs who haven't submitted

    try {
      const body = await request.json()
      reminderOnly = body.reminderOnly === true
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Get base URL
    const host = request.headers.get('host')
    const protocol = request.headers.get('x-forwarded-proto') || 'https'
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

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

    // Filter active technicians with phone numbers
    const activeTechsWithPhone = technicians.filter(tech => tech.active && tech.phone)

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
      skippedForCoverage: techsWithCompleteCoverage.map(t => `${t.firstName} ${t.lastName}`)
    }

    // Build message based on type
    const messageText = reminderOnly
      ? `Hey! Just a reminder - please submit your availability for the next two weeks. We need this to schedule your jobs. Thanks!`
      : `Hey! Please submit your availability for the next two weeks using the link below. Thanks!`

    // Send text to each tech
    for (const tech of techsToText) {
      const phoneNumber = formatPhoneNumber(tech.phone)

      if (!phoneNumber) {
        results.skippedCount++
        results.details.push({
          techId: tech.id,
          name: `${tech.firstName} ${tech.lastName}`,
          success: false,
          error: 'Invalid phone number'
        })
        continue
      }

      try {
        const availabilityLink = `https://availability.handldhome.com/tech/${tech.id}/availability`
        const fullMessage = `${messageText}\n\n${availabilityLink}`

        const result = await client.messages.create({
          body: fullMessage,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneNumber
        })

        results.successCount++
        results.details.push({
          techId: tech.id,
          name: `${tech.firstName} ${tech.lastName}`,
          success: true,
          messageId: result.sid
        })

      } catch (error) {
        results.failedCount++
        results.details.push({
          techId: tech.id,
          name: `${tech.firstName} ${tech.lastName}`,
          success: false,
          error: error.message
        })
      }
    }

    return Response.json({
      success: true,
      message: `Availability ${reminderOnly ? 'reminders' : 'requests'} sent to ${results.successCount} tech(s). ${results.techsWithCompleteCoverage} tech(s) skipped (already submitted for next 7 days).`,
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

// GET handler for cron job (Vercel cron uses GET requests)
export async function GET(request) {
  // Check if this is a reminder-only request (Tuesday)
  const url = new URL(request.url)
  const reminderOnly = url.searchParams.get('reminderOnly') === 'true'

  // Create a mock request with the reminderOnly flag
  const mockRequest = {
    json: async () => ({ reminderOnly }),
    headers: request.headers
  }

  return POST(mockRequest)
}
