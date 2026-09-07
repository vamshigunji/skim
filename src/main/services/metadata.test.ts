// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { extractMetadata } from './metadata'

describe('extractMetadata', () => {
  it('finds DOI, arXiv id, and year in the first pages', () => {
    const m = extractMetadata({
      pages: ['Scaling Laws for Neural Language Models\nKaplan et al.\narXiv:2001.08361v1 [cs.LG] 23 Jan 2020\nhttps://doi.org/10.48550/arXiv.2001.08361'],
      info: {},
      filename: 'paper.pdf',
      titleGuess: 'Scaling Laws for Neural Language Models',
    })
    expect(m).toEqual({
      title: 'Scaling Laws for Neural Language Models',
      doi: '10.48550/arxiv.2001.08361',
      arxiv_id: '2001.08361',
      year: 2020,
    })
  })

  it('prefers the embedded title, then the layout guess, then the filename', () => {
    const base = { pages: [''], filename: 'my-great-paper.pdf' }
    expect(extractMetadata({ ...base, info: { Title: 'Embedded' }, titleGuess: 'Guess' }).title).toBe('Embedded')
    expect(extractMetadata({ ...base, info: {}, titleGuess: 'Guess' }).title).toBe('Guess')
    expect(extractMetadata({ ...base, info: {}, titleGuess: null }).title).toBe('my-great-paper')
  })

  it('reads an arXiv id from the filename and ignores implausible years', () => {
    const m = extractMetadata({ pages: ['page 1173 of volume 3000'], info: {}, filename: '2001.08361v2.pdf', titleGuess: null })
    expect(m.arxiv_id).toBe('2001.08361')
    expect(m.year).toBeNull()
    expect(m.doi).toBeNull()
  })
})
