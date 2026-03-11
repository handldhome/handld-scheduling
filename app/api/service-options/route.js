import { getServiceOptions } from '@/lib/db'

// Cache for 5 minutes since service options rarely change
export const revalidate = 300

export async function GET() {
  try {
    const options = await getServiceOptions()
    return Response.json({ options })
  } catch (error) {
    console.error('Error fetching service options:', error)
    return Response.json(
      { error: 'Failed to fetch service options', details: error.message },
      { status: 500 }
    )
  }
}
