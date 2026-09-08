// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadPdf } from './pdf'

describe('loadPdf', () => {
  it('exposes page count, labels, and a flattened outline with page indices', async () => {
    const doc = await loadPdf(new Uint8Array(readFileSync('e2e/fixtures/sample.pdf')))
    expect(doc.numPages).toBe(3)
    expect(doc.labels).toEqual(['i', '1173', '1174'])
    expect(doc.sizes).toHaveLength(3)
    expect(doc.sizes[0].width).toBeGreaterThan(0)
    expect(doc.outline).toEqual([
      { title: 'Abstract', pageIndex: 1 },
      { title: 'Introduction', pageIndex: 2 },
    ])
  })
})
