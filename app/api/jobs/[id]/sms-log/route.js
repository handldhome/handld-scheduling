import { getSmsLogForJob } from '@/lib/db'
import { isAdminRequest, unauthorized } from '@/lib/admin-auth'

export async function GET(request, { params }) {
  if (!isAdminRequest(request)) return unauthorized()

  try {
    const { id } = params
    const logs = await getSmsLogForJob(id)
    return Response.json({ logs })
  } catch (error) {
    console.error('Error fetching SMS log:', error)
    return Response.json({ error: 'Failed to fetch SMS log' }, { status: 500 })
  }
}
