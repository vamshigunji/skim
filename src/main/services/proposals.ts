import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { PAPER_FIELDS, type ProposalItemView, type ProposalView, type ProposedItem, type UndoResult } from '../../shared/proposals'

// The only write path from a model to papers or tags (design/06 guarantee 1). Every apply re-reads the live value and journals it.

const current = (db: DatabaseSync, it: { paperId: string; op: string; slot: string }): unknown => {
  if (it.op === 'set_field') return (db.prepare(`SELECT ${it.slot} v FROM papers WHERE id = ?`).get(it.paperId)?.v as unknown) ?? null
  return !!db.prepare('SELECT 1 FROM paper_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.paper_id = ? AND t.name = ?').get(it.paperId, it.slot)
}

const write = (db: DatabaseSync, it: { paperId: string; op: string; slot: string }, value: unknown) => {
  if (it.op === 'set_field') return db.prepare(`UPDATE papers SET ${it.slot} = ?, updated_at = ? WHERE id = ?`).run(value as string | number | null, Date.now(), it.paperId)
  const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(it.slot)?.id as string | undefined
  if (!value) return tag && db.prepare('DELETE FROM paper_tags WHERE paper_id = ? AND tag_id = ?').run(it.paperId, tag)
  const id = tag ?? randomUUID()
  if (!tag) db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run(id, it.slot)
  db.prepare('INSERT OR IGNORE INTO paper_tags (paper_id, tag_id) VALUES (?, ?)').run(it.paperId, id)
}

