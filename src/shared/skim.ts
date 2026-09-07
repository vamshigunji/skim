// Skim mode (features/04 requirement 8, design/04). Shared by main (parse) and renderer (pick).
export const SKIM_LABELS = ['goal', 'method', 'result', 'limitation'] as const
export type SkimLabel = (typeof SKIM_LABELS)[number]

export interface SkimItem {
  id: string
  pageIndex: number
  label: SkimLabel
  quote: string
  confidence: number
}

export const DENSITY = { min: 5, max: 40, default: 15 }

// Lenient: take the outermost JSON array in the reply, drop entries that are not shaped right. Small models add prose around it.
export function parseSkim(text: string): { label: SkimLabel; quote: string; confidence: number }[] {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end <= start) return []
  try {
    const raw = JSON.parse(text.slice(start, end + 1))
    if (!Array.isArray(raw)) return []
    return raw
      .filter((x) => x && typeof x.quote === 'string' && SKIM_LABELS.includes(x.label))
      .map((x) => ({ label: x.label, quote: x.quote, confidence: typeof x.confidence === 'number' ? x.confidence : 0.5 }))
  } catch {
    return []
  }
}

// Density keeps the most confident N sentences across the shown labels.
export const pickOverlays = (items: SkimItem[], density: number, hidden: SkimLabel[]) =>
  items
    .filter((i) => !hidden.includes(i.label))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, density)
