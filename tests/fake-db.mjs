// Minimal stand-in for the Supabase query builder used by the W-9 routes.
export function createFakeDb(technicians) {
  const calls = { updates: [] }

  function from(table) {
    if (table !== 'technicians') throw new Error(`unexpected table ${table}`)
    const filters = []
    let pendingUpdate = null

    const builder = {
      select() { return builder },
      eq(col, val) { filters.push([col, val]); return builder },
      update(fields) { pendingUpdate = fields; return builder },
      async maybeSingle() {
        const row = technicians.find(t => filters.every(([c, v]) => t[c] === v))
        return { data: row ? { ...row } : null, error: null }
      },
      then(resolve, reject) {
        if (pendingUpdate) {
          calls.updates.push({ filters: [...filters], fields: pendingUpdate })
          for (const t of technicians) {
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
