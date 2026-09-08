// @vitest-environment node
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { openDb } from '../db'
import { importPdfs } from './library'
import { searchExact } from './search'

const fixture = resolve('e2e/fixtures/sample.pdf')
let db: DatabaseSync

beforeAll(async () => {
  db = openDb(':memory:')
  await importPdfs(db, [fixture])
})

describe('searchExact', () => {
  it('returns hits with paper, page index, printed label, and context', () => {
    const hits = searchExact(db, { query: 'attention', options: {} })
    expect(hits).toHaveLength(2)
    expect(hits[0]).toMatchObject({ title: 'Front matter', page_index: 1, label: '1173', match: 'attention' })
    expect(hits[0].before).toContain('dot-product')
    expect(hits[1]).toMatchObject({ page_index: 2, label: '1174' })
  })

  it('applies whole word and match case', () => {
    expect(searchExact(db, { query: 'Attention', options: { caseSensitive: true } })).toHaveLength(0)
    expect(searchExact(db, { query: 'head', options: { wholeWord: true } })).toHaveLength(1)
    expect(searchExact(db, { query: 'ead', options: { wholeWord: true } })).toHaveLength(0)
  })

  it('matches substrings inside words and phrases across spaces', () => {
    expect(searchExact(db, { query: 'ead att', options: {} })).toHaveLength(1)
    expect(searchExact(db, { query: 'ATTENTION', options: {} })).toHaveLength(2)
    expect(searchExact(db, { query: 'at', options: {} }).length).toBeGreaterThan(0)
  })

  it('supports regex', () => {
    expect(searchExact(db, { query: 'Multi-?head', options: { regex: true } })).toHaveLength(1)
  })

  it('restricts to one document by path', () => {
    expect(searchExact(db, { query: 'attention', options: {}, path: fixture })).toHaveLength(2)
    expect(searchExact(db, { query: 'attention', options: {}, path: '/nope.pdf' })).toHaveLength(0)
  })

  it('returns nothing for a term not in the library', () => {
    expect(searchExact(db, { query: 'zzz', options: {} })).toEqual([])
  })
})
