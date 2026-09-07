export interface SearchOptions {
  caseSensitive?: boolean
  wholeWord?: boolean
  regex?: boolean
}

export interface SearchRequest {
  query: string
  options: SearchOptions
  path?: string
}

export interface SearchHit {
  paper_id: string
  title: string | null
  page_index: number
  label: string
  before: string
  match: string
  after: string
}
