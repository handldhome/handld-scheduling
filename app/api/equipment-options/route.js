import { getEquipmentOptions } from '@/lib/db'

// Cache for 5 minutes since equipment options rarely change
export const revalidate = 300

export async function GET() {
  try {
    const options = await getEquipmentOptions()
    return Response.json({ options })
  } catch (error) {
    console.error('Error fetching equipment options:', error)
    return Response.json(
      { error: 'Failed to fetch equipment options', details: error.message },
      { status: 500 }
    )
  }
}
