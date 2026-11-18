// W-9 storage helpers.
//
// A W-9 carries an SSN or EIN, so it lives in a PRIVATE Vercel Blob store
// (its own store and token, separate from the public store job photos use).
// The database keeps only the private pathname, on a "W9: <pathname>" line in
// technicians.notes (there is no dedicated column). Older rows hold a public
// blob URL on that line instead; scripts/migrate-w9-to-private.mjs moves them.
//
// Plain .mjs so the migration script can import it outside Next.js.

import { randomUUID } from 'crypto'

export const W9_NOTE_PREFIX = 'W9: '
export const W9_MAX_BYTES = 10 * 1024 * 1024

export const W9_CONTENT_TYPES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png'
}

const W9_LINE = /^W9: (.*)$/m

export function getPrivateBlobToken() {
  return process.env.PRIVATE_BLOB_READ_WRITE_TOKEN || null
}

// Pathname for a new upload. Deliberately leaves out the uploaded file name,
// which often contains the technician's name.
export function buildW9Pathname(techId, contentType) {
  const ext = W9_CONTENT_TYPES[contentType] || 'bin'
  return `w9/${techId}/${Date.now()}-${randomUUID()}.${ext}`
}

// Reads the W9 line from technicians.notes.
// Returns { pathname } for private storage, { legacyPublicUrl } for a row
// not yet migrated, or null when there is no W-9.
export function parseW9Note(notes) {
  if (!notes) return null
  const match = W9_LINE.exec(notes)
  if (!match) return null
  const value = match[1].trim()
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return { legacyPublicUrl: value }
  if (value.startsWith('w9/') && !value.split('/').includes('..')) return { pathname: value }
  return null
}

// Returns notes with the W9 line set to the private pathname, keeping any
// other text in the notes.
export function setW9InNotes(notes, pathname) {
  const line = `${W9_NOTE_PREFIX}${pathname}`
  if (notes && W9_LINE.test(notes)) return notes.replace(W9_LINE, line)
  return notes ? `${notes}\n${line}` : line
}
