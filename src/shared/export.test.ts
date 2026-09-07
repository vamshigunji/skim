import { describe, expect, it } from 'vitest'
import { mergeExport, renderMarkdown, type NoteView } from './export'

const paper = { id: 'p1', title: 'Attention Is All You Need', authors_json: '[]', year: 2017, doi: null }
const note = (id: string, text: string, comment: string | null = null): NoteView => ({
  id, attachment_id: 'a', page_index: 1, kind: 'highlight', rects_json: '[]', color: '#E0AF68', text, comment, label: null, hidden: 0, source: 'user', created_at: 1, updated_at: 1,
  paper_id: 'p1', title: paper.title, citekey: 'attention2017', page_label: '1173',
})

describe('renderMarkdown', () => {
  it('writes front matter, quotes, comments, citations, deep links, and id markers', () => {
    const md = renderMarkdown(paper, 'attention2017', [note('n1', 'Scaled dot-product attention', 'Why scale?')], 'pandoc')
    expect(md).toContain('---\ntitle: "Attention Is All You Need"\nyear: 2017\ncitekey: attention2017\n---')
    expect(md).toContain('<!-- skim:n1 -->\n> Scaled dot-product attention\n\nWhy scale?\n\n[@attention2017, p. 1173] · [p. 1173](skim://paper/p1?page=1)')
    expect(renderMarkdown(paper, 'attention2017', [note('n1', 'q')], 'latex')).toContain('\\cite[p.~1173]{attention2017}')
  })
})

describe('mergeExport', () => {
  const one = renderMarkdown(paper, 'attention2017', [note('n1', 'first')], 'pandoc')
  const two = renderMarkdown(paper, 'attention2017', [note('n1', 'first'), note('n2', 'second')], 'pandoc')
  it('is idempotent and keeps user text outside the block', () => {
    expect(mergeExport(one, one)).toBe(one)
    const edited = one.replace('# Attention', 'My intro.\n\n# Attention') + '\nMy closing thoughts.\n'
    const merged = mergeExport(edited, two)
    expect(merged).toContain('My intro.')
    expect(merged).toContain('My closing thoughts.')
    expect(merged.match(/<!-- skim:n1 -->/g)).toHaveLength(1)
    expect(merged).toContain('<!-- skim:n2 -->')
  })
  it('appends the block to a file without markers', () => {
    const merged = mergeExport('# Hand-written\n', one)
    expect(merged.startsWith('# Hand-written\n')).toBe(true)
    expect(merged).toContain('<!-- skim:n1 -->')
  })
})
