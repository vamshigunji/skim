-- Per-request token and cost log. Source: docs/design/04-ai-layer.md, metering.
CREATE TABLE ai_usage (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  purpose TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd REAL,
  created_at INTEGER NOT NULL
);
CREATE INDEX ai_usage_created ON ai_usage(created_at);
