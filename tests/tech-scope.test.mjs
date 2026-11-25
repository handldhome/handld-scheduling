import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createFakeDb } from './fake-db.mjs'

// Tech schedule pages have no login; their requests carry x-tech-id and may
// only reach that tech's own jobs.

const MINE = 'aaaaaaaa-0000-4000-8000-000000000001'
const THEIRS = 'aaaaaaaa-0000-4000-8000-000000000002'
const TECH = 'bbbbbbbb-0000-4000-8000-000000000001'
const OTHER_TECH = 'bbbbbbbb-0000-4000-8000-000000000002'
const INACTIVE = 'bbbbbbbb-0000-4000-8000-000000000003'

const db = vi.hoisted(() => ({ getAllJobs: vi.fn(), updateJob: vi.fn(), logSms: vi.fn() }))
vi.mock('@/lib/db', () => db)
let fake
vi.mock('@/lib/supabase', () => ({ getDb: () => fake.db }))
const sms = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('twilio', () => ({ default: () => ({ messages: sms }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const jobsRoute = await import('../app/api/jobs/route.js')
const jobRoute = await import('../app/api/jobs/[id]/route.js')
const arrival = await import('../app/api/send-arrival-text/route.js')

const req = (method, headers, body) =>
  new Request('http://localhost/api/x', {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  })

beforeEach(() => {
  process.env.ADMIN_SECRET_KEY = 'real-admin-key'
  // Arrival texts are held outside 8am–9pm Pacific; pin the clock to 10:00 PST.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-25T18:00:00Z'))
  fake = createFakeDb({
    sms_opt_outs: [],
    technicians: [
      { id: TECH, airtable_id: 'recTECH00000000001', active: true, first_name: 'Sam' },
      { id: OTHER_TECH, airtable_id: null, active: true, first_name: 'Ana' },
      { id: INACTIVE, airtable_id: null, active: false, first_name: 'Old' }
    ],
    jobs: [
      { id: MINE, technician_id: TECH, name: 'Pat Customer', service: 'Window Washing', quote_request: { customer: { phone: '6265550100' } } },
      { id: THEIRS, technician_id: OTHER_TECH, name: 'Lee Customer', service: 'Gutters', quote_request: { customer: { phone: '6265550199' } } }
    ]
  })
  db.getAllJobs.mockReset().mockResolvedValue([
    { id: MINE, assignedTech: [TECH] },
    { id: THEIRS, assignedTech: [OTHER_TECH] }
  ])
  db.updateJob.mockReset().mockResolvedValue({ id: MINE })
  db.logSms.mockReset().mockResolvedValue(undefined)
  sms.create.mockReset().mockResolvedValue({ sid: 'SM1' })
})
afterEach(() => vi.useRealTimers())

describe('GET /api/jobs', () => {
  it('a tech sees only their own jobs', async () => {
    const res = await jobsRoute.GET(req('GET', { 'x-tech-id': TECH }))
    expect((await res.json()).jobs.map(j => j.id)).toEqual([MINE])
  })
  it('works with a legacy airtable tech ID', async () => {
    const res = await jobsRoute.GET(req('GET', { 'x-tech-id': 'recTECH00000000001' }))
    expect((await res.json()).jobs.map(j => j.id)).toEqual([MINE])
  })
  it('inactive or unknown techs get 401', async () => {
    expect((await jobsRoute.GET(req('GET', { 'x-tech-id': INACTIVE }))).status).toBe(401)
    expect((await jobsRoute.GET(req('GET', { 'x-tech-id': 'bbbbbbbb-0000-4000-8000-00000000dead' }))).status).toBe(401)
  })
  it('admin sees everything', async () => {
    const res = await jobsRoute.GET(req('GET', { 'x-admin-key': 'real-admin-key' }))
    expect((await res.json()).jobs).toHaveLength(2)
  })
})

describe('PATCH /api/jobs/[id]', () => {
  it("a tech can update their own job", async () => {
    const res = await jobRoute.PATCH(req('PATCH', { 'x-tech-id': TECH }, { status: 'In Progress' }), { params: { id: MINE } })
    expect(res.status).toBe(200)
  })
  it("a tech cannot update someone else's job", async () => {
    const res = await jobRoute.PATCH(req('PATCH', { 'x-tech-id': TECH }, { status: 'Done' }), { params: { id: THEIRS } })
    expect(res.status).toBe(401)
    expect(db.updateJob).not.toHaveBeenCalled()
  })
  it('a tech cannot reassign a job', async () => {
    const res = await jobRoute.PATCH(req('PATCH', { 'x-tech-id': TECH }, { assignedTech: OTHER_TECH }), { params: { id: MINE } })
    expect(res.status).toBe(403)
    expect(db.updateJob).not.toHaveBeenCalled()
  })
})

describe('POST /api/send-arrival-text', () => {
  it("texts the job's customer, from DB data, not the request", async () => {
    const res = await arrival.POST(
      req('POST', { 'x-tech-id': TECH }, { jobId: MINE, techName: 'Evil', job: { id: MINE, phone: '2125550000', customerName: 'Spam' } })
    )
    expect(res.status).toBe(200)
    const { to, body } = sms.create.mock.calls[0][0]
    expect(to).toBe('+16265550100')
    expect(body).toContain('Hi Pat!')
    expect(body).toContain('Sam from Handld')
    expect(body).not.toMatch(/Evil|Spam/)
    expect(body).toContain('Call (626) 298-7128 or reply to this text.')
    expect(body.endsWith(' Reply STOP to opt out.')).toBe(true)
    expect(body).not.toContain('Text us at')
  })
  it('is held outside texting hours (422) and nothing is sent', async () => {
    vi.setSystemTime(new Date('2026-11-26T05:30:00Z')) // 21:30 PST
    const res = await arrival.POST(req('POST', { 'x-tech-id': TECH }, { jobId: MINE }))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: 'outside_texting_hours', nextWindow: '2026-11-26T16:00:00.000Z' })
    expect(sms.create).not.toHaveBeenCalled()
  })
  it("refuses another tech's job", async () => {
    const res = await arrival.POST(req('POST', { 'x-tech-id': TECH }, { jobId: THEIRS }))
    expect(res.status).toBe(401)
    expect(sms.create).not.toHaveBeenCalled()
  })
})
