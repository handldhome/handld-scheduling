import { updateJob } from '@/lib/db'

export const revalidate = 0

export async function PATCH(request, { params }) {
  try {
    const { id } = params
    const updates = await request.json()

    const result = await updateJob(id, updates)

    return Response.json({
      success: true,
      jobId: result.id
    })
  } catch (error) {
    console.error('Error updating job:', error)
    return Response.json(
      { error: 'Failed to update job', details: error.message },
      { status: 500 }
    )
  }
}
