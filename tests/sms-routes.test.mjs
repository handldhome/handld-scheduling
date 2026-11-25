import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createFakeDb } from './fake-db.mjs'

// Route-level behaviour of the SMS compliance rules: templates, texting hours
// (422), technician consent gating, the fixed onboarding invite, consent
// capture, cron quiet hours and owner alerts.

const TECH_OK = 'bbbbbbbb-0000-4000-8000-000000000001'
const TECH_NO_CONSENT = 'bbbbbbbb-0000-4000-8000-000000000002'
const JOB_ID = 'aaaaaaaa-0000-4000-8000-000000000001'
const ADMIN = { 'x-admin-key': 'real-admin-key' }
const CRON = { authorization: 'Bearer cron-secret' }

const DAY = new Date('2026-11-25T18:00:00Z')    // 10:00 PST
const NIGHT = new Date('2026-11-26T05:30:00Z')  // 21:30 PST

const techs = {
  [TECH_OK]: { id: TECH_OK, firstName: 'Sam', lastName: 'Ortiz', name: 'Sam Ortiz', phone: '6265550111', active: true, smsConsentAt: '2026-11-20T00:00:00Z' },
  [TECH_NO_CONSENT]: { id: TECH_NO_CONSENT, firstName: 'Ana', lastName: 'Lee', name: 'Ana Lee', phone: '6265550122', active: true, smsConsentAt: null }
}

