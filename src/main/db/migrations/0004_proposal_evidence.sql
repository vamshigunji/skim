-- Proposal items carry the field or tag they touch, a confidence, and evidence text. Source: docs/design/06-ai-edit-safety.md
ALTER TABLE proposals ADD COLUMN model TEXT;
ALTER TABLE proposal_items ADD COLUMN slot TEXT NOT NULL DEFAULT '';
ALTER TABLE proposal_items ADD COLUMN confidence REAL NOT NULL DEFAULT 0.5;
ALTER TABLE proposal_items ADD COLUMN evidence TEXT NOT NULL DEFAULT '';
