import { describe, expect, it } from 'vitest'
import { parseSkim, pickOverlays, type SkimItem } from './skim'

describe('parseSkim', () => {
  it('reads the JSON array out of surrounding prose and drops malformed entries', () => {
    const text = 'Sure! [{"label":"goal","quote":"We aim","confidence":0.9},{"label":"other","quote":"x"},{"label":"result","quote":"It works"}] Done.'
    expect(parseSkim(text)).toEqual([
      { label: 'goal', quote: 'We aim', confidence: 0.9 },
      { label: 'result', quote: 'It works', confidence: 0.5 },
    ])
  })
  it('returns nothing for prose or broken JSON', () => {
    expect(parseSkim('I cannot do that.')).toEqual([])
    expect(parseSkim('[{"label":"goal"')).toEqual([])
  })
})

describe('pickOverlays', () => {
  const items: SkimItem[] = [
    { id: 'a', pageIndex: 0, label: 'goal', quote: 'a', confidence: 0.5 },
    { id: 'b', pageIndex: 0, label: 'method', quote: 'b', confidence: 0.9 },
    { id: 'c', pageIndex: 1, label: 'result', quote: 'c', confidence: 0.7 },
  ]
  it('keeps the most confident N across shown labels', () => {
    expect(pickOverlays(items, 2, []).map((i) => i.id)).toEqual(['b', 'c'])
    expect(pickOverlays(items, 2, ['method']).map((i) => i.id)).toEqual(['c', 'a'])
  })
})
