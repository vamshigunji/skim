-- Verified Skim-mode labels per attachment and model. Rects are located in the text layer at render time. Source: docs/design/04-ai-layer.md
CREATE TABLE skim_overlays (
  id TEXT PRIMARY KEY,
  attachment_id TEXT NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  page_index INTEGER NOT NULL,
  label TEXT NOT NULL,
  quote TEXT NOT NULL,
  confidence REAL NOT NULL,
  model TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX skim_overlays_attachment ON skim_overlays(attachment_id);
