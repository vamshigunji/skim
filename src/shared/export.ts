import { latexCite, pandocCite } from './cite'
import type { Annotation, Paper } from './types/db'

// One row of the notes panel: an annotation with the paper and page it came from.
export interface NoteView extends Annotation {
  paper_id: string
  title: string | null
  citekey: string
  page_label: string | null
}

export type CiteStyle = 'pandoc' | 'latex'

export const BEGIN = '<!-- skim:begin -->'
export const END = '<!-- skim:end -->'

const fm = (k: string, v: unknown) => (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) ? '' : `${k}: ${JSON.stringify(v)}\n`)

// Markdown per paper: front matter, then one block per note with a page label, a skim:// deep link, the citation, and a stable id marker.
export function renderMarkdown(paper: Pick<Paper, 'id' | 'title' | 'authors_json' | 'year' | 'doi'>, citekey: string, notes: NoteView[], style: CiteStyle) {
  const cite = style === 'latex' ? latexCite : pandocCite
  const body = notes
    .map((n) => {
      const page = n.page_label ?? `#${n.page_index + 1}`
      const lines = [`<!-- skim:${n.id} -->`, `> ${(n.text ?? '').replace(/\n/g, ' ')}`]
      if (n.comment) lines.push('', n.comment)
      lines.push('', `${cite(citekey, page)} · [p. ${page}](skim://paper/${paper.id}?page=${n.page_index})`)
      return lines.join('\n')
    })
    .join('\n\n')
  return `---\n${fm('title', paper.title)}${fm('authors', JSON.parse(paper.authors_json || '[]'))}${fm('year', paper.year)}${fm('doi', paper.doi)}citekey: ${citekey}\n---\n\n# ${paper.title ?? citekey}\n\n${BEGIN}\n${body}\n${END}\n`
}

// Re-export replaces only the marked block, so user text around it survives and nothing duplicates (features/07 requirement 8).
export function mergeExport(existing: string | null, generated: string) {
  if (!existing) return generated
  const a = existing.indexOf(BEGIN)
  const b = existing.indexOf(END)
  if (a < 0 || b < a) return existing.trimEnd() + '\n\n' + generated.slice(generated.indexOf(BEGIN))
  const block = generated.slice(generated.indexOf(BEGIN), generated.indexOf(END) + END.length)
  return existing.slice(0, a) + block + existing.slice(b + END.length)
}
