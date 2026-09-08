import type { DatabaseSync } from 'node:sqlite'
import type { createAiService } from './service'

export interface ChunkHit {
  id: string
  attachment_id: string
  page_start: number
  text: string
}

export const cosine = (a: Float32Array, b: Float32Array) => {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

// Reciprocal rank fusion, k = 60 (design/04). Ids ranked by summed 1 / (k + rank) across lists.
export function rrf(lists: string[][], k = 60): string[] {
  const score = new Map<string, number>()
  for (const list of lists) list.forEach((id, i) => score.set(id, (score.get(id) ?? 0) + 1 / (k + i + 1)))
  return [...score].sort((a, b) => b[1] - a[1]).map(([id]) => id)
}

const ftsQuery = (q: string) =>
  q
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2)
    .map((w) => `"${w}"`)
    .join(' OR ')

// Hybrid retrieval over the scope's chunks: BM25 catches exact terms, cosine catches paraphrase, fused by RRF. Semantic is best effort:
// missing embeddings are computed on demand and any failure (no embed model, AI off, unconfirmed egress) falls back to exact-only with the reason.
export async function hybridRetrieve(db: DatabaseSync, ai: ReturnType<typeof createAiService>, attachmentIds: string[], question: string) {
  if (!attachmentIds.length) return { chunks: [] as ChunkHit[], semantic: 'no indexed papers in scope' }
  const marks = attachmentIds.map(() => '?').join(',')
  const q = ftsQuery(question)
  const exact = q
    ? (db.prepare(`SELECT c.id FROM chunks_fts f JOIN chunks c ON c.rowid = f.rowid WHERE chunks_fts MATCH ? AND c.attachment_id IN (${marks}) ORDER BY bm25(chunks_fts) LIMIT 40`).all(q, ...attachmentIds) as { id: string }[]).map((r) => r.id)
    : []

  let semanticIds: string[] = []
  let semantic = 'on'
  try {
    const probe = await ai.embed([question])
    const missing = db.prepare(`SELECT c.id, c.text FROM chunks c LEFT JOIN embeddings e ON e.chunk_id = c.id AND e.model = ? WHERE c.attachment_id IN (${marks}) AND e.chunk_id IS NULL`).all(probe.model, ...attachmentIds) as { id: string; text: string }[]
    const ins = db.prepare('INSERT OR REPLACE INTO embeddings (chunk_id, model, dims, vector) VALUES (?,?,?,?)')
    for (let i = 0; i < missing.length; i += 32) {
      const batch = missing.slice(i, i + 32)
      const { vectors } = await ai.embed(batch.map((c) => c.text || ' '))
      batch.forEach((c, k) => ins.run(c.id, probe.model, vectors[k].length, Buffer.from(vectors[k].buffer)))
    }
    const rows = db.prepare(`SELECT e.chunk_id id, e.vector FROM embeddings e JOIN chunks c ON c.id = e.chunk_id WHERE e.model = ? AND c.attachment_id IN (${marks})`).all(probe.model, ...attachmentIds) as { id: string; vector: Uint8Array }[]
    const qv = probe.vectors[0]
    semanticIds = rows
      .map((r) => ({ id: r.id, s: cosine(qv, new Float32Array(r.vector.buffer, r.vector.byteOffset, r.vector.byteLength / 4)) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 40)
      .map((r) => r.id)
  } catch (e) {
    semantic = `off (${(e as Error).message})`
  }

  const ids = rrf([exact, semanticIds]).slice(0, 12)
  if (!ids.length) return { chunks: [] as ChunkHit[], semantic }
  const byId = new Map((db.prepare(`SELECT id, attachment_id, page_start, text FROM chunks WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids) as unknown as ChunkHit[]).map((c) => [c.id, c]))
  return { chunks: ids.map((id) => byId.get(id)!), semantic }
}
