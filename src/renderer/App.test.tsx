import { describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { App } from './App'

describe('App', () => {
  it('renders the Skim shell', async () => {
    const host = document.createElement('div')
    await act(async () => createRoot(host).render(<App />))
    expect(host.textContent).toContain('SKIM')
  })
})
