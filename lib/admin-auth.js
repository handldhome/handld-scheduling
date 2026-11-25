// Admin auth, shared by middleware.js (Edge runtime) and the /api/admin/*
// routes (Node). Pure JS so it runs in both.
//
// The dashboard is opened with ?key=<ADMIN_SECRET_KEY>; its client code sends
// the same value to admin APIs as an x-admin-key header (components/TextsPanel.js).
//
// There is NO fallback key. This repo is public, so any hard-coded default is
// known to everyone. If ADMIN_SECRET_KEY is unset, every admin check fails.

// Constant-time string comparison (no early exit on the first differing byte).
export function safeEqual(a, b) {
  const enc = new TextEncoder()
  const x = enc.encode(String(a))
  const y = enc.encode(String(b))
  let diff = x.length ^ y.length
  const len = Math.max(x.length, y.length)
  for (let i = 0; i < len; i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  }
  return diff === 0
}

export function isAdminKey(provided) {
  const expected = process.env.ADMIN_SECRET_KEY
  if (!expected || !provided) return false
  return safeEqual(provided, expected)
}

// For API routes: key must be in the x-admin-key header (never the URL).
export function isAdminRequest(request) {
  return isAdminKey(request.headers.get('x-admin-key'))
}

export function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}

// For Vercel cron GETs: Vercel sends "Authorization: Bearer $CRON_SECRET"
// when CRON_SECRET is set in the project. Fails closed when it is unset.
export function isCronRequest(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return safeEqual(request.headers.get('authorization') || '', `Bearer ${secret}`)
}
