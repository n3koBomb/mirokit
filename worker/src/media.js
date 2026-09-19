import { authorizeAdmin } from "./access.js";
import { SITE_HOSTS } from "./hosts.js";

const MEDIA_PREFIX = "/media/v1/";
const ADMIN_MEDIA_PREFIX = "/api/v1/admin/media/";
const PRIVATE_MEDIA_CACHE = "private, no-store";
// Publication can be revoked without changing the URL. Recheck it on every use.
const PUBLIC_MEDIA_CACHE = "public, max-age=0, must-revalidate";
const MEDIA_KEY_PATTERN = /^(?:(?:news|partners|projects|video-posters)\/(?:pending\/)?[a-f0-9-]+\.(?:jpg|png|webp|avif)|gallery\/(?:pending\/[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?\/|[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?\/)?[a-f0-9-]+\.(?:jpg|png|webp|avif)|videos\/(?:pending\/)?[a-f0-9-]+\.(?:mp4|webm|ogv)|subtitles\/(?:pending\/)?[a-z0-9-]+\.vtt)$/;

async function isPublishedMedia(env, key, object) {
	if (key.includes("/pending/")) return false;
	if (key.startsWith("gallery/")) return object.customMetadata?.status === "published";
	if (!env.SITE_DB) throw new Error("SITE_DB is not configured");
	const path = `${MEDIA_PREFIX}${key}`;
	const urls = [path, ...[...SITE_HOSTS.keys()].map((host) => `https://${host}${path}`)];
	// Check every supported reference field: a logo may also be used as a poster.
	// All values remain bound parameters, including absolute URLs on site aliases.
	const result = await env.SITE_DB.prepare(`
WITH media_urls(url) AS (VALUES ${urls.map(() => "(?)").join(", ")})
SELECT 1 AS published WHERE
  EXISTS (SELECT 1 FROM news WHERE status = 'published' AND published_at <= ? AND image_url IN (SELECT url FROM media_urls))
  OR EXISTS (SELECT 1 FROM partners WHERE status = 'published' AND image_url IN (SELECT url FROM media_urls))
  OR EXISTS (SELECT 1 FROM videos WHERE status = 'published' AND (source_url IN (SELECT url FROM media_urls) OR poster_url IN (SELECT url FROM media_urls)))
  OR EXISTS (SELECT 1 FROM projects WHERE status = 'published' AND image_url IN (SELECT url FROM media_urls))
  OR EXISTS (SELECT 1 FROM video_subtitles s JOIN videos v ON v.id = s.video_id WHERE v.status = 'published' AND s.src_url IN (SELECT url FROM media_urls))
`).bind(...urls, new Date().toISOString().slice(0, 10)).first();
	return result?.published === 1;
}

function mediaError(request, status, message, extraHeaders = {}) {
	return new Response(request.method === "HEAD" ? null : message, {
		status,
		headers: { "Cache-Control": PRIVATE_MEDIA_CACHE, "X-Content-Type-Options": "nosniff", ...extraHeaders },
	});
}

function parseRange(value, size) {
	const match = /^bytes=(\d*)-(\d*)$/.exec(value);
	if (!match || (!match[1] && !match[2]) || size <= 0) return null;
	const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
	const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
	if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return null;
	return { offset: start, length: end - start + 1 };
}

async function handleMediaRequest(request, env, url, preview = false) {
	if (preview && !(await authorizeAdmin(request, env))) return mediaError(request, 401, "Admin authentication required");
	if (!["GET", "HEAD"].includes(request.method)) return mediaError(request, 405, "Method not allowed", { Allow: "GET, HEAD" });
	const key = url.pathname.slice((preview ? ADMIN_MEDIA_PREFIX : MEDIA_PREFIX).length);
	if (!MEDIA_KEY_PATTERN.test(key) || (!preview && key.includes("/pending/"))) return mediaError(request, 404, "Not found");
	try {
		if (!env.SITE_MEDIA) throw new Error("SITE_MEDIA is not configured");
		const metadata = await env.SITE_MEDIA.head(key);
		if (!metadata || (!preview && !(await isPublishedMedia(env, key, metadata)))) return mediaError(request, 404, "Not found");

		const headers = new Headers();
		metadata.writeHttpMetadata(headers);
		headers.set("Cache-Control", preview ? PRIVATE_MEDIA_CACHE : PUBLIC_MEDIA_CACHE);
		headers.set("X-Content-Type-Options", "nosniff");
		headers.set("Accept-Ranges", "bytes");
		if (preview) headers.set("X-Robots-Tag", "noindex, nofollow");
		if (metadata.httpEtag) headers.set("ETag", metadata.httpEtag);
		// Authorization above must run before a conditional response is returned.
		if (!preview && metadata.httpEtag && request.headers.get("If-None-Match")?.split(/\s*,\s*/).some((tag) => tag === "*" || tag.replace(/^W\//, "") === metadata.httpEtag)) {
			return new Response(null, { status: 304, headers });
		}
		const rangeHeader = request.method === "GET" ? request.headers.get("Range") : null;
		const ifRange = request.headers.get("If-Range");
		const useRange = rangeHeader && (!ifRange || ifRange === metadata.httpEtag);
		const range = useRange ? parseRange(rangeHeader, metadata.size) : undefined;
		if (useRange && !range) return mediaError(request, 416, "Range not satisfiable", { "Content-Range": `bytes */${metadata.size}` });
		headers.set("Content-Length", String(range ? range.length : metadata.size));
		if (range) headers.set("Content-Range", `bytes ${range.offset}-${range.offset + range.length - 1}/${metadata.size}`);
		if (request.method === "HEAD") return new Response(null, { headers });
		const object = await env.SITE_MEDIA.get(key, range ? { range } : undefined);
		if (!object) return mediaError(request, 404, "Not found");
		return new Response(object.body, { status: range ? 206 : 200, headers });
	} catch (error) {
		console.error("Media request failed", error);
		return mediaError(request, 503, "Media service unavailable");
	}
}

export { ADMIN_MEDIA_PREFIX, PRIVATE_MEDIA_CACHE, handleMediaRequest };
