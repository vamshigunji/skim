-- Substring search in C: the trigram tokenizer lets exact search prefilter pages with MATCH instead of scanning text in JS (design/07 budgets).
DROP TABLE pages_fts;
CREATE VIRTUAL TABLE pages_fts USING fts5(
  text, attachment_id UNINDEXED, page_index UNINDEXED,
  content='pages', content_rowid='rowid', tokenize='trigram'
);
INSERT INTO pages_fts(pages_fts) VALUES ('rebuild');
