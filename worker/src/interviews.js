const INTERVIEW_LANGUAGES = Object.freeze(["ru", "en", "de"]);
const INTERVIEW_MATERIAL_KINDS = new Set(["documents", "brochures", "forms", "requests"]);
const INTERVIEW_MATERIAL_STATUSES = new Set(["draft", "published", "archived"]);
const INTERVIEW_MATERIAL_SOURCE_TYPES = new Set(["external", "r2"]);
const INTERVIEW_MATERIAL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const INTERVIEW_MATERIAL_ASSET_PATTERN = /^\/media\/v1\/interview-materials\/(?:pending\/)?[a-f0-9-]+\.[a-z0-9]+$/;

const INTERVIEW_MATERIAL_PUBLIC_QUERY = `
SELECT m.id, m.kind, m.source_type, m.source_url, m.file_name, m.mime_type,
  m.size_bytes, m.featured, m.sort_order, m.created_at, m.updated_at,
  t.language, t.title, t.description, t.alt
FROM interview_materials m
JOIN interview_material_translations t ON t.material_id = m.id
WHERE m.status = 'published'
ORDER BY m.kind ASC, m.featured DESC, m.sort_order ASC, m.updated_at DESC,
  m.id ASC, t.language ASC
`;

const INTERVIEW_MATERIAL_ADMIN_QUERY = INTERVIEW_MATERIAL_PUBLIC_QUERY.replace(
  "WHERE m.status = 'published'",
  ""
);

function interviewMaterialError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function textValue(value, field, maxLength, { optional = false, multiline = false } = {}) {
  if (value === undefined || value === null) {
    if (optional) return "";
    throw interviewMaterialError(`Invalid ${field}`);
  }
  if (typeof value !== "string") throw interviewMaterialError(`Invalid ${field}`);
  const normalized = value.trim();
  if ((!optional && !normalized) || normalized.length > maxLength || (!multiline && /[\r\n]/.test(normalized))) {
    throw interviewMaterialError(`Invalid ${field}`);
  }
  return normalized;
}

function optionalUrl(value, field) {
  const normalized = textValue(value, field, 2_000, { optional: true });
  if (!normalized) return "";
  if (normalized.startsWith("/media/v1/") || normalized.startsWith("/public/")) {
    if (normalized.includes("..")) throw interviewMaterialError(`Invalid ${field}`);
    return normalized;
  }
  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:") throw new Error("protocol");
    return url.href;
  } catch {
    throw interviewMaterialError(`${field} must be an HTTPS URL or a site media path`);
  }
}

function integerValue(value, field, minimum = 0, maximum = 10_000) {
  const number = Number(value || 0);
  if (!Number.isInteger(number) || number < minimum || number > maximum) throw interviewMaterialError(`Invalid ${field}`);
  return number;
}

function translationsFor(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw interviewMaterialError("Interview material translations are required");
  return Object.fromEntries(INTERVIEW_LANGUAGES.map((language) => {
    const item = input[language];
    if (!item || typeof item !== "object" || Array.isArray(item)) throw interviewMaterialError(`Invalid interview material translation for ${language}`);
    return [language, {
      title: textValue(item.title, `title.${language}`, 500),
      description: textValue(item.description, `description.${language}`, 2_000, { optional: true, multiline: true }),
      alt: textValue(item.alt || item.title, `alt.${language}`, 500),
    }];
  }));
}

