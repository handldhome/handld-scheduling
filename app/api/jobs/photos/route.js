import Airtable from 'airtable'

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID)

export async function POST(request) {
  try {
    const formData = await request.formData()
    const jobId = formData.get('jobId')
    const type = formData.get('type') // 'before' or 'after'
    const photos = formData.getAll('photos')

    if (!jobId || !type || photos.length === 0) {
      return Response.json(
        { error: 'Missing required fields: jobId, type, photos' },
        { status: 400 }
      )
    }

    // Convert files to base64 for Airtable
    const attachments = []

    for (const photo of photos) {
      if (photo instanceof File) {
        const bytes = await photo.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const base64 = buffer.toString('base64')
        const mimeType = photo.type || 'image/jpeg'

        // Airtable accepts attachments as URLs or as objects with url field
        // For direct upload, we need to use a workaround - upload to a service first
        // For now, we'll use the filename approach which requires the file to be accessible via URL

        // Alternative: Use Airtable's attachment upload via base64
        // This requires creating a temporary URL - let's use data URL approach
        attachments.push({
          url: `data:${mimeType};base64,${base64}`,
          filename: photo.name || `${type}-photo-${Date.now()}.jpg`
        })
      }
    }

    // Determine field name based on type
    const fieldName = type === 'before' ? 'Before Photos' : 'After Photos'

    // Get existing photos first to append
    const existingRecord = await base(process.env.AIRTABLE_JOBS_TABLE).find(jobId)
    const existingPhotos = existingRecord.fields[fieldName] || []

    // Update the job with photos
    // Note: Airtable attachment fields expect an array of {url: string} objects
    const record = await base(process.env.AIRTABLE_JOBS_TABLE).update(jobId, {
      [fieldName]: [...existingPhotos, ...attachments]
    })

    return Response.json({
      success: true,
      photosAdded: attachments.length,
      totalPhotos: record.fields[fieldName]?.length || 0
    })
  } catch (error) {
    console.error('Error uploading photos:', error)
    return Response.json(
      { error: 'Failed to upload photos', details: error.message },
      { status: 500 }
    )
  }
}
