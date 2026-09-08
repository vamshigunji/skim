// @vitest-environment node
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { openDb } from '../db'
import { probe } from './extract'
import { createIndexer } from './indexer'

const sample = resolve('e2e/fixtures/sample.pdf')
const cited = resolve('e2e/fixtures/cited.pdf')

describe('indexer', () => {
  it('runs lower priority first, one file at a time, and notifies per file', async () => {
    const db = openDb(':memory:')
    const notify = vi.fn()
    let active = 0
    let overlap = false
    const extract = async (data: Buffer) => {
      overlap ||= ++active > 1
      const r = await probe(data)
      active--
      return r
    }
    const indexer = createIndexer(db, extract, notify)
    const [a, b] = await Promise.all([indexer.enqueue([sample], 40), indexer.enqueue([cited], 0)])
    expect(a[0]).toMatchObject({ path: sample, status: 'imported' })
    expect(b[0]).toMatchObject({ path: cited, status: 'imported' })
    expect(notify.mock.calls.map((c) => c[0].path)).toEqual([cited, sample])
    expect(overlap).toBe(false)
    expect(db.prepare('SELECT count(*) n FROM papers').get()?.n).toBe(2)
  })
  it('rejects only the failing job and keeps draining', async () => {
    const db = openDb(':memory:')
    const indexer = createIndexer(db, probe, () => {})
    const [bad, good] = await Promise.allSettled([indexer.enqueue(['/nope/missing.pdf']), indexer.enqueue([sample])])
    expect(bad.status).toBe('rejected')
    expect(good.status).toBe('fulfilled')
  })
})
