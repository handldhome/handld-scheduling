import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createFakeDb } from './fake-db.mjs'

// lib/sms.js: the compliance gate every outbound text goes through.

let fake
vi.mock('@/lib/supabase', () => ({ getDb: () => fake.db }))
const dbMod = vi.hoisted(() => ({ logSms: vi.fn() }))
vi.mock('@/lib/db', () => dbMod)
const sms = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('twilio', () => ({ default: () => ({ messages: sms }) }))

const {
  normalizeE164, withStopFooter, withHandldPrefix, isWithinTextingHours, nextTextingWindow,
  isOptedOut, recordOptOut, sendSms, sendOwnerAlert, ownerAlertPhone,
  CONSENT_REQUEST_BODY, ONBOARDING_INVITE_BODY, CUSTOMER_QUESTIONS, STOP_FOOTER
} = await import('../lib/sms.js')

// 2026-11-25 is PST (UTC-8); 2026-07-01 is PDT (UTC-7).
const DAY_PST = new Date('2026-11-25T18:00:00Z')      // 10:00 PST
const NIGHT_PST = new Date('2026-11-26T05:30:00Z')    // 21:30 PST (Nov 25)
const EARLY_PST = new Date('2026-11-25T15:00:00Z')    // 07:00 PST

beforeEach(() => {
  fake = createFakeDb({ sms_opt_outs: [], sms_log: [] })
  dbMod.logSms.mockReset().mockResolvedValue(null)
  sms.create.mockReset().mockResolvedValue({ sid: 'SM123' })
  process.env.TWILIO_PHONE_NUMBER = '+16262987167'
  delete process.env.OWNER_ALERT_PHONE
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(DAY_PST)
})
afterEach(() => vi.useRealTimers())

describe('normalizeE164', () => {
  it('normalises US formats', () => {
    expect(normalizeE164('(626) 555-0100')).toBe('+16265550100')
    expect(normalizeE164('6265550100')).toBe('+16265550100')
    expect(normalizeE164('1 626 555 0100')).toBe('+16265550100')
    expect(normalizeE164('+1 626-555-0100')).toBe('+16265550100')
    expect(normalizeE164(['6265550100'])).toBe('+16265550100')
    expect(normalizeE164(6265550100)).toBe('+16265550100')
  })
  it('rejects junk', () => {
    expect(normalizeE164('')).toBeNull()
    expect(normalizeE164(null)).toBeNull()
    expect(normalizeE164(undefined)).toBeNull()
    expect(normalizeE164('555-0100')).toBeNull()
    expect(normalizeE164('not a phone')).toBeNull()
  })
})

describe('footer and prefix', () => {
  it('appends exactly " Reply STOP to opt out." once', () => {
    expect(withStopFooter('Hi there.')).toBe('Hi there. Reply STOP to opt out.')
    expect(withStopFooter('Hi there.  \n')).toBe('Hi there. Reply STOP to opt out.')
    expect(withStopFooter('Already here. Reply STOP to opt out.')).toBe('Already here. Reply STOP to opt out.')
    expect(withStopFooter('Reply STOP to cancel.')).toBe('Reply STOP to cancel.')
    expect(STOP_FOOTER).toBe(' Reply STOP to opt out.')
  })
  it('prefixes technician texts with "Handld: " once', () => {
    expect(withHandldPrefix('new job assigned!')).toBe('Handld: new job assigned!')
    expect(withHandldPrefix('Handld: already')).toBe('Handld: already')
    expect(withHandldPrefix('handld: lower')).toBe('handld: lower')
  })
  it('fixed bodies carry their own footer and the voice line is never "Text us"', () => {
    expect(CONSENT_REQUEST_BODY).toBe('Handld: we text job assignments, schedules and availability requests to this number. Reply YES to agree. Msg & data rates may apply. Reply STOP to opt out.')
    expect(ONBOARDING_INVITE_BODY).toBe("Handld: you've been invited to join the Handld technician team. Complete onboarding here: https://schedule.handldhome.com/tech/onboarding Reply STOP to opt out.")
    expect(withStopFooter(CONSENT_REQUEST_BODY)).toBe(CONSENT_REQUEST_BODY)
    expect(CUSTOMER_QUESTIONS).toBe('Questions? Call (626) 298-7128 or reply to this text.')
  })
})

