CREATE TABLE IF NOT EXISTS world_points (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  point_status TEXT NOT NULL DEFAULT 'planned' CHECK (point_status IN ('hq', 'done', 'planned')),
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  flag TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS world_point_translations (
  point_id TEXT NOT NULL REFERENCES world_points(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('ru', 'en', 'de')),
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (point_id, language)
);

CREATE INDEX IF NOT EXISTS idx_world_points_public
  ON world_points (status, sort_order, id);

CREATE TABLE IF NOT EXISTS partners (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  category TEXT NOT NULL DEFAULT 'public',
  image_url TEXT NOT NULL,
  website_url TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS partner_translations (
  partner_id TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('ru', 'en', 'de')),
  name TEXT NOT NULL,
  alt TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (partner_id, language)
);

CREATE INDEX IF NOT EXISTS idx_partners_public
  ON partners (status, category, sort_order, id);

-- Keep the current static content available immediately after the first migration.
-- These rows remain fully editable from /admin/ after import.
INSERT OR IGNORE INTO world_points (id, status, point_status, latitude, longitude, flag, sort_order, created_at, updated_at) VALUES
  ('dusseldorf', 'published', 'hq', 51.23, 6.77, '🇩🇪', 10, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('moscow', 'published', 'done', 55.75, 37.62, '🇷🇺', 20, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('saint-petersburg', 'published', 'done', 59.94, 30.31, '🇷🇺', 30, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('tunis', 'published', 'done', 36.80, 10.18, '🇹🇳', 40, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('berlin', 'published', 'planned', 52.52, 13.40, '🇩🇪', 50, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('warsaw', 'published', 'planned', 52.23, 21.01, '🇵🇱', 60, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('prague', 'published', 'planned', 50.08, 14.44, '🇨🇿', 70, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('almaty', 'published', 'planned', 43.24, 76.95, '🇰🇿', 80, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('istanbul', 'published', 'planned', 41.01, 28.98, '🇹🇷', 90, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('paris', 'published', 'planned', 48.86, 2.35, '🇫🇷', 100, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('madrid', 'published', 'planned', 40.42, -3.70, '🇪🇸', 110, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('helsinki', 'published', 'planned', 60.17, 24.94, '🇫🇮', 120, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('tokyo', 'published', 'planned', 35.69, 139.69, '🇯🇵', 130, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('bishkek', 'published', 'planned', 42.87, 74.57, '🇰🇬', 140, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('minsk', 'published', 'planned', 53.90, 27.56, '🇧🇾', 150, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('tashkent', 'published', 'planned', 41.30, 69.24, '🇺🇿', 160, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('ashgabat', 'published', 'planned', 37.96, 58.38, '🇹🇲', 170, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z');

INSERT OR IGNORE INTO world_point_translations (point_id, language, city, country) VALUES
  ('dusseldorf', 'ru', 'Дюссельдорф', 'Германия'), ('dusseldorf', 'en', 'Düsseldorf', 'Germany'), ('dusseldorf', 'de', 'Düsseldorf', 'Deutschland'),
  ('moscow', 'ru', 'Москва', 'Россия'), ('moscow', 'en', 'Moscow', 'Russia'), ('moscow', 'de', 'Moskau', 'Russland'),
  ('saint-petersburg', 'ru', 'Санкт-Петербург', 'Россия'), ('saint-petersburg', 'en', 'Saint Petersburg', 'Russia'), ('saint-petersburg', 'de', 'Sankt Petersburg', 'Russland'),
  ('tunis', 'ru', 'Тунис', 'Тунис'), ('tunis', 'en', 'Tunis', 'Tunisia'), ('tunis', 'de', 'Tunis', 'Tunesien'),
  ('berlin', 'ru', 'Берлин', 'Германия'), ('berlin', 'en', 'Berlin', 'Germany'), ('berlin', 'de', 'Berlin', 'Deutschland'),
  ('warsaw', 'ru', 'Варшава', 'Польша'), ('warsaw', 'en', 'Warsaw', 'Poland'), ('warsaw', 'de', 'Warschau', 'Polen'),
  ('prague', 'ru', 'Прага', 'Чехия'), ('prague', 'en', 'Prague', 'Czechia'), ('prague', 'de', 'Prag', 'Tschechien'),
  ('almaty', 'ru', 'Алматы', 'Казахстан'), ('almaty', 'en', 'Almaty', 'Kazakhstan'), ('almaty', 'de', 'Almaty', 'Kasachstan'),
  ('istanbul', 'ru', 'Стамбул', 'Турция'), ('istanbul', 'en', 'Istanbul', 'Türkiye'), ('istanbul', 'de', 'Istanbul', 'Türkei'),
  ('paris', 'ru', 'Париж', 'Франция'), ('paris', 'en', 'Paris', 'France'), ('paris', 'de', 'Paris', 'Frankreich'),
  ('madrid', 'ru', 'Мадрид', 'Испания'), ('madrid', 'en', 'Madrid', 'Spain'), ('madrid', 'de', 'Madrid', 'Spanien'),
  ('helsinki', 'ru', 'Хельсинки', 'Финляндия'), ('helsinki', 'en', 'Helsinki', 'Finland'), ('helsinki', 'de', 'Helsinki', 'Finnland'),
  ('tokyo', 'ru', 'Токио', 'Япония'), ('tokyo', 'en', 'Tokyo', 'Japan'), ('tokyo', 'de', 'Tokio', 'Japan'),
  ('bishkek', 'ru', 'Бишкек', 'Киргизия'), ('bishkek', 'en', 'Bishkek', 'Kyrgyzstan'), ('bishkek', 'de', 'Bischkek', 'Kirgisistan'),
  ('minsk', 'ru', 'Минск', 'Беларусь'), ('minsk', 'en', 'Minsk', 'Belarus'), ('minsk', 'de', 'Minsk', 'Belarus'),
  ('tashkent', 'ru', 'Ташкент', 'Узбекистан'), ('tashkent', 'en', 'Tashkent', 'Uzbekistan'), ('tashkent', 'de', 'Taschkent', 'Usbekistan'),
  ('ashgabat', 'ru', 'Ашхабад', 'Туркменистан'), ('ashgabat', 'en', 'Ashgabat', 'Turkmenistan'), ('ashgabat', 'de', 'Aschgabat', 'Turkmenistan');

INSERT OR IGNORE INTO partners (id, status, category, image_url, website_url, featured, sort_order, created_at, updated_at) VALUES
  ('initiative-erleben', 'published', 'public', '/public/assets/images/partners/initiative-erleben.png', '', 0, 10, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('vdochnovenije', 'published', 'public', '/public/assets/images/partners/vdochnovenije.png', '', 0, 20, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('integral-ev', 'published', 'public', '/public/assets/images/partners/integral-eV.png', '', 0, 30, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('bricks', 'published', 'social', '/public/assets/images/partners/bricks.png', '', 0, 10, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('klumba', 'published', 'social', '/public/assets/images/partners/klumba.png', '', 0, 20, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('nko-no-border', 'published', 'social', '/public/assets/images/partners/nko-no-border.png', '', 0, 30, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z'),
  ('iskra-pndj', 'published', 'education', '/public/assets/images/partners/iskra-pndj.png', '', 0, 10, '2026-09-06T00:00:00.000Z', '2026-09-06T00:00:00.000Z');

INSERT OR IGNORE INTO partner_translations (partner_id, language, name, alt) VALUES
  ('initiative-erleben', 'ru', 'Initiative Erleben', 'Initiative Erleben'), ('initiative-erleben', 'en', 'Initiative Erleben', 'Initiative Erleben'), ('initiative-erleben', 'de', 'Initiative Erleben', 'Initiative Erleben'),
  ('vdochnovenije', 'ru', 'Vdochnovenije', 'Vdochnovenije'), ('vdochnovenije', 'en', 'Center for the Realization of Creative Initiatives Inspiration', 'Center for the Realization of Creative Initiatives Inspiration'), ('vdochnovenije', 'de', 'Vdochnovenije', 'Vdochnovenije'),
  ('integral-ev', 'ru', 'Integral e.V.', 'Integral e.V.'), ('integral-ev', 'en', 'Integral e.V.', 'Integral e.V.'), ('integral-ev', 'de', 'Integral e.V.', 'Integral e.V.'),
  ('bricks', 'ru', 'Bricks Charity', 'Bricks Charity'), ('bricks', 'en', 'Bricks Charity', 'Bricks Charity'), ('bricks', 'de', 'Bricks Charity', 'Bricks Charity'),
  ('klumba', 'ru', 'Klumba', 'Klumba'), ('klumba', 'en', 'Klumba', 'Klumba'), ('klumba', 'de', 'Klumba', 'Klumba'),
  ('nko-no-border', 'ru', 'NKO no Border', 'NKO no Border'), ('nko-no-border', 'en', 'NKO no Border', 'NKO no Border'), ('nko-no-border', 'de', 'NKO no Border', 'NKO no Border'),
  ('iskra-pndj', 'ru', 'Iskra PNDJ', 'Iskra PNDJ'), ('iskra-pndj', 'en', 'Iskra PNDJ', 'Iskra PNDJ'), ('iskra-pndj', 'de', 'Iskra PNDJ', 'Iskra PNDJ');
