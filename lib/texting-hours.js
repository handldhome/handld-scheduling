// Browser-safe helpers for the texting-hours (422 outside_texting_hours) and
// consent-skip responses the send routes return. No server imports.

export const TEXTING_HOURS_LABEL = 'Texting hours are 8am–9pm Pacific.'

export function isOutsideHoursResponse(status, data) {
  return status === 422 && data?.error === 'outside_texting_hours'
}

export function formatNextWindow(iso) {
  if (!iso) return 'tomorrow morning'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'tomorrow morning'
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles'
  }) + ' PT'
}

// "Texting hours are 8am–9pm Pacific. Try again after Wed, Nov 26, 8:00 AM PT."
export function textingHoursMessage(nextWindowIso) {
  return `${TEXTING_HOURS_LABEL} Try again after ${formatNextWindow(nextWindowIso)}.`
}

// "Not texted (no SMS consent on file): Ana Lopez, Bo Chen. Send them a consent request from the Texts tab."
export function noConsentMessage(skipped) {
  if (!Array.isArray(skipped) || skipped.length === 0) return ''
  const names = skipped.map(t => t.name || t.id).join(', ')
  return `Not texted (no SMS consent on file): ${names}. Send them a consent request from the Texts tab.`
}

export function optOutMessage(skipped) {
  if (!Array.isArray(skipped) || skipped.length === 0) return ''
  const names = skipped.map(t => t.name || t.phone || t.id).join(', ')
  return `Not texted (opted out of texts): ${names}.`
}
