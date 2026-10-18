import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  NEWS_ADMIN_QUERY, NEWS_PUBLIC_QUERY, newsError, normalizeNewsId,
  normalizeNewsInput, newsToStatements, rowsToAdminNews, rowsToNews,
} from "./news.js";
import { createDatabase, executeStatements } from "../test/helpers/database.js";

function input(overrides = {}) {
  return {
    id: "sample-news", publishedAt: "2026-10-18", category: "event", accent: "blue",
    image: "/public/assets/news.webp", featured: false,
    translations: Object.fromEntries(["ru", "en", "de"].map((language) => [language, {
      title: `Title ${language}`, alt: `Alt ${language}`, summary: `Summary ${language}`, content: [`Paragraph ${language}`],
    }])), ...overrides,
  };
}

describe("news validation", () => {
  it("normalizes identifiers, text, paths and ranked featured values without mutating input", () => {
    const value = input({ id: " SAMPLE-NEWS ", featured: "2", image: "site/public/assets/news.webp", linkUrl: "https://example.org" });
    value.translations.de.content = ["  Paragraph  "];
    const before = structuredClone(value);
    expect(normalizeNewsInput(value)).toMatchObject({
      id: "sample-news", featured: 2, image: "/public/assets/news.webp", linkUrl: "https://example.org/",
      translations: { de: { content: ["Paragraph"] } },
    });
    expect(value).toEqual(before);
  });

  it.each(["public/assets/news.webp", "./public/assets/news.webp", "/site/public/assets/news.webp", "http://localhost:8080/public/assets/news.webp", "http://127.0.0.1:8080/public/assets/news.webp"])("normalizes local image %s", (image) => {
    expect(normalizeNewsInput(input({ image })).image).toBe("/public/assets/news.webp");
  });

  it.each([null, [], "news", 1])("rejects invalid payload %j", (value) => {
    expect(() => normalizeNewsInput(value)).toThrow("Invalid news payload");
  });

  it.each([
    ["id", "bad_id"], ["id", ""], ["publishedAt", "2026-02-29"], ["publishedAt", "2026-13-01"],
    ["publishedAt", "18.10.2026"], ["category", "unknown"], ["accent", "pink"],
    ["featured", 0], ["featured", -1], ["featured", 11], ["featured", 1.5], ["featured", "yes"],
    ["image", "http://example.org/image.png"], ["image", "/public/../private.png"],
    ["linkUrl", "javascript:alert(1)"], ["linkUrl", "//evil.test/path"], ["linkUrl", "/page/../admin/"],
    ["linkUrl", "/page/\nadmin"], ["translations", null],
  ])("rejects invalid %s = %j", (field, value) => {
    expect(() => normalizeNewsInput(input({ [field]: value }))).toThrow();
  });

  it.each(["ru", "en", "de"])("requires complete and bounded %s translations", (language) => {
    for (const patch of [null, [], { title: "" }, { alt: 1 }, { summary: "x".repeat(2001) },
      { content: [] }, { content: Array(31).fill("text") }, { content: [" "] }, { content: ["x".repeat(5001)] }]) {
      const value = input();
      value.translations[language] = patch === null || Array.isArray(patch) ? patch : { ...value.translations[language], ...patch };
      expect(() => normalizeNewsInput(value)).toThrow();
    }
  });

  it("accepts leap day and status validation only when requested", () => {
    expect(normalizeNewsInput(input({ publishedAt: "2024-02-29", status: "invalid" }))).not.toHaveProperty("status");
    expect(normalizeNewsInput(input(), { includeStatus: true }).status).toBe("draft");
    for (const status of ["draft", "published", "archived"]) {
      expect(normalizeNewsInput(input({ status }), { includeStatus: true }).status).toBe(status);
    }
    expect(() => normalizeNewsInput(input({ status: "invalid" }), { includeStatus: true })).toThrow("Invalid status");
  });

  it("normalizes standalone IDs and creates HTTP-aware errors", () => {
    expect(normalizeNewsId(" SAMPLE-NEWS ")).toBe("sample-news");
    expect(() => normalizeNewsId("../news")).toThrow("Invalid id");
    expect(newsError("bad")).toMatchObject({ message: "bad", status: 400 });
    expect(newsError("conflict", 409)).toMatchObject({ message: "conflict", status: 409 });
  });
});

describe("news SQL and row conversion", () => {
  let database;
  beforeEach(() => { database = createDatabase(); });
  afterEach(() => database.close());
  const save = (value, status = "published", now = "2026-10-18T12:00:00Z") => executeStatements(database, newsToStatements(normalizeNewsInput(input(value)), status, now));

  it("round-trips translations and updates records while preserving creation time", () => {
    save({ featured: false });
    save({ featured: 3, linkUrl: "/page/gallery/" }, "draft", "2026-10-19T12:00:00Z");
    const [item] = rowsToAdminNews(database.prepare(NEWS_ADMIN_QUERY).all());
    expect(item).toMatchObject({ id: "sample-news", status: "draft", featured: 3, linkUrl: "/page/gallery/", createdAt: "2026-10-18T12:00:00Z", updatedAt: "2026-10-19T12:00:00Z", translations: input().translations });
    expect(database.prepare("SELECT COUNT(*) AS count FROM news_translations").get().count).toBe(3);
  });

  it("filters drafts, archives and scheduled records, sorts public news and hides admin metadata", () => {
    save({ id: "old", publishedAt: "2026-10-17" });
    save({ id: "new" });
    save({ id: "future", publishedAt: "2026-10-19" });
    save({ id: "draft" }, "draft");
    save({ id: "archive" }, "archived");
    const items = rowsToNews(database.prepare(NEWS_PUBLIC_QUERY).all("2026-10-18"));
    expect(items.map((item) => item.id)).toEqual(["new", "old"]);
    expect(items[0]).toMatchObject({ featured: false, title: { de: "Title de" }, content: { en: ["Paragraph en"] } });
    for (const key of ["status", "createdAt", "updatedAt"]) expect(items[0]).not.toHaveProperty(key);
    expect(rowsToAdminNews(database.prepare(NEWS_ADMIN_QUERY).all())).toHaveLength(5);
  });

  it("handles empty lists and protects public rendering from malformed stored content JSON", () => {
    expect(rowsToNews([])).toEqual([]);
    expect(rowsToAdminNews([])).toEqual([]);
    save({});
    database.exec("UPDATE news_translations SET content_json = 'broken' WHERE language = 'en'");
    expect(rowsToNews(database.prepare(NEWS_PUBLIC_QUERY).all("2026-10-18"))[0].content.en).toEqual([]);
  });
});
