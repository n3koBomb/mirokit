const CONTENT_LANGUAGES = Object.freeze(["ru", "en", "de"]);
const CONTENT_STATUSES = new Set(["draft", "published", "archived"]);
const WORLD_POINT_STATUSES = new Set(["hq", "done", "planned"]);
const CONTENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const WORLD_PUBLIC_QUERY = `
SELECT p.id, p.point_status, p.latitude, p.longitude, p.flag, p.sort_order,
  t.language, t.city, t.country, t.description
FROM world_points p
JOIN world_point_translations t ON t.point_id = p.id
WHERE p.status = 'published'
ORDER BY p.sort_order ASC, p.id ASC, t.language ASC
`;

const WORLD_ADMIN_QUERY = `
SELECT p.id, p.status, p.point_status, p.latitude, p.longitude, p.flag, p.sort_order,
  p.created_at, p.updated_at, t.language, t.city, t.country, t.description
FROM world_points p
JOIN world_point_translations t ON t.point_id = p.id
ORDER BY p.sort_order ASC, p.updated_at DESC, p.id ASC, t.language ASC
`;

const PARTNERS_PUBLIC_QUERY = `
SELECT p.id, p.category, p.image_url, p.website_url, p.featured, p.sort_order,
  t.language, t.name, t.alt, t.description
FROM partners p
JOIN partner_translations t ON t.partner_id = p.id
WHERE p.status = 'published'
ORDER BY CASE p.category WHEN 'public' THEN 0 WHEN 'social' THEN 1 WHEN 'education' THEN 2 ELSE 3 END ASC, p.featured DESC, p.sort_order ASC, p.id ASC, t.language ASC
`;

const PARTNERS_ADMIN_QUERY = `
SELECT p.id, p.status, p.category, p.image_url, p.website_url, p.featured, p.sort_order,
  p.created_at, p.updated_at, t.language, t.name, t.alt, t.description
FROM partners p
JOIN partner_translations t ON t.partner_id = p.id
ORDER BY CASE p.category WHEN 'public' THEN 0 WHEN 'social' THEN 1 WHEN 'education' THEN 2 ELSE 3 END ASC, p.sort_order ASC, p.updated_at DESC, p.id ASC, t.language ASC
`;

function contentError(message, status = 400) {

	const error = new Error(message);
	error.status = status;
	return error;
}

function textValue(value, field, maxLength, { optional = false } = {}) {
	if (value === undefined || value === null) {
		if (optional) return "";
		throw contentError(`Invalid ${field}`);
	}
	if (typeof value !== "string") throw contentError(`Invalid ${field}`);
	const normalized = value.trim();
	if ((!optional && !normalized) || normalized.length > maxLength) {
		throw contentError(`Invalid ${field}`);
	}
	return normalized;
}

function contentId(value) {
	const id = textValue(value, "id", 100).toLowerCase();
	if (!CONTENT_ID_PATTERN.test(id)) throw contentError("Invalid id");
	return id;
}

function contentStatus(value) {
	const status = textValue(value || "draft", "status", 20);
	if (!CONTENT_STATUSES.has(status)) throw contentError("Invalid status");
	return status;
}

function numberValue(value, field, minimum, maximum) {
	const number = Number(value);
	if (!Number.isFinite(number) || number < minimum || number > maximum) {
		throw contentError(`Invalid ${field}`);
	}
	return number;
}

function integerValue(value, field, minimum = 0, maximum = 10_000) {
	const number = Number(value || 0);
	if (!Number.isInteger(number) || number < minimum || number > maximum) {
		throw contentError(`Invalid ${field}`);
	}
	return number;
}

function optionalUrl(value, field) {
	const url = textValue(value, field, 2_000, { optional: true });
	if (!url) return "";
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "https:") throw new Error("protocol");
		return parsed.href;
	} catch {
		throw contentError(`${field} must be an HTTPS URL`);
	}
}

function localImageUrl(value, field = "image") {
	const image = textValue(value, field, 2_000);
	if (image.startsWith("/media/v1/") || image.startsWith("/public/")) {
		if (image.includes("..") || /[\r\n]/.test(image)) throw contentError(`Invalid ${field}`);
		return image;
	}
	return optionalUrl(image, field);
}

function translationsFor(input, kind) {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		throw contentError(`${kind} translations are required`);
	}
	return Object.fromEntries(CONTENT_LANGUAGES.map((language) => {
		const translation = input[language];
		if (!translation || typeof translation !== "object" || Array.isArray(translation)) {
			throw contentError(`Invalid ${kind} translation for ${language}`);
		}
		if (kind === "world point") {
			return [language, {
				city: textValue(translation.city, `city.${language}`, 300),
				country: textValue(translation.country, `country.${language}`, 300),
				description: textValue(translation.description, `description.${language}`, 1_000, { optional: true }),
			}];
		}
		return [language, {
			name: textValue(translation.name, `name.${language}`, 500),
			alt: textValue(translation.alt, `alt.${language}`, 500),
			description: textValue(translation.description, `description.${language}`, 1_000, { optional: true }),
		}];
	}));
}

