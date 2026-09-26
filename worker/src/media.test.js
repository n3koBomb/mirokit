import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "./index.js";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const localHeaders = { "X-MiroKIT-Admin-Token": "local-token" };
let db, objects, env;
function addObject(key, metadata = {}) {
	objects.set(key, { body: "0123456789", customMetadata: metadata });
}
function objectMetadata(key) {
	const item = objects.get(key);
	return item && { key, size: item.body.length, httpEtag: '"test-etag"', customMetadata: item.customMetadata,
		writeHttpMetadata(headers) { headers.set("Content-Type", "application/octet-stream"); headers.set("Cache-Control", "public, max-age=31536000, immutable"); } };
}
function request(key, options = {}, preview = false) {
	return worker.fetch(new Request(`http://localhost:8787/${preview ? "api/v1/admin/media" : "media/v1"}/${key}`, options), env);
}
function news(key, status = "published", date = "2020-01-01") {
	db.prepare("INSERT INTO news (id,status,published_at,category,image_url,created_at,updated_at) VALUES ('item',?,?,'event',?,'now','now')").run(status, date, `/media/v1/${key}`);
}
function video(key, status = "published", field = "source_url") {
	db.prepare(`INSERT INTO videos (id,status,source_type,source_url,poster_url,created_at,updated_at) VALUES ('item',?,'r2',?,?,'now','now')`).run(status, field === "source_url" ? `/media/v1/${key}` : "", field === "poster_url" ? `/media/v1/${key}` : "");
	if (field === "src_url") db.prepare("INSERT INTO video_subtitles (id,video_id,language,label,src_lang,src_url,created_at,updated_at) VALUES ('subtitle','item','en','English','en',?,'now','now')").run(`/media/v1/${key}`);
}

beforeEach(() => {
	db = new DatabaseSync(":memory:");
	for (const file of ["0001_news.sql", "0002_gallery_quotes.sql", "0003_world_points_partners.sql", "0004_videos.sql", "0005_projects.sql", "0006_gallery_quote_folders.sql", "0007_news_links.sql", "0008_interviews.sql"]) db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
	objects = new Map();
	const statement = (sql, params = []) => ({
		bind: (...values) => statement(sql, values),
		first: async () => db.prepare(sql).get(...params) || null,
		all: async () => ({ results: db.prepare(sql).all(...params) }),
		run: async () => ({ meta: db.prepare(sql).run(...params) }),
	});
	env = {
		ADMIN_DEV_TOKEN: "local-token",
		SITE_DB: { prepare: (sql) => statement(sql), batch: async (statements) => Promise.all(statements.map((item) => item.run())) },
		SITE_MEDIA: {
			head: vi.fn(async (key) => objectMetadata(key)),
			get: vi.fn(async (key, options) => {
				const metadata = objectMetadata(key);
				if (!metadata) return null;
				const body = objects.get(key).body;
				return { ...metadata, body: options?.range ? body.slice(options.range.offset, options.range.offset + options.range.length) : body };
			}),
			put: vi.fn(async (key, body, options) => objects.set(key, { body: typeof body === "string" ? body : await new Response(body).text(), customMetadata: options?.customMetadata || {} })),
			delete: vi.fn(async (key) => objects.delete(key)),
		},
	};
});
afterEach(() => { db.close(); vi.restoreAllMocks(); });

