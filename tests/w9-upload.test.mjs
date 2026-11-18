import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createFakeDb } from './fake-db.mjs'

const PUBLIC_LOOKING_URL = 'https://abc.public.blob.vercel-storage.com/w9/leak.pdf'
const TECH_ID = '11111111-2222-3333-4444-555555555555'

const blob = vi.hoisted(() => ({ put: vi.fn(), del: vi.fn(), get: vi.fn() }))
vi.mock('@vercel/blob', () => blob)

let fake
vi.mock('@/lib/supabase', () => ({ getDb: () => fake.db }))

const { POST } = await import('../app/api/technicians/w9-upload/route.js')

function pdfFile() {
  return new File([new TextEncoder().encode('%PDF-1.7 SSN 123-45-6789')], 'Jane Doe W9.pdf', {
    type: 'application/pdf'
  })
}

function uploadRequest(file = pdfFile(), techId = TECH_ID) {
  const form = new FormData()
  form.append('techId', techId)
  form.append('w9', file)
  return new Request('http://localhost/api/technicians/w9-upload', { method: 'POST', body: form })
}

let logged
beforeEach(() => {
  process.env.PRIVATE_BLOB_READ_WRITE_TOKEN = 'private-token'
  fake = createFakeDb([{ id: TECH_ID, airtable_id: null, active: false, notes: 'Has a truck' }])
  blob.put.mockReset().mockImplementation(async pathname => ({
    url: PUBLIC_LOOKING_URL,
    downloadUrl: PUBLIC_LOOKING_URL,
    pathname
  }))
  blob.del.mockReset().mockResolvedValue(undefined)
  logged = []
  for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
    vi.spyOn(console, level).mockImplementation((...args) => logged.push(args.map(String).join(' ')))
  }
})
afterEach(() => vi.restoreAllMocks())

describe('POST /api/technicians/w9-upload', () => {
  it('stores the W-9 privately and keeps only the pathname in the DB', async () => {
    const res = await POST(uploadRequest())
    expect(res.status).toBe(200)

    expect(blob.put).toHaveBeenCalledTimes(1)
    const [pathname, , options] = blob.put.mock.calls[0]
    expect(options.access).toBe('private')
    expect(options.token).toBe('private-token')
    expect(pathname).toMatch(new RegExp(`^w9/${TECH_ID}/\\d+-[0-9a-f-]{36}\\.pdf$`))
    expect(pathname).not.toMatch(/Jane|Doe/)

    const notes = fake.calls.updates[0].fields.notes
    expect(notes).toBe(`Has a truck\nW9: ${pathname}`)
    expect(notes).not.toMatch(/https?:/)
  })

  it('does not return or log a URL, the file name or file contents', async () => {
    const res = await POST(uploadRequest())
    const body = await res.json()
    const text = JSON.stringify(body)
    expect(body.url).toBeUndefined()
    expect(text).not.toMatch(/https?:|blob\.vercel-storage|w9\//)

    const allLogs = logged.join('\n')
    expect(allLogs).not.toMatch(/https?:|blob\.vercel-storage|w9\/|Jane|123-45-6789/)
  })

  it('does not leak the URL or path when the DB update fails', async () => {
    const original = fake.db.from
    fake.db.from = table => {
      const b = original(table)
      const update = b.update
      b.update = fields => {
        update(fields)
        b.then = resolve =>
          Promise.resolve({ error: { code: 'PGRST', message: `failed for ${PUBLIC_LOOKING_URL}` } }).then(resolve)
        return b
      }
      return b
    }
    const res = await POST(uploadRequest())
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toMatch(/https?:|w9\//)
    expect(logged.join('\n')).not.toMatch(/https?:|w9\//)
    expect(blob.del).toHaveBeenCalledTimes(1)
  })

  it('refuses to store anything when private storage is not configured', async () => {
    delete process.env.PRIVATE_BLOB_READ_WRITE_TOKEN
    process.env.BLOB_READ_WRITE_TOKEN = 'public-token'
    process.env.W9_CONTACT_EMAIL = 'office@example.com'
    const res = await POST(uploadRequest())
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.w9Unavailable).toBe(true)
    expect(body.error).toMatch(/temporarily unavailable.*email your W-9 to office@example\.com/)
    expect(blob.put).not.toHaveBeenCalled()
    expect(fake.calls.updates).toEqual([])
    delete process.env.W9_CONTACT_EMAIL
    delete process.env.BLOB_READ_WRITE_TOKEN
  })

  it('rejects files that are not PDF, JPEG or PNG', async () => {
    const res = await POST(uploadRequest(new File(['<html>'], 'w9.pdf', { type: 'application/pdf' })))
    expect(res.status).toBe(400)
    expect(blob.put).not.toHaveBeenCalled()
  })

  it('will not replace the W-9 of an active technician', async () => {
    fake = createFakeDb([{ id: TECH_ID, airtable_id: null, active: true, notes: null }])
    const res = await POST(uploadRequest())
    expect(res.status).toBe(403)
    expect(blob.put).not.toHaveBeenCalled()
  })

  it('404s for an unknown technician', async () => {
    const res = await POST(uploadRequest(pdfFile(), '99999999-2222-3333-4444-555555555555'))
    expect(res.status).toBe(404)
    expect(blob.put).not.toHaveBeenCalled()
  })
})
