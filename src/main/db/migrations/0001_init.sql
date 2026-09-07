-- Skim schema v1. Source: docs/design/02-data-model.md

CREATE TABLE papers (
  id TEXT PRIMARY KEY,
  title TEXT,
  authors_json TEXT NOT NULL DEFAULT '[]',
  year INTEGER,
  venue TEXT,
  doi TEXT UNIQUE,
  arxiv_id TEXT,
  abstract TEXT,
  citekey TEXT UNIQUE,
  reading_status TEXT NOT NULL DEFAULT 'to_read',
  external_ids_json TEXT NOT NULL DEFAULT '{}',
  metadata_source TEXT NOT NULL DEFAULT 'extracted',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX papers_citekey ON papers(citekey);
CREATE INDEX papers_updated_at ON papers(updated_at);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  sha256 TEXT,
  kind TEXT NOT NULL DEFAULT 'pdf',
  page_count INTEGER,
  page_labels_json TEXT,
  has_text_layer INTEGER,
  managed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE pages (
  attachment_id TEXT NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  page_index INTEGER NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  width_pt REAL,
  height_pt REAL,
  rotation INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (attachment_id, page_index)
);
CREATE VIRTUAL TABLE pages_fts USING fts5(
  text, attachment_id UNINDEXED, page_index UNINDEXED,
  content='pages', content_rowid='rowid'
);
CREATE TRIGGER pages_ai AFTER INSERT ON pages BEGIN
  INSERT INTO pages_fts(rowid, text, attachment_id, page_index) VALUES (new.rowid, new.text, new.attachment_id, new.page_index);
END;
CREATE TRIGGER pages_ad AFTER DELETE ON pages BEGIN
  INSERT INTO pages_fts(pages_fts, rowid, text, attachment_id, page_index) VALUES ('delete', old.rowid, old.text, old.attachment_id, old.page_index);
END;
CREATE TRIGGER pages_au AFTER UPDATE ON pages BEGIN
  INSERT INTO pages_fts(pages_fts, rowid, text, attachment_id, page_index) VALUES ('delete', old.rowid, old.text, old.attachment_id, old.page_index);
  INSERT INTO pages_fts(rowid, text, attachment_id, page_index) VALUES (new.rowid, new.text, new.attachment_id, new.page_index);
END;

CREATE TABLE annotations (
  id TEXT PRIMARY KEY,
  attachment_id TEXT NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  page_index INTEGER NOT NULL,
  kind TEXT NOT NULL,
  rects_json TEXT NOT NULL DEFAULT '[]',
  color TEXT,
  text TEXT,
  comment TEXT,
  label TEXT,
  hidden INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX annotations_page ON annotations(attachment_id, page_index);

CREATE TABLE "references" (
  id TEXT PRIMARY KEY,
  paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  label TEXT,
  raw TEXT NOT NULL,
  parsed_json TEXT NOT NULL DEFAULT '{}',
  resolved_paper_id TEXT REFERENCES papers(id) ON DELETE SET NULL,
  external_ids_json TEXT NOT NULL DEFAULT '{}',
  resolution_status TEXT NOT NULL DEFAULT 'unresolved'
);
CREATE INDEX references_paper ON "references"(paper_id, ordinal);
CREATE INDEX references_resolved ON "references"(resolved_paper_id);
CREATE TABLE reference_mentions (
  reference_id TEXT NOT NULL REFERENCES "references"(id) ON DELETE CASCADE,
  page_index INTEGER NOT NULL,
  rect_json TEXT NOT NULL
);

CREATE TABLE regions (
  id TEXT PRIMARY KEY,
  attachment_id TEXT NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  page_index INTEGER NOT NULL,
  kind TEXT NOT NULL,
  rect_json TEXT NOT NULL,
  label TEXT,
  text TEXT,
  latex TEXT,
  parent_region_id TEXT REFERENCES regions(id) ON DELETE SET NULL
);
CREATE INDEX regions_page_kind ON regions(attachment_id, page_index, kind);
CREATE TABLE region_mentions (
  region_id TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  page_index INTEGER NOT NULL,
  rect_json TEXT NOT NULL
);

CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  attachment_id TEXT NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  page_start INTEGER NOT NULL,
  page_end INTEGER NOT NULL,
  char_start INTEGER NOT NULL,
  char_end INTEGER NOT NULL,
  text TEXT NOT NULL,
  section TEXT,
  token_count INTEGER
);
CREATE INDEX chunks_ordinal ON chunks(attachment_id, ordinal);
CREATE VIRTUAL TABLE chunks_fts USING fts5(text, content='chunks', content_rowid='rowid');
CREATE TRIGGER chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, text) VALUES (new.rowid, new.text);
END;
CREATE TRIGGER chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
END;
CREATE TRIGGER chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
  INSERT INTO chunks_fts(rowid, text) VALUES (new.rowid, new.text);
END;
CREATE TABLE embeddings (
  chunk_id TEXT PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  dims INTEGER NOT NULL,
  vector BLOB NOT NULL
);

CREATE TABLE index_status (
  attachment_id TEXT PRIMARY KEY REFERENCES attachments(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'queued',
  priority INTEGER NOT NULL DEFAULT 100,
  skip_reason TEXT,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  extractor TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX index_status_queue ON index_status(stage, priority);

CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES collections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'manual',
  rule_json TEXT
);
CREATE TABLE paper_collections (
  paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  PRIMARY KEY (paper_id, collection_id)
);
CREATE TABLE tags (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, color TEXT);
CREATE TABLE paper_tags (
  paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (paper_id, tag_id)
);

CREATE TABLE chat_threads (
  id TEXT PRIMARY KEY,
  paper_id TEXT REFERENCES papers(id) ON DELETE CASCADE,
  collection_id TEXT REFERENCES collections(id) ON DELETE CASCADE,
  title TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  model TEXT,
  provider TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost_usd REAL,
  created_at INTEGER NOT NULL
);
CREATE TABLE citations (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  chunk_id TEXT,
  attachment_id TEXT,
  page_index INTEGER,
  quote TEXT,
  rect_json TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  verify_method TEXT NOT NULL DEFAULT 'none'
);
CREATE INDEX citations_message ON citations(message_id);

CREATE TABLE proposals (
  id TEXT PRIMARY KEY,
  thread_id TEXT REFERENCES chat_threads(id) ON DELETE SET NULL,
  message_id TEXT,
  kind TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
);
CREATE TABLE proposal_items (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  target_table TEXT NOT NULL,
  target_id TEXT NOT NULL,
  op TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
);
-- No foreign key on purpose: journal rows outlive the rows they describe (invariant 4).
CREATE TABLE edit_journal (
  id TEXT PRIMARY KEY,
  proposal_item_id TEXT NOT NULL,
  applied_at INTEGER NOT NULL,
  undone_at INTEGER,
  before_json TEXT,
  after_json TEXT
);
CREATE INDEX edit_journal_undone ON edit_journal(undone_at);

CREATE TABLE settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
CREATE TABLE providers (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  base_url TEXT,
  model TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0
);
