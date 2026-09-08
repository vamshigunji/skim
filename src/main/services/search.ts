import type { DatabaseSync } from 'node:sqlite'
import { labelsFor } from '../../shared/labels'
import { context, findHits } from '../../shared/search'
import type { SearchHit, SearchRequest } from '../../shared/types/search'

export function searchExact(db: DatabaseSync, { query, options, path }: SearchRequest): SearchHit[] {
  // Trigram FTS narrows to pages that contain the literal substring (case-insensitive superset); the regex below applies the exact options.
  const prefilter = !options.regex && query.length >= 3
  const rows = db
    .prepare(
      `SELECT pg.page_index, pg.text, p.id paper_id, p.title, a.page_labels_json, a.page_count
       FROM pages pg JOIN attachments a ON a.id = pg.attachment_id JOIN papers p ON p.id = a.paper_id
       WHERE ${path ? 'a.path = ?' : '1'} AND ${prefilter ? 'pg.rowid IN (SELECT rowid FROM pages_fts WHERE pages_fts MATCH ?)' : '1'}
       ORDER BY p.updated_at DESC, pg.page_index`,
    )
    .all(...(path ? [path] : []), ...(prefilter ? [`"${query.replace(/"/g, '""')}"`] : [])) as { page_index: number; text: string; paper_id: string; title: string | null; page_labels_json: string | null; page_count: number }[]
  const hits: SearchHit[] = []
  for (const r of rows) {
    const labels = labelsFor(JSON.parse(r.page_labels_json ?? 'null'), r.page_count)
    for (const h of findHits(r.text, query, options))
      hits.push({ paper_id: r.paper_id, title: r.title, page_index: r.page_index, label: labels[r.page_index] ?? `#${r.page_index + 1}`, ...context(r.text, h.index, h.length) })
  }
  return hits
}
