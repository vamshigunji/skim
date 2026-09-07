// @vitest-environment node
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AskDelta } from '../../../shared/types/ai'
import { openDb } from '../../db'
import { importPdfs } from '../library'
import { askGrounded, buildPassages, listThread } from './ask'
import { startFakeServer } from './fake-server'
import { createKeychain } from './keys'
import { createAiService } from './service'

const fixture = resolve('e2e/fixtures/sample.pdf')
const codec = { encryptString: (s: string) => Buffer.from(s), decryptString: (b: Buffer) => b.toString() }
let fake: Awaited<ReturnType<typeof startFakeServer>>
beforeAll(async () => (fake = await startFakeServer()))
afterAll(() => fake.close())

async function setup(model: string) {
  const db = openDb(':memory:')
  await importPdfs(db, [fixture])
  const ai = createAiService(db, createKeychain(mkdtempSync(join(tmpdir(), 'skim-ask-')), codec), () => {})
  await ai.setProvider({ id: 'openai', kind: 'openai', base_url: fake.url, model, enabled: 1, is_default: 1 })
  ai.setKey('openai', 'sk-test')
  ai.confirmEgress('openai')
  return { db, ai }
}
const run = async (db: ReturnType<typeof openDb>, ai: Awaited<ReturnType<typeof setup>>['ai'], question: string, opts?: { charBudget?: number }) => {
  const deltas: AskDelta[] = []
  await new Promise<void>((done) => {
    askGrounded(db, ai, { requestId: 'q1', path: fixture, question }, (d) => {
      deltas.push(d)
      if (d.type === 'done' || d.type === 'error') done()
    }, opts)
  })
  return deltas
}
const text = (ds: AskDelta[]) => ds.filter((d) => d.type === 'text').map((d) => (d as { text: string }).text).join('')

describe('buildPassages', () => {
  const pages = [
    { index: 0, text: 'Front matter' },
    { index: 1, text: 'Scaled dot-product attention' },
    { index: 2, text: 'Multi-head attention' },
  ]
  it('passes the whole paper when it fits the budget', () => {
    expect(buildPassages(pages, 'anything', 10_000)).toMatchObject({ mode: 'full', empty: false })
    expect(buildPassages(pages, 'anything', 10_000).passages.map((p) => p.n)).toEqual([1, 2, 3])
  })
  it('retrieves pages by exact term hits when it does not fit, and reports emptiness', () => {
    const r = buildPassages(pages, 'multi-head attention', 20)
    expect(r.mode).toBe('retrieved')
    expect(r.passages.map((p) => p.pageIndex)).toEqual([1, 2])
    expect(r.passages[0].n).toBe(2)
    expect(buildPassages(pages, 'quantum gravity', 20)).toMatchObject({ mode: 'retrieved', empty: true })
  })
})

describe('askGrounded', () => {
  it('streams text with verified and rejected citations, ends PARTIAL, and persists the thread', async () => {
    const { db, ai } = await setup('grounded-model')
    const deltas = await run(db, ai, 'How is attention computed?')
    expect(text(deltas)).toContain('scaled dot products')
    const cites = deltas.filter((d) => d.type === 'citation').map((d) => (d as { citation: unknown }).citation)
    expect(cites).toEqual([
      { n: 1, pageIndex: 1, quote: 'Scaled dot-product attention', verified: true },
      { n: 2, pageIndex: 1, quote: 'this quote does not exist', verified: false },
    ])
    expect(deltas.find((d) => d.type === 'state')).toEqual({ type: 'state', state: 'PARTIAL', verified: 1, total: 2 })
    const thread = listThread(db, fixture)
    expect(thread.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(thread[1].citations.map((c) => c.verified)).toEqual([true, false])
    expect(db.prepare('SELECT verified, verify_method FROM citations ORDER BY ordinal').all()).toEqual([
      { verified: 1, verify_method: 'exact' },
      { verified: 0, verify_method: 'none' },
    ])
  })
  it('reports NOT_FOUND when the model says so', async () => {
    const { db, ai } = await setup('notfound-model')
    const deltas = await run(db, ai, 'What is the sample size?')
    expect(deltas.find((d) => d.type === 'state')).toMatchObject({ state: 'NOT_FOUND', total: 0 })
  })
  it('does not call the model when retrieval finds nothing', async () => {
    const { db, ai } = await setup('grounded-model')
    const before = fake.calls.length
    const deltas = await run(db, ai, 'quantum gravity', { charBudget: 20 })
    expect(fake.calls.length).toBe(before)
    expect(deltas.find((d) => d.type === 'state')).toMatchObject({ state: 'NOT_FOUND' })
    expect(text(deltas)).toMatch(/does not appear to contain/)
  })
})
