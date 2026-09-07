import { describe, expect, it } from 'vitest'
import { findQuoteRange } from './locate'

const spans = (...texts: string[]) =>
  texts.map((t) => {
    const s = document.createElement('span')
    s.textContent = t
    return s
  })

describe('findQuoteRange', () => {
  it('locates a quote across span boundaries, ignoring case and spacing differences', () => {
    const els = spans('We use Scaled dot-', 'product Attention', ' with masks.')
    const r = findQuoteRange(els, 'scaled dot-product attention')!
    expect(r.start).toEqual({ node: els[0].firstChild, offset: 7 })
    expect(r.end).toEqual({ node: els[1].firstChild, offset: 17 })
  })
  it('returns null when the quote is absent', () => {
    expect(findQuoteRange(spans('nothing here'), 'attention')).toBeNull()
  })
})
