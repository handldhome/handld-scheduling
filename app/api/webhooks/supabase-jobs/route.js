import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export const revalidate = 0

// Supabase Database Webhook target. Configure in Supabase Studio:
//   Database → Webhooks → New webhook
//     Table: handld.quote_requests, Events: Update
//     Type: HTTP Request, Method: POST
//     URL: https://<host>/api/webhooks/supabase-jobs
//     HTTP header: x-webhook-secret = $SUPABASE_WEBHOOK_SECRET
//
// Also useful to add a second webhook on handld.jobs (Insert/Update/Delete)
// pointed at the same URL so direct DB edits to jobs purge the cache too.
export async function POST(request) {
  const expected = process.env.SUPABASE_WEBHOOK_SECRET
  if (expected) {
    const got = request.headers.get('x-webhook-secret')
    if (got !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  revalidatePath('/admin')
  return NextResponse.json({ success: true })
}
