// Row types mirror docs/design/02-data-model.md column for column. JSON columns stay as strings here;
// parsing belongs to the feature that reads them.

export interface Paper {
  id: string
  title: string | null
  authors_json: string
  year: number | null
  venue: string | null
  doi: string | null
  arxiv_id: string | null
  abstract: string | null
  citekey: string | null
  reading_status: 'to_read' | 'skimming' | 'read' | 'cited'
  external_ids_json: string
  metadata_source: 'extracted' | 'crossref' | 'openalex' | 's2' | 'zotero' | 'user'
  created_at: number
  updated_at: number
}

export interface Attachment {
  id: string
  paper_id: string
  path: string
  sha256: string | null
  kind: 'pdf' | 'supplement'
  page_count: number | null
  page_labels_json: string | null
  has_text_layer: number | null
  managed: number
}

export interface Page {
  attachment_id: string
  page_index: number
  text: string
  width_pt: number | null
  height_pt: number | null
  rotation: number
}

export interface Annotation {
  id: string
  attachment_id: string
  page_index: number
  kind: 'highlight' | 'underline' | 'strike' | 'text' | 'area' | 'ink' | 'comment'
  rects_json: string
  color: string | null
  text: string | null
  comment: string | null
  label: string | null
  hidden: number
  source: 'user' | 'imported_pdf' | 'zotero'
  created_at: number
  updated_at: number
}

export interface Reference {
  id: string
  paper_id: string
  ordinal: number
  label: string | null
  raw: string
  parsed_json: string
  resolved_paper_id: string | null
  external_ids_json: string
  resolution_status: 'unresolved' | 'resolved' | 'ambiguous' | 'failed'
}

export interface Chunk {
  id: string
  attachment_id: string
  ordinal: number
  page_start: number
  page_end: number
  char_start: number
  char_end: number
  text: string
  section: string | null
  token_count: number | null
}

export interface IndexStatus {
  attachment_id: string
  stage: 'queued' | 'extracting' | 'ocr' | 'parsing_refs' | 'embedding' | 'ready' | 'skipped' | 'failed'
  priority: number
  skip_reason: 'no_text_layer' | 'encrypted' | 'too_large' | 'parse_error' | 'user_paused' | null
  error: string | null
  attempts: number
  extractor: string | null
  updated_at: number
}

export interface Collection {
  id: string
  parent_id: string | null
  name: string
  kind: 'manual' | 'smart'
  rule_json: string | null
}

export interface ChatThread {
  id: string
  paper_id: string | null
  collection_id: string | null
  title: string | null
  created_at: number
}

export interface ChatMessage {
  id: string
  thread_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model: string | null
  provider: string | null
  prompt_tokens: number | null
  completion_tokens: number | null
  cost_usd: number | null
  created_at: number
}

export interface Citation {
  id: string
  message_id: string
  ordinal: number
  chunk_id: string | null
  attachment_id: string | null
  page_index: number | null
  quote: string | null
  rect_json: string | null
  verified: number
  verify_method: 'exact' | 'normalized' | 'none'
}

export interface Proposal {
  id: string
  thread_id: string | null
  message_id: string | null
  kind: string
  summary: string | null
  status: 'pending' | 'applied' | 'partially_applied' | 'rejected'
  created_at: number
}

export interface ProposalItem {
  id: string
  proposal_id: string
  target_table: string
  target_id: string
  op: 'set_field' | 'add_tag' | 'remove_tag' | 'add_to_collection' | 'remove_from_collection' | 'create_collection'
  before_json: string | null
  after_json: string | null
  status: 'pending' | 'applied' | 'rejected'
}

export interface EditJournal {
  id: string
  proposal_item_id: string
  applied_at: number
  undone_at: number | null
  before_json: string | null
  after_json: string | null
}
