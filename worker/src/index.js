import { authorizeAdmin, isLocalHostname } from "./access.js";
import {
	NEWS_ADMIN_QUERY,
	NEWS_PUBLIC_QUERY,
	newsError,
	normalizeNewsId,
	normalizeNewsInput,
	newsToStatements,
	rowsToAdminNews,
	rowsToNews,
} from "./news.js";
import {
	PARTNERS_ADMIN_QUERY,
	PARTNERS_PUBLIC_QUERY,
	WORLD_ADMIN_QUERY,
	WORLD_PUBLIC_QUERY,
	contentError,
	normalizePartnerInput,
	normalizeWorldPointInput,
	partnerStatements,
	rowsToPartners,
	rowsToPublicPartners,
	rowsToPublicWorldPoints,
	rowsToWorldPoints,
	worldPointStatements,
} from "./content.js";
import {
	VIDEO_ASSET_PATTERN,
	VIDEOS_ADMIN_QUERY,
	VIDEOS_PUBLIC_QUERY,
	normalizeVideoInput,
	rowsToPublicVideos,
	rowsToVideos,
	videoError,
	videoStatements,
} from "./videos.js";

const FORM_TYPES = new Set([
	"main-contact",
	"extra-contact",
]);

const FORM_FIELD_ALLOWLIST = Object.freeze({
	"main-contact": new Set([
		"name",
		"email",
		"country",
		"city",
		"organization",
		"phone",
		"topic",
		"message",
		"consent_required",
		"consent_optional",
		"website_check",
	]),
	"extra-contact": new Set([
		"organization_full",
		"organization_short",
		"address",
		"country",
		"city",
		"region",
		"postcode",
		"contact_name",
		"role",
		"email",
		"phone",
		"sozialMedia",
		"activities",
		"member_count",
		"goals",
		"about",
		"website",
		"confirm_accuracy",
		"confirm_goals",
		"confirm_privacy",
		"website_check",
	]),
});

const MULTI_VALUE_FIELDS = new Set(["activities", "goals"]);
const RATE_LIMIT_WINDOW_SECONDS = 60;
const SITE_API_PREFIX = "/api/v1";
const NEWS_API_PATH = `${SITE_API_PREFIX}/news`;
const GALLERY_API_PATH = `${SITE_API_PREFIX}/gallery`;
const WORLD_POINTS_API_PATH = `${SITE_API_PREFIX}/world-points`;
const PARTNERS_API_PATH = `${SITE_API_PREFIX}/partners`;
const VIDEOS_API_PATH = `${SITE_API_PREFIX}/videos`;
const CONTACT_API_PATH = `${SITE_API_PREFIX}/contact`;
const ADMIN_PANEL_PREFIX = "/admin";
const ADMIN_PANEL_API_PREFIX = `${SITE_API_PREFIX}/admin`;
const SITE_MEDIA_PREFIX = "/media/v1/";
const GALLERY_PREFIX = "gallery/";
const GALLERY_KEY_PATTERN = /^gallery\/[a-f0-9-]+\.(?:jpg|png|webp|avif)$/;
const GALLERY_PERMANENT_KEY_PATTERN = /^gallery\/[a-f0-9-]+\.(?:jpg|png|webp|avif)$/;
const GALLERY_LANGUAGES = Object.freeze(["ru", "en", "de"]);
const GALLERY_STATUSES = new Set(["published", "archived"]);
const GALLERY_COLLECTIONS = new Set(["gallery", "online-projects"]);
const GALLERY_QUOTE_LANGUAGES = Object.freeze(["ru", "en", "de"]);
const GALLERY_IMAGE_TYPES = Object.freeze({
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/avif": "avif",
});
const GALLERY_REMOTE_IMAGE_HOSTS = new Set([
	"drive.google.com",
	"drive.usercontent.google.com",
	"docs.google.com",
]);
const GALLERY_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const VIDEO_UPLOAD_MAX_BYTES = 95 * 1024 * 1024;
const VIDEO_POSTER_MAX_BYTES = 8 * 1024 * 1024;

const GALLERY_QUOTES_PUBLIC_QUERY = `
SELECT q.id, q.status, q.created_at, q.updated_at,
  t.language, t.quote, t.byline
FROM gallery_quotes q
JOIN gallery_quote_translations t ON t.quote_id = q.id
WHERE q.status = 'published'
ORDER BY q.created_at DESC, q.id ASC, t.language ASC
`;

const GALLERY_QUOTES_ADMIN_QUERY = `
SELECT q.id, q.status, q.created_at, q.updated_at,
  t.language, t.quote, t.byline
FROM gallery_quotes q
JOIN gallery_quote_translations t ON t.quote_id = q.id
ORDER BY q.created_at DESC, q.updated_at DESC, q.id ASC, t.language ASC
`;

const TURNSTILE_TEST_SECRET =
	"1x0000000000000000000000000000000AA";

const COMMON_RESPONSE_HEADERS = Object.freeze({
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Permissions-Policy":
		"camera=(), microphone=(), geolocation=(), payment=()",
});

const SITEMAP_PATHS = Object.freeze([
	{
		path: "/",
		changefreq: "weekly",
		priority: "1.0",
	},
	{
		path: "/page/privacyPolicy/",
		changefreq: "yearly",
		priority: "0.3",
	},
	{
		path: "/page/onlineProjects/",
		changefreq: "weekly",
		priority: "0.7",
	},
]);

const PROTECTED_ASSET_PREFIXES = Object.freeze([
	"/public/assets/archive/",
	"/public/assets/uploads/",
	"/public/assets/media/interviews/transcripts/",
	"/public/assets/media/press/",
]);

function escapeXml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

function getCanonicalSiteHostname(hostname) {
	const normalizedHostname = String(hostname || "")
		.trim()
		.toLowerCase()
		.replace(/\.$/, "");

	if (
		normalizedHostname === "mirokit.ru" ||
		normalizedHostname.endsWith(".ru")
	) {
		return "mirokit.ru";
	}

	if (
		normalizedHostname === "mirokit.com" ||
		normalizedHostname.endsWith(".com")
	) {
		return "mirokit.com";
	}

	return null;
}

function isProductionHostname(hostname) {
	return Boolean(getCanonicalSiteHostname(hostname));
}

function isProtectedAssetPath(pathname) {
	return PROTECTED_ASSET_PREFIXES.some((prefix) =>
		pathname.startsWith(prefix)
	);
}

function forbiddenAssetResponse() {
	return new Response(
		`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>403 — Access denied | MIRoKIT</title></head>
<body style="margin:0;padding:3rem;background:#eef4ff;color:#0d1b4b;font:16px system-ui,sans-serif;text-align:center">
<main><h1>403 — Access denied</h1><p>Oops, this content is reserved for the MIRoKIT website and is not available as a direct file.</p></main>
</body>
</html>`,
		{
			status: 403,
			headers: {
				...COMMON_RESPONSE_HEADERS,
				"Content-Type": "text/html; charset=utf-8",
				"Cache-Control": "no-store",
				"X-Robots-Tag": "noindex, nofollow",
			},
		}
	);
}

function createRobotsTxt(hostname) {
	const canonicalSiteHostname = getCanonicalSiteHostname(hostname);

	if (!canonicalSiteHostname) {
		return [
			"User-agent: *",
			"Disallow: /",
			"",
		].join("\n");
	}

	return [
		"User-agent: *",
		"Allow: /",
		"Disallow: /api/",
		"Disallow: /admin/",
		"",
		`Sitemap: https://${canonicalSiteHostname}/sitemap.xml`,
		"",
	].join("\n");
}

function createSitemapXml(hostname) {
	const canonicalSiteHostname = getCanonicalSiteHostname(hostname);

	if (!canonicalSiteHostname) {
		return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>";
	}

	const alternateHosts = {
		en: "mirokit.com",
		de: "mirokit.com",
		ru: "mirokit.ru",
		"x-default": "mirokit.com",
	};

	const entries = SITEMAP_PATHS.map(({ path, changefreq, priority }) => {
		const canonicalUrl = `https://${canonicalSiteHostname}${path}`;
		const alternateLinks = Object.entries(alternateHosts)
			.map(
				([language, alternateHost]) =>
					`    <xhtml:link rel="alternate" hreflang="${language}" href="https://${alternateHost}${path}" />`
			)
			.join("\n");

		return [
			"  <url>",
			`    <loc>${escapeXml(canonicalUrl)}</loc>`,
			"    <lastmod>2026-08-29</lastmod>",
			`    <changefreq>${changefreq}</changefreq>`,
			`    <priority>${priority}</priority>`,
			alternateLinks,
			"  </url>",
		].join("\n");
	}).join("\n");

	return [
		"<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
		"<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\" xmlns:xhtml=\"http://www.w3.org/1999/xhtml\">",
		entries,
		"</urlset>",
		"",
	].join("\n");
}

function textResponse(body, contentType, cacheControl = "public, max-age=3600") {
	return new Response(body, {
		status: 200,
		headers: {
			...COMMON_RESPONSE_HEADERS,
			"Content-Type": contentType,
			"Cache-Control": cacheControl,
		},
	});
}

