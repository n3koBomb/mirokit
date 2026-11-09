// Shared by browser clients and the Worker. Only these exact domains are trusted.
const ROOT_DOMAINS = Object.freeze(["mirokit.com", "mirokit.ru", "ligamirokit.com", "ligamirokit.ru"]);

function serviceHost(hostname) {
  const host = String(hostname || "").trim().toLowerCase().replace(/\.$/, "");
  for (const root of ROOT_DOMAINS) {
    if (host === root || host === `www.${root}`) return { root, service: "site" };
    if (host === `admin.${root}`) return { root, service: "admin" };
    if (host === `api.${root}`) return { root, service: "api" };
  }
  return null;
}

function apiUrl(path, origin = globalThis.location.origin) {
  const host = serviceHost(new URL(origin).hostname);
  const versioned = path.replace(/^\/api\/v1(?=\/|\?|$)/, "/v1");
  if (!host) return versioned.replace(/^\/v1(?=\/|\?|$)/, "/api/v1");
  // Admin requests use the same Access cookie as the Content Desk.
  const service = /^\/v1\/admin(?:\/|\?|$)/.test(versioned) ? "admin" : "api";
  return `https://${service}.${host.root}${versioned}`;
}

function siteUrl(path, origin = globalThis.location.origin) {
  const host = serviceHost(new URL(origin).hostname);
  return host ? `https://${host.root}${path}` : new URL(path, origin).href;
}

function adminUrl(path = "/", origin = globalThis.location.origin) {
  const host = serviceHost(new URL(origin).hostname);
  return host ? `https://admin.${host.root}${path}` : new URL(`/admin${path}`, origin).href;
}

// Preserve the existing storage contract when editors paste a new public URL.
function storedMediaPath(value) {
  if (value.startsWith("/v1/media/")) return `/media/v1/${value.slice(10)}`;
  try {
    const url = new URL(value);
    const host = serviceHost(url.hostname);
    if (url.protocol !== "https:" || url.port || url.username || url.password) return value;
    if (host?.service === "api" && url.pathname.startsWith("/v1/media/")) return `/media/v1/${url.pathname.slice(10)}${url.search}${url.hash}`;
    if (host?.service === "site" && url.pathname.startsWith("/media/v1/")) return `${url.pathname}${url.search}${url.hash}`;
  } catch { /* Other paths are validated by the caller. */ }
  return value;
}

export { ROOT_DOMAINS, serviceHost, apiUrl, siteUrl, adminUrl, storedMediaPath };
