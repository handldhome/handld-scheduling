import twilio from 'twilio'
import { getTechnician } from '@/lib/db'

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
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
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

        const scheduleLink = `https://work.handldhome.com/tech/${techId}/schedule?date=${dateForUrl}`

        const message = `New job confirmed!\n\n${serviceName}\n${date} at ${time}\n${address}\n\nView your schedule:\n${scheduleLink}`

        const result = await client.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneNumber
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
