import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "./index.js";
import { ONLINE_PROJECT_TOPICS } from "../../site/source/scripts/online-project-topics.js";

const key = "gallery/550e8400-e29b-41d4-a716-446655440000.webp";
const headers = { "X-MiroKIT-Admin-Token": "local-token" };
let objects, media, env;
const request = (path = "", options = {}) => worker.fetch(new Request(`http://localhost:8787/api/v1/admin/gallery${path}`, { ...options, headers: { ...headers, ...options.headers } }), env);
const patch = (topic, path = encodeURIComponent(key)) => request(`/${path}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, status: "published" }) });
function addImage(metadata = {}) {
 objects.set(key, { key, body: "unchanged-image-bytes", etag: "original", uploaded: new Date("2025-01-01"), httpMetadata: { contentType: "image/webp", cacheControl: "private, no-store" }, customMetadata: { collection: "online-projects", status: "published", title_de: "Originaltitel", ...metadata } });
}
function uploadForm(topic, collection = "online-projects") {
 const form = new FormData();
 form.append("file", new File(["image"], "work.webp", { type: "image/webp" }));
 form.append("collection", collection);
 if (topic !== undefined) form.append("topic", topic);
 for (const language of ["ru", "en", "de"]) {
  form.append(`title_${language}`, `${language} title`);
  form.append(`alt_${language}`, `${language} description`);
 }
 return form;
}
function folderUploadForm() {
 const form = new FormData();
 form.append("file", new File(["image-one"], "one.webp", { type: "image/webp" }));
 form.append("file", new File(["image-two"], "two.webp", { type: "image/webp" }));
 form.append("collection", "gallery");
 for (const language of ["ru", "en", "de"]) {
  form.append(`folder_title_${language}`, language === "de" ? "Sommer & Freunde" : language === "en" ? "Summer & Friends" : "Лето и друзья");
  form.append(`folder_subtitle_${language}`, language === "de" ? "Gemeinsame Momente" : language === "en" ? "Shared moments" : "Общие моменты");
 }
 return form;
}
beforeEach(() => {
 objects = new Map();
 media = {
  list: vi.fn(async () => ({ objects: [...objects.values()], truncated: false })),
  get: vi.fn(async (key) => {
   const object = objects.get(key);
   return object && { ...object, writeHttpMetadata: (headers) => headers.set("Content-Type", "image/webp") };
  }),
  put: vi.fn(async (key, body, options) => {
   const object = { key, body: typeof body === "string" ? body : await new Response(body).text(), ...options, etag: "saved" };
   objects.set(key, object);
   return object;
  }),
  delete: vi.fn(async (key) => objects.delete(key)),
 };
 env = { SITE_MEDIA: media, ADMIN_DEV_TOKEN: "local-token" };
});

describe("Online Projects libraries", () => {
 it.each(ONLINE_PROJECT_TOPICS.map((topic) => topic.id))("publishes %s with its topic intact", async (topic) => {
  const response = await request("", { method: "POST", body: uploadForm(topic) });
  expect(response.status).toBe(201);
  const item = (await response.json()).gallery;
  expect(item).toMatchObject({ topic, collection: "online-projects", status: "published" });
  expect(objects.get(item.key).customMetadata.topic).toBe(topic);
  const publicResponse = await worker.fetch(new Request("https://mirokit.com/api/v1/gallery?collection=online-projects"), env);
  expect((await publicResponse.json()).gallery).toEqual([expect.objectContaining({ key: item.key, topic })]);
 });
 it.each([undefined, "", "unknown", "<script>"])("rejects an invalid or missing upload topic (%s) before writing", async (topic) => {
  expect((await request("", { method: "POST", body: uploadForm(topic) })).status).toBe(400);
  expect(media.put).not.toHaveBeenCalled();
 });
 it("keeps ordinary gallery uploads independent of topics", async () => {
  const response = await request("", { method: "POST", body: uploadForm(undefined, "gallery") });
  expect(response.status).toBe(201);
  expect((await response.json()).gallery.topic).toBe("");
 });
 it("accepts online-project uploads without image translations", async () => {
  const form = uploadForm("photo");
  for (const language of ["ru", "en", "de"]) {
   form.delete(`title_${language}`);
   form.delete(`alt_${language}`);
  }
  const response = await request("", { method: "POST", body: form });
  const body = await response.json();
  expect(response.status).toBe(201);
  expect(body.gallery.title.de).toBe("photo");
  expect(body.gallery.alt.en).toBe("photo");
 });
 it("lists legacy images without guessing a topic and excludes other collections and archived items", async () => {
  addImage();
  objects.set(key.replace("550", "660"), { key: key.replace("550", "660"), customMetadata: { collection: "gallery", status: "published" } });
  objects.set(key.replace("550", "770"), { key: key.replace("550", "770"), customMetadata: { collection: "online-projects", topic: "drawing", status: "archived" } });
  const response = await worker.fetch(new Request("https://mirokit.com/api/v1/gallery?collection=online-projects"), env);
  expect((await response.json()).gallery).toEqual([expect.objectContaining({ key, topic: "" })]);
 });
 it("assigns an existing image without altering bytes, texts, publication status or original date", async () => {
  addImage({ status: "archived", featured: "true" });
  const response = await patch("poetry");
  expect(response.status).toBe(200);
  expect(objects.get(key)).toMatchObject({ body: "unchanged-image-bytes", httpMetadata: { contentType: "image/webp", cacheControl: "private, no-store" }, customMetadata: { topic: "poetry", status: "archived", title_de: "Originaltitel", featured: "true", uploaded_at: "2025-01-01T00:00:00.000Z" }, onlyIf: { etagMatches: "original" } });
 });
 it("requires authentication before accessing image storage", async () => {
  const response = await worker.fetch(new Request(`http://localhost:8787/api/v1/admin/gallery/${encodeURIComponent(key)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: "photo" }) }), env);
  expect(response.status).toBe(401);
  expect(media.get).not.toHaveBeenCalled();
 });
 it.each(["", "unknown", null, 1])("rejects an invalid edit topic (%s) before reading storage", async (topic) => {
  expect((await patch(topic)).status).toBe(400);
  expect(media.get).not.toHaveBeenCalled();
 });
 it("does not assign topics to normal gallery images", async () => {
  addImage({ collection: "gallery" });
  expect((await patch("drawing")).status).toBe(400);
  expect(media.put).not.toHaveBeenCalled();
 });
 it("rejects pending keys and reports missing images", async () => {
  expect((await patch("drawing", encodeURIComponent(key.replace("gallery/", "gallery/pending/")))) .status).toBe(400);
  expect((await patch("drawing")).status).toBe(404);
  expect(media.put).not.toHaveBeenCalled();
 });
 it("reports a conditional write conflict instead of a successful assignment", async () => {
  addImage();
  media.put.mockResolvedValueOnce(null);
  expect((await patch("drawing")).status).toBe(409);
 });
 it("does not add PATCH to gallery quotes", async () => {
  expect((await patch("drawing", "quotes/example")).status).toBe(405);
  expect(media.get).not.toHaveBeenCalled();
 });
});

