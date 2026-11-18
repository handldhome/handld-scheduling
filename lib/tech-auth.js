import { getDb } from '@/lib/supabase'
import { isAdminRequest } from '@/lib/admin-auth'

// Tech-facing pages (/tech/<techId>/schedule) have no login: the technician's
// ID in their link is the only credential. Requests from those pages send it
// as an x-tech-id header, and a tech may only touch jobs assigned to them.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const AIRTABLE_RE = /^rec[A-Za-z0-9]+$/

// Returns the UUID of the active technician named by x-tech-id, or null.
export async function resolveRequestTech(request) {
  const raw = request.headers.get('x-tech-id')
  if (!raw) return null
  const isUUID = UUID_RE.test(raw)
  if (!isUUID && !AIRTABLE_RE.test(raw)) return null

  const { data, error } = await getDb()
    .from('technicians')
    .select('id, active')
    .eq(isUUID ? 'id' : 'airtable_id', raw)
    .maybeSingle()
  if (error || !data || !data.active) return null
  return data.id
}

// Admin, or the active tech the job is assigned to.
// Returns { ok, admin, techId }.
export async function authorizeJobAccess(request, jobId) {
  if (isAdminRequest(request)) return { ok: true, admin: true, techId: null }
  if (!jobId || !UUID_RE.test(String(jobId))) return { ok: false }

  const techId = await resolveRequestTech(request)
  if (!techId) return { ok: false }

  const { data: job, error } = await getDb()
    .from('jobs')
    .select('id, technician_id')
    .eq('id', jobId)
    .maybeSingle()
  if (error || !job || job.technician_id !== techId) return { ok: false }
  return { ok: true, admin: false, techId }
}
