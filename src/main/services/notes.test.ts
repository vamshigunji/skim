// @vitest-environment node
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openDb } from '../db'
import { upsertAnnotation } from './annotations'
import { importPdfs } from './library'
import { exportMarkdown, listNotes, paperWithCitekey } from './notes'

const fixture = resolve('e2e/fixtures/sample.pdf')
const note = (id: string, page_index: number, text: string) => ({ id, page_index, kind: 'highlight' as const, rects_json: '[]', color: '#E0AF68', text, comment: null, label: null, hidden: 0 })

describe('notes', () => {
  it('lists notes with page labels and a stable citekey, exports Markdown, and re-exports without duplicates', async () => {
    const db = openDb(':memory:')
    const [{ paperId }] = await importPdfs(db, [fixture])
    upsertAnnotation(db, fixture, note('n1', 1, 'Scaled dot-product attention'))
    upsertAnnotation(db, fixture, note('n2', 2, 'Multi-head attention'))

    const notes = listNotes(db)
    expect(notes.map((n) => [n.id, n.page_label, n.citekey])).toEqual([
      ['n1', '1173', notes[0].citekey],
      ['n2', '1174', notes[0].citekey],
    ])
    expect(paperWithCitekey(db, paperId).citekey).toBe(notes[0].citekey)
    expect(notes[0].citekey).toMatch(/^[a-z0-9]+$/)

    const path = join(mkdtempSync(join(tmpdir(), 'skim-notes-')), 'out.md')
    expect(exportMarkdown(db, { paperId, ids: ['n1'], style: 'pandoc', path })).toEqual({ path, count: 1 })
    const first = readFileSync(path, 'utf8')
    expect(first).toContain(`[@${notes[0].citekey}, p. 1173]`)
    expect(first).toContain('<!-- skim:n1 -->')
    exportMarkdown(db, { paperId, style: 'latex', path })
    const second = readFileSync(path, 'utf8')
    expect(second.match(/<!-- skim:n1 -->/g)).toHaveLength(1)
    expect(second).toContain('<!-- skim:n2 -->')
    expect(second).toContain(`\\cite[p.~1174]{${notes[0].citekey}}`)
  })
})
