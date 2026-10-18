import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  INTERVIEWS_ADMIN_QUERY, INTERVIEWS_PUBLIC_QUERY, VIDEOS_ADMIN_QUERY, VIDEOS_PUBLIC_QUERY,
  normalizeVideoInput, rowsToPublicVideos, rowsToVideos, videoError, videoStatements,
} from "./videos.js";
import { createDatabase, executeStatements } from "../test/helpers/database.js";

function input(overrides = {}) {
  return {
    id: "sample-video", sourceType: "external", sourceUrl: "https://example.org/video.mp4",
    translations: Object.fromEntries(["ru", "en", "de"].map((language) => [language, { title: `Title ${language}`, alt: `Alt ${language}` }])),
    ...overrides,
  };
}

describe("video validation", () => {
  it("normalizes metadata and optional defaults without changing the caller's input", () => {
    const value = input({ id: " SAMPLE-VIDEO ", durationSeconds: "12.5", width: "1920", height: "1080", featured: "1", sortOrder: "2" });
    value.translations.en.description = "First line\nSecond line";
    const before = structuredClone(value);
    expect(normalizeVideoInput(value)).toMatchObject({ id: "sample-video", collection: "general", status: "draft", durationSeconds: 12.5, width: 1920, height: 1080, poster: "", featured: 1, sortOrder: 2, subtitles: [], translations: { en: { description: "First line\nSecond line" } } });
    expect(value).toEqual(before);
    expect(normalizeVideoInput(input())).toMatchObject({ durationSeconds: null, width: null, height: null });
    expect(normalizeVideoInput(input({ status: "bad" }), { includeStatus: false })).not.toHaveProperty("status");
  });

  it.each([
    "https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=private",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
  ])("normalizes YouTube URL %s to a single embed URL", (sourceUrl) => {
    expect(normalizeVideoInput(input({ sourceType: "youtube", sourceUrl })).sourceUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1");
  });

  it.each(["not-a-url", "https://evil.test/watch?v=dQw4w9WgXcQ", "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ", "https://youtu.be/short", "https://youtube.com/watch"])("rejects invalid YouTube source %s", (sourceUrl) => {
    expect(() => normalizeVideoInput(input({ sourceType: "youtube", sourceUrl }))).toThrow("YouTube");
  });

  it.each(["/media/v1/videos/ab-12.mp4", "/media/v1/videos/pending/ab-12.webm"])("accepts R2 video path %s", (sourceUrl) => {
    expect(normalizeVideoInput(input({ sourceType: "r2", sourceUrl })).sourceUrl).toBe(sourceUrl);
  });

  it.each(["https://example.org/video.mp4", "/public/video.mp4", "/media/v1/videos/not-a-uuid.mp4"])("rejects an R2 source outside the video upload namespace: %s", (sourceUrl) => {
    expect(() => normalizeVideoInput(input({ sourceType: "r2", sourceUrl }))).toThrow("Worker media path");
  });

  it.each([null, [], "video", 5])("rejects malformed payload %j", (value) => {
    expect(() => normalizeVideoInput(value)).toThrow("Invalid video payload");
  });

  it.each([
    ["id", "bad_id"], ["id", "a\nb"], ["sourceType", "unknown"], ["sourceUrl", ""],
    ["sourceUrl", "http://example.org/video"], ["sourceUrl", "/public/../private"],
    ["poster", "javascript:alert(1)"], ["poster", "/public/a\nb"], ["collection", "unknown"],
    ["durationSeconds", -1], ["durationSeconds", 86401], ["durationSeconds", "NaN"],
    ["width", -1], ["width", 1.5], ["width", 100001], ["height", 100001],
    ["sortOrder", -1], ["sortOrder", 10001], ["status", "unknown"], ["translations", []],
  ])("rejects invalid %s = %j", (field, value) => {
    expect(() => normalizeVideoInput(input({ [field]: value }))).toThrow();
  });

  it.each(["ru", "en", "de"])("requires valid %s translations", (language) => {
    for (const patch of [null, [], { title: " " }, { alt: "one\ntwo" }, { description: "x".repeat(2001) }]) {
      const value = input();
      value.translations[language] = patch === null || Array.isArray(patch) ? patch : { ...value.translations[language], ...patch };
      expect(() => normalizeVideoInput(value)).toThrow();
    }
  });

  it("normalizes WebVTT subtitles, aliases and defaults", () => {
    const video = normalizeVideoInput(input({ subtitles: [
      { language: "de", content: "  WEBVTT\n\n00:00.000 --> 00:01.000\nHallo  ", isDefault: true },
      { id: "existing", language: "en", url: "/media/v1/subtitles/ab-12.vtt", label: "English", srcLang: "en-GB", sortOrder: "2" },
    ] }));
    expect(video.subtitles).toEqual([
      { id: "", language: "de", label: "DE", srcLang: "de", src: "", content: "WEBVTT\n\n00:00.000 --> 00:01.000\nHallo", sortOrder: 0, isDefault: 1 },
      { id: "existing", language: "en", label: "English", srcLang: "en-GB", src: "/media/v1/subtitles/ab-12.vtt", content: "", sortOrder: 2, isDefault: 0 },
    ]);
  });

  it.each([
    null, [], { language: "fr", content: "WEBVTT" }, { language: "de" },
    { language: "de", content: 1 }, { language: "de", content: "not WebVTT" },
    { language: "de", content: "WEBVTT" + "x".repeat(500000) },
    { language: "de", src: "http://example.org/file.vtt" },
    { language: "de", content: "WEBVTT", sortOrder: 1001 },
  ])("rejects malformed subtitle case %#", (subtitle) => {
    expect(() => normalizeVideoInput(input({ subtitles: [subtitle] }))).toThrow();
  });

  it("bounds subtitle count and creates HTTP-aware errors", () => {
    expect(normalizeVideoInput(input({ subtitles: Array.from({ length: 9 }, () => ({ language: "de", content: "WEBVTT" })) })).subtitles).toHaveLength(8);
    expect(videoError("invalid")).toMatchObject({ message: "invalid", status: 400 });
    expect(videoError("missing", 404).status).toBe(404);
  });
});

describe("video SQL, subtitle joins and collection boundaries", () => {
  let database;
  beforeEach(() => { database = createDatabase(); });
  afterEach(() => database.close());
  const save = (value, status = "published", now = "2026-10-18T12:00:00Z") => executeStatements(database, videoStatements(normalizeVideoInput(input(value)), status, now));

  it("deduplicates subtitle joins across translations and sorts subtitles numerically", () => {
    save({ subtitles: [
      { language: "en", src: "/public/en.vtt", sortOrder: 10 },
      { language: "de", src: "/public/de.vtt", sortOrder: 2, isDefault: "1" },
    ] });
    const rows = database.prepare(VIDEOS_PUBLIC_QUERY).all();
    expect(rows).toHaveLength(6);
    const videos = rowsToPublicVideos(rows);
    expect(videos).toHaveLength(1);
    expect(Object.keys(videos[0].translations).sort()).toEqual(["de", "en", "ru"]);
    expect(videos[0].subtitles.map((subtitle) => subtitle.language)).toEqual(["de", "en"]);
    expect(videos[0].subtitles[0].isDefault).toBe(true);
    expect(videos[0].subtitles[0].id).toMatch(/^[a-f0-9-]{36}$/);
    expect(videos[0]).not.toHaveProperty("status");
  });

  it("replaces stale subtitles and translations without changing creation time", () => {
    save({ subtitles: [{ id: "old", language: "de", src: "/public/old.vtt" }] });
    const value = input({ subtitles: [{ id: "new", language: "en", src: "/public/new.vtt" }], featured: true });
    value.translations.de.title = "Updated";
    save(value, "published", "2026-10-19T12:00:00Z");
    const [video] = rowsToVideos(database.prepare(VIDEOS_ADMIN_QUERY).all());
    expect(video).toMatchObject({ featured: true, createdAt: "2026-10-18T12:00:00Z", updatedAt: "2026-10-19T12:00:00Z", translations: { de: { title: "Updated" } } });
    expect(video.subtitles.map((subtitle) => subtitle.id)).toEqual(["new"]);
    expect(database.prepare("SELECT COUNT(*) AS count FROM video_translations").get().count).toBe(3);
  });

  it("keeps general and interview queries separate and hides drafts and archives publicly", () => {
    for (const collection of ["general", "interviews"]) {
      save({ id: `${collection}-published`, collection });
      save({ id: `${collection}-draft`, collection }, "draft");
      save({ id: `${collection}-archived`, collection }, "archived");
    }
    for (const [collection, publicQuery, adminQuery] of [["general", VIDEOS_PUBLIC_QUERY, VIDEOS_ADMIN_QUERY], ["interviews", INTERVIEWS_PUBLIC_QUERY, INTERVIEWS_ADMIN_QUERY]]) {
      expect(rowsToPublicVideos(database.prepare(publicQuery).all()).map((item) => item.id)).toEqual([`${collection}-published`]);
      const admin = rowsToVideos(database.prepare(adminQuery).all());
      expect(admin).toHaveLength(3);
      expect(admin.every((item) => item.collection === collection)).toBe(true);
    }
  });

  it("renders YouTube embeds, empty subtitles and absent numeric metadata", () => {
    save({ sourceType: "youtube", sourceUrl: "https://youtu.be/dQw4w9WgXcQ" });
    const [video] = rowsToPublicVideos(database.prepare(VIDEOS_PUBLIC_QUERY).all());
    expect(video.embedUrl).toBe(video.sourceUrl);
    expect(video).toMatchObject({ durationSeconds: null, width: null, height: null, poster: "", subtitles: [] });
    expect(rowsToVideos()).toEqual([]);
    expect(rowsToPublicVideos([])).toEqual([]);
  });
});
