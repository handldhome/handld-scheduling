import { getTechnician } from '@/lib/db'
import { isAdminRequest, unauthorized } from '@/lib/admin-auth'
import { sendSms, normalizeE164, CONSENT_REQUEST_BODY } from '@/lib/sms'

// POST { techId } — texts one existing technician the fixed consent request.
// This is the one technician send allowed without sms_consent_at on file.
// A YES reply is recorded by the Twilio webhook (handld-pro) which sets
// handld.technicians.sms_consent_at.
export async function POST(request) {
  if (!isAdminRequest(request)) return unauthorized()

  try {
    const { techId } = await request.json()
    if (!techId) {
      return Response.json({ error: 'techId is required' }, { status: 400 })
    }

    const tech = await getTechnician(techId)
    const name = `${tech.firstName} ${tech.lastName}`

    if (tech.smsConsentAt) {
      return Response.json({ error: 'Technician has already consented', techId: tech.id, name, smsConsentAt: tech.smsConsentAt }, { status: 409 })
    }

    const phoneNumber = normalizeE164(tech.phone)
    if (!phoneNumber) {
      return Response.json({ error: 'Technician has no valid phone number', techId: tech.id, name }, { status: 400 })
    }

    const r = await sendSms({
      to: phoneNumber,
      body: CONSENT_REQUEST_BODY,
      recipientType: 'technician',
      messageType: 'consent_request'
    })

    if (r.status === 'skipped_opt_out') {
      return Response.json({ error: 'This number has opted out of texts; they must text START first', status: r.status, techId: tech.id, name, logError: r.logError }, { status: 409 })
    }
    if (r.status !== 'sent') {
      return Response.json({ error: 'Failed to send consent request', details: r.error, techId: tech.id, name, logError: r.logError }, { status: 500 })
    }

    return Response.json({ success: true, techId: tech.id, name, to: phoneNumber, messageId: r.sid, logError: r.logError })
  } catch (error) {
    console.error('Error sending consent request:', error)
    return Response.json({ error: 'Failed to send consent request', details: error.message }, { status: 500 })
  }
}
