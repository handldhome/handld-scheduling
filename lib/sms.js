// Every outbound text goes through sendSms(). It enforces the shared Handld
// SMS compliance rules (consent version 2026-11-25):
//   1. opt-out list (handld.sms_opt_outs) is checked before every send
//   2. Twilio 21610 (recipient replied STOP) is written back to that list
//   3. customer and technician bodies end with " Reply STOP to opt out."
//   4. customer texts that are not a reply to the customer's own action are
//      held to 08:00–20:59 America/Los_Angeles
//   5. every attempt (sent / failed / skipped) is written to handld.sms_log
// Owner alerts (recipientType 'owner') skip the footer and the hours check.
import twilio from 'twilio'
import { getDb } from '@/lib/supabase'
import { logSms } from '@/lib/db'

export const TEXTING_TIMEZONE = 'America/Los_Angeles'
export const TEXTING_START_HOUR = 8 // 08:00 PT inclusive
export const TEXTING_END_HOUR = 21 // 21:00 PT exclusive (last send 20:59)

export const STOP_FOOTER = ' Reply STOP to opt out.'
export const CONSENT_VERSION = '2026-11-25'

// (626) 298-7128 is the voice line; it can no longer receive SMS.
export const CUSTOMER_QUESTIONS = 'Questions? Call (626) 298-7128 or reply to this text.'

export const CONSENT_REQUEST_BODY =
  'Handld: we text job assignments, schedules and availability requests to this number. Reply YES to agree. Msg & data rates may apply. Reply STOP to opt out.'

export const ONBOARDING_INVITE_BODY =
  "Handld: you've been invited to join the Handld technician team. Complete onboarding here: https://schedule.handldhome.com/tech/onboarding Reply STOP to opt out."

// Exact label shown on the technician onboarding form; stored verbatim in sms_consents.
export const TECH_CONSENT_TEXT =
  'I agree to receive text messages from Handld at this number about jobs, schedules and availability, such as job assignments, daily schedules and availability requests. Message frequency varies. Msg & data rates may apply. Reply STOP to cancel or HELP for help. See the SMS Terms (https://handldhome.com/sms-terms) and Privacy Policy (https://handldhome.com/privacy).'

// Legacy owner line kept only as a fallback so alerts keep flowing when the
// env var is missing. Set OWNER_ALERT_PHONE in Vercel.
const LEGACY_OWNER_PHONE = '+16263900189'

export function ownerAlertPhone() {
  return normalizeE164(process.env.OWNER_ALERT_PHONE) || LEGACY_OWNER_PHONE
}

/**
 * Normalise a phone to E.164 (+1XXXXXXXXXX). Returns null when the input
 * cannot be a dialable number.
 */
