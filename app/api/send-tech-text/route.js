import twilio from 'twilio'
import { getTechnician } from '@/lib/db'

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

export async function POST(request) {
  try {
    const {
      techIds = [],
      newTechs = [],
      message,
      includeAvailabilityLink,
      includeOnboardingLink
    } = await request.json()

    const hasExistingTechs = techIds && Array.isArray(techIds) && techIds.length > 0
    const hasNewTechs = newTechs && Array.isArray(newTechs) && newTechs.length > 0

    if (!hasExistingTechs && !hasNewTechs) {
      return Response.json({ error: 'At least one recipient is required' }, { status: 400 })
    }

    if (!message || !message.trim()) {
      return Response.json({ error: 'Message is required' }, { status: 400 })
    }

    const results = {
      successCount: 0,
      failedCount: 0,
      details: []
    }

    // Send text to existing technicians
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

        // Build the message with optional links
        let finalMessage = message.trim()
        if (includeAvailabilityLink) {
          const availabilityLink = `https://availability.handldhome.com/tech/${techId}/availability`
          finalMessage = `${finalMessage}\n\n${availabilityLink}`
        }
        if (includeOnboardingLink) {
          const onboardingLink = `https://schedule.handldhome.com/tech/onboarding`
          finalMessage = `${finalMessage}\n\n${onboardingLink}`
        }

        const result = await client.messages.create({
          body: finalMessage,
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

    // Send text to new technicians (not yet in Airtable)
    for (const newTech of newTechs) {
      try {
        const phoneNumber = formatPhoneNumber(newTech.phone)

        if (!phoneNumber) {
          results.failedCount++
          results.details.push({
            name: newTech.name,
            success: false,
            error: 'Invalid phone number'
          })
          continue
        }

        // Build the message with optional links
        let finalMessage = message.trim()
        if (includeOnboardingLink) {
          const onboardingLink = `https://schedule.handldhome.com/tech/onboarding`
          finalMessage = `${finalMessage}\n\n${onboardingLink}`
        }

        const result = await client.messages.create({
          body: finalMessage,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneNumber
        })

        results.successCount++
        results.details.push({
          name: newTech.name,
          success: true,
          messageId: result.sid
        })

      } catch (error) {
        results.failedCount++
        results.details.push({
          name: newTech.name,
          success: false,
          error: error.message
        })
      }
    }

    return Response.json(results)

  } catch (error) {
    console.error('Error sending tech texts:', error)
    return Response.json({
      error: 'Failed to send messages',
      details: error.message
    }, { status: 500 })
  }
}
