import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import worker from "./index.js";
import { authorizeAdmin } from "./access.js";
import { routeServiceRequest } from "./service-routing.js";
import { statisticsHostname } from "./status.js";
import { ROOT_DOMAINS, apiUrl, adminUrl, siteUrl, serviceHost, storedMediaPath } from "../../site/source/scripts/service-urls.js";

vi.mock("./access.js", async (original) => ({ ...await original(), authorizeAdmin: vi.fn() }));
beforeEach(() => vi.mocked(authorizeAdmin).mockReset().mockResolvedValue(null));
afterEach(() => vi.restoreAllMocks());

const request = (path, options) => new Request(`https://api.mirokit.com${path}`, options);
const env = { ALLOWED_ORIGINS: "https://mirokit.com,https://www.mirokit.com,https://mirokit.ru" };
const route = (req, handle, bindings = env) => routeServiceRequest(req, bindings, undefined, handle);

describe("service URL contracts", () => {
  it.each(ROOT_DOMAINS)("keeps %s and its service hosts together", (root) => {
    for (const hostname of [root, `www.${root}`, `admin.${root}`, `api.${root}`]) {
      const origin = `https://${hostname}`;
      expect(apiUrl("/v1/news", origin)).toBe(`https://api.${root}/v1/news`);
      expect(apiUrl("/api/v1/admin/news", origin)).toBe(`https://admin.${root}/v1/admin/news`);
      expect(adminUrl("/status/", origin)).toBe(`https://admin.${root}/status/`);
      expect(siteUrl("/page/gallery/", origin)).toBe(`https://${root}/page/gallery/`);
    }
  });
  it.each(["api.mirokit.com.evil.test", "admin.evilmirokit.com", "admin.www.mirokit.com", "preview.mirokit.com"])("does not trust %s", (host) => expect(serviceHost(host)).toBeNull());
  it("preserves localhost URLs and the local token workflow", () => {
    expect(apiUrl("/v1/news", "http://localhost:8787")).toBe("/api/v1/news");
    expect(apiUrl("/v1/admin/media/test.webp", "http://127.0.0.1:8787")).toBe("/api/v1/admin/media/test.webp");
    expect(adminUrl("/status/", "http://localhost:8787")).toBe("http://localhost:8787/admin/status/");
  });
  it.each(["/v1/media/videos/pending/abc.mp4", "https://api.mirokit.ru/v1/media/videos/pending/abc.mp4", "https://www.mirokit.com/media/v1/videos/pending/abc.mp4"])("keeps new URLs compatible with stored references: %s", (value) => {
    expect(storedMediaPath(value)).toBe("/media/v1/videos/pending/abc.mp4");
  });
  it.each(["https://api.mirokit.com.evil.test/v1/media/videos/a.mp4", "https://user@api.mirokit.com/v1/media/videos/a.mp4", "https://api.mirokit.com:444/v1/media/videos/a.mp4"])("does not normalize foreign/credentialed URLs: %s", (value) => expect(storedMediaPath(value)).toBe(value));
  it("runs host routing before every static asset and configures every service domain", () => {
    const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
    expect(config.assets.run_worker_first).toBe(true);
    expect(config.workers_dev).toBe(false);
    for (const root of ROOT_DOMAINS) for (const service of ["api", "admin"]) {
      expect(config.routes).toContainEqual({ pattern: `${service}.${root}`, custom_domain: true });
    }
  });
});

