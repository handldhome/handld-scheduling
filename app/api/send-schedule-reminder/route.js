import twilio from 'twilio'
import { getAllJobs, getAllTechnicians } from '@/lib/airtable'
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
    // Parse request body - date is optional, defaults to tomorrow
    let targetDate
    let isManualTrigger = false

    try {
      const body = await request.json()
      if (body.date) {
        targetDate = body.date
      }
      isManualTrigger = body.manual === true
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Default to tomorrow if no date specified
    if (!targetDate) {
      const tomorrow = addDays(new Date(), 1)
      targetDate = format(tomorrow, 'yyyy-MM-dd')
    }

    // Get base URL
    const host = request.headers.get('host')
    const protocol = request.headers.get('x-forwarded-proto') || 'https'
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

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

    const results = {
      date: targetDate,
      techsWithJobs: Object.keys(jobsByTech).length,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      details: []
    }

    // Send text to each tech with jobs
    for (const [techId, techJobs] of Object.entries(jobsByTech)) {
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

      if (!tech.active) {
        results.skippedCount++
        results.details.push({
          techId,
          name: `${tech.firstName} ${tech.lastName}`,
          success: false,
          error: 'Technician not active'
        })
        continue
      }

      const phoneNumber = formatPhoneNumber(tech.phone)
      if (!phoneNumber) {
        results.skippedCount++
        results.details.push({
          techId,
          name: `${tech.firstName} ${tech.lastName}`,
          success: false,
          error: 'Invalid phone number'
        })
        continue
      }

      try {
        const jobCount = techJobs.length
        const dateDisplay = format(parseISO(targetDate), 'EEEE, MMMM d')
        const scheduleLink = `${baseUrl}/tech/${techId}/schedule?date=${targetDate}`

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

        const message = `Hi ${tech.firstName}! You have ${jobCount} job${jobCount !== 1 ? 's' : ''} scheduled for ${dateDisplay}:\n\n${jobSummary}${moreJobsText}\n\nView full schedule:\n${scheduleLink}`

        const result = await client.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneNumber
        })

        results.successCount++
        results.details.push({
          techId,
          name: `${tech.firstName} ${tech.lastName}`,
          jobCount,
          success: true,
          messageId: result.sid
        })

      } catch (error) {
        results.failedCount++
        results.details.push({
          techId,
          name: `${tech.firstName} ${tech.lastName}`,
          success: false,
          error: error.message
        })
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

// GET handler for cron job (Vercel cron uses GET requests)
export async function GET(request) {
  // Verify this is a legitimate cron request (optional security)
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Call the POST handler logic
  return POST(request)
}
