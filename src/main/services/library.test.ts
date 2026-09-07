// @vitest-environment node
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openDb } from '../db'
import { importPdfs, listLibrary } from './library'

const fixture = resolve('e2e/fixtures/sample.pdf')

// A one-page PDF whose only content is `stream`, so tests can make a text-free or an encrypted-looking file.
function pdfWith(stream: string, extra = '') {
  const objs = [
    `<< /Type /Catalog /Pages 2 0 R ${extra} >>`,
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]
  let out = '%PDF-1.7\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`
  return out + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
}

const tmp = () => mkdtempSync(join(tmpdir(), 'skim-lib-'))

describe('importPdfs', () => {
  it('creates a paper, attachment, pages, and a ready index row from a text PDF', async () => {
    const db = openDb(':memory:')
    const [r] = await importPdfs(db, [fixture])
    expect(r).toMatchObject({ path: fixture, status: 'imported' })
    const [item] = listLibrary(db)
    expect(item).toMatchObject({ title: 'Front matter', page_count: 3, stage: 'ready', reading_status: 'to_read' })
    expect(JSON.parse(item.page_labels_json!)).toEqual(['i', '1173', '1174'])
    expect(db.prepare('SELECT count(*) c FROM pages').get()!.c).toBe(3)
  })

  it('skips a duplicate by content hash instead of creating a second paper', async () => {
    const db = openDb(':memory:')
    await importPdfs(db, [fixture])
    const copy = join(tmp(), 'copy.pdf')
    writeFileSync(copy, await import('node:fs').then((fs) => fs.readFileSync(fixture)))
    const [r] = await importPdfs(db, [copy])
    expect(r.status).toBe('duplicate')
    expect(listLibrary(db)).toHaveLength(1)
  })

  it('records no_text_layer for a PDF without text and keeps the paper', async () => {
    const db = openDb(':memory:')
    const path = join(tmp(), 'scan.pdf')
    writeFileSync(path, pdfWith('0 0 m 100 100 l S'))
    const [r] = await importPdfs(db, [path])
    expect(r.status).toBe('imported')
    expect(listLibrary(db)[0]).toMatchObject({ stage: 'skipped', skip_reason: 'no_text_layer', title: 'scan' })
  })

  it('records parse_error for a file that is not a PDF', async () => {
    const db = openDb(':memory:')
    const path = join(tmp(), 'broken.pdf')
    writeFileSync(path, 'not a pdf at all')
    await importPdfs(db, [path])
    expect(listLibrary(db)[0]).toMatchObject({ stage: 'failed', skip_reason: 'parse_error' })
  })
})
