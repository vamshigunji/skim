import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Electron's safeStorage shape: Keychain on macOS, DPAPI on Windows, libsecret on Linux.
export interface Codec {
  encryptString: (s: string) => Buffer
  decryptString: (b: Buffer) => string
}

// Secrets live encrypted in keys.json next to the library, never in the database, logs, or exports.
export function createKeychain(dir: string, codec: Codec) {
  const file = join(dir, 'keys.json')
  const read = (): Record<string, string> => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {})
  const write = (o: Record<string, string>) => writeFileSync(file, JSON.stringify(o), { mode: 0o600 })
  return {
    get: (id: string) => {
      const c = read()[id]
      return c ? codec.decryptString(Buffer.from(c, 'base64')) : null
    },
    has: (id: string) => id in read(),
    set: (id: string, secret: string) => write({ ...read(), [id]: codec.encryptString(secret).toString('base64') }),
    delete: (id: string) => {
      const o = read()
      delete o[id]
      write(o)
    },
  }
}

export type Keychain = ReturnType<typeof createKeychain>
