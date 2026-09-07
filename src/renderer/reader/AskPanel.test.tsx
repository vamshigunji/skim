import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { AskPanel } from './AskPanel'

let host: HTMLElement
const click = (el: Element) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
const onJump = vi.fn()
const onFind = vi.fn()
const onAsk = vi.fn()

const messages = [
  { id: 'm1', role: 'user' as const, content: 'How is attention computed?', citations: [] },
  {
    id: 'm2',
    role: 'assistant' as const,
    content: 'From scaled dot products [[c:1 "Scaled dot-product attention"]]. Also [[c:2 "this quote does not exist"]].',
    citations: [
      { n: 1, pageIndex: 1, quote: 'Scaled dot-product attention', verified: true },
      { n: 2, pageIndex: 1, quote: 'this quote does not exist', verified: false },
    ],
    state: 'PARTIAL' as const,
  },
]

beforeEach(async () => {
  document.body.innerHTML = ''
  host = document.body.appendChild(document.createElement('div'))
  await act(async () => createRoot(host).render(<AskPanel messages={messages} live={null} label={(i) => String(i + 1172)} onAsk={onAsk} onStop={() => {}} onJump={onJump} onFind={onFind} selection={null} />))
})

describe('AskPanel', () => {
  it('renders stored answers with page-labeled chips and the verification state', () => {
    const chips = host.querySelectorAll('[data-testid="citation-chip"]')
    expect(chips).toHaveLength(2)
    expect(chips[0].textContent).toContain('p. 1173')
    expect(chips[1].textContent).toContain('not found')
    expect(host.querySelector('[data-testid="answer-state"]')?.textContent).toBe('PARTIAL')
    expect(host.querySelector('[data-testid="answer-footer"]')?.textContent).toMatch(/1 of 2 claims verified/)
  })
  it('jumps to the passage on a verified chip and offers exact search on an unverified one', async () => {
    const chips = host.querySelectorAll('[data-testid="citation-chip"]')
    await click(chips[0])
    expect(onJump).toHaveBeenCalledWith(1, 'Scaled dot-product attention')
    await click(host.querySelector('button[aria-label="Find exact text"]')!)
    expect(onFind).toHaveBeenCalledWith('this quote does not exist')
  })
  it('sends a question on Enter', async () => {
    const input = host.querySelector<HTMLTextAreaElement>('textarea')!
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
    await act(async () => {
      set.call(input, 'Why scale?')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(onAsk).toHaveBeenCalledWith('Why scale?')
  })
})
