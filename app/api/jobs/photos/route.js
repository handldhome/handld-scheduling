import { put } from '@vercel/blob'
import Airtable from 'airtable'

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID)

export async function POST(request) {
  try {
    // Check for Vercel Blob token
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('BLOB_READ_WRITE_TOKEN is not configured')
      return Response.json(
        { error: 'Photo storage not configured. Please set up Vercel Blob storage.' },
        { status: 500 }
      )
    }

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

    // Upload photos to Vercel Blob and collect URLs
    const attachments = []

    for (const photo of photos) {
      if (photo instanceof File) {
        const filename = `jobs/${jobId}/${type}/${Date.now()}-${photo.name || 'photo.jpg'}`

        // Upload to Vercel Blob
        const blob = await put(filename, photo, {
          access: 'public',
          contentType: photo.type || 'image/jpeg'
        })

        // Airtable needs the URL in a specific format
        attachments.push({
          url: blob.url,
          filename: photo.name || `${type}-photo-${Date.now()}.jpg`
        })
      }
    }

    if (attachments.length === 0) {
      return Response.json(
        { error: 'No valid photos to upload' },
        { status: 400 }
      )
    }

    // Determine field name based on type
    let fieldName
    if (type === 'before') {
      fieldName = 'Before Photos'
    } else if (type === 'after') {
      fieldName = 'After Photos'
    } else if (type === 'receipt') {
      fieldName = 'Material Receipts'
    } else {
      return Response.json(
        { error: 'Invalid photo type. Must be: before, after, or receipt' },
        { status: 400 }
      )
    }

    // Get existing photos first to append
    const existingRecord = await base(process.env.AIRTABLE_JOBS_TABLE).find(jobId)
    const existingPhotos = existingRecord.fields[fieldName] || []

    // Update the job with photos - Airtable attachment fields expect an array of {url: string} objects
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
