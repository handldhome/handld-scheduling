import { createTechnician, recordSmsConsent } from '@/lib/db'
import { normalizeE164, TECH_CONSENT_TEXT, CONSENT_VERSION } from '@/lib/sms'

// First hop of x-forwarded-for is the client; Vercel sets it.
function clientIp(request) {
  const xff = request.headers.get('x-forwarded-for') || ''
  const first = xff.split(',')[0].trim()
  return first || request.headers.get('x-real-ip') || null
}

export async function POST(request) {
  try {
    const data = await request.json()

    // Validate required fields
    if (!data.firstName || !data.lastName || !data.phone) {
      return Response.json(
        { error: 'First name, last name, and phone are required' },
        { status: 400 }
      )
    }

    const phone = normalizeE164(data.phone)
    if (!phone) {
      return Response.json({ error: 'Please enter a valid phone number' }, { status: 400 })
    }

    // A phone number is only accepted with the SMS consent box ticked.
    if (data.smsConsent !== true) {
      return Response.json(
        { error: 'Please tick the box agreeing to receive text messages from Handld, or leave the phone field blank.', code: 'sms_consent_required' },
        { status: 400 }
      )
    }

    const result = await createTechnician({ ...data, phone, smsConsent: true })

    const consentError = await recordSmsConsent({
      phone,
      party: 'technician',
      purpose: 'transactional',
      consentText: TECH_CONSENT_TEXT,
      consentVersion: CONSENT_VERSION,
      source: 'tech_onboarding',
      ip: clientIp(request),
      userAgent: request.headers.get('user-agent'),
      referenceId: result.id
    })

    return Response.json({
      success: true,
      techId: result.id,
      message: 'Technician created successfully',
      ...(consentError ? { consentError } : {})
    })
  } catch (error) {
    console.error('Error creating technician:', error)
    return Response.json(
      { error: 'Failed to create technician', details: error.message },
      { status: 500 }
    )
  }
}
