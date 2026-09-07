import { beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { markMentions } from './mentions'
import { HoverCard } from './HoverCard'

let host: HTMLElement
beforeEach(() => {
  document.body.innerHTML = ''
  host = document.body.appendChild(document.createElement('div'))
})

describe('markMentions', () => {
  it('wraps citation and region references inside text-layer spans', () => {
    host.innerHTML = '<span>Transformers use attention [1].</span><span>Kaplan et al. (2020); see Eq. (1) and Table 1.</span>'
    markMentions(host)
    expect(host.querySelector('mark[data-ref="1"]')?.textContent).toBe('[1]')
    expect(host.querySelector('mark[data-ref="kaplan:2020"]')?.textContent).toBe('Kaplan et al. (2020)')
    expect(host.querySelector('mark[data-region="equation:1"]')?.textContent).toBe('Eq. (1)')
    expect(host.querySelector('mark[data-region="table:1"]')?.textContent).toBe('Table 1')
    expect(host.textContent).toBe('Transformers use attention [1].Kaplan et al. (2020); see Eq. (1) and Table 1.')
  })
})

describe('HoverCard', () => {
  const ref = { id: 'r1', ordinal: 1, label: '[1]', raw: '[1] A. Vaswani. Attention is all you need. NeurIPS, 2017.', parsed_json: '{"title":"Attention is all you need","year":2017,"surnames":["Vaswani"]}', page_index: 1, mentions: 1, library_paper_id: null }
  it('shows the parsed title, year, raw entry, and library status', async () => {
    await act(async () => createRoot(host).render(<HoverCard target={{ kind: 'cite', ref }} onJump={() => {}} onOpenPaper={() => {}} />))
    expect(host.textContent).toContain('Attention is all you need')
    expect(host.textContent).toContain('2017')
    expect(host.textContent).toContain('Not in library')
    expect(host.querySelector('button[aria-label="Open"]')).toBeNull()
  })
  it('offers Open when the reference matches a library paper', async () => {
    await act(async () => createRoot(host).render(<HoverCard target={{ kind: 'cite', ref: { ...ref, library_paper_id: 'p9' } }} onJump={() => {}} onOpenPaper={() => {}} />))
    expect(host.textContent).toContain('In library')
    expect(host.querySelector('button[aria-label="Open"]')).not.toBeNull()
  })
})
