import { updateJob } from '@/lib/db'
import { revalidatePath, revalidateTag } from 'next/cache'
import { authorizeJobAccess } from '@/lib/tech-auth'
import { unauthorized } from '@/lib/admin-auth'

export const revalidate = 0

// Admin, or the tech the job is assigned to (from their schedule page).
export async function PATCH(request, { params }) {
  const access = await authorizeJobAccess(request, params.id)
  if (!access.ok) return unauthorized()

  try {
    const { id } = params
    const updates = await request.json()

    // Techs can update their own jobs but not reassign them
    if (!access.admin && updates.assignedTech !== undefined) {
      return Response.json({ error: 'Only the office can reassign jobs' }, { status: 403 })
    }

    const result = await updateJob(id, updates)

    // revalidateTag('jobs') is a no-op here because getAllJobs() uses the
    // Supabase client (not Next's tagged fetch). revalidatePath actually
    // busts the ISR cache on /admin so the next reload sees fresh data.
    revalidatePath('/admin')
    revalidateTag('jobs')

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
