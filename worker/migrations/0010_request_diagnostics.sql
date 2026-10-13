-- Admin-only daily aggregates; no IPs, visitor IDs or per-request timestamps.
CREATE TABLE IF NOT EXISTS site_request_diagnostics (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	host TEXT NOT NULL,
	day TEXT NOT NULL,
	path TEXT NOT NULL,
	agent TEXT NOT NULL,
	is_bot INTEGER NOT NULL CHECK (is_bot IN (0, 1)),
	verified_bot INTEGER NOT NULL CHECK (verified_bot IN (0, 1)),
	dnt INTEGER NOT NULL CHECK (dnt IN (0, 1)),
	gpc INTEGER NOT NULL CHECK (gpc IN (0, 1)),
	views INTEGER NOT NULL DEFAULT 0,
	UNIQUE (host, day, path, agent, is_bot, verified_bot, dnt, gpc)
);
CREATE INDEX IF NOT EXISTS site_request_diagnostics_host_day ON site_request_diagnostics (host, day DESC);
CREATE INDEX IF NOT EXISTS site_request_diagnostics_day ON site_request_diagnostics (day);