function withSiteHeaders(response, pathname) {
	const headers = new Headers(response.headers);

	Object.entries(COMMON_RESPONSE_HEADERS).forEach(([name, value]) => {
		headers.set(name, value);
	});

	if (
		pathname === "/" ||
		pathname === "/index.html" ||
		pathname.startsWith("/page/")
	) {
		headers.set("Cache-Control", "public, max-age=0, must-revalidate");
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function rewriteDocumentMetadata(response, url) {
	if (
		!isDocumentPath(url.pathname) ||
		url.pathname === "/index.html" ||
		!response.headers.get("content-type")?.includes("text/html")
	) {
		return response;
	}

	const canonicalSiteHostname = getCanonicalSiteHostname(url.hostname);
	const canonicalPath = getCanonicalDocumentPath(url.pathname);
	const canonicalUrl =
		`https://${canonicalSiteHostname}${canonicalPath}`;

	return new HTMLRewriter()
		.on('link[rel="canonical"]', {
			element(element) {
				element.setAttribute("href", canonicalUrl);
			},
		})
		.on('meta[property="og:url"]', {
			element(element) {
				element.setAttribute("content", canonicalUrl);
			},
		})
		.transform(response);
}

function getCanonicalDocumentPath(pathname) {
	if (pathname === "/") return "/";
	if (pathname === "/page/onlineProjects" || pathname === "/page/onlineProjects/") return "/page/onlineProjects/";
	return "/page/privacyPolicy/";
}

function isDocumentPath(pathname) {
	return (
		pathname === "/" ||
		pathname === "/index.html" ||
		pathname === "/page/privacyPolicy" ||
		pathname === "/page/privacyPolicy/" ||
		pathname === "/page/onlineProjects" ||
		pathname === "/page/onlineProjects/"
	);
}

function canonicalDocumentRedirect(request, url) {
	if (
		(request.method !== "GET" && request.method !== "HEAD") ||
		!isDocumentPath(url.pathname) ||
		!isProductionHostname(url.hostname)
	) {
		return null;
	}

	const normalizedHostname = url.hostname
		.toLowerCase()
		.replace(/\.$/, "");

	if (
		url.pathname === "/" ||
		url.pathname === "/page/privacyPolicy/"
	) {
		return null;
	}

	const canonicalPath = getCanonicalDocumentPath(url.pathname);
	const location = `https://${normalizedHostname}${canonicalPath}${url.search}`;

	return new Response(null, {
		status: 301,
		headers: {
			...COMMON_RESPONSE_HEADERS,
			Location: location,
			"Cache-Control": "public, max-age=86400",
		},
	});
}

/*
 * The request hostname decides which MIRoKIT sender address is used.
 * Keep this explicit instead of trusting a hostname sent by the browser.
 */
const MAIL_FROM_BY_HOSTNAME = Object.freeze({
	"mirokit.com": "info@mirokit.com",
	"www.mirokit.com": "info@mirokit.com",
	"ligamirokit.com": "info@mirokit.com",
	"www.ligamirokit.com": "info@mirokit.com",

	"mirokit.ru": "info@mirokit.ru",
	"www.mirokit.ru": "info@mirokit.ru",
	"ligamirokit.ru": "info@mirokit.ru",
	"www.ligamirokit.ru": "info@mirokit.ru",
});

function getMailFromForHostname(hostname, env) {
	const normalizedHostname = String(hostname || "")
		.trim()
		.toLowerCase()
		.replace(/\.$/, "");

	const configuredSender =
		MAIL_FROM_BY_HOSTNAME[normalizedHostname];

	if (configuredSender) {
		return configuredSender;
	}

	/*
	 * Local Wrangler development only.
	 * This fallback is never used by the four production domains above.
	 */
	if (
		normalizedHostname === "localhost" ||
		normalizedHostname === "127.0.0.1"
	) {
		return String(env.MAIL_FROM || "info@mirokit.com").trim();
	}

	return null;
}

const PRIVATE_FIELDS = new Set([
	"website_check",
]);

const FIELD_LABELS = {
	name: "Name",
	email: "E-Mail",
	country: "Land",
	city: "Stadt",
	organization: "Organisation",
	phone: "Telefon / Messenger",
	topic: "Thema",
	message: "Nachricht",

	consent_required: "Datenschutz akzeptiert",
	consent_optional: "News-Einwilligung",

	organization_full: "Vollständiger Organisationsname",
	organization_short: "Kurzname",
	address: "Anschrift",
	region: "Region / Gebiet",
	postcode: "Postleitzahl",

	contact_name: "Kontaktperson",
	role: "Position",
	sozialMedia: "Social Media",

	activities: "Tätigkeitsbereiche",
	member_count: "Anzahl der Mitglieder",
	goals: "Ziele des Liga-Beitritts",
	about: "Über die Organisation",
	website: "Website",

	confirm_accuracy: "Richtigkeit der Angaben bestätigt",
	confirm_goals: "Ziele und Prinzipien bestätigt",
	confirm_privacy: "Datenschutz bestätigt",
};

const VALUE_LABELS = {
	country: {
		de: "Deutschland",
		ru: "Russland",
		tn: "Tunesien",
		other: "Anderes Land",
	},

	topic: {
		join: "Der MIRoKIT-Liga beitreten",
		event: "Veranstaltung durchführen",
		partner: "Partner werden",
		other: "Sonstiges",
	},
};

function getAllowedOrigins(env) {
	return new Set(
		String(env.ALLOWED_ORIGINS || "")
			.split(",")
			.map((origin) => origin.trim())
			.filter(Boolean)
	);
}

function getClientAddress(request) {
	const forwardedFor = request.headers.get("X-Forwarded-For");

	return (
		request.headers.get("CF-Connecting-IP") ||
		forwardedFor?.split(",", 1)[0]?.trim() ||
		"unknown"
	);
}

async function checkContactRateLimit(request, env, formType) {
	const limiter = env.CONTACT_FORM_RATE_LIMITER;

	if (!limiter || typeof limiter.limit !== "function") {
		console.error("CONTACT_FORM_RATE_LIMITER is not configured");
		return { success: false, unavailable: true };
	}

	try {
		return await limiter.limit({
			key: `${formType}:${getClientAddress(request)}`,
		});
	} catch (error) {
		console.error("Contact form rate-limit check failed", error);
		return { success: false, unavailable: true };
	}
}

function isLocalOrigin(origin) {
	if (!origin) return false;

	try {
		const { hostname } = new URL(origin);
		return hostname === "localhost" || hostname === "127.0.0.1";
	} catch {
		return false;
	}
}

function corsHeaders(origin, env) {
	const allowedOrigins = getAllowedOrigins(env);

	if (!origin || !allowedOrigins.has(origin)) {
		return {};
	}

	return {
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Methods": "POST, OPTIONS",
		"Access-Control-Allow-Headers":
			"Content-Type, Accept",
		"Access-Control-Max-Age": "86400",
		Vary: "Origin",
	};
}

function jsonResponse(
	data,
	status,
	origin,
	env,
	extraHeaders = {}
) {
	return new Response(JSON.stringify(data), {
		status,

		headers: {
			...COMMON_RESPONSE_HEADERS,
			"Content-Type":
				"application/json; charset=utf-8",

			"X-Robots-Tag":
				"noindex, nofollow",

			"Cache-Control":
				"no-store",

			...corsHeaders(origin, env),
			...extraHeaders,
		},
	});
}

function escapeHtml(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

function stripHeaderCharacters(value) {
	return String(value ?? "")
		.replace(/[\r\n]+/g, " ")
		.trim()
		.slice(0, 120);
}

function isEmail(value) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
		String(value)
	);
}

function toArray(value) {
	if (Array.isArray(value)) {
		return value;
	}

	return [value];
}

function displayValue(key, value) {
	const values = toArray(value);

	return values
		.map((item) => {
			if (
				VALUE_LABELS[key] &&
				VALUE_LABELS[key][item]
			) {
				return VALUE_LABELS[key][item];
			}

			if (item === "on") {
				return "Ja";
			}

			return String(item);
		})
		.join(", ");
}

function validateFields(formType, fields) {
	if (
		!fields ||
		typeof fields !== "object" ||
		Array.isArray(fields)
	) {
		throw new Error("Invalid fields");
	}

	const allowedFields = FORM_FIELD_ALLOWLIST[formType];

	if (!allowedFields) {
		throw new Error("Unknown form type");
	}

	const entries = Object.entries(fields);

	if (entries.length > allowedFields.size) {
		throw new Error("Too many fields");
	}

	for (const [key, value] of entries) {
		if (!allowedFields.has(key)) {
			throw new Error(`Unknown field: ${key}`);
		}

		if (Array.isArray(value) && !MULTI_VALUE_FIELDS.has(key)) {
			throw new Error(`Multiple values not allowed: ${key}`);
		}

		const values = toArray(value);

		if (values.length > 30) {
			throw new Error("Too many field values");
		}

		for (const item of values) {
			if (typeof item !== "string") {
				throw new Error(`Invalid field value: ${key}`);
			}

			if (String(item).length > 10_000) {
				throw new Error(
					`Field too long: ${key}`
				);
			}
		}
	}
}

function validateRequiredFields(
	formType,
	fields
) {
	const required =
		formType === "main-contact"
			? [
				"name",
				"email",
				"country",
				"city",
				"organization",
				"topic",
				"message",
				"consent_required",
			]
			: [
				"organization_full",
				"organization_short",
				"address",
				"country",
				"city",
				"postcode",
				"contact_name",
				"email",
				"phone",
				"activities",
				"member_count",
				"goals",
				"about",
				"confirm_accuracy",
				"confirm_goals",
				"confirm_privacy",
			];

	for (const key of required) {
		const value = fields[key];

		if (
			value === undefined ||
			value === null ||
			String(value).trim() === ""
		) {
			throw new Error(
				`Missing required field: ${key}`
			);
		}
	}

	if (!isEmail(fields.email)) {
		throw new Error("Invalid email");
	}
}

async function verifyTurnstile({
	token,
	secret,
	ip,
	expectedAction,
	expectedHostnames,
	strictContextValidation = true,
}) {
	if (!token || token.length > 2048) {
		return { success: false, reason: "missing-or-invalid-token" };
	}

	try {
		const response = await fetch(
			"https://challenges.cloudflare.com/turnstile/v0/siteverify",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				signal: AbortSignal.timeout(10_000),
				body: JSON.stringify({
					secret,
					response: token,
					remoteip: ip || undefined,
				}),
			}
		);

		if (!response.ok) {
			return { success: false, reason: `siteverify-${response.status}` };
		}

		const result = await response.json();

		if (!result.success) return result;

		/*
		 * Local development uses Cloudflare's official dummy credentials.
		 * For localhost testing, a successful Siteverify response is enough
		 * to exercise the form flow. Production still validates both
		 * action and hostname strictly.
		 */
		if (!strictContextValidation) {
			return result;
		}

		if (result.action !== expectedAction) {
			return {
				...result,
				success: false,
				reason: "wrong-action",
			};
		}

		if (!expectedHostnames.has(result.hostname)) {
			return {
				...result,
				success: false,
				reason: "wrong-hostname",
			};
		}

		return result;
	} catch (error) {
		console.error("Turnstile validation failed", error);
		return { success: false, reason: "siteverify-unavailable" };
	}
}

