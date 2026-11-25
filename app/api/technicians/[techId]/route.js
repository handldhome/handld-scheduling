import { getTechnician, updateTechnician, recordSmsConsent } from '@/lib/db'
import { NextResponse } from 'next/server'
import { isAdminRequest, unauthorized } from '@/lib/admin-auth'
import { normalizeE164, CONSENT_VERSION } from '@/lib/sms'

function clientIp(request) {
  const xff = request.headers.get('x-forwarded-for') || ''
  const first = xff.split(',')[0].trim()
  return first || request.headers.get('x-real-ip') || null
}

// PATCH body:
//   { allowTexting: boolean }
//   { smsConsent: true, consentSource: 'verbal, phone call 2026-11-25' }
//     — admin records consent given verbally / on paper. Sets
//       technicians.sms_consent_at and writes an sms_consents row
//       (source admin_manual) with the admin's note as evidence.
export async function PATCH(request, { params }) {
  if (!isAdminRequest(request)) return unauthorized()

  try {
    const { techId } = params
    const body = await request.json()
    const updates = {}
    if (body.allowTexting !== undefined) updates.allowTexting = body.allowTexting

    let consent = null
    if (body.smsConsent === true) {
      const consentSource = typeof body.consentSource === 'string' ? body.consentSource.trim() : ''
      if (!consentSource) {
        return NextResponse.json({ error: 'consentSource is required: say how consent was given (e.g. "verbal, phone call 2026-11-25")' }, { status: 400 })
      }
      const tech = await getTechnician(techId)
      const phone = normalizeE164(tech.phone)
      if (!phone) {
        return NextResponse.json({ error: 'Technician has no valid phone number' }, { status: 400 })
      }
      updates.smsConsentAt = new Date().toISOString()
      consent = { tech, phone, consentSource }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const result = await updateTechnician(techId, updates)

    let consentError = null
    if (consent) {
      consentError = await recordSmsConsent({
        phone: consent.phone,
        party: 'technician',
        purpose: 'transactional',
        consentText: `Consent recorded by admin outside the app: ${consent.consentSource}`,
        consentVersion: CONSENT_VERSION,
        source: 'admin_manual',
        ip: clientIp(request),
        userAgent: request.headers.get('user-agent'),
        referenceId: result.id
      })
    }

    return NextResponse.json({
      success: true,
      id: result.id,
      ...(updates.smsConsentAt ? { smsConsentAt: updates.smsConsentAt } : {}),
      ...(consentError ? { consentError } : {})
    })
  } catch (error) {
    console.error('Error updating technician:', error)
    return NextResponse.json(
      { error: 'Failed to update technician', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET(request, { params }) {
  try {
    const { techId } = params
    const technician = await getTechnician(techId)

    if (!technician.active) {
      return NextResponse.json(
        { error: 'Technician not active' },
        { status: 404 }
      )
    }

    return NextResponse.json(technician)
  } catch (error) {
    return NextResponse.json(
      { error: 'Technician not found' },
      { status: 404 }
    )
  }
}
