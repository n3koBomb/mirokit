import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  INTERVIEW_MATERIAL_ADMIN_QUERY, INTERVIEW_MATERIAL_PUBLIC_QUERY,
  interviewMaterialError, interviewMaterialStatements, normalizeInterviewMaterialInput,
  rowsToInterviewMaterials, rowsToPublicInterviewMaterials,
} from "./interviews.js";
import { createDatabase, executeStatements } from "../test/helpers/database.js";

function input(overrides = {}) {
  return {
    id: "sample-material", kind: "documents", sourceType: "external", sourceUrl: "https://example.org/file.pdf",
    translations: Object.fromEntries(["ru", "en", "de"].map((language) => [language, { title: `Title ${language}` }])),
    ...overrides,
  };
}

describe("interview material validation", () => {
  it("fills optional metadata and alt text and leaves input untouched", () => {
    const value = input({ id: " SAMPLE-MATERIAL ", sizeBytes: "42", featured: "1", sortOrder: "2" });
    value.translations.de.description = "First line\nSecond line";
    const before = structuredClone(value);
    expect(normalizeInterviewMaterialInput(value)).toMatchObject({ id: "sample-material", status: "draft", fileName: "", mimeType: "", sizeBytes: 42, featured: 1, sortOrder: 2, translations: { de: { title: "Title de", alt: "Title de", description: "First line\nSecond line" } } });
    expect(value).toEqual(before);
    expect(normalizeInterviewMaterialInput(input()).sizeBytes).toBeNull();
    expect(normalizeInterviewMaterialInput(input({ status: "bad" }), { includeStatus: false })).not.toHaveProperty("status");
  });

  it.each(["documents", "brochures", "forms", "requests"])("accepts kind %s", (kind) => {
    expect(normalizeInterviewMaterialInput(input({ kind })).kind).toBe(kind);
  });

  it.each(["/media/v1/interview-materials/ab-12.pdf", "/media/v1/interview-materials/pending/ab-12.docx"])("accepts R2 material path %s", (sourceUrl) => {
    expect(normalizeInterviewMaterialInput(input({ sourceType: "r2", sourceUrl })).sourceUrl).toBe(sourceUrl);
  });

  it.each([null, [], "bad", 5])("rejects invalid payload %j", (value) => {
    expect(() => normalizeInterviewMaterialInput(value)).toThrow("Invalid interview material payload");
  });

  it.each([
    ["id", "bad_id"], ["id", "one\ntwo"], ["kind", "video"], ["sourceType", "youtube"],
    ["sourceUrl", ""], ["sourceUrl", "http://example.org/file"], ["sourceUrl", "javascript:alert(1)"],
    ["sourceUrl", "/public/../secret"], ["sourceUrl", "/public/a\nb"],
    ["fileName", "a\nb"], ["fileName", "x".repeat(256)], ["mimeType", "x".repeat(101)],
    ["sizeBytes", -1], ["sizeBytes", 1.5], ["sizeBytes", 2000000001], ["sizeBytes", "NaN"],
    ["sortOrder", 10001], ["sortOrder", -1], ["status", "unknown"], ["translations", []],
  ])("rejects invalid %s = %j", (field, value) => {
    expect(() => normalizeInterviewMaterialInput(input({ [field]: value }))).toThrow();
  });

  it.each(["https://example.org/file.pdf", "/media/v1/videos/ab-12.mp4", "/media/v1/interview-materials/not-a-uuid.pdf"])("rejects invalid R2 source %s", (sourceUrl) => {
    expect(() => normalizeInterviewMaterialInput(input({ sourceType: "r2", sourceUrl }))).toThrow("Worker media path");
  });

  it.each(["ru", "en", "de"])("validates %s translation fields", (language) => {
    for (const patch of [null, [], { title: " " }, { title: "one\ntwo" }, { alt: 1 }, { description: "x".repeat(2001) }]) {
      const value = input();
      value.translations[language] = patch === null || Array.isArray(patch) ? patch : { ...value.translations[language], ...patch };
      expect(() => normalizeInterviewMaterialInput(value)).toThrow();
    }
  });

  it("accepts metadata limits and attaches HTTP error statuses", () => {
    expect(normalizeInterviewMaterialInput(input({ sizeBytes: 2000000000, sortOrder: 10000 })).sizeBytes).toBe(2000000000);
    expect(interviewMaterialError("bad")).toMatchObject({ message: "bad", status: 400 });
    expect(interviewMaterialError("conflict", 409).status).toBe(409);
  });
});

describe("interview material SQL and row conversion", () => {
  let database;
  beforeEach(() => { database = createDatabase(); });
  afterEach(() => database.close());
  const save = (value, status = "published", now = "2026-10-18T12:00:00Z") => executeStatements(database, interviewMaterialStatements(normalizeInterviewMaterialInput(input(value)), status, now));

  it("replaces translations on update and retains creation time and file metadata", () => {
    save({});
    const value = input({ fileName: "document.pdf", mimeType: "application/pdf", sizeBytes: 42, featured: true });
    value.translations.en = { title: "Updated", alt: "Custom alt" };
    save(value, "published", "2026-10-19T12:00:00Z");
    const [material] = rowsToInterviewMaterials(database.prepare(INTERVIEW_MATERIAL_ADMIN_QUERY).all());
    expect(material).toMatchObject({ id: "sample-material", fileName: "document.pdf", mimeType: "application/pdf", sizeBytes: 42, featured: true, createdAt: "2026-10-18T12:00:00Z", updatedAt: "2026-10-19T12:00:00Z", translations: { en: { title: "Updated", alt: "Custom alt" } } });
    expect(database.prepare("SELECT COUNT(*) AS count FROM interview_material_translations").get().count).toBe(3);
  });

  it("filters unpublished materials and groups joined translations into public records", () => {
    save({ id: "normal" });
    save({ id: "featured", featured: true });
    save({ id: "draft" }, "draft");
    save({ id: "archived" }, "archived");
    const materials = rowsToPublicInterviewMaterials(database.prepare(INTERVIEW_MATERIAL_PUBLIC_QUERY).all());
    expect(materials.map((item) => item.id)).toEqual(["featured", "normal"]);
    expect(materials[0]).toMatchObject({ sizeBytes: null, fileName: "", translations: { de: { alt: "Title de", description: "" } } });
    expect(materials[0]).not.toHaveProperty("status");
    expect(rowsToInterviewMaterials(database.prepare(INTERVIEW_MATERIAL_ADMIN_QUERY).all())).toHaveLength(4);
  });

  it("returns empty collections for missing rows", () => {
    expect(rowsToInterviewMaterials()).toEqual([]);
    expect(rowsToPublicInterviewMaterials([])).toEqual([]);
  });
});