const tx = <T>(db: DatabaseSync, fn: () => T): T => {
  db.exec('BEGIN')
  try {
    const r = fn()
    db.exec('COMMIT')
    return r
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export function createProposal(db: DatabaseSync, p: { origin: string; title: string; model?: string; items: ProposedItem[] }) {
  if (!p.items.length) throw new Error('A proposal needs at least one item.')
  for (const it of p.items) if (it.op === 'set_field' && !PAPER_FIELDS.includes(it.slot as (typeof PAPER_FIELDS)[number])) throw new Error(`Field ${it.slot} cannot be proposed.`) // slot reaches SQL
  const id = randomUUID()
  tx(db, () => {
    db.prepare('INSERT INTO proposals (id, kind, summary, model, status, created_at) VALUES (?,?,?,?,?,?)').run(id, p.origin, p.title, p.model ?? null, 'pending', Date.now())
    const ins = db.prepare('INSERT INTO proposal_items (id, proposal_id, target_table, target_id, op, slot, before_json, after_json, confidence, evidence, status) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    for (const it of p.items) ins.run(randomUUID(), id, 'papers', it.paperId, it.op, it.slot, JSON.stringify(current(db, it)), JSON.stringify(it.after), it.confidence, it.evidence, 'pending')
  })
  return id
}

type ItemRow = { id: string; target_id: string; op: ProposedItem['op']; slot: string; before_json: string; after_json: string; confidence: number; evidence: string; status: ProposalItemView['status']; title: string | null }

// Every proposal that is not rejected, newest first, with live values so stale items are flagged before apply (guarantee 8).
export function listProposals(db: DatabaseSync): ProposalView[] {
  const rows = db.prepare("SELECT id, kind, summary, model, status, created_at FROM proposals WHERE status != 'rejected' ORDER BY created_at DESC").all() as unknown as {
    id: string; kind: string; summary: string; model: string | null; status: ProposalView['status']; created_at: number
  }[]
  const items = db.prepare('SELECT i.*, p.title FROM proposal_items i LEFT JOIN papers p ON p.id = i.target_id WHERE i.proposal_id = ? ORDER BY i.rowid')
  return rows.map((r) => ({
    id: r.id,
    origin: r.kind,
    title: r.summary,
    model: r.model,
    status: r.status,
    created_at: r.created_at,
    items: (items.all(r.id) as unknown as ItemRow[]).map((i) => {
      const it = { paperId: i.target_id, op: i.op, slot: i.slot }
      const cur = current(db, it)
      const before = JSON.parse(i.before_json)
      return { id: i.id, ...it, paperTitle: i.title, before, after: JSON.parse(i.after_json), current: cur, confidence: i.confidence, evidence: i.evidence, status: i.status, stale: i.status === 'pending' && JSON.stringify(cur) !== JSON.stringify(before) }
    }),
  }))
}

// Applies exactly the selected pending items in one transaction; stale ones are skipped unless force (guarantees 4 and 8).
export function applyProposal(db: DatabaseSync, proposalId: string, itemIds: string[], force = false) {
  return tx(db, () => {
    let applied = 0
    let stale = 0
    const rows = db.prepare("SELECT * FROM proposal_items WHERE proposal_id = ? AND status = 'pending'").all(proposalId) as unknown as ItemRow[]
    for (const i of rows) {
      if (!itemIds.includes(i.id)) continue
      const it = { paperId: i.target_id, op: i.op, slot: i.slot }
      const live = current(db, it)
      if (!force && JSON.stringify(live) !== i.before_json) {
        db.prepare("UPDATE proposal_items SET status = 'stale' WHERE id = ?").run(i.id)
        stale++
        continue
      }
      write(db, it, JSON.parse(i.after_json))
      db.prepare('INSERT INTO edit_journal (id, proposal_item_id, applied_at, before_json, after_json) VALUES (?,?,?,?,?)').run(randomUUID(), i.id, Date.now(), JSON.stringify(live), i.after_json)
      db.prepare("UPDATE proposal_items SET status = 'applied' WHERE id = ?").run(i.id)
      applied++
    }
    const left = db.prepare("SELECT count(*) n FROM proposal_items WHERE proposal_id = ? AND status IN ('pending', 'stale')").get(proposalId)?.n as number
    db.prepare('UPDATE proposals SET status = ? WHERE id = ?').run(applied === 0 ? 'pending' : left ? 'partially_applied' : 'applied', proposalId)
    return { applied, stale }
  })
}

export const rejectProposal = (db: DatabaseSync, proposalId: string) =>
  tx(db, () => {
    db.prepare("UPDATE proposal_items SET status = 'rejected' WHERE proposal_id = ? AND status IN ('pending', 'stale')").run(proposalId)
    db.prepare("UPDATE proposals SET status = 'rejected' WHERE id = ?").run(proposalId)
  })

// Undo restores each journaled before value in reverse order and appends a reversing row. A value someone else changed since is never overwritten silently (guarantee 5).
export function undoProposal(db: DatabaseSync, proposalId: string, force = false): UndoResult {
  return tx(db, () => {
    const rows = db
      .prepare(
        `SELECT j.id, j.before_json, j.after_json, i.id item_id, i.target_id, i.op, i.slot FROM edit_journal j JOIN proposal_items i ON i.id = j.proposal_item_id
         WHERE i.proposal_id = ? AND j.undone_at IS NULL ORDER BY j.applied_at DESC, j.rowid DESC`,
      )
      .all(proposalId) as unknown as { id: string; before_json: string; after_json: string; item_id: string; target_id: string; op: ProposedItem['op']; slot: string }[]
    const result: UndoResult = { undone: 0, conflicts: [] }
    for (const j of rows) {
      const it = { paperId: j.target_id, op: j.op, slot: j.slot }
      const live = current(db, it)
      if (!force && JSON.stringify(live) !== j.after_json) {
        result.conflicts.push({ itemId: j.item_id, slot: j.slot, current: live, journaled: JSON.parse(j.after_json) })
        continue
      }
      write(db, it, JSON.parse(j.before_json))
      const now = Date.now()
      db.prepare('UPDATE edit_journal SET undone_at = ? WHERE id = ?').run(now, j.id)
      db.prepare('INSERT INTO edit_journal (id, proposal_item_id, applied_at, undone_at, before_json, after_json) VALUES (?,?,?,?,?,?)').run(randomUUID(), j.item_id, now, now, JSON.stringify(live), j.before_json)
      result.undone++
    }
    if (result.undone && !result.conflicts.length) db.prepare("UPDATE proposals SET status = 'undone' WHERE id = ?").run(proposalId)
    return result
  })
}
