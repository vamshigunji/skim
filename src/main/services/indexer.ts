import type { DatabaseSync } from 'node:sqlite'
import type { ImportResult } from '../../shared/types/library'
import { type Extract } from './extract'
import { importPdfs } from './library'

// Serial priority queue in front of importPdfs. Lower priority runs first (design/07): 0 the paper being opened, 10 session imports, 30 folder watch.
// ponytail: one file at a time. Add a pool of max(1, cpus - 2) workers when throughput matters.
export function createIndexer(db: DatabaseSync, extract: Extract, notify: (r: ImportResult) => void) {
  const queue: { path: string; priority: number; resolve: (r: ImportResult) => void; reject: (e: Error) => void }[] = []
  let running = false
  const drain = async () => {
    if (running) return
    running = true
    while (queue.length) {
      queue.sort((a, b) => a.priority - b.priority)
      const job = queue.shift()!
      try {
        const [r] = await importPdfs(db, [job.path], extract)
        notify(r)
        job.resolve(r)
      } catch (e) {
        job.reject(e as Error)
      }
    }
    running = false
  }
  return {
    enqueue(paths: string[], priority = 10) {
      const jobs = paths.map((path) => new Promise<ImportResult>((resolve, reject) => queue.push({ path, priority, resolve, reject })))
      setImmediate(drain)
      return Promise.all(jobs)
    },
  }
}
