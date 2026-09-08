-- Cross-paper messages keep their scope and coverage footer. Source: docs/features/06-library.md requirements 11 and 12
ALTER TABLE chat_messages ADD COLUMN meta_json TEXT;
