import { describe, expect, it } from "vitest";

import {
	FORM_FIELD_ALLOWLIST,
	checkContactRateLimit,
	getAllowedOrigins,
	isLocalOrigin,
	rowsToGalleryQuotes,
	validateFields,
} from "./index.js";
import worker from "./index.js";
import { authorizeAdmin } from "./access.js";
import { normalizeNewsInput, newsToStatements, rowsToNews } from "./news.js";
import { normalizePartnerInput, normalizeWorldPointInput, rowsToPublicPartners, rowsToPublicWorldPoints } from "./content.js";
import { normalizeVideoInput, rowsToPublicVideos } from "./videos.js";

describe("contact form field contracts", () => {
	it("keeps separate allowlists for both forms", () => {
		expect(FORM_FIELD_ALLOWLIST["main-contact"].has("message")).toBe(true);
		expect(FORM_FIELD_ALLOWLIST["main-contact"].has("about")).toBe(false);
		expect(FORM_FIELD_ALLOWLIST["extra-contact"].has("about")).toBe(true);
	});

	it("rejects fields that are not part of the form contract", () => {
		expect(() =>
			validateFields("main-contact", {
				name: "MIRoKIT",
				unexpected: "injected value",
			})
		).toThrow("Unknown field: unexpected");
	});

	it("accepts the league form's multi-value groups", () => {
		expect(() =>
			validateFields("extra-contact", {
				activities: ["culture", "education"],
				goals: ["goal_cooperation"],
			})
		).not.toThrow();
	});

	it("rejects nested or repeated scalar values", () => {
		expect(() =>
			validateFields("main-contact", { name: ["one", "two"] })
		).toThrow("Multiple values not allowed: name");
		expect(() =>
			validateFields("main-contact", { name: { value: "MIRoKIT" } })
		).toThrow("Invalid field value: name");
	});
});

describe("local origins", () => {
	it("reads exact origins from the configured list", () => {
		const origins = getAllowedOrigins({
			ALLOWED_ORIGINS: "http://localhost:8080, http://localhost:8787",
		});

		expect(origins.has("http://localhost:8080")).toBe(true);
		expect(origins.has("http://localhost:9999")).toBe(false);
		expect(isLocalOrigin("http://127.0.0.1:8080")).toBe(true);
		expect(isLocalOrigin("https://mirokit.com")).toBe(false);
	});
});

describe("contact rate limit", () => {
	it("uses the form type and client address as the key", async () => {
		const calls = [];
		const result = await checkContactRateLimit(
			new Request("http://localhost:8787/api/v1/contact", {
				headers: { "CF-Connecting-IP": "203.0.113.4" },
			}),
			{
				CONTACT_FORM_RATE_LIMITER: {
					limit: async (input) => {
						calls.push(input);
						return { success: false };
					},
				},
			},
			"main-contact"
		);

		expect(result.success).toBe(false);
		expect(calls).toEqual([{ key: "main-contact:203.0.113.4" }]);
	});

	it("fails closed when the binding is unavailable", async () => {
		await expect(
			checkContactRateLimit(
				new Request("http://localhost:8787/api/v1/contact"),
				{},
				"main-contact"
			)
		).resolves.toEqual({ success: false, unavailable: true });
	});
});

describe("news content contract", () => {
	const validNews = {
		id: "test-news",
		publishedAt: "2026-08-31",
		category: "event",
		accent: "blue",
		image: "/media/v1/news/test.webp",
		featured: 1,
		translations: {
			ru: { alt: "Тест", title: "Тест", summary: "Тест", content: ["Текст"] },
			en: { alt: "Test", title: "Test", summary: "Test", content: ["Text"] },
			de: { alt: "Test", title: "Test", summary: "Test", content: ["Text"] },
		},
	};

	it("requires all three translations before saving", () => {
		expect(normalizeNewsInput(validNews).id).toBe("test-news");
		expect(normalizeNewsInput({ ...validNews, image: "/public/assets/gallery/example.png" }).image).toBe("/public/assets/gallery/example.png");
		expect(() => normalizeNewsInput({ ...validNews, translations: { ru: validNews.translations.ru } })).toThrow("Invalid translation for en");
	});

	it("creates one metadata statement and one statement per language", () => {
		expect(newsToStatements(validNews, "draft", "2026-08-31T12:00:00.000Z")).toHaveLength(4);
	});

	it("groups database rows into the public news shape", () => {
		const [item] = rowsToNews([
			{ id: "test-news", published_at: "2026-08-31", category: "event", accent: "blue", image_url: "/media/v1/news/test.webp", featured: 1, language: "en", alt: "Test", title: "Test", summary: "Test", content_json: '["Text"]' },
		]);
		expect(item.title.en).toBe("Test");
		expect(item.content.en).toEqual(["Text"]);
	});
});

