// @vitest-environment node
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { openDb, SCHEMA_VERSION } from './index'
import { table } from './repo'
import type { Paper } from '../../shared/types/db'

const now = Date.now()
const paper = (id = 'p1'): Paper => ({
  id,
  title: 'Attention Is All You Need',
  authors_json: '[{"family":"Vaswani","given":"Ashish"}]',
  year: 2017,
  venue: null,
  doi: `10.1000/${id}`,
  arxiv_id: null,
  abstract: null,
  citekey: `key-${id}`,
  reading_status: 'to_read',
  external_ids_json: '{}',
  metadata_source: 'extracted',
  created_at: now,
  updated_at: now,
})

const seed = (db: DatabaseSync) => {
  table<Paper>(db, 'papers').insert(paper())
  db.exec(`
    INSERT INTO attachments VALUES ('a1','p1','/x.pdf','h','pdf',2,'[]',1,0);
    INSERT INTO pages VALUES ('a1',0,'scaled dot product attention',612,792,0);
    INSERT INTO annotations VALUES ('n1','a1',0,'highlight','[]','#E0AF68','t',NULL,NULL,0,'user',0,0);
    INSERT INTO "references" VALUES ('r1','p1',1,'[1]','raw','{}',NULL,'{}','unresolved');
    INSERT INTO chunks VALUES ('c1','a1',0,0,0,0,10,'scaled dot product attention','3.2',5);
    INSERT INTO index_status VALUES ('a1','ready',0,NULL,NULL,1,'pdfjs',0);
    INSERT INTO chat_threads VALUES ('t1','p1',NULL,'q',0);
    INSERT INTO proposals VALUES ('pr1','t1',NULL,'tag','add tag','applied',0);
    INSERT INTO proposal_items VALUES ('pi1','pr1','papers','p1','add_tag','null','"x"','applied');
    INSERT INTO edit_journal VALUES ('j1','pi1',0,NULL,'null','"x"');
  `)
}

describe('openDb', () => {
  it('creates every table from the spec and records the schema version', () => {
    const db = openDb(':memory:')
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view') ORDER BY name")
      .all()
      .map((r) => r.name)
    for (const t of [
      'papers', 'attachments', 'pages', 'pages_fts', 'annotations', 'references',
      'reference_mentions', 'regions', 'region_mentions', 'chunks', 'chunks_fts', 'embeddings', 'index_status',
      'collections', 'paper_collections', 'tags', 'paper_tags', 'chat_threads', 'chat_messages', 'citations',
      'proposals', 'proposal_items', 'edit_journal', 'settings', 'providers', 'schema_version',
    ])
      expect(names, t).toContain(t)
    expect(db.prepare('SELECT version FROM schema_version').get()).toEqual({ version: SCHEMA_VERSION })
  })

  it('is idempotent across reopen and writes a backup only when upgrading an existing file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'skim-'))
    const path = join(dir, 'library.db')
    openDb(path).close()
    expect(existsSync(`${path}.bak-0`)).toBe(false)
    const again = openDb(path)
    expect(again.prepare('SELECT version FROM schema_version').get()).toEqual({ version: SCHEMA_VERSION })
    again.close()
  })

  it('refuses a database newer than it understands', () => {
    const dir = mkdtempSync(join(tmpdir(), 'skim-'))
    const path = join(dir, 'library.db')
    const db = openDb(path)
    db.exec(`UPDATE schema_version SET version = ${SCHEMA_VERSION + 1}`)
    db.close()
    expect(() => openDb(path)).toThrow(/newer/)
  })

  it('deleting a paper cascades to derived rows but not the edit journal', () => {
    const db = openDb(':memory:')
    seed(db)
    db.exec("DELETE FROM papers WHERE id = 'p1'")
    const count = (t: string) => db.prepare(`SELECT count(*) c FROM "${t}"`).get()!.c
    for (const t of ['attachments', 'pages', 'annotations', 'references', 'chunks', 'index_status', 'chat_threads'])
      expect(count(t), t).toBe(0)
    expect(count('edit_journal')).toBe(1)
  })

  it('keeps FTS5 in sync for exact search', () => {
    const db = openDb(':memory:')
    seed(db)
    const hit = db.prepare("SELECT page_index FROM pages_fts WHERE pages_fts MATCH 'attention'").get()
    expect(hit).toEqual({ page_index: 0 })
    expect(db.prepare("SELECT count(*) c FROM chunks_fts WHERE chunks_fts MATCH 'product'").get()!.c).toBe(1)
  })
})

describe('table()', () => {
  it('round-trips a typed row', () => {
    const papers = table<Paper>(openDb(':memory:'), 'papers')
    papers.insert(paper())
    expect(papers.get('p1')?.citekey).toBe('key-p1')
    papers.update('p1', { reading_status: 'read', year: 2018 })
    expect(papers.get('p1')).toMatchObject({ reading_status: 'read', year: 2018 })
    papers.insert(paper('p2'))
    expect(papers.list('year = ?', [2017]).map((p) => p.id)).toEqual(['p2'])
    papers.remove('p1')
    expect(papers.get('p1')).toBeUndefined()
  })
})