function normalizeWorldPointInput(input, { includeStatus = true } = {}) {
	if (!input || typeof input !== "object" || Array.isArray(input)) throw contentError("Invalid world point payload");
	const pointStatus = textValue(input.pointStatus || "planned", "pointStatus", 20);
	if (!WORLD_POINT_STATUSES.has(pointStatus)) throw contentError("Invalid point status");
	const result = {
		id: contentId(input.id),
		pointStatus,
		latitude: numberValue(input.latitude, "latitude", -90, 90),
		longitude: numberValue(input.longitude, "longitude", -180, 180),
		flag: textValue(input.flag, "flag", 16, { optional: true }),
		sortOrder: integerValue(input.sortOrder, "sortOrder"),
		translations: translationsFor(input.translations, "world point"),
	};
	if (includeStatus) result.status = contentStatus(input.status);
	return result;
}

function normalizePartnerInput(input, { includeStatus = true } = {}) {
	if (!input || typeof input !== "object" || Array.isArray(input)) throw contentError("Invalid partner payload");
	const result = {
		id: contentId(input.id),
		category: textValue(input.category || "public", "category", 80),
		image: localImageUrl(input.image),
		website: optionalUrl(input.website, "website"),
		featured: input.featured === true || input.featured === 1 || input.featured === "1" ? 1 : 0,
		sortOrder: integerValue(input.sortOrder, "sortOrder"),
		translations: translationsFor(input.translations, "partner"),
	};
	if (includeStatus) result.status = contentStatus(input.status);
	return result;
}

function rowsToWorldPoints(rows) {
	const grouped = new Map();
	for (const row of rows || []) {
		if (!grouped.has(row.id)) {
			grouped.set(row.id, {
				id: row.id,
				status: row.status,
				pointStatus: row.point_status,
				latitude: Number(row.latitude),
				longitude: Number(row.longitude),
				flag: row.flag || "",
				sortOrder: Number(row.sort_order || 0),
				translations: {},
			});
		}
		grouped.get(row.id).translations[row.language] = {
			city: row.city,
			country: row.country,
			description: row.description || "",
		};
	}
	return [...grouped.values()];
}

function rowsToPublicWorldPoints(rows) {
	return rowsToWorldPoints(rows).map(({ status, ...point }) => point);
}

function rowsToPartners(rows) {
	const grouped = new Map();
	for (const row of rows || []) {
		if (!grouped.has(row.id)) {
			grouped.set(row.id, {
				id: row.id,
				status: row.status,
				category: row.category,
				image: row.image_url,
				website: row.website_url || "",
				featured: Number(row.featured) === 1,
				sortOrder: Number(row.sort_order || 0),
				translations: {},
			});
		}
		grouped.get(row.id).translations[row.language] = {
			name: row.name,
			alt: row.alt,
			description: row.description || "",
		};
	}
	return [...grouped.values()];
}

function rowsToPublicPartners(rows) {
	return rowsToPartners(rows).map(({ status, ...partner }) => partner);
}

function worldPointStatements(point, status, now) {
	return [
		{
			sql: `INSERT INTO world_points (id, status, point_status, latitude, longitude, flag, sort_order, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM world_points WHERE id = ?), ?), ?)
ON CONFLICT(id) DO UPDATE SET status = excluded.status, point_status = excluded.point_status, latitude = excluded.latitude, longitude = excluded.longitude, flag = excluded.flag, sort_order = excluded.sort_order, updated_at = excluded.updated_at`,
			params: [point.id, status, point.pointStatus, point.latitude, point.longitude, point.flag, point.sortOrder, point.id, now, now],
		},
		...CONTENT_LANGUAGES.map((language) => ({
			sql: `INSERT INTO world_point_translations (point_id, language, city, country, description) VALUES (?, ?, ?, ?, ?)
ON CONFLICT(point_id, language) DO UPDATE SET city = excluded.city, country = excluded.country, description = excluded.description`,
			params: [point.id, language, point.translations[language].city, point.translations[language].country, point.translations[language].description],
		})),
	];
}

function partnerStatements(partner, status, now) {
	return [
		{
			sql: `INSERT INTO partners (id, status, category, image_url, website_url, featured, sort_order, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM partners WHERE id = ?), ?), ?)
ON CONFLICT(id) DO UPDATE SET status = excluded.status, category = excluded.category, image_url = excluded.image_url, website_url = excluded.website_url, featured = excluded.featured, sort_order = excluded.sort_order, updated_at = excluded.updated_at`,
			params: [partner.id, status, partner.category, partner.image, partner.website, partner.featured, partner.sortOrder, partner.id, now, now],
		},
		...CONTENT_LANGUAGES.map((language) => ({
			sql: `INSERT INTO partner_translations (partner_id, language, name, alt, description) VALUES (?, ?, ?, ?, ?)
ON CONFLICT(partner_id, language) DO UPDATE SET name = excluded.name, alt = excluded.alt, description = excluded.description`,
			params: [partner.id, language, partner.translations[language].name, partner.translations[language].alt, partner.translations[language].description],
		})),
	];
}

export {
	CONTENT_LANGUAGES,
	CONTENT_STATUSES,
	PARTNERS_ADMIN_QUERY,
	PARTNERS_PUBLIC_QUERY,
	WORLD_ADMIN_QUERY,
	WORLD_PUBLIC_QUERY,
	contentError,
	normalizePartnerInput,
	normalizeWorldPointInput,
	partnerStatements,
	rowsToPartners,
	rowsToPublicPartners,
	rowsToPublicWorldPoints,
	rowsToWorldPoints,
	worldPointStatements,
};
