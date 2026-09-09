PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS gallery_quotes (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gallery_quote_translations (
  quote_id TEXT NOT NULL REFERENCES gallery_quotes(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('ru', 'en', 'de')),
  quote TEXT NOT NULL,
  byline TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (quote_id, language)
);

CREATE INDEX IF NOT EXISTS gallery_quotes_public_index
  ON gallery_quotes (status, created_at DESC, id);

CREATE INDEX IF NOT EXISTS gallery_quote_translation_index
  ON gallery_quote_translations (quote_id, language);
