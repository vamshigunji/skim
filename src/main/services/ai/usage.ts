import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { UsageSummary } from '../../../shared/types/ai'

// USD per million tokens, [input, output], matched by longest model-name prefix. These are editable defaults
// bundled with the app; verify against each provider's price page before a release. Local models cost 0.
const PRICES: [string, number, number][] = [
  ['claude-opus-4', 15, 75],
  ['claude-sonnet-4', 3, 15],
  ['claude-haiku', 0.8, 4],
  ['gpt-4o-mini', 0.15, 0.6],
  ['gpt-4o', 2.5, 10],
  ['gpt-4.1-mini', 0.4, 1.6],
  ['gpt-4.1', 2, 8],
  ['gemini-2.5-flash', 0.3, 2.5],
  ['gemini-2.5-pro', 1.25, 10],
]

export function costFor(provider: string, model: string, input: number, output: number): number | null {
  if (provider === 'ollama') return 0
  const p = PRICES.filter(([prefix]) => model.startsWith(prefix)).sort((a, b) => b[0].length - a[0].length)[0]
  return p ? (input * p[1] + output * p[2]) / 1e6 : null
}

export function recordUsage(db: DatabaseSync, u: { provider: string; model: string; purpose: string; input: number; output: number }) {
  db.prepare('INSERT INTO ai_usage (id, provider, model, purpose, input_tokens, output_tokens, cost_usd, created_at) VALUES (?,?,?,?,?,?,?,?)').run(
    randomUUID(), u.provider, u.model, u.purpose, u.input, u.output, costFor(u.provider, u.model, u.input, u.output), Date.now(),
  )
}

export const usageSummary = (db: DatabaseSync, since = Date.now() - 30 * 86_400_000): UsageSummary =>
  db
    .prepare('SELECT count(*) requests, coalesce(sum(input_tokens),0) input, coalesce(sum(output_tokens),0) output, coalesce(sum(cost_usd),0) cost_usd FROM ai_usage WHERE created_at >= ?')
    .get(since) as unknown as UsageSummary
