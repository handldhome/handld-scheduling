import Airtable from 'airtable'

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

    // Convert file to base64
    const bytes = await w9File.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const mimeType = w9File.type || 'application/pdf'

    // Create attachment object for Airtable
    const attachment = {
      url: `data:${mimeType};base64,${base64}`,
      filename: w9File.name || 'W9-form.pdf'
    }

    // Update technician record with W9 attachment
    const record = await base(process.env.AIRTABLE_TECHNICIANS_TABLE).update(techId, {
      'W9': [attachment]
    })

    return Response.json({
      success: true,
      message: 'W9 uploaded successfully'
    })
  } catch (error) {
    console.error('Error uploading W9:', error)
    return Response.json(
      { error: 'Failed to upload W9', details: error.message },
      { status: 500 }
    )
  }
}
