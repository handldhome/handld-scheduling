import { get } from '@vercel/blob'
import { getDb } from '@/lib/supabase'
import { isAdminRequest, unauthorized } from '@/lib/admin-auth'
import { W9_CONTENT_TYPES, getPrivateBlobToken, parseW9Note } from '@/lib/w9.mjs'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Admin-only: streams a technician's W-9 from private storage.
// Send the dashboard key as an x-admin-key header, e.g.
//   curl -H "x-admin-key: $ADMIN_SECRET_KEY" \
//     https://schedule.handldhome.com/api/admin/technicians/<techId>/w9 -o w9.pdf
export async function GET(request, { params }) {
  if (!isAdminRequest(request)) return unauthorized()

  const token = getPrivateBlobToken()
  if (!token) {
    return Response.json({ error: 'W9 storage is not configured' }, { status: 503 })
  }

  try {
    const { techId } = params
    const db = getDb()
    const { data: tech, error } = await db
      .from('technicians')
      .select('id, notes')
      .eq(UUID_RE.test(techId) ? 'id' : 'airtable_id', techId)
      .maybeSingle()

    if (error) throw error

    const w9 = parseW9Note(tech?.notes)
    if (!w9) {
      return Response.json({ error: 'No W9 on file' }, { status: 404 })
    }
    if (w9.legacyPublicUrl) {
      return Response.json(
        { error: 'This W9 has not been moved to private storage yet. Run scripts/migrate-w9-to-private.mjs.' },
        { status: 409 }
      )
    }

    const result = await get(w9.pathname, { access: 'private', token, useCache: false })
    if (!result || result.statusCode !== 200) {
      return Response.json({ error: 'No W9 on file' }, { status: 404 })
    }

    const contentType = result.blob.contentType
    const ext = W9_CONTENT_TYPES[contentType]
    return new Response(result.stream, {
      status: 200,
      headers: {
        'Content-Type': ext ? contentType : 'application/octet-stream',
        'Content-Disposition': `${ext ? 'inline' : 'attachment'}; filename="W9-${tech.id}.${ext || 'bin'}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        'Referrer-Policy': 'no-referrer'
      }
    })
  } catch (error) {
    console.error('W9 fetch failed:', error?.code || error?.name || 'Error')
    return Response.json({ error: 'Failed to fetch W9' }, { status: 500 })
  }
}
