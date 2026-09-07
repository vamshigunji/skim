// @vitest-environment node
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { openDb } from '../db'
import { importPdfs } from './library'
import { listReferences, listRegions } from './references'

const cited = resolve('e2e/fixtures/cited.pdf')
const sample = resolve('e2e/fixtures/sample.pdf')
let db: DatabaseSync

beforeAll(async () => {
  db = openDb(':memory:')
  await importPdfs(db, [cited, sample])
})

describe('references at import', () => {
  it('parses the bibliography into ordered entries with title, year, ids, and mention counts', () => {
    const refs = listReferences(db, cited)
    expect(refs).toHaveLength(2)
    expect(refs[0]).toMatchObject({ ordinal: 1, label: '[1]', page_index: 1, mentions: 1, library_paper_id: null })
    expect(JSON.parse(refs[0].parsed_json)).toMatchObject({ title: 'Attention is all you need', year: 2017, surnames: ['Vaswani', 'Shazeer', 'Parmar'] })
    expect(refs[1]).toMatchObject({ ordinal: 2, mentions: 2 })
    expect(JSON.parse(refs[1].parsed_json)).toMatchObject({ title: 'Scaling laws for neural language models', year: 2020, arxiv_id: '2001.08361' })
    expect(refs[0].raw).toContain('NeurIPS')
  })

  it('links an entry to a library paper by normalized title', () => {
    db.prepare("UPDATE papers SET title = 'Scaling Laws for Neural Language Models' WHERE title = 'Front matter'").run()
    expect(listReferences(db, cited)[1].library_paper_id).toBeTruthy()
  })

  it('finds figure, table, and equation regions with fraction rects and captions', () => {
    const regions = listRegions(db, cited)
    const fig = regions.find((r) => r.kind === 'figure')!
    const tab = regions.find((r) => r.kind === 'table')!
    const eq = regions.find((r) => r.kind === 'equation')!
    expect(fig).toMatchObject({ label: '1', page_index: 0, text: 'Figure 1: Attention weights across heads' })
    const f = JSON.parse(fig.rect_json)
    expect(f.y).toBeLessThan(0.26) // covers the drawn box (top 0.255)
    expect(f.y + f.h).toBeGreaterThan(0.47) // includes the caption
    const t = JSON.parse(tab.rect_json)
    expect(t.y).toBeLessThan(0.65) // caption above the table box (0.646)
    expect(t.y + t.h).toBeGreaterThan(0.73)
    expect(eq).toMatchObject({ label: '1', page_index: 0 })
    const e = JSON.parse(eq.rect_json)
    expect(e.y).toBeLessThan(1 - 372 / 792)
    expect(e.y + e.h).toBeGreaterThan(1 - 360 / 792)
  })

  it('leaves papers without a bibliography empty rather than guessing', () => {
    expect(listReferences(db, sample)).toEqual([])
  })
})