function createRows(fields) {
	return Object.entries(fields)
		.filter(
			([key]) =>
				!PRIVATE_FIELDS.has(key)
		)
		.map(([key, rawValue]) => {
			const label =
				FIELD_LABELS[key] || key;

			const value =
				displayValue(key, rawValue);

			return `
            <tr>
               <td
                  style="
                     width: 34%;
                     padding: 13px 16px;
                     border-bottom: 1px solid #e6edff;
                     background: #f6f9ff;
                     font-family: Arial, sans-serif;
                     font-size: 13px;
                     line-height: 1.5;
                     font-weight: 700;
                     color: #0d1b4b;
                     vertical-align: top;
                  "
               >
                  ${escapeHtml(label)}
               </td>

               <td
                  style="
                     padding: 13px 16px;
                     border-bottom: 1px solid #e6edff;
                     font-family: Arial, sans-serif;
                     font-size: 14px;
                     line-height: 1.6;
                     color: #30374d;
                     white-space: pre-wrap;
                     word-break: break-word;
                     vertical-align: top;
                  "
               >
                  ${escapeHtml(value)}
               </td>
            </tr>
         `;
		})
		.join("");
}

function createEmailHtml({
	formType,
	fields,
	meta,
	sourceDomain,
}) {
	const isLeague =
		formType === "extra-contact";

	const title = isLeague
		? `Neue MIRoKIT Liga-Anfrage über ${sourceDomain}`
		: `Neue Nachricht über ${sourceDomain}`;

	const badge = isLeague
		? "LIGA-ANTRAG"
		: "KONTAKT";

	const rows = createRows(fields);

	const submittedAt =
		meta?.submittedAt
			? new Date(
				meta.submittedAt
			).toLocaleString("de-DE", {
				timeZone: "Europe/Berlin",
			})
			: new Date().toLocaleString(
				"de-DE",
				{
					timeZone:
						"Europe/Berlin",
				}
			);

	return `
<!doctype html>
<html>
<body
   style="
      margin: 0;
      padding: 0;
      background: #eef4ff;
   "
>
   <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="background:#eef4ff;"
   >
      <tr>
         <td
            align="center"
            style="padding:32px 12px;"
         >
            <table
               role="presentation"
               width="100%"
               cellspacing="0"
               cellpadding="0"
               border="0"
               style="
                  max-width:760px;
                  background:#ffffff;
                  border-radius:24px;
                  overflow:hidden;
                  box-shadow:
                     0 16px 40px rgba(13,27,75,.10);
               "
            >
               <tr>
                  <td
                     style="
                        padding:30px 34px;
                        background:
                           linear-gradient(
                              135deg,
                              #1565ff,
                              #3a7bff
                           );
                        color:#ffffff;
                     "
                  >
                     <div
                        style="
                           font-family:
                              Arial,
                              sans-serif;
                           font-size:30px;
                           font-weight:800;
                           letter-spacing:-1px;
                        "
                     >
                        МИРоКИТ
                     </div>

                     <div
                        style="
                           margin-top:10px;
                           font-family:
                              Arial,
                              sans-serif;
                           font-size:12px;
                           font-weight:700;
                           letter-spacing:2px;
                           opacity:.8;
                        "
                     >
                        ${badge}
                     </div>

                     <h1
                        style="
                           margin:8px 0 0;
                           font-family:
                              Arial,
                              sans-serif;
                           font-size:23px;
                           line-height:1.35;
                        "
                     >
                        ${title}
                     </h1>
                  </td>
               </tr>

               <tr>
                  <td
                     style="
                        padding:
                           26px 28px 10px;
                     "
                  >
                     <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="
                           border:1px solid #e6edff;
                           border-radius:16px;
                           overflow:hidden;
                           border-collapse:separate;
                           border-spacing:0;
                        "
                     >
                        ${rows}
                     </table>
                  </td>
               </tr>

               <tr>
                  <td
                     style="
                        padding:
                           20px 30px 30px;
                     "
                  >
                     <div
                        style="
                           padding:16px 18px;
                           background:#f6f9ff;
                           border-radius:14px;
                           font-family:
                              Arial,
                              sans-serif;
                           font-size:12px;
                           line-height:1.7;
                           color:#69728e;
                        "
                     >
                        <strong
                           style="
                              color:#0d1b4b;
                           "
                        >
                           Übermittelt:
                        </strong>
                        ${escapeHtml(
		submittedAt
	)}
                        <br>

                        <strong
                           style="
                              color:#0d1b4b;
                           "
                        >
                           Sprache:
                        </strong>
                        ${escapeHtml(
		meta?.language ||
		"unknown"
	)}

                        ${meta?.page
			? `
                                 <br>
                                 <strong
                                    style="
                                       color:#0d1b4b;
                                    "
                                 >
                                    Seite:
                                 </strong>
                                 ${escapeHtml(
				meta.page
			)}
                              `
			: ""
		}
                     </div>
                  </td>
               </tr>

               <tr>
                  <td
                     style="
                        padding:18px 30px;
                        background:#071a55;
                        font-family:
                           Arial,
                           sans-serif;
                        font-size:11px;
                        line-height:1.6;
                        color:
                           rgba(
                              255,
                              255,
                              255,
                              .65
                           );
                     "
                  >
                     Automatisch über das
                     MIRoKIT-Kontaktformular
                     versendet.
                     Antworten auf diese
                     E-Mail gehen direkt an
                     die angegebene
                     Kontaktadresse.
                  </td>
               </tr>
            </table>
         </td>
      </tr>
   </table>
</body>
</html>
   `.trim();
}

function createTextEmail({
	formType,
	fields,
}) {
	const heading =
		formType === "extra-contact"
			? "Neue MIRoKIT Liga-Anfrage"
			: "Neue MIRoKIT Kontaktanfrage";

	const lines = Object.entries(fields)
		.filter(
			([key]) =>
				!PRIVATE_FIELDS.has(key)
		)
		.map(([key, value]) => {
			const label =
				FIELD_LABELS[key] || key;

			return `${label}: ${displayValue(
				key,
				value
			)}`;
		});

	return [
		heading,
		"",
		...lines,
	].join("\n");
}

function newsJsonResponse(data, status, origin, env, cacheControl = "no-store") {
	return jsonResponse(data, status, origin, env, {
		"Cache-Control": cacheControl,
	});
}

function newsDatabaseUnavailable(origin, env) {
	console.error("SITE_DB is not configured");
	return newsJsonResponse(
		{ success: false, message: "News storage is not configured" },
		503,
		origin,
		env
	);
}

function newsMediaUnavailable(origin, env) {
	console.error("SITE_MEDIA is not configured");
	return newsJsonResponse(
		{ success: false, message: "News media storage is not configured" },
		503,
		origin,
		env
	);
}

function isAdminPanelPath(pathname) {
	return pathname === ADMIN_PANEL_PREFIX || pathname.startsWith(`${ADMIN_PANEL_PREFIX}/`);
}

function getAdminApiPrefix(pathname) {
	if (pathname === ADMIN_PANEL_API_PREFIX || pathname.startsWith(`${ADMIN_PANEL_API_PREFIX}/`)) return ADMIN_PANEL_API_PREFIX;
	return null;
}

function newsAdminUnauthorized(origin, env) {
	return newsJsonResponse(
		{ success: false, message: "Admin authentication required" },
		401,
		origin,
		env
	);
}

async function readJsonRequest(request) {
	try {
		return await request.json();
	} catch {
		throw newsError("Invalid JSON");
	}
}

async function getAdminNews(env) {
	const result = await env.SITE_DB.prepare(NEWS_ADMIN_QUERY).all();
	return rowsToAdminNews(result.results || []);
}

async function saveNewsRecord(env, news, status) {
	const savedNews = {
		...news,
		image: await promotePendingNewsImage(env, news.image),
	};
	const statements = newsToStatements(savedNews, status, new Date().toISOString());
	await env.SITE_DB.batch(
		statements.map((statement) =>
			env.SITE_DB.prepare(statement.sql).bind(...statement.params)
		)
	);
	return savedNews;
}

async function promotePendingNewsImage(env, image) {
	const match = image.match(
		/^\/media\/v1\/(news\/pending\/[a-f0-9-]+\.(?:jpg|png|webp|avif))$/
	);
	if (!match) return image;
	if (!env.SITE_MEDIA) {
		throw newsError("News media storage is not configured", 503);
	}

	const sourceKey = match[1];
	const destinationKey = sourceKey.replace("news/pending/", "news/");
	const object = await env.SITE_MEDIA.get(sourceKey);
	if (!object) throw newsError("Uploaded image no longer exists", 409);

	const metadataHeaders = new Headers();
	object.writeHttpMetadata(metadataHeaders);
	await env.SITE_MEDIA.put(destinationKey, object.body, {
		httpMetadata: {
			contentType: metadataHeaders.get("content-type") || "application/octet-stream",
			cacheControl: metadataHeaders.get("cache-control") || "public, max-age=31536000, immutable",
		},
	});
	await env.SITE_MEDIA.delete(sourceKey);
	return `${SITE_MEDIA_PREFIX}${destinationKey}`;
}

