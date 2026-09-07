import { describe, expect, it } from 'vitest'
import { createAnchorParser, splitAnchors } from './anchors'

describe('anchor parser', () => {
  it('splits text and anchors in order under streaming, holding partial anchors until they close', () => {
    const p = createAnchorParser()
    const segs = [...p.push('Scaling helps [[c:2 "scaled dot-pro'), ...p.push('duct attention"]] a lot.'), ...p.push(' Done [[c:3 "x y"]]'), ...p.push('')]
    segs.push(...p.flush())
    expect(segs).toEqual([
      { text: 'Scaling helps ' },
      { n: 2, quote: 'scaled dot-product attention' },
      { text: ' a lot.' },
      { text: ' Done ' },
      { n: 3, quote: 'x y' },
    ])
  })
  it('passes malformed brackets through as text', () => {
    const p = createAnchorParser()
    const segs = [...p.push('see [[note]] and [[c:x "bad"]] then [[c:1 "open'), ...p.flush()]
    expect(segs).toEqual([{ text: 'see ' }, { text: '[[note]]' }, { text: ' and ' }, { text: '[[c:x "bad"]]' }, { text: ' then ' }, { text: '[[c:1 "open' }])
  })
  it('splitAnchors parses a whole stored answer', () => {
    expect(splitAnchors('A [[c:1 "q"]] B')).toEqual([{ text: 'A ' }, { n: 1, quote: 'q' }, { text: ' B' }])
  })
})
