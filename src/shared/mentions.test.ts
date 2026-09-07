import { describe, expect, it } from 'vitest'
import { findMentions } from './mentions'

describe('findMentions', () => {
  it('finds numeric citations, expanding lists and ranges', () => {
    const m = findMentions('as shown in [1] and [3, 5-7].')
    expect(m.map((x) => x.keys)).toEqual([['1'], ['3', '5', '6', '7']])
    expect(m[0]).toMatchObject({ kind: 'cite', index: 12, length: 3 })
  })
  it('finds author-year citations in both forms', () => {
    const m = findMentions('studied by Kaplan et al. (2020) and (Smith and Jones, 2019).')
    expect(m.map((x) => x.keys)).toEqual([['kaplan:2020'], ['smith:2019']])
  })
  it('finds figure, table, and equation references', () => {
    const m = findMentions('Figure 1 shows the weights; see Eq. (1), Fig. 3b and Table II.')
    expect(m.map((x) => [x.kind, x.keys[0]])).toEqual([
      ['figure', '1'],
      ['equation', '1'],
      ['figure', '3b'],
      ['table', 'II'],
    ])
  })
  it('ignores plain brackets and years', () => {
    expect(findMentions('array[0] in 2020 was fine')).toEqual([])
  })
})
