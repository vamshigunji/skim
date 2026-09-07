import type { IndexStatus, Paper } from './db'

// One row per paper for the library list: paper fields joined with its primary attachment and index state.
export interface LibraryItem {
  paper_id: string
  title: string | null
  year: number | null
  reading_status: Paper['reading_status']
  updated_at: number
  path: string | null
  page_count: number | null
  page_labels_json: string | null
  stage: IndexStatus['stage'] | null
  skip_reason: IndexStatus['skip_reason']
  error: string | null
}

export interface ImportResult {
  path: string
  status: 'imported' | 'duplicate'
  paperId: string
}
