import { basename, extname } from 'node:path'

// Heuristics over the first pages, the PDF Info dictionary, and the filename. Resolvers refine later (05).
export function extractMetadata({ pages, info, filename, titleGuess }: { pages: string[]; info: Record<string, unknown>; filename: string; titleGuess: string | null }) {
  const text = pages.join('\n')
  const embedded = typeof info.Title === 'string' && info.Title.trim() ? info.Title.trim() : null
  return {
    title: embedded ?? titleGuess ?? basename(filename, extname(filename)),
    doi: text.match(/\b10\.\d{4,9}\/[^\s"<>]+/)?.[0].replace(/[.,;)]+$/, '').toLowerCase() ?? null,
    arxiv_id: text.match(/arXiv:\s*(\d{4}\.\d{4,5})/i)?.[1] ?? filename.match(/(\d{4}\.\d{4,5})/)?.[1] ?? null,
    year: Number(text.match(/\b(19[89]\d|20[0-4]\d)\b(?!\.\d)/)?.[1]) || null,
  }
}
