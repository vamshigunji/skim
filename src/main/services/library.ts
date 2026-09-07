import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { ImportResult, LibraryItem } from '../../shared/types/library'
import { extractMetadata } from './metadata'

const MAX_BYTES = 200 * 1024 * 1024

async function probe(data: Buffer) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise
  const pages: { text: string; width: number; height: number }[] = []
  let titleGuess: { str: string; height: number } | null = null
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const { width, height } = page.getViewport({ scale: 1 })
    const items = (await page.getTextContent()).items.filter((it) => 'str' in it)
    pages.push({ text: items.map((it) => it.str + (it.hasEOL ? '\n' : '')).join(''), width, height })
    if (i === 1) for (const it of items) if (it.str.trim() && it.height > (titleGuess?.height ?? 0)) titleGuess = it
  }
  const { info } = await doc.getMetadata()
  return { numPages: doc.numPages, labels: await doc.getPageLabels(), info: info as Record<string, unknown>, pages, titleGuess: titleGuess?.str.trim() ?? null }
}

export async function importPdfs(db: DatabaseSync, paths: string[]): Promise<ImportResult[]> {
  const results: ImportResult[] = []
  for (const path of paths) {
    const data = readFileSync(path)
    const sha256 = createHash('sha256').update(data).digest('hex')
    const dup = db.prepare('SELECT paper_id FROM attachments WHERE sha256 = ?').get(sha256)
    if (dup) {
      results.push({ path, status: 'duplicate', paperId: dup.paper_id as string })
      continue
    }
    const paperId = randomUUID()
    const attachmentId = randomUUID()
    const now = Date.now()
    let title = basename(path, '.pdf')
    let meta: Partial<ReturnType<typeof extractMetadata>> = {}
    let p: Awaited<ReturnType<typeof probe>> | null = null
    let status: { stage: string; skip_reason: string | null; error: string | null } = { stage: 'ready', skip_reason: null, error: null }
    if (data.length > MAX_BYTES) status = { stage: 'skipped', skip_reason: 'too_large', error: null }
    else
      try {
        p = await probe(data)
        meta = extractMetadata({ pages: p.pages.slice(0, 2).map((x) => x.text), info: p.info, filename: path, titleGuess: p.titleGuess })
        title = meta.title!
        if (!p.pages.some((x) => x.text.trim())) status = { stage: 'skipped', skip_reason: 'no_text_layer', error: null }
      } catch (e) {
        const err = e as Error
        status = err.name === 'PasswordException' ? { stage: 'skipped', skip_reason: 'encrypted', error: null } : { stage: 'failed', skip_reason: 'parse_error', error: err.message }
      }

    db.exec('BEGIN')
    db.prepare('INSERT INTO papers (id, title, doi, arxiv_id, year, created_at, updated_at) VALUES (?,?,?,?,?,?,?)').run(paperId, title, meta.doi ?? null, meta.arxiv_id ?? null, meta.year ?? null, now, now)
    db.prepare('INSERT INTO attachments (id, paper_id, path, sha256, page_count, page_labels_json, has_text_layer) VALUES (?,?,?,?,?,?,?)').run(
      attachmentId, paperId, path, sha256, p?.numPages ?? null, p ? JSON.stringify(p.labels) : null, status.stage === 'ready' ? 1 : 0,
    )
    if (status.stage === 'ready' && p) {
      const ins = db.prepare('INSERT INTO pages (attachment_id, page_index, text, width_pt, height_pt) VALUES (?,?,?,?,?)')
      p.pages.forEach((pg, i) => ins.run(attachmentId, i, pg.text, pg.width, pg.height))
    }
    db.prepare('INSERT INTO index_status (attachment_id, stage, skip_reason, error, attempts, extractor, updated_at) VALUES (?,?,?,?,1,?,?)').run(
      attachmentId, status.stage, status.skip_reason, status.error, p ? 'pdfjs' : null, now,
    )
    db.exec('COMMIT')
    results.push({ path, status: 'imported', paperId })
  }
  return results
}

export const listLibrary = (db: DatabaseSync) =>
  db
    .prepare(
      `SELECT p.id paper_id, p.title, p.year, p.reading_status, p.updated_at, a.path, a.page_count, a.page_labels_json, s.stage, s.skip_reason, s.error
       FROM papers p LEFT JOIN attachments a ON a.paper_id = p.id LEFT JOIN index_status s ON s.attachment_id = a.id
       ORDER BY p.updated_at DESC`,
    )
    .all() as unknown as LibraryItem[]

export function openPaper(db: DatabaseSync, paperId: string) {
  const path = db.prepare('SELECT path FROM attachments WHERE paper_id = ? LIMIT 1').get(paperId)?.path as string | undefined
  return path ? { path, data: readFileSync(path) } : null
}