describe("media publication boundary", () => {
	it.each(["news", "gallery", "partners", "videos", "video-posters", "subtitles", "interview-materials"])("blocks anonymous pending %s before reading storage", async (folder) => {
		const key = `${folder}/pending/${UUID}.${folder === "videos" ? "mp4" : folder === "subtitles" ? "vtt" : folder === "interview-materials" ? "pdf" : "webp"}`;
		addObject(key, { status: "published" });
		for (const method of ["GET", "HEAD"]) {
			const response = await request(key, { method, headers: { Range: "bytes=0-1" } });
			expect(response.status).toBe(404);
			expect(response.headers.get("Cache-Control")).toBe("private, no-store");
		}
		expect(env.SITE_MEDIA.head).not.toHaveBeenCalled();
	});
	it.each(["draft", "archived", "scheduled", "unreferenced"])("keeps permanent %s news images private", async (state) => {
		const key = `news/${UUID}.webp`;
		addObject(key);
		if (state !== "unreferenced") news(key, state === "scheduled" ? "published" : state, state === "scheduled" ? "9999-01-01" : "2020-01-01");
		for (const method of ["GET", "HEAD"]) {
			expect((await request(key, { method, headers: { "If-None-Match": '"test-etag"', Range: "bytes=0-1" } })).status).toBe(404);
		}
		expect(env.SITE_MEDIA.get).not.toHaveBeenCalled();
	});
	it.each(["partners", "videos", "video-posters", "subtitles"])("checks current D1 publication for %s", async (folder) => {
		const key = `${folder}/${UUID}.${folder === "videos" ? "mp4" : folder === "subtitles" ? "vtt" : "webp"}`;
		addObject(key);
		if (folder === "partners") db.prepare("INSERT INTO partners (id,status,image_url,created_at,updated_at) VALUES ('item','draft',?,'now','now')").run(`/media/v1/${key}`);
		else video(key, "draft", folder === "videos" ? "source_url" : folder === "video-posters" ? "poster_url" : "src_url");
		expect((await request(key)).status).toBe(404);
		const table = folder === "partners" ? "partners" : "videos";
		db.exec(`UPDATE ${table} SET status = 'published' WHERE id = 'item'`);
		expect((await request(key)).status).toBe(200);
		db.exec(`UPDATE ${table} SET status = 'archived' WHERE id = 'item'`);
		expect((await request(key)).status).toBe(404);
	});
	it("checks current D1 publication for interview materials", async () => {
		const key = `interview-materials/${UUID}.pdf`;
		addObject(key);
		db.prepare("INSERT INTO interview_materials (id,kind,status,source_type,source_url,created_at,updated_at) VALUES ('guide','documents','draft','r2',?,'now','now')").run(`/media/v1/${key}`);
		expect((await request(key)).status).toBe(404);
		db.exec("UPDATE interview_materials SET status = 'published' WHERE id = 'guide'");
		expect((await request(key)).status).toBe(200);
		db.exec("UPDATE interview_materials SET status = 'archived' WHERE id = 'guide'");
		expect((await request(key)).status).toBe(404);
	});
	it.each([undefined, "archived", "published"])("requires explicit published gallery metadata: %s", async (status) => {
		const key = `gallery/${UUID}.webp`;
		addObject(key, status ? { status } : {});
		expect((await request(key)).status).toBe(status === "published" ? 200 : 404);
	});
	it("supports site aliases and shared references while requiring revalidation", async () => {
		const key = `news/${UUID}.webp`;
		addObject(key);
		news(key, "archived");
		db.prepare("INSERT INTO partners (id,status,image_url,created_at,updated_at) VALUES ('shared','published',?,'now','now')").run(`https://ligamirokit.ru/media/v1/${key}`);
		const response = await request(key);
		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate");
		expect((await request(key, { headers: { "If-None-Match": '"test-etag"' } })).status).toBe(304);
		db.exec("UPDATE partners SET status = 'archived'");
		expect((await request(key, { headers: { "If-None-Match": '"test-etag"' } })).status).toBe(404);
	});
	it("requires admin authentication for previews, even on localhost", async () => {
		const key = `news/pending/${UUID}.webp`;
		addObject(key);
		expect((await request(key, {}, true)).status).toBe(401);
		const response = await request(key, { headers: localHeaders }, true);
		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
		expect(await response.text()).toBe("0123456789");
		expect((await worker.fetch(new Request(`https://mirokit.com/api/v1/admin/media/${key}`, { headers: localHeaders }), env)).status).toBe(401);
	});
	it("fails closed when D1 fails and does not leak the database error", async () => {
		const key = `news/${UUID}.webp`;
		addObject(key);
		env.SITE_DB.prepare = () => { throw new Error("SQLITE_ERROR private_details"); };
		vi.spyOn(console, "error").mockImplementation(() => {});
		const response = await request(key);
		expect(response.status).toBe(503);
		expect(await response.text()).toBe("Media service unavailable");
		expect(env.SITE_MEDIA.get).not.toHaveBeenCalled();
	});
	it("saves a private draft, publishes it, and revokes the image when archived", async () => {
		const pending = `news/pending/${UUID}.webp`;
		addObject(pending);
		const admin = async (path, method, body) => worker.fetch(new Request(`http://localhost:8787/api/v1/admin/news${path}`, { method, headers: { ...localHeaders, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }), env);
		const response = await admin("", "POST", { id: "draft-news", publishedAt: "2020-01-01", category: "event", accent: "blue", image: `/media/v1/${pending}`, translations: Object.fromEntries(["ru", "en", "de"].map((language) => [language, { title: "Title", alt: "Alt", summary: "Summary", content: ["Text"] }])) });
		expect(response.status).toBe(201);
		const key = (await response.json()).news.image.slice("/media/v1/".length);
		expect(objects.has(pending)).toBe(false);
		expect(env.SITE_MEDIA.put.mock.calls[0][2].httpMetadata.cacheControl).toBe("private, no-store");
		expect((await request(key)).status).toBe(404);
		expect((await request(key, { headers: localHeaders }, true)).status).toBe(200);
		expect((await admin("/draft-news/publish", "POST")).status).toBe(200);
		expect((await request(key)).status).toBe(200);
		expect((await admin("/draft-news", "DELETE")).status).toBe(200);
		expect((await request(key)).status).toBe(404);
	});
	it("writes subtitle edits to a fresh private key instead of overwriting existing media", async () => {
		const oldKey = `subtitles/${UUID}.vtt`;
		addObject(oldKey);
		const response = await worker.fetch(new Request("http://localhost:8787/api/v1/admin/videos", {
			method: "POST", headers: { ...localHeaders, "Content-Type": "application/json" },
			body: JSON.stringify({ id: "subtitle-edit", sourceType: "external", sourceUrl: "https://example.org/video.mp4", translations: Object.fromEntries(["ru", "en", "de"].map((language) => [language, { title: "Title", alt: "Alt", description: "" }])), subtitles: [{ language: "en", src: `/media/v1/${oldKey}`, content: "WEBVTT\n\n00:00.000 --> 00:01.000\nNew text" }] }),
		}), env);
		expect(response.status).toBe(201);
		const src = (await response.json()).video.subtitles[0].src;
		expect(src).not.toBe(`/media/v1/${oldKey}`);
		expect(objects.get(oldKey).body).toBe("0123456789");
		expect((await request(src.slice("/media/v1/".length))).status).toBe(404);
		expect(env.SITE_MEDIA.put.mock.calls[0][2].httpMetadata.cacheControl).toBe("private, no-store");
	});
	it.each(["../secrets", "news/not-valid.svg", `videos/${UUID}.html`, `news/%70ending/${UUID}.webp`])("rejects invalid media key %s", async (key) => {
		expect((await request(key, { headers: localHeaders }, true)).status).toBe(404);
		expect(env.SITE_MEDIA.head).not.toHaveBeenCalled();
	});
});

describe("authorized media HTTP semantics", () => {
	beforeEach(() => { addObject(`videos/${UUID}.mp4`); video(`videos/${UUID}.mp4`); });
	it.each([["bytes=2-4", "234", "bytes 2-4/10"], ["bytes=7-", "789", "bytes 7-9/10"], ["bytes=-3", "789", "bytes 7-9/10"]])("serves %s correctly", async (range, body, contentRange) => {
		const response = await request(`videos/${UUID}.mp4`, { headers: { Range: range } });
		expect(response.status).toBe(206);
		expect(response.headers.get("Content-Range")).toBe(contentRange);
		expect(await response.text()).toBe(body);
	});
	it.each(["bytes=-0", "bytes=20-", "bytes=9-2", "bytes=0-1,4-5"])("rejects unsupported range %s", async (range) => {
		expect((await request(`videos/${UUID}.mp4`, { headers: { Range: range } })).status).toBe(416);
	});
	it("serves HEAD without fetching the body and handles stale If-Range", async () => {
		const response = await request(`videos/${UUID}.mp4`, { method: "HEAD", headers: { Range: "bytes=0-1" } });
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Length")).toBe("10");
		expect(await response.text()).toBe("");
		expect(env.SITE_MEDIA.get).not.toHaveBeenCalled();
		expect((await request(`videos/${UUID}.mp4`, { headers: { Range: "bytes=0-1", "If-Range": '"old"' } })).status).toBe(200);
	});
});
