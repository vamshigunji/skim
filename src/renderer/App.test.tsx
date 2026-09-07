import { beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { App } from './App'

let host: HTMLElement

const key = (init: KeyboardEventInit, target: EventTarget = document.body) =>
  act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }))
  })

const type = async (input: HTMLInputElement, value: string) => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

const palette = () => host.querySelector<HTMLElement>('[role="dialog"]')
const current = () => host.querySelector('[aria-current="page"]')?.textContent

beforeEach(async () => {
  document.body.innerHTML = ''
  host = document.body.appendChild(document.createElement('div'))
  await act(async () => createRoot(host).render(<App />))
})

describe('shell layout', () => {
  it('has a top bar with the brand and model status', () => {
    const bar = host.querySelector('header')!
    expect(bar.textContent).toContain('SKIM')
    expect(bar.textContent).toMatch(/OLLAMA/)
  })

  it('has a navigation rail with workspace and smart views', () => {
    const rail = host.querySelector('nav')!
    for (const label of ['Library', 'Reading queue', 'Collections', 'Notes', 'To read', 'Skimming', 'Cited'])
      expect(rail.textContent).toContain(label)
    expect(current()).toContain('Library')
  })

  it('shows the keyboard hint line', () => {
    expect(host.textContent).toMatch(/⌘K/)
  })

  it('switches view when a rail item is clicked', async () => {
    const notes = [...host.querySelectorAll('nav button')].find((b) => b.textContent?.includes('Notes'))!
    await act(async () => notes.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(current()).toContain('Notes')
    expect(host.querySelector('main')!.textContent).toContain('Notes')
  })
})

describe('command palette', () => {
  it('is closed by default and opens on Cmd+K with focus in the input', async () => {
    expect(palette()).toBeNull()
    await key({ key: 'k', metaKey: true })
    expect(palette()).not.toBeNull()
    expect(document.activeElement).toBe(palette()!.querySelector('input'))
  })

  it('filters commands as you type and runs the selected one on Enter', async () => {
    await key({ key: 'k', metaKey: true })
    const input = palette()!.querySelector('input')!
    await type(input, 'coll')
    const options = [...palette()!.querySelectorAll('[role="option"]')].map((o) => o.textContent)
    expect(options).toHaveLength(1)
    expect(options[0]).toContain('Collections')
    await key({ key: 'Enter' }, input)
    expect(palette()).toBeNull()
    expect(current()).toContain('Collections')
  })

  it('moves the selection with arrow keys', async () => {
    await key({ key: 'k', metaKey: true })
    const input = palette()!.querySelector('input')!
    await key({ key: 'ArrowDown' }, input)
    await key({ key: 'Enter' }, input)
    expect(current()).toContain('Reading queue')
  })

  it('closes on Escape without changing the view', async () => {
    await key({ key: 'k', metaKey: true })
    await key({ key: 'Escape' }, palette()!.querySelector('input')!)
    expect(palette()).toBeNull()
    expect(current()).toContain('Library')
  })

  it('opens the shortcut list on ?', async () => {
    await key({ key: '?' })
    expect(palette()!.textContent).toMatch(/⌘K/)
  })
})
