CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  source_type TEXT NOT NULL CHECK (source_type IN ('youtube', 'external', 'r2')),
  source_url TEXT NOT NULL,
  poster_url TEXT NOT NULL DEFAULT '',
  duration_seconds REAL,
  width INTEGER,
  height INTEGER,
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS video_translations (
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('ru', 'en', 'de')),
  title TEXT NOT NULL,
  alt TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (video_id, language)
);

CREATE TABLE IF NOT EXISTS video_subtitles (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('ru', 'en', 'de')),
  label TEXT NOT NULL,
  src_lang TEXT NOT NULL,
  src_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_videos_public
  ON videos (status, featured, sort_order, updated_at);

CREATE INDEX IF NOT EXISTS idx_video_subtitles_video
  ON video_subtitles (video_id, sort_order, language);
