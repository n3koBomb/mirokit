import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PARTNERS_ADMIN_QUERY, PARTNERS_PUBLIC_QUERY, WORLD_ADMIN_QUERY, WORLD_PUBLIC_QUERY,
  contentError, normalizePartnerInput, normalizeWorldPointInput, partnerStatements,
  rowsToPartners, rowsToPublicPartners, rowsToWorldPoints, rowsToPublicWorldPoints, worldPointStatements,
} from "./content.js";
import { createDatabase, executeStatements } from "../test/helpers/database.js";

function point(overrides = {}) {
  return {
    id: "test-city", latitude: "52.52", longitude: "13.4",
    translations: Object.fromEntries(["ru", "en", "de"].map((language) => [language, { city: `City ${language}`, country: `Country ${language}` }])),
    ...overrides,
  };
}
function partner(overrides = {}) {
  return {
    id: "test-partner", image: "/public/partner.webp",
    translations: Object.fromEntries(["ru", "en", "de"].map((language) => [language, { name: `Name ${language}`, alt: `Alt ${language}` }])),
    ...overrides,
  };
}

describe("world point and partner validation", () => {
  it("normalizes numeric fields and optional defaults without mutating input", () => {
    const value = point({ id: " TEST-CITY " });
    const before = structuredClone(value);
    expect(normalizeWorldPointInput(value)).toMatchObject({ id: "test-city", latitude: 52.52, longitude: 13.4, pointStatus: "planned", status: "draft", flag: "", sortOrder: 0, translations: { de: { description: "" } } });
    expect(value).toEqual(before);
    expect(normalizePartnerInput(partner({ featured: "1", sortOrder: "2", website: "https://example.org" }))).toMatchObject({ featured: 1, sortOrder: 2, website: "https://example.org/", category: "public", status: "draft" });
  });

  it.each([null, [], "bad", 1])("rejects invalid payload %j for both content types", (value) => {
    expect(() => normalizeWorldPointInput(value)).toThrow("Invalid world point payload");
    expect(() => normalizePartnerInput(value)).toThrow("Invalid partner payload");
  });

  it.each([
    ["latitude", -90.01], ["latitude", 90.01], ["latitude", "NaN"], ["latitude", Infinity],
    ["longitude", -180.01], ["longitude", 180.01], ["pointStatus", "unknown"],
    ["flag", "x".repeat(17)], ["id", "bad_id"], ["sortOrder", -1], ["sortOrder", 1.2],
    ["sortOrder", 10001], ["status", "unknown"],
  ])("rejects invalid world point %s = %j", (field, value) => {
    expect(() => normalizeWorldPointInput(point({ [field]: value }))).toThrow();
  });

  it.each([
    ["image", ""], ["image", "http://example.org/image"], ["image", "/public/../secret"],
    ["image", "/public/a\nb"], ["website", "javascript:alert(1)"], ["website", "/local"],
    ["category", "x".repeat(81)], ["id", "../bad"], ["status", "unknown"],
  ])("rejects invalid partner %s = %j", (field, value) => {
    expect(() => normalizePartnerInput(partner({ [field]: value }))).toThrow();
  });

  it.each(["ru", "en", "de"])("requires complete %s translations for both content types", (language) => {
    for (const [factory, normalize, required] of [[point, normalizeWorldPointInput, "city"], [partner, normalizePartnerInput, "alt"]]) {
      for (const translation of [null, [], { ...factory().translations[language], [required]: " " }]) {
        const value = factory();
        value.translations[language] = translation;
        expect(() => normalize(value)).toThrow();
      }
      expect(() => normalize(factory({ translations: [] }))).toThrow();
    }
  });

  it.each([[-90, -180], [90, 180]])("accepts coordinate boundaries %i, %i", (latitude, longitude) => {
    expect(normalizeWorldPointInput(point({ latitude, longitude }))).toMatchObject({ latitude, longitude });
  });

  it.each(["hq", "done", "planned"])("accepts point status %s", (pointStatus) => {
    expect(normalizeWorldPointInput(point({ pointStatus })).pointStatus).toBe(pointStatus);
  });

  it("supports status-free updates and HTTPS or local partner images", () => {
    expect(normalizeWorldPointInput(point({ status: "bad" }), { includeStatus: false })).not.toHaveProperty("status");
    expect(normalizePartnerInput(partner({ status: "bad" }), { includeStatus: false })).not.toHaveProperty("status");
    for (const image of ["/media/v1/partners/abc.webp", "https://example.org/image.webp"]) {
      expect(normalizePartnerInput(partner({ image })).image).toBe(image);
    }
    expect(contentError("invalid")).toMatchObject({ message: "invalid", status: 400 });
    expect(contentError("missing", 404).status).toBe(404);
  });
});