let fake
vi.mock('@/lib/supabase', () => ({ getDb: () => fake.db }))
const db = vi.hoisted(() => ({
  getTechnician: vi.fn(), getAllTechnicians: vi.fn(), getAllJobs: vi.fn(), getAllAvailability: vi.fn(),
  isSettingEnabled: vi.fn(), countRecentSms: vi.fn(), logSms: vi.fn(),
  createTechnician: vi.fn(), recordSmsConsent: vi.fn(), updateTechnician: vi.fn()
}))
vi.mock('@/lib/db', () => db)
const sms = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('twilio', () => ({ default: () => ({ messages: sms }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const { ONBOARDING_INVITE_BODY, CONSENT_REQUEST_BODY } = await import('../lib/sms.js')

const req = (method, headers, body, url = 'http://localhost/api/x') =>
  new Request(url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  })

beforeEach(() => {
  process.env.ADMIN_SECRET_KEY = 'real-admin-key'
  process.env.CRON_SECRET = 'cron-secret'
  process.env.TWILIO_PHONE_NUMBER = '+16262987167'
  process.env.OWNER_ALERT_PHONE = '+16265550199'
  fake = createFakeDb({ sms_opt_outs: [], sms_log: [], jobs: [], quote_requests: [], technicians: [] })
  for (const fn of Object.values(db)) fn.mockReset()
  db.logSms.mockResolvedValue(null)
  db.getTechnician.mockImplementation(async id => {
    if (!techs[id]) throw new Error('not found')
    return { ...techs[id] }
  })
  db.countRecentSms.mockResolvedValue(0)
  db.recordSmsConsent.mockResolvedValue(null)
  sms.create.mockReset().mockResolvedValue({ sid: 'SM1' })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(DAY)
})
afterEach(() => vi.useRealTimers())

const sentBodies = () => sms.create.mock.calls.map(c => c[0].body)

describe('customer templates', () => {
  it('confirmation: names Handld, voice line, footer; 422 at night', async () => {
    const { POST } = await import('../app/api/send-confirmation/route.js')
    const job = { id: JOB_ID, phone: '6265550100', customerName: 'Pat Doe', serviceName: 'Window Washing', date: '2026-11-28', time: '09:00' }
    const res = await POST(req('POST', ADMIN, { job }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, messageId: 'SM1', logError: null })
    expect(sentBodies()[0]).toBe('Hi Pat, your Window Washing appointment with Handld Home Services is confirmed for Saturday, November 28, 2026 at 9:00 AM. Questions? Call (626) 298-7128 or reply to this text. Reply STOP to opt out.')

    sms.create.mockClear()
    vi.setSystemTime(NIGHT)
    const night = await POST(req('POST', ADMIN, { job }))
    expect(night.status).toBe(422)
    expect(await night.json()).toMatchObject({ error: 'outside_texting_hours', nextWindow: '2026-11-26T16:00:00.000Z' })
    expect(sms.create).not.toHaveBeenCalled()
  })

  it('confirmation: 409 for an opted-out customer', async () => {
    fake.tables.sms_opt_outs.push({ phone: '+16265550100' })
    const { POST } = await import('../app/api/send-confirmation/route.js')
    const res = await POST(req('POST', ADMIN, { job: { id: JOB_ID, phone: '6265550100', customerName: 'Pat' } }))
    expect(res.status).toBe(409)
    expect(sms.create).not.toHaveBeenCalled()
  })

  it('public/book is customer-initiated: sends at night, exempt from the window', async () => {
    vi.setSystemTime(NIGHT)
    fake.tables.quote_requests.push({ id: 'qr-1', quote_id: 'HNDLD0400', selected_services: ['Gutter Cleaning'], customer: { id: 'c1', first_name: 'Pat', last_name: 'Doe', phone: '6265550100' } })
    const { POST } = await import('../app/api/public/book/route.js')
    const res = await POST(req('POST', {}, { quoteRequestId: 'qr-1', preferredDate: '2026-11-28', preferredTime: 'AM' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, sms: { status: 'sent' } })
    expect(sentBodies()[0]).toBe('Hi Pat! Your Handld appointment is booked for Saturday, November 28, morning (8am–12pm). We\'ll confirm your exact arrival time soon. Questions? Call (626) 298-7128 or reply to this text. Reply STOP to opt out.')
  })

  it('reschedule: techs first, then customer; 422 at night still carries tech results', async () => {
    vi.setSystemTime(NIGHT)
    const { POST } = await import('../app/api/send-reschedule-notification/route.js')
    const job = { id: JOB_ID, phone: '6265550100', customerName: 'Pat Doe', serviceName: 'Gutters', date: '2026-11-28', time: '13:00', address: '1 Main St' }
    const res = await POST(req('POST', ADMIN, { job, techIds: [TECH_OK, TECH_NO_CONSENT] }))
    expect(res.status).toBe(422)
    const data = await res.json()
    expect(data.error).toBe('outside_texting_hours')
    expect(data.techs.successCount).toBe(1)
    expect(data.techs.skippedNoConsent).toEqual([{ id: TECH_NO_CONSENT, name: 'Ana Lee' }])
    expect(sms.create).toHaveBeenCalledTimes(1)
    expect(sentBodies()[0]).toBe(`Handld: job rescheduled!\n\nGutters\nSaturday, November 28 at 1:00 PM\n1 Main St\n\nView your schedule:\nhttps://work.handldhome.com/tech/${TECH_OK}/schedule?date=2026-11-28 Reply STOP to opt out.`)
  })
})

describe('technician consent gating', () => {
  it('job notification skips techs with no sms_consent_at and reports them', async () => {
    fake.tables.jobs.push({ id: JOB_ID })
    const { POST } = await import('../app/api/send-tech-job-notification/route.js')
    const job = { id: JOB_ID, serviceName: 'Gutters', date: '2026-11-28', time: '13:00', address: '1 Main St' }
    const res = await POST(req('POST', ADMIN, { job, techIds: [TECH_OK, TECH_NO_CONSENT] }))
    const data = await res.json()
    expect(data.successCount).toBe(1)
    expect(data.skippedNoConsent).toEqual([{ id: TECH_NO_CONSENT, name: 'Ana Lee' }])
    expect(sms.create).toHaveBeenCalledTimes(1)
    const body = sentBodies()[0]
    expect(body.startsWith('Handld: new job assigned!')).toBe(true)
    expect(body.endsWith(' Reply STOP to opt out.')).toBe(true)
    expect(body).toContain('https://work.handldhome.com/confirm/')
  })

  it('send-tech-text to an existing tech is prefixed and gated', async () => {
    const { POST } = await import('../app/api/send-tech-text/route.js')
    const res = await POST(req('POST', ADMIN, { techIds: [TECH_OK, TECH_NO_CONSENT], message: 'Team meeting at 7.' }))
    const data = await res.json()
    expect(data.successCount).toBe(1)
    expect(data.skippedNoConsent).toEqual([{ id: TECH_NO_CONSENT, name: 'Ana Lee' }])
    expect(sentBodies()).toEqual(['Handld: Team meeting at 7. Reply STOP to opt out.'])
  })

  it('consent request: the one send allowed before consent, exact body', async () => {
    const { POST } = await import('../app/api/send-consent-request/route.js')
    const res = await POST(req('POST', ADMIN, { techId: TECH_NO_CONSENT }))
    expect(res.status).toBe(200)
    expect(sentBodies()).toEqual([CONSENT_REQUEST_BODY])
    expect(db.logSms).toHaveBeenCalledWith(expect.objectContaining({ messageType: 'consent_request', recipientType: 'technician', status: 'sent' }))

    const dup = await POST(req('POST', ADMIN, { techId: TECH_OK }))
    expect(dup.status).toBe(409)
  })

  it('availability reminder reports no-consent techs and sends to the rest', async () => {
    db.isSettingEnabled.mockResolvedValue(true)
    db.getAllTechnicians.mockResolvedValue(Object.values(techs).map(t => ({ ...t, availabilityTextsEnabled: true })))
    db.getAllAvailability.mockResolvedValue([])
    const { POST } = await import('../app/api/send-availability-reminder/route.js')
    const res = await POST(req('POST', ADMIN, {}))
    const data = await res.json()
    expect(data.successCount).toBe(1)
    expect(data.skippedNoConsent).toEqual([{ id: TECH_NO_CONSENT, name: 'Ana Lee' }])
    expect(sentBodies()[0]).toBe(`Handld: Hey! Please submit your availability for the next two weeks using the link below. Thanks!\n\nhttps://availability.handldhome.com/tech/${TECH_OK}/availability Reply STOP to opt out.`)
  })
})

describe('onboarding invite to numbers not in the database', () => {
  it('sends only the fixed invite, ignoring the caller message, and logs onboarding_invite', async () => {
    const { POST } = await import('../app/api/send-tech-text/route.js')
    const res = await POST(req('POST', ADMIN, { newTechs: [{ name: 'New Tech', phone: '(626) 555-0133' }], message: 'Free text that must not be sent', includeOnboardingLink: true }))
    expect(res.status).toBe(200)
    expect(sentBodies()).toEqual([ONBOARDING_INVITE_BODY])
    expect(sms.create.mock.calls[0][0].to).toBe('+16265550133')
    expect(db.logSms).toHaveBeenCalledWith(expect.objectContaining({ recipientType: 'technician', messageType: 'onboarding_invite', messageBody: ONBOARDING_INVITE_BODY }))
  })

  it('no message needed when only new numbers are given', async () => {
    const { POST } = await import('../app/api/send-tech-text/route.js')
    const res = await POST(req('POST', ADMIN, { newTechs: [{ name: 'New Tech', phone: '6265550133' }] }))
    expect(res.status).toBe(200)
    expect((await res.json()).successCount).toBe(1)
  })

  it('caps the invite at one per number per 24h', async () => {
    db.countRecentSms.mockResolvedValue(1)
    const { POST } = await import('../app/api/send-tech-text/route.js')
    const res = await POST(req('POST', ADMIN, { newTechs: [{ name: 'New Tech', phone: '6265550133' }] }))
    const data = await res.json()
    expect(data.successCount).toBe(0)
    expect(data.skippedRateLimited).toEqual([{ name: 'New Tech', phone: '+16265550133' }])
    expect(sms.create).not.toHaveBeenCalled()
    expect(db.countRecentSms).toHaveBeenCalledWith(expect.objectContaining({ phone: '+16265550133', messageType: 'onboarding_invite' }))
  })
})

describe('consent capture', () => {
  it('onboard refuses a phone without smsConsent: true', async () => {
    const { POST } = await import('../app/api/technicians/onboard/route.js')
    const res = await POST(req('POST', {}, { firstName: 'Ana', lastName: 'Lee', phone: '6265550122' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('sms_consent_required')
    expect(db.createTechnician).not.toHaveBeenCalled()
  })

  it('onboard records sms_consent_at and an sms_consents row', async () => {
    db.createTechnician.mockResolvedValue({ id: TECH_NO_CONSENT })
    const { POST } = await import('../app/api/technicians/onboard/route.js')
    const res = await POST(req('POST', { 'x-forwarded-for': '203.0.113.9, 10.0.0.1', 'user-agent': 'UA/1' }, { firstName: 'Ana', lastName: 'Lee', phone: '(626) 555-0122', smsConsent: true }))
    expect(res.status).toBe(200)
    expect(db.createTechnician).toHaveBeenCalledWith(expect.objectContaining({ phone: '+16265550122', smsConsent: true }))
    expect(db.recordSmsConsent).toHaveBeenCalledWith({
      phone: '+16265550122', party: 'technician', purpose: 'transactional',
      consentText: expect.stringContaining('I agree to receive text messages from Handld'),
      consentVersion: '2026-11-25', source: 'tech_onboarding', ip: '203.0.113.9', userAgent: 'UA/1', referenceId: TECH_NO_CONSENT
    })
  })

  it('PATCH technicians: admin records verbal/paper consent with a source', async () => {
    db.updateTechnician.mockResolvedValue({ id: TECH_NO_CONSENT })
    const { PATCH } = await import('../app/api/technicians/[techId]/route.js')
    const missing = await PATCH(req('PATCH', ADMIN, { smsConsent: true }), { params: { techId: TECH_NO_CONSENT } })
    expect(missing.status).toBe(400)
    expect(db.updateTechnician).not.toHaveBeenCalled()

    const res = await PATCH(req('PATCH', ADMIN, { smsConsent: true, consentSource: 'verbal, phone call 2026-11-25' }), { params: { techId: TECH_NO_CONSENT } })
    expect(res.status).toBe(200)
    expect(db.updateTechnician).toHaveBeenCalledWith(TECH_NO_CONSENT, { smsConsentAt: DAY.toISOString() })
    expect(db.recordSmsConsent).toHaveBeenCalledWith(expect.objectContaining({
      phone: '+16265550122', party: 'technician', source: 'admin_manual', referenceId: TECH_NO_CONSENT,
      consentText: expect.stringContaining('verbal, phone call 2026-11-25')
    }))
  })
})

describe('crons', () => {
  it('schedule + availability reminders skip between 21:00 and 07:59 PT', async () => {
    vi.setSystemTime(NIGHT)
    const sched = await import('../app/api/send-schedule-reminder/route.js')
    const avail = await import('../app/api/send-availability-reminder/route.js')
    for (const mod of [sched, avail]) {
      const res = await mod.GET(new Request('http://localhost/api/x', { headers: CRON }))
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ skipped: 'quiet_hours', nextWindow: '2026-11-26T16:00:00.000Z' })
    }
    expect(db.getAllJobs).not.toHaveBeenCalled()
    expect(db.isSettingEnabled).not.toHaveBeenCalled()
  })

  it('schedule reminder sends in hours, prefixed and gated by consent', async () => {
    db.getAllJobs.mockResolvedValue([
      { id: 'j1', date: '2026-11-26', time: '09:00', serviceName: 'Gutters', assignedTech: [TECH_OK] },
      { id: 'j2', date: '2026-11-26', time: '13:00', serviceName: 'Windows', assignedTech: [TECH_NO_CONSENT] }
    ])
    db.getAllTechnicians.mockResolvedValue(Object.values(techs))
    const { GET } = await import('../app/api/send-schedule-reminder/route.js')
    const res = await GET(new Request('http://localhost/api/x', { headers: CRON }))
    const data = await res.json()
    expect(data.successCount).toBe(1)
    expect(data.skippedNoConsent).toEqual([{ id: TECH_NO_CONSENT, name: 'Ana Lee' }])
    expect(sentBodies()[0]).toBe(`Handld: Hi Sam! You have 1 job scheduled for Thursday, November 26:\n\n9:00 AM - Gutters\n\nView full schedule:\nhttps://work.handldhome.com/tech/${TECH_OK}/schedule?date=2026-11-26 Reply STOP to opt out.`)
  })

  it('check-tech-confirmations alerts OWNER_ALERT_PHONE without a footer, at any hour', async () => {
    vi.setSystemTime(NIGHT)
    fake.tables.jobs.push({
      id: JOB_ID, service: 'Gutters', target_date: '2026-11-28', scheduled_time: '13:00',
      tech_confirmation_deadline: '2026-11-25T00:00:00Z', tech_confirmation_token: 'tok', tech_confirmed_at: null, tech_declined_at: null,
      technician: { first_name: 'Sam', last_name: 'Ortiz' }, quote_request: { address: '1 Main St' }
    })
    const { GET } = await import('../app/api/cron/check-tech-confirmations/route.js')
    const res = await GET(new Request('http://localhost/api/x', { headers: CRON }))
    expect(res.status).toBe(200)
    expect(sms.create).toHaveBeenCalledTimes(1)
    expect(sms.create.mock.calls[0][0].to).toBe('+16265550199')
    expect(sentBodies()[0]).toContain('Sam Ortiz did NOT confirm')
    expect(sentBodies()[0]).not.toContain('Reply STOP')
    expect(fake.tables.jobs[0].tech_confirmation_token).toBeNull()
  })
})

describe('tech-confirm', () => {
  const row = () => ({
    id: JOB_ID, service: 'Gutters', target_date: '2026-11-28', scheduled_time: '13:00', tech_confirmation_token: 'tok',
    tech_confirmation_deadline: '2026-12-01T00:00:00Z', tech_confirmed_at: null, tech_declined_at: null,
    technician: { id: TECH_OK, first_name: 'Sam', last_name: 'Ortiz', phone: '6265550111' },
    quote_request: { address: '1 Main St', city: 'Pasadena', customer: { first_name: 'Pat', last_name: 'Doe', phone: '6265550100' } }
  })

  it('confirm texts the customer in hours with the Handld template', async () => {
    fake.tables.jobs.push(row())
    const { POST } = await import('../app/api/tech-confirm/[token]/route.js')
    const res = await POST(req('POST', {}, { action: 'confirm' }), { params: { token: 'tok' } })
    expect(await res.json()).toMatchObject({ success: true, action: 'confirmed', customerText: { status: 'sent' } })
    expect(sentBodies()[0]).toBe("Hi Pat! Great news — your Gutters appointment with Handld is confirmed for Saturday, November 28 at 1:00 PM. Sam will be your technician. You'll get a text when they're on the way. Questions? Call (626) 298-7128 or reply to this text. Reply STOP to opt out.")
  })

  it('confirm at night still confirms, customer text held', async () => {
    vi.setSystemTime(NIGHT)
    fake.tables.jobs.push(row())
    const { POST } = await import('../app/api/tech-confirm/[token]/route.js')
    const res = await POST(req('POST', {}, { action: 'confirm' }), { params: { token: 'tok' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, customerText: { status: 'outside_hours', nextWindow: '2026-11-26T16:00:00.000Z' } })
    expect(sms.create).not.toHaveBeenCalled()
    expect(fake.tables.jobs[0].confirmed).toBe(true)
  })

  it('decline alerts the owner (no footer)', async () => {
    fake.tables.jobs.push(row())
    const { POST } = await import('../app/api/tech-confirm/[token]/route.js')
    const res = await POST(req('POST', {}, { action: 'decline', reason: 'sick' }), { params: { token: 'tok' } })
    expect(await res.json()).toMatchObject({ success: true, action: 'declined' })
    expect(sms.create.mock.calls[0][0].to).toBe('+16265550199')
    expect(sentBodies()[0]).toContain('Sam Ortiz declined a job')
    expect(sentBodies()[0]).not.toContain('Reply STOP')
  })
})
