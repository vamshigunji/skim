import { describe, expect, it } from 'vitest'
import { parseProposedEdits } from './proposals'

describe('parseProposedEdits', () => {
  it('keeps only the closed op set and normalizes tags and confidence', () => {
    const text = 'Sure: [{"op":"set_field","field":"title","after":"New","confidence":0.9,"reason":"heading"},{"op":"add_tag","tag":" Transformers ","confidence":2},{"op":"delete_paper"},{"op":"set_field","field":"id","after":"x"}]'
    expect(parseProposedEdits(text, 'p1')).toEqual([
      { paperId: 'p1', op: 'set_field', slot: 'title', after: 'New', confidence: 0.9, evidence: 'Model judgement: heading' },
      { paperId: 'p1', op: 'add_tag', slot: 'transformers', after: true, confidence: 1, evidence: 'Model judgement, no reason given' },
    ])
  })
  it('yields nothing for prose or broken JSON', () => {
    expect(parseProposedEdits('no', 'p1')).toEqual([])
    expect(parseProposedEdits('[{"op":', 'p1')).toEqual([])
  })
})
