const VIDEO_LANGUAGES = Object.freeze(["ru", "en", "de"]);
const VIDEO_SOURCE_TYPES = new Set(["youtube", "external", "r2"]);
const VIDEO_STATUSES = new Set(["draft", "published", "archived"]);
const VIDEO_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VIDEO_ASSET_PATTERN = /^\/media\/v1\/(?:videos|video-posters|subtitles)\/(?:pending\/)?[a-f0-9-]+\.[a-z0-9]+$/;

const VIDEOS_PUBLIC_QUERY = `
SELECT v.id, v.source_type, v.source_url, v.poster_url, v.duration_seconds,
  v.width, v.height, v.featured, v.sort_order,
  t.language, t.title, t.alt, t.description,
  s.id AS subtitle_id, s.language AS subtitle_language, s.label AS subtitle_label,
  s.src_lang, s.src_url AS subtitle_url, s.sort_order AS subtitle_sort_order,
  s.is_default AS subtitle_default
FROM videos v
JOIN video_translations t ON t.video_id = v.id
LEFT JOIN video_subtitles s ON s.video_id = v.id
WHERE v.status = 'published'
ORDER BY v.featured DESC, v.sort_order ASC, v.updated_at DESC, v.id ASC,
  t.language ASC, s.sort_order ASC, s.id ASC
`;

const VIDEOS_ADMIN_QUERY = VIDEOS_PUBLIC_QUERY.replace(
  "WHERE v.status = 'published'",
  ""
);

function videoError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function textValue(value, field, maxLength, { optional = false, multiline = false } = {}) {
  if (value === undefined || value === null) {
    if (optional) return "";
    throw videoError(`Invalid ${field}`);
  }
  if (typeof value !== "string") throw videoError(`Invalid ${field}`);
  const normalized = value.trim();
  if ((!optional && !normalized) || normalized.length > maxLength || (!multiline && /[\r\n]/.test(normalized))) {
    throw videoError(`Invalid ${field}`);
  }
  return normalized;
}

function optionalUrl(value, field) {
  const normalized = textValue(value, field, 2_000, { optional: true });
  if (!normalized) return "";
  if (normalized.startsWith("/media/v1/") || normalized.startsWith("/public/")) {
    if (normalized.includes("..")) throw videoError(`Invalid ${field}`);
    return normalized;
  }
  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:") throw new Error("protocol");
    return url.href;
  } catch {
    throw videoError(`${field} must be an HTTPS URL or a site media path`);
  }
}

function normalizeYoutube(value) {
  const source = textValue(value, "sourceUrl", 2_000);
  let url;
  try {
    url = new URL(source);
  } catch {
    throw videoError("Invalid YouTube URL");
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let id = "";
  if (host === "youtu.be") id = url.pathname.slice(1);
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
    if (url.pathname.startsWith("/embed/")) id = url.pathname.split("/")[2] || "";
    if (url.pathname.startsWith("/shorts/")) id = url.pathname.split("/")[2] || "";
  }
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) throw videoError("Invalid YouTube video URL");
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
}

function integerValue(value, field, minimum = 0, maximum = 10_000) {
  const number = Number(value || 0);
  if (!Number.isInteger(number) || number < minimum || number > maximum) throw videoError(`Invalid ${field}`);
  return number;
}

function translationsFor(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw videoError("Video translations are required");
  return Object.fromEntries(VIDEO_LANGUAGES.map((language) => {
    const item = input[language];
    if (!item || typeof item !== "object" || Array.isArray(item)) throw videoError(`Invalid video translation for ${language}`);
    return [language, {
      title: textValue(item.title, `title.${language}`, 500),
      alt: textValue(item.alt, `alt.${language}`, 500),
      description: textValue(item.description, `description.${language}`, 2_000, { optional: true, multiline: true }),
    }];
  }));
}

function normalizeSubtitle(value, index) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw videoError(`Invalid subtitle ${index + 1}`);
  const language = textValue(value.language, `subtitle.${index + 1}.language`, 2);
  if (!VIDEO_LANGUAGES.includes(language)) throw videoError(`Invalid subtitle language for ${language}`);
  const source = optionalUrl(value.src || value.url, `subtitle.${index + 1}.src`);
  if (value.content !== undefined && value.content !== null && typeof value.content !== "string") throw videoError(`Invalid subtitle.${index + 1}.content`);
  const content = typeof value.content === "string" ? value.content.trim() : "";
  if (content.length > 500_000) throw videoError(`Invalid subtitle.${index + 1}.content`);
  if (!source && !content) throw videoError(`Subtitle ${index + 1} needs a WebVTT file or content`);
  if (content && !/^WEBVTT(?:\s|$)/i.test(content)) throw videoError(`Subtitle ${index + 1} must be WebVTT`);
  return {
    id: value.id ? textValue(value.id, `subtitle.${index + 1}.id`, 100) : "",
    language,
    label: textValue(value.label || language.toUpperCase(), `subtitle.${index + 1}.label`, 100),
    srcLang: textValue(value.srcLang || language, `subtitle.${index + 1}.srcLang`, 10),
    src: source,
    content,
    sortOrder: integerValue(value.sortOrder, `subtitle.${index + 1}.sortOrder`, 0, 1000),
    isDefault: value.isDefault === true || value.isDefault === 1 || value.isDefault === "1" ? 1 : 0,
  };
}

