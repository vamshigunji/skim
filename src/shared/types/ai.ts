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
  purpose: 'ask' | 'summary' | 'skim' | 'test'
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
