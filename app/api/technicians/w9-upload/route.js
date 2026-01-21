import Airtable from 'airtable'
import { put } from '@vercel/blob'

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID)

export async function POST(request) {
  try {
    console.log('W9 upload: Starting...')

    const formData = await request.formData()
    const techId = formData.get('techId')
    const w9File = formData.get('w9')

    console.log('W9 upload: techId =', techId)
    console.log('W9 upload: w9File name =', w9File?.name, 'size =', w9File?.size)

    if (!techId || !w9File) {
      console.log('W9 upload: Missing techId or w9File')
      return Response.json(
        { error: 'Tech ID and W9 file are required' },
        { status: 400 }
      )
    }

    // Upload file to Vercel Blob storage
    console.log('W9 upload: Uploading to Vercel Blob...')
    const filename = `w9/${techId}-${Date.now()}-${w9File.name || 'W9-form.pdf'}`
    const blob = await put(filename, w9File, {
      access: 'public',
    })
    console.log('W9 upload: Blob URL =', blob.url)

    // Create attachment object for Airtable using the public blob URL
    const attachment = {
      url: blob.url,
      filename: w9File.name || 'W9-form.pdf'
    }

    // Update technician record with W9 attachment
    console.log('W9 upload: Updating Airtable record', techId)
    await base(process.env.AIRTABLE_TECHNICIANS_TABLE).update(techId, {
      'W9': [attachment]
    })
    console.log('W9 upload: Success!')

    return Response.json({
      success: true,
      message: 'W9 uploaded successfully',
      url: blob.url
    })
  } catch (error) {
    console.error('W9 upload ERROR:', error.message)
    console.error('W9 upload ERROR stack:', error.stack)
    return Response.json(
      { error: 'Failed to upload W9', details: error.message },
      { status: 500 }
    )
  }
}
