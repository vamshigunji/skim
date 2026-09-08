import { parentPort } from 'node:worker_threads'
import { probe } from './extract'

// One job per worker: main posts the file bytes, gets the probe or the error back, then the worker exits (design/07 failure isolation).
parentPort!.once('message', async (data: Uint8Array) => {
  try {
    parentPort!.postMessage({ ok: await probe(Buffer.from(data)) })
  } catch (e) {
    parentPort!.postMessage({ error: { name: (e as Error).name, message: (e as Error).message } })
  }
})
