// @vitest-environment node
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openDb } from '../db'
import { applyProposal, createProposal, listProposals, rejectProposal, undoProposal } from './proposals'

const seed = (db: ReturnType<typeof openDb>) => db.prepare("INSERT INTO papers (id, title, year, created_at, updated_at) VALUES ('p1', 'Old title', 2016, 0, 0)").run()
const items = [
  { paperId: 'p1', op: 'set_field' as const, slot: 'title', after: 'New title', confidence: 0.9, evidence: 'Model judgement: heading' },
  { paperId: 'p1', op: 'set_field' as const, slot: 'year', after: 2017, confidence: 0.4, evidence: 'Model judgement: footer' },
  { paperId: 'p1', op: 'add_tag' as const, slot: 'transformers', after: true, confidence: 0.85, evidence: 'Model judgement: method' },
]
const title = (db: ReturnType<typeof openDb>) => db.prepare("SELECT title FROM papers WHERE id = 'p1'").get()?.title
const tags = (db: ReturnType<typeof openDb>) => db.prepare("SELECT t.name FROM paper_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.paper_id = 'p1'").all().map((r) => r.name)

describe('proposals', () => {
  it('records before values, flags stale items, applies only the selected ones atomically with a journal, and rejects the rest', () => {
    const db = openDb(':memory:')
    seed(db)
    const id = createProposal(db, { origin: 'ai', title: 'Fix metadata', model: 'fake', items })
    let [p] = listProposals(db)
    expect(p).toMatchObject({ id, status: 'pending', title: 'Fix metadata', model: 'fake' })
    expect(p.items.map((i) => [i.slot, i.before, i.after, i.stale])).toEqual([
      ['title', 'Old title', 'New title', false],
      ['year', 2016, 2017, false],
      ['transformers', false, true, false],
    ])

    db.prepare("UPDATE papers SET year = 2015 WHERE id = 'p1'").run() // someone edited in between
    ;[p] = listProposals(db)
    expect(p.items[1]).toMatchObject({ stale: true, current: 2015 })

    expect(applyProposal(db, id, p.items.map((i) => i.id))).toEqual({ applied: 2, stale: 1 })
    expect(title(db)).toBe('New title')
    expect(tags(db)).toEqual(['transformers'])
    expect(db.prepare("SELECT year FROM papers WHERE id = 'p1'").get()?.year).toBe(2015)
    ;[p] = listProposals(db)
    expect(p.status).toBe('partially_applied')
    expect(p.items.map((i) => i.status)).toEqual(['applied', 'stale', 'applied'])
    expect(db.prepare('SELECT before_json, after_json FROM edit_journal ORDER BY rowid').all()).toEqual([
      { before_json: '"Old title"', after_json: '"New title"' },
      { before_json: 'false', after_json: 'true' },
    ])

    rejectProposal(db, id)
    expect(listProposals(db)).toEqual([])
  })

  it('undo restores journaled values, survives a restart, refuses a conflicting value unless forced, and appends rather than deletes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'skim-prop-'))
    let db = openDb(join(dir, 'lib.db'))
    seed(db)
    const id = createProposal(db, { origin: 'ai', title: 'Fix', items: items.slice(0, 1).concat(items.slice(2)) })
    applyProposal(db, id, listProposals(db)[0].items.map((i) => i.id))
    db.close()

    db = openDb(join(dir, 'lib.db'))
    db.prepare("UPDATE papers SET title = 'Hand edited' WHERE id = 'p1'").run()
    let r = undoProposal(db, id)
    expect(r).toEqual({ undone: 1, conflicts: [{ itemId: expect.any(String), slot: 'title', current: 'Hand edited', journaled: 'New title' }] })
    expect(tags(db)).toEqual([])
    expect(title(db)).toBe('Hand edited')
    r = undoProposal(db, id, true)
    expect(r).toEqual({ undone: 1, conflicts: [] })
    expect(title(db)).toBe('Old title')
    expect(listProposals(db)[0].status).toBe('undone')
    expect(db.prepare('SELECT count(*) n FROM edit_journal').get()?.n).toBe(4)
    expect(db.prepare('SELECT count(*) n FROM edit_journal WHERE undone_at IS NULL').get()?.n).toBe(0)
    db.close()
  })
})
