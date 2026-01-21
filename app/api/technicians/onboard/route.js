import { createTechnician } from '@/lib/airtable'

export async function POST(request) {
  try {
    const data = await request.json()

    // Validate required fields
    if (!data.firstName || !data.lastName || !data.phone) {
      return Response.json(
        { error: 'First name, last name, and phone are required' },
        { status: 400 }
      )
    }

    const result = await createTechnician(data)

    return Response.json({
      success: true,
      techId: result.id,
      message: 'Technician created successfully'
    })
  } catch (error) {
    console.error('Error creating technician:', error)
    return Response.json(
      { error: 'Failed to create technician', details: error.message },
      { status: 500 }
    )
  }
}
