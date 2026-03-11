import { createQuoteRequest } from '@/lib/db'

export async function POST(request) {
  try {
    const data = await request.json()

    // Validate required fields
    const hasServices = (data.selectedServices && data.selectedServices.length > 0) || data.serviceName
    if (!hasServices || !data.firstName || !data.lastName || !data.phone || !data.city) {
      return Response.json(
        { error: 'Missing required fields: service(s), first name, last name, phone, city' },
        { status: 400 }
      )
    }

    const result = await createQuoteRequest(data)

    return Response.json({
      success: true,
      quoteRequestId: result.id
    })
  } catch (error) {
    console.error('Error creating quote request:', error)
    return Response.json(
      {
        error: 'Failed to create quote request',
        details: error.message,
        airtableError: error.error || null,
        statusCode: error.statusCode || null
      },
      { status: 500 }
    )
  }
}
