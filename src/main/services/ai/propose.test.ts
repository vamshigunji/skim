// @vitest-environment node
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { openDb } from '../../db'
import { importPdfs } from '../library'
import { listProposals } from '../proposals'
import { startFakeServer } from './fake-server'
import { createKeychain } from './keys'
import { proposeEdits } from './propose'
import { createAiService } from './service'

const fixture = resolve('e2e/fixtures/sample.pdf')
const codec = { encryptString: (s: string) => Buffer.from(s), decryptString: (b: Buffer) => b.toString() }
let fake: Awaited<ReturnType<typeof startFakeServer>>
beforeAll(async () => (fake = await startFakeServer()))
afterAll(() => fake.close())

describe('proposeEdits', () => {
  it('turns model suggestions into a pending proposal with evidence, dropping ops outside the closed set, and writes nothing', async () => {
    const db = openDb(':memory:')
    const [{ paperId }] = await importPdfs(db, [fixture])
    const before = db.prepare('SELECT title FROM papers WHERE id = ?').get(paperId)?.title
    const ai = createAiService(db, createKeychain(mkdtempSync(join(tmpdir(), 'skim-prop-')), codec), () => {})
    await ai.setProvider({ id: 'openai', kind: 'openai', base_url: fake.url, model: 'propose-model', enabled: 1, is_default: 1 })
    ai.setKey('openai', 'sk-test')
    ai.confirmEgress('openai')

    const r = await proposeEdits(db, ai, { requestId: 'r1', paperId })
    expect(r).toEqual({ proposalId: expect.any(String) })
    const [p] = listProposals(db)
    expect(p).toMatchObject({ origin: 'ai', status: 'pending', model: 'propose-model on openai' })
    expect(p.items.map((i) => [i.op, i.slot, i.after, i.confidence, i.evidence])).toEqual([
      ['set_field', 'title', 'Attention Is All You Need', 0.9, 'Model judgement: The first page heading reads Attention Is All You Need'],
      ['add_tag', 'transformers', true, 0.6, 'Model judgement: Describes multi-head attention'],
    ])
    expect(db.prepare('SELECT title FROM papers WHERE id = ?').get(paperId)?.title).toBe(before)
    expect(db.prepare('SELECT count(*) n FROM paper_tags').get()?.n).toBe(0)
  })
})
