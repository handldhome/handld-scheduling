// Minimal stand-in for the Supabase query builder used by the routes under test.
// createFakeDb([...technicians]) or createFakeDb({ technicians: [...], jobs: [...] })
export function createFakeDb(tablesOrTechs) {
  const tables = Array.isArray(tablesOrTechs) ? { technicians: tablesOrTechs } : tablesOrTechs
  const calls = { updates: [], reads: [] }

  function from(table) {
    const rows = tables[table]
    if (!rows) throw new Error(`unexpected table ${table}`)
    calls.reads.push(table)
    const filters = []
    let pendingUpdate = null

    const builder = {
      select() { return builder },
      eq(col, val) { filters.push([col, val]); return builder },
      update(fields) { pendingUpdate = fields; return builder },
      async maybeSingle() {
        const row = rows.find(t => filters.every(([c, v]) => t[c] === v))
        return { data: row ? { ...row } : null, error: null }
      },
      then(resolve, reject) {
        if (pendingUpdate) {
          calls.updates.push({ table, filters: [...filters], fields: pendingUpdate })
          for (const t of rows) {
            if (filters.every(([c, v]) => t[c] === v)) Object.assign(t, pendingUpdate)
          }
        }
        return Promise.resolve({ data: null, error: null }).then(resolve, reject)
      }
    }
    return builder
  }

  return { db: { from }, calls }
}
