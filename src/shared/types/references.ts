export interface ParsedReference {
  surnames: string[]
  title: string | null
  year: number | null
  doi: string | null
  arxiv_id: string | null
}

export interface ReferenceView {
  id: string
  ordinal: number
  label: string | null
  raw: string
  parsed_json: string
  page_index: number
  mentions: number
  library_paper_id: string | null
}

export interface RegionView {
  id: string
  kind: 'figure' | 'table' | 'equation'
  label: string
  page_index: number
  rect_json: string
  text: string
}
