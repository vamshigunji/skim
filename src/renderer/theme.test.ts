import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Tokens from design/README.md. The CSS file is the single source of truth.
const required: Record<string, string> = {
  bg: '#1A1B26',
  panel: '#202338',
  raised: '#24283B',
  active: '#2B3352',
  line: '#353B59',
  text: '#C0CAF5',
  'text-2': '#A9B1D6',
  muted: '#7A82A8',
  accent: '#7AA2F7',
  amber: '#E0AF68',
  green: '#9ECE6A',
  red: '#F7768E',
  paper: '#E8E7E3',
}

describe('Tokyo Night tokens', () => {
  const css = readFileSync('src/renderer/index.css', 'utf8')
  for (const [name, hex] of Object.entries(required)) {
    it(`defines --color-${name} as ${hex}`, () => {
      expect(css).toMatch(new RegExp(`--color-${name}:\\s*${hex}`, 'i'))
    })
  }
  it('uses IBM Plex Mono for UI and Newsreader for reading', () => {
    expect(css).toMatch(/--font-ui:\s*["']?IBM Plex Mono/)
    expect(css).toMatch(/--font-reading:\s*["']?Newsreader/)
  })
})
