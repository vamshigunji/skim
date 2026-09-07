export interface Mention {
  index: number
  length: number
  kind: 'cite' | 'figure' | 'table' | 'equation'
  keys: string[] // cite: ordinals or `surname:year`; region: label
}

const NAME = "[A-Z][A-Za-z'’-]+"
const patterns: [RegExp, (m: RegExpMatchArray) => Mention['keys'], Mention['kind'] | null][] = [
  [/(?<!\w)\[(\d{1,3}(?:\s*[-–]\s*\d{1,3})?(?:\s*,\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?)*)\]/g, (m) => expand(m[1]), 'cite'],
  [new RegExp(`\\b(${NAME})(?: et al\\.| and ${NAME})? \\((\\d{4}[a-z]?)\\)`, 'g'), (m) => [`${m[1].toLowerCase()}:${m[2]}`], 'cite'],
  [new RegExp(`\\((${NAME})(?: et al\\.| and ${NAME})?,? (\\d{4}[a-z]?)\\)`, 'g'), (m) => [`${m[1].toLowerCase()}:${m[2]}`], 'cite'],
  [/\b(Fig\.|Figure|Table|Eq\.|Equation)\s*\(?(\d+[a-z]?|[IVX]+)\)?/g, (m) => [m[2]], null],
]

const kindOf = (word: string): Mention['kind'] => (word.startsWith('Fig') ? 'figure' : word.startsWith('Tab') ? 'table' : 'equation')

function expand(list: string): string[] {
  const out: string[] = []
  for (const part of list.split(',')) {
    const [a, b = a] = part.split(/[-–]/).map((s) => +s.trim())
    for (let n = a; n <= Math.min(b, a + 50); n++) if (n >= 1) out.push(String(n))
  }
  return out
}

// In-text citation and figure/table/equation references, without needing PDF link annotations.
export function findMentions(text: string): Mention[] {
  const found: Mention[] = []
  for (const [re, keys, kind] of patterns)
    for (const m of text.matchAll(re)) {
      const k = keys(m)
      if (k.length) found.push({ index: m.index, length: m[0].length, kind: kind ?? kindOf(m[1]), keys: k })
    }
  found.sort((a, b) => a.index - b.index)
  return found.filter((m, i) => i === 0 || m.index >= found[i - 1].index + found[i - 1].length)
}