function galleryTextValue(value, field) {
	if (typeof value !== "string") throw newsError(`Invalid gallery ${field}`);
	const normalized = value.trim();
	if (!normalized || normalized.length > 500) throw newsError(`Invalid gallery ${field}`);
	return normalized;
}

function galleryOptionalTextValue(value, field, maxLength = 1_000) {
	if (value === null || value === undefined) return "";
	if (typeof value !== "string") throw newsError(`Invalid gallery ${field}`);
	const normalized = value.trim();
	if (normalized.length > maxLength) throw newsError(`Invalid gallery ${field}`);
	return normalized;
}

function normalizeGallerySourceUrl(value) {
	const source = galleryOptionalTextValue(value, "source_url", 2_000);
	if (!source) return "";

	let url;
	try {
		url = new URL(source);
	} catch {
		throw newsError("Drive image URL must be a valid HTTPS URL");
	}
	if (url.protocol !== "https:" || !GALLERY_REMOTE_IMAGE_HOSTS.has(url.hostname.toLowerCase())) {
		throw newsError("Only public Google Drive image URLs are supported");
	}

	const fileId = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get("id");
	if (!fileId || !/^[A-Za-z0-9_-]+$/.test(fileId)) throw newsError("Could not find a Google Drive file id");
	return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
}

function normalizeGalleryMetadata(formData) {
	const metadata = {
		asset_type: "gallery-image",
		status: String(formData.get("status") || "published").trim(),
		collection: String(formData.get("collection") || "gallery").trim(),
		featured: String(formData.get("featured") || "").trim().toLowerCase() === "true" ? "true" : "false",
		uploaded_at: new Date().toISOString(),
	};

	if (!GALLERY_STATUSES.has(metadata.status)) throw newsError("Invalid gallery status");
	if (!GALLERY_COLLECTIONS.has(metadata.collection)) throw newsError("Invalid gallery collection");

	for (const language of GALLERY_LANGUAGES) {
		metadata[`title_${language}`] = galleryTextValue(formData.get(`title_${language}`), `title_${language}`);
		metadata[`alt_${language}`] = galleryTextValue(formData.get(`alt_${language}`), `alt_${language}`);
		metadata[`subtitle_${language}`] = galleryOptionalTextValue(formData.get(`subtitle_${language}`), `subtitle_${language}`);
		metadata[`quote_${language}`] = galleryOptionalTextValue(formData.get(`quote_${language}`), `quote_${language}`);
	}

	return metadata;
}

async function readRemoteGalleryImage(sourceUrl) {
	const response = await fetch(sourceUrl, {
		headers: { Accept: "image/avif,image/webp,image/png,image/jpeg" },
		redirect: "follow",
	});
	if (!response.ok) throw newsError(`Google Drive image returned ${response.status}`);

	const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].toLowerCase();
	if (!GALLERY_IMAGE_TYPES[contentType]) throw newsError("Google Drive URL did not return a supported image");
	const contentLength = Number(response.headers.get("content-length") || 0);
	if (contentLength > GALLERY_IMAGE_MAX_BYTES) throw newsError("Image exceeds the 8 MB limit");

	const body = await response.arrayBuffer();
	if (!body.byteLength || body.byteLength > GALLERY_IMAGE_MAX_BYTES) throw newsError("Image exceeds the 8 MB limit");
	return { body, contentType, extension: GALLERY_IMAGE_TYPES[contentType] };
}

function galleryQuoteTextValue(value, field, maxLength) {
	if (typeof value !== "string") throw newsError(`Invalid gallery quote ${field}`);
	const normalized = value.trim();
	if (!normalized || normalized.length > maxLength) {
		throw newsError(`Invalid gallery quote ${field}`);
	}
	return normalized;
}

function galleryQuoteOptionalTextValue(value, field, maxLength) {
	if (value === null || value === undefined) return "";
	if (typeof value !== "string") throw newsError(`Invalid gallery quote ${field}`);
	const normalized = value.trim();
	if (normalized.length > maxLength) throw newsError(`Invalid gallery quote ${field}`);
	return normalized;
}

function normalizeGalleryQuoteInput(input) {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		throw newsError("Invalid gallery quote payload");
	}

	const translations = {};
	for (const language of GALLERY_QUOTE_LANGUAGES) {
		const translation = input.translations?.[language];
		if (!translation || typeof translation !== "object" || Array.isArray(translation)) {
			throw newsError(`Invalid gallery quote translation for ${language}`);
		}
		translations[language] = {
			quote: galleryQuoteTextValue(translation.quote, `quote_${language}`, 2_000),
			byline: galleryQuoteOptionalTextValue(translation.byline, `byline_${language}`, 300),
		};
	}

	return { translations };
}

function rowsToGalleryQuotes(rows) {
	const grouped = new Map();
	for (const row of rows || []) {
		if (!grouped.has(row.id)) {
			grouped.set(row.id, {
				id: row.id,
				status: row.status,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
				quote: {},
				byline: {},
			});
		}
		const item = grouped.get(row.id);
		item.quote[row.language] = row.quote;
		item.byline[row.language] = row.byline || "";
	}
	return [...grouped.values()];
}

async function listGalleryQuotes(env, includeArchived = false) {
	if (!env.SITE_DB) return [];
	const query = includeArchived ? GALLERY_QUOTES_ADMIN_QUERY : GALLERY_QUOTES_PUBLIC_QUERY;
	const result = await env.SITE_DB.prepare(query).all();
	return rowsToGalleryQuotes(result.results || []);
}

async function saveGalleryQuoteRecord(env, quote, status = "published") {
	const timestamp = new Date().toISOString();
	const statements = [
		env.SITE_DB.prepare(
			`INSERT INTO gallery_quotes (id, status, created_at, updated_at)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`
		).bind(quote.id, status, timestamp, timestamp),
		env.SITE_DB.prepare("DELETE FROM gallery_quote_translations WHERE quote_id = ?").bind(quote.id),
		...GALLERY_QUOTE_LANGUAGES.map((language) =>
			env.SITE_DB.prepare(
				"INSERT INTO gallery_quote_translations (quote_id, language, quote, byline) VALUES (?, ?, ?, ?)"
			).bind(quote.id, language, quote.translations[language].quote, quote.translations[language].byline)
		),
	];
	await env.SITE_DB.batch(statements);
	return {
		id: quote.id,
		status,
		createdAt: timestamp,
		updatedAt: timestamp,
		quote: Object.fromEntries(GALLERY_QUOTE_LANGUAGES.map((language) => [language, quote.translations[language].quote])),
		byline: Object.fromEntries(GALLERY_QUOTE_LANGUAGES.map((language) => [language, quote.translations[language].byline])),
	};
}

function galleryItemFromObject(object) {
	const metadata = object.customMetadata || {};
	return {
		key: object.key,
		image: `${SITE_MEDIA_PREFIX}${object.key}`,
		status: metadata.status || "published",
		collection: metadata.collection || "gallery",
		sourceType: metadata.source_type || "r2",
		featured: metadata.featured === "true" || metadata.featured === "1",
		uploadedAt: metadata.uploaded_at || (object.uploaded instanceof Date ? object.uploaded.toISOString() : String(object.uploaded || "")),
		title: Object.fromEntries(GALLERY_LANGUAGES.map((language) => [language, metadata[`title_${language}`] || ""])),
		alt: Object.fromEntries(GALLERY_LANGUAGES.map((language) => [language, metadata[`alt_${language}`] || ""])),
		subtitle: Object.fromEntries(GALLERY_LANGUAGES.map((language) => [language, metadata[`subtitle_${language}`] || ""])),
		quote: Object.fromEntries(GALLERY_LANGUAGES.map((language) => [language, metadata[`quote_${language}`] || ""])),
	};
}

async function listGallery(env, includeArchived = false, collection = "") {
	if (!env.SITE_MEDIA) throw newsError("News media storage is not configured", 503);

	const objects = [];
	let cursor;
	do {
		const options = { prefix: GALLERY_PREFIX, include: ["customMetadata"] };
		if (cursor) options.cursor = cursor;
		const page = await env.SITE_MEDIA.list(options);
		objects.push(...(page.objects || []));
		cursor = page.truncated ? page.cursor : undefined;
	} while (cursor);

	return objects
		.filter((object) => GALLERY_PERMANENT_KEY_PATTERN.test(object.key))
		.map(galleryItemFromObject)
		.filter((item) => includeArchived || item.status === "published")
		.filter((item) => !collection || item.collection === collection)
		.sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
}

async function promotePendingGalleryImage(env, sourceKey) {
	const destinationKey = sourceKey.replace("gallery/pending/", "gallery/");
	const object = await env.SITE_MEDIA.get(sourceKey);
	if (!object) throw newsError("Uploaded gallery image no longer exists", 409);

	const metadataHeaders = new Headers();
	object.writeHttpMetadata?.(metadataHeaders);
	await env.SITE_MEDIA.put(destinationKey, object.body, {
		httpMetadata: {
			contentType: metadataHeaders.get("content-type") || "application/octet-stream",
			cacheControl: metadataHeaders.get("cache-control") || "public, max-age=31536000, immutable",
		},
		customMetadata: object.customMetadata || {},
	});
	await env.SITE_MEDIA.delete(sourceKey);
	return destinationKey;
}

async function handlePublicNews(request, env, origin) {
	if (request.method !== "GET" && request.method !== "HEAD") {
		return newsJsonResponse(
			{ success: false, message: "Method not allowed" },
			405,
			origin,
			env
		);
	}

	if (!env.SITE_DB) return newsDatabaseUnavailable(origin, env);

	try {
		const today = new Date().toISOString().slice(0, 10);
		const result = await env.SITE_DB.prepare(NEWS_PUBLIC_QUERY).bind(today).all();
		return newsJsonResponse(
			{ success: true, news: rowsToNews(result.results || []) },
			200,
			origin,
			env,
			"public, max-age=60, stale-while-revalidate=300"
		);
	} catch (error) {
		console.error("Public news query failed", error);
		return newsJsonResponse(
			{ success: false, message: "News service unavailable" },
			503,
			origin,
			env
		);
	}
}