describe('texting hours (America/Los_Angeles)', () => {
  it('08:00–20:59 PST is inside, 07:59 and 21:00 are outside', () => {
    expect(isWithinTextingHours(new Date('2026-11-25T16:00:00Z'))).toBe(true)   // 08:00 PST
    expect(isWithinTextingHours(new Date('2026-11-25T15:59:00Z'))).toBe(false)  // 07:59 PST
    expect(isWithinTextingHours(new Date('2026-11-26T04:59:00Z'))).toBe(true)   // 20:59 PST
    expect(isWithinTextingHours(new Date('2026-11-26T05:00:00Z'))).toBe(false)  // 21:00 PST
    expect(isWithinTextingHours(NIGHT_PST)).toBe(false)
    expect(isWithinTextingHours(EARLY_PST)).toBe(false)
  })
  it('follows daylight time', () => {
    expect(isWithinTextingHours(new Date('2026-07-01T15:00:00Z'))).toBe(true)   // 08:00 PDT
    expect(isWithinTextingHours(new Date('2026-07-01T14:59:00Z'))).toBe(false)  // 07:59 PDT
    expect(isWithinTextingHours(new Date('2026-07-02T03:59:00Z'))).toBe(true)   // 20:59 PDT
    expect(isWithinTextingHours(new Date('2026-07-02T04:00:00Z'))).toBe(false)  // 21:00 PDT
  })
  it('nextTextingWindow is the next 08:00 Pacific', () => {
    expect(nextTextingWindow(NIGHT_PST).toISOString()).toBe('2026-11-26T16:00:00.000Z')  // 08:00 PST Nov 26
    expect(nextTextingWindow(EARLY_PST).toISOString()).toBe('2026-11-25T16:00:00.000Z')  // 08:00 PST Nov 25
    expect(nextTextingWindow(new Date('2026-07-02T04:00:00Z')).toISOString()).toBe('2026-07-02T15:00:00.000Z') // 08:00 PDT Jul 2
    expect(nextTextingWindow(DAY_PST).toISOString()).toBe(DAY_PST.toISOString())
  })
})

describe('opt-out list', () => {
  it('reads and writes handld.sms_opt_outs in E.164', async () => {
    expect(await isOptedOut('6265550100')).toBe(false)
    expect(await recordOptOut('(626) 555-0100', 'twilio_21610')).toBeNull()
    expect(fake.tables.sms_opt_outs).toEqual([
      expect.objectContaining({ phone: '+16265550100', source: 'twilio_21610', keyword: null })
    ])
    expect(await isOptedOut('+1 626 555 0100')).toBe(true)
  })
})