export function normalizeE164(phone) {
  if (phone === null || phone === undefined) return null
  let str = Array.isArray(phone) ? phone[0] : phone
  if (str === null || str === undefined) return null
  str = String(str).trim()
  if (!str) return null
  const digits = str.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (str.startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`
  return null
}

export function withStopFooter(body) {
  const text = String(body ?? '')
  if (/Reply STOP/i.test(text)) return text
  return `${text.replace(/\s+$/, '')}${STOP_FOOTER}`
}

// Technician bodies start with "Handld: ".
export function withHandldPrefix(body) {
  const text = String(body ?? '').replace(/^\s+/, '')
  if (/^Handld(\s+Home)?:/i.test(text)) return text
  return `Handld: ${text}`
}

function zonedParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TEXTING_TIMEZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(date)
  const out = {}
  for (const p of parts) if (p.type !== 'literal') out[p.type] = parseInt(p.value, 10)
  // Some ICU builds render midnight as 24 with hourCycle h23 fallbacks.
  if (out.hour === 24) out.hour = 0
  return out
}

// UTC instant for a wall-clock time in TEXTING_TIMEZONE.
function zonedTimeToUtc(year, month, day, hour, minute = 0) {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0)
  const p = zonedParts(new Date(guess))
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return new Date(guess - (asIfUtc - guess))
}

export function isWithinTextingHours(date = new Date()) {
  const { hour } = zonedParts(date)
  return hour >= TEXTING_START_HOUR && hour < TEXTING_END_HOUR
}

/**
 * The next instant customer texting opens (08:00 PT today or tomorrow).
 * If called inside the window it returns the current time.
 */
export function nextTextingWindow(date = new Date()) {
  if (isWithinTextingHours(date)) return new Date(date)
  const p = zonedParts(date)
  const todayOpen = zonedTimeToUtc(p.year, p.month, p.day, TEXTING_START_HOUR)
  if (p.hour < TEXTING_START_HOUR) return todayOpen
  // After 21:00: tomorrow 08:00 (add a day via UTC noon to dodge DST edges)
  const noon = new Date(Date.UTC(p.year, p.month - 1, p.day, 12))
  noon.setUTCDate(noon.getUTCDate() + 1)
  const n = zonedParts(noon)
  return zonedTimeToUtc(n.year, n.month, n.day, TEXTING_START_HOUR)
}

export function outsideHoursResponse(nextWindow, extra = {}) {
  return Response.json(
    { error: 'outside_texting_hours', nextWindow: nextWindow || nextTextingWindow().toISOString(), ...extra },
    { status: 422 }
  )
}

/**
 * True when the number is on handld.sms_opt_outs. Throws if the table cannot
 * be read, so callers fail closed instead of texting blindly.
 */
export async function isOptedOut(phone) {
  const e164 = normalizeE164(phone)
  if (!e164) return false
  const { data, error } = await getDb()
    .from('sms_opt_outs')
    .select('phone')
    .eq('phone', e164)
    .maybeSingle()
  if (error) throw new Error(`Opt-out check failed: ${error.message}`)
  return !!data
}

/**
 * Upsert a number onto the shared opt-out list.
 * @param {string} phone
 * @param {string} source e.g. 'twilio_21610', 'admin'
 * @param {string|null} keyword the inbound keyword if there was one
 * @returns {Promise<string|null>} error message, or null
 */
export async function recordOptOut(phone, source, keyword = null) {
  const e164 = normalizeE164(phone)
  if (!e164) return 'Invalid phone number'
  const { error } = await getDb()
    .from('sms_opt_outs')
    .upsert({ phone: e164, source, keyword, created_at: new Date().toISOString() }, { onConflict: 'phone' })
  if (error) {
    console.error('Failed to record SMS opt-out:', error.message)
    return error.message
  }
  return null
}

let _twilio = null
function getTwilio() {
  if (!_twilio) _twilio = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  return _twilio
}

/**
 * Send one text through the compliance gate.
 *
 * @param {object} p
 * @param {string} p.to any phone format; normalised to E.164
 * @param {string} p.body message without the STOP footer (it is appended)
 * @param {'customer'|'technician'|'owner'} p.recipientType
 * @param {string} p.messageType logged to sms_log.message_type
 * @param {string} [p.jobId]
 * @param {boolean} [p.exemptFromQuietHours] customer-initiated texts only
 * @returns {Promise<{status: 'sent'|'failed'|'skipped_opt_out'|'outside_hours'|'invalid_phone', sid?: string, error?: string, code?: number, nextWindow?: string, body?: string, logError: string|null}>}
 */
export async function sendSms({ to, body, recipientType, messageType, jobId, exemptFromQuietHours = false }) {
  const phone = normalizeE164(to)
  const isOwner = recipientType === 'owner'
  const finalBody = isOwner ? String(body ?? '') : withStopFooter(body)

  const log = (status, extra = {}) => logSms({
    jobId,
    recipientPhone: phone || (to ? String(to) : 'unknown'),
    recipientType,
    messageType,
    messageBody: finalBody,
    status,
    ...extra
  })

  if (!phone) {
    const logError = await log('failed', { errorMessage: 'Invalid phone number' })
    return { status: 'invalid_phone', error: 'Invalid phone number', logError }
  }

  try {
    if (await isOptedOut(phone)) {
      const logError = await log('skipped_opt_out', { errorMessage: 'Recipient opted out' })
      return { status: 'skipped_opt_out', error: 'Recipient opted out of texts', logError }
    }
  } catch (err) {
    const logError = await log('failed', { errorMessage: err.message })
    return { status: 'failed', error: err.message, logError }
  }

  if (recipientType === 'customer' && !exemptFromQuietHours && !isWithinTextingHours()) {
    const nextWindow = nextTextingWindow().toISOString()
    const logError = await log('skipped_outside_hours', { errorMessage: `Outside texting hours; next window ${nextWindow}` })
    return { status: 'outside_hours', nextWindow, error: 'Outside texting hours (8am–9pm Pacific)', logError }
  }

  try {
    const result = await getTwilio().messages.create({
      body: finalBody,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    })
    const logError = await log('sent', { twilioSid: result.sid })
    return { status: 'sent', sid: result.sid, body: finalBody, logError }
  } catch (err) {
    const code = err?.code
    if (code === 21610) {
      const optOutError = await recordOptOut(phone, 'twilio_21610')
      if (optOutError) console.error('Could not record 21610 opt-out:', optOutError)
    }
    console.error(`SMS send failed (${messageType} → ${recipientType}):`, err?.message)
    const logError = await log('failed', { errorMessage: err?.message || String(err) })
    return { status: 'failed', error: err?.message || String(err), code, logError }
  }
}

/**
 * Owner alert: no footer, no hours check, to OWNER_ALERT_PHONE.
 */
export async function sendOwnerAlert({ body, messageType, jobId }) {
  return sendSms({ to: ownerAlertPhone(), body, recipientType: 'owner', messageType, jobId })
}
