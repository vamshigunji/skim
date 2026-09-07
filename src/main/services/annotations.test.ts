// @vitest-environment node
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { openDb } from '../db'
import { deleteAnnotation, listAnnotations, upsertAnnotation } from './annotations'
import { importPdfs } from './library'

const fixture = resolve('e2e/fixtures/sample.pdf')
let db: DatabaseSync

beforeAll(async () => {
  db = openDb(':memory:')
  await importPdfs(db, [fixture])
})

const mark = { id: 'n1', page_index: 1, kind: 'highlight' as const, rects_json: '[{"x":0.1,"y":0.2,"w":0.3,"h":0.02}]', color: '#E0AF68', text: 'attention', comment: null, label: null, hidden: 0 }

describe('annotations', () => {
  it('upserts by document path and lists back with the attachment linked', () => {
    upsertAnnotation(db, fixture, mark)
    const [a] = listAnnotations(db, fixture)
    expect(a).toMatchObject({ ...mark, source: 'user' })
    expect(a.attachment_id).toBeTruthy()
    expect(a.created_at).toBeGreaterThan(0)
  })
  it('updates in place on a second upsert and bumps updated_at', () => {
    const before = listAnnotations(db, fixture)[0]
    upsertAnnotation(db, fixture, { ...mark, comment: 'why scale?', color: '#9ECE6A' })
    const [a] = listAnnotations(db, fixture)
    expect(listAnnotations(db, fixture)).toHaveLength(1)
    expect(a).toMatchObject({ comment: 'why scale?', color: '#9ECE6A', created_at: before.created_at })
  })
  it('deletes and rejects unknown documents', () => {
    deleteAnnotation(db, 'n1')
    expect(listAnnotations(db, fixture)).toEqual([])
    expect(() => upsertAnnotation(db, '/nope.pdf', mark)).toThrow(/No attachment/)
  })
})
