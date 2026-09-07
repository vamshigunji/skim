// Exact-text verification (features/10 requirement 3, design/04). Normalize both sides, then substring. No fuzzy path on purpose.
const LIGATURES: Record<string, string> = { ﬀ: 'ff', ﬁ: 'fi', ﬂ: 'fl', ﬃ: 'ffi', ﬄ: 'ffl', '“': '"', '”': '"', '‘': "'", '’': "'" }
export const foldGlyphs = (s: string) => s.replace(/[ﬀﬁﬂﬃﬄ“”‘’]/g, (c) => LIGATURES[c])

export const normalize = (s: string) =>
  foldGlyphs(s)
    .replace(/­/g, '')
    .replace(/-\s*\n\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

export interface PageText {
  index: number
  text: string
}

// Preferred page first; a hit elsewhere re-points the citation. Total miss returns null and the quote is never shown as verified.
export function verifyQuote(quote: string, pages: PageText[], preferred: number): { pageIndex: number } | null {
  const q = normalize(quote)
  if (!q) return null
  const hit = [pages.find((p) => p.index === preferred), ...pages].find((p) => p && normalize(p.text).includes(q))
  return hit ? { pageIndex: hit.index } : null
}
