import { getTechnician } from '@/lib/db'
import { isAdminRequest, unauthorized } from '@/lib/admin-auth'
import { sendSms, normalizeE164, withHandldPrefix, CUSTOMER_QUESTIONS } from '@/lib/sms'

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

// Reschedule: texts the assigned technicians (consent required, no hours
// window) and then the customer (texting hours apply). Technicians are sent
// first so an out-of-hours customer text never blocks them; when the customer
// text is held the response is 422 outside_texting_hours and still carries
// the technician results.
export async function POST(request) {
  if (!isAdminRequest(request)) return unauthorized()

  try {
    const { job, techIds } = await request.json()

    if (!job) {
      return Response.json({ error: 'Job data is required' }, { status: 400 })
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
    const customerPhone = normalizeE164(job.phone)
    const firstName = getString(job.firstName) || getString(job.customerName)?.split(' ')[0] || 'there'

    const results = {
      customer: { sent: false },
      techs: { successCount: 0, failedCount: 0, details: [], skippedNoConsent: [], skippedOptOut: [] }
    }

    // Send reschedule notification to assigned technicians
    if (techIds && Array.isArray(techIds) && techIds.length > 0) {
      for (const techId of techIds) {
        try {
          const tech = await getTechnician(techId)
          const name = `${tech.firstName} ${tech.lastName}`

          if (!tech.smsConsentAt) {
            results.techs.skippedNoConsent.push({ id: tech.id, name })
            results.techs.details.push({ techId, name, success: false, error: 'No SMS consent on file' })
            continue
          }

          const phoneNumber = normalizeE164(tech.phone)
          if (!phoneNumber) {
            results.techs.failedCount++
            results.techs.details.push({ techId, name, success: false, error: 'Invalid phone number' })
            continue
          }

          const scheduleLink = `https://work.handldhome.com/tech/${techId}/schedule?date=${dateForUrl}`
          const techMessage = withHandldPrefix(`job rescheduled!\n\n${serviceName}\n${date} at ${time}\n${address}\n\nView your schedule:\n${scheduleLink}`)

          const r = await sendSms({
            to: phoneNumber,
            body: techMessage,
            recipientType: 'technician',
            messageType: 'reschedule',
            jobId: job.id
          })

          if (r.status === 'sent') {
            results.techs.successCount++
            results.techs.details.push({ techId, name, success: true, messageId: r.sid, logError: r.logError })
          } else if (r.status === 'skipped_opt_out') {
            results.techs.skippedOptOut.push({ id: tech.id, name })
            results.techs.details.push({ techId, name, success: false, error: r.error, logError: r.logError })
          } else {
            results.techs.failedCount++
            results.techs.details.push({ techId, name, success: false, error: r.error, logError: r.logError })
          }
        } catch (error) {
          results.techs.failedCount++
          results.techs.details.push({ techId, success: false, error: error.message })
        }
      }
    }

    // Send reschedule notification to customer
    if (customerPhone) {
      const customerMessage = `Hi ${firstName}, your ${serviceName} appointment with Handld Home Services has been rescheduled to ${date} at ${time}. ${CUSTOMER_QUESTIONS}`

      const r = await sendSms({
        to: customerPhone,
        body: customerMessage,
        recipientType: 'customer',
        messageType: 'reschedule',
        jobId: job.id
      })

      results.customer.logError = r.logError
      if (r.status === 'sent') {
        results.customer.sent = true
        results.customer.messageId = r.sid
      } else if (r.status === 'outside_hours') {
        return Response.json({
          error: 'outside_texting_hours',
          nextWindow: r.nextWindow,
          ...results
        }, { status: 422 })
      } else {
        results.customer.error = r.error
        results.customer.status = r.status
      }
    }

    return Response.json(results)

  } catch (error) {
    console.error('Error sending reschedule notifications:', error)
    return Response.json({
      error: 'Failed to send reschedule notifications',
      details: error.message
    }, { status: 500 })
  }
}
