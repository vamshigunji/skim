import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import type { LibraryItem } from '../../shared/types/library'
import { Library } from './Library'

const items: LibraryItem[] = [
  { paper_id: 'p1', title: 'Scaling laws', year: 2020, reading_status: 'skimming', page_count: 21, stage: 'ready', skip_reason: null, error: null, path: '/a.pdf', page_labels_json: null, updated_at: 2 },
  { paper_id: 'p2', title: 'Old scan', year: null, reading_status: 'to_read', page_count: 7, stage: 'skipped', skip_reason: 'no_text_layer', error: null, path: '/b.pdf', page_labels_json: null, updated_at: 1 },
]

let host: HTMLElement
const onOpen = vi.fn()
const onImport = vi.fn()

beforeEach(async () => {
  document.body.innerHTML = ''
  host = document.body.appendChild(document.createElement('div'))
  await act(async () => createRoot(host).render(<Library items={items} onOpen={onOpen} onImport={onImport} />))
})

describe('Library', () => {
  it('lists papers with title, year, and reading status', () => {
    expect(host.textContent).toContain('Scaling laws')
    expect(host.textContent).toContain('2020')
    expect(host.textContent).toMatch(/SKIMMING/)
  })

  it('shows index status counts and a plain-language reason for skipped files', () => {
    const panel = host.querySelector('[data-testid="index-status"]')!
    expect(panel.textContent).toMatch(/Ready\s*1/)
    expect(panel.textContent).toMatch(/Skipped\s*1/)
    expect(panel.textContent).toContain('no text layer')
  })

  it('opens a paper on click', async () => {
    const row = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Scaling laws'))!
    await act(async () => row.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(onOpen).toHaveBeenCalledWith('p1')
  })

  it('shows the drop zone when the library is empty', async () => {
    await act(async () => createRoot(host).render(<Library items={[]} onOpen={onOpen} onImport={onImport} />))
    expect(host.textContent).toContain('Drop PDFs here')
  })
})
