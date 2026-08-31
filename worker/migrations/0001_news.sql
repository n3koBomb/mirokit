PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS news (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('event', 'interview', 'photo', 'announce')),
  accent TEXT NOT NULL DEFAULT 'blue' CHECK (accent IN ('blue', 'red', 'green', 'amber', 'violet')),
  image_url TEXT NOT NULL,
  featured INTEGER NULL CHECK (featured IS NULL OR (featured >= 1 AND featured <= 10)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS news_translations (
  news_id TEXT NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('ru', 'en', 'de')),
  alt TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content_json TEXT NOT NULL,
  PRIMARY KEY (news_id, language)
);

CREATE INDEX IF NOT EXISTS news_public_index
  ON news (status, published_at DESC, id);

CREATE INDEX IF NOT EXISTS news_translation_index
  ON news_translations (news_id, language);
