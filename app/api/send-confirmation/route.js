import twilio from 'twilio'
import { logSms } from '@/lib/db'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

const formatPhoneNumber = (phone) => {
  if (!phone) return null

  // Handle if phone is an array (from Airtable linked records)
  let phoneStr = phone
  if (Array.isArray(phone)) {
    phoneStr = phone[0]
  }

  // Ensure it's a string
  if (typeof phoneStr !== 'string') {
    phoneStr = String(phoneStr)
  }

  // Remove all non-numeric characters
  const cleaned = phoneStr.replace(/\D/g, '')

  // Add +1 if it's a 10-digit US number
  if (cleaned.length === 10) {
    return `+1${cleaned}`
  }

  // Add + if it's 11 digits starting with 1
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`
  }

  // Return as-is if already formatted
  if (phoneStr.startsWith('+')) {
    return phoneStr
  }

  return null
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'TBD'
  const date = new Date(dateStr)
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

export async function POST(request) {
  let job = null
  let phoneNumber = null
  let message = ''
  try {
    const body = await request.json()
    job = body.job

    if (!job) {
      return Response.json({ error: 'Job data is required' }, { status: 400 })
    }

    phoneNumber = formatPhoneNumber(job.phone)

    if (!phoneNumber) {
      return Response.json({ error: 'Valid phone number is required' }, { status: 400 })
    }

    // Helper to safely get string from potentially array values (Airtable)
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

    message = `Hi ${firstName}, your ${serviceName} appointment with Handld Home Services is confirmed for ${date} at ${time}. Questions? Text us at (626) 298-7128`

    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    })

    await logSms({
      jobId: job.id,
      recipientPhone: phoneNumber,
      recipientType: 'customer',
      messageType: 'confirmation',
      messageBody: message,
      twilioSid: result.sid,
      status: 'sent'
    })

    return Response.json({
      success: true,
      messageId: result.sid,
      to: phoneNumber
    })

  } catch (error) {
    console.error('Error sending confirmation SMS:', error)
    await logSms({
      jobId: job?.id,
      recipientPhone: phoneNumber || 'unknown',
      recipientType: 'customer',
      messageType: 'confirmation',
      messageBody: message || '',
      status: 'failed',
      errorMessage: error.message
    })
    return Response.json({
      error: 'Failed to send confirmation text',
      details: error.message
    }, { status: 500 })
  }
}
