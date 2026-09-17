const PROJECT_LANGUAGES = Object.freeze(["ru", "en", "de"]);
const PROJECT_STATUSES = new Set(["draft", "published", "archived"]);
const PROJECT_CATEGORIES = new Set(["creative", "game", "dialogue", "media", "network", "education"]);
const PROJECT_ACCENTS = new Set(["blue", "red", "green", "amber", "violet"]);
const PROJECT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const PROJECTS_PUBLIC_QUERY = `
SELECT p.id, p.start_date, p.end_date, p.category, p.accent, p.image_url, p.link_url,
  p.featured, p.sort_order, t.language, t.title, t.alt, t.description
FROM projects p
JOIN project_translations t ON t.project_id = p.id
WHERE p.status = 'published'
ORDER BY p.featured DESC, p.sort_order ASC, p.start_date DESC, p.id ASC, t.language ASC
`;

const PROJECTS_ADMIN_QUERY = `
SELECT p.id, p.status, p.start_date, p.end_date, p.category, p.accent, p.image_url, p.link_url,
  p.featured, p.sort_order, p.created_at, p.updated_at,
  t.language, t.title, t.alt, t.description
FROM projects p
JOIN project_translations t ON t.project_id = p.id
ORDER BY p.status ASC, p.featured DESC, p.sort_order ASC, p.start_date DESC, p.updated_at DESC, p.id ASC, t.language ASC
`;

function projectError(message, status = 400) {
	const error = new Error(message);
	error.status = status;
	return error;
}

function textValue(value, field, maxLength, { optional = false } = {}) {
	if (value === undefined || value === null) {
		if (optional) return "";
		throw projectError(`Invalid ${field}`);
	}
	if (typeof value !== "string") throw projectError(`Invalid ${field}`);
	const normalized = value.trim();
	if ((!optional && !normalized) || normalized.length > maxLength) throw projectError(`Invalid ${field}`);
	return normalized;
}

function projectId(value) {
	const id = textValue(value, "id", 100).toLowerCase();
	if (!PROJECT_ID_PATTERN.test(id)) throw projectError("Invalid id");
	return id;
}

function projectDate(value, field, { optional = false } = {}) {
	const date = textValue(value, field, 10, { optional });
	if (!date) return null;
	if (!DATE_PATTERN.test(date)) throw projectError(`Invalid ${field}`);
	const parsed = new Date(`${date}T12:00:00Z`);
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw projectError(`Invalid ${field}`);
	return date;
}

function projectStatus(value) {
	const status = textValue(value || "draft", "status", 20);
	if (!PROJECT_STATUSES.has(status)) throw projectError("Invalid status");
	return status;
}

function integerValue(value, field, minimum = 0, maximum = 10_000) {
	const number = Number(value || 0);
	if (!Number.isInteger(number) || number < minimum || number > maximum) throw projectError(`Invalid ${field}`);
	return number;
}

function localImageUrl(value) {
	const image = textValue(value, "image", 2_000, { optional: true });
	if (!image) return "";
	if (image.startsWith("/media/v1/") || image.startsWith("/public/")) {
		if (image.includes("..") || /[\r\n]/.test(image)) throw projectError("Invalid image");
		return image;
	}
	try {
		const url = new URL(image);
		if (url.protocol !== "https:") throw new Error("protocol");
		return url.href;
	} catch {
		throw projectError("image must be a local media path or HTTPS URL");
	}
}

function linkUrl(value) {
	const link = textValue(value, "linkUrl", 2_000, { optional: true });
	if (!link) return "";
	if (link.startsWith("/")) {
		if (link.includes("..") || /[\r\n]/.test(link)) throw projectError("Invalid linkUrl");
		return link;
	}
	try {
		const url = new URL(link);
		if (url.protocol !== "https:") throw new Error("protocol");
		return url.href;
	} catch {
		throw projectError("linkUrl must be a local path or HTTPS URL");
	}
}

