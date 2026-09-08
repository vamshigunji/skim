export type ProviderKind = 'ollama' | 'openai' | 'anthropic'

// Row in the providers table. `openai` covers any OpenAI-compatible endpoint (OpenAI, OpenRouter, Gemini compat, a lab server).
export interface ProviderConfig {
  id: string
  kind: ProviderKind
  base_url: string | null
  model: string | null
  enabled: number
  is_default: number
}

export interface ProviderStatus extends ProviderConfig {
  local: boolean
  hasKey: boolean
  models: string[]
  reachable: boolean
  egressConfirmed: boolean
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
}

export type ChatDelta = { type: 'text'; text: string } | { type: 'usage'; input: number; output: number } | { type: 'done' } | { type: 'error'; message: string }

export interface AskRequest {
  requestId: string
  providerId?: string
  messages: ChatMessage[]
  purpose: 'ask' | 'summary' | 'skim' | 'propose' | 'test'
}

export type AskResult = { requestId: string } | { needsConfirmation: true; providerId: string; sends: string[] }

export interface UsageSummary {
  requests: number
  input: number
  output: number
  cost_usd: number
}

// What a hosted request can contain. Shown in the egress dialog (features/09 requirement 4).
export const EGRESS_SENDS = [
  'The selected text or your question',
  'Passages retrieved from the current paper or collection',
  'Paper titles and metadata needed to answer',
]

// Grounded Ask (features/04, features/10, design/04). Everything below is shared by main, preload, and renderer.
export type AnswerState = 'VERIFIED' | 'PARTIAL' | 'NOT_FOUND'

export interface Citation {
  n: number // ordinal within the answer, 1-based
  pageIndex: number
  quote: string
  verified: boolean
  paperId: string
  paper: string // citekey, shown on cross-paper chips
  pageLabel: string | null
}

// Cross-paper coverage footer (features/06 requirement 11).
export interface Coverage {
  searched: number
  contributed: number
  skipped: number // in scope but not indexed
  semantic: string // 'on' or the reason it was off
}

export type AskDelta =
  | ChatDelta
  | { type: 'citation'; citation: Citation }
  | { type: 'state'; state: AnswerState; verified: number; total: number }
  | { type: 'coverage'; coverage: Coverage }

export interface AskMessage {
  id: string
  role: 'user' | 'assistant'
  content: string // raw model output; anchors are [[c:n "quote"]], NOT_FOUND prefix marks a refusal
  citations: Citation[]
  state?: AnswerState
  coverage?: Coverage
  scope?: string[] // paper ids of a cross-paper question
}

export interface GroundedAsk {
  requestId: string
  path?: string // one open paper
  paperIds?: string[] // cross-paper scope; empty means the whole library
  question: string
  selection?: string | null
}

// One rule for the header state, applied in main when the stream ends and in the renderer for stored answers.
export const answerState = (content: string, citations: Citation[]): AnswerState =>
  content.startsWith('NOT_FOUND') ? 'NOT_FOUND' : citations.length && citations.every((c) => c.verified) ? 'VERIFIED' : 'PARTIAL'
