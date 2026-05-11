import { getDb } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import twilio from 'twilio'

const ADMIN_PHONE = '+16263900189'

const formatTime = (timeStr) => {
  if (!timeStr) return 'TBD'
  const [hours, minutes] = timeStr.split(':')
  const h = parseInt(hours)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${minutes} ${suffix}`
}

/**
 * GET /api/cron/check-tech-confirmations
 *
 * Checks for jobs where the tech confirmation deadline has passed
 * without a response. Texts the admin for each one.
 *
 * Set up as a Vercel Cron Job running every hour, or call manually.
 */
export async function GET(request) {
  // Optional: verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = getDb()
    const now = new Date().toISOString()

    // Find jobs with expired deadlines that haven't been confirmed or declined
    // and haven't already been flagged (we use a simple approach: check for
    // tech_confirmation_deadline < now AND tech_confirmed_at IS NULL AND tech_declined_at IS NULL)
    const { data: expiredJobs, error } = await db
      .from('jobs')
      .select('*, technician:technicians(first_name, last_name), quote_request:quote_requests(address)')
      .not('tech_confirmation_deadline', 'is', null)
      .lt('tech_confirmation_deadline', now)
      .is('tech_confirmed_at', null)
      .is('tech_declined_at', null)
      .not('tech_confirmation_token', 'is', null)

    if (error) {
      console.error('Error checking confirmations:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!expiredJobs || expiredJobs.length === 0) {
      return NextResponse.json({ message: 'No expired confirmations', count: 0 })
    }

    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    const results = []

    for (const job of expiredJobs) {
      const techName = job.technician
        ? `${job.technician.first_name} ${job.technician.last_name}`
        : 'Unassigned tech'
      const dateDisplay = job.target_date
        ? new Date(job.target_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })
        : 'TBD'

      try {
        const message = `⏰ ${techName} did NOT confirm:\n\n${job.service}\n${dateDisplay} at ${formatTime(job.scheduled_time)}\n${job.quote_request?.address || ''}\n\nDeadline was ${new Date(job.tech_confirmation_deadline).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })}.\n\nThis job needs to be reassigned or followed up on.`

        await client.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: ADMIN_PHONE
        })

        // Clear the token so we don't re-alert on the next cron run
        await db
          .from('jobs')
          .update({ tech_confirmation_token: null })
          .eq('id', job.id)

        results.push({ jobId: job.id, techName, notified: true })
      } catch (smsErr) {
        console.error('Admin notification error for job:', job.id, smsErr)
        results.push({ jobId: job.id, techName, notified: false, error: smsErr.message })
      }
    }

    return NextResponse.json({
      message: `Checked ${expiredJobs.length} expired confirmation(s)`,
      count: expiredJobs.length,
      results
    })
  } catch (err) {
    console.error('Cron check-tech-confirmations error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