describe("Gallery folder workflow", () => {
 it("keeps multi-image folder uploads pending until explicit publication", async () => {
  const upload = await request("", { method: "POST", body: folderUploadForm() });
  expect(upload.status).toBe(202);
  const pending = (await upload.json()).gallery;
  expect(pending).toHaveLength(2);
  expect(pending.every((item) => item.status === "pending" && item.key.startsWith("gallery/pending/sommer-freunde/"))).toBe(true);

  const publicBefore = await worker.fetch(new Request("https://mirokit.com/api/v1/gallery?collection=gallery"), env);
  expect((await publicBefore.json()).gallery).toEqual([]);

  const publish = await request("/publish", { method: "POST", body: JSON.stringify({ keys: pending.map((item) => item.key) }) });
  expect(publish.status).toBe(200);
  const published = (await publish.json()).gallery;
  expect(published).toHaveLength(2);
  expect(published.every((item) => item.status === "published" && item.key.startsWith("gallery/sommer-freunde/"))).toBe(true);
  expect([...objects.values()].filter((item) => item.key.startsWith("gallery/sommer-freunde/")).every((item) => item.customMetadata.status === "published" && item.customMetadata.folder_slug === "sommer-freunde")).toBe(true);

  const publicAfter = await worker.fetch(new Request("https://mirokit.com/api/v1/gallery?collection=gallery"), env);
  const data = await publicAfter.json();
  expect(data.gallery).toHaveLength(2);
  expect(data.folders).toHaveLength(1);
  expect(data.folders[0]).toMatchObject({ slug: "sommer-freunde", count: 2, title: { en: "Summer & Friends", de: "Sommer & Freunde" }, subtitle: { de: "Gemeinsame Momente" } });
  expect(data.folders[0].images).toHaveLength(2);

  const editFolder = await request(`/${encodeURIComponent(published[0].key)}`, {
   method: "PATCH",
   headers: { "Content-Type": "application/json" },
   body: JSON.stringify({ folderTitle: { ru: "Лето и друзья", en: "Summer Together", de: "Gemeinsam im Sommer" }, folderSubtitle: { ru: "Общие моменты", en: "Shared moments", de: "Gemeinsame Momente" } }),
  });
  expect(editFolder.status).toBe(200);
  expect(objects.get(published[0].key).customMetadata).toMatchObject({ folder_slug: "sommer-freunde", folder_title_de: "Gemeinsam im Sommer", folder_subtitle_en: "Shared moments" });
});
});
