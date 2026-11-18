import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeDb } from './fake-db.mjs'

const TECH_ID = '11111111-2222-3333-4444-555555555555'
const PATHNAME = `w9/${TECH_ID}/1700000000000-0b0e6d1c-1111-4444-8888-123456789abc.pdf`

const blob = vi.hoisted(() => ({ put: vi.fn(), del: vi.fn(), get: vi.fn() }))
vi.mock('@vercel/blob', () => blob)

let fake
vi.mock('@/lib/supabase', () => ({ getDb: () => fake.db }))

const { GET } = await import('../app/api/admin/technicians/[techId]/w9/route.js')

function request(headers = {}) {
  return new Request(`http://localhost/api/admin/technicians/${TECH_ID}/w9`, { headers })
}
const ctx = { params: { techId: TECH_ID } }

beforeEach(() => {
  process.env.ADMIN_SECRET_KEY = 'real-admin-key'
  process.env.PRIVATE_BLOB_READ_WRITE_TOKEN = 'private-token'
  fake = createFakeDb([{ id: TECH_ID, airtable_id: null, notes: `W9: ${PATHNAME}` }])
  blob.get.mockReset().mockResolvedValue({
    statusCode: 200,
    stream: new Blob(['%PDF-1.7']).stream(),
    headers: new Headers(),
    blob: { contentType: 'application/pdf', size: 8 }
  })
})

describe('GET /api/admin/technicians/[techId]/w9', () => {
  it('401s with no admin key', async () => {
    const res = await GET(request(), ctx)
    expect(res.status).toBe(401)
    expect(blob.get).not.toHaveBeenCalled()
  })

  it('401s with a wrong admin key', async () => {
    const res = await GET(request({ 'x-admin-key': 'nope' }), ctx)
    expect(res.status).toBe(401)
    expect(blob.get).not.toHaveBeenCalled()
  })

  it('401s with the old hard-coded fallback key when ADMIN_SECRET_KEY is unset', async () => {
    delete process.env.ADMIN_SECRET_KEY
    const res = await GET(request({ 'x-admin-key': 'handld-admin-2024' }), ctx)
    expect(res.status).toBe(401)
    expect(blob.get).not.toHaveBeenCalled()
  })

  it('does not accept the key as a query parameter', async () => {
    const res = await GET(
      new Request(`http://localhost/api/admin/technicians/${TECH_ID}/w9?key=real-admin-key`),
      ctx
    )
    expect(res.status).toBe(401)
  })

  it('streams the private file to an admin without caching', async () => {
    const res = await GET(request({ 'x-admin-key': 'real-admin-key' }), ctx)
    expect(res.status).toBe(200)
    expect(blob.get).toHaveBeenCalledWith(PATHNAME, expect.objectContaining({ access: 'private', token: 'private-token' }))
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(await res.text()).toBe('%PDF-1.7')
  })

  it('refuses to hand out a legacy public URL', async () => {
    fake = createFakeDb([
      { id: TECH_ID, airtable_id: null, notes: 'W9: https://abc.public.blob.vercel-storage.com/w9/x.pdf' }
    ])
    const res = await GET(request({ 'x-admin-key': 'real-admin-key' }), ctx)
    expect(res.status).toBe(409)
    expect(await res.text()).not.toMatch(/blob\.vercel-storage/)
  })

  it('404s when there is no W-9', async () => {
    fake = createFakeDb([{ id: TECH_ID, airtable_id: null, notes: null }])
    const res = await GET(request({ 'x-admin-key': 'real-admin-key' }), ctx)
    expect(res.status).toBe(404)
  })
})
