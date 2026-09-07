import { describe, expect, it } from 'vitest'
import { normalize, verifyQuote } from './verify'

const pages = [
  { index: 0, text: 'Front matter' },
  { index: 1, text: 'We use scaled dot-product atten-\ntion with “soft” eﬃcient   masks.' },
  { index: 2, text: 'Multi-head attention' },
]

describe('normalize', () => {
  it('collapses whitespace, joins hyphenated line breaks, maps ligatures and curly quotes, lowercases', () => {
    expect(normalize('Scaled  Dot-Product atten-\ntion “soft” eﬃcient ﬁne')).toBe('scaled dot-product attention "soft" efficient fine')
  })
})

describe('verifyQuote', () => {
  it('finds an exact quote on the preferred page', () => {
    expect(verifyQuote('scaled dot-product attention', pages, 1)).toEqual({ pageIndex: 1 })
  })
  it('accepts a match on another page and re-points the citation', () => {
    expect(verifyQuote('Multi-head attention', pages, 1)).toEqual({ pageIndex: 2 })
  })
  it('matches through ligatures, curly quotes, and hyphenation', () => {
    expect(verifyQuote('with "soft" efficient masks', pages, 1)).toEqual({ pageIndex: 1 })
  })
  it('rejects near misses instead of fuzzy matching', () => {
    expect(verifyQuote('scaled dot product attentions', pages, 1)).toBeNull()
    expect(verifyQuote('this quote does not exist', pages, 1)).toBeNull()
    expect(verifyQuote('', pages, 1)).toBeNull()
  })
})