function normalizeVideoInput(input, { includeStatus = true } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw videoError("Invalid video payload");
  const id = textValue(input.id, "id", 100).toLowerCase();
  if (!VIDEO_ID_PATTERN.test(id)) throw videoError("Invalid video id");
  const sourceType = textValue(input.sourceType, "sourceType", 20);
  if (!VIDEO_SOURCE_TYPES.has(sourceType)) throw videoError("Invalid video source type");
  const sourceUrl = sourceType === "youtube" ? normalizeYoutube(input.sourceUrl) : optionalUrl(input.sourceUrl, "sourceUrl");
  if (!sourceUrl) throw videoError("Video source URL is required");
  if (sourceType === "r2" && !/^\/media\/v1\/videos\/(?:pending\/)?[a-f0-9-]+\.[a-z0-9]+$/.test(sourceUrl)) {
    throw videoError("R2 videos must use a Worker media path");
  }
  const result = {
    id,
    sourceType,
    sourceUrl,
    poster: optionalUrl(input.poster, "poster"),
    durationSeconds: input.durationSeconds === null || input.durationSeconds === undefined || input.durationSeconds === "" ? null : Number(input.durationSeconds),
    width: input.width === null || input.width === undefined || input.width === "" ? null : integerValue(input.width, "width", 1, 100_000),
    height: input.height === null || input.height === undefined || input.height === "" ? null : integerValue(input.height, "height", 1, 100_000),
    featured: input.featured === true || input.featured === 1 || input.featured === "1" ? 1 : 0,
    sortOrder: integerValue(input.sortOrder, "sortOrder"),
    translations: translationsFor(input.translations),
    subtitles: Array.isArray(input.subtitles) ? input.subtitles.slice(0, 8).map(normalizeSubtitle) : [],
  };
  if (result.durationSeconds !== null && (!Number.isFinite(result.durationSeconds) || result.durationSeconds < 0 || result.durationSeconds > 86_400)) throw videoError("Invalid durationSeconds");
  if (includeStatus) {
    result.status = textValue(input.status || "draft", "status", 20);
    if (!VIDEO_STATUSES.has(result.status)) throw videoError("Invalid video status");
  }
  return result;
}

function rowsToVideos(rows) {
  const grouped = new Map();
  for (const row of rows || []) {
    if (!grouped.has(row.id)) {
      grouped.set(row.id, {
        id: row.id,
        status: row.status,
        sourceType: row.source_type,
        sourceUrl: row.source_url,
        embedUrl: row.source_type === "youtube" ? row.source_url : "",
        poster: row.poster_url || "",
        durationSeconds: row.duration_seconds === null || row.duration_seconds === undefined ? null : Number(row.duration_seconds),
        width: row.width === null || row.width === undefined ? null : Number(row.width),
        height: row.height === null || row.height === undefined ? null : Number(row.height),
        featured: Number(row.featured) === 1,
        sortOrder: Number(row.sort_order || 0),
        translations: {},
        subtitles: [],
      });
    }
    const item = grouped.get(row.id);
    item.translations[row.language] = { title: row.title, alt: row.alt, description: row.description || "" };
    if (row.subtitle_id && !item.subtitles.some((subtitle) => subtitle.id === row.subtitle_id)) {
      item.subtitles.push({
        id: row.subtitle_id,
        language: row.subtitle_language,
        label: row.subtitle_label,
        srcLang: row.src_lang,
        src: row.subtitle_url,
        sortOrder: Number(row.subtitle_sort_order || 0),
        isDefault: Number(row.subtitle_default) === 1,
      });
    }
  }
  return [...grouped.values()].map((item) => ({
    ...item,
    subtitles: item.subtitles.sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}

function rowsToPublicVideos(rows) {
  return rowsToVideos(rows).map(({ status, ...video }) => video);
}

function videoStatements(video, status, timestamp) {
  return [
    { sql: `INSERT INTO videos (id, status, source_type, source_url, poster_url, duration_seconds, width, height, featured, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = excluded.status, source_type = excluded.source_type, source_url = excluded.source_url,
      poster_url = excluded.poster_url, duration_seconds = excluded.duration_seconds, width = excluded.width, height = excluded.height,
      featured = excluded.featured, sort_order = excluded.sort_order, updated_at = excluded.updated_at`,
      params: [video.id, status, video.sourceType, video.sourceUrl, video.poster, video.durationSeconds, video.width, video.height, video.featured, video.sortOrder, timestamp, timestamp] },
    { sql: "DELETE FROM video_translations WHERE video_id = ?", params: [video.id] },
    ...VIDEO_LANGUAGES.map((language) => ({
      sql: "INSERT INTO video_translations (video_id, language, title, alt, description) VALUES (?, ?, ?, ?, ?)",
      params: [video.id, language, video.translations[language].title, video.translations[language].alt, video.translations[language].description],
    })),
    { sql: "DELETE FROM video_subtitles WHERE video_id = ?", params: [video.id] },
    ...video.subtitles.map((subtitle) => ({
      sql: "INSERT INTO video_subtitles (id, video_id, language, label, src_lang, src_url, sort_order, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      params: [subtitle.id || crypto.randomUUID(), video.id, subtitle.language, subtitle.label, subtitle.srcLang, subtitle.src, subtitle.sortOrder, subtitle.isDefault, timestamp, timestamp],
    })),
  ];
}

export {
  VIDEO_LANGUAGES,
  VIDEO_ASSET_PATTERN,
  VIDEOS_ADMIN_QUERY,
  VIDEOS_PUBLIC_QUERY,
  normalizeVideoInput,
  rowsToVideos,
  rowsToPublicVideos,
  videoError,
  videoStatements,
};