describe("content SQL and public projections", () => {
  let database;
  beforeEach(() => {
    database = createDatabase();
    database.exec("DELETE FROM world_points; DELETE FROM partners;");
  });
  afterEach(() => database.close());

  it.each([
    ["world point", point, normalizeWorldPointInput, worldPointStatements, WORLD_ADMIN_QUERY, WORLD_PUBLIC_QUERY, rowsToWorldPoints, rowsToPublicWorldPoints, "world_points"],
    ["partner", partner, normalizePartnerInput, partnerStatements, PARTNERS_ADMIN_QUERY, PARTNERS_PUBLIC_QUERY, rowsToPartners, rowsToPublicPartners, "partners"],
  ])("round-trips %s translations, preserves creation time and isolates unpublished records", (_kind, factory, normalize, statements, adminQuery, publicQuery, adminRows, publicRows, table) => {
    const value = normalize(factory());
    executeStatements(database, statements(value, "published", "2026-10-18T12:00:00Z"));
    const translated = structuredClone(value);
    translated.translations.en.description = "Updated description with 'quotes'";
    executeStatements(database, statements(translated, "published", "2026-10-19T12:00:00Z"));
    executeStatements(database, statements({ ...value, id: "draft" }, "draft", "2026-10-18T12:00:00Z"));
    executeStatements(database, statements({ ...value, id: "archived" }, "archived", "2026-10-18T12:00:00Z"));
    const [item] = publicRows(database.prepare(publicQuery).all());
    expect(publicRows(database.prepare(publicQuery).all())).toHaveLength(1);
    expect(item.translations.en.description).toBe("Updated description with 'quotes'");
    expect(Object.keys(item.translations).sort()).toEqual(["de", "en", "ru"]);
    expect(item).not.toHaveProperty("status");
    expect(adminRows(database.prepare(adminQuery).all())).toHaveLength(3);
    expect(database.prepare(`SELECT created_at, updated_at FROM ${table} WHERE id = ?`).get(value.id)).toMatchObject({ created_at: "2026-10-18T12:00:00Z", updated_at: "2026-10-19T12:00:00Z" });
  });

  it("orders world points numerically and partners by category, featured flag and sort order", () => {
    for (const [id, sortOrder] of [["later", 10], ["first", 2]]) {
      executeStatements(database, worldPointStatements(normalizeWorldPointInput(point({ id, sortOrder })), "published", "now"));
    }
    expect(rowsToPublicWorldPoints(database.prepare(WORLD_PUBLIC_QUERY).all()).map((item) => item.id)).toEqual(["first", "later"]);
    for (const [id, category, featured, sortOrder] of [["education", "education", false, 0], ["social", "social", false, 0], ["normal", "public", false, 1], ["featured", "public", true, 10]]) {
      executeStatements(database, partnerStatements(normalizePartnerInput(partner({ id, category, featured, sortOrder })), "published", "now"));
    }
    const partners = rowsToPublicPartners(database.prepare(PARTNERS_PUBLIC_QUERY).all());
    expect(partners.map((item) => item.id)).toEqual(["featured", "normal", "social", "education"]);
    expect(partners[0].featured).toBe(true);
    expect(partners[1].featured).toBe(false);
  });

  it("returns empty collections for missing database results", () => {
    for (const convert of [rowsToPartners, rowsToWorldPoints, rowsToPublicPartners, rowsToPublicWorldPoints]) {
      expect(convert()).toEqual([]);
      expect(convert([])).toEqual([]);
    }
  });
});
