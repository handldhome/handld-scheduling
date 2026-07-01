import twilio from 'twilio'
import crypto from 'crypto'
import { getTechnician, logSms } from '@/lib/db'
import { getDb } from '@/lib/supabase'

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

const formatDate = (dateStr) => {
  if (!dateStr) return 'TBD'
  // Anchor date-only strings to local noon so America/Los_Angeles rendering
  // doesn't roll back to the previous calendar day.
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? `${dateStr}T12:00:00` : dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Los_Angeles'
  })
}

const formatDateForUrl = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toISOString().split('T')[0]
}

const formatTime = (timeStr) => {
  if (!timeStr) return 'TBD'
  const [hours, minutes] = timeStr.split(':')
  const h = parseInt(hours)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${minutes} ${suffix}`
}

export async function POST(request) {
  try {
    const { job, techIds } = await request.json()

    if (!job) {
      return Response.json({ error: 'Job data is required' }, { status: 400 })
    }

    if (!techIds || !Array.isArray(techIds) || techIds.length === 0) {
      return Response.json({ error: 'At least one tech ID is required' }, { status: 400 })
    }

    const getString = (val) => {
      if (!val) return null
      if (Array.isArray(val)) return val[0]
      return String(val)
    }

    const serviceName = getString(job.serviceName) || 'Service'
    const date = formatDate(getString(job.date))
    const dateForUrl = formatDateForUrl(getString(job.date))
    const time = formatTime(getString(job.time))
    const address = getString(job.address) || 'Address TBD'

    const results = {
      successCount: 0,
      failedCount: 0,
      details: []
    }

    // Calculate confirmation deadline:
    // Min 2 hours from now, max 3 days before appointment
    const now = new Date()
    const jobDate = job.date ? new Date(getString(job.date) + 'T12:00:00') : null
    let deadline = null
    if (jobDate) {
      const threeDaysBefore = new Date(jobDate)
      threeDaysBefore.setDate(threeDaysBefore.getDate() - 3)
      threeDaysBefore.setHours(17, 0, 0, 0) // 5pm, 3 days before

      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)

      // Use the later of: 2 hours from now, or 5pm 3 days before the job
      deadline = twoHoursFromNow > threeDaysBefore ? twoHoursFromNow : threeDaysBefore
    }

    const db = getDb()

    for (const techId of techIds) {
      try {
        const tech = await getTechnician(techId)
        const phoneNumber = formatPhoneNumber(tech.phone)

        if (!phoneNumber) {
          results.failedCount++
          results.details.push({
            techId,
            name: `${tech.firstName} ${tech.lastName}`,
            success: false,
            error: 'Invalid phone number'
          })
          continue
        }

        // Generate unique confirmation token and store on the job
        const confirmToken = crypto.randomBytes(16).toString('hex')
        await db
          .from('jobs')
          .update({
            tech_confirmation_token: confirmToken,
            tech_confirmation_deadline: deadline ? deadline.toISOString() : null,
            tech_confirmed_at: null,
            tech_declined_at: null,
            tech_decline_reason: null
          })
          .eq('id', job.id)

        const confirmLink = `https://work.handldhome.com/confirm/${confirmToken}`

        const deadlineText = deadline
          ? `\n\n⏰ Please confirm by ${deadline.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })}`
          : ''

        const message = `New job assigned!\n\n${serviceName}\n${date} at ${time}\n${address}${deadlineText}\n\nConfirm you'll be there:\n${confirmLink}`

        const result = await client.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneNumber
        })

        await logSms({
          jobId: job.id,
          recipientPhone: phoneNumber,
          recipientType: 'technician',
          messageType: 'job_confirmation_request',
          messageBody: message,
          twilioSid: result.sid,
          status: 'sent'
        })

        results.successCount++
        results.details.push({
          techId,
          name: `${tech.firstName} ${tech.lastName}`,
          success: true,
          messageId: result.sid
        })

      } catch (error) {
        results.failedCount++
        results.details.push({
          techId,
          success: false,
          error: error.message
        })
      }
    }

    return Response.json(results)

  } catch (error) {
    console.error('Error sending tech job notification:', error)
    return Response.json({
      error: 'Failed to send tech notification',
      details: error.message
    }, { status: 500 })
  }
}
