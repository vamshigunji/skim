import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import type { ProviderStatus } from '../../shared/types/ai'
import { Settings } from './Settings'

const providers: ProviderStatus[] = [
  { id: 'ollama', kind: 'ollama', base_url: 'http://127.0.0.1:11434', model: 'llama3.2', enabled: 1, is_default: 1, local: true, hasKey: false, models: ['llama3.2'], reachable: true, egressConfirmed: true },
  { id: 'openai', kind: 'openai', base_url: null, model: null, enabled: 1, is_default: 0, local: false, hasKey: false, models: [], reachable: false, egressConfirmed: false },
]

let host: HTMLElement
const props = { enabled: true, usage: { requests: 2, input: 505, output: 103, cost_usd: 0.0012 }, onToggle: vi.fn(), onSetKey: vi.fn(), onSetProvider: vi.fn(), onConfirmEgress: vi.fn(), onTest: vi.fn(), testOutput: '' }
const click = (el: Element) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
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
  await act(async () => createRoot(host).render(<Settings providers={providers} {...props} />))
})

describe('Settings', () => {
  it('lists providers with locality, key state, and the meter', () => {
    expect(host.textContent).toMatch(/Ollama/)
    expect(host.textContent).toMatch(/local/i)
    expect(host.textContent).toMatch(/no key/i)
    expect(host.textContent).toMatch(/505/)
    expect(host.textContent).toMatch(/\$0\.0012/)
  })
  it('toggles AI off', async () => {
    await click(host.querySelector('input[aria-label="AI enabled"]')!)
    expect(props.onToggle).toHaveBeenCalledWith(false)
  })
  it('saves a key through the keychain callback without echoing it', async () => {
    const input = host.querySelector<HTMLInputElement>('input[aria-label="openai API key"]')!
    expect(input.type).toBe('password')
    await type(input, 'sk-live')
    await click(host.querySelector('button[aria-label="Save openai key"]')!)
    expect(props.onSetKey).toHaveBeenCalledWith('openai', 'sk-live')
  })
  it('shows the egress dialog before testing an unconfirmed hosted provider', async () => {
    await click(host.querySelector('button[aria-label="Test openai"]')!)
    const dialog = host.querySelector('[role="dialog"]')!
    expect(dialog.textContent).toMatch(/will be sent/i)
    expect(dialog.textContent).toMatch(/selected text/i)
    await click([...dialog.querySelectorAll('button')].find((b) => /confirm/i.test(b.textContent ?? ''))!)
    expect(props.onConfirmEgress).toHaveBeenCalledWith('openai')
    expect(props.onTest).toHaveBeenCalledWith('openai')
  })
})
