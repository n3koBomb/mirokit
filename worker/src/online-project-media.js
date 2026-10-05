import { isOnlineProjectTopic } from "../../site/source/scripts/online-project-topics.js";

const RECORD_PREFIX = "online-projects/records/";
const ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const LANGUAGES = ["ru", "en", "de"];
const VIDEO_TYPES = { "video/mp4": "mp4", "video/webm": "webm", "video/ogg": "ogv" };
const PREVIEW_TYPES = { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" };
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });

function normalizeTexts(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("Bitte die Sprachversionen ausfüllen.");
  const translations = {};
  for (const language of LANGUAGES) {
    const source = input[language];
    if (!source || typeof source.title !== "string" || !source.title.trim() || source.title.length > 500) fail(`Bitte einen Titel für ${language.toUpperCase()} angeben.`, 400);
    translations[language] = { title: source.title.trim() };
    for (const field of ["description", "transcript"]) {
      const value = source[field] ?? "";
      if (typeof value !== "string" || value.length > 10000) fail(`Ungültiger Text für ${language.toUpperCase()}.`);
      translations[language][field] = value.trim();
    }
  }
  return translations;
}

function publicItem(record, preview = false) {
  const path = (key) => `${preview ? "/api/v1/admin/media/" : "/media/v1/"}${key}`;
  return {
    id: record.id, kind: record.kind, topic: record.topic, status: record.status,
    url: path(record.fileKey), thumbnail: record.thumbnailKey ? path(record.thumbnailKey) : "",
    fileName: record.fileName, size: record.size, updatedAt: record.updatedAt,
    title: Object.fromEntries(LANGUAGES.map((lang) => [lang, record.translations[lang].title])),
    description: Object.fromEntries(LANGUAGES.map((lang) => [lang, record.translations[lang].description])),
    transcript: Object.fromEntries(LANGUAGES.map((lang) => [lang, record.translations[lang].transcript || ""])),
  };
}

async function readRecord(env, id) {
  const object = await env.SITE_MEDIA.get(`${RECORD_PREFIX}${id}.json`);
  return object ? { record: JSON.parse(await new Response(object.body).text()), object } : null;
}

