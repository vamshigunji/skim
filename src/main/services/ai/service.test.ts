// @vitest-environment node
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ChatDelta } from '../../../shared/types/ai'
import { openDb } from '../../db'
import { startFakeServer } from './fake-server'
import { createKeychain } from './keys'
import { createAiService } from './service'

const codec = { encryptString: (s: string) => Buffer.from(s, 'utf8'), decryptString: (b: Buffer) => b.toString('utf8') }
let fake: Awaited<ReturnType<typeof startFakeServer>>
beforeAll(async () => (fake = await startFakeServer()))
afterAll(() => fake.close())

function setup() {
  const sent: Record<string, ChatDelta[]> = {}
  const db = openDb(':memory:')
  const ai = createAiService(db, createKeychain(mkdtempSync(join(tmpdir(), 'skim-ai-')), codec), (channel, delta) => (sent[channel] ??= []).push(delta))
  return { ai, db, sent }
}
const messages = [{ role: 'user' as const, content: 'hi' }]
const drain = (sent: Record<string, ChatDelta[]>, id: string) =>
  new Promise<ChatDelta[]>((resolve) => {
    const tick = () => (sent[`ai.stream:${id}`]?.some((d) => d.type === 'done' || d.type === 'error') ? resolve(sent[`ai.stream:${id}`]) : setTimeout(tick, 10))
    tick()
  })

describe('AI service', () => {
  it('starts with Ollama as the default local provider and AI enabled', async () => {
    const { ai } = setup()
    const [p] = await ai.providers()
    expect(p).toMatchObject({ id: 'ollama', kind: 'ollama', local: true, is_default: 1, hasKey: false, egressConfirmed: true })
    expect(ai.enabled()).toBe(true)
  })

  it('requires an egress confirmation once per hosted provider, then streams and meters', async () => {
    const { ai, sent, db } = setup()
    await ai.setProvider({ id: 'openai', kind: 'openai', base_url: fake.url, model: 'fake-model', enabled: 1, is_default: 1 })
    ai.setKey('openai', 'sk-test')
    const first = await ai.ask({ requestId: 'r1', providerId: 'openai', messages, purpose: 'test' })
    expect(first).toMatchObject({ needsConfirmation: true, providerId: 'openai' })
    expect((first as { sends: string[] }).sends.length).toBeGreaterThan(0)
    ai.confirmEgress('openai')
    expect(await ai.ask({ requestId: 'r2', providerId: 'openai', messages, purpose: 'test' })).toEqual({ requestId: 'r2' })
    const deltas = await drain(sent, 'r2')
    expect(deltas.filter((d) => d.type === 'text').map((d) => (d as { text: string }).text).join('')).toBe('Hello from fake')
    expect(db.prepare('SELECT provider, model, input_tokens, output_tokens FROM ai_usage').get()).toEqual({ provider: 'openai', model: 'fake-model', input_tokens: 5, output_tokens: 3 })
    expect(ai.usage()).toMatchObject({ requests: 1, input: 5, output: 3 })
    expect((await ai.providers()).find((p) => p.id === 'openai')).toMatchObject({ hasKey: true, egressConfirmed: true, reachable: true })
  })

  it('refuses hosted providers without a key and any provider when AI is off', async () => {
    const { ai } = setup()
    await ai.setProvider({ id: 'openai', kind: 'openai', base_url: fake.url, model: 'fake-model', enabled: 1, is_default: 0 })
    ai.confirmEgress('openai')
    await expect(ai.ask({ requestId: 'r3', providerId: 'openai', messages, purpose: 'test' })).rejects.toThrow(/key/i)
    ai.setEnabled(false)
    expect(ai.enabled()).toBe(false)
    await expect(ai.ask({ requestId: 'r4', messages, purpose: 'test' })).rejects.toThrow(/AI is off/)
  })

  it('cancels a running request', async () => {
    const { ai, sent } = setup()
    await ai.setProvider({ id: 'openai', kind: 'openai', base_url: fake.url, model: 'slow-model', enabled: 1, is_default: 1 })
    ai.setKey('openai', 'sk-test')
    ai.confirmEgress('openai')
    await ai.ask({ requestId: 'r5', providerId: 'openai', messages, purpose: 'test' })
    await new Promise((r) => setTimeout(r, 50))
    ai.cancel('r5')
    const deltas = await drain(sent, 'r5')
    expect(deltas.at(-1)).toMatchObject({ type: 'error', message: expect.stringMatching(/cancel/i) })
    expect(deltas.filter((d) => d.type === 'text').length).toBeLessThan(3)
  })
})