function normalizeInterviewMaterialInput(input, { includeStatus = true } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw interviewMaterialError("Invalid interview material payload");
  const id = textValue(input.id, "id", 100).toLowerCase();
  if (!INTERVIEW_MATERIAL_ID_PATTERN.test(id)) throw interviewMaterialError("Invalid interview material id");
  const kind = textValue(input.kind, "kind", 20);
  if (!INTERVIEW_MATERIAL_KINDS.has(kind)) throw interviewMaterialError("Invalid interview material kind");
  const sourceType = textValue(input.sourceType, "sourceType", 20);
  if (!INTERVIEW_MATERIAL_SOURCE_TYPES.has(sourceType)) throw interviewMaterialError("Invalid interview material source type");
  const sourceUrl = optionalUrl(input.sourceUrl, "sourceUrl");
  if (!sourceUrl) throw interviewMaterialError("Interview material source URL is required");
  if (sourceType === "r2" && !INTERVIEW_MATERIAL_ASSET_PATTERN.test(sourceUrl)) throw interviewMaterialError("R2 interview materials must use a Worker media path");
  const result = {
    id,
    kind,
    sourceType,
    sourceUrl,
    fileName: textValue(input.fileName, "fileName", 255, { optional: true }),
    mimeType: textValue(input.mimeType, "mimeType", 100, { optional: true }),
    sizeBytes: input.sizeBytes === null || input.sizeBytes === undefined || input.sizeBytes === "" ? null : integerValue(input.sizeBytes, "sizeBytes", 0, 2_000_000_000),
    featured: input.featured === true || input.featured === 1 || input.featured === "1" ? 1 : 0,
    sortOrder: integerValue(input.sortOrder, "sortOrder"),
    translations: translationsFor(input.translations),
  };
  if (includeStatus) {
    result.status = textValue(input.status || "draft", "status", 20);
    if (!INTERVIEW_MATERIAL_STATUSES.has(result.status)) throw interviewMaterialError("Invalid interview material status");
  }
  return result;
}

function rowsToInterviewMaterials(rows) {
  const grouped = new Map();
  for (const row of rows || []) {
    if (!grouped.has(row.id)) {
      grouped.set(row.id, {
        id: row.id,
        status: row.status,
        kind: row.kind,
        sourceType: row.source_type,
        sourceUrl: row.source_url,
        fileName: row.file_name || "",
        mimeType: row.mime_type || "",
        sizeBytes: row.size_bytes === null || row.size_bytes === undefined ? null : Number(row.size_bytes),
        featured: Number(row.featured) === 1,
        sortOrder: Number(row.sort_order || 0),
        createdAt: row.created_at || "",
        updatedAt: row.updated_at || "",
        translations: {},
      });
    }
    grouped.get(row.id).translations[row.language] = {
      title: row.title,
      description: row.description || "",
      alt: row.alt || row.title,
    };
  }
  return [...grouped.values()];
}

function rowsToPublicInterviewMaterials(rows) {
  return rowsToInterviewMaterials(rows).map(({ status, ...material }) => material);
}

function interviewMaterialStatements(material, status, timestamp) {
  return [
    { sql: `INSERT INTO interview_materials (id, kind, status, source_type, source_url, file_name, mime_type, size_bytes, featured, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, status = excluded.status, source_type = excluded.source_type,
      source_url = excluded.source_url, file_name = excluded.file_name, mime_type = excluded.mime_type, size_bytes = excluded.size_bytes,
      featured = excluded.featured, sort_order = excluded.sort_order, updated_at = excluded.updated_at`,
    params: [material.id, material.kind, status, material.sourceType, material.sourceUrl, material.fileName, material.mimeType, material.sizeBytes, material.featured, material.sortOrder, timestamp, timestamp] },
    { sql: "DELETE FROM interview_material_translations WHERE material_id = ?", params: [material.id] },
    ...INTERVIEW_LANGUAGES.map((language) => ({
      sql: "INSERT INTO interview_material_translations (material_id, language, title, description, alt) VALUES (?, ?, ?, ?, ?)",
      params: [material.id, language, material.translations[language].title, material.translations[language].description, material.translations[language].alt],
    })),
  ];
}

export {
  INTERVIEW_LANGUAGES,
  INTERVIEW_MATERIAL_ADMIN_QUERY,
  INTERVIEW_MATERIAL_ASSET_PATTERN,
  INTERVIEW_MATERIAL_KINDS,
  INTERVIEW_MATERIAL_PUBLIC_QUERY,
  interviewMaterialError,
  interviewMaterialStatements,
  normalizeInterviewMaterialInput,
  rowsToInterviewMaterials,
  rowsToPublicInterviewMaterials,
};
