import type { SearchOptions } from './types/search'

// Exact search only. Semantic search is a separate, explicit mode (features/06 requirement 5).
function buildRegex(query: string, o: SearchOptions): RegExp | null {
  if (!query) return null
  let src = o.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (o.wholeWord) src = `\\b(?:${src})\\b`
  try {
    return new RegExp(src, o.caseSensitive ? 'g' : 'gi')
  } catch {
    return null
  }
}

export function findHits(text: string, query: string, o: SearchOptions) {
  const re = buildRegex(query, o)
  return re ? [...text.matchAll(re)].filter((m) => m[0]).map((m) => ({ index: m.index, length: m[0].length })) : []
}

// 80 characters of context: 40 either side.
export const context = (text: string, index: number, length: number) => ({
  before: text.slice(Math.max(0, index - 40), index),
  match: text.slice(index, index + length),
  after: text.slice(index + length, index + length + 40),
})
