// AI edit safety (features/10 requirements 9 and 10, design/06). The op set is closed: nothing here can delete a paper, an annotation, or a file.
export const PAPER_FIELDS = ['title', 'authors_json', 'year', 'venue', 'doi', 'citekey', 'reading_status', 'abstract'] as const
export type PaperField = (typeof PAPER_FIELDS)[number]

export type EditOp = 'set_field' | 'add_tag' | 'remove_tag'

export interface ProposedItem {
  paperId: string
  op: EditOp
  slot: string // field name for set_field, tag name for tag ops
  after: unknown // new field value; true for add_tag, false for remove_tag
  confidence: number
  evidence: string
}

export interface ProposalItemView extends ProposedItem {
  id: string
  paperTitle: string | null
  before: unknown // value recorded when the proposal was made
  current: unknown // live value now
  stale: boolean // current differs from before, so the diff no longer shows what the user would lose
  status: 'pending' | 'applied' | 'rejected' | 'stale'
}

export interface ProposalView {
  id: string
  origin: string
  title: string
  model: string | null
  status: 'pending' | 'applied' | 'partially_applied' | 'rejected' | 'undone'
  created_at: number
  items: ProposalItemView[]
}

export const PRESELECT = 0.8

export interface UndoResult {
  undone: number
  conflicts: { itemId: string; slot: string; current: unknown; journaled: unknown }[]
}

// Lenient parse of a model reply into the closed op set; anything else is dropped, never partially kept.
export function parseProposedEdits(text: string, paperId: string): ProposedItem[] {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end <= start) return []
  let raw: unknown
  try {
    raw = JSON.parse(text.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(raw)) return []
  const out: ProposedItem[] = []
  for (const x of raw) {
    const conf = typeof x?.confidence === 'number' ? Math.min(1, Math.max(0, x.confidence)) : 0.5
    const evidence = typeof x?.reason === 'string' && x.reason ? `Model judgement: ${x.reason}` : 'Model judgement, no reason given'
    if (x?.op === 'set_field' && PAPER_FIELDS.includes(x.field) && x.after !== undefined) out.push({ paperId, op: 'set_field', slot: x.field, after: x.after, confidence: conf, evidence })
    else if ((x?.op === 'add_tag' || x?.op === 'remove_tag') && typeof x.tag === 'string' && x.tag.trim())
      out.push({ paperId, op: x.op, slot: x.tag.trim().toLowerCase(), after: x.op === 'add_tag', confidence: conf, evidence })
  }
  return out
}
