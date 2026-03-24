import { getDb } from '@/lib/supabase'
import { logSms } from '@/lib/db'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import twilio from 'twilio'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

const formatPhoneNumber = (phone) => {
  if (!phone) return null
  let phoneStr = Array.isArray(phone) ? phone[0] : String(phone)
  const cleaned = phoneStr.replace(/\D/g, '')
  if (cleaned.length === 10) return `+1${cleaned}`
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`
  if (phoneStr.startsWith('+')) return phoneStr
  return null
}

/**
 * POST /api/public/book
 * Creates a job from an approved quote with a customer-selected time slot.
 *
 * Body: {
 *   quoteRequestId: string (UUID),
 *   preferredDate: string (YYYY-MM-DD),
 *   preferredTime: 'AM' | 'PM',
 *   services: string[] (service names)
 * }
 *
 * Creates a job with status "Planned" (Needs Review in the dashboard).
 * Sends confirmation SMS to the customer.
 */
export async function POST(request) {
  try {
    const { quoteRequestId, preferredDate, preferredTime, services } = await request.json()

    if (!quoteRequestId || !preferredDate || !preferredTime) {
      return NextResponse.json(
        { error: 'quoteRequestId, preferredDate, and preferredTime are required' },
        { status: 400, headers: corsHeaders }
      )
    }

    const db = getDb()

    // Fetch the quote request with customer info
    const { data: quoteRequest, error: qrError } = await db
      .from('quote_requests')
      .select('*, customer:customers(id, first_name, last_name, phone, email)')
      .eq('id', quoteRequestId)
      .single()

    if (qrError || !quoteRequest) {
      return NextResponse.json(
        { error: 'Quote request not found' },
        { status: 404, headers: corsHeaders }
      )
    }

    // Map preferred time period to a scheduled time
    const scheduledTime = preferredTime === 'AM' ? '09:00' : '13:00'

    // Create a job for each service (or a single combined job)
    const primaryService = services?.[0] || quoteRequest.selected_services?.[0] || 'Service'
    const additionalServices = (services || quoteRequest.selected_services || []).slice(1)

    const jobRecord = {
      service: primaryService,
      service_detail: additionalServices.length > 0 ? additionalServices.join(', ') : null,
      additional_services: additionalServices.length > 0 ? additionalServices.join(',') : null,
      name: `${quoteRequest.customer?.first_name || ''} ${quoteRequest.customer?.last_name || ''}`.trim() || 'Customer',
      status: 'Planned',
      target_date: preferredDate,
      scheduled_time: scheduledTime,
      quote_request_id: quoteRequest.id,
      other_notes: `Booked via self-scheduling. Quote: ${quoteRequest.quote_id}. Preferred: ${preferredTime}`,
      confirmed: false
    }

    const { data: job, error: jobError } = await db
      .from('jobs')
      .insert(jobRecord)
      .select('id')
      .single()

    if (jobError) {
      console.error('Job creation error:', jobError)
      return NextResponse.json(
        { error: 'Failed to create booking' },
        { status: 500, headers: corsHeaders }
      )
    }

    // Update quote_request with preferred date/time
    await db
      .from('quote_requests')
      .update({
        preferred_date: preferredDate,
        preferred_time: preferredTime,
        quote_approved: true
      })
      .eq('id', quoteRequestId)

    // Send confirmation SMS to customer
    const customerPhone = formatPhoneNumber(quoteRequest.customer?.phone)
    const firstName = quoteRequest.customer?.first_name || 'there'

    const dateDisplay = new Date(preferredDate + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    })
    const timeDisplay = preferredTime === 'AM' ? 'morning (8am–12pm)' : 'afternoon (1pm–5pm)'

    if (customerPhone) {
      try {
        const client = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        )

        const message = `Hi ${firstName}! Your Handld appointment is booked for ${dateDisplay}, ${timeDisplay}. We'll confirm your exact arrival time soon. Questions? Text us at (626) 298-7128`

        const result = await client.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: customerPhone
        })

        await logSms({
          jobId: job.id,
          recipientPhone: customerPhone,
          recipientType: 'customer',
          messageType: 'booking_confirmation',
          messageBody: message,
          twilioSid: result.sid,
          status: 'sent'
        })
      } catch (smsError) {
        console.error('Booking confirmation SMS error:', smsError)
        await logSms({
          jobId: job.id,
          recipientPhone: customerPhone,
          recipientType: 'customer',
          messageType: 'booking_confirmation',
          messageBody: '',
          status: 'failed',
          errorMessage: smsError.message
        })
      }
    }

    revalidateTag('jobs')

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: `Appointment booked for ${dateDisplay}, ${timeDisplay}`
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('Booking API error:', error)
    return NextResponse.json(
      { error: 'Failed to create booking', details: error.message },
      { status: 500, headers: corsHeaders }
    )
  }
}
