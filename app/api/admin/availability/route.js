import { getAllTechnicians, getAllAvailability } from '@/lib/db'
import { isAdminRequest, unauthorized } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  if (!isAdminRequest(request)) return unauthorized()

  try {
    const [technicians, availability] = await Promise.all([
      getAllTechnicians(),
      getAllAvailability()
    ])

    return Response.json({
      technicians,
      availability
    })
  } catch (error) {
    console.error('Error fetching admin data:', error)
    return Response.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    )
  }
}
