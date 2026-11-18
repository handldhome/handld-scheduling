import { timingSafeEqual } from 'crypto'

// Admin API auth: the dashboard sends the ?key= value as an x-admin-key header
// (see components/TextsPanel.js and app/api/admin/sms-settings/route.js).
//
// Unlike the middleware, this has NO fallback key. The repo is public, so the
// fallback is known to anyone; routes that serve sensitive files fail closed
// when ADMIN_SECRET_KEY is not set.
export function isAdminRequest(request) {
  const expected = process.env.ADMIN_SECRET_KEY
  if (!expected) return false

  const provided = request.headers.get('x-admin-key') || ''
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
