ALTER TABLE videos ADD COLUMN collection TEXT NOT NULL DEFAULT 'general'
  CHECK (collection IN ('general', 'interviews'));

CREATE INDEX IF NOT EXISTS idx_videos_collection_public
  ON videos (collection, status, featured, sort_order, updated_at);

CREATE TABLE IF NOT EXISTS interview_materials (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('documents', 'brochures', 'forms', 'requests')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  source_type TEXT NOT NULL CHECK (source_type IN ('external', 'r2')),
  source_url TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER,
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS interview_material_translations (
  material_id TEXT NOT NULL REFERENCES interview_materials(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('ru', 'en', 'de')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  alt TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (material_id, language)
);

CREATE INDEX IF NOT EXISTS idx_interview_materials_public
  ON interview_materials (kind, status, featured, sort_order, updated_at);
