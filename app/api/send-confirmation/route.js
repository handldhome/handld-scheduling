import twilio from 'twilio'

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
    year: 'numeric'
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
  try {
    const { job } = await request.json()

    if (!job) {
      return Response.json({ error: 'Job data is required' }, { status: 400 })
    }

    const phoneNumber = formatPhoneNumber(job.phone)

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

    const message = `Hi ${firstName}, your ${serviceName} appointment with Handld Home Services is confirmed for ${date} at ${time}. Questions? Text us at (626) 298-7128`

    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    })

    return Response.json({
      success: true,
      messageId: result.sid,
      to: phoneNumber
    })

  } catch (error) {
    console.error('Error sending confirmation SMS:', error)
    return Response.json({
      error: 'Failed to send confirmation text',
      details: error.message
    }, { status: 500 })
  }
}
