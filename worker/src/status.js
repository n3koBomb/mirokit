import { authorizeAdmin } from "./access.js";
import { CSP_REPORT_ONLY } from "./security-headers.js";

const DETAIL_DAYS = 90;
const DAY_MS = 86400000;

function statusJson(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy-Report-Only": CSP_REPORT_ONLY,
      ...extraHeaders,
    },
  });
}

export function visitMetadata(request) {
  const ua = request.headers.get("User-Agent") || "";
  const country = String(request.cf?.country || "").toUpperCase();
  return {
    country: /^[A-Z]{2}$/.test(country) ? country : "unknown",
    device: !ua ? "unknown" : /ipad|tablet|android(?!.*mobile)/i.test(ua) ? "tablet" : /mobile|iphone|ipod/i.test(ua) ? "mobile" : "desktop",
    browser: !ua ? "unknown" : /edg\//i.test(ua) ? "Edge" : /firefox|fxios/i.test(ua) ? "Firefox" : /chrome|crios/i.test(ua) ? "Chrome" : /safari/i.test(ua) ? "Safari" : "other",
  };
}

export function shouldRecordVisit(request, response) {
  const path = new URL(request.url).pathname;
  return request.method === "GET" && response.status === 200 &&
    Boolean(response.headers.get("Content-Type")?.includes("text/html")) &&
    (path === "/" || path === "/index.html" || path.startsWith("/page/") || path.startsWith("/status/")) &&
    request.headers.get("DNT") !== "1" && request.headers.get("Sec-GPC") !== "1" &&
    !request.headers.get("Purpose")?.includes("prefetch") && !request.headers.get("Sec-Purpose")?.includes("prefetch") &&
    !/bot|crawler|spider|headless|preview|monitor|curl|wget/i.test(request.headers.get("User-Agent") || "") &&
    request.cf?.botManagement?.verifiedBot !== true;
}

export async function recordVisit(request, env, now = new Date()) {
  const url = new URL(request.url);
  const { country, device, browser } = visitMetadata(request);
  const path = url.pathname === "/index.html" ? "/" : url.pathname.replace(/\/index\.html$/, "/");
  const timestamp = now.toISOString();
  // Bound paths to public documents; query strings, IPs and raw user agents are never stored.
  const values = [url.hostname, timestamp.slice(0, 10), path, country, device];
  await env.SITE_DB.batch([
    env.SITE_DB.prepare(`INSERT INTO site_visit_totals (host, day, path, country, device, views)
      VALUES (?, ?, ?, ?, ?, 1) ON CONFLICT(host, day, path, country, device)
      DO UPDATE SET views = views + 1`).bind(...values),
    env.SITE_DB.prepare(`INSERT INTO site_visit_details (host, visited_at, path, country, device, browser)
      VALUES (?, ?, ?, ?, ?, ?)`).bind(url.hostname, timestamp, path, country, device, browser),
    env.SITE_DB.prepare("DELETE FROM site_visit_details WHERE visited_at < ?")
      .bind(new Date(now.getTime() - DETAIL_DAYS * DAY_MS).toISOString()),
  ]);
}

export function queueVisit(request, response, env, ctx) {
  if (!env.SITE_DB || !ctx?.waitUntil || !shouldRecordVisit(request, response)) return;
  ctx.waitUntil(recordVisit(request, env).catch(() => {
    // An unapplied migration or unavailable analytics must never break the website.
    console.warn("Site visit counters unavailable");
  }));
}

async function probe(id, operation) {
  if (!operation) return { id, status: "unconfigured", latencyMs: null };
  const started = Date.now();
  let timer;
  try {
    await Promise.race([
      operation(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 4000); }),
    ]);
    return { id, status: "operational", latencyMs: Date.now() - started };
  } catch {
    return { id, status: "unavailable", latencyMs: null };
  } finally {
    clearTimeout(timer);
  }
}

