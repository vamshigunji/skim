import { describe, expect, it } from 'vitest'
import { labelsFor, parseGoto } from './labels'

describe('labelsFor', () => {
  it('uses the PDF page labels when present', () => {
    expect(labelsFor(['i', '1173', '1174'], 3)).toEqual(['i', '1173', '1174'])
  })
  it('falls back to 1-based indices', () => {
    expect(labelsFor(null, 3)).toEqual(['1', '2', '3'])
  })
  it('applies a user offset: printed page 1 is PDF page N, earlier pages unlabeled', () => {
    expect(labelsFor(null, 4, 3)).toEqual([null, null, '1', '2'])
  })
})

describe('parseGoto', () => {
  const labels = ['i', '1173', '1174']
  it('matches a printed label first', () => expect(parseGoto('1173', labels)).toBe(1))
  it('treats # as a PDF index', () => expect(parseGoto('#3', labels)).toBe(2))
  it('falls back to a PDF index for a bare number with no matching label', () => expect(parseGoto('2', labels)).toBe(1))
  it('returns null for nonsense or out of range', () => {
    expect(parseGoto('zzz', labels)).toBeNull()
    expect(parseGoto('#9', labels)).toBeNull()
  })
})
