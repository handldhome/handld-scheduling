// Minimal stand-in for the Supabase query builder used by the routes under test.
// createFakeDb([...technicians]) or createFakeDb({ technicians: [...], jobs: [...] })
//
// Supports the small subset of PostgREST chaining the routes use: select,
// eq/is/not/lt/gte filters, order/limit (no-ops), update, insert, upsert,
// maybeSingle/single, and awaiting the builder (then) for lists and writes.
let nextId = 1

export function createFakeDb(tablesOrTechs) {
  const tables = Array.isArray(tablesOrTechs) ? { technicians: tablesOrTechs } : tablesOrTechs
  const calls = { updates: [], reads: [], inserts: [], upserts: [] }

  function matches(row, filters) {
    return filters.every(([col, op, val]) => {
      const v = row[col]
      switch (op) {
        case 'eq': return v === val
        case 'is': return val === null ? (v === null || v === undefined) : v === val
        case 'not_is': return val === null ? !(v === null || v === undefined) : v !== val
        case 'lt': return v !== null && v !== undefined && v < val
        case 'gte': return v !== null && v !== undefined && v >= val
        default: return true
      }
    })
  }

  function from(table) {
    const rows = tables[table]
    if (!rows) throw new Error(`unexpected table ${table}`)
    calls.reads.push(table)
    const filters = []
    let pendingUpdate = null
    let pendingInsert = null
    let pendingUpsert = null
    let selectOpts = null

    const builder = {
      select(_cols, opts) { selectOpts = opts || null; return builder },
      eq(col, val) { filters.push([col, 'eq', val]); return builder },
      is(col, val) { filters.push([col, 'is', val]); return builder },
      not(col, op, val) { filters.push([col, op === 'is' ? 'not_is' : `not_${op}`, val]); return builder },
      lt(col, val) { filters.push([col, 'lt', val]); return builder },
      gte(col, val) { filters.push([col, 'gte', val]); return builder },
      order() { return builder },
      limit() { return builder },
      update(fields) { pendingUpdate = fields; return builder },
      insert(row) { pendingInsert = Array.isArray(row) ? row : [row]; return builder },
      upsert(row) { pendingUpsert = Array.isArray(row) ? row : [row]; return builder },
      async maybeSingle() {
        const { data } = await builder.then(x => x)
        return { data: Array.isArray(data) ? (data[0] ? { ...data[0] } : null) : data, error: null }
      },
      async single() {
        const res = await builder.maybeSingle()
        if (!res.data) return { data: null, error: { message: 'no rows' } }
        return res
      },
      then(resolve, reject) {
        let out = { data: null, error: null }
        if (pendingUpdate) {
          calls.updates.push({ table, filters: [...filters], fields: pendingUpdate })
          const hit = []
          for (const t of rows) {
            if (matches(t, filters)) { Object.assign(t, pendingUpdate); hit.push({ ...t }) }
          }
          out = { data: hit, error: null }
        } else if (pendingInsert) {
          const made = pendingInsert.map(r => ({ id: r.id || `fake-${table}-${nextId++}`, ...r }))
          rows.push(...made)
          calls.inserts.push({ table, rows: made })
          out = { data: made, error: null }
        } else if (pendingUpsert) {
          for (const r of pendingUpsert) {
            const existing = rows.find(x => x.phone !== undefined && x.phone === r.phone)
            if (existing) Object.assign(existing, r)
            else rows.push({ ...r })
          }
          calls.upserts.push({ table, rows: pendingUpsert })
          out = { data: null, error: null }
        } else {
          const hit = rows.filter(r => matches(r, filters)).map(r => ({ ...r }))
          out = selectOpts?.head ? { data: null, count: hit.length, error: null } : { data: hit, count: hit.length, error: null }
        }
        return Promise.resolve(out).then(resolve, reject)
      }
    }
    return builder
  }

  return { db: { from }, calls, tables }
}
