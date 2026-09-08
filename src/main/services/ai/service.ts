import type { DatabaseSync } from 'node:sqlite'
import { EGRESS_SENDS, type AskRequest, type AskResult, type ChatDelta, type ProviderConfig, type ProviderStatus } from '../../../shared/types/ai'
import type { Keychain } from './keys'
import { createProvider } from './provider'
import { recordUsage, usageSummary } from './usage'

export function createAiService(db: DatabaseSync, keychain: Keychain, send: (channel: string, delta: ChatDelta) => void) {
  const setting = (key: string) => JSON.parse((db.prepare('SELECT value_json FROM settings WHERE key = ?').get(key)?.value_json as string | undefined) ?? 'null')
  const setSetting = (key: string, value: unknown) =>
    db.prepare('INSERT INTO settings (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json').run(key, JSON.stringify(value))
  const rows = () => db.prepare('SELECT * FROM providers ORDER BY is_default DESC, id').all() as unknown as ProviderConfig[]
  const running = new Map<string, AbortController>()

  // Ollama is the default and nothing leaves the machine until the user adds a hosted provider.
  if (!rows().length) db.prepare("INSERT INTO providers (id, kind, base_url, model, enabled, is_default) VALUES ('ollama','ollama','http://127.0.0.1:11434',NULL,1,1)").run()

  const enabled = () => setting('ai.enabled') ?? true
  const confirmed = (cfg: ProviderConfig) => cfg.kind === 'ollama' || !!setting(`egress.${cfg.id}`)

  // Whole reply as one string, for JSON-shaped requests (skim labels, edit proposals). Rejects on provider error.
  const complete = async (req: AskRequest): Promise<{ text: string } | Extract<AskResult, { needsConfirmation: true }>> => {
    let text = ''
    let settle!: { resolve: () => void; reject: (e: Error) => void }
    const finished = new Promise<void>((resolve, reject) => (settle = { resolve, reject }))
    const r = await service.ask(req, (d) => {
      if (d.type === 'text') text += d.text
      else if (d.type === 'done') settle.resolve()
      else if (d.type === 'error') settle.reject(new Error(d.message))
    })
    if ('needsConfirmation' in r) return r
    await finished
    return { text }
  }

  // Embeddings go through the same gates as chat: AI on, key present, egress confirmed. Throws so retrieval can fall back to exact-only with the reason.
  // Provider for a request, with the gates every call shares: AI on, key present. Egress confirmation is checked by the caller.
  const pick = (providerId?: string) => {
    if (!enabled()) throw new Error('AI is off. Turn it on in Settings to ask questions.')
    const cfg = rows().find((r) => (providerId ? r.id === providerId : r.is_default)) ?? rows()[0]
    const p = createProvider(cfg, keychain.get(cfg.id))
    if (!p.local && !keychain.has(cfg.id)) throw new Error(`No API key saved for ${cfg.id}. Add one in Settings.`)
    return { cfg, p }
  }
  const embed = async (texts: string[]) => {
    const { cfg, p } = pick()
    if (!confirmed(cfg)) throw new Error(`${cfg.id} needs egress confirmation in Settings`)
    const vectors = await p.embed(texts)
    recordUsage(db, { provider: cfg.id, model: p.embedModel ?? '', purpose: 'embed', input: texts.reduce((n, t) => n + Math.ceil(t.length / 4), 0), output: 0 })
    return { model: `${cfg.id}/${p.embedModel}`, vectors }
  }

  const service = {
    complete,
    embed,
    enabled,
    setEnabled: (on: boolean) => setSetting('ai.enabled', on),
    confirmEgress: (id: string) => setSetting(`egress.${id}`, true),
    setKey: (id: string, key: string | null) => (key ? keychain.set(id, key) : keychain.delete(id)),
    usage: () => usageSummary(db),
    cancel: (requestId: string) => running.get(requestId)?.abort(),

    async setProvider(cfg: ProviderConfig) {
      if (cfg.is_default) db.prepare('UPDATE providers SET is_default = 0').run()
      db.prepare(
        `INSERT INTO providers (id, kind, base_url, model, enabled, is_default) VALUES (?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, base_url = excluded.base_url, model = excluded.model, enabled = excluded.enabled, is_default = excluded.is_default`,
      ).run(cfg.id, cfg.kind, cfg.base_url, cfg.model, cfg.enabled, cfg.is_default)
    },

    providers: (): Promise<ProviderStatus[]> =>
      Promise.all(
        rows().map(async (cfg) => {
          const p = createProvider(cfg, keychain.get(cfg.id))
          const models = await p.listModels().catch(() => null)
          return { ...cfg, local: p.local, hasKey: keychain.has(cfg.id), models: models ?? [], reachable: models !== null, egressConfirmed: confirmed(cfg) }
        }),
      ),

    async ask(req: AskRequest, onDelta?: (d: ChatDelta) => void): Promise<AskResult> {
      const { cfg, p } = pick(req.providerId)
      if (!confirmed(cfg)) return { needsConfirmation: true, providerId: cfg.id, sends: EGRESS_SENDS }
      const ac = new AbortController()
      running.set(req.requestId, ac)
      const emit = onDelta ?? ((d: ChatDelta) => send(`ai.stream:${req.requestId}`, d))
      ;(async () => {
        let input = 0
        let output = 0
        try {
          for await (const d of p.chat({ model: cfg.model ?? '', messages: req.messages }, ac.signal)) {
            if (d.type === 'usage') ({ input, output } = d)
            emit(d)
          }
        } catch (e) {
          emit({ type: 'error', message: ac.signal.aborted ? 'Cancelled' : (e as Error).message })
        } finally {
          running.delete(req.requestId)
          if (input || output) recordUsage(db, { provider: cfg.id, model: cfg.model ?? '', purpose: req.purpose, input, output })
        }
      })()
      return { requestId: req.requestId }
    },
  }
  return service
}
