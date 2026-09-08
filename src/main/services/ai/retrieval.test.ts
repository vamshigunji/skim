// @vitest-environment node
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { openDb } from '../../db'
import { importPdfs } from '../library'
import { startFakeServer } from './fake-server'
import { createKeychain } from './keys'
import { cosine, hybridRetrieve, rrf } from './retrieval'
import { createAiService } from './service'

const fixtures = [resolve('e2e/fixtures/sample.pdf'), resolve('e2e/fixtures/cited.pdf')]
const codec = { encryptString: (s: string) => Buffer.from(s), decryptString: (b: Buffer) => b.toString() }
let fake: Awaited<ReturnType<typeof startFakeServer>>
beforeAll(async () => (fake = await startFakeServer()))
afterAll(() => fake.close())

async function setup(kind: 'openai' | 'anthropic') {
  const db = openDb(':memory:')
  await importPdfs(db, fixtures)
  const ai = createAiService(db, createKeychain(mkdtempSync(join(tmpdir(), 'skim-ret-')), codec), () => {})
  await ai.setProvider({ id: kind, kind, base_url: fake.url, model: 'x', enabled: 1, is_default: 1 })
  ai.setKey(kind, 'sk-test')
  ai.confirmEgress(kind)
  const attachments = (db.prepare('SELECT id FROM attachments').all() as { id: string }[]).map((r) => r.id)
  return { db, ai, attachments }
}

describe('fusion', () => {
  it('rrf ranks ids present in both lists first', () => {
    expect(rrf([['a', 'b', 'c'], ['c', 'd']])).toEqual(['c', 'a', 'b', 'd'])
  })
  it('cosine is 1 for parallel vectors and 0 for orthogonal or empty', () => {
    expect(cosine(Float32Array.of(1, 2), Float32Array.of(2, 4))).toBeCloseTo(1)
    expect(cosine(Float32Array.of(1, 0), Float32Array.of(0, 1))).toBe(0)
    expect(cosine(Float32Array.of(0, 0), Float32Array.of(0, 1))).toBe(0)
  })
})

describe('hybridRetrieve', () => {
  it('fuses BM25 and cosine over page chunks, embedding missing chunks once', async () => {
    const { db, ai, attachments } = await setup('openai')
    const calls = fake.calls.length
    const r = await hybridRetrieve(db, ai, attachments, 'scaled dot-product attention')
    expect(r.semantic).toBe('on')
    expect(r.chunks[0].text).toBe('Scaled dot-product attention')
    expect(new Set(r.chunks.map((c) => c.attachment_id)).size).toBe(2)
    expect(db.prepare('SELECT count(*) n FROM embeddings').get()?.n).toBe(5)
    const again = await hybridRetrieve(db, ai, attachments, 'scaled dot-product attention')
    expect(again.chunks[0].id).toBe(r.chunks[0].id)
    expect(fake.calls.slice(calls).filter((c) => c.url === '/v1/embeddings')).toHaveLength(3) // probe, one batch, probe
  })
  it('falls back to exact-only with the reason when the provider cannot embed', async () => {
    const { db, ai, attachments } = await setup('anthropic')
    const r = await hybridRetrieve(db, ai, attachments, 'multi-head attention')
    expect(r.semantic).toMatch(/^off \(Anthropic has no embedding models/)
    expect(r.chunks.map((c) => c.text)).toContain('Multi-head attention')
    expect(db.prepare('SELECT count(*) n FROM embeddings').get()?.n).toBe(0)
  })
})
