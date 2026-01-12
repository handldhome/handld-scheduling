import { getAllJobs, createJob } from '@/lib/airtable'

// Disable caching
export const revalidate = 0

export async function GET() {
  try {
    const jobs = await getAllJobs()
    return Response.json({ jobs })
  } catch (error) {
    console.error('Error fetching jobs:', error)
    return Response.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    const jobData = await request.json()

    // Validate required fields
    if (!jobData.serviceName || !jobData.date || !jobData.customerName) {
      return Response.json(
        { error: 'Missing required fields: serviceName, date, customerName' },
        { status: 400 }
      )
    }

    const result = await createJob(jobData)

    return Response.json({
      success: true,
      jobId: result.id
    })
  } catch (error) {
    console.error('Error creating job:', error)
    return Response.json(
      { error: 'Failed to create job', details: error.message },
      { status: 500 }
    )
  }
}
