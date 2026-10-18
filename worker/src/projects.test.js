import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PROJECTS_ADMIN_QUERY, PROJECTS_PUBLIC_QUERY, normalizeProjectInput,
  projectError, projectStatements, rowsToProjects, rowsToPublicProjects,
} from "./projects.js";
import { createDatabase, executeStatements } from "../test/helpers/database.js";

function input(overrides = {}) {
  return {
    id: "sample-project", startDate: "2026-10-18",
    translations: Object.fromEntries(["ru", "en", "de"].map((language) => [language, { title: `Title ${language}`, alt: `Alt ${language}` }])),
    ...overrides,
  };
}

describe("project validation", () => {
  it("supplies optional defaults, converts numeric values and preserves the caller's input", () => {
    const value = input({ id: " SAMPLE-PROJECT ", featured: "1", sortOrder: "2" });
    const before = structuredClone(value);
    expect(normalizeProjectInput(value)).toMatchObject({ id: "sample-project", category: "creative", accent: "blue", endDate: null, image: "", linkUrl: "", status: "draft", featured: 1, sortOrder: 2, translations: { en: { description: "" } } });
    expect(value).toEqual(before);
    expect(normalizeProjectInput(input({ status: "invalid" }), { includeStatus: false })).not.toHaveProperty("status");
  });

  it.each([null, [], 1, "project"])("rejects invalid payload %j", (value) => {
    expect(() => normalizeProjectInput(value)).toThrow("Invalid project payload");
  });

  it.each([
    ["id", "bad_id"], ["startDate", "2026-02-29"], ["startDate", "2026-02-30"],
    ["startDate", "2026-00-01"], ["endDate", "2026-10-17"], ["endDate", "tomorrow"],
    ["category", "unknown"], ["accent", "pink"], ["status", "unknown"],
    ["sortOrder", -1], ["sortOrder", 1.5], ["sortOrder", 10001],
    ["image", "http://example.org/image"], ["image", "/public/../private"], ["image", "/public/a\nb"],
    ["linkUrl", "javascript:alert(1)"], ["linkUrl", "/page/../admin"], ["translations", []],
  ])("rejects invalid %s = %j", (field, value) => {
    expect(() => normalizeProjectInput(input({ [field]: value }))).toThrow();
  });

  it.each(["ru", "en", "de"])("requires title and alt for %s", (language) => {
    for (const patch of [null, { title: " " }, { alt: 5 }, { title: "x".repeat(501) }, { description: "x".repeat(2001) }]) {
      const value = input();
      value.translations[language] = patch === null ? patch : { ...value.translations[language], ...patch };
      expect(() => normalizeProjectInput(value)).toThrow();
    }
  });

  it.each(["creative", "game", "dialogue", "media", "network", "education"])("accepts category %s", (category) => {
    expect(normalizeProjectInput(input({ category })).category).toBe(category);
  });

  it("accepts leap days, same-day projects, local assets and HTTPS links", () => {
    expect(normalizeProjectInput(input({ startDate: "2024-02-29", endDate: "2024-02-29", image: "https://example.org", linkUrl: "/page/gallery/" }))).toMatchObject({ startDate: "2024-02-29", endDate: "2024-02-29", image: "https://example.org/", linkUrl: "/page/gallery/" });
    expect(normalizeProjectInput(input({ image: "/media/v1/projects/abc.webp", linkUrl: "https://example.org" }))).toMatchObject({ image: "/media/v1/projects/abc.webp", linkUrl: "https://example.org/" });
  });

  it("attaches HTTP status to project errors", () => {
    expect(projectError("bad")).toMatchObject({ message: "bad", status: 400 });
    expect(projectError("missing", 404).status).toBe(404);
  });
});

describe("project SQL and phases", () => {
  let database;
  beforeEach(() => { database = createDatabase(); });
  afterEach(() => database.close());
  const save = (value, status = "published", now = "2026-10-18T12:00:00Z") => executeStatements(database, projectStatements(normalizeProjectInput(input(value)), status, now));

  it("round-trips translations, updates fields and preserves creation time", () => {
    save({});
    const value = input({ image: "/public/new.webp", featured: true });
    value.translations.de.title = "Updated title";
    save(value, "draft", "2026-10-19T12:00:00Z");
    const [item] = rowsToProjects(database.prepare(PROJECTS_ADMIN_QUERY).all(), "2026-10-18");
    expect(item).toMatchObject({ status: "draft", featured: true, image: "/public/new.webp", createdAt: "2026-10-18T12:00:00Z", updatedAt: "2026-10-19T12:00:00Z", translations: { de: { title: "Updated title" } } });
    expect(database.prepare("SELECT COUNT(*) AS count FROM project_translations").get().count).toBe(3);
  });

  it.each([
    ["2026-10-17", null, "current"], ["2026-10-18", null, "current"], ["2026-10-19", null, "upcoming"],
    ["2026-10-17", "2026-10-17", "past"], ["2026-10-17", "2026-10-18", "current"],
  ])("classifies %s through %s as %s on the reference date", (startDate, endDate, phase) => {
    save({ startDate, endDate });
    expect(rowsToPublicProjects(database.prepare(PROJECTS_PUBLIC_QUERY).all(), "2026-10-18")[0].phase).toBe(phase);
  });

  it("filters unpublished rows, orders featured records first and hides admin metadata", () => {
    save({ id: "normal" });
    save({ id: "featured", featured: true });
    save({ id: "draft" }, "draft");
    save({ id: "archived" }, "archived");
    const items = rowsToPublicProjects(database.prepare(PROJECTS_PUBLIC_QUERY).all(), "2026-10-18");
    expect(items.map((item) => item.id)).toEqual(["featured", "normal"]);
    expect(Object.keys(items[0].translations).sort()).toEqual(["de", "en", "ru"]);
    for (const key of ["status", "createdAt", "updatedAt"]) expect(items[0]).not.toHaveProperty(key);
  });

  it("returns empty lists for missing rows", () => {
    expect(rowsToProjects()).toEqual([]);
    expect(rowsToPublicProjects([])).toEqual([]);
  });
});
