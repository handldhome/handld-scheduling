#!/usr/bin/env node
// One-off: move technician W-9s from the PUBLIC Vercel Blob store to the
// PRIVATE one, and point technicians.notes at the private pathname.
//
// Modes (run them in this order):
//   node --env-file=.env.migrate scripts/migrate-w9-to-private.mjs
//       Dry run (default). Reads only, prints counts.
//   node --env-file=.env.migrate scripts/migrate-w9-to-private.mjs --apply
//       Copies every public w9/ blob into the private store under the same
//       pathname, reads the copy back and checks it byte-for-byte, then
//       rewrites the W9 line of the matching technicians.notes. Public
//       originals are left in place.
//   node --env-file=.env.migrate scripts/migrate-w9-to-private.mjs --delete-public
//       Deletes a public original only when no DB row still points at it AND
//       its private copy exists and matches byte-for-byte (checked again now).
//
// Env: HANDLD_SUPABASE_URL, HANDLD_SUPABASE_SERVICE_ROLE_KEY,
//      BLOB_READ_WRITE_TOKEN (public store), PRIVATE_BLOB_READ_WRITE_TOKEN.
//
// Never prints URLs, pathnames or file contents: counts, technician IDs and
// error codes only. Safe to re-run; already-copied files are verified, not
// copied again.

import { get, put, list, del } from '@vercel/blob'
import { createClient } from '@supabase/supabase-js'
import { pathToFileURL } from 'url'
import { parseW9Note, setW9InNotes } from '../lib/w9.mjs'

class UsageError extends Error {}

function parseArgs(argv) {
  const KNOWN = new Set(['--apply', '--delete-public'])
  const unknown = argv.filter(a => !KNOWN.has(a))
  if (unknown.length) {
    throw new UsageError(`Unknown argument(s): ${unknown.join(' ')}. Use --apply or --delete-public.`)
  }
  return { APPLY: argv.includes('--apply'), DELETE_PUBLIC: argv.includes('--delete-public') }
}

function requireEnv(name) {
  const v = process.env[name]
  if (!v) throw new UsageError(`Missing env var ${name}`)
  return v
}

let PUBLIC_TOKEN
let PRIVATE_TOKEN
let db

const errCode = e => e?.code || e?.name || 'Error'

async function readAll(store, pathnameOrUrl) {
  const result = await get(pathnameOrUrl, {
    access: store === 'private' ? 'private' : 'public',
    token: store === 'private' ? PRIVATE_TOKEN : PUBLIC_TOKEN,
    useCache: false
  })
  if (!result || result.statusCode !== 200) return null
  return {
    bytes: Buffer.from(await new Response(result.stream).arrayBuffer()),
    contentType: result.blob.contentType
  }
}

async function loadW9Rows() {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('technicians')
      .select('id, notes')
      .like('notes', '%W9: %')
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) break
  }
  return rows
}

