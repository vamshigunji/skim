// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createKeychain } from './keys'

// Stand-in for Electron safeStorage: reversible but not plaintext.
const codec = {
  encryptString: (s: string) => Buffer.from(Buffer.from(s).map((b) => b ^ 0x5a)),
  decryptString: (b: Buffer) => Buffer.from(b.map((x) => x ^ 0x5a)).toString(),
}

describe('keychain', () => {
  it('stores, reads, and deletes secrets per provider', () => {
    const kc = createKeychain(mkdtempSync(join(tmpdir(), 'skim-keys-')), codec)
    expect(kc.get('openai')).toBeNull()
    kc.set('openai', 'sk-secret-123')
    expect(kc.get('openai')).toBe('sk-secret-123')
    expect(kc.has('openai')).toBe(true)
    kc.delete('openai')
    expect(kc.get('openai')).toBeNull()
  })
  it('never writes the plaintext secret to disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'skim-keys-'))
    createKeychain(dir, codec).set('anthropic', 'sk-ant-plaintext-should-not-appear')
    for (const f of readdirSync(dir)) expect(readFileSync(join(dir, f), 'utf8')).not.toContain('plaintext-should-not-appear')
  })
})
