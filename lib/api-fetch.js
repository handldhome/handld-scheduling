// Browser-side fetch for this app's own /api routes.
//
// Admin pages are opened as ...?key=<ADMIN_SECRET_KEY>; that key is sent as
// the x-admin-key header (the same way components/TextsPanel.js does).
// Tech pages pass their techId, sent as x-tech-id so the API can limit them
// to their own jobs.
export function apiFetch(url, options = {}, { techId } = {}) {
  const headers = new Headers(options.headers || {})
  if (typeof window !== 'undefined') {
    const key = new URLSearchParams(window.location.search).get('key')
    if (key) headers.set('x-admin-key', key)
  }
  if (techId) headers.set('x-tech-id', techId)
  return fetch(url, { ...options, headers })
}