describe("gallery quote contract", () => {
	it("groups localized quote rows", () => {
		const [quote] = rowsToGalleryQuotes([
			{ id: "quote-1", status: "published", created_at: "2026-09-06T10:00:00.000Z", updated_at: "2026-09-06T10:00:00.000Z", language: "en", quote: "Together", byline: "MIRoKIT" },
			{ id: "quote-1", status: "published", created_at: "2026-09-06T10:00:00.000Z", updated_at: "2026-09-06T10:00:00.000Z", language: "de", quote: "Zusammen", byline: "MIRoKIT" },
		]);
		expect(quote.quote.de).toBe("Zusammen");
		expect(quote.byline.en).toBe("MIRoKIT");
	});
});

describe("world points and partners content contract", () => {
	const translations = {
		ru: { city: "Берлин", country: "Германия", description: "" },
		en: { city: "Berlin", country: "Germany", description: "" },
		de: { city: "Berlin", country: "Deutschland", description: "" },
	};

	it("validates world point coordinates and localized labels", () => {
		const point = normalizeWorldPointInput({ id: "berlin", latitude: 52.52, longitude: 13.4, pointStatus: "planned", flag: "🇩🇪", translations });
		expect(point.translations.de.city).toBe("Berlin");
		expect(() => normalizeWorldPointInput({ id: "bad id", latitude: 52, longitude: 13, pointStatus: "planned", flag: "", translations })).toThrow("Invalid id");
	});

	it("validates partner logos and HTTPS links", () => {
		const partner = normalizePartnerInput({
			id: "initiative-erleben",
			category: "public",
			image: "/public/assets/images/partners/initiative-erleben.png",
			website: "https://example.org",
			translations: {
				ru: { name: "Initiative", alt: "Logo", description: "" },
				en: { name: "Initiative", alt: "Logo", description: "" },
				de: { name: "Initiative", alt: "Logo", description: "" },
			},
		});
		expect(partner.website).toBe("https://example.org/");
		expect(() => normalizePartnerInput({ ...partner, website: "javascript:alert(1)" })).toThrow("website must be an HTTPS URL");
	});

	it("omits editorial status from public content", () => {
		const point = rowsToPublicWorldPoints([{ id: "berlin", status: "published", point_status: "planned", latitude: 52.52, longitude: 13.4, flag: "🇩🇪", sort_order: 1, language: "en", city: "Berlin", country: "Germany", description: "" }]);
		const partner = rowsToPublicPartners([{ id: "partner", status: "published", category: "public", image_url: "/public/logo.png", website_url: "", featured: 0, sort_order: 1, language: "en", name: "Partner", alt: "Partner logo", description: "" }]);
		expect(point[0].status).toBeUndefined();
		expect(partner[0].status).toBeUndefined();
	});
});

