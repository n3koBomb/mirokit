PRAGMA foreign_keys = ON;

ALTER TABLE gallery_quotes ADD COLUMN folder_slug TEXT;

CREATE INDEX IF NOT EXISTS gallery_quotes_folder_public_index
  ON gallery_quotes (folder_slug, status, created_at DESC, id);
