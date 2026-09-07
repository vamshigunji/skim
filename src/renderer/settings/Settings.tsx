import { useState } from 'react'
import { EGRESS_SENDS, type ProviderConfig, type ProviderStatus, type UsageSummary } from '../../shared/types/ai'

interface Props {
  providers: ProviderStatus[]
  enabled: boolean
  usage: UsageSummary
  testOutput: string
  onToggle: (on: boolean) => void
  onSetKey: (id: string, key: string) => void
  onSetProvider: (cfg: ProviderConfig) => void
  onConfirmEgress: (id: string) => void
  onTest: (id: string) => void
}

const blank = (id: ProviderConfig['kind']): ProviderStatus => ({ id, kind: id, base_url: null, model: null, enabled: 1, is_default: 0, local: false, hasKey: false, models: [], reachable: false, egressConfirmed: false })
const names: Record<string, string> = { ollama: 'Ollama', openai: 'OpenAI-compatible', anthropic: 'Anthropic' }

export function Settings({ providers, enabled, usage, testOutput, onToggle, onSetKey, onSetProvider, onConfirmEgress, onTest }: Props) {
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [edits, setEdits] = useState<Record<string, Partial<ProviderConfig>>>({})
  const [pending, setPending] = useState<string | null>(null)
  const all = [...providers, ...(['openai', 'anthropic'] as const).filter((k) => !providers.some((p) => p.id === k)).map(blank)]
  const cfg = (p: ProviderStatus): ProviderConfig => ({ id: p.id, kind: p.kind, base_url: p.base_url, model: p.model, enabled: p.enabled, is_default: p.is_default, ...edits[p.id] })
  const test = (p: ProviderStatus) => (p.local || p.egressConfirmed ? onTest(p.id) : setPending(p.id))

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-8 text-[11px]">
      <h1 className="font-reading text-[28px] font-semibold">Settings · Connections</h1>

      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" aria-label="AI enabled" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
        AI enabled
        <span className="text-muted">Off hides every AI surface. Reading, search, annotations, and export keep working.</span>
      </label>

      <p data-testid="meter" className="text-muted">
        LAST 30 DAYS · {usage.requests} requests · in {usage.input} · out {usage.output} · est. ${usage.cost_usd.toFixed(4)}
      </p>

      {all.map((p) => (
        <section key={p.id} className="flex flex-col gap-2 rounded bg-panel p-4">
          <div className="flex items-center gap-3">
            <span className="font-reading text-sm font-semibold text-text">{names[p.kind]}</span>
            <span className={`font-bold ${p.local ? 'text-green' : 'text-amber'}`}>{p.local ? 'LOCAL · nothing leaves this machine' : 'HOSTED · sends text to a third party'}</span>
            <span className="ml-auto text-muted">{p.reachable ? '● reachable' : '○ not reachable'}</span>
            {p.is_default ? <span className="font-bold text-accent">DEFAULT</span> : <button aria-label={`Make ${p.id} default`} onClick={() => onSetProvider({ ...cfg(p), is_default: 1 })} className="text-accent">MAKE DEFAULT</button>}
          </div>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-muted">
              base URL
              <input aria-label={`${p.id} base URL`} defaultValue={p.base_url ?? ''} onBlur={(e) => onSetProvider({ ...cfg(p), base_url: e.target.value || null })} onChange={(e) => setEdits({ ...edits, [p.id]: { ...edits[p.id], base_url: e.target.value || null } })} className="rounded bg-raised px-2 py-1 text-text" />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-muted">
              model
              <input aria-label={`${p.id} model`} list={`${p.id}-models`} defaultValue={p.model ?? ''} onBlur={(e) => onSetProvider({ ...cfg(p), model: e.target.value || null })} onChange={(e) => setEdits({ ...edits, [p.id]: { ...edits[p.id], model: e.target.value || null } })} className="rounded bg-raised px-2 py-1 text-text" />
              <datalist id={`${p.id}-models`}>{p.models.map((m) => <option key={m} value={m} />)}</datalist>
            </label>
            {!p.local && (
              <label className="flex flex-1 flex-col gap-1 text-muted">
                API key · {p.hasKey ? 'key saved in the OS keychain' : 'no key'}
                <span className="flex gap-1">
                  <input type="password" aria-label={`${p.id} API key`} value={keys[p.id] ?? ''} onChange={(e) => setKeys({ ...keys, [p.id]: e.target.value })} className="min-w-0 flex-1 rounded bg-raised px-2 py-1 text-text" />
                  <button aria-label={`Save ${p.id} key`} onClick={() => (onSetKey(p.id, keys[p.id] ?? ''), setKeys({ ...keys, [p.id]: '' }))} className="rounded bg-active px-2 font-bold text-text">
                    SAVE
                  </button>
                </span>
              </label>
            )}
          </div>
          <button aria-label={`Test ${p.id}`} onClick={() => test(p)} disabled={!enabled} className="self-start rounded bg-accent px-3 py-1.5 font-bold text-bg disabled:opacity-40">
            TEST CONNECTION
          </button>
        </section>
      ))}

      {testOutput && (
        <pre data-testid="test-output" className="whitespace-pre-wrap rounded bg-raised p-3 font-reading text-xs text-text">
          {testOutput}
        </pre>
      )}

      {pending && (
        <div role="dialog" aria-label="Before sending to a hosted provider" className="fixed inset-0 z-10 flex items-center justify-center bg-bg/70" onClick={() => setPending(null)}>
          <div className="w-[480px] rounded border border-amber bg-panel p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-reading text-base text-text">This will be sent to {names[all.find((p) => p.id === pending)!.kind]}:</p>
            <ul className="my-3 list-disc pl-5 text-text-2">
              {EGRESS_SENDS.map((s) => <li key={s}>{s}</li>)}
            </ul>
            <p className="text-muted">You confirm once per provider. Nothing is sent until you do.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setPending(null)} className="rounded px-3 py-1.5 font-bold text-text-2">CANCEL</button>
              <button
                onClick={() => {
                  onConfirmEgress(pending)
                  onTest(pending)
                  setPending(null)
                }}
                className="rounded bg-accent px-3 py-1.5 font-bold text-bg"
              >
                CONFIRM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
