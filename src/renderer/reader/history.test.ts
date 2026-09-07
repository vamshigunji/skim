import { describe, expect, it } from 'vitest'
import { createHistory } from './history'

describe('createHistory', () => {
  it('undoes and redoes in order and clears redo on a new push', () => {
    const log: string[] = []
    const h = createHistory()
    const entry = (n: string) => ({ undo: () => log.push(`undo ${n}`), redo: () => log.push(`redo ${n}`) })
    h.push(entry('a'))
    h.push(entry('b'))
    expect(h.undo()).toBe(true)
    expect(h.undo()).toBe(true)
    expect(h.undo()).toBe(false)
    expect(h.redo()).toBe(true)
    h.push(entry('c'))
    expect(h.redo()).toBe(false)
    expect(log).toEqual(['undo b', 'undo a', 'redo a'])
  })
  it('keeps at most the configured depth', () => {
    const h = createHistory(2)
    let n = 0
    for (let i = 0; i < 5; i++) h.push({ undo: () => n++, redo: () => {} })
    while (h.undo());
    expect(n).toBe(2)
  })
})
