import Airtable from 'airtable'
import { put } from '@vercel/blob'

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID)

export async function POST(request) {
  try {
    const formData = await request.formData()
    const techId = formData.get('techId')
    const w9File = formData.get('w9')

    if (!techId || !w9File) {
      return Response.json(
        { error: 'Tech ID and W9 file are required' },
        { status: 400 }
      )
    }

    // Upload file to Vercel Blob storage
    const filename = `w9/${techId}-${Date.now()}-${w9File.name || 'W9-form.pdf'}`
    const blob = await put(filename, w9File, {
      access: 'public',
    })

    // Create attachment object for Airtable using the public blob URL
    const attachment = {
      url: blob.url,
      filename: w9File.name || 'W9-form.pdf'
    }

    // Update technician record with W9 attachment
    await base(process.env.AIRTABLE_TECHNICIANS_TABLE).update(techId, {
      'W9': [attachment]
    })

    return Response.json({
      success: true,
      message: 'W9 uploaded successfully',
      url: blob.url
    })
  } catch (error) {
    console.error('Error uploading W9:', error)
    return Response.json(
      { error: 'Failed to upload W9', details: error.message },
      { status: 500 }
    )
  }
}
