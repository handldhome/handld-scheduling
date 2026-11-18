import { put, del } from '@vercel/blob'
import { getDb } from '@/lib/supabase'
import { W9_MAX_BYTES, buildW9Pathname, getPrivateBlobToken, setW9InNotes } from '@/lib/w9.mjs'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Work out the file type from its first bytes rather than trusting the
// browser. Only PDF, JPEG and PNG are accepted (matches the onboarding form).
function sniffContentType(bytes) {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'application/pdf'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png'
  }
  return null
}

function w9UnavailableMessage() {
  const email = process.env.W9_CONTACT_EMAIL
  return `W-9 upload is temporarily unavailable. Your other details were saved. Please email your W-9 to ${email || 'your Handld contact'}.`
}

// W-9s contain SSNs/EINs. Never log or return the file, its name or its
// storage location.
export async function POST(request) {
  // Without the private store, refuse. Never fall back to the public store.
  const token = getPrivateBlobToken()
  if (!token) {
    console.error('W9 upload: PRIVATE_BLOB_READ_WRITE_TOKEN is not configured')
    return Response.json({ error: w9UnavailableMessage(), w9Unavailable: true }, { status: 503 })
  }

  try {
    const formData = await request.formData()
    const techId = formData.get('techId')
    const w9File = formData.get('w9')

    if (!techId || typeof techId !== 'string' || !w9File || typeof w9File === 'string') {
      return Response.json({ error: 'Tech ID and W9 file are required' }, { status: 400 })
    }
    if (w9File.size === 0 || w9File.size > W9_MAX_BYTES) {
      return Response.json({ error: 'W9 file must be under 10 MB' }, { status: 400 })
    }

    const bytes = new Uint8Array(await w9File.arrayBuffer())
    const contentType = sniffContentType(bytes)
    if (!contentType) {
      return Response.json({ error: 'W9 must be a PDF, JPG, or PNG' }, { status: 400 })
    }

    // Resolve tech ID (might be airtable_id or UUID)
    const db = getDb()
    const { data: tech, error: lookupError } = await db
      .from('technicians')
      .select('id, active, notes')
      .eq(UUID_RE.test(techId) ? 'id' : 'airtable_id', techId)
      .maybeSingle()

    if (lookupError) throw lookupError
    if (!tech) {
      return Response.json({ error: 'Technician not found' }, { status: 404 })
    }
    // This route is public (onboarding has no login). New techs start
    // inactive, so only accept a W-9 during onboarding; an active tech's W-9
    // cannot be replaced by anyone who knows their ID.
    if (tech.active) {
      return Response.json({ error: 'W9 can only be uploaded during onboarding' }, { status: 403 })
    }

    const pathname = buildW9Pathname(tech.id, contentType)
    await put(pathname, bytes, {
      access: 'private',
      token,
      contentType,
      addRandomSuffix: false,
      allowOverwrite: false
    })

    const { error: updateError } = await db
      .from('technicians')
      .update({ notes: setW9InNotes(tech.notes, pathname) })
      .eq('id', tech.id)

    if (updateError) {
      // Don't leave an unreferenced copy behind
      await del(pathname, { token }).catch(() => {})
      throw updateError
    }

    return Response.json({ success: true, message: 'W9 uploaded successfully' })
  } catch (error) {
    // Name/code only: blob and DB error messages can include the storage path
    console.error('W9 upload failed:', error?.code || error?.name || 'Error')
    return Response.json({ error: 'Failed to upload W9' }, { status: 500 })
  }
}
