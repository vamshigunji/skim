import type { Paper } from './types/db'

type Bib = Pick<Paper, 'title' | 'authors_json' | 'year' | 'doi' | 'venue'>
const authors = (p: Bib): string[] => JSON.parse(p.authors_json || '[]')
const word = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]/g, '').split(' ').find((w) => w.length > 2) || 'paper'

// Default pattern {lastname}{year}{firstword} (features/05 requirement 8). No author: the title word stands in, so a key always exists.
export function citekeyFor(p: Bib, taken: Iterable<string> = []): string {
  const last = authors(p)[0]?.split(' ').at(-1) ?? ''
  const first = word(p.title ?? '')
  const base = `${last ? word(last) : first}${p.year ?? ''}${last ? first : ''}`
  const used = new Set(taken)
  let key = base
  for (let i = 0; used.has(key); i++) key = base + String.fromCharCode(97 + i)
  return key
}

const field = (k: string, v: string | number | null | undefined) => (v ? `  ${k} = {${v}},\n` : '')

export const bibtex = (key: string, p: Bib) =>
  `@article{${key},\n${field('title', p.title)}${field('author', authors(p).join(' and '))}${field('year', p.year)}${field('journal', p.venue)}${field('doi', p.doi)}}`

export const cslJson = (key: string, p: Bib) =>
  JSON.stringify(
    {
      id: key,
      type: 'article-journal',
      title: p.title,
      author: authors(p).map((a) => ({ family: a.split(' ').at(-1), given: a.split(' ').slice(0, -1).join(' ') })),
      issued: p.year ? { 'date-parts': [[p.year]] } : undefined,
      'container-title': p.venue ?? undefined,
      DOI: p.doi ?? undefined,
    },
    null,
    2,
  )

export const pandocCite = (key: string, page?: string | null) => (page ? `[@${key}, p. ${page}]` : `[@${key}]`)
export const latexCite = (key: string, page?: string | null) => (page ? `\\cite[p.~${page}]{${key}}` : `\\cite{${key}}`)
