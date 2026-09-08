import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import type { ProposalView } from '../../shared/proposals'
import { Proposals } from './Proposals'

const item = (id: string, slot: string, before: unknown, after: unknown, confidence: number, stale = false): ProposalView['items'][number] => ({
  id, paperId: 'p1', paperTitle: 'Paper', op: typeof after === 'boolean' ? 'add_tag' : 'set_field', slot, before, after, current: stale ? 'changed' : before, confidence, evidence: 'Model judgement: heading', status: 'pending', stale,
})
const pending: ProposalView = { id: 'pr1', origin: 'ai', title: 'Suggested fixes', model: 'fake', status: 'pending', created_at: 0, items: [item('i1', 'title', 'Old', 'New', 0.9), item('i2', 'transformers', false, true, 0.6), item('i3', 'year', 2016, 2017, 0.95, true)] }
const applied: ProposalView = { ...pending, id: 'pr2', status: 'applied', items: [{ ...item('i4', 'title', 'Old', 'New', 0.9), status: 'applied' }] }
const onApply = vi.fn()
const onUndo = vi.fn()
const click = (el: Element) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
let host: HTMLElement
const render = (conflict: string | null = null) =>
  act(async () => createRoot(host).render(<Proposals proposals={[pending, applied]} note="" conflict={conflict} onApply={onApply} onReject={() => {}} onUndo={onUndo} onDismiss={() => {}} />))

beforeEach(async () => {
  document.body.innerHTML = ''
  host = document.body.appendChild(document.createElement('div'))
  await render()
})

describe('Proposals', () => {
  it('shows a diff per item with evidence, preselects confident non-stale items, and warns on stale ones', () => {
    const rows = host.querySelectorAll('[data-testid="proposal-item"]')
    expect(rows).toHaveLength(3)
    expect(rows[0].querySelector('s')?.textContent).toBe('Old')
    expect(rows[0].textContent).toContain('→ New')
    expect(rows[0].textContent).toContain('Model judgement: heading')
    expect([...rows].map((r) => r.querySelector<HTMLInputElement>('input')!.checked)).toEqual([true, false, false])
    expect(rows[2].textContent).toContain('STALE')
  })
  it('approves the checked items only', async () => {
    await click(host.querySelector('input[aria-label="Apply tag “transformers”"]')!)
    await click([...host.querySelectorAll('button')].find((b) => b.textContent?.startsWith('APPROVE'))!)
    expect(onApply).toHaveBeenCalledWith('pr1', ['i1', 'i2'])
  })
  it('offers undo on applied proposals and a forced restore on conflict', async () => {
    await click([...host.querySelectorAll('button')].find((b) => b.textContent === 'UNDO')!)
    expect(onUndo).toHaveBeenCalledWith('pr2')
    document.body.innerHTML = ''
    host = document.body.appendChild(document.createElement('div'))
    await render('pr2')
    await click([...host.querySelectorAll('button')].find((b) => b.textContent === 'RESTORE ANYWAY')!)
    expect(onUndo).toHaveBeenLastCalledWith('pr2', true)
  })
})