async function handlePublicGallery(request, env, origin) {
	if (request.method !== "GET" && request.method !== "HEAD") {
		return newsJsonResponse({ success: false, message: "Method not allowed" }, 405, origin, env);
	}
	if (!env.SITE_MEDIA && !env.SITE_DB) return newsMediaUnavailable(origin, env);

	try {
		const collection = String(new URL(request.url).searchParams.get("collection") || "").trim();
		if (collection && !GALLERY_COLLECTIONS.has(collection)) return newsJsonResponse({ success: false, message: "Invalid gallery collection" }, 400, origin, env);
		const gallery = env.SITE_MEDIA ? await listGallery(env, false, collection) : [];
		const quotes = await listGalleryQuotes(env);
		return newsJsonResponse(
			{ success: true, gallery, quotes },
			200,
			origin,
			env
		);
	} catch (error) {
		console.error("Public gallery query failed", error);
		return newsJsonResponse({ success: false, message: "Gallery service unavailable" }, 503, origin, env);
	}
}

async function handlePublicWorldPoints(request, env, origin) {
	if (request.method !== "GET" && request.method !== "HEAD") {
		return newsJsonResponse({ success: false, message: "Method not allowed" }, 405, origin, env);
	}
	if (!env.SITE_DB) return newsDatabaseUnavailable(origin, env);

	try {
		const result = await env.SITE_DB.prepare(WORLD_PUBLIC_QUERY).all();
		return newsJsonResponse(
			{ success: true, points: rowsToPublicWorldPoints(result.results || []) },
			200,
			origin,
			env,
			"public, max-age=60, stale-while-revalidate=300"
		);
	} catch (error) {
		console.error("Public world points query failed", error);
		return newsJsonResponse({ success: false, message: "World points service unavailable" }, 503, origin, env);
	}
}

async function handlePublicPartners(request, env, origin) {
	if (request.method !== "GET" && request.method !== "HEAD") {
		return newsJsonResponse({ success: false, message: "Method not allowed" }, 405, origin, env);
	}
	if (!env.SITE_DB) return newsDatabaseUnavailable(origin, env);

	try {
		const result = await env.SITE_DB.prepare(PARTNERS_PUBLIC_QUERY).all();
		return newsJsonResponse(
			{ success: true, partners: rowsToPublicPartners(result.results || []) },
			200,
			origin,
			env,
			"public, max-age=60, stale-while-revalidate=300"
		);
	} catch (error) {
		console.error("Public partners query failed", error);
		return newsJsonResponse({ success: false, message: "Partners service unavailable" }, 503, origin, env);
	}
}

async function handlePublicVideos(request, env, origin) {
	if (request.method !== "GET" && request.method !== "HEAD") {
		return newsJsonResponse({ success: false, message: "Method not allowed" }, 405, origin, env);
	}
	if (!env.SITE_DB) return newsDatabaseUnavailable(origin, env);

	try {
		const result = await env.SITE_DB.prepare(VIDEOS_PUBLIC_QUERY).all();
		return newsJsonResponse(
			{ success: true, videos: rowsToPublicVideos(result.results || []) },
			200,
			origin,
			env,
			"public, max-age=60, stale-while-revalidate=300"
		);
	} catch (error) {
		console.error("Public videos query failed", error);
		return newsJsonResponse({ success: false, message: "Video service unavailable" }, 503, origin, env);
	}
}

async function promotePendingVideoAsset(env, value, folders) {
	if (!value || !value.startsWith(SITE_MEDIA_PREFIX)) return value;
	const sourceKey = value.slice(SITE_MEDIA_PREFIX.length);
	const folder = folders.find((candidate) => sourceKey.startsWith(`${candidate}/pending/`));
	if (!folder) return value;
	if (!env.SITE_MEDIA) throw videoError("Video media storage is not configured", 503);
	const destinationKey = sourceKey.replace(`${folder}/pending/`, `${folder}/`);
	const object = await env.SITE_MEDIA.get(sourceKey);
	if (!object) throw videoError("Uploaded video asset no longer exists", 409);
	const metadataHeaders = new Headers();
	object.writeHttpMetadata?.(metadataHeaders);
	await env.SITE_MEDIA.put(destinationKey, object.body, {
		httpMetadata: {
			contentType: metadataHeaders.get("content-type") || "application/octet-stream",
			cacheControl: metadataHeaders.get("cache-control") || "public, max-age=31536000, immutable",
		},
		customMetadata: object.customMetadata || {},
	});
	await env.SITE_MEDIA.delete(sourceKey);
	return `${SITE_MEDIA_PREFIX}${destinationKey}`;
}

async function prepareVideoForStorage(env, video) {
	const savedVideo = {
		...video,
		sourceUrl: video.sourceType === "r2" ? await promotePendingVideoAsset(env, video.sourceUrl, ["videos"]) : video.sourceUrl,
		poster: await promotePendingVideoAsset(env, video.poster, ["video-posters"]),
		subtitles: [],
	};
	for (const subtitle of video.subtitles) {
		let src = await promotePendingVideoAsset(env, subtitle.src, ["subtitles"]);
		if (subtitle.content) {
			if (!env.SITE_MEDIA) throw videoError("Video media storage is not configured", 503);
			let key = src.startsWith(`${SITE_MEDIA_PREFIX}subtitles/`) ? src.slice(SITE_MEDIA_PREFIX.length) : `subtitles/${video.id}-${crypto.randomUUID()}.vtt`;
			if (key.startsWith("subtitles/pending/")) key = key.replace("subtitles/pending/", "subtitles/");
			await env.SITE_MEDIA.put(key, subtitle.content, {
				httpMetadata: { contentType: "text/vtt; charset=utf-8", cacheControl: "public, max-age=31536000, immutable" },
			});
			src = `${SITE_MEDIA_PREFIX}${key}`;
		}
		savedVideo.subtitles.push({ ...subtitle, src, content: "" });
	}
	return savedVideo;
}

async function getAdminVideos(env) {
	const result = await env.SITE_DB.prepare(VIDEOS_ADMIN_QUERY).all();
	return rowsToVideos(result.results || []);
}

async function saveVideoRecord(env, video, status) {
	const savedVideo = await prepareVideoForStorage(env, video);
	const statements = videoStatements(savedVideo, status, new Date().toISOString());
	await env.SITE_DB.batch(statements.map((statement) => env.SITE_DB.prepare(statement.sql).bind(...statement.params)));
	return { ...savedVideo, status };
}

async function handleVideoAdminApi(request, env, url, origin, apiPrefix) {
	const identity = await authorizeAdmin(request, env);
	if (!identity) return newsAdminUnauthorized(origin, env);
	if (request.method !== "GET" && origin && origin !== url.origin) {
		return newsJsonResponse({ success: false, message: "Cross-origin admin request denied" }, 403, origin, env);
	}
	if (!env.SITE_DB) return newsDatabaseUnavailable(origin, env);

	const relativePath = url.pathname.slice(apiPrefix.length).replace(/\/$/, "") || "/";
	try {
		if (relativePath === "/videos" && request.method === "GET") {
			return newsJsonResponse({ success: true, videos: await getAdminVideos(env) }, 200, origin, env);
		}

		if (relativePath === "/videos/media" && request.method === "POST") {
			if (!env.SITE_MEDIA) return newsMediaUnavailable(origin, env);
			const formData = await request.formData();
			const file = formData.get("file");
			const kind = String(formData.get("kind") || "").trim();
			const types = kind === "video"
				? { "video/mp4": "mp4", "video/webm": "webm", "video/ogg": "ogv" }
				: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
			const limit = kind === "video" ? VIDEO_UPLOAD_MAX_BYTES : VIDEO_POSTER_MAX_BYTES;
			if (!(file instanceof File) || !types[file.type] || file.size === 0 || file.size > limit) {
				return newsJsonResponse({ success: false, message: kind === "video" ? "Unsupported video or video exceeds 95 MB" : "Unsupported poster or poster exceeds 8 MB" }, 400, origin, env);
			}
			const folder = kind === "video" ? "videos" : "video-posters";
			const key = `${folder}/pending/${crypto.randomUUID()}.${types[file.type]}`;
			await env.SITE_MEDIA.put(key, file.stream(), {
				httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
			});
			return newsJsonResponse({ success: true, url: `${SITE_MEDIA_PREFIX}${key}`, kind }, 201, origin, env);
		}

		const publishMatch = relativePath.match(/^\/videos\/([^/]+)\/publish$/);
		if (publishMatch && request.method === "POST") {
			const id = decodeURIComponent(publishMatch[1]);
			const existing = (await getAdminVideos(env)).find((item) => item.id === id);
			if (!existing) return newsJsonResponse({ success: false, message: "Video not found" }, 404, origin, env);
			const saved = await saveVideoRecord(env, normalizeVideoInput(existing, { includeStatus: false }), "published");
			return newsJsonResponse({ success: true, video: saved }, 200, origin, env);
		}

		if (relativePath === "/videos" && request.method === "POST") {
			const video = normalizeVideoInput(await readJsonRequest(request), { includeStatus: false });
			if ((await getAdminVideos(env)).some((item) => item.id === video.id)) return newsJsonResponse({ success: false, message: "Video ID already exists" }, 409, origin, env);
			const saved = await saveVideoRecord(env, video, "draft");
			return newsJsonResponse({ success: true, video: saved }, 201, origin, env);
		}

		const itemMatch = relativePath.match(/^\/videos\/([^/]+)$/);
		if (itemMatch) {
			const id = decodeURIComponent(itemMatch[1]);
			if (request.method === "PUT") {
				const video = normalizeVideoInput({ ...(await readJsonRequest(request)), id }, { includeStatus: false });
				const saved = await saveVideoRecord(env, video, "draft");
				return newsJsonResponse({ success: true, video: saved }, 200, origin, env);
			}
			if (request.method === "DELETE") {
				const result = await env.SITE_DB.prepare("UPDATE videos SET status = 'archived', updated_at = ? WHERE id = ? AND status <> 'archived'").bind(new Date().toISOString(), id).run();
				if (!result.meta?.changes) return newsJsonResponse({ success: false, message: "Video not found" }, 404, origin, env);
				return newsJsonResponse({ success: true, id }, 200, origin, env);
			}
		}

		if (relativePath !== "/videos" && relativePath.startsWith("/videos/")) return newsJsonResponse({ success: false, message: "Not found" }, 404, origin, env);
		return newsJsonResponse({ success: false, message: "Not found" }, 404, origin, env);
	} catch (error) {
		const status = Number.isInteger(error?.status) ? error.status : 500;
		if (status < 500) return newsJsonResponse({ success: false, message: error.message }, status, origin, env);
		console.error("Video admin request failed", error);
		return newsJsonResponse({ success: false, message: "Video service unavailable" }, 503, origin, env);
	}
}

