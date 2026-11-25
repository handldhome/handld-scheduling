import { getTechnician, countRecentSms } from '@/lib/db'
import { isAdminRequest, unauthorized } from '@/lib/admin-auth'
import { sendSms, normalizeE164, withHandldPrefix, ONBOARDING_INVITE_BODY } from '@/lib/sms'

const INVITE_WINDOW_MS = 24 * 60 * 60 * 1000

// Admin "Text Technician(s)" modal.
//   techIds  — existing technicians: any message (prefixed "Handld: "), needs
//              sms_consent_at on file.
//   newTechs — numbers not in the DB: ONLY the fixed onboarding invite is
//              sent (any caller-supplied message is ignored), at most once per
//              number per 24h.
export async function POST(request) {
  if (!isAdminRequest(request)) return unauthorized()

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

    if (hasExistingTechs && (!message || !message.trim())) {
      return Response.json({ error: 'Message is required' }, { status: 400 })
    }

    const results = {
      successCount: 0,
      failedCount: 0,
      skippedNoConsent: [],
      skippedOptOut: [],
      skippedRateLimited: [],
      details: []
    }

    // Send text to existing technicians
    for (const techId of (hasExistingTechs ? techIds : [])) {
      try {
        const tech = await getTechnician(techId)
        const name = `${tech.firstName} ${tech.lastName}`

        if (!tech.smsConsentAt) {
          results.skippedNoConsent.push({ id: tech.id, name })
          results.details.push({ techId, name, success: false, error: 'No SMS consent on file' })
          continue
        }

        const phoneNumber = normalizeE164(tech.phone)

        if (!phoneNumber) {
          results.failedCount++
          results.details.push({ techId, name, success: false, error: 'Invalid phone number' })
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

        const r = await sendSms({
          to: phoneNumber,
          body: withHandldPrefix(finalMessage),
          recipientType: 'technician',
          messageType: includeAvailabilityLink ? 'availability_request' : includeOnboardingLink ? 'onboarding_link' : 'admin_message'
        })

        if (r.status === 'sent') {
          results.successCount++
          results.details.push({ techId, name, success: true, messageId: r.sid, logError: r.logError })
        } else if (r.status === 'skipped_opt_out') {
          results.skippedOptOut.push({ id: tech.id, name })
          results.details.push({ techId, name, success: false, error: r.error, logError: r.logError })
        } else {
          results.failedCount++
          results.details.push({ techId, name, success: false, error: r.error, logError: r.logError })
        }

      } catch (error) {
        results.failedCount++
        results.details.push({ techId, success: false, error: error.message })
      }
    }

    // Onboarding invite to numbers not yet in the database. Fixed text only.
    for (const newTech of (hasNewTechs ? newTechs : [])) {
      const name = newTech?.name || 'New technician'
      try {
        const phoneNumber = normalizeE164(newTech?.phone)

        if (!phoneNumber) {
          results.failedCount++
          results.details.push({ name, success: false, error: 'Invalid phone number' })
          continue
        }

        const since = new Date(Date.now() - INVITE_WINDOW_MS).toISOString()
        const recent = await countRecentSms({ phone: phoneNumber, messageType: 'onboarding_invite', sinceIso: since })
        if (recent > 0) {
          results.skippedRateLimited.push({ name, phone: phoneNumber })
          results.details.push({ name, success: false, error: 'Onboarding invite already sent to this number in the last 24 hours' })
          continue
        }

        const r = await sendSms({
          to: phoneNumber,
          body: ONBOARDING_INVITE_BODY,
          recipientType: 'technician',
          messageType: 'onboarding_invite'
        })

        if (r.status === 'sent') {
          results.successCount++
          results.details.push({ name, success: true, messageId: r.sid, logError: r.logError })
        } else if (r.status === 'skipped_opt_out') {
          results.skippedOptOut.push({ name, phone: phoneNumber })
          results.details.push({ name, success: false, error: r.error, logError: r.logError })
        } else {
          results.failedCount++
          results.details.push({ name, success: false, error: r.error, logError: r.logError })
        }

      } catch (error) {
        results.failedCount++
        results.details.push({ name, success: false, error: error.message })
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
