import { describe, expect, it } from "vitest";

import {
	FORM_FIELD_ALLOWLIST,
	checkContactRateLimit,
	getAllowedOrigins,
	isLocalOrigin,
	validateFields,
} from "./index.js";
import worker from "./index.js";
import { authorizeAdmin } from "./access.js";
import { normalizeNewsInput, newsToStatements, rowsToNews } from "./news.js";

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
			new Request("http://localhost:8787/api/contact", {
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
				new Request("http://localhost:8787/api/contact"),
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
		image: "/news-media/news/test.webp",
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
			{ id: "test-news", published_at: "2026-08-31", category: "event", accent: "blue", image_url: "/news-media/news/test.webp", featured: 1, language: "en", alt: "Test", title: "Test", summary: "Test", content_json: '["Text"]' },
		]);
		expect(item.title.en).toBe("Test");
		expect(item.content.en).toEqual(["Text"]);
	});
});

describe("news API and admin access", () => {
	const rows = [
		{ id: "test-news", published_at: "2026-08-31", category: "event", accent: "blue", image_url: "/news-media/news/test.webp", featured: 1, language: "en", alt: "Test", title: "Test", summary: "Test", content_json: '["Text"]' },
	];
	const database = {
		prepare: () => ({
			all: async () => ({ results: rows }),
			bind: () => ({ all: async () => ({ results: rows }) }),
		}),
	};

	it("serves public news from D1", async () => {
		const response = await worker.fetch(new Request("https://mirokit.com/api/news"), { NEWS_DB: database });
		const body = await response.json();
		expect(response.status).toBe(200);
		expect(body.news[0].id).toBe("test-news");
	});

	it("requires the local admin token for local admin access", async () => {
		const request = new Request("http://localhost:8787/news-admin/api/news", { headers: { "X-MiroKIT-Admin-Token": "local-token" } });
		expect(await authorizeAdmin(request, { NEWS_ADMIN_DEV_TOKEN: "local-token" })).toMatchObject({ local: true });
		expect(await authorizeAdmin(new Request("http://localhost:8787/news-admin/api/news"), { NEWS_ADMIN_DEV_TOKEN: "local-token" })).toBeNull();
	});

	it("returns 401 for an unauthenticated admin API request", async () => {
		const response = await worker.fetch(new Request("https://mirokit.com/news-admin/api/news"), { NEWS_DB: database });
		expect(response.status).toBe(401);
	});

	it("lists all news for an authenticated local admin", async () => {
		const response = await worker.fetch(
			new Request("http://localhost:8787/news-admin/api/news", {
				headers: { "X-MiroKIT-Admin-Token": "local-token" },
			}),
			{ NEWS_DB: database, NEWS_ADMIN_DEV_TOKEN: "local-token" }
		);
		const body = await response.json();
		expect(response.status).toBe(200);
		expect(body.news[0].translations.en.title).toBe("Test");
	});
});
