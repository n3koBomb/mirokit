const NEWS_LANGUAGES = Object.freeze(["ru", "en", "de"]);
const NEWS_CATEGORIES = new Set(["event", "interview", "photo", "announce"]);
const NEWS_ACCENTS = new Set(["blue", "red", "green", "amber", "violet"]);
const NEWS_STATUSES = new Set(["draft", "published", "archived"]);
const NEWS_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NEWS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const NEWS_PUBLIC_QUERY = `
SELECT
  n.id,
  n.published_at,
  n.category,
  n.accent,
  n.image_url,
  n.featured,
  t.language,
  t.alt,
  t.title,
  t.summary,
  t.content_json
FROM news n
JOIN news_translations t ON t.news_id = n.id
WHERE n.status = 'published'
  AND n.published_at <= ?
ORDER BY n.published_at DESC, n.id ASC
`;

const NEWS_ADMIN_QUERY = `
SELECT
  n.id,
  n.status,
  n.published_at,
  n.category,
  n.accent,
  n.image_url,
  n.featured,
  n.created_at,
  n.updated_at,
  t.language,
  t.alt,
  t.title,
  t.summary,
  t.content_json
FROM news n
JOIN news_translations t ON t.news_id = n.id
ORDER BY n.published_at DESC, n.updated_at DESC, n.id ASC
`;

function newsError(message, status = 400) {
	const error = new Error(message);
	error.status = status;
	return error;
}

function requireString(value, field, maxLength) {
	if (typeof value !== "string") {
		throw newsError(`Invalid ${field}`);
	}

	const normalized = value.trim();
	if (!normalized || normalized.length > maxLength) {
		throw newsError(`Invalid ${field}`);
	}

	return normalized;
}

function validateDate(value) {
	const date = requireString(value, "publishedAt", 10);
	if (!NEWS_DATE_PATTERN.test(date)) throw newsError("Invalid publishedAt");

	const parsed = new Date(`${date}T12:00:00Z`);
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
		throw newsError("Invalid publishedAt");
	}

	return date;
}

function validateImage(value) {
	const image = requireString(value, "image", 2_000);
	if (image.startsWith("/news-media/") || image.startsWith("/public/")) {
		if (image.includes("..") || /[\r\n]/.test(image)) throw newsError("Invalid image");
		return image;
	}

	try {
		const url = new URL(image);
		if (url.protocol !== "https:") throw new Error("protocol");
		return url.href;
	} catch {
		throw newsError("Image must be an HTTPS URL or a /news-media/ path");
	}
}

function validateContent(value, language) {
	if (!Array.isArray(value) || value.length === 0 || value.length > 30) {
		throw newsError(`Invalid content for ${language}`);
	}

	return value.map((paragraph) => requireString(paragraph, `content.${language}`, 5_000));
}

function validateTranslation(value, language) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw newsError(`Invalid translation for ${language}`);
	}

	return {
		alt: requireString(value.alt, `alt.${language}`, 500),
		title: requireString(value.title, `title.${language}`, 500),
		summary: requireString(value.summary, `summary.${language}`, 2_000),
		content: validateContent(value.content, language),
	};
}

function normalizeNewsInput(input, { includeStatus = false } = {}) {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		throw newsError("Invalid news payload");
	}

	const id = requireString(input.id, "id", 100).toLowerCase();
	if (!NEWS_ID_PATTERN.test(id)) throw newsError("Invalid id");

	const category = requireString(input.category, "category", 20);
	if (!NEWS_CATEGORIES.has(category)) throw newsError("Invalid category");

	const accent = requireString(input.accent, "accent", 20);
	if (!NEWS_ACCENTS.has(accent)) throw newsError("Invalid accent");

	const featured = input.featured === false || input.featured === null || input.featured === undefined
		? false
		: Number(input.featured);
	if (featured !== false && (!Number.isInteger(featured) || featured < 1 || featured > 10)) {
		throw newsError("Invalid featured rank");
	}

	const translations = {};
	if (!input.translations || typeof input.translations !== "object") {
		throw newsError("Translations are required");
	}

	for (const language of NEWS_LANGUAGES) {
		translations[language] = validateTranslation(input.translations[language], language);
	}

	const normalized = {
		id,
		publishedAt: validateDate(input.publishedAt),
		category,
		accent,
		image: validateImage(input.image),
		featured,
		translations,
	};

	if (includeStatus) {
		const status = requireString(input.status || "draft", "status", 20);
		if (!NEWS_STATUSES.has(status)) throw newsError("Invalid status");
		normalized.status = status;
	}

	return normalized;
}

function rowsToNews(rows) {
	const byId = new Map();

	for (const row of rows) {
		let item = byId.get(row.id);
		if (!item) {
			item = {
				id: row.id,
				publishedAt: row.published_at,
				category: row.category,
				accent: row.accent,
				image: row.image_url,
				featured: row.featured === null ? false : Number(row.featured),
				title: {},
				summary: {},
				alt: {},
				content: {},
			};
			byId.set(row.id, item);
		}

		item.title[row.language] = row.title;
		item.summary[row.language] = row.summary;
		item.alt[row.language] = row.alt;
		try {
			item.content[row.language] = JSON.parse(row.content_json);
		} catch {
			item.content[row.language] = [];
		}
	}

	return [...byId.values()];
}

function rowsToAdminNews(rows) {
	const byId = new Map();

	for (const row of rows) {
		let item = byId.get(row.id);
		if (!item) {
			item = {
				id: row.id,
				status: row.status,
				publishedAt: row.published_at,
				category: row.category,
				accent: row.accent,
				image: row.image_url,
				featured: row.featured === null ? false : Number(row.featured),
				createdAt: row.created_at,
				updatedAt: row.updated_at,
				translations: {},
			};
			byId.set(row.id, item);
		}

		item.translations[row.language] = {
			alt: row.alt,
			title: row.title,
			summary: row.summary,
			content: JSON.parse(row.content_json),
		};
	}

	return [...byId.values()];
}

function newsToStatements(news, status, now) {
	const statements = [
		{
			sql: `INSERT INTO news (id, status, published_at, category, accent, image_url, featured, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM news WHERE id = ?), ?), ?)
ON CONFLICT(id) DO UPDATE SET
  status = excluded.status,
  published_at = excluded.published_at,
  category = excluded.category,
  accent = excluded.accent,
  image_url = excluded.image_url,
  featured = excluded.featured,
  updated_at = excluded.updated_at`,
			params: [
				news.id,
				status,
				news.publishedAt,
				news.category,
				news.accent,
				news.image,
				news.featured === false ? null : news.featured,
				news.id,
				now,
				now,
			],
		},
	];

	for (const language of NEWS_LANGUAGES) {
		const translation = news.translations[language];
		statements.push({
			sql: `INSERT INTO news_translations (news_id, language, alt, title, summary, content_json)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(news_id, language) DO UPDATE SET
  alt = excluded.alt,
  title = excluded.title,
  summary = excluded.summary,
  content_json = excluded.content_json`,
			params: [
				news.id,
				language,
				translation.alt,
				translation.title,
				translation.summary,
				JSON.stringify(translation.content),
			],
		});
	}

	return statements;
}

export {
	NEWS_ADMIN_QUERY,
	NEWS_LANGUAGES,
	NEWS_PUBLIC_QUERY,
	newsError,
	normalizeNewsInput,
	newsToStatements,
	rowsToAdminNews,
	rowsToNews,
};
