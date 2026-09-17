CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  start_date TEXT NOT NULL,
  end_date TEXT,
  category TEXT NOT NULL DEFAULT 'creative',
  accent TEXT NOT NULL DEFAULT 'blue',
  image_url TEXT NOT NULL DEFAULT '',
  link_url TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_translations (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('ru', 'en', 'de')),
  title TEXT NOT NULL,
  alt TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (project_id, language)
);

CREATE INDEX IF NOT EXISTS idx_projects_public
  ON projects (status, featured, sort_order, start_date, end_date);
