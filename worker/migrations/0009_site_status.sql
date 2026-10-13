-- Permanent counters contain no visitor identifiers. Detailed requests expire after 90 days.
CREATE TABLE IF NOT EXISTS site_visit_totals (
  host TEXT NOT NULL,
  day TEXT NOT NULL,
  path TEXT NOT NULL,
  country TEXT NOT NULL,
  device TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (host, day, path, country, device)
);

CREATE TABLE IF NOT EXISTS site_visit_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  host TEXT NOT NULL,
  visited_at TEXT NOT NULL,
  path TEXT NOT NULL,
  country TEXT NOT NULL,
  device TEXT NOT NULL,
  browser TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS site_visit_details_time ON site_visit_details (visited_at);
CREATE INDEX IF NOT EXISTS site_visit_details_host_time ON site_visit_details (host, visited_at DESC);
