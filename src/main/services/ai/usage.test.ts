// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { openDb } from '../../db'
import { costFor, recordUsage, usageSummary } from './usage'

describe('cost meter', () => {
  it('prices known hosted models by prefix and local models at zero', () => {
    expect(costFor('anthropic', 'claude-sonnet-4-20250514', 1_000_000, 1_000_000)).toBeGreaterThan(0)
    expect(costFor('openai', 'gpt-4o-mini', 1000, 1000)).toBeGreaterThan(0)
    expect(costFor('ollama', 'llama3.2', 1_000_000, 1_000_000)).toBe(0)
    expect(costFor('openai', 'unknown-model', 1000, 1000)).toBeNull()
  })
  it('records requests and summarizes tokens, cost, and count', () => {
    const db = openDb(':memory:')
    recordUsage(db, { provider: 'openai', model: 'gpt-4o-mini', purpose: 'ask', input: 500, output: 100 })
    recordUsage(db, { provider: 'ollama', model: 'llama3.2', purpose: 'ask', input: 5, output: 3 })
    const s = usageSummary(db)
    expect(s).toMatchObject({ requests: 2, input: 505, output: 103 })
    expect(s.cost_usd).toBeGreaterThan(0)
  })
})