async function saveWorldPointRecord(env, point, status) {
	const statements = worldPointStatements(point, status, new Date().toISOString());
	await env.SITE_DB.batch(statements.map((statement) => env.SITE_DB.prepare(statement.sql).bind(...statement.params)));
	return { ...point, status };
}

async function savePartnerRecord(env, partner, status) {
	const savedPartner = { ...partner, image: await promotePendingPartnerImage(env, partner.image) };
	const statements = partnerStatements(savedPartner, status, new Date().toISOString());
	await env.SITE_DB.batch(statements.map((statement) => env.SITE_DB.prepare(statement.sql).bind(...statement.params)));
	return { ...savedPartner, status };
}

async function promotePendingPartnerImage(env, image) {
	const match = image.match(/^\/media\/v1\/(partners\/pending\/[a-f0-9-]+\.(?:jpg|png|webp|avif))$/);
	if (!match) return image;
	if (!env.SITE_MEDIA) throw contentError("Partner media storage is not configured", 503);

	const sourceKey = match[1];
	const destinationKey = sourceKey.replace("partners/pending/", "partners/");
	const object = await env.SITE_MEDIA.get(sourceKey);
	if (!object) throw contentError("Uploaded partner logo no longer exists", 409);

	const metadataHeaders = new Headers();
	object.writeHttpMetadata?.(metadataHeaders);
	await env.SITE_MEDIA.put(destinationKey, object.body, {
		httpMetadata: {
			contentType: metadataHeaders.get("content-type") || "application/octet-stream",
			cacheControl: metadataHeaders.get("cache-control") || "public, max-age=31536000, immutable",
		},
	});
	await env.SITE_MEDIA.delete(sourceKey);
	return `${SITE_MEDIA_PREFIX}${destinationKey}`;
}

async function handleContentAdminApi(request, env, url, origin, apiPrefix) {
	const identity = await authorizeAdmin(request, env);
	if (!identity) return newsAdminUnauthorized(origin, env);
	if (request.method !== "GET" && origin && origin !== url.origin) {
		return newsJsonResponse({ success: false, message: "Cross-origin admin request denied" }, 403, origin, env);
	}
	if (!env.SITE_DB) return newsDatabaseUnavailable(origin, env);

	const relativePath = url.pathname.slice(apiPrefix.length).replace(/\/$/, "") || "/";
	const isWorld = relativePath === "/world-points" || relativePath.startsWith("/world-points/");
	const isPartners = relativePath === "/partners" || relativePath.startsWith("/partners/");
	if (!isWorld && !isPartners) return newsJsonResponse({ success: false, message: "Not found" }, 404, origin, env);

	try {
		if (relativePath === "/world-points" && request.method === "GET") {
			const result = await env.SITE_DB.prepare(WORLD_ADMIN_QUERY).all();
			return newsJsonResponse({ success: true, points: rowsToWorldPoints(result.results || []) }, 200, origin, env);
		}
		if (relativePath === "/partners" && request.method === "GET") {
			const result = await env.SITE_DB.prepare(PARTNERS_ADMIN_QUERY).all();
			return newsJsonResponse({ success: true, partners: rowsToPartners(result.results || []) }, 200, origin, env);
		}

		if (relativePath === "/partners/media" && request.method === "POST") {
			if (!env.SITE_MEDIA) return newsMediaUnavailable(origin, env);
			const formData = await request.formData();
			const file = formData.get("file");
			const allowedTypes = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
			if (!(file instanceof File) || !allowedTypes[file.type] || file.size === 0 || file.size > 4 * 1024 * 1024) {
				return newsJsonResponse({ success: false, message: "Unsupported logo or logo too large" }, 400, origin, env);
			}
			const key = `partners/pending/${crypto.randomUUID()}.${allowedTypes[file.type]}`;
			await env.SITE_MEDIA.put(key, file.stream(), {
				httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
			});
			return newsJsonResponse({ success: true, image: `${SITE_MEDIA_PREFIX}${key}` }, 201, origin, env);
		}

		const collection = isWorld ? "world-points" : "partners";
		if ((relativePath === `/${collection}`) && request.method === "POST") {
			const body = await readJsonRequest(request);
			const normalized = isWorld ? normalizeWorldPointInput(body, { includeStatus: false }) : normalizePartnerInput(body, { includeStatus: false });
			const query = isWorld ? WORLD_ADMIN_QUERY : PARTNERS_ADMIN_QUERY;
			const existingResult = await env.SITE_DB.prepare(query).all();
			const existingItems = isWorld ? rowsToWorldPoints(existingResult.results || []) : rowsToPartners(existingResult.results || []);
			if (existingItems.some((item) => item.id === normalized.id)) {
				return newsJsonResponse({ success: false, message: `${collection} ID already exists` }, 409, origin, env);
			}
			const saved = isWorld ? await saveWorldPointRecord(env, normalized, "draft") : await savePartnerRecord(env, normalized, "draft");
			return newsJsonResponse({ success: true, [isWorld ? "point" : "partner"]: saved }, 201, origin, env);
		}
		const itemMatch = relativePath.match(new RegExp(`^/${collection}/([^/]+)(?:/(publish))?$`));
		if (!itemMatch) return newsJsonResponse({ success: false, message: "Not found" }, 404, origin, env);
		const id = decodeURIComponent(itemMatch[1]);
		const isPublish = itemMatch[2] === "publish";

		if (request.method === "POST" && isPublish) {
			const query = isWorld ? WORLD_ADMIN_QUERY : PARTNERS_ADMIN_QUERY;
			const result = await env.SITE_DB.prepare(query).all();
			const existing = (isWorld ? rowsToWorldPoints(result.results || []) : rowsToPartners(result.results || [])).find((item) => item.id === id);
			if (!existing) return newsJsonResponse({ success: false, message: `${collection} item not found` }, 404, origin, env);
			const saved = isWorld
				? await saveWorldPointRecord(env, normalizeWorldPointInput(existing, { includeStatus: false }), "published")
				: await savePartnerRecord(env, normalizePartnerInput(existing, { includeStatus: false }), "published");
			return newsJsonResponse({ success: true, [isWorld ? "point" : "partner"]: saved }, 200, origin, env);
		}

		if (request.method === "DELETE") {
			const table = isWorld ? "world_points" : "partners";
			const result = await env.SITE_DB.prepare(`UPDATE ${table} SET status = 'archived', updated_at = ? WHERE id = ? AND status <> 'archived'`).bind(new Date().toISOString(), id).run();
			if (!result.meta?.changes) return newsJsonResponse({ success: false, message: `${collection} item not found` }, 404, origin, env);
			return newsJsonResponse({ success: true, id }, 200, origin, env);
		}

		if (request.method !== "POST" && request.method !== "PUT") return newsJsonResponse({ success: false, message: "Method not allowed" }, 405, origin, env);
		const body = await readJsonRequest(request);
		if (body.id !== id) body.id = id;
		const normalized = isWorld ? normalizeWorldPointInput(body, { includeStatus: false }) : normalizePartnerInput(body, { includeStatus: false });
		const query = isWorld ? WORLD_ADMIN_QUERY : PARTNERS_ADMIN_QUERY;
		const existingResult = await env.SITE_DB.prepare(query).all();
		const existingItems = isWorld ? rowsToWorldPoints(existingResult.results || []) : rowsToPartners(existingResult.results || []);
		if (request.method === "POST" && existingItems.some((item) => item.id === id)) {
			return newsJsonResponse({ success: false, message: `${collection} ID already exists` }, 409, origin, env);
		}
		const saved = isWorld ? await saveWorldPointRecord(env, normalized, "draft") : await savePartnerRecord(env, normalized, "draft");
		return newsJsonResponse({ success: true, [isWorld ? "point" : "partner"]: saved }, request.method === "POST" ? 201 : 200, origin, env);
	} catch (error) {
		const status = Number.isInteger(error?.status) ? error.status : 500;
		if (status < 500) return newsJsonResponse({ success: false, message: error.message }, status, origin, env);
		console.error("Content admin request failed", error);
		return newsJsonResponse({ success: false, message: "Content service unavailable" }, 503, origin, env);
	}
}