async function listRecords(env, admin) {
  const items = [];
  let cursor;
  do {
    const page = await env.SITE_MEDIA.list({ prefix: RECORD_PREFIX, limit: 100, cursor });
    // Read in bounded batches rather than buffering all files or opening unlimited requests.
    for (let start = 0; start < page.objects.length; start += 10) {
      const batch = await Promise.all(page.objects.slice(start, start + 10).filter((entry) => entry.key.startsWith(RECORD_PREFIX)).map(async (entry) => {
        const id = entry.key.slice(RECORD_PREFIX.length, -5);
        return ID_PATTERN.test(id) ? readRecord(env, id) : null;
      }));
      for (const result of batch) if (result && (admin || result.record.status === "published")) items.push(publicItem(result.record, admin));
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function checkFile(file, kind) {
  if (!file || typeof file.arrayBuffer !== "function" || !file.size) fail("Bitte eine Datei auswählen.");
  const extension = kind === "document" ? (file.type === "application/pdf" ? "pdf" : null) : VIDEO_TYPES[file.type];
  if (!extension) fail(kind === "document" ? "Bitte eine PDF-Datei auswählen." : "Bitte MP4, WebM oder OGV auswählen.");
  if (file.size > (kind === "document" ? 20 : 95) * 1024 * 1024) fail(kind === "document" ? "PDF-Dateien dürfen höchstens 20 MB groß sein." : "Videos dürfen höchstens 95 MB groß sein.", 413);
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = new TextDecoder("latin1").decode(bytes);
  const valid = extension === "pdf" ? ascii.startsWith("%PDF-")
    : extension === "mp4" ? ascii.slice(4, 8) === "ftyp"
      : extension === "webm" ? bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
        : ascii.startsWith("OggS");
  if (!valid) fail("Der Dateiinhalt passt nicht zum gewählten Dateiformat.");
  return extension;
}

async function checkThumbnail(file, required) {
  if (!file || !file.size) {
    if (required) fail("Die PDF-Vorschau fehlt. Bitte die PDF erneut auswählen.");
    return "";
  }
  const extension = PREVIEW_TYPES[file.type];
  if (!extension || file.size > 2 * 1024 * 1024) fail("Das Vorschaubild muss JPG, PNG oder WebP sein und darf höchstens 2 MB groß sein.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = new TextDecoder("latin1").decode(bytes);
  const valid = extension === "jpg" ? bytes[0] === 0xff && bytes[1] === 0xd8
    : extension === "png" ? bytes[0] === 0x89 && ascii.slice(1, 4) === "PNG"
      : ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
  if (!valid) fail("Das Vorschaubild hat kein gültiges Bildformat.");
  return extension;
}

// Authentication, method checking and same-origin checking run in the existing admin router.
async function handleOnlineProjectMedia(request, env, url, admin = false) {
  try {
    if (!env.SITE_MEDIA) fail("Der Medienspeicher ist nicht verfügbar.", 503);
    if (!admin) {
      if (request.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET" } });
      return json({ success: true, media: await listRecords(env, false) });
    }
    const id = url.pathname.replace(/\/$/, "").split("/media/")[1];
    if (!id && request.method === "GET") return json({ success: true, media: await listRecords(env, true) });
    if (!id && request.method === "POST") {
      const form = await request.formData();
      const kind = form.get("kind");
      if (!["video", "document"].includes(kind)) fail("Bitte Videos oder Dokumente auswählen.");
      const topic = form.get("topic");
      if (!isOnlineProjectTopic(topic)) fail("Bitte ein gültiges Thema auswählen.");
      let texts;
      try { texts = JSON.parse(form.get("translations")); } catch { fail("Bitte die Sprachversionen ausfüllen."); }
      const translations = normalizeTexts(texts);
      const file = form.get("file");
      const extension = await checkFile(file, kind);
      const thumbnail = form.get("thumbnail");
      const thumbnailExtension = await checkThumbnail(thumbnail, kind === "document");
      const id = crypto.randomUUID();
      const record = { id, kind, topic, translations, status: "draft", fileName: file.name.slice(0, 255), size: file.size, fileKey: `online-projects/files/${id}.${extension}`, thumbnailKey: thumbnailExtension ? `online-projects/previews/${id}.${thumbnailExtension}` : "", updatedAt: new Date().toISOString() };
      const written = [];
      try {
        await env.SITE_MEDIA.put(record.fileKey, file.stream(), { httpMetadata: { contentType: file.type } });
        written.push(record.fileKey);
        if (record.thumbnailKey) {
          await env.SITE_MEDIA.put(record.thumbnailKey, thumbnail.stream(), { httpMetadata: { contentType: thumbnail.type } });
          written.push(record.thumbnailKey);
        }
        await env.SITE_MEDIA.put(`${RECORD_PREFIX}${id}.json`, JSON.stringify(record), { httpMetadata: { contentType: "application/json" } });
      } catch (error) {
        await Promise.allSettled(written.map((key) => env.SITE_MEDIA.delete(key)));
        throw error;
      }
      return json({ success: true, media: publicItem(record, true) }, 201);
    }
    if (!ID_PATTERN.test(id || "")) fail("Ungültige Medienadresse.");
    const saved = await readRecord(env, id);
    if (!saved) fail("Dieser Inhalt wurde nicht gefunden.", 404);
    const record = saved.record;
    if (request.method === "PATCH") {
      let input;
      try { input = await request.json(); } catch { fail("Die Eingaben konnten nicht gelesen werden."); }
      if (!isOnlineProjectTopic(input?.topic)) fail("Bitte ein gültiges Thema auswählen.");
      if (!["draft", "published"].includes(input?.status)) fail("Ungültiger Veröffentlichungsstatus.");
      record.topic = input.topic;
      record.translations = normalizeTexts(input.translations);
      record.status = input.status;
    } else if (request.method === "DELETE") record.status = "archived";
    else return new Response(null, { status: 405 });
    record.updatedAt = new Date().toISOString();
    const result = await env.SITE_MEDIA.put(`${RECORD_PREFIX}${id}.json`, JSON.stringify(record), { httpMetadata: { contentType: "application/json" }, onlyIf: { etagMatches: saved.object.etag } });
    if (!result) fail("Der Inhalt wurde zwischenzeitlich geändert. Bitte die Liste aktualisieren.", 409);
    return json({ success: true, media: publicItem(record, true) });
  } catch (error) {
    if (!error.status) console.error("Online project media failed", error);
    return json({ success: false, message: error.status ? error.message : "Die Medien konnten nicht gespeichert oder geladen werden." }, error.status || 500);
  }
}

async function isPublishedOnlineProjectMedia(env, key) {
  const match = key.match(/^online-projects\/(?:files|previews)\/([a-f0-9-]+)\.[a-z0-9]+$/);
  if (!match || !ID_PATTERN.test(match[1])) return false;
  const saved = await readRecord(env, match[1]);
  return saved?.record.status === "published" && [saved.record.fileKey, saved.record.thumbnailKey].includes(key);
}

export { handleOnlineProjectMedia, isPublishedOnlineProjectMedia };
