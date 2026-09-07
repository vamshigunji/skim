import type { DatabaseSync, SQLInputValue } from 'node:sqlite'

// Minimal typed access for tables keyed by `id`. Domain queries live beside the feature that needs them.
export function table<T extends { id: string }>(db: DatabaseSync, name: string) {
  const q = `"${name}"`
  return {
    insert(row: T) {
      const cols = Object.keys(row)
      db.prepare(`INSERT INTO ${q} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...(Object.values(row) as SQLInputValue[]))
    },
    get: (id: string) => db.prepare(`SELECT * FROM ${q} WHERE id = ?`).get(id) as T | undefined,
    update(id: string, patch: Partial<T>) {
      const cols = Object.keys(patch)
      db.prepare(`UPDATE ${q} SET ${cols.map((c) => `${c} = ?`).join(',')} WHERE id = ?`).run(...(Object.values(patch) as SQLInputValue[]), id)
    },
    remove: (id: string) => db.prepare(`DELETE FROM ${q} WHERE id = ?`).run(id),
    list: (where = '1', params: SQLInputValue[] = []) => db.prepare(`SELECT * FROM ${q} WHERE ${where}`).all(...params) as T[],
  }
}
