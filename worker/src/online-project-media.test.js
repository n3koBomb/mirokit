import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "./index.js";

let env, objects, media;
const auth = { "X-MiroKIT-Admin-Token": "local-token" };
const base = "http://localhost/api/v1/admin/online-projects/media";
const texts = { ru: { title: "Документ", description: "Описание" }, en: { title: "Document", description: "Description" }, de: { title: "Dokument", description: "Beschreibung" } };
const call = (path = "", options = {}) => worker.fetch(new Request(`${base}${path}`, { ...options, headers: { ...auth, ...options.headers } }), env);
const publicList = () => worker.fetch(new Request("http://localhost/api/v1/online-projects/media"), env);
const thumbnailBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]);
function upload(kind = "document", type = "application/pdf", bytes = "%PDF-1.7\nExample", thumbnail = true) {
  const form = new FormData();
  form.append("kind", kind); form.append("topic", "drawing"); form.append("translations", JSON.stringify(texts));
  form.append("file", new File([bytes], kind === "document" ? "example.pdf" : "example.mp4", { type }));
  if (thumbnail) form.append("thumbnail", new File([thumbnailBytes], "preview.png", { type: "image/png" }));
  return form;
}
const edit = (id, status = "published", extra = {}) => call(`/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: "drawing", translations: texts, status, ...extra }) });
function objectFor(key, entry) {
  return { key, ...entry, size: entry.bytes.byteLength, httpEtag: `"${entry.etag}"`, body: entry.bytes, writeHttpMetadata(headers) { headers.set("Content-Type", entry.httpMetadata.contentType); } };
}
beforeEach(() => {
  objects = new Map();
  let version = 0;
  media = {
    list: vi.fn(async ({ prefix, cursor, limit }) => {
      const entries = [...objects.entries()].filter(([key]) => key.startsWith(prefix));
      const start = Number(cursor || 0);
      return { objects: entries.slice(start, start + limit).map(([key, value]) => objectFor(key, value)), truncated: start + limit < entries.length, cursor: String(start + limit) };
    }),
    put: vi.fn(async (key, value, options = {}) => {
      if (options.onlyIf && objects.get(key)?.etag !== options.onlyIf.etagMatches) return null;
      const entry = { bytes: new Uint8Array(await new Response(value).arrayBuffer()), ...options, etag: String(++version) };
      objects.set(key, entry); return objectFor(key, entry);
    }),
    get: vi.fn(async (key, options) => {
      const entry = objects.get(key);
      if (!entry) return null;
      const object = objectFor(key, entry);
      if (options?.range) object.body = entry.bytes.slice(options.range.offset, options.range.offset + options.range.length);
      return object;
    }),
    head: vi.fn(async (key) => objects.has(key) ? objectFor(key, objects.get(key)) : null),
    delete: vi.fn(async (key) => objects.delete(key)),
  };
  env = { ADMIN_DEV_TOKEN: "local-token", SITE_MEDIA: media };
});

describe("Online project videos and documents", () => {
  it("keeps uploads private, publishes both PDF and preview, and revokes direct access on archive", async () => {
    const response = await call("", { method: "POST", body: upload() });
    expect(response.status).toBe(201);
    const item = (await response.json()).media;
    expect(item).toMatchObject({ kind: "document", topic: "drawing", status: "draft", title: { de: "Dokument" } });
    expect((await (await publicList()).json()).media).toEqual([]);
    const publicPath = item.url.replace("/api/v1/admin/media/", "/media/v1/");
    const previewPath = item.thumbnail.replace("/api/v1/admin/media/", "/media/v1/");
    expect((await worker.fetch(new Request(`http://localhost${publicPath}`), env)).status).toBe(404);
    expect((await worker.fetch(new Request(`http://localhost${item.url}`, { headers: auth }), env)).status).toBe(200);
    expect((await edit(item.id)).status).toBe(200);
    expect((await (await publicList()).json()).media).toEqual([expect.objectContaining({ id: item.id, url: publicPath, thumbnail: previewPath })]);
    const pdf = await worker.fetch(new Request(`http://localhost${publicPath}`), env);
    expect(pdf.status).toBe(200); expect(pdf.headers.get("Content-Type")).toBe("application/pdf");
    expect((await worker.fetch(new Request(`http://localhost${previewPath}`), env)).status).toBe(200);
    const originalBytes = objects.get(publicPath.slice("/media/v1/".length)).bytes;
    expect((await call(`/${item.id}`, { method: "DELETE" })).status).toBe(200);
    expect((await (await publicList()).json()).media).toEqual([]);
    expect((await worker.fetch(new Request(`http://localhost${publicPath}`), env)).status).toBe(404);
    expect((await worker.fetch(new Request(`http://localhost${previewPath}`), env)).status).toBe(404);
    expect(objects.get(publicPath.slice("/media/v1/".length)).bytes).toEqual(originalBytes);
    expect((await edit(item.id)).status).toBe(200);
    expect((await worker.fetch(new Request(`http://localhost${publicPath}`), env)).status).toBe(200);
  });
  it.each([
    ["video/mp4", new Uint8Array([0, 0, 0, 16, 102, 116, 121, 112, 109, 112, 52, 50])],
    ["video/webm", new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0])],
    ["video/ogg", "OggSexample"],
  ])("accepts %s and serves video byte ranges", async (type, bytes) => {
    const response = await call("", { method: "POST", body: upload("video", type, bytes, false) });
    expect(response.status).toBe(201);
    const item = (await response.json()).media;
    await edit(item.id);
    const video = await worker.fetch(new Request(`http://localhost${item.url.replace("/api/v1/admin/media/", "/media/v1/")}`, { headers: { Range: "bytes=0-3" } }), env);
    expect(video.status).toBe(206); expect(video.headers.get("Content-Length")).toBe("4");
    expect((await video.arrayBuffer()).byteLength).toBe(4);
  });
  it("rejects unauthenticated and cross-origin writes before reading storage", async () => {
    expect((await worker.fetch(new Request(base, { method: "POST", body: upload() }), env)).status).toBe(401);
    expect((await call("", { method: "POST", headers: { Origin: "https://evil.example" }, body: upload() })).status).toBe(403);
    expect(media.put).not.toHaveBeenCalled();
  });
  it.each(["topic", "kind", "translations", "file", "thumbnail"])("rejects missing %s before writing", async (field) => {
    const form = upload(); form.delete(field);
    expect((await call("", { method: "POST", body: form })).status).toBe(400);
    expect(media.put).not.toHaveBeenCalled();
  });
  it("rejects a blank title in a closed language group", async () => {
    const form = upload(); form.set("translations", JSON.stringify({ ...texts, en: { title: "  " } }));
    expect((await call("", { method: "POST", body: form })).status).toBe(400);
    expect(media.put).not.toHaveBeenCalled();
  });
  it("rejects disguised PDF contents and invalid thumbnails", async () => {
    expect((await call("", { method: "POST", body: upload("document", "application/pdf", "<script>bad</script>") })).status).toBe(400);
    const form = upload(); form.set("thumbnail", new File(["bad"], "preview.png", { type: "image/png" }));
    expect((await call("", { method: "POST", body: form })).status).toBe(400);
    expect(media.put).not.toHaveBeenCalled();
  });
  it("removes partial uploads when the manifest write fails", async () => {
    const original = media.put.getMockImplementation();
    media.put.mockImplementation(async (key, value, options) => {
      if (key.includes("/records/")) throw new Error("storage unavailable");
      return original(key, value, options);
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call("", { method: "POST", body: upload() })).status).toBe(500);
    expect(objects.size).toBe(0); log.mockRestore();
  });
  it("does not expose manifest files through the media endpoint", async () => {
    const response = await call("", { method: "POST", body: upload() });
    const { id } = (await response.json()).media;
    expect((await worker.fetch(new Request(`http://localhost/media/v1/online-projects/records/${id}.json`), env)).status).toBe(404);
  });
  it("reports write conflicts and rejects unsupported methods", async () => {
    const response = await call("", { method: "POST", body: upload() });
    const item = (await response.json()).media;
    media.put.mockResolvedValueOnce(null);
    expect((await edit(item.id)).status).toBe(409);
    expect((await call("", { method: "DELETE" })).status).toBe(405);
    expect((await call(`/${item.id}`, { method: "POST" })).status).toBe(405);
  });
  it("saving as draft removes a published file while retaining its bytes", async () => {
    const response = await call("", { method: "POST", body: upload() });
    const item = (await response.json()).media; await edit(item.id);
    await edit(item.id, "draft", { translations: { ...texts, de: { title: "Neuer Titel" } } });
    expect((await (await publicList()).json()).media).toEqual([]);
    expect((await (await call()).json()).media[0]).toMatchObject({ status: "draft", title: { de: "Neuer Titel" } });
    expect((await worker.fetch(new Request(`http://localhost${item.url.replace("/api/v1/admin/media/", "/media/v1/")}`), env)).status).toBe(404);
  });
  it("reads all pages of stored records without listing binary media files", async () => {
    for (let i = 0; i < 101; i++) {
      const id = crypto.randomUUID();
      await media.put(`online-projects/records/${id}.json`, JSON.stringify({ id, kind: "document", topic: "drawing", status: "published", fileKey: `online-projects/files/${id}.pdf`, translations: Object.fromEntries(Object.entries(texts).map(([lang, text]) => [lang, { ...text, transcript: "" }])), updatedAt: new Date().toISOString() }), { httpMetadata: { contentType: "application/json" } });
    }
    expect((await (await publicList()).json()).media).toHaveLength(101);
    expect(media.list).toHaveBeenCalledTimes(2);
    expect(media.list.mock.calls.every(([options]) => options.prefix === "online-projects/records/")).toBe(true);
  });
  it("rejects an oversized PDF before any writes", async () => {
    const form = upload("document", "application/pdf", new Uint8Array(20 * 1024 * 1024 + 1));
    expect((await call("", { method: "POST", body: form })).status).toBe(413);
    expect(media.put).not.toHaveBeenCalled();
  });
  it("rejects malformed updates and invalid topics or status without altering the record", async () => {
    const response = await call("", { method: "POST", body: upload() });
    const item = (await response.json()).media;
    expect((await edit(item.id, "published", { topic: "unknown" })).status).toBe(400);
    expect((await edit(item.id, "unknown")).status).toBe(400);
    expect((await call(`/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{invalid" })).status).toBe(400);
    expect((await (await call()).json()).media[0].status).toBe("draft");
  });
});
