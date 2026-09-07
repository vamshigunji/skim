import { describe, expect, it } from 'vitest'
import { bibtex, citekeyFor, cslJson, latexCite, pandocCite } from './cite'

const paper = { title: 'Attention Is All You Need', authors_json: '["Ashish Vaswani","Noam Shazeer"]', year: 2017, doi: '10.1/x', venue: 'NeurIPS' }

describe('citekeyFor', () => {
  it('builds lastname year firstword and disambiguates against taken keys', () => {
    expect(citekeyFor(paper)).toBe('vaswani2017attention')
    expect(citekeyFor(paper, ['vaswani2017attention'])).toBe('vaswani2017attentiona')
  })
  it('falls back to the title word when there is no author, and never returns empty', () => {
    expect(citekeyFor({ ...paper, authors_json: '[]' })).toBe('attention2017')
    expect(citekeyFor({ title: null, authors_json: '[]', year: null, doi: null, venue: null })).toBe('paper')
  })
})

describe('citation forms', () => {
  it('renders BibTeX, CSL JSON, Pandoc, and LaTeX', () => {
    expect(bibtex('k', paper)).toBe('@article{k,\n  title = {Attention Is All You Need},\n  author = {Ashish Vaswani and Noam Shazeer},\n  year = {2017},\n  journal = {NeurIPS},\n  doi = {10.1/x},\n}')
    expect(JSON.parse(cslJson('k', paper))).toMatchObject({ id: 'k', author: [{ family: 'Vaswani', given: 'Ashish' }, { family: 'Shazeer' }], issued: { 'date-parts': [[2017]] }, DOI: '10.1/x' })
    expect(pandocCite('k', '4')).toBe('[@k, p. 4]')
    expect(pandocCite('k')).toBe('[@k]')
    expect(latexCite('k', '4')).toBe('\\cite[p.~4]{k}')
    expect(latexCite('k')).toBe('\\cite{k}')
  })
})
