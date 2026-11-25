import { isAdminRequest, unauthorized } from '@/lib/admin-auth'
import { sendSms, normalizeE164, outsideHoursResponse, CUSTOMER_QUESTIONS } from '@/lib/sms'

const formatDate = (dateStr) => {
  if (!dateStr) return 'TBD'
  // Date-only strings ("YYYY-MM-DD") parse as UTC midnight; rendering them in
  // a US timezone would shift to the previous day. Anchor to local noon so the
  // calendar day is preserved across America/Los_Angeles.
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? `${dateStr}T12:00:00` : dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Los_Angeles'
  })
}

const formatTime = (timeStr) => {
  if (!timeStr) return 'TBD'
  const [hours, minutes] = timeStr.split(':')
  const h = parseInt(hours)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${minutes} ${suffix}`
}

// Admin confirms a job → customer gets a confirmation text. Not customer-
// initiated, so it is held to texting hours (422 outside_texting_hours).
export async function POST(request) {
  if (!isAdminRequest(request)) return unauthorized()

  try {
    const body = await request.json()
    const job = body.job

    if (!job) {
      return Response.json({ error: 'Job data is required' }, { status: 400 })
    }

    const phoneNumber = normalizeE164(job.phone)

    if (!phoneNumber) {
      return Response.json({ error: 'Valid phone number is required' }, { status: 400 })
    }

    // Helper to safely get string from potentially array values
    const getString = (val) => {
      if (!val) return null
      if (Array.isArray(val)) return val[0]
      return String(val)
    }

    const customerName = getString(job.customerName)
    const firstName = getString(job.firstName) || customerName?.split(' ')[0] || 'there'
    const serviceName = getString(job.serviceName) || 'service'
    const date = formatDate(getString(job.date))
    const time = formatTime(getString(job.time))

    const message = `Hi ${firstName}, your ${serviceName} appointment with Handld Home Services is confirmed for ${date} at ${time}. ${CUSTOMER_QUESTIONS}`

    const result = await sendSms({
      to: phoneNumber,
      body: message,
      recipientType: 'customer',
      messageType: 'confirmation',
      jobId: job.id
    })

    if (result.status === 'outside_hours') {
      return outsideHoursResponse(result.nextWindow, { logError: result.logError })
    }
    if (result.status === 'skipped_opt_out') {
      return Response.json({ error: 'Customer has opted out of texts', status: result.status, logError: result.logError }, { status: 409 })
    }
    if (result.status !== 'sent') {
      return Response.json({
        error: 'Failed to send confirmation text',
        details: result.error,
        logError: result.logError
      }, { status: 500 })
    }

    return Response.json({
      success: true,
      messageId: result.sid,
      to: phoneNumber,
      logError: result.logError
    })

  } catch (error) {
    console.error('Error sending confirmation SMS:', error)
    return Response.json({
      error: 'Failed to send confirmation text',
      details: error.message
    }, { status: 500 })
  }
}
