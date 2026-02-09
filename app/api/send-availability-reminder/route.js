import twilio from 'twilio'
import { getAllTechnicians, getAllAvailability } from '@/lib/airtable'
import { format, addDays, parseISO, isAfter, isBefore } from 'date-fns'

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

    // Calculate the date range we're checking for (next 2 weeks starting from tomorrow)
    const tomorrow = addDays(new Date(), 1)
    const twoWeeksOut = addDays(new Date(), 14)

    // Group availability by tech to see who has submitted
    const availabilityByTech = {}
    availability.forEach(record => {
      if (!record.technicianId || !record.date) return

      try {
        const recordDate = parseISO(record.date)
        // Check if this availability record is within the next 2 weeks
        if (isAfter(recordDate, tomorrow) || format(recordDate, 'yyyy-MM-dd') === format(tomorrow, 'yyyy-MM-dd')) {
          if (isBefore(recordDate, twoWeeksOut) || format(recordDate, 'yyyy-MM-dd') === format(twoWeeksOut, 'yyyy-MM-dd')) {
            if (!availabilityByTech[record.technicianId]) {
              availabilityByTech[record.technicianId] = []
            }
            availabilityByTech[record.technicianId].push(record)
          }
        }
      } catch {
        // Skip invalid dates
      }
    })

    // Filter active technicians with phone numbers
    let techsToText = technicians.filter(tech => tech.active && tech.phone)

    // If reminderOnly, filter to only techs who haven't submitted availability
    if (reminderOnly) {
      techsToText = techsToText.filter(tech => {
        const techAvailability = availabilityByTech[tech.id] || []
        // Consider "submitted" if they have at least 4 availability records (2 days worth of AM/PM)
        return techAvailability.length < 4
      })
    }

    const results = {
      reminderOnly,
      totalActiveTechs: technicians.filter(t => t.active).length,
      techsToText: techsToText.length,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      details: []
    }

    // Build message based on type
    const messageType = reminderOnly ? 'reminder' : 'initial'
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
      message: reminderOnly
        ? `Availability reminders sent to techs who haven't submitted`
        : `Availability requests sent to all active techs`,
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
  // Check if this is a reminder-only request (Thursday)
  const url = new URL(request.url)
  const reminderOnly = url.searchParams.get('reminderOnly') === 'true'

  // Create a mock request with the reminderOnly flag
  const mockRequest = {
    json: async () => ({ reminderOnly }),
    headers: request.headers
  }

  return POST(mockRequest)
}
