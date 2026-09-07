import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { findMentions } from '../../shared/mentions'
import type { ParsedReference, ReferenceView, RegionView } from '../../shared/types/references'

const HEADING = /^\s*(References|Bibliography|Works Cited)\s*$/gim

// Body text before the bibliography heading, and the heading position, searched from the last page back.
function splitAtBibliography(pages: string[]) {
  for (let p = pages.length - 1; p >= 0; p--) {
    const m = [...pages[p].matchAll(HEADING)].at(-1)
    if (m) return { body: [...pages.slice(0, p), pages[p].slice(0, m.index)], page: p, offset: m.index + m[0].length }
  }
  return { body: pages, page: -1, offset: 0 }
}

function parse(raw: string): ParsedReference {
  const authors = raw.match(/^(.*?\b[A-Za-z]{2,}\.)\s+(.*)$/)
  const surnames = (authors?.[1] ?? '')
    .split(/,|\band\b|&/)
    .map((s) => s.trim().replace(/\.$/, '').split(/\s+/).filter((w) => w.replace('.', '').length >= 2).at(-1))
    .filter((s): s is string => !!s)
  return {
    surnames,
    title: authors?.[2].split(/\.\s+|\.$/)[0] || null,
    year: Number([...raw.matchAll(/\b(19|20)\d{2}\b/g)].at(-1)?.[0]) || null,
    doi: raw.match(/\b10\.\d{4,9}\/[^\s"<>]+/)?.[0].replace(/[.,;)]+$/, '').toLowerCase() ?? null,
    arxiv_id: raw.match(/arXiv:\s*(\d{4}\.\d{4,5})/i)?.[1] ?? null,
  }
}

export function extractReferences(pages: string[]) {
  const { page, offset } = splitAtBibliography(pages)
  if (page < 0) return []
  const lines = pages.slice(page).flatMap((t, i) => (i === 0 ? t.slice(offset) : t).split('\n').map((text) => text.trim()).filter(Boolean))
  const entries: { ordinal: number; label: string | null; raw: string }[] = []
  let numbered = false
  for (const line of lines) {
    const m = line.match(/^\[(\d+)\]\s*/) ?? line.match(/^(\d+)\.\s+/)
    if (m) {
      numbered = true
      entries.push({ ordinal: +m[1], label: m[0].trim(), raw: line.slice(m[0].length) })
    } else if (!numbered && /^[A-Z][A-Za-z'’-]+,\s/.test(line)) entries.push({ ordinal: entries.length + 1, label: null, raw: line })
    else if (entries.length) entries.at(-1)!.raw += ' ' + line
  }
  return entries.map((e) => ({ ...e, parsed: parse(e.raw) }))
}

type Item = { str: string; x: number; y: number; w: number; h: number }

// Caption and equation-label heuristics over positioned text. Rects are 0-1 fractions from the top-left.
export function extractRegions(pages: { items: Item[]; width: number; height: number }[]) {
  const out: Omit<RegionView, 'id'>[] = []
  pages.forEach(({ items, width: W, height: H }, page_index) => {
    const line = (it: Item) => items.filter((o) => Math.abs(o.y - it.y) < 2).map((o) => o.str).join(' ').trim()
    const rect = (top: number, bottom: number) => JSON.stringify({ x: 0.08, y: Math.max(0, top), w: 0.84, h: Math.min(1, bottom) - Math.max(0, top) })
    for (const it of items) {
      const cap = it.str.match(/^(Figure|Fig\.|Table)\s+(\d+[a-z]?|[IVX]+)[.:]/)
      if (cap) {
        const table = cap[1] === 'Table'
        out.push({
          kind: table ? 'table' : 'figure',
          label: cap[2],
          page_index,
          rect_json: table ? rect(1 - (it.y + it.h + 2) / H, 1 - (it.y - 0.3 * H) / H) : rect(1 - (it.y + it.h + 0.4 * H) / H, 1 - (it.y - 6) / H),
          text: line(it),
        })
      } else if (/^\(\d+[a-z]?\)$/.test(it.str) && it.x + it.w > 0.75 * W) {
        out.push({ kind: 'equation', label: it.str.slice(1, -1), page_index, rect_json: rect(1 - (it.y + 2 * it.h) / H, 1 - (it.y - it.h) / H), text: line(it) })
      }
    }
  })
  return out
}

export function insertReferences(db: DatabaseSync, paperId: string, attachmentId: string, refs: ReturnType<typeof extractReferences>, regions: ReturnType<typeof extractRegions>) {
  const ref = db.prepare('INSERT INTO "references" (id, paper_id, ordinal, label, raw, parsed_json) VALUES (?,?,?,?,?,?)')
  for (const r of refs) ref.run(randomUUID(), paperId, r.ordinal, r.label, r.raw, JSON.stringify(r.parsed))
  const reg = db.prepare('INSERT INTO regions (id, attachment_id, page_index, kind, rect_json, label, text) VALUES (?,?,?,?,?,?,?)')
  for (const r of regions) reg.run(randomUUID(), attachmentId, r.page_index, r.kind, r.rect_json, r.label, r.text)
}

const norm = (s: string | null) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

export function listReferences(db: DatabaseSync, path: string): ReferenceView[] {
  const att = db.prepare('SELECT id, paper_id FROM attachments WHERE path = ?').get(path)
  if (!att) return []
  const pages = (db.prepare('SELECT text FROM pages WHERE attachment_id = ? ORDER BY page_index').all(att.id) as { text: string }[]).map((r) => r.text)
  const { body, page: bibPage } = splitAtBibliography(pages)
  const mentions = body.flatMap((t) => findMentions(t)).filter((m) => m.kind === 'cite').flatMap((m) => m.keys)
  const papers = db.prepare('SELECT id, title, doi, arxiv_id FROM papers WHERE id != ?').all(att.paper_id) as { id: string; title: string | null; doi: string | null; arxiv_id: string | null }[]
  const rows = db.prepare('SELECT id, ordinal, label, raw, parsed_json FROM "references" WHERE paper_id = ? ORDER BY ordinal').all(att.paper_id) as unknown as Omit<ReferenceView, 'page_index' | 'mentions' | 'library_paper_id'>[]
  return rows.map((r) => {
    const p = JSON.parse(r.parsed_json) as ParsedReference
    const keys = new Set([String(r.ordinal), ...p.surnames.map((s) => `${s.toLowerCase()}:${p.year}`)])
    const match = papers.find((x) => (p.doi && x.doi === p.doi) || (p.arxiv_id && x.arxiv_id === p.arxiv_id) || (p.title && norm(x.title) === norm(p.title)))
    const page_index = pages.findIndex((t, i) => i >= bibPage && t.includes(r.raw.slice(0, 40)))
    return { ...r, page_index: page_index < 0 ? bibPage : page_index, mentions: mentions.filter((k) => keys.has(k)).length, library_paper_id: match?.id ?? null }
  })
}

export const listRegions = (db: DatabaseSync, path: string) =>
  db
    .prepare('SELECT r.id, r.kind, r.label, r.page_index, r.rect_json, r.text FROM regions r JOIN attachments a ON a.id = r.attachment_id WHERE a.path = ? ORDER BY r.page_index')
    .all(path) as unknown as RegionView[]
