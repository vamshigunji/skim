// @vitest-environment node
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { openDb } from '../../db'
import { importPdfs } from '../library'
import { startFakeServer } from './fake-server'
import { createKeychain } from './keys'
import { createAiService } from './service'
import { listSkim, runSkim } from './skim'

const fixture = resolve('e2e/fixtures/sample.pdf')
const codec = { encryptString: (s: string) => Buffer.from(s), decryptString: (b: Buffer) => b.toString() }
let fake: Awaited<ReturnType<typeof startFakeServer>>
beforeAll(async () => (fake = await startFakeServer()))
afterAll(() => fake.close())

describe('runSkim', () => {
  it('keeps only verified quotes, stores them per model, replaces on rerun, and drops them when the model changes', async () => {
    const db = openDb(':memory:')
    await importPdfs(db, [fixture])
    const ai = createAiService(db, createKeychain(mkdtempSync(join(tmpdir(), 'skim-skim-')), codec), () => {})
    await ai.setProvider({ id: 'openai', kind: 'openai', base_url: fake.url, model: 'skim-model', enabled: 1, is_default: 1 })
    ai.setKey('openai', 'sk-test')
    ai.confirmEgress('openai')

    const items = await runSkim(db, ai, { requestId: 's1', path: fixture })
    expect(items).toMatchObject([
      { pageIndex: 1, label: 'method', quote: 'Scaled dot-product attention', confidence: 0.9 },
      { pageIndex: 2, label: 'result', quote: 'Multi-head attention', confidence: 0.8 },
    ])
    expect(listSkim(db, fixture)).toEqual(items)

    await runSkim(db, ai, { requestId: 's2', path: fixture })
    expect(db.prepare('SELECT count(*) n FROM skim_overlays').get()?.n).toBe(2)

    await ai.setProvider({ id: 'openai', kind: 'openai', base_url: fake.url, model: 'other-model', enabled: 1, is_default: 1 })
    expect(listSkim(db, fixture)).toEqual([])
  })
})