async function handleNewsAdminApi(request, env, url, origin, apiPrefix) {
	const identity = await authorizeAdmin(request, env);
	if (!identity) return newsAdminUnauthorized(origin, env);

	if (
		request.method !== "GET" &&
		origin &&
		origin !== url.origin
	) {
		return newsJsonResponse(
			{ success: false, message: "Cross-origin admin request denied" },
			403,
			origin,
			env
		);
	}

	const relativePath = url.pathname.slice(apiPrefix.length).replace(/\/$/, "") || "/";
	const isGalleryQuotePath = relativePath === "/gallery/quotes" || relativePath.startsWith("/gallery/quotes/");
	const isGalleryPath = relativePath === "/gallery" || (relativePath.startsWith("/gallery/") && !isGalleryQuotePath);
	if (isGalleryQuotePath && !env.SITE_DB) return newsDatabaseUnavailable(origin, env);
	if (!env.SITE_DB && !isGalleryPath && relativePath !== "/media") return newsDatabaseUnavailable(origin, env);

	try {
		if (isGalleryQuotePath && request.method === "GET") {
			return newsJsonResponse({ success: true, quotes: await listGalleryQuotes(env, true) }, 200, origin, env);
		}

		if (relativePath === "/gallery/quotes" && request.method === "POST") {
			const quote = normalizeGalleryQuoteInput(await readJsonRequest(request));
			const savedQuote = await saveGalleryQuoteRecord(env, { id: crypto.randomUUID(), ...quote });
			return newsJsonResponse({ success: true, quote: savedQuote }, 201, origin, env);
		}

		const galleryQuoteMatch = relativePath.match(/^\/gallery\/quotes\/([^/]+)$/);
		if (galleryQuoteMatch && request.method === "DELETE") {
			const id = decodeURIComponent(galleryQuoteMatch[1]);
			const result = await env.SITE_DB
				.prepare("UPDATE gallery_quotes SET status = 'archived', updated_at = ? WHERE id = ? AND status <> 'archived'")
				.bind(new Date().toISOString(), id)
				.run();
			if (!result.meta?.changes) return newsJsonResponse({ success: false, message: "Gallery quote not found" }, 404, origin, env);
			return newsJsonResponse({ success: true, id }, 200, origin, env);
		}

		if (isGalleryPath && request.method === "GET") {
			return newsJsonResponse({ success: true, gallery: await listGallery(env, true) }, 200, origin, env);
		}

		if (isGalleryPath && request.method === "POST") {
			if (!env.SITE_MEDIA) return newsMediaUnavailable(origin, env);
			const formData = await request.formData();
			const file = formData.get("file");
			const metadata = normalizeGalleryMetadata(formData);
			const sourceUrl = normalizeGallerySourceUrl(formData.get("source_url"));
			if (file instanceof File && sourceUrl) throw newsError("Choose a file or a Google Drive URL, not both");
			if (!(file instanceof File) && !sourceUrl) throw newsError("Choose an image file or provide a Google Drive URL");

			let body;
			let contentType;
			let extension;
			if (file instanceof File) {
				if (!GALLERY_IMAGE_TYPES[file.type] || file.size === 0 || file.size > GALLERY_IMAGE_MAX_BYTES) {
					return newsJsonResponse({ success: false, message: "Unsupported image or image too large" }, 400, origin, env);
				}
				body = file.stream();
				contentType = file.type;
				extension = GALLERY_IMAGE_TYPES[file.type];
			} else {
				const remoteImage = await readRemoteGalleryImage(sourceUrl);
				body = remoteImage.body;
				contentType = remoteImage.contentType;
				extension = remoteImage.extension;
			}

			metadata.source_type = sourceUrl ? "drive" : "r2";
			const pendingKey = `gallery/pending/${crypto.randomUUID()}.${extension}`;
			await env.SITE_MEDIA.put(pendingKey, body, {
				httpMetadata: {
					contentType,
					cacheControl: "public, max-age=31536000, immutable",
				},
				customMetadata: metadata,
			});
			const key = await promotePendingGalleryImage(env, pendingKey);
			return newsJsonResponse({ success: true, gallery: galleryItemFromObject({ key, customMetadata: metadata }) }, 201, origin, env);
		}

		const galleryItemMatch = relativePath.match(/^\/gallery\/(.+)$/);
		if (galleryItemMatch && request.method === "DELETE") {
			if (!env.SITE_MEDIA) return newsMediaUnavailable(origin, env);
			let key;
			try {
				key = decodeURIComponent(galleryItemMatch[1]);
			} catch {
				throw newsError("Invalid gallery key");
			}
			if (!GALLERY_KEY_PATTERN.test(key)) throw newsError("Invalid gallery key");
			await env.SITE_MEDIA.delete(key);
			return newsJsonResponse({ success: true, key }, 200, origin, env);
		}

		if (relativePath === "/news/availability" && request.method === "GET") {
			const id = normalizeNewsId(url.searchParams.get("id"));
			const result = await env.SITE_DB
				.prepare("SELECT id FROM news WHERE id = ? LIMIT 1")
				.bind(id)
				.all();
			return newsJsonResponse(
				{ success: true, id, available: !(result.results || []).length },
				200,
				origin,
				env
			);
		}

		if (relativePath === "/news" && request.method === "GET") {
			return newsJsonResponse(
				{ success: true, news: await getAdminNews(env) },
				200,
				origin,
				env
			);
		}

		if (relativePath === "/news" && request.method === "POST") {
			const body = await readJsonRequest(request);
			const news = normalizeNewsInput(body);
			if ((await getAdminNews(env)).some((item) => item.id === news.id)) {
				return newsJsonResponse({ success: false, message: "News ID already exists" }, 409, origin, env);
			}
			const savedNews = await saveNewsRecord(env, news, "draft");
			return newsJsonResponse({ success: true, news: { ...savedNews, status: "draft" } }, 201, origin, env);
		}

		const publishMatch = relativePath.match(/^\/news\/([^/]+)\/publish$/);
		if (publishMatch && request.method === "POST") {
			const id = decodeURIComponent(publishMatch[1]);
			const existing = (await getAdminNews(env)).find((item) => item.id === id);
			if (!existing) return newsJsonResponse({ success: false, message: "News not found" }, 404, origin, env);

			const news = normalizeNewsInput(existing);
			const savedNews = await saveNewsRecord(env, news, "published");
			return newsJsonResponse({ success: true, news: { ...savedNews, status: "published" } }, 200, origin, env);
		}

		const itemMatch = relativePath.match(/^\/news\/([^/]+)$/);
		if (itemMatch) {
			const id = decodeURIComponent(itemMatch[1]);

			if (request.method === "PUT") {
				const body = await readJsonRequest(request);
				const news = normalizeNewsInput({ ...body, id });
				const savedNews = await saveNewsRecord(env, news, "draft");
				return newsJsonResponse({ success: true, news: { ...savedNews, status: "draft" } }, 200, origin, env);
			}

			if (request.method === "DELETE") {
				const result = await env.SITE_DB
					.prepare("UPDATE news SET status = 'archived', updated_at = ? WHERE id = ?")
					.bind(new Date().toISOString(), id)
					.run();
				if (!result.meta?.changes) return newsJsonResponse({ success: false, message: "News not found" }, 404, origin, env);
				return newsJsonResponse({ success: true }, 200, origin, env);
			}
		}

		if (relativePath === "/media" && request.method === "POST") {
			if (!env.SITE_MEDIA) return newsMediaUnavailable(origin, env);
			const formData = await request.formData();
			const file = formData.get("file");
			const allowedTypes = {
				"image/jpeg": "jpg",
				"image/png": "png",
				"image/webp": "webp",
				"image/avif": "avif",
			};
			if (!(file instanceof File) || !allowedTypes[file.type] || file.size === 0 || file.size > 8 * 1024 * 1024) {
				return newsJsonResponse({ success: false, message: "Unsupported image or image too large" }, 400, origin, env);
			}

			const key = `news/pending/${crypto.randomUUID()}.${allowedTypes[file.type]}`;
			await env.SITE_MEDIA.put(key, file.stream(), {
				httpMetadata: {
					contentType: file.type,
					cacheControl: "public, max-age=31536000, immutable",
				},
			});
			return newsJsonResponse({ success: true, image: `${SITE_MEDIA_PREFIX}${key}` }, 201, origin, env);
		}

		return newsJsonResponse({ success: false, message: "Not found" }, 404, origin, env);
	} catch (error) {
		const status = Number.isInteger(error?.status) ? error.status : 500;
		if (status < 500) {
			return newsJsonResponse({ success: false, message: error.message }, status, origin, env);
		}
		console.error("News admin request failed", error);
		return newsJsonResponse({ success: false, message: "News service unavailable" }, 503, origin, env);
	}
}

