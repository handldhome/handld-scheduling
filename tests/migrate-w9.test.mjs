import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// In-memory public + private blob stores, keyed by token
const stores = vi.hoisted(() => ({ 'public-token': new Map(), 'private-token': new Map() }))
const PUBLIC_HOST = 'https://store1.public.blob.vercel-storage.com/'
const toPath = p => (p.startsWith('https://') ? decodeURIComponent(new URL(p).pathname.slice(1)) : p)

vi.mock('@vercel/blob', () => ({
  async list({ prefix, token }) {
    const blobs = [...stores[token].entries()]
      .filter(([p]) => p.startsWith(prefix))
      .map(([pathname, b]) => ({ pathname, url: PUBLIC_HOST + encodeURI(pathname), size: b.bytes.length }))
    return { blobs, hasMore: false }
  },
  async get(p, { token }) {
    const b = stores[token].get(toPath(p))
    if (!b) return null
    return { statusCode: 200, stream: new Blob([b.bytes]).stream(), blob: { contentType: b.contentType } }
  },
  async put(pathname, bytes, { token, access, contentType, allowOverwrite }) {
    if (token === 'private-token' && access !== 'private') throw new Error('wrong access')
    if (!allowOverwrite && stores[token].has(pathname)) throw new Error('exists')
    stores[token].set(pathname, { bytes: Buffer.from(bytes), contentType })
    return { pathname }
  },
  async del(p, { token }) {
    stores[token].delete(toPath(p))
  }
}))

const rows = vi.hoisted(() => [])
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from() {
      const filters = []
      let patch = null
      let likeFilter = null
      const b = {
        select() { return b },
        like(_col, pattern) { likeFilter = pattern.replaceAll('%', ''); return b },
        order() { return b },
        async range() {
          return { data: rows.filter(r => r.notes?.includes(likeFilter)).map(r => ({ ...r })), error: null }
        },
        update(p) { patch = p; return b },
        eq(col, val) { filters.push([col, val]); return b },
        then(resolve) {
          const hit = rows.filter(r => filters.every(([c, v]) => r[c] === v))
          hit.forEach(r => Object.assign(r, patch))
          return Promise.resolve({ data: hit.map(r => ({ id: r.id })), error: null }).then(resolve)
        }
      }
      return b
    }
  })
}))

const { run } = await import('../scripts/migrate-w9-to-private.mjs')

let out
beforeEach(() => {
  Object.assign(process.env, {
    BLOB_READ_WRITE_TOKEN: 'public-token',
    PRIVATE_BLOB_READ_WRITE_TOKEN: 'private-token',
    HANDLD_SUPABASE_URL: 'http://db',
    HANDLD_SUPABASE_SERVICE_ROLE_KEY: 'k'
  })
  stores['public-token'].clear()
  stores['private-token'].clear()
  rows.length = 0

  const put = (p, s) => stores['public-token'].set(p, { bytes: Buffer.from(s), contentType: 'application/pdf' })
  put('w9/aaa-1-Jane Doe.pdf', '%PDF jane 123-45-6789')
  put('w9/bbb-2-W9-form.pdf', '%PDF bob')
  put('w9/orphan-3.pdf', '%PDF orphan')
  put('jobs/1/before/x.jpg', 'photo')
  rows.push(
    { id: 'aaa', notes: `Note\nW9: ${PUBLIC_HOST}w9/aaa-1-Jane%20Doe.pdf` },
    { id: 'bbb', notes: `W9: ${PUBLIC_HOST}w9/bbb-2-W9-form.pdf` },
    { id: 'ccc', notes: 'W9: w9/ccc/already.pdf' }
  )

  out = []
  for (const level of ['log', 'error', 'warn', 'info']) {
    vi.spyOn(console, level).mockImplementation((...a) => out.push(a.join(' ')))
  }
})
afterEach(() => vi.restoreAllMocks())

const noLeaks = () => expect(out.join('\n')).not.toMatch(/https?:|w9\/\w|Jane|123-45|%PDF/)

describe('migrate-w9-to-private', () => {
  it('dry run changes nothing and prints counts only', async () => {
    expect(await run([])).toBe(0)
    expect(stores['private-token'].size).toBe(0)
    expect(rows[0].notes).toContain(PUBLIC_HOST)
    expect(out.join('\n')).toMatch(/still pointing at a public URL:\s+2/)
    expect(out.join('\n')).toMatch(/not referenced \(orphans\):\s+1/)
    noLeaks()
  })

  it('--apply copies, verifies and repoints rows but keeps public originals', async () => {
    expect(await run(['--apply'])).toBe(0)
    expect(stores['private-token'].size).toBe(3)
    expect(stores['private-token'].get('w9/aaa-1-Jane Doe.pdf').bytes.toString()).toBe('%PDF jane 123-45-6789')
    expect(rows[0].notes).toBe('Note\nW9: w9/aaa-1-Jane Doe.pdf')
    expect(rows[1].notes).toBe('W9: w9/bbb-2-W9-form.pdf')
    expect(rows[2].notes).toBe('W9: w9/ccc/already.pdf')
    expect(stores['public-token'].size).toBe(4)
    noLeaks()

    // re-runnable
    expect(await run(['--apply'])).toBe(0)
  })

  it('--delete-public only deletes verified, unreferenced originals', async () => {
    // Before apply: everything is either referenced or has no private copy
    expect(await run(['--delete-public'])).toBe(0)
    expect(stores['public-token'].size).toBe(4)

    await run(['--apply'])
    // Corrupt one private copy: its public original must survive
    stores['private-token'].get('w9/bbb-2-W9-form.pdf').bytes = Buffer.from('tampered')
    expect(await run(['--delete-public'])).toBe(0)
    expect([...stores['public-token'].keys()].sort()).toEqual(['jobs/1/before/x.jpg', 'w9/bbb-2-W9-form.pdf'])
    noLeaks()
  })

  it('a private copy that differs is a failure and the row is not repointed', async () => {
    stores['private-token'].set('w9/aaa-1-Jane Doe.pdf', { bytes: Buffer.from('other'), contentType: 'application/pdf' })
    expect(await run(['--apply'])).toBe(1)
    expect(rows[0].notes).toContain(PUBLIC_HOST)
    noLeaks()
  })

  it('refuses when both tokens point at the same store', async () => {
    process.env.PRIVATE_BLOB_READ_WRITE_TOKEN = 'public-token'
    await expect(run([])).rejects.toThrow(/same store/)
  })
})