// pathname -> [{ id, notes }] for rows whose W9 line is still a public URL
function indexLegacyRows(rows) {
  const byPathname = new Map()
  let privateCount = 0
  let unrecognized = 0
  for (const row of rows) {
    const w9 = parseW9Note(row.notes)
    if (w9?.pathname) {
      privateCount++
      continue
    }
    if (!w9?.legacyPublicUrl) {
      unrecognized++
      continue
    }
    let url
    try {
      url = new URL(w9.legacyPublicUrl)
    } catch {
      unrecognized++
      continue
    }
    if (!url.hostname.endsWith('.public.blob.vercel-storage.com')) {
      unrecognized++
      continue
    }
    const pathname = decodeURIComponent(url.pathname).replace(/^\//, '')
    if (!byPathname.has(pathname)) byPathname.set(pathname, [])
    byPathname.get(pathname).push(row)
  }
  return { byPathname, privateCount, unrecognized }
}

async function listPublicW9() {
  const blobs = new Map()
  let cursor
  do {
    const page = await list({ prefix: 'w9/', cursor, limit: 1000, token: PUBLIC_TOKEN })
    for (const b of page.blobs) blobs.set(b.pathname, b)
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  return blobs
}

// Returns the number of failures (0 = success).
export async function run(argv) {
  const { APPLY, DELETE_PUBLIC } = parseArgs(argv)
  PUBLIC_TOKEN = requireEnv('BLOB_READ_WRITE_TOKEN')
  PRIVATE_TOKEN = requireEnv('PRIVATE_BLOB_READ_WRITE_TOKEN')
  if (PUBLIC_TOKEN === PRIVATE_TOKEN) {
    throw new UsageError('BLOB_READ_WRITE_TOKEN and PRIVATE_BLOB_READ_WRITE_TOKEN are the same store. Aborting.')
  }
  db = createClient(requireEnv('HANDLD_SUPABASE_URL'), requireEnv('HANDLD_SUPABASE_SERVICE_ROLE_KEY'), {
    db: { schema: 'handld' },
    auth: { persistSession: false }
  })

  const mode = DELETE_PUBLIC ? (APPLY ? 'apply + delete-public' : 'delete-public') : APPLY ? 'apply' : 'dry run'
  console.log(`Mode: ${mode}`)

  const rows = await loadW9Rows()
  const { byPathname, privateCount, unrecognized } = indexLegacyRows(rows)
  const publicBlobs = await listPublicW9()

  const legacyRowCount = [...byPathname.values()].reduce((n, r) => n + r.length, 0)
  const referenced = [...publicBlobs.keys()].filter(p => byPathname.has(p))
  const orphans = [...publicBlobs.keys()].filter(p => !byPathname.has(p))
  const missing = [...byPathname.keys()].filter(p => !publicBlobs.has(p))
  const missingRowCount = missing.reduce((n, p) => n + byPathname.get(p).length, 0)

  let privateCopies = 0
  for (const pathname of publicBlobs.keys()) {
    if (await get(pathname, { access: 'private', token: PRIVATE_TOKEN, useCache: false }).catch(() => null)) {
      privateCopies++
    }
  }

  console.log(`Technician rows with a W9 line:          ${rows.length}`)
  console.log(`  still pointing at a public URL:        ${legacyRowCount}`)
  console.log(`  already private:                       ${privateCount}`)
  console.log(`  unrecognized W9 value (skipped):       ${unrecognized}`)
  console.log(`  public URL but blob not found:         ${missingRowCount}`)
  console.log(`Public blobs under w9/:                  ${publicBlobs.size}`)
  console.log(`  referenced by a DB row:                ${referenced.length}`)
  console.log(`  not referenced (orphans):              ${orphans.length}`)
  console.log(`  already copied to private store:       ${privateCopies}`)

  let failures = 0

  if (APPLY) {
    let copied = 0
    let alreadyCopied = 0
    let rowsUpdated = 0
    let orphanIndex = 0
    for (const [pathname, blob] of publicBlobs) {
      const owners = byPathname.get(pathname) || []
      const label = owners.length ? `tech ${owners.map(r => r.id).join(',')}` : `orphan #${++orphanIndex}`
      try {
        const original = await readAll('public', blob.url)
        if (!original) throw Object.assign(new Error(), { code: 'PUBLIC_READ_FAILED' })

        const existing = await readAll('private', pathname).catch(() => null)
        if (existing) {
          if (!existing.bytes.equals(original.bytes)) {
            throw Object.assign(new Error(), { code: 'PRIVATE_COPY_DIFFERS' })
          }
          alreadyCopied++
        } else {
          await put(pathname, original.bytes, {
            access: 'private',
            token: PRIVATE_TOKEN,
            contentType: original.contentType || 'application/octet-stream',
            addRandomSuffix: false,
            allowOverwrite: false
          })
          const copy = await readAll('private', pathname)
          if (!copy || !copy.bytes.equals(original.bytes)) {
            throw Object.assign(new Error(), { code: 'VERIFY_FAILED' })
          }
          copied++
        }

        for (const row of owners) {
          // Only update if notes haven't changed since we read them
          const { data, error } = await db
            .from('technicians')
            .update({ notes: setW9InNotes(row.notes, pathname) })
            .eq('id', row.id)
            .eq('notes', row.notes)
            .select('id')
          if (error) throw error
          if (!data?.length) throw Object.assign(new Error(), { code: 'ROW_CHANGED' })
          rowsUpdated++
        }
      } catch (e) {
        failures++
        console.error(`  FAILED ${label}: ${errCode(e)}`)
      }
    }
    console.log(`Copied to private store and verified:    ${copied}`)
    console.log(`Already in private store and verified:   ${alreadyCopied}`)
    console.log(`Technician rows updated:                 ${rowsUpdated}`)
  }

  if (DELETE_PUBLIC) {
    // Re-read: only delete what no row points at any more
    const stillReferenced = indexLegacyRows(await loadW9Rows()).byPathname
    const current = await listPublicW9()
    let deleted = 0
    let skippedReferenced = 0
    let skippedUnverified = 0
    for (const [pathname, blob] of current) {
      if (stillReferenced.has(pathname)) {
        skippedReferenced++
        continue
      }
      try {
        const original = await readAll('public', blob.url)
        const copy = await readAll('private', pathname).catch(() => null)
        if (!original || !copy || !copy.bytes.equals(original.bytes)) {
          skippedUnverified++
          continue
        }
        await del(blob.url, { token: PUBLIC_TOKEN })
        deleted++
      } catch (e) {
        failures++
        console.error(`  FAILED delete: ${errCode(e)}`)
      }
    }
    console.log(`Public originals deleted:                ${deleted}`)
    console.log(`Skipped (a DB row still uses it):        ${skippedReferenced}`)
    console.log(`Skipped (no matching private copy):      ${skippedUnverified}`)
  }

  if (!APPLY && !DELETE_PUBLIC) {
    console.log('Dry run: nothing changed. Next: --apply, then --delete-public.')
  }
  if (failures) console.error(`${failures} failure(s).`)
  return failures
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2))
    .then(failures => process.exit(failures ? 1 : 0))
    .catch(e => {
      console.error(e instanceof UsageError ? e.message : `Aborted: ${errCode(e)}`)
      process.exit(e instanceof UsageError ? 2 : 1)
    })
}
