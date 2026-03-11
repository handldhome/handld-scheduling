import { getAllTechnicians, getAllAvailability } from '@/lib/db'

export async function GET() {
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
