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
    const customerPhone = formatPhoneNumber(job.phone)
    const firstName = getString(job.firstName) || getString(job.customerName)?.split(' ')[0] || 'there'

    const results = {
      customer: { sent: false },
      techs: { successCount: 0, failedCount: 0, details: [] }
    }

    // Send reschedule notification to customer
    if (customerPhone) {
      try {
        const customerMessage = `Hi ${firstName}, your ${serviceName} appointment with Handld Home Services has been rescheduled to ${date} at ${time}. Questions? Text us at (626) 298-7128`

        await client.messages.create({
          body: customerMessage,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: customerPhone
        })

        results.customer.sent = true
      } catch (error) {
        console.error('Customer reschedule SMS error:', error)
        results.customer.error = error.message
      }
    }

    // Send reschedule notification to assigned technicians
    if (techIds && Array.isArray(techIds) && techIds.length > 0) {
      for (const techId of techIds) {
        try {
          const tech = await getTechnician(techId)
          const phoneNumber = formatPhoneNumber(tech.phone)

          if (!phoneNumber) {
            results.techs.failedCount++
            results.techs.details.push({
              techId,
              name: `${tech.firstName} ${tech.lastName}`,
              success: false,
              error: 'Invalid phone number'
            })
            continue
          }

          const scheduleLink = `https://work.handldhome.com/tech/${techId}/schedule?date=${dateForUrl}`

          const techMessage = `Job rescheduled!\n\n${serviceName}\n${date} at ${time}\n${address}\n\nView your schedule:\n${scheduleLink}`

          await client.messages.create({
            body: techMessage,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phoneNumber
          })

          results.techs.successCount++
          results.techs.details.push({
            techId,
            name: `${tech.firstName} ${tech.lastName}`,
            success: true
          })

        } catch (error) {
          results.techs.failedCount++
          results.techs.details.push({
            techId,
            success: false,
            error: error.message
          })
        }
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
