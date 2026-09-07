import { describe, expect, it } from 'vitest'
import { loadPosition, savePosition } from './position'

describe('reading position', () => {
  it('round-trips per document and is absent for unknown documents', () => {
    savePosition('/a.pdf', { page: 4, zoom: 1.25 })
    expect(loadPosition('/a.pdf')).toEqual({ page: 4, zoom: 1.25 })
    expect(loadPosition('/b.pdf')).toBeNull()
  })
})