describe('sendSms', () => {
  const base = { to: '6265550100', body: 'Hi Pat, Handld here.', recipientType: 'customer', messageType: 'confirmation', jobId: 'job-1' }

  it('sends from TWILIO_PHONE_NUMBER with the footer and logs it', async () => {
    const r = await sendSms(base)
    expect(r).toMatchObject({ status: 'sent', sid: 'SM123', logError: null })
    expect(sms.create).toHaveBeenCalledWith({ to: '+16265550100', from: '+16262987167', body: 'Hi Pat, Handld here. Reply STOP to opt out.' })
    expect(dbMod.logSms).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 'job-1', recipientPhone: '+16265550100', recipientType: 'customer', messageType: 'confirmation',
      messageBody: 'Hi Pat, Handld here. Reply STOP to opt out.', twilioSid: 'SM123', status: 'sent'
    }))
  })

  it('skips opted-out numbers and logs skipped_opt_out', async () => {
    fake.tables.sms_opt_outs.push({ phone: '+16265550100', source: 'webhook' })
    const r = await sendSms(base)
    expect(r.status).toBe('skipped_opt_out')
    expect(sms.create).not.toHaveBeenCalled()
    expect(dbMod.logSms).toHaveBeenCalledWith(expect.objectContaining({ status: 'skipped_opt_out' }))
  })

  it('fails closed when the opt-out list cannot be read', async () => {
    fake = { db: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'rls' } }) }) }) }) } }
    const r = await sendSms(base)
    expect(r.status).toBe('failed')
    expect(r.error).toMatch(/Opt-out check failed: rls/)
    expect(sms.create).not.toHaveBeenCalled()
  })

  it('holds customer texts outside 8am–9pm Pacific', async () => {
    vi.setSystemTime(NIGHT_PST)
    const r = await sendSms(base)
    expect(r).toMatchObject({ status: 'outside_hours', nextWindow: '2026-11-26T16:00:00.000Z' })
    expect(sms.create).not.toHaveBeenCalled()
    expect(dbMod.logSms).toHaveBeenCalledWith(expect.objectContaining({ status: 'skipped_outside_hours' }))
  })

  it('customer-initiated texts are exempt from the window', async () => {
    vi.setSystemTime(NIGHT_PST)
    const r = await sendSms({ ...base, exemptFromQuietHours: true })
    expect(r.status).toBe('sent')
  })

  it('technician texts have no window', async () => {
    vi.setSystemTime(NIGHT_PST)
    const r = await sendSms({ ...base, recipientType: 'technician', body: 'Handld: job tomorrow' })
    expect(r.status).toBe('sent')
    expect(sms.create.mock.calls[0][0].body).toBe('Handld: job tomorrow Reply STOP to opt out.')
  })

  it('owner alerts skip the footer and the window, and go to OWNER_ALERT_PHONE', async () => {
    vi.setSystemTime(NIGHT_PST)
    process.env.OWNER_ALERT_PHONE = '(626) 555-0199'
    expect(ownerAlertPhone()).toBe('+16265550199')
    const r = await sendOwnerAlert({ body: 'Tech declined', messageType: 'owner_alert_tech_declined' })
    expect(r.status).toBe('sent')
    expect(sms.create).toHaveBeenCalledWith({ to: '+16265550199', from: '+16262987167', body: 'Tech declined' })
    expect(dbMod.logSms).toHaveBeenCalledWith(expect.objectContaining({ recipientType: 'owner', status: 'sent' }))
  })

  it('falls back to the legacy owner line when OWNER_ALERT_PHONE is unset', () => {
    expect(ownerAlertPhone()).toBe('+16263900189')
  })

  it('records a Twilio 21610 as an opt-out and logs the failure', async () => {
    sms.create.mockRejectedValueOnce(Object.assign(new Error('Attempt to send to unsubscribed recipient'), { code: 21610 }))
    const r = await sendSms(base)
    expect(r).toMatchObject({ status: 'failed', code: 21610 })
    expect(fake.tables.sms_opt_outs).toEqual([expect.objectContaining({ phone: '+16265550100', source: 'twilio_21610' })])
    expect(dbMod.logSms).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', errorMessage: 'Attempt to send to unsubscribed recipient' }))
  })

  it('other Twilio errors do not opt the number out', async () => {
    sms.create.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 30007 }))
    const r = await sendSms(base)
    expect(r.status).toBe('failed')
    expect(fake.tables.sms_opt_outs).toEqual([])
  })

  it('surfaces a broken sms_log as logError without failing the send', async () => {
    dbMod.logSms.mockResolvedValueOnce('new row violates row-level security policy')
    const r = await sendSms(base)
    expect(r.status).toBe('sent')
    expect(r.logError).toBe('new row violates row-level security policy')
  })

  it('rejects an undialable number before touching Twilio', async () => {
    const r = await sendSms({ ...base, to: '555' })
    expect(r.status).toBe('invalid_phone')
    expect(sms.create).not.toHaveBeenCalled()
    expect(dbMod.logSms).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', recipientPhone: '555' }))
  })
})
