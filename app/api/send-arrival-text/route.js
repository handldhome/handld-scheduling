import { getDb } from '@/lib/supabase'
import { authorizeJobAccess } from '@/lib/tech-auth'
import { unauthorized } from '@/lib/admin-auth'
import { sendSms, normalizeE164, outsideHoursResponse, CUSTOMER_QUESTIONS } from '@/lib/sms'

// Texts the customer that their tech has arrived. Admin, or the tech the job
// is assigned to. The phone number, customer name and service come from the
// database, never from the request, so this can't be used to text anyone else.
// Held to customer texting hours (422 outside_texting_hours).
export async function POST(request) {
  try {
    const body = await request.json()
    const jobId = body.jobId || body.job?.id

    const access = await authorizeJobAccess(request, jobId)
    if (!access.ok) return unauthorized()

    const db = getDb()
    const { data: row, error } = await db
      .from('jobs')
      .select('id, name, service, quote_request:quote_requests(customer:customers(phone))')
      .eq('id', jobId)
      .maybeSingle()
    if (error) throw error
    if (!row) {
      return Response.json({ error: 'Job not found' }, { status: 404 })
    }

    let techName = access.admin ? body.techName : null
    if (access.techId) {
      const { data: tech } = await db.from('technicians').select('first_name').eq('id', access.techId).maybeSingle()
      techName = tech?.first_name || null
    }

    const phoneNumber = normalizeE164(row.quote_request?.customer?.phone)

    if (!phoneNumber) {
      return Response.json({ error: 'Valid phone number is required' }, { status: 400 })
    }

    // Helper to safely get string from potentially array values
    const getString = (val) => {
      if (!val) return null
      if (Array.isArray(val)) return val[0]
      return String(val)
    }

    const customerName = getString(row.name)
    const firstName = customerName?.split(' ')[0] || 'there'
    const serviceName = getString(row.service) || 'service'
    const techFirstName = techName?.split(' ')[0] || 'Your technician'

    const message = `Hi ${firstName}! ${techFirstName} from Handld has arrived for your ${serviceName} appointment. ${CUSTOMER_QUESTIONS}`

    const result = await sendSms({
      to: phoneNumber,
      body: message,
      recipientType: 'customer',
      messageType: 'arrival',
      jobId: row.id
    })

    if (result.status === 'outside_hours') {
      return outsideHoursResponse(result.nextWindow, { logError: result.logError })
    }
    if (result.status === 'skipped_opt_out') {
      return Response.json({ error: 'Customer has opted out of texts', status: result.status, logError: result.logError }, { status: 409 })
    }
    if (result.status !== 'sent') {
      return Response.json({
        error: 'Failed to send arrival text',
        details: result.error,
        logError: result.logError
      }, { status: 500 })
    }

    return Response.json({
      success: true,
      messageId: result.sid,
      to: phoneNumber,
      logError: result.logError
    })

  } catch (error) {
    console.error('Error sending arrival SMS:', error)
    return Response.json({
      error: 'Failed to send arrival text',
      details: error.message
    }, { status: 500 })
  }
}
