import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import type { LibraryItem } from '../../shared/types/library'
import type { SearchHit } from '../../shared/types/search'
import { Library } from './Library'

const items: LibraryItem[] = [
  { paper_id: 'p1', title: 'Scaling laws', year: 2020, reading_status: 'skimming', page_count: 21, stage: 'ready', skip_reason: null, error: null, path: '/a.pdf', page_labels_json: null, updated_at: 2 },
  { paper_id: 'p2', title: 'Old scan', year: null, reading_status: 'to_read', page_count: 7, stage: 'skipped', skip_reason: 'no_text_layer', error: null, path: '/b.pdf', page_labels_json: null, updated_at: 1 },
]

const hits: SearchHit[] = [
  { paper_id: 'p1', title: 'Scaling laws', page_index: 3, label: '4', before: 'the ', match: 'loss', after: ' curve' },
  { paper_id: 'p1', title: 'Scaling laws', page_index: 9, label: '10', before: 'test ', match: 'loss', after: ' drops' },
]

let host: HTMLElement
const onOpen = vi.fn()
const onImport = vi.fn()
const onSearch = vi.fn()

const render = (props: Partial<Parameters<typeof Library>[0]> = {}) =>
  act(async () => createRoot(host).render(<Library items={items} results={null} onOpen={onOpen} onImport={onImport} onSearch={onSearch} {...props} />))

const type = async (input: HTMLInputElement, value: string) => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

beforeEach(async () => {
  document.body.innerHTML = ''
  host = document.body.appendChild(document.createElement('div'))
  await render()
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
    await render({ items: [] })
    expect(host.textContent).toContain('Drop PDFs here')
  })

  it('runs an exact search on Enter and shows hits grouped by paper with page labels', async () => {
    const input = host.querySelector<HTMLInputElement>('input[placeholder="Search papers…"]')!
    await type(input, 'loss')
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(onSearch).toHaveBeenCalledWith('loss')
    await render({ results: hits })
    const results = host.querySelector('[data-testid="search-results"]')!
    expect(results.textContent).toContain('Scaling laws')
    expect(results.textContent).toMatch(/p\. 4/)
    expect(results.textContent).toMatch(/p\. 10/)
    expect(results.textContent).toContain('curve')
    const hit = [...results.querySelectorAll('button')].find((b) => b.textContent?.includes('p. 10'))!
    await act(async () => hit.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(onOpen).toHaveBeenCalledWith('p1', 9)
  })
})