async function handleNewsMedia(request, env, url) {
	if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405 });
	if (!env.SITE_MEDIA) return new Response("News media storage is not configured", { status: 503 });

	const key = url.pathname.slice(SITE_MEDIA_PREFIX.length);
	if (!/^news\/(?:pending\/)?[a-f0-9-]+\.(?:jpg|png|webp|avif)$/.test(key) && !GALLERY_KEY_PATTERN.test(key) && !/^partners\/(?:pending\/)?[a-f0-9-]+\.(?:jpg|png|webp|avif)$/.test(key) && !VIDEO_ASSET_PATTERN.test(url.pathname)) return new Response("Not found", { status: 404 });

	const rangeHeader = request.headers.get("Range");
	let range;
	if (rangeHeader) {
		const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
		if (match) {
			range = { offset: match[1] ? Number(match[1]) : undefined, length: match[2] && match[1] ? Number(match[2]) - Number(match[1]) + 1 : undefined };
		}
	}
	const object = await env.SITE_MEDIA.get(key, range ? { range } : undefined);
	if (!object) return new Response("Not found", { status: 404 });

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("Cache-Control", "public, max-age=31536000, immutable");
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("Accept-Ranges", "bytes");
	if (rangeHeader && object.range) {
		headers.set("Content-Range", `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
		headers.set("Content-Length", String(object.range.length));
		return new Response(request.method === "HEAD" ? null : object.body, { status: 206, headers });
	}
	return new Response(request.method === "HEAD" ? null : object.body, { status: 200, headers });
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const requestHostname = url.hostname.toLowerCase();
		const origin = request.headers.get("Origin");

		if (isProtectedAssetPath(url.pathname)) {
			return forbiddenAssetResponse();
		}

		if (url.pathname === NEWS_API_PATH) {
			return handlePublicNews(request, env, origin);
		}

		if (url.pathname === GALLERY_API_PATH) {
			return handlePublicGallery(request, env, origin);
		}

		if (url.pathname === WORLD_POINTS_API_PATH) {
			return handlePublicWorldPoints(request, env, origin);
		}

		if (url.pathname === PARTNERS_API_PATH) {
			return handlePublicPartners(request, env, origin);
		}

		if (url.pathname === VIDEOS_API_PATH) {
			return handlePublicVideos(request, env, origin);
		}

		const adminApiPrefix = getAdminApiPrefix(url.pathname);
		if (adminApiPrefix) {
			if (url.pathname.startsWith(`${adminApiPrefix}/videos`)) {
				return handleVideoAdminApi(request, env, url, origin, adminApiPrefix);
			}
			if (url.pathname.startsWith(`${adminApiPrefix}/world-points`) || url.pathname.startsWith(`${adminApiPrefix}/partners`)) {
				return handleContentAdminApi(request, env, url, origin, adminApiPrefix);
			}
			return handleNewsAdminApi(request, env, url, origin, adminApiPrefix);
		}

		if (url.pathname.startsWith(SITE_MEDIA_PREFIX)) {
			return handleNewsMedia(request, env, url);
		}

		if (url.pathname === ADMIN_PANEL_PREFIX && (request.method === "GET" || request.method === "HEAD")) {
			return new Response(null, {
				status: 301,
				headers: {
					...COMMON_RESPONSE_HEADERS,
					Location: `${ADMIN_PANEL_PREFIX}/`,
				},
			});
		}

		if (isAdminPanelPath(url.pathname) && !isLocalHostname(requestHostname)) {
			const identity = await authorizeAdmin(request, env);
			if (!identity) return newsAdminUnauthorized(origin, env);
		}

		if (
			url.pathname === "/robots.txt" &&
			(request.method === "GET" || request.method === "HEAD")
		) {
			return textResponse(
				createRobotsTxt(requestHostname),
				"text/plain; charset=utf-8"
			);
		}

		if (
			url.pathname === "/sitemap.xml" &&
			(request.method === "GET" || request.method === "HEAD")
		) {
			return textResponse(
				createSitemapXml(requestHostname),
				"application/xml; charset=utf-8"
			);
		}

		const documentRedirect = canonicalDocumentRedirect(request, url);
		if (documentRedirect) return documentRedirect;

		if (url.pathname !== CONTACT_API_PATH) {
			if (url.pathname.startsWith("/api/")) {
				return jsonResponse(
					{ success: false, message: "Not found" },
					404,
					origin,
					env
				);
			}

			const assetResponse = await env.ASSETS.fetch(request);
			const siteResponse = withSiteHeaders(
				assetResponse,
				url.pathname
			);

			if (request.method === "HEAD") return siteResponse;

			return rewriteDocumentMetadata(siteResponse, url);
		}

		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: {
					...COMMON_RESPONSE_HEADERS,
					...corsHeaders(origin, env),
				},
			});
		}

		if (request.method !== "POST") {
			return jsonResponse(
				{
					success: false,
					message:
						"Method not allowed",
				},
				405,
				origin,
				env
			);
		}

		const allowedOrigins =
			getAllowedOrigins(env);

		if (
			!origin ||
			!allowedOrigins.has(origin)
		) {
			return jsonResponse(
				{
					success: false,
					message:
						"Origin not allowed",
				},
				403,
				origin,
				env
			);
		}

		const contentLength = Number(
			request.headers.get(
				"Content-Length"
			) || 0
		);

		if (contentLength > 100_000) {
			return jsonResponse(
				{
					success: false,
					message:
						"Request too large",
				},
				413,
				origin,
				env
			);
		}

		let payload;

		try {
			payload =
				await request.json();
		} catch {
			return jsonResponse(
				{
					success: false,
					message: "Invalid JSON",
				},
				400,
				origin,
				env
			);
		}

		const {
			formType,
			fields,
			turnstileToken,
			meta,
		} = payload;

		if (!FORM_TYPES.has(formType)) {
			return jsonResponse(
				{
					success: false,
					message:
						"Unknown form type",
				},
				400,
				origin,
				env
			);
		}

		const rateLimit = await checkContactRateLimit(
			request,
			env,
			formType
		);

		if (rateLimit.unavailable) {
			return jsonResponse(
				{
					success: false,
					message: "Server security configuration is unavailable",
				},
				503,
				origin,
				env
			);
		}

		if (!rateLimit.success) {
			return jsonResponse(
				{
					success: false,
					message: "Too many requests",
				},
				429,
				origin,
				env,
				{ "Retry-After": String(RATE_LIMIT_WINDOW_SECONDS) }
			);
		}

		try {
			validateFields(formType, fields);
			validateRequiredFields(
				formType,
				fields
			);
		} catch (error) {
			return jsonResponse(
				{
					success: false,
					message: error.message,
				},
				400,
				origin,
				env
			);
		}

		/*
		 * Honeypot.
		 * Für Bots geben wir absichtlich "Erfolg" zurück.
		 */
		if (
			String(
				fields.website_check || ""
			).trim()
		) {
			return jsonResponse(
				{
					success: true,
				},
				200,
				origin,
				env
			);
		}

		/*
		 * Local development:
		 * Any request coming from localhost / 127.0.0.1 uses Cloudflare's
		 * official Turnstile test credentials automatically.
		 *
		 * Production requests never enter this branch because their Origin
		 * is one of the real MIRoKIT domains.
		 */
		const turnstileTestMode = isLocalOrigin(origin);

		const expectedAction = turnstileTestMode
			? "test"
			: formType === "main-contact"
				? "contact"
				: "league";

		const expectedHostnames = turnstileTestMode
			? new Set(["localhost"])
			: new Set(
				String(env.TURNSTILE_HOSTNAMES || "")
					.split(",")
					.map((hostname) => hostname.trim())
					.filter(Boolean)
			);

		const turnstileSecret = turnstileTestMode
			? TURNSTILE_TEST_SECRET
			: env.TURNSTILE_SECRET;

		if (!turnstileSecret) {
			console.error("TURNSTILE_SECRET is not configured");

			return jsonResponse(
				{
					success: false,
					message: "Server security configuration is missing",
				},
				500,
				origin,
				env
			);
		}

		if (!turnstileTestMode && expectedHostnames.size === 0) {
			console.error("TURNSTILE_HOSTNAMES is not configured");

			return jsonResponse(
				{
					success: false,
					message: "Server security configuration is missing",
				},
				500,
				origin,
				env
			);
		}

		const turnstile = await verifyTurnstile({
			token: turnstileToken,
			secret: turnstileSecret,
			ip: request.headers.get("CF-Connecting-IP"),
			expectedAction,
			expectedHostnames,
			strictContextValidation: !turnstileTestMode,
		});

		if (!turnstile.success) {
			console.warn("Turnstile validation failed", {
				success: false,
				reason: turnstile.reason,
				hostname: turnstile.hostname,
				action: turnstile.action,
				expectedAction,
				errorCodes: turnstile["error-codes"] || [],
				testMode: turnstileTestMode,
			});

			return jsonResponse(
				{
					success: false,
					message: "Security validation failed",
				},
				403,
				origin,
				env
			);
		}

		const senderEmail =
			String(fields.email).trim();

		/*
		 * requestHostname comes from request.url, i.e. the domain that
		 * actually received /api/v1/contact. It is not supplied by form data.
		 */
		const sourceDomain = requestHostname;
		const mailFrom =
			getMailFromForHostname(sourceDomain, env);

		if (!mailFrom) {
			console.warn("Unsupported MIRoKIT request hostname", {
				sourceDomain,
			});

			return jsonResponse(
				{
					success: false,
					message: "Unsupported website domain",
				},
				403,
				origin,
				env
			);
		}

		const senderName =
			stripHeaderCharacters(
				fields.name ||
				fields.contact_name ||
				fields.organization_full ||
				"Website visitor"
			);

		const subject =
			formType === "extra-contact" ? `MIRoKIT · Liga-Antrag · ${sourceDomain} · ${senderName}` : `MIRoKIT · Kontakt · ${sourceDomain} · ${senderName}`;

		try {
			const result =
				await env.CONTACT_EMAIL.send({
					to: env.MAIL_TO,

					from: {
						email:
							mailFrom,

						name:
							"MIRoKIT INFO System",
					},

					replyTo: {
						email:
							senderEmail,

						name:
							senderName,
					},

					subject,

					html:
						createEmailHtml({
							formType,
							fields,
							meta,
							sourceDomain,
						}),

					text:
						createTextEmail({
							formType,
							fields,
						}),
				});

			console.log(
				"MIRoKIT email sent",
				{
					messageId:
						result.messageId,

					formType,
					sourceDomain,
					mailFrom,
				}
			);

			return jsonResponse(
				{
					success: true,
				},
				200,
				origin,
				env
			);
		} catch (error) {
			console.error(
				"MIRoKIT email send failed",
				{
					code: error?.code,
					message:
						error?.message,
				}
			);

			return jsonResponse(
				{
					success: false,
					message:
						"Email delivery failed",
				},
				502,
				origin,
				env
			);
		}
	},
};

export {
	FORM_FIELD_ALLOWLIST,
	checkContactRateLimit,
	getAllowedOrigins,
	isLocalOrigin,
	rowsToGalleryQuotes,
	validateFields,
};
