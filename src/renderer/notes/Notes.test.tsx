import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import type { NoteView } from '../../shared/export'
import { Notes } from './Notes'

const note = (id: string, paper_id: string, text: string, page_label: string): NoteView => ({
  id, attachment_id: 'a', page_index: 1, kind: 'highlight', rects_json: '[]', color: '#E0AF68', text, comment: null, label: null, hidden: 0, source: 'user', created_at: 1, updated_at: 1,
  paper_id, title: `Paper ${paper_id}`, citekey: `key${paper_id}`, page_label,
})
const notes = [note('n1', 'p1', 'Scaled dot-product attention', '1173'), note('n2', 'p1', 'Multi-head attention', '1174'), note('n3', 'p2', 'Front matter', 'i')]
const onExport = vi.fn()
const onCopy = vi.fn()
const onOpen = vi.fn()
const paper = vi.fn(async () => ({ id: 'p1', title: 'Paper p1', authors_json: '[]', year: 2017, venue: null, doi: null, arxiv_id: null, abstract: null, citekey: 'keyp1', reading_status: 'to_read' as const, external_ids_json: '{}', metadata_source: 'extracted' as const, created_at: 0, updated_at: 0 }))
const click = (el: Element) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
let host: HTMLElement

beforeEach(async () => {
  document.body.innerHTML = ''
  host = document.body.appendChild(document.createElement('div'))
  await act(async () => createRoot(host).render(<Notes notes={notes} receipt="" onOpen={onOpen} onExport={onExport} onCopy={onCopy} paper={paper} />))
})

describe('Notes', () => {
  it('groups notes by paper with page labels and citekeys', () => {
    expect(host.querySelectorAll('[data-testid="notes-paper"]')).toHaveLength(2)
    expect(host.textContent).toContain('p. 1173')
    expect(host.textContent).toContain('@keyp1')
  })
  it('exports the whole paper by default and only the picked notes once some are checked', async () => {
    const buttons = () => [...host.querySelectorAll('button')].filter((b) => b.textContent?.startsWith('EXPORT'))
    expect(buttons()[0].textContent).toContain('EXPORT 2 NOTES')
    await click(buttons()[0])
    expect(onExport).toHaveBeenLastCalledWith('p1', ['n1', 'n2'], 'pandoc')
    await click(host.querySelector('input[aria-label="Select note Multi-head attention"]')!)
    expect(buttons()[0].textContent).toContain('EXPORT 1 NOTE ')
    await click(buttons()[0])
    expect(onExport).toHaveBeenLastCalledWith('p1', ['n2'], 'pandoc')
  })
  it('copies citation forms and opens the source page', async () => {
    await click(host.querySelector('button[aria-label="Copy \\\\CITE for keyp1"]')!)
    expect(onCopy).toHaveBeenCalledWith('\\cite{keyp1}')
    await click(host.querySelector('button[aria-label="Copy BIBTEX for keyp1"]')!)
    expect(onCopy).toHaveBeenLastCalledWith(expect.stringContaining('@article{keyp1,'))
    await click([...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Front matter'))!)
    expect(onOpen).toHaveBeenCalledWith('p2', 1)
  })
})
