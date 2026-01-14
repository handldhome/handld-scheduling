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

    // Validate required fields (date is optional - defaults to today)
    if (!jobData.serviceName || !jobData.customerName) {
      return Response.json(
        { error: 'Missing required fields: serviceName, customerName' },
        { status: 400 }
      )
    }

    // Default date to today if not provided
    if (!jobData.date) {
      const today = new Date()
      jobData.date = today.toISOString().split('T')[0] // Format: YYYY-MM-DD
    }

    const result = await createJob(jobData)

    return Response.json({
      success: true,
      jobId: result.id
    })
  } catch (error) {
    console.error('Error creating job:', error)
    return Response.json(
      {
        error: 'Failed to create job',
        details: error.message,
        airtableError: error.error || null,
        statusCode: error.statusCode || null
      },
      { status: 500 }
    )
  }
}
