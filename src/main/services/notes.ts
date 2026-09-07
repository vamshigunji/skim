import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { DatabaseSync } from 'node:sqlite'
import { citekeyFor } from '../../shared/cite'
import { mergeExport, renderMarkdown, type CiteStyle, type NoteView } from '../../shared/export'
import { labelsFor } from '../../shared/labels'
import type { Paper } from '../../shared/types/db'

// Citekeys are generated on first use and then never regenerated (features/05 requirement 8).
export function paperWithCitekey(db: DatabaseSync, paperId: string): Paper {
  const p = db.prepare('SELECT * FROM papers WHERE id = ?').get(paperId) as unknown as Paper | undefined
  if (!p) throw new Error('Paper not found.')
  if (p.citekey) return p
  const taken = (db.prepare('SELECT citekey FROM papers WHERE citekey IS NOT NULL').all() as { citekey: string }[]).map((r) => r.citekey)
  p.citekey = citekeyFor(p, taken)
  db.prepare('UPDATE papers SET citekey = ? WHERE id = ?').run(p.citekey, p.id)
  return p
}

export function listNotes(db: DatabaseSync): NoteView[] {
  const rows = db
    .prepare(
      `SELECT n.*, p.id paper_id, p.title, a.page_labels_json, a.page_count
       FROM annotations n JOIN attachments a ON a.id = n.attachment_id JOIN papers p ON p.id = a.paper_id
       ORDER BY p.updated_at DESC, n.page_index, n.created_at`,
    )
    .all() as unknown as (NoteView & { page_labels_json: string | null; page_count: number })[]
  return rows.map(({ page_labels_json, page_count, ...n }) => ({
    ...n,
    citekey: paperWithCitekey(db, n.paper_id).citekey!,
    page_label: labelsFor(JSON.parse(page_labels_json ?? 'null'), page_count)[n.page_index],
  }))
}

export interface ExportRequest {
  paperId: string
  ids?: string[] // subset of annotation ids; all of the paper's notes when absent
  style: CiteStyle
  path: string
}

export function exportMarkdown(db: DatabaseSync, { paperId, ids, style, path }: ExportRequest) {
  const paper = paperWithCitekey(db, paperId)
  const notes = listNotes(db).filter((n) => n.paper_id === paperId && (!ids || ids.includes(n.id)))
  const generated = renderMarkdown(paper, paper.citekey!, notes, style)
  writeFileSync(path, mergeExport(existsSync(path) ? readFileSync(path, 'utf8') : null, generated))
  return { path, count: notes.length }
}
