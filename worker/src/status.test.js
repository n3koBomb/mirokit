import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "./index.js";
import { queueVisit, recordVisit, shouldRecordVisit, visitMetadata } from "./status.js";

let database, env;
const html = () => new Response("<h1>Website</h1>", { headers: { "Content-Type": "text/html" } });
function request(path = "/", headers = {}, host = "localhost") {
  const req = new Request(`http://${host}${path}`, { headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS) AppleWebKit/605.1 Safari/605.1", ...headers } });
  Object.defineProperty(req, "cf", { value: { country: "DE" } });
  return req;
}
beforeEach(() => {
  database = new DatabaseSync(":memory:");
  database.exec(readFileSync(new URL("../migrations/0009_site_status.sql", import.meta.url), "utf8"));
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
  it.each(["/api/v1/status", "/api/v1/status/visits", "/api/v1/admin/status/visits"])("rejects writes at %s", async (path) => {
    const response = await worker.fetch(new Request(`http://localhost${path}`, { method: "POST" }), env);
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
  });
});