describe("video content contract", () => {
	const validVideo = {
		id: "internationaler-dialog",
		sourceType: "youtube",
		sourceUrl: "https://youtu.be/dQw4w9WgXcQ",
		poster: "https://cdn.example.org/poster.webp",
		featured: true,
		translations: {
			ru: { title: "Диалог", alt: "Видео диалога", description: "Описание" },
			en: { title: "Dialogue", alt: "Dialogue video", description: "Description" },
			de: { title: "Dialog", alt: "Dialogvideo", description: "Beschreibung" },
		},
		subtitles: [{ language: "en", label: "English", srcLang: "en", content: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello" }],
	};

	it("normalizes YouTube sources and validates WebVTT subtitles", () => {
		const video = normalizeVideoInput(validVideo, { includeStatus: false });
		expect(video.sourceUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1");
		expect(video.subtitles[0].language).toBe("en");
		expect(() => normalizeVideoInput({ ...validVideo, sourceUrl: "https://example.org/video" }, { includeStatus: false })).toThrow("Invalid YouTube video URL");
	});

	it("allows multiline descriptions from admin textareas", () => {
		const video = normalizeVideoInput({
			...validVideo,
			translations: {
				...validVideo.translations,
				ru: { ...validVideo.translations.ru, description: "Первая строка.\nВторая строка." },
			},
		}, { includeStatus: false });
		expect(video.translations.ru.description).toContain("\n");
	});

	it("omits editorial status from public video data", () => {
		const [video] = rowsToPublicVideos([{
			id: "video-1", status: "published", source_type: "external", source_url: "https://cdn.example.org/video.mp4", poster_url: "", duration_seconds: 12, width: 1280, height: 720, featured: 0, sort_order: 1,
			language: "en", title: "Video", alt: "Video", description: "", subtitle_id: null,
		}]);
		expect(video.sourceType).toBe("external");
		expect(video.status).toBeUndefined();
	});
});

describe("news API and admin access", () => {
	const rows = [
		{ id: "test-news", published_at: "2026-08-31", category: "event", accent: "blue", image_url: "/media/v1/news/test.webp", featured: 1, language: "en", alt: "Test", title: "Test", summary: "Test", content_json: '["Text"]' },
	];
	const database = {
		prepare: () => ({
			all: async () => ({ results: rows }),
			bind: () => ({ all: async () => ({ results: rows }) }),
		}),
	};

	it("serves public news from D1", async () => {
		const response = await worker.fetch(new Request("https://mirokit.com/api/v1/news"), { SITE_DB: database });
		const body = await response.json();
		expect(response.status).toBe(200);
		expect(body.news[0].id).toBe("test-news");
	});

	it("serves published videos from D1", async () => {
		const database = {
			prepare: () => ({
				all: async () => ({ results: [{ id: "video-1", source_type: "external", source_url: "https://cdn.example.org/video.mp4", poster_url: "", duration_seconds: 12, width: 1280, height: 720, featured: 0, sort_order: 1, language: "en", title: "Video", alt: "Video", description: "", subtitle_id: null }] }),
			}),
		};
		const response = await worker.fetch(new Request("https://mirokit.com/api/v1/videos"), { SITE_DB: database });
		const body = await response.json();
		expect(response.status).toBe(200);
		expect(body.videos[0].sourceType).toBe("external");
	});

	it("creates a video draft through the protected admin API", async () => {
		const batches = [];
		const database = {
			prepare: () => ({
				all: async () => ({ results: [] }),
				bind: (...params) => ({ sql: "video statement", params }),
			}),
			batch: async (statements) => batches.push(statements),
		};
		const response = await worker.fetch(new Request("http://localhost:8787/api/v1/admin/videos", {
			method: "POST",
			headers: { "X-MiroKIT-Admin-Token": "local-token", "Content-Type": "application/json" },
			body: JSON.stringify({
				id: "draft-video",
				sourceType: "external",
				sourceUrl: "https://cdn.example.org/video.mp4",
				translations: {
					ru: { title: "Тест", alt: "Видео", description: "" },
					en: { title: "Test", alt: "Video", description: "" },
					de: { title: "Test", alt: "Video", description: "" },
				},
			}),
		}), { SITE_DB: database, ADMIN_DEV_TOKEN: "local-token" });
		const body = await response.json();
		expect(response.status).toBe(201);
		expect(body.video.status).toBe("draft");
		expect(batches).toHaveLength(1);
	});

	it("requires the local admin token for local admin access", async () => {
		const request = new Request("http://localhost:8787/api/v1/admin/news", { headers: { "X-MiroKIT-Admin-Token": "local-token" } });
		expect(await authorizeAdmin(request, { ADMIN_DEV_TOKEN: "local-token" })).toMatchObject({ local: true });
		expect(await authorizeAdmin(new Request("http://localhost:8787/api/v1/admin/news"), { ADMIN_DEV_TOKEN: "local-token" })).toBeNull();
	});

	it("returns 401 for an unauthenticated admin API request", async () => {
		const response = await worker.fetch(new Request("https://mirokit.com/api/v1/admin/news"), { SITE_DB: database });
		expect(response.status).toBe(401);
	});

	it("lists all news for an authenticated local admin", async () => {
		const response = await worker.fetch(
			new Request("http://localhost:8787/api/v1/admin/news", {
				headers: { "X-MiroKIT-Admin-Token": "local-token" },
			}),
			{ SITE_DB: database, ADMIN_DEV_TOKEN: "local-token" }
		);
		const body = await response.json();
		expect(response.status).toBe(200);
		expect(body.news[0].translations.en.title).toBe("Test");
	});

	it("checks whether a news slug is available", async () => {
		const availabilityDatabase = {
			prepare: (sql) => ({
				bind: (id) => ({
					all: async () => ({ results: sql.includes("SELECT id") && id === "taken-slug" ? [{ id }] : [] }),
				}),
			}),
		};
		const headers = { "X-MiroKIT-Admin-Token": "local-token" };

		const available = await worker.fetch(
			new Request("http://localhost:8787/api/v1/admin/news/availability?id=new-slug", { headers }),
			{ SITE_DB: availabilityDatabase, ADMIN_DEV_TOKEN: "local-token" }
		);
		const taken = await worker.fetch(
			new Request("http://localhost:8787/api/v1/admin/news/availability?id=taken-slug", { headers }),
			{ SITE_DB: availabilityDatabase, ADMIN_DEV_TOKEN: "local-token" }
		);

		expect((await available.json()).available).toBe(true);
		expect((await taken.json()).available).toBe(false);
	});

	it("promotes a pending R2 image when a news item is saved", async () => {
		const operations = [];
		const pendingImage = "/media/v1/news/pending/550e8400-e29b-41d4-a716-446655440000.webp";
		const pendingNews = {
			id: "pending-news",
			publishedAt: "2026-08-31",
			category: "event",
			accent: "blue",
			image: pendingImage,
			featured: false,
			translations: {
				ru: { alt: "Тест", title: "Тест", summary: "Тест", content: ["Текст"] },
				en: { alt: "Test", title: "Test", summary: "Test", content: ["Text"] },
				de: { alt: "Test", title: "Test", summary: "Test", content: ["Text"] },
			},
		};
		const database = {
			prepare: (sql) => ({
				all: async () => ({ results: sql === "SELECT id FROM news WHERE id = ? LIMIT 1" ? [] : [] }),
				bind: () => ({ all: async () => ({ results: [] }) }),
			}),
			batch: async (statements) => operations.push(...statements),
		};
		const media = {
			get: async (key) => {
				operations.push(["get", key]);
				return {
					body: "image-body",
					writeHttpMetadata: (headers) => {
						headers.set("content-type", "image/webp");
						headers.set("cache-control", "public, max-age=31536000, immutable");
					},
				};
			},
			put: async (key) => operations.push(["put", key]),
			delete: async (key) => operations.push(["delete", key]),
		};
		const response = await worker.fetch(
			new Request("http://localhost:8787/api/v1/admin/news", {
				method: "POST",
				headers: { "X-MiroKIT-Admin-Token": "local-token", "Content-Type": "application/json" },
				body: JSON.stringify(pendingNews),
			}),
			{ SITE_DB: database, SITE_MEDIA: media, ADMIN_DEV_TOKEN: "local-token" }
		);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body.news.image).toBe("/media/v1/news/550e8400-e29b-41d4-a716-446655440000.webp");
		expect(operations).toContainEqual(["put", "news/550e8400-e29b-41d4-a716-446655440000.webp"]);
		expect(operations).toContainEqual(["delete", "news/pending/550e8400-e29b-41d4-a716-446655440000.webp"]);
	});

	it("serves only published gallery objects with localized metadata", async () => {
		const response = await worker.fetch(new Request("https://mirokit.com/api/v1/gallery"), {
			SITE_MEDIA: {
				list: async () => ({
					objects: [
						{
							key: "gallery/550e8400-e29b-41d4-a716-446655440000.webp",
							uploaded: new Date("2026-08-31T12:00:00.000Z"),
							customMetadata: {
								status: "published",
								title_en: "Team day",
								alt_en: "A team meeting",
							},
						},
						{ key: "gallery/pending/660e8400-e29b-41d4-a716-446655440000.webp", customMetadata: { status: "published" } },
					],
					truncated: false,
				}),
			},
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.gallery).toHaveLength(1);
		expect(body.gallery[0].image).toBe("/media/v1/gallery/550e8400-e29b-41d4-a716-446655440000.webp");
		expect(body.gallery[0].title.en).toBe("Team day");
	});

	it("uploads a gallery image with localized R2 metadata", async () => {
		const operations = [];
		const media = {
			put: async (key, body, options) => operations.push(["put", key, options.customMetadata]),
			get: async (key) => ({
				body: "image-body",
				customMetadata: operations.find(([operation, operationKey]) => operation === "put" && operationKey === key)?.[2] || {},
				writeHttpMetadata: (headers) => headers.set("content-type", "image/webp"),
			}),
			delete: async (key) => operations.push(["delete", key]),
		};
		const formData = new FormData();
		formData.append("file", new File(["image"], "team.webp", { type: "image/webp" }));
		for (const language of ["ru", "en", "de"]) {
			formData.append(`title_${language}`, `${language} title`);
			formData.append(`alt_${language}`, `${language} alt`);
			formData.append(`subtitle_${language}`, `${language} subtitle`);
			formData.append(`quote_${language}`, `${language} quote`);
		}
		formData.append("featured", "true");

		const response = await worker.fetch(
			new Request("http://localhost:8787/api/v1/admin/gallery", {
				method: "POST",
				headers: { "X-MiroKIT-Admin-Token": "local-token" },
				body: formData,
			}),
			{ SITE_MEDIA: media, ADMIN_DEV_TOKEN: "local-token" }
		);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body.gallery.image).toMatch(/^\/media\/v1\/gallery\/[a-f0-9-]+\.webp$/);
		expect(body.gallery.featured).toBe(true);
		expect(body.gallery.subtitle.en).toBe("en subtitle");
		expect(body.gallery.quote.de).toBe("de quote");
		expect(operations.some(([operation, key]) => operation === "put" && key.startsWith("gallery/pending/"))).toBe(true);
		expect(operations.some(([operation, key]) => operation === "put" && key.startsWith("gallery/") && !key.includes("/pending/"))).toBe(true);
		expect(operations.some(([operation, key]) => operation === "delete" && key.startsWith("gallery/pending/"))).toBe(true);
	});

	it("deletes a permanent gallery object after admin confirmation", async () => {
		const deleted = [];
		const response = await worker.fetch(
			new Request("http://localhost:8787/api/v1/admin/gallery/gallery%2F550e8400-e29b-41d4-a716-446655440000.webp", {
				method: "DELETE",
				headers: { "X-MiroKIT-Admin-Token": "local-token" },
			}),
			{
				SITE_MEDIA: { delete: async (key) => deleted.push(key) },
				ADMIN_DEV_TOKEN: "local-token",
			}
		);

		expect(response.status).toBe(200);
		expect(deleted).toEqual(["gallery/550e8400-e29b-41d4-a716-446655440000.webp"]);
	});

	it("creates a localized gallery quote for an authenticated admin", async () => {
		const statements = [];
		const database = {
			prepare: (sql) => ({
				bind: (...params) => ({
					sql,
					params,
					run: async () => ({ meta: { changes: 1 } }),
				}),
			}),
			batch: async (batch) => statements.push(...batch),
		};
		const response = await worker.fetch(
			new Request("http://localhost:8787/api/v1/admin/gallery/quotes", {
				method: "POST",
				headers: { "X-MiroKIT-Admin-Token": "local-token", "Content-Type": "application/json" },
				body: JSON.stringify({
					translations: {
						ru: { quote: "Вместе", byline: "МИРоКИТ" },
						en: { quote: "Together", byline: "MIRoKIT" },
						de: { quote: "Zusammen", byline: "MIRoKIT" },
					},
				}),
			}),
			{ SITE_DB: database, ADMIN_DEV_TOKEN: "local-token" }
		);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body.quote.quote.en).toBe("Together");
		expect(statements).toHaveLength(5);
	});
});
