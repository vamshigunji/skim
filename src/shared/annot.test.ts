import { describe, expect, it } from 'vitest'
import { toFractions } from './annot'

const box = { x: 100, y: 200, width: 200, height: 400 }

describe('toFractions', () => {
  it('converts client rects to 0-1 fractions of the page box and merges rects on one line', () => {
    const rects = [
      { x: 110, y: 210, width: 50, height: 10 },
      { x: 160, y: 210, width: 40, height: 10 },
      { x: 110, y: 230, width: 80, height: 10 },
    ]
    expect(toFractions(rects, box)).toEqual([
      { x: 0.05, y: 0.025, w: 0.45, h: 0.025 },
      { x: 0.05, y: 0.075, w: 0.4, h: 0.025 },
    ])
  })
  it('clamps to the page and drops empty rects', () => {
    expect(toFractions([{ x: 50, y: 150, width: 100, height: 100 }, { x: 120, y: 220, width: 0, height: 10 }], box)).toEqual([
      { x: 0, y: 0, w: 0.25, h: 0.125 },
    ])
  })
})