describe("retired service paths on website hosts", () => {
  it.each(ROOT_DOMAINS)("returns 404 without redirecting old routes on %s and www", async (root) => {
    for (const hostname of [root, `www.${root}`]) {
      for (const path of ["/admin", "/admin/", "/admin/admin.js", "/admin/status/", "/api", "/api/v1/news", "/v1", "/v1/news", "/media/v1", "/media/v1/gallery/abc.webp", "/api/v1/admin/news"]) {
        const response = await worker.fetch(new Request(`https://${hostname}${path}?lang=de&x=1`), {});
        expect(response.status).toBe(404);
        expect(response.headers.has("Location")).toBe(false);
      }
    }
  });
  it("rejects old service requests before dispatch for every method", async () => {
    const handler = vi.fn();
    for (const method of ["GET", "HEAD", "POST", "OPTIONS"]) {
      const response = await route(new Request("https://mirokit.com/api/v1/contact", { method, ...(method === "POST" ? { body: "form" } : {}) }), handler);
      expect(response.status).toBe(404);
      expect(response.headers.has("Location")).toBe(false);
    }
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("admin host boundaries", () => {
  it.each(["/", "/admin.js", "/status/", "/v1/admin/news", "/v1/admin/media/news/pending/abc.webp", "/public/vendor/pdfjs/pdf.min.mjs"])("authenticates before serving %s", async (path) => {
    const assets = vi.fn();
    const response = await worker.fetch(new Request(`https://admin.mirokit.com${path}`, { headers: { "X-MiroKIT-Admin-Token": "local-token" } }), { ADMIN_DEV_TOKEN: "local-token", ASSETS: { fetch: assets } });
    expect(response.status).toBe(401);
    expect(assets).not.toHaveBeenCalled();
  });
  it.each([["/", "/admin/"], ["/admin.js", "/admin/admin.js"], ["/status/", "/admin/status/"], ["/status/status.js", "/admin/status/status.js"], ["/status/status.css", "/status/status.css"], ["/source/scripts/service-urls.js", "/source/scripts/service-urls.js"]])("serves authenticated %s from %s", async (path, internal) => {
    vi.mocked(authorizeAdmin).mockResolvedValue({ email: "admin@example.org" });
    const fetch = vi.fn(async () => new Response("asset"));
    const response = await worker.fetch(new Request(`https://admin.mirokit.com${path}`), { ASSETS: { fetch } });
    expect(response.status).toBe(200);
    expect(response.headers.has("Location")).toBe(false);
    expect(new URL(fetch.mock.calls[0][0].url).pathname).toBe(internal);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });
  it("retains upload bodies, methods, authentication headers and preview URLs", async () => {
    vi.mocked(authorizeAdmin).mockResolvedValue({ email: "admin@example.org" });
    const handler = vi.fn(async (req) => {
      expect(req.method).toBe("POST");
      expect(req.headers.get("Cf-Access-Jwt-Assertion")).toBe("signed-token");
      expect(await req.text()).toBe("upload bytes");
      expect(new URL(req.url).pathname).toBe("/api/v1/admin/videos/media");
      return Response.json({ url: "/api/v1/admin/media/videos/pending/abc.mp4" });
    });
    const response = await route(new Request("https://admin.mirokit.com/v1/admin/videos/media", { method: "POST", headers: { Origin: "https://admin.mirokit.com", "Cf-Access-Jwt-Assertion": "signed-token" }, body: "upload bytes" }), handler);
    expect((await response.json()).url).toBe("/v1/admin/media/videos/pending/abc.mp4");
    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });
  it("rejects foreign-origin admin writes before dispatch", async () => {
    vi.mocked(authorizeAdmin).mockResolvedValue({ email: "admin@example.org" });
    const handler = vi.fn();
    const response = await route(new Request("https://admin.mirokit.com/v1/admin/news", { method: "POST", headers: { Origin: "https://mirokit.com" }, body: "{}" }), handler);
    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
  it.each(["/page/gallery/", "/source/scripts/main.js", "/README.md", "/api/v1/admin/news", "/admin", "/admin/status/"])("does not serve unrelated paths at %s", async (path) => {
    vi.mocked(authorizeAdmin).mockResolvedValue({ email: "admin@example.org" });
    expect((await route(new Request(`https://admin.mirokit.com${path}`), vi.fn())).status).toBe(404);
  });
});

describe("public API, CORS and media", () => {
  it.each(["/", "/admin/", "/admin.js", "/public/favicon/favicon.ico", "/v1/admin/news", "/v1/admin/media/news/abc.webp", "/api/v1/admin/news"])("cannot expose admin/static content through %s", async (path) => {
    expect((await worker.fetch(request(path), {})).status).toBe(404);
  });
  it.each([200, 404, 503])("allows configured website origins on %s responses", async (status) => {
    const response = await route(request("/v1/news", { headers: { Origin: "https://mirokit.com" } }), async () => Response.json({ success: status === 200 }, { status }));
    expect(response.status).toBe(status);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://mirokit.com");
    expect(response.headers.get("Vary")).toContain("Origin");
  });
  it.each([undefined, "https://evil.test", "https://mirokit.com.evil.test"])("does not grant CORS access to %s", async (origin) => {
    const response = await route(request("/v1/news", { headers: origin ? { Origin: origin } : {} }), async () => Response.json({}));
    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
    expect(response.headers.get("Vary")).toContain("Origin");
  });
  it("answers public preflights before dispatch without cookies", async () => {
    const handler = vi.fn();
    const response = await route(request("/v1/contact", { method: "OPTIONS", headers: { Origin: "https://mirokit.com", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } }), handler);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
    expect(response.headers.has("Access-Control-Allow-Credentials")).toBe(false);
    expect(handler).not.toHaveBeenCalled();
    expect((await route(request("/v1/contact", { method: "OPTIONS", headers: { Origin: "https://evil.test" } }), handler)).status).toBe(403);
  });
  it("rewrites nested public media references while preserving texts and external URLs", async () => {
    const response = await route(request("/v1/videos"), async () => Response.json({ videos: [{ sourceUrl: "/media/v1/videos/abc.mp4", poster: "https://mirokit.ru/media/v1/video-posters/abc.webp", subtitles: [{ src: "/media/v1/subtitles/abc.vtt" }], title: "/media/v1/text", url: "https://external.example/media/v1/file.pdf" }] }));
    const item = (await response.json()).videos[0];
    expect(item.sourceUrl).toBe("https://api.mirokit.com/v1/media/videos/abc.mp4");
    expect(item.poster).toBe("https://api.mirokit.ru/v1/media/video-posters/abc.webp");
    expect(item.subtitles[0].src).toBe("https://api.mirokit.com/v1/media/subtitles/abc.vtt");
    expect(item.title).toBe("/media/v1/text");
    expect(item.url).toBe("https://external.example/media/v1/file.pdf");
  });
  it("rewrites Gallery folder covers along with their images", async () => {
    const response = await route(request("/v1/gallery"), async () => Response.json({ folders: [{ cover: "/media/v1/gallery/abc.webp", images: [{ image: "/media/v1/gallery/abc.webp" }] }] }));
    const folder = (await response.json()).folders[0];
    expect(folder.cover).toBe("https://api.mirokit.com/v1/media/gallery/abc.webp");
    expect(folder.images[0].image).toBe(folder.cover);
  });
  it("streams published media with ranges/CORS and still denies drafts", async () => {
    const bindings = { ...env, SITE_MEDIA: {
      head: async () => ({ size: 10, httpEtag: '"etag"', customMetadata: { status: "published" }, writeHttpMetadata: (headers) => headers.set("Content-Type", "image/webp") }),
      get: vi.fn(async (_, options) => ({ body: options?.range ? "234" : "0123456789" })),
    } };
    const path = "/v1/media/gallery/550e8400-e29b-41d4-a716-446655440000.webp";
    const headers = { Origin: "https://mirokit.com", Range: "bytes=2-4" };
    const response = await worker.fetch(request(path, { headers }), bindings);
    expect(response.status).toBe(206);
    expect(response.headers.has("Location")).toBe(false);
    expect(response.headers.get("Content-Range")).toBe("bytes 2-4/10");
    expect(response.headers.get("Access-Control-Expose-Headers")).toContain("Content-Range");
    expect(await response.text()).toBe("234");
    expect((await worker.fetch(request(path, { method: "HEAD", headers: { Origin: headers.Origin } }), bindings)).status).toBe(200);
    expect((await worker.fetch(request(path, { headers: { "If-None-Match": '"etag"' } }), bindings)).status).toBe(304);
    bindings.SITE_MEDIA.head = async () => ({ customMetadata: { status: "archived" } });
    expect((await worker.fetch(request(path), bindings)).status).toBe(404);
    expect((await worker.fetch(request(path.replace("gallery/", "gallery/pending/")), bindings)).status).toBe(404);
  });
});

describe("statistics keep their website host", () => {
  it.each([
    ["https://api.mirokit.com/v1/status/visits", {}, "mirokit.com"],
    ["https://api.mirokit.com/v1/status/visits", { Origin: "https://www.mirokit.com" }, "www.mirokit.com"],
    ["https://admin.mirokit.ru/v1/admin/status/visits", {}, "mirokit.ru"],
    ["https://admin.mirokit.com/v1/admin/status/visits?host=www.mirokit.com", {}, "www.mirokit.com"],
    ["https://admin.mirokit.com/v1/admin/status/visits?host=mirokit.ru", {}, "mirokit.com"],
    ["https://api.mirokit.com/v1/status/visits", { Origin: "https://evil.test" }, "mirokit.com"],
    ["http://localhost:8787/api/v1/status/visits", {}, "localhost"],
  ])("selects %s as %s", (url, headers, expected) => expect(statisticsHostname(new Request(url, { headers }))).toBe(expected));
});
