import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import type { Annotation } from '../../shared/types/db'
import { AnnotationLayer } from './AnnotationLayer'
import { AnnotationsPanel } from './AnnotationsPanel'

const base = { attachment_id: 'a', page_index: 0, source: 'user' as const, hidden: 0, label: null, comment: null, created_at: 1, updated_at: 1 }
const marks: Annotation[] = [
  { ...base, id: 'h1', kind: 'highlight', color: '#E0AF68', text: 'scaled dot', rects_json: '[{"x":0.1,"y":0.2,"w":0.5,"h":0.02},{"x":0.1,"y":0.23,"w":0.2,"h":0.02}]' },
  { ...base, id: 'u1', kind: 'underline', color: '#9ECE6A', text: 'softmax', rects_json: '[{"x":0.3,"y":0.5,"w":0.1,"h":0.02}]' },
]

let host: HTMLElement
const render = (ui: React.ReactNode) => act(async () => createRoot(host).render(ui))
const click = (el: Element) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))

beforeEach(() => {
  document.body.innerHTML = ''
  host = document.body.appendChild(document.createElement('div'))
})

describe('AnnotationLayer', () => {
  it('draws one box per rect using percentages, styled by kind and color', async () => {
    await render(<AnnotationLayer annotations={marks} selectedId={null} onSelect={() => {}} />)
    const boxes = host.querySelectorAll<HTMLElement>('[data-annotation-id="h1"]')
    expect(boxes).toHaveLength(2)
    expect(boxes[0].style.left).toBe('10%')
    expect(boxes[0].style.top).toBe('20%')
    expect(boxes[0].style.width).toBe('50%')
    expect(boxes[0].style.height).toBe('2%')
    expect(boxes[0].style.backgroundColor).not.toBe('')
    const u = host.querySelector<HTMLElement>('[data-annotation-id="u1"]')!
    expect(u.style.backgroundColor).toBe('')
    expect(u.style.borderBottom).toContain('2px')
  })
  it('selects on click and marks the selection', async () => {
    const onSelect = vi.fn()
    await render(<AnnotationLayer annotations={marks} selectedId="u1" onSelect={onSelect} />)
    await click(host.querySelector('[data-annotation-id="h1"]')!)
    expect(onSelect).toHaveBeenCalledWith('h1')
    expect(host.querySelector('[data-annotation-id="u1"]')!.getAttribute('aria-selected')).toBe('true')
  })
})

describe('AnnotationsPanel', () => {
  const palette = [
    { color: '#E0AF68', name: 'Yellow' },
    { color: '#9ECE6A', name: 'Green' },
  ]
  it('lists annotations and filters by color and kind', async () => {
    const onFilter = vi.fn()
    await render(<AnnotationsPanel annotations={marks} palette={palette} filter={{ colors: ['#9ECE6A'], kinds: [] }} selectedId={null} onFilter={onFilter} onSelect={() => {}} onComment={() => {}} />)
    expect(host.textContent).toContain('scaled dot')
    expect(host.textContent).not.toContain('softmax')
    const green = host.querySelector<HTMLInputElement>('input[aria-label="Green"]')!
    expect(green.checked).toBe(false)
    await click(green)
    expect(onFilter).toHaveBeenCalledWith({ colors: [], kinds: [] })
  })
  it('edits the comment of the selected annotation', async () => {
    const onComment = vi.fn()
    await render(<AnnotationsPanel annotations={marks} palette={palette} filter={{ colors: [], kinds: [] }} selectedId="h1" onFilter={() => {}} onSelect={() => {}} onComment={onComment} />)
    const ta = host.querySelector<HTMLTextAreaElement>('textarea')!
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
    await act(async () => {
      set.call(ta, 'why √dk?')
      ta.dispatchEvent(new Event('input', { bubbles: true }))
      ta.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    expect(onComment).toHaveBeenCalledWith('h1', 'why √dk?')
  })
})
