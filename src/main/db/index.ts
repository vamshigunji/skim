import { copyFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import init from './migrations/0001_init.sql?raw'
import aiUsage from './migrations/0002_ai_usage.sql?raw'
import skim from './migrations/0003_skim_overlays.sql?raw'
import evidence from './migrations/0004_proposal_evidence.sql?raw'

// Numbered migrations applied in order. Append only; never edit a shipped entry.
const migrations = [init, aiUsage, skim, evidence]
export const SCHEMA_VERSION = migrations.length

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA journal_mode = WAL')

  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)')
  const version = (db.prepare('SELECT version FROM schema_version').get()?.version as number | undefined) ?? 0
  if (version > SCHEMA_VERSION) {
    db.close()
    throw new Error(`Database is version ${version}, newer than this app understands (${SCHEMA_VERSION}). A backup is at ${path}.bak-${version - 1}`)
  }
  if (version === SCHEMA_VERSION) return db

  if (version > 0 && path !== ':memory:') copyFileSync(path, `${path}.bak-${version}`)
  db.exec('BEGIN')
  for (const sql of migrations.slice(version)) db.exec(sql)
  db.exec(`DELETE FROM schema_version; INSERT INTO schema_version VALUES (${SCHEMA_VERSION})`)
  db.exec('COMMIT')
  return db
}