function translationsFor(input) {
	if (!input || typeof input !== "object" || Array.isArray(input)) throw projectError("Project translations are required");
	return Object.fromEntries(PROJECT_LANGUAGES.map((language) => {
		const translation = input[language];
		if (!translation || typeof translation !== "object" || Array.isArray(translation)) throw projectError(`Invalid project translation for ${language}`);
		return [language, {
			title: textValue(translation.title, `title.${language}`, 500),
			alt: textValue(translation.alt, `alt.${language}`, 500),
			description: textValue(translation.description, `description.${language}`, 2_000, { optional: true }),
		}];
	}));
}

function normalizeProjectInput(input, { includeStatus = true } = {}) {
	if (!input || typeof input !== "object" || Array.isArray(input)) throw projectError("Invalid project payload");
	const category = textValue(input.category || "creative", "category", 40);
	if (!PROJECT_CATEGORIES.has(category)) throw projectError("Invalid project category");
	const accent = textValue(input.accent || "blue", "accent", 20);
	if (!PROJECT_ACCENTS.has(accent)) throw projectError("Invalid project accent");
	const startDate = projectDate(input.startDate, "startDate");
	const endDate = projectDate(input.endDate, "endDate", { optional: true });
	if (endDate && endDate < startDate) throw projectError("endDate must be on or after startDate");
	const result = {
		id: projectId(input.id),
		startDate,
		endDate,
		category,
		accent,
		image: localImageUrl(input.image),
		linkUrl: linkUrl(input.linkUrl),
		featured: input.featured === true || input.featured === 1 || input.featured === "1" ? 1 : 0,
		sortOrder: integerValue(input.sortOrder, "sortOrder"),
		translations: translationsFor(input.translations),
	};
	if (includeStatus) result.status = projectStatus(input.status);
	return result;
}

function projectPhase(item, today = new Date().toISOString().slice(0, 10)) {
	if (item.endDate && item.endDate < today) return "past";
	if (item.startDate > today) return "upcoming";
	return "current";
}

function rowsToProjects(rows, today) {
	const grouped = new Map();
	for (const row of rows || []) {
		if (!grouped.has(row.id)) {
			const item = {
				id: row.id,
				status: row.status,
				startDate: row.start_date,
				endDate: row.end_date || null,
				category: row.category,
				accent: row.accent,
				image: row.image_url || "",
				linkUrl: row.link_url || "",
				featured: Number(row.featured) === 1,
				sortOrder: Number(row.sort_order || 0),
				translations: {},
			};
			if (row.created_at) item.createdAt = row.created_at;
			if (row.updated_at) item.updatedAt = row.updated_at;
			item.phase = projectPhase(item, today);
			grouped.set(row.id, item);
		}
		grouped.get(row.id).translations[row.language] = {
			title: row.title,
			alt: row.alt,
			description: row.description || "",
		};
	}
	return [...grouped.values()];
}

function rowsToPublicProjects(rows, today) {
	return rowsToProjects(rows, today).map(({ status, createdAt, updatedAt, ...project }) => project);
}

function projectStatements(project, status, now) {
	return [
		{
			sql: `INSERT INTO projects (id, status, start_date, end_date, category, accent, image_url, link_url, featured, sort_order, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM projects WHERE id = ?), ?), ?)
ON CONFLICT(id) DO UPDATE SET status = excluded.status, start_date = excluded.start_date, end_date = excluded.end_date, category = excluded.category, accent = excluded.accent, image_url = excluded.image_url, link_url = excluded.link_url, featured = excluded.featured, sort_order = excluded.sort_order, updated_at = excluded.updated_at`,
			params: [project.id, status, project.startDate, project.endDate, project.category, project.accent, project.image, project.linkUrl, project.featured, project.sortOrder, project.id, now, now],
		},
		...PROJECT_LANGUAGES.map((language) => ({
			sql: `INSERT INTO project_translations (project_id, language, title, alt, description) VALUES (?, ?, ?, ?, ?)
ON CONFLICT(project_id, language) DO UPDATE SET title = excluded.title, alt = excluded.alt, description = excluded.description`,
			params: [project.id, language, project.translations[language].title, project.translations[language].alt, project.translations[language].description],
		})),
	];
}

export {
	PROJECT_LANGUAGES,
	PROJECTS_ADMIN_QUERY,
	PROJECTS_PUBLIC_QUERY,
	projectError,
	normalizeProjectInput,
	projectStatements,
	rowsToProjects,
	rowsToPublicProjects,
};
