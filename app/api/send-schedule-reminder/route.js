import { getAllJobs, getAllTechnicians } from '@/lib/db'
import { format, addDays, parseISO } from 'date-fns'
import { isAdminRequest, isCronRequest, unauthorized } from '@/lib/admin-auth'
import { sendSms, normalizeE164, withHandldPrefix, isWithinTextingHours, nextTextingWindow } from '@/lib/sms'

async function sendReminders(request) {
  try {
    // Parse request body - date is optional, defaults to tomorrow
    let targetDate
    let specificTechIds = null // If provided, only send to these techs

    try {
      const body = await request.json()
      if (body.date) {
        targetDate = body.date
      }
      if (body.techIds && Array.isArray(body.techIds) && body.techIds.length > 0) {
        specificTechIds = body.techIds
      }
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Default to tomorrow if no date specified
    if (!targetDate) {
      const tomorrow = addDays(new Date(), 1)
      targetDate = format(tomorrow, 'yyyy-MM-dd')
    }

    // Fetch all jobs and technicians
    const [jobs, technicians] = await Promise.all([
      getAllJobs(),
      getAllTechnicians()
    ])

    // Filter jobs for the target date
    const jobsForDate = jobs.filter(job => {
      if (!job.date) return false
      try {
        const jobDate = format(parseISO(job.date), 'yyyy-MM-dd')
        return jobDate === targetDate
      } catch {
        return false
      }
    })

    // Group jobs by technician
    const jobsByTech = {}
    jobsForDate.forEach(job => {
      if (job.assignedTech && Array.isArray(job.assignedTech)) {
        const techId = job.assignedTech[0]
        if (!jobsByTech[techId]) {
          jobsByTech[techId] = []
        }
        jobsByTech[techId].push(job)
      }
    })

    // Create a map of tech ID to tech data
    const techMap = {}
    technicians.forEach(tech => {
      techMap[tech.id] = tech
    })

    // Determine which techs to send to
    let techIdsToSend = Object.keys(jobsByTech)
    if (specificTechIds) {
      // Filter to only include specified techs that also have jobs
      techIdsToSend = specificTechIds.filter(id => jobsByTech[id])
    }

    const results = {
      date: targetDate,
      techsWithJobs: Object.keys(jobsByTech).length,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      skippedNoConsent: [],
      skippedOptOut: [],
      details: []
    }

    // Send text to each tech
    for (const techId of techIdsToSend) {
      const techJobs = jobsByTech[techId] || []
      const tech = techMap[techId]

      if (!tech) {
        results.skippedCount++
        results.details.push({
          techId,
          success: false,
          error: 'Technician not found'
        })
        continue
      }

      const name = `${tech.firstName} ${tech.lastName}`

      if (!tech.active) {
        results.skippedCount++
        results.details.push({ techId, name, success: false, error: 'Technician not active' })
        continue
      }

      if (!tech.smsConsentAt) {
        results.skippedCount++
        results.skippedNoConsent.push({ id: tech.id, name })
        results.details.push({ techId, name, success: false, error: 'No SMS consent on file' })
        continue
      }

      const phoneNumber = normalizeE164(tech.phone)
      if (!phoneNumber) {
        results.skippedCount++
        results.details.push({ techId, name, success: false, error: 'Invalid phone number' })
        continue
      }

      try {
        const jobCount = techJobs.length
        const dateDisplay = format(parseISO(targetDate), 'EEEE, MMMM d')
        const scheduleLink = `https://work.handldhome.com/tech/${techId}/schedule?date=${targetDate}`

        // Sort jobs by time
        const sortedJobs = techJobs.sort((a, b) => {
          if (!a.time) return 1
          if (!b.time) return -1
          return a.time.localeCompare(b.time)
        })

        // Build job summary (first 3 jobs)
        const jobSummary = sortedJobs.slice(0, 3).map(job => {
          const time = job.time ? format(parseISO(`2000-01-01T${job.time}`), 'h:mm a') : 'TBD'
          return `${time} - ${job.serviceName}`
        }).join('\n')

        const moreJobsText = jobCount > 3 ? `\n...and ${jobCount - 3} more` : ''

        const message = withHandldPrefix(`Hi ${tech.firstName}! You have ${jobCount} job${jobCount !== 1 ? 's' : ''} scheduled for ${dateDisplay}:\n\n${jobSummary}${moreJobsText}\n\nView full schedule:\n${scheduleLink}`)

        const r = await sendSms({
          to: phoneNumber,
          body: message,
          recipientType: 'technician',
          messageType: 'schedule_reminder'
        })

        if (r.status === 'sent') {
          results.successCount++
          results.details.push({ techId, name, jobCount, success: true, messageId: r.sid, logError: r.logError })
        } else if (r.status === 'skipped_opt_out') {
          results.skippedCount++
          results.skippedOptOut.push({ id: tech.id, name })
          results.details.push({ techId, name, success: false, error: r.error, logError: r.logError })
        } else {
          results.failedCount++
          results.details.push({ techId, name, success: false, error: r.error, logError: r.logError })
        }

      } catch (error) {
        results.failedCount++
        results.details.push({ techId, name, success: false, error: error.message })
      }
    }

    return Response.json({
      success: true,
      message: `Schedule reminders sent for ${targetDate}`,
      ...results
    })

  } catch (error) {
    console.error('Error sending schedule reminders:', error)
    return Response.json({
      success: false,
      error: 'Failed to send schedule reminders',
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
// Technician texts are not held to the customer window, but automated sends
// must never fire between 21:00 and 07:59 PT.
export async function GET(request) {
  if (!isCronRequest(request)) return unauthorized()

  if (!isWithinTextingHours()) {
    return Response.json({ success: true, skipped: 'quiet_hours', nextWindow: nextTextingWindow().toISOString() })
  }

  return sendReminders(request)
}