async function serviceStatus(request, env) {
  const components = await Promise.all([
    probe("worker", async () => {}),
    probe("website", env.ASSETS && (async () => {
      const response = await env.ASSETS.fetch(new Request(new URL("/", request.url), { method: "HEAD" }));
      if (response.status !== 200) throw new Error("assets unavailable");
    })),
    probe("database", env.SITE_DB && (async () => { await env.SITE_DB.prepare("SELECT 1").first(); })),
    probe("media", env.SITE_MEDIA && (async () => { await env.SITE_MEDIA.list({ limit: 1 }); })),
  ]);
  return statusJson({
    success: true,
    status: components.every((item) => item.status === "operational") ? "operational" : "degraded",
    checkedAt: new Date().toISOString(),
    components,
  });
}

async function visitSummary(request, env) {
  const host = new URL(request.url).hostname;
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 29 * DAY_MS).toISOString().slice(0, 10);
  const db = env.SITE_DB;
  if (!db) return statusJson({ success: false, code: "statistics_unavailable" }, 503);
  try {
    const [totals, daily, countries, devices, pages] = await Promise.all([
      db.prepare(`SELECT COALESCE(SUM(views), 0) AS views,
        COALESCE(SUM(CASE WHEN day = ? THEN views ELSE 0 END), 0) AS today,
        MIN(day) AS since FROM site_visit_totals WHERE host = ?`).bind(today, host).first(),
      db.prepare("SELECT day, SUM(views) AS views FROM site_visit_totals WHERE host = ? AND day >= ? GROUP BY day ORDER BY day").bind(host, since).all(),
      db.prepare("SELECT country AS label, SUM(views) AS views FROM site_visit_totals WHERE host = ? GROUP BY country ORDER BY views DESC, country LIMIT 20").bind(host).all(),
      db.prepare("SELECT device AS label, SUM(views) AS views FROM site_visit_totals WHERE host = ? GROUP BY device ORDER BY views DESC, device").bind(host).all(),
      db.prepare("SELECT path AS label, SUM(views) AS views FROM site_visit_totals WHERE host = ? GROUP BY path ORDER BY views DESC, path LIMIT 20").bind(host).all(),
    ]);
    return statusJson({ success: true, host, totals, daily: daily.results, countries: countries.results, devices: devices.results, pages: pages.results });
  } catch {
    return statusJson({ success: false, code: "statistics_unavailable" }, 503);
  }
}

async function visitDetails(request, env) {
  if (!await authorizeAdmin(request, env)) return statusJson({ success: false, code: "unauthorized" }, 401);
  if (!env.SITE_DB) return statusJson({ success: false, code: "statistics_unavailable" }, 503);
  const url = new URL(request.url);
  const before = url.searchParams.get("before") || "";
  if (before && !/^[1-9]\d{0,14}$/.test(before)) return statusJson({ success: false, code: "invalid_cursor" }, 400);
  try {
    const result = await env.SITE_DB.prepare(`SELECT id, visited_at AS visitedAt, path, country, device, browser
      FROM site_visit_details WHERE host = ? AND visited_at >= ? AND id < ? ORDER BY id DESC LIMIT 101`)
      .bind(url.hostname, new Date(Date.now() - DETAIL_DAYS * DAY_MS).toISOString(), before ? Number(before) : Number.MAX_SAFE_INTEGER).all();
    const visits = result.results.slice(0, 100);
    return statusJson({ success: true, visits, nextCursor: result.results.length > 100 ? String(visits.at(-1).id) : null, retentionDays: DETAIL_DAYS });
  } catch {
    return statusJson({ success: false, code: "statistics_unavailable" }, 503);
  }
}

export async function handleStatusRequest(request, env) {
  if (request.method !== "GET") return statusJson({ success: false, code: "method_not_allowed" }, 405, { Allow: "GET" });
  const path = new URL(request.url).pathname;
  if (path === "/api/v1/status") return serviceStatus(request, env);
  if (path === "/api/v1/status/visits") return visitSummary(request, env);
  return visitDetails(request, env);
}
