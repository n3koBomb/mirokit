import { authorizeAdmin } from "./access.js";
import { CSP_REPORT_ONLY } from "./security-headers.js";
import { serviceHost } from "../../site/source/scripts/service-urls.js";

const URL_FIELDS = new Set(["image", "src", "url", "thumbnail", "cover", "poster", "sourceUrl", "posterUrl", "imageUrl", "linkUrl"]);
const ADMIN_FILES = new Set(["/", "/index.html", "/admin.css", "/admin.js", "/media-preview.js", "/online-project-media.js", "/status/", "/status/index.html", "/status/status.js"]);
const ADMIN_SHARED_FILES = new Set(["/status/status.css", "/source/scripts/service-urls.js", "/source/scripts/online-project-topics.js"]);

function reply(status, message = "Not found") {
  return new Response(JSON.stringify({ success: false, message }), { status, headers: {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow",
  } });
}

function redirect(url) {
  return new Response(null, { status: 308, headers: { Location: url.href, "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}

function rewriteRequest(request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url, request);
}

function mapUrls(value, rewrite) {
  if (Array.isArray(value)) return value.map((item) => mapUrls(item, rewrite));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    URL_FIELDS.has(key) && typeof item === "string" ? rewrite(item) : mapUrls(item, rewrite),
  ]));
}

function publicMediaUrl(value, root) {
  if (value.startsWith("/media/v1/")) return `https://api.${root}/v1/media/${value.slice(10)}`;
  try {
    const url = new URL(value);
    const host = serviceHost(url.hostname);
    if (url.protocol === "https:" && !url.port && !url.username && !url.password && host?.service === "site" && url.pathname.startsWith("/media/v1/")) {
      return `https://api.${host.root}/v1/media/${url.pathname.slice(10)}${url.search}${url.hash}`;
    }
  } catch { /* Relative static paths and external URLs stay intact. */ }
  return value;
}

async function finishApiResponse(response, request, env, host, admin) {
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  headers.set("X-Content-Type-Options", "nosniff");
  // Vary also on denied/missing origins to prevent cache-dependent CORS failures.
  const vary = new Set((headers.get("Vary") || "").split(/,\s*/).filter(Boolean));
  vary.add("Origin");
  headers.set("Vary", [...vary].join(", "));
  headers.delete("Access-Control-Allow-Origin");
  headers.delete("Access-Control-Allow-Credentials");
  const origin = request.headers.get("Origin");
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((item) => item.trim());
  if (!admin && origin && allowed.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Accept, Range, If-None-Match, If-Range");
    headers.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, ETag");
    headers.set("Access-Control-Max-Age", "86400");
  }
  if (admin) headers.set("Cache-Control", "private, no-store");
  let body = response.body;
  if (body && headers.get("Content-Type")?.includes("application/json")) {
    const data = await response.json();
    body = JSON.stringify(mapUrls(data, (value) => admin
      ? value.replace(/^\/api\/v1\/admin\//, "/v1/admin/")
      : publicMediaUrl(value, host.root)));
    headers.delete("Content-Length");
  }
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

async function routeServiceRequest(request, env, ctx, handle) {
  const url = new URL(request.url);
  const host = serviceHost(url.hostname);
  // Local development keeps the existing single-origin paths and auth mechanism.
  if (!host) return handle(request, env, ctx);
  const path = url.pathname;
  const adminApi = /^\/(?:api\/)?v1\/admin(?:\/|$)/.test(path);
  if (host.service === "site") {
    // These services are available only on their dedicated production hosts.
    if (["/admin", "/api", "/v1", "/media/v1"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return reply(404);
    return handle(request, env, ctx);
  }
  if (path === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain", "X-Robots-Tag": "noindex, nofollow" } });
  if (host.service === "api") {
    if (adminApi || !path.startsWith("/v1/")) return reply(404);
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("Origin");
      const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((item) => item.trim());
      return finishApiResponse(origin && allowed.includes(origin) ? new Response(null, { status: 204 }) : reply(403, "Origin not allowed"), request, env, host, false);
    }
    const internal = path.startsWith("/v1/media/") ? `/media/v1/${path.slice(10)}` : `/api${path}`;
    return finishApiResponse(await handle(rewriteRequest(request, internal), env, ctx), request, env, host, false);
  }
  // Access is checked for every admin route, including static and preview files.
  if (!await authorizeAdmin(request, env)) return reply(401, "Admin authentication required");
  if (adminApi && path.startsWith("/v1/")) {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return reply(403, "Origin not allowed");
    return finishApiResponse(await handle(rewriteRequest(request, `/api${path}`), env, ctx), request, env, host, true);
  }
  if (path === "/status") { url.pathname = "/status/"; return redirect(url); }
  const shared = ADMIN_SHARED_FILES.has(path) || path.startsWith("/public/favicon/") || path.startsWith("/public/vendor/pdfjs/");
  if (!ADMIN_FILES.has(path) && !shared) return reply(404);
  if (!["GET", "HEAD"].includes(request.method)) return reply(405, "Method not allowed");
  const internal = shared ? path : `/admin${path}`;
  const response = await env.ASSETS.fetch(rewriteRequest(request, internal));
  const headers = new Headers(response.headers);
  if (headers.has("Location")) {
    const location = new URL(headers.get("Location"), url);
    if (location.origin === url.origin && location.pathname.startsWith("/admin/")) {
      location.pathname = location.pathname.slice(6);
      headers.set("Location", location.href);
    }
  }
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Robots-Tag", "noindex, nofollow");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy-Report-Only", CSP_REPORT_ONLY);
  return new Response(response.body, { status: response.status, headers });
}

export { routeServiceRequest, publicMediaUrl };
