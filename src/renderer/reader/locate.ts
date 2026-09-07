import { foldGlyphs } from '../../shared/verify'

// Finds a verified quote inside the PDF.js text layer so it can be flashed. Case, whitespace, and ligatures are folded like shared/verify.
const fold = (s: string) => foldGlyphs(s).replace(/\s+/g, ' ').toLowerCase()

export function findQuoteRange(roots: Iterable<Element>, quote: string) {
  const q = fold(quote).trim()
  if (!q) return null
  const at: { node: Text; offset: number }[] = [] // one entry per folded character
  let hay = ''
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null)
      for (let i = 0; i < n.data.length; i++) {
        const f = fold(n.data[i]) || ' '
        if (f === ' ' && hay.endsWith(' ')) continue
        for (const ch of f) {
          hay += ch
          at.push({ node: n, offset: i })
        }
      }
  }
  const i = hay.indexOf(q)
  if (i < 0) return null
  const end = at[i + q.length - 1]
  return { start: at[i], end: { node: end.node, offset: end.offset + 1 } }
}
