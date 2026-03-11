import { put } from '@vercel/blob'
import { getDb } from '@/lib/supabase'

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
    const type = formData.get('type') // 'before', 'after', or 'receipt'
    const photos = formData.getAll('photos')

    if (!jobId || !type || photos.length === 0) {
      return Response.json(
        { error: 'Missing required fields: jobId, type, photos' },
        { status: 400 }
      )
    }

    // Upload photos to Vercel Blob and collect URLs
    const urls = []

    for (const photo of photos) {
      if (photo instanceof File) {
        const filename = `jobs/${jobId}/${type}/${Date.now()}-${photo.name || 'photo.jpg'}`

        const blob = await put(filename, photo, {
          access: 'public',
          contentType: photo.type || 'image/jpeg'
        })

        urls.push(blob.url)
      }
    }

    if (urls.length === 0) {
      return Response.json(
        { error: 'No valid photos to upload' },
        { status: 400 }
      )
    }

    // Determine column name based on type
    let columnName
    if (type === 'before') {
      columnName = 'before_photos'
    } else if (type === 'after') {
      columnName = 'after_photos'
    } else if (type === 'receipt') {
      columnName = 'material_receipts'
    } else {
      return Response.json(
        { error: 'Invalid photo type. Must be: before, after, or receipt' },
        { status: 400 }
      )
    }

    const db = getDb()

    // Get existing photos to append
    const { data: existing } = await db
      .from('jobs')
      .select(columnName)
      .eq('id', jobId)
      .single()

    let allPhotos
    if (columnName === 'material_receipts') {
      // material_receipts is text, not array — store as comma-separated
      const existingReceipts = existing?.[columnName] || ''
      allPhotos = existingReceipts ? `${existingReceipts},${urls.join(',')}` : urls.join(',')
    } else {
      // before_photos and after_photos are text[] arrays
      const existingArr = existing?.[columnName] || []
      allPhotos = [...existingArr, ...urls]
    }

    const { error } = await db
      .from('jobs')
      .update({ [columnName]: allPhotos })
      .eq('id', jobId)

    if (error) {
      console.error('Error updating job photos:', error)
      throw error
    }

    return Response.json({
      success: true,
      photosAdded: urls.length,
      totalPhotos: Array.isArray(allPhotos) ? allPhotos.length : urls.length
    })
  } catch (error) {
    console.error('Error uploading photos:', error)
    return Response.json(
      { error: 'Failed to upload photos', details: error.message },
      { status: 500 }
    )
  }
}
