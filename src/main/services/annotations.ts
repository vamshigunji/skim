import type { DatabaseSync } from 'node:sqlite'
import type { AnnotationInput } from '../../shared/annot'
import type { Annotation } from '../../shared/types/db'

export const listAnnotations = (db: DatabaseSync, path: string) =>
  db
    .prepare('SELECT n.* FROM annotations n JOIN attachments a ON a.id = n.attachment_id WHERE a.path = ? ORDER BY n.page_index, n.created_at')
    .all(path) as unknown as Annotation[]

export function upsertAnnotation(db: DatabaseSync, path: string, a: AnnotationInput) {
  const attachment = db.prepare('SELECT id FROM attachments WHERE path = ?').get(path)?.id
  if (!attachment) throw new Error(`No attachment for ${path}`)
  const now = Date.now()
  db.prepare(
    `INSERT INTO annotations (id, attachment_id, page_index, kind, rects_json, color, text, comment, label, hidden, source, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,'user',?,?)
     ON CONFLICT(id) DO UPDATE SET page_index = excluded.page_index, kind = excluded.kind, rects_json = excluded.rects_json, color = excluded.color,
       text = excluded.text, comment = excluded.comment, label = excluded.label, hidden = excluded.hidden, updated_at = excluded.updated_at`,
  ).run(a.id, attachment, a.page_index, a.kind, a.rects_json, a.color, a.text, a.comment, a.label, a.hidden, now, now)
}

export const deleteAnnotation = (db: DatabaseSync, id: string) => db.prepare('DELETE FROM annotations WHERE id = ?').run(id)
