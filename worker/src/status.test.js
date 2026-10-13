import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "./index.js";
import { queueVisit, recordVisit, shouldRecordVisit, visitMetadata, requestActivity, recordRequestDiagnostic } from "./status.js";

let database, env;
const html = () => new Response("<h1>Website</h1>", { headers: { "Content-Type": "text/html" } });
function request(path = "/", headers = {}, host = "localhost", cf = { country: "DE" }) {
  const req = new Request(`http://${host}${path}`, { headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS) AppleWebKit/605.1 Safari/605.1", ...headers } });
  Object.defineProperty(req, "cf", { value: cf });
  return req;
}
beforeEach(() => {
  database = new DatabaseSync(":memory:");
  database.exec(readFileSync(new URL("../migrations/0009_site_status.sql", import.meta.url), "utf8"));
  database.exec(readFileSync(new URL("../migrations/0010_request_diagnostics.sql", import.meta.url), "utf8"));
  const statement = (sql, params = []) => ({
    bind: (...values) => statement(sql, values),
    first: async () => database.prepare(sql).get(...params) || null,
    all: async () => ({ results: database.prepare(sql).all(...params) }),
    run: async () => database.prepare(sql).run(...params),
  });
  env = {
    ADMIN_DEV_TOKEN: "test-admin",
    SITE_DB: { prepare: (sql) => statement(sql), batch: async (statements) => Promise.all(statements.map((item) => item.run())) },
    ASSETS: { fetch: vi.fn(async () => html()) },
    SITE_MEDIA: { list: vi.fn(async () => ({ objects: [] })) },
  };
});
afterEach(() => { database.close(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("visit counting and privacy boundaries", () => {
  it("increments permanent counters, strips query strings and exposes only aggregates publicly", async () => {
    await recordVisit(request("/page/gallery/?email=private@example.com", { "CF-Connecting-IP": "192.0.2.1" }), env);
    await recordVisit(request("/page/gallery/?token=secret"), env);
    const response = await worker.fetch(request("/api/v1/status/visits"), env);
    const result = await response.json();
    expect(result.totals.views).toBe(2);
    expect(result.totals.today).toBe(2);
    expect(result.countries).toEqual([{ label: "DE", views: 2 }]);
    expect(result.devices).toEqual([{ label: "mobile", views: 2 }]);
    expect(result.pages).toEqual([{ label: "/page/gallery/", views: 2 }]);
    expect(result).not.toHaveProperty("visits");
    expect(JSON.stringify(database.prepare("SELECT * FROM site_visit_details").all())).not.toMatch(/private|secret|192\.0\.2|Mozilla/);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("keeps each domain's statistics separate", async () => {
    await recordVisit(request(), env);
    await recordVisit(request("/", {}, "mirokit.ru"), env);
    const result = await (await worker.fetch(request("/api/v1/status/visits"), env)).json();
    expect(result.totals.views).toBe(1);
  });
  it("keeps lifetime totals while pruning detail records older than 90 days", async () => {
    await recordVisit(request(), env, new Date(Date.now() - 91 * 86400000));
    await recordVisit(request(), env);
    expect(database.prepare("SELECT SUM(views) AS count FROM site_visit_totals").get().count).toBe(2);
    expect(database.prepare("SELECT COUNT(*) AS count FROM site_visit_details").get().count).toBe(1);
  });
  it.each([
    ["/admin/", {}], ["/api/v1/news", {}], ["/public/private.html", {}],
    ["/", { DNT: "1" }], ["/", { "Sec-GPC": "1" }], ["/", { "User-Agent": "Googlebot" }],
    ["/", { Purpose: "prefetch" }], ["/", { "Sec-Purpose": "prefetch;prerender" }],
  ])("does not record %s with %j", (path, headers) => {
    expect(shouldRecordVisit(request(path, headers), html())).toBe(false);
  });
  it("ignores HEAD, errors and non-HTML assets", () => {
    expect(shouldRecordVisit(new Request("http://localhost/", { method: "HEAD" }), html())).toBe(false);
    expect(shouldRecordVisit(request(), new Response("missing", { status: 404, headers: { "Content-Type": "text/html" } }))).toBe(false);
    expect(shouldRecordVisit(request(), new Response("CSS", { headers: { "Content-Type": "text/css" } }))).toBe(false);
    expect(shouldRecordVisit(request("/page/gallery/gallery.css"), new Response(null, { status: 304, headers: { "Content-Type": "text/css" } }))).toBe(false);
  });
  it("counts HTML revalidation on refresh while preserving the 304 response", async () => {
    const pending = [];
    const ctx = { waitUntil: (promise) => pending.push(promise) };
    await worker.fetch(request("/status/"), env, ctx);
    await Promise.all(pending);
    env.ASSETS.fetch = async () => new Response(null, {
      status: 304, headers: { "Content-Type": "text/html; charset=utf-8", ETag: '"unchanged"' },
    });
    const response = await worker.fetch(request("/status/", { "If-None-Match": '"unchanged"' }), env, ctx);
    await Promise.all(pending);
    expect(response.status).toBe(304);
    expect(response.body).toBeNull();
    expect(response.headers.get("ETag")).toBe('"unchanged"');
    expect(database.prepare("SELECT SUM(views) AS views FROM site_visit_totals").get().views).toBe(2);
  });
  it.each([{ DNT: "1" }, { "Sec-GPC": "1" }, { "User-Agent": "Googlebot" }])("still excludes cached HTML visits with %j", (headers) => {
    expect(shouldRecordVisit(request("/status/", headers), new Response(null, { status: 304, headers: { "Content-Type": "text/html" } }))).toBe(false);
  });
  it("uses unknown instead of fabricating a country or device", () => {
    expect(visitMetadata(new Request("http://localhost/"))).toEqual({ country: "unknown", device: "unknown", browser: "unknown" });
  });
  it("counts background page requests without delaying or breaking asset delivery", async () => {
    const pending = [];
    const response = await worker.fetch(request(), env, { waitUntil: (promise) => pending.push(promise) });
    expect(response.status).toBe(200);
    await Promise.all(pending);
    expect(database.prepare("SELECT SUM(views) AS views FROM site_visit_totals").get().views).toBe(1);
    env.SITE_DB.batch = async () => { throw new Error("migration missing"); };
    vi.spyOn(console, "warn").mockImplementation(() => {});
    queueVisit(request(), html(), env, { waitUntil: (promise) => pending.push(promise) });
    await expect(Promise.all(pending)).resolves.toBeDefined();
  });
});

describe("admin-only bot and DNT/GPC aggregates", () => {
  const adminHeaders = { "X-MiroKIT-Admin-Token": "test-admin" };
  async function diagnostics(host = "localhost") {
    return (await worker.fetch(request("/api/v1/admin/status/diagnostics", adminHeaders, host), env)).json();
  }
  async function track(req, response = html()) {
    const pending = [];
    queueVisit(req, response, env, { waitUntil: (promise) => pending.push(promise) });
    await Promise.all(pending);
  }
  it.each([
    ["Googlebot/2.1", "Googlebot"], ["bingbot/2.0", "bingbot"], ["YandexBot/3.0", "YandexBot"],
    ["GPTBot/1.2", "GPTBot"], ["OAI-SearchBot/1.0", "OAI-SearchBot"], ["ChatGPT-User/1.0", "ChatGPT-User"],
    ["ClaudeBot/1.0", "ClaudeBot"], ["PerplexityBot/1.0", "PerplexityBot"],
    ["facebookexternalhit/1.1", "Facebook crawler"], ["curl/8.0", "curl"],
  ])("recognizes %s without treating its name as verification", (ua, agent) => {
    expect(requestActivity(request("/", { "User-Agent": ua }))).toMatchObject({ agent, isBot: true, verifiedBot: false });
  });
  it("keeps bots and privacy signals separate from normal visits and counts overlapping signals once", async () => {
    await track(request());
    await track(request("/page/gallery/?token=private", { "User-Agent": "Googlebot/2.1" }));
    await track(request("/page/gallery/?email=secret", { "User-Agent": "Googlebot/2.1" }));
    await track(request("/", { DNT: "1" }));
    await track(request("/", { "Sec-GPC": "1" }));
    await track(request("/status/", { "User-Agent": "GPTBot/1.0", DNT: "1", "Sec-GPC": "1" }), new Response(null, { status: 304, headers: { "Content-Type": "text/html" } }));
    const data = await diagnostics();
    expect(data.totals).toEqual({ requests: 5, bots: 3, dnt: 2, gpc: 2, groups: 4 });
    expect(data.groups.find((row) => row.agent === "Googlebot")).toMatchObject({ views: 2, path: "/page/gallery/", verifiedBot: 0 });
    expect(data.groups.find((row) => row.agent === "browser")).toMatchObject({ isBot: 0 });
    const publicData = await (await worker.fetch(request("/api/v1/status/visits"), env)).json();
    expect(publicData.totals.views).toBe(1);
    expect(publicData).not.toHaveProperty("agents");
    expect(database.prepare("SELECT COUNT(*) AS count FROM site_visit_details").get().count).toBe(1);
    const stored = database.prepare("SELECT * FROM site_request_diagnostics").all();
    expect(JSON.stringify(stored)).not.toMatch(/private|secret|Mozilla|iPhone|Googlebot\/2\.1/);
    expect(stored[0]).not.toHaveProperty("visited_at");
    expect(stored[0]).not.toHaveProperty("country");
  });
  it("accepts only Cloudflare metadata as verification, including an otherwise unrecognized bot", async () => {
    await track(request("/", {}, "localhost", { botManagement: { verifiedBot: true } }));
    await track(request("/", { "User-Agent": "Googlebot/2.1", "X-Verified-Bot": "true" }));
    const { agents } = await diagnostics();
    expect(agents.find((item) => item.agent === "verified-bot").verifiedBot).toBe(1);
    expect(agents.find((item) => item.agent === "Googlebot").verifiedBot).toBe(0);
  });
  it("uses fixed labels for unknown automation and does not classify privacy signals as bots", () => {
    expect(requestActivity(request("/", { "User-Agent": "private-custom-crawler/person@example.com" }))).toMatchObject({ agent: "other-automation", isBot: true });
    expect(requestActivity(request("/", { DNT: "1", "Sec-GPC": "1" }))).toEqual({ agent: "browser", isBot: false, verifiedBot: false, dnt: true, gpc: true });
  });
  it("authenticates before querying storage and never accepts a local token on production", async () => {
    const prepare = vi.spyOn(env.SITE_DB, "prepare");
    expect((await worker.fetch(request("/api/v1/admin/status/diagnostics"), env)).status).toBe(401);
    expect((await worker.fetch(request("/api/v1/admin/status/diagnostics", adminHeaders, "mirokit.com"), env)).status).toBe(401);
    expect(prepare).not.toHaveBeenCalled();
  });
  it("isolates domains and keeps diagnostic responses private", async () => {
    await recordRequestDiagnostic(request("/", { DNT: "1" }), env);
    await recordRequestDiagnostic(request("/", { "User-Agent": "Googlebot/2.1" }, "mirokit.ru"), env);
    const response = await worker.fetch(request("/api/v1/admin/status/diagnostics", adminHeaders), env);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const data = await response.json();
    expect(data.totals.requests).toBe(1);
    expect(data.totals.bots).toBe(0);
    expect(data.agents).toEqual([]);
  });
  it("hides and prunes expired daily groups", async () => {
    await recordRequestDiagnostic(request("/", { DNT: "1" }), env, new Date(Date.now() - 90 * 86400000));
    expect((await diagnostics()).totals.requests).toBe(0);
    await recordRequestDiagnostic(request("/", { DNT: "1" }), env);
    expect(database.prepare("SELECT COUNT(*) AS count FROM site_request_diagnostics").get().count).toBe(1);
  });
  it("bounds displayed groups without truncating totals", async () => {
    for (let i = 0; i < 201; i++) await recordRequestDiagnostic(request(`/page/item-${i}/`, { DNT: "1" }), env);
    const data = await diagnostics();
    expect(data.groups).toHaveLength(200);
    expect(data.totals.groups).toBe(201);
    expect(data.totals.requests).toBe(201);
  });
  it("keeps ordinary recording and page delivery working when migration 0010 is missing", async () => {
    database.exec("DROP TABLE site_request_diagnostics");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await track(request());
    await expect(track(request("/", { DNT: "1" }))).resolves.toBeUndefined();
    expect(database.prepare("SELECT SUM(views) AS views FROM site_visit_totals").get().views).toBe(1);
    expect((await worker.fetch(request("/api/v1/admin/status/diagnostics", adminHeaders), env)).status).toBe(503);
  });
  it.each(["/robots.txt", "/sitemap.xml"])("includes crawler requests to %s without inflating public visits", async (path) => {
    const pending = [];
    const ctx = { waitUntil: (promise) => pending.push(promise) };
    expect((await worker.fetch(request(path, { "User-Agent": "Googlebot/2.1" }), env, ctx)).status).toBe(200);
    await worker.fetch(request(path), env, ctx);
    await Promise.all(pending);
    const data = await diagnostics();
    expect(data.totals.requests).toBe(1);
    expect(data.groups[0].path).toBe(path);
    expect(database.prepare("SELECT COUNT(*) AS count FROM site_visit_totals").get().count).toBe(0);
  });
  it("ignores admin, API, assets, errors, HEAD and prefetch even with bot/privacy signals", async () => {
    const headers = { "User-Agent": "Googlebot/2.1", DNT: "1" };
    for (const path of ["/admin/", "/api/v1/status", "/public/test.html"]) await track(request(path, headers));
    await track(request("/", { ...headers, Purpose: "prefetch" }));
    await track(request("/", headers), new Response("error", { status: 404, headers: { "Content-Type": "text/html" } }));
    await track(new Request("http://localhost/", { method: "HEAD", headers }));
    await track(request("/page/gallery/gallery.css", headers), new Response("css", { headers: { "Content-Type": "text/css" } }));
    expect((await diagnostics()).totals.requests).toBe(0);
  });
});

describe("protected visit details", () => {
  it("rejects anonymous requests before accessing storage", async () => {
    const prepare = vi.spyOn(env.SITE_DB, "prepare");
    const response = await worker.fetch(request("/api/v1/admin/status/visits"), env);
    expect(response.status).toBe(401);
    expect(prepare).not.toHaveBeenCalled();
  });
  it("ignores a local admin token on a production host", async () => {
    const response = await worker.fetch(request("/api/v1/admin/status/visits", { "X-MiroKIT-Admin-Token": "test-admin" }, "mirokit.com"), env);
    expect(response.status).toBe(401);
  });
  it("protects the admin HTML page on production hosts", async () => {
    const response = await worker.fetch(request("/admin/status/", {}, "mirokit.com"), env);
    expect(response.status).toBe(401);
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });
  it("paginates details without duplicates and excludes expired records", async () => {
    const stmt = database.prepare("INSERT INTO site_visit_details (host, visited_at, path, country, device, browser) VALUES ('localhost', ?, '/', 'DE', 'desktop', 'Firefox')");
    stmt.run(new Date(Date.now() - 91 * 86400000).toISOString());
    for (let i = 0; i < 101; i++) stmt.run(new Date().toISOString());
    const headers = { "X-MiroKIT-Admin-Token": "test-admin" };
    const first = await (await worker.fetch(request("/api/v1/admin/status/visits", headers), env)).json();
    const next = await (await worker.fetch(request(`/api/v1/admin/status/visits?before=${first.nextCursor}`, headers), env)).json();
    expect(first.visits).toHaveLength(100);
    expect(next.visits).toHaveLength(1);
    expect(next.nextCursor).toBeNull();
    expect(first.visits.map((item) => item.id)).not.toContain(next.visits[0].id);
    expect(first.visits[0].browser).toBe("Firefox");
  });
  it("validates the pagination cursor", async () => {
    expect((await worker.fetch(request("/api/v1/admin/status/visits?before=bad", { "X-MiroKIT-Admin-Token": "test-admin" }), env)).status).toBe(400);
  });
});

describe("status routing and live checks", () => {
  it.each(["/site/status", "/site/status/", "/site/status/index.html", "/status", "/status/index.html"])("routes %s to the canonical page and keeps its view", async (path) => {
    const response = await worker.fetch(request(`${path}?view=visitors&lang=de`), env);
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe("/status/?view=visitors&lang=de");
  });
  it("serves the canonical page without redirect loops", async () => {
    const response = await worker.fetch(request("/status/"), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("max-age=0");
  });
  it("checks real read-only bindings and reports partial failures", async () => {
    const good = await (await worker.fetch(request("/api/v1/status"), env)).json();
    expect(good.status).toBe("operational");
    expect(good.components).toHaveLength(4);
    expect(env.SITE_MEDIA.list).toHaveBeenCalledWith({ limit: 1 });
    env.SITE_MEDIA.list = async () => { throw new Error("private-storage-error"); };
    const bad = await (await worker.fetch(request("/api/v1/status"), env)).json();
    expect(bad.status).toBe("degraded");
    expect(bad.components.find((item) => item.id === "media").status).toBe("unavailable");
    expect(JSON.stringify(bad)).not.toContain("private-storage-error");
  });
  it("reports missing bindings and missing statistics honestly", async () => {
    const health = await (await worker.fetch(request("/api/v1/status"), {})).json();
    expect(health.status).toBe("degraded");
    expect(health.components.find((item) => item.id === "database").status).toBe("unconfigured");
    expect((await worker.fetch(request("/api/v1/status/visits"), {})).status).toBe(503);
    database.exec("DROP TABLE site_visit_totals");
    expect((await worker.fetch(request("/api/v1/status/visits"), env)).status).toBe(503);
  });
  it("bounds stalled binding checks", async () => {
    vi.useFakeTimers();
    env.SITE_MEDIA.list = () => new Promise(() => {});
    const response = worker.fetch(request("/api/v1/status"), env);
    await vi.advanceTimersByTimeAsync(4001);
    const result = await (await response).json();
    expect(result.status).toBe("degraded");
    expect(result.components.find((item) => item.id === "media").status).toBe("unavailable");
  });
  it.each(["/api/v1/status", "/api/v1/status/visits", "/api/v1/admin/status/visits", "/api/v1/admin/status/diagnostics"])("rejects writes at %s", async (path) => {
    const response = await worker.fetch(new Request(`http://localhost${path}`, { method: "POST" }), env);
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
  });
});
