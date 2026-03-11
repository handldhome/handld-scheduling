import { createClient } from '@supabase/supabase-js'

// Supabase client for Handld Home database (handld schema)
// Uses service_role key — server-side only
// Lazy-initialized to avoid build-time errors when env vars aren't available

let _db = null

export function getDb() {
  if (!_db) {
    _db = createClient(
      process.env.HANDLD_SUPABASE_URL,
      process.env.HANDLD_SUPABASE_SERVICE_ROLE_KEY,
      { db: { schema: 'handld' } }
    )
  }
  return _db
}
