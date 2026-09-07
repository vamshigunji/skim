import { describe, expect, it } from 'vitest'
import { context, findHits } from './search'

const text = 'We compare attention with attentional models. Scaled dot-product Attention wins.'

describe('findHits', () => {
  it('is case-insensitive by default and returns every occurrence', () => {
    expect(findHits(text, 'attention', {}).map((h) => h.index)).toEqual([11, 26, 65])
  })
  it('honors match case', () => {
    expect(findHits(text, 'Attention', { caseSensitive: true }).map((h) => h.index)).toEqual([65])
  })
  it('honors whole word', () => {
    expect(findHits(text, 'attention', { wholeWord: true }).map((h) => h.index)).toEqual([11, 65])
  })
  it('treats the query as a regex when asked and escapes it otherwise', () => {
    expect(findHits(text, 'dot.product', { regex: true })).toHaveLength(1)
    expect(findHits(text, 'dot.product', {})).toHaveLength(0)
    expect(findHits(text, 'dot-product', {})).toHaveLength(1)
  })
  it('returns nothing for an empty query or an invalid regex', () => {
    expect(findHits(text, '', {})).toEqual([])
    expect(findHits(text, '(', { regex: true })).toEqual([])
  })
})

describe('context', () => {
  it('gives up to 40 characters either side of the match', () => {
    const c = context('a'.repeat(100) + 'MATCH' + 'b'.repeat(100), 100, 5)
    expect(c).toEqual({ before: 'a'.repeat(40), match: 'MATCH', after: 'b'.repeat(40) })
  })
  it('clamps at the text boundaries', () => {
    expect(context('MATCH end', 0, 5)).toEqual({ before: '', match: 'MATCH', after: ' end' })
  })
})
