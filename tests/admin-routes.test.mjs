import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeDb } from './fake-db.mjs'

// Every data function is a spy that fails loudly if a route touches data
// before checking auth.
vi.mock('@/lib/db', async importOriginal => {
  const mod = await importOriginal()
  return Object.fromEntries(Object.keys(mod).map(k => [k, vi.fn(async () => { throw new Error(`db.${k} touched`) })]))
})
vi.mock('@/lib/scheduling-agent', async importOriginal => {
  const mod = await importOriginal()
  return Object.fromEntries(Object.keys(mod).map(k => [k, vi.fn(async () => { throw new Error(`${k} touched`) })]))
})
let fake
vi.mock('@/lib/supabase', () => ({ getDb: () => fake.db }))
const sms = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('twilio', () => ({ default: () => ({ messages: sms }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@vercel/blob', () => ({ put: vi.fn(), get: vi.fn(), del: vi.fn() }))

const db = await import('@/lib/db')

const JOB_ID = 'aaaaaaaa-0000-4000-8000-000000000001'
const TECH_ID = 'bbbbbbbb-0000-4000-8000-000000000001'

const photoForm = () => {
  const f = new FormData()
  f.append('jobId', JOB_ID)
  f.append('type', 'before')
  f.append('photos', new File(['x'], 'p.jpg', { type: 'image/jpeg' }))
  return f
}

// [label, module, method, ctx params, body]
const ADMIN_ONLY = [
  ['GET /api/admin/availability', '../app/api/admin/availability/route.js', 'GET'],
  ['GET /api/admin/sms-settings', '../app/api/admin/sms-settings/route.js', 'GET'],
  ['PUT /api/admin/sms-settings', '../app/api/admin/sms-settings/route.js', 'PUT', null, { availabilityTextsEnabled: false }],
  ['GET /api/admin/technicians/[techId]/w9', '../app/api/admin/technicians/[techId]/w9/route.js', 'GET', { techId: TECH_ID }],
  ['GET /api/jobs', '../app/api/jobs/route.js', 'GET'],
  ['POST /api/jobs', '../app/api/jobs/route.js', 'POST', null, { serviceName: 'x', customerName: 'y' }],
  ['PATCH /api/jobs/[id]', '../app/api/jobs/[id]/route.js', 'PATCH', { id: JOB_ID }, { status: 'Done' }],
  ['GET /api/jobs/[id]/sms-log', '../app/api/jobs/[id]/sms-log/route.js', 'GET', { id: JOB_ID }],
  ['POST /api/jobs/continue', '../app/api/jobs/continue/route.js', 'POST', null, { jobId: JOB_ID }],
  ['POST /api/jobs/photos', '../app/api/jobs/photos/route.js', 'POST', null, 'photos'],
  ['POST /api/quote-requests', '../app/api/quote-requests/route.js', 'POST', null, { customerName: 'x' }],
  ['GET /api/scheduling-agent', '../app/api/scheduling-agent/route.js', 'GET'],
  ['POST /api/scheduling-agent', '../app/api/scheduling-agent/route.js', 'POST', null, {}],
  ['POST /api/send-arrival-text', '../app/api/send-arrival-text/route.js', 'POST', null, { jobId: JOB_ID }],
  ['POST /api/send-confirmation', '../app/api/send-confirmation/route.js', 'POST', null, { job: { phone: '6265550100' } }],
  ['POST /api/send-reschedule-notification', '../app/api/send-reschedule-notification/route.js', 'POST', null, {}],
  ['POST /api/send-tech-job-notification', '../app/api/send-tech-job-notification/route.js', 'POST', null, {}],
  ['POST /api/send-tech-text', '../app/api/send-tech-text/route.js', 'POST', null, { techIds: [TECH_ID], message: 'hi' }],
  ['POST /api/send-consent-request', '../app/api/send-consent-request/route.js', 'POST', null, { techId: TECH_ID }],
  ['POST /api/send-availability-reminder', '../app/api/send-availability-reminder/route.js', 'POST', null, {}],
  ['POST /api/send-schedule-reminder', '../app/api/send-schedule-reminder/route.js', 'POST', null, {}],
  ['PATCH /api/technicians/[techId]', '../app/api/technicians/[techId]/route.js', 'PATCH', { techId: TECH_ID }, { allowTexting: false }],
  ['PATCH /api/technicians/[techId] (consent)', '../app/api/technicians/[techId]/route.js', 'PATCH', { techId: TECH_ID }, { smsConsent: true, consentSource: 'verbal' }]
]

const CRON = [
  ['GET /api/send-availability-reminder', '../app/api/send-availability-reminder/route.js'],
  ['GET /api/send-schedule-reminder', '../app/api/send-schedule-reminder/route.js'],
  ['GET /api/cron/check-tech-confirmations', '../app/api/cron/check-tech-confirmations/route.js']
]

function req(method, body, headers = {}) {
  const init = { method, headers: { ...headers } }
  if (body === 'photos') init.body = photoForm()
  else if (body !== undefined && body !== null) {
    init.body = JSON.stringify(body)
    init.headers['content-type'] = 'application/json'
  }
  return new Request('http://localhost/api/x', init)
}

function expectNothingTouched() {
  for (const fn of Object.values(db)) expect(fn).not.toHaveBeenCalled()
  expect(fake.calls.reads).toEqual([])
  expect(sms.create).not.toHaveBeenCalled()
}

beforeEach(() => {
  process.env.ADMIN_SECRET_KEY = 'real-admin-key'
  process.env.CRON_SECRET = 'cron-secret'
  fake = createFakeDb({ technicians: [], jobs: [] })
  for (const fn of Object.values(db)) fn.mockClear()
  sms.create.mockReset()
})

describe.each(ADMIN_ONLY)('%s', (_label, mod, method, params, body) => {
  const call = async headers => (await import(mod))[method](req(method, body, headers), { params: params || {} })

  it('401 with no credentials, before touching data', async () => {
    const res = await call()
    expect(res.status).toBe(401)
    expectNothingTouched()
  })

  it('401 with a wrong key', async () => {
    expect((await call({ 'x-admin-key': 'real-admin-ke' })).status).toBe(401)
    expectNothingTouched()
  })

  it('fails closed when ADMIN_SECRET_KEY is unset (old fallback key refused)', async () => {
    delete process.env.ADMIN_SECRET_KEY
    expect((await call({ 'x-admin-key': 'handld-admin-2024' })).status).toBe(401)
    expect((await call({ 'x-admin-key': '' })).status).toBe(401)
    expectNothingTouched()
  })
})

describe.each(CRON)('%s (cron)', (_label, mod) => {
  const call = async headers => (await import(mod)).GET(new Request('http://localhost/api/x', { headers }))

  it('401 without the cron bearer token', async () => {
    expect((await call({})).status).toBe(401)
    expect((await call({ authorization: 'Bearer nope' })).status).toBe(401)
    expect((await call({ 'x-admin-key': 'real-admin-key' })).status).toBe(401)
    expectNothingTouched()
  })

  it('fails closed when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET
    expect((await call({ authorization: 'Bearer undefined' })).status).toBe(401)
    expect((await call({ authorization: 'Bearer ' })).status).toBe(401)
    expectNothingTouched()
  })
})

describe('with the right admin key', () => {
  it('GET /api/admin/availability returns data', async () => {
    db.getAllTechnicians.mockResolvedValueOnce([])
    db.getAllAvailability.mockResolvedValueOnce([])
    const { GET } = await import('../app/api/admin/availability/route.js')
    const res = await GET(req('GET', null, { 'x-admin-key': 'real-admin-key' }))
    expect(res.status).toBe(200)
  })
})
