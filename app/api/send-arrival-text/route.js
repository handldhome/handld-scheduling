import twilio from 'twilio'
import { logSms } from '@/lib/db'
import { getDb } from '@/lib/supabase'
import { authorizeJobAccess } from '@/lib/tech-auth'
import { unauthorized } from '@/lib/admin-auth'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

const formatPhoneNumber = (phone) => {
  if (!phone) return null

  // Handle if phone is an array (from legacy linked records)
  let phoneStr = phone
  if (Array.isArray(phone)) {
    phoneStr = phone[0]
  }

  // Ensure it's a string
  if (typeof phoneStr !== 'string') {
    phoneStr = String(phoneStr)
  }

  // Remove all non-numeric characters
  const cleaned = phoneStr.replace(/\D/g, '')

  // Add +1 if it's a 10-digit US number
  if (cleaned.length === 10) {
    return `+1${cleaned}`
  }

  // Add + if it's 11 digits starting with 1
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`
  }

  // Return as-is if already formatted
  if (phoneStr.startsWith('+')) {
    return phoneStr
  }

  return null
}

// Texts the customer that their tech has arrived. Admin, or the tech the job
// is assigned to. The phone number, customer name and service come from the
// database, never from the request, so this can't be used to text anyone else.
export async function POST(request) {
  let job = null
  let phoneNumber = null
  let message = ''
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
    job = { id: row.id, customerName: row.name, serviceName: row.service }

    let techName = access.admin ? body.techName : null
    if (access.techId) {
      const { data: tech } = await db.from('technicians').select('first_name').eq('id', access.techId).maybeSingle()
      techName = tech?.first_name || null
    }

    phoneNumber = formatPhoneNumber(row.quote_request?.customer?.phone)

    if (!phoneNumber) {
      return Response.json({ error: 'Valid phone number is required' }, { status: 400 })
    }

    // Helper to safely get string from potentially array values
    const getString = (val) => {
      if (!val) return null
      if (Array.isArray(val)) return val[0]
      return String(val)
    }

    const customerName = getString(job.customerName)
    const firstName = customerName?.split(' ')[0] || 'there'
    const serviceName = getString(job.serviceName) || 'service'
    const techFirstName = techName?.split(' ')[0] || 'Your technician'

    message = `Hi ${firstName}! ${techFirstName} from Handld has arrived for your ${serviceName} appointment. Questions? Text us at (626) 298-7128`

    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    })

    await logSms({
      jobId: job.id,
      recipientPhone: phoneNumber,
      recipientType: 'customer',
      messageType: 'arrival',
      messageBody: message,
      twilioSid: result.sid,
      status: 'sent'
    })

    return Response.json({
      success: true,
      messageId: result.sid,
      to: phoneNumber
    })

  } catch (error) {
    console.error('Error sending arrival SMS:', error)
    await logSms({
      jobId: job?.id,
      recipientPhone: phoneNumber || 'unknown',
      recipientType: 'customer',
      messageType: 'arrival',
      messageBody: message || '',
      status: 'failed',
      errorMessage: error.message
    })
    return Response.json({
      error: 'Failed to send arrival text',
      details: error.message
    }, { status: 500 })
  }
}
