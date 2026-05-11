import { getDb } from '@/lib/supabase'
import { logSms } from '@/lib/db'
import { NextResponse } from 'next/server'
import twilio from 'twilio'

const ADMIN_PHONE = '+16263900189'

const formatPhoneNumber = (phone) => {
  if (!phone) return null
  const phoneStr = Array.isArray(phone) ? phone[0] : String(phone)
  const cleaned = phoneStr.replace(/\D/g, '')
  if (cleaned.length === 10) return `+1${cleaned}`
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`
  if (phoneStr.startsWith('+')) return phoneStr
  return null
}

const formatTime = (timeStr) => {
  if (!timeStr) return 'TBD'
  const [hours, minutes] = timeStr.split(':')
  const h = parseInt(hours)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${minutes} ${suffix}`
}

/**
 * GET /api/tech-confirm/[token]
 * Returns job details for the confirmation page
 */
export async function GET(request, { params }) {
  try {
    const { token } = params
    const db = getDb()

    const { data: job, error } = await db
      .from('jobs')
      .select('*, technician:technicians(id, first_name, last_name, phone), quote_request:quote_requests(address, city, customer:customers(first_name, last_name, phone))')
      .eq('tech_confirmation_token', token)
      .single()

    if (error || !job) {
      return NextResponse.json({ error: 'Invalid or expired confirmation link' }, { status: 404 })
    }

    const now = new Date()
    const deadline = job.tech_confirmation_deadline ? new Date(job.tech_confirmation_deadline) : null
    const isExpired = deadline && now > deadline
    const isConfirmed = !!job.tech_confirmed_at
    const isDeclined = !!job.tech_declined_at

    return NextResponse.json({
      job: {
        id: job.id,
        serviceName: job.service,
        serviceDetail: job.service_detail,
        date: job.target_date,
        time: job.scheduled_time,
        address: job.quote_request?.address || '',
        city: job.quote_request?.city || '',
        customerName: `${job.quote_request?.customer?.first_name || ''} ${job.quote_request?.customer?.last_name || ''}`.trim() || job.name,
        techName: job.technician ? `${job.technician.first_name} ${job.technician.last_name}` : '',
        equipment: job.requires_equipment || null,
        notes: job.other_notes || '',
        vibe: job.vibe || '',
        pets: job.pets || '',
        gateCode: job.gate_code_access || '',
        electricWater: job.electric_water || '',
        estimatedTime: job.expected_time_to_complete || null
      },
      deadline: job.tech_confirmation_deadline,
      isExpired,
      isConfirmed,
      isDeclined
    })
  } catch (err) {
    console.error('Tech confirm GET error:', err)
    return NextResponse.json({ error: 'Failed to load job' }, { status: 500 })
  }
}

/**
 * POST /api/tech-confirm/[token]
 * Body: { action: 'confirm' | 'decline', reason?: string }
 *
 * On confirm: marks job as tech-confirmed, sends customer confirmation SMS with tech name
 * On decline: marks job as tech-declined, flags for reassignment
 */
export async function POST(request, { params }) {
  try {
    const { token } = params
    const { action, reason } = await request.json()

    if (!action || !['confirm', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const db = getDb()

    // Fetch job with related data
    const { data: job, error: fetchError } = await db
      .from('jobs')
      .select('*, technician:technicians(id, first_name, last_name, phone), quote_request:quote_requests(address, city, customer:customers(first_name, last_name, phone))')
      .eq('tech_confirmation_token', token)
      .single()

    if (fetchError || !job) {
      return NextResponse.json({ error: 'Invalid or expired confirmation link' }, { status: 404 })
    }

    // Check if already responded
    if (job.tech_confirmed_at) {
      return NextResponse.json({ error: 'Already confirmed', alreadyConfirmed: true }, { status: 400 })
    }
    if (job.tech_declined_at) {
      return NextResponse.json({ error: 'Already declined', alreadyDeclined: true }, { status: 400 })
    }

    // Check deadline
    const now = new Date()
    const deadline = job.tech_confirmation_deadline ? new Date(job.tech_confirmation_deadline) : null
    if (deadline && now > deadline) {
      return NextResponse.json({ error: 'Confirmation deadline has passed' }, { status: 400 })
    }

    const techName = job.technician ? `${job.technician.first_name} ${job.technician.last_name}` : 'Your technician'
    const techFirstName = job.technician?.first_name || 'Technician'

    if (action === 'confirm') {
      // Mark job as tech-confirmed
      await db
        .from('jobs')
        .update({
          tech_confirmed_at: now.toISOString(),
          confirmed: true
        })
        .eq('id', job.id)

      // Send customer confirmation SMS with tech name
      const customerPhone = formatPhoneNumber(job.quote_request?.customer?.phone)
      const customerFirstName = job.quote_request?.customer?.first_name || 'there'

      if (customerPhone) {
        try {
          const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

          const dateDisplay = new Date(job.target_date + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            timeZone: 'America/Los_Angeles'
          })
          const timeDisplay = formatTime(job.scheduled_time)

          const message = `Hi ${customerFirstName}! Great news — your ${job.service} appointment is confirmed for ${dateDisplay} at ${timeDisplay}. ${techFirstName} will be your technician. You'll get a text when they're on the way. Questions? Text us at (626) 298-7128`

          const result = await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: customerPhone
          })

          await logSms({
            jobId: job.id,
            recipientPhone: customerPhone,
            recipientType: 'customer',
            messageType: 'tech_confirmed',
            messageBody: message,
            twilioSid: result.sid,
            status: 'sent'
          })
        } catch (smsErr) {
          console.error('Customer confirmation SMS error:', smsErr)
          await logSms({
            jobId: job.id,
            recipientPhone: customerPhone,
            recipientType: 'customer',
            messageType: 'tech_confirmed',
            messageBody: '',
            status: 'failed',
            errorMessage: smsErr.message
          })
        }
      }

      return NextResponse.json({ success: true, action: 'confirmed' })

    } else {
      // Mark job as tech-declined
      await db
        .from('jobs')
        .update({
          tech_declined_at: now.toISOString(),
          tech_decline_reason: reason || 'No reason given',
          confirmed: false,
          // Clear tech assignment so dispatcher knows to reassign
          technician_id: null
        })
        .eq('id', job.id)

      // Notify admin that tech declined
      try {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
        const dateDisplay = new Date(job.target_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })
        const adminMsg = `⚠️ ${techName} declined a job:\n\n${job.service}\n${dateDisplay} at ${formatTime(job.scheduled_time)}\n${job.quote_request?.address || ''}\n\nReason: ${reason || 'None given'}\n\nThis job needs to be reassigned.`
        await client.messages.create({ body: adminMsg, from: process.env.TWILIO_PHONE_NUMBER, to: ADMIN_PHONE })
      } catch (adminSmsErr) {
        console.error('Admin decline notification error:', adminSmsErr)
      }

      return NextResponse.json({ success: true, action: 'declined' })
    }
  } catch (err) {
    console.error('Tech confirm POST error:', err)
    return NextResponse.json({ error: 'Failed to process confirmation' }, { status: 500 })
  }
}
