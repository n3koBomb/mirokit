import { authorizeAdmin, isLocalHostname } from "./access.js";
import {
	NEWS_ADMIN_QUERY,
	NEWS_PUBLIC_QUERY,
	newsError,
	normalizeNewsInput,
	newsToStatements,
	rowsToAdminNews,
	rowsToNews,
} from "./news.js";

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
const NEWS_API_PATH = "/api/news";
const NEWS_ADMIN_PREFIX = "/news-admin";
const NEWS_ADMIN_API_PREFIX = "/news-admin/api";
const NEWS_MEDIA_PREFIX = "/news-media/";

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
		"Disallow: /news-admin/",
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
		url.pathname === "/page/privacyPolicy" ||
		!response.headers.get("content-type")?.includes("text/html")
	) {
		return response;
	}

	const canonicalSiteHostname = getCanonicalSiteHostname(url.hostname);
	const canonicalPath =
		url.pathname === "/" ? "/" : "/page/privacyPolicy/";
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

function isDocumentPath(pathname) {
	return (
		pathname === "/" ||
		pathname === "/index.html" ||
		pathname === "/page/privacyPolicy" ||
		pathname === "/page/privacyPolicy/"
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

	const canonicalPath =
		url.pathname === "/" || url.pathname === "/index.html"
			? "/"
			: "/page/privacyPolicy/";
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
	console.error("NEWS_DB is not configured");
	return newsJsonResponse(
		{ success: false, message: "News storage is not configured" },
		503,
		origin,
		env
	);
}

function isNewsAdminPath(pathname) {
	return pathname === NEWS_ADMIN_PREFIX || pathname.startsWith(`${NEWS_ADMIN_PREFIX}/`);
}

function isNewsAdminApiPath(pathname) {
	return pathname === NEWS_ADMIN_API_PREFIX || pathname.startsWith(`${NEWS_ADMIN_API_PREFIX}/`);
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
	const result = await env.NEWS_DB.prepare(NEWS_ADMIN_QUERY).all();
	return rowsToAdminNews(result.results || []);
}

async function saveNewsRecord(env, news, status) {
	const statements = newsToStatements(news, status, new Date().toISOString());
	await env.NEWS_DB.batch(
		statements.map((statement) =>
			env.NEWS_DB.prepare(statement.sql).bind(...statement.params)
		)
	);
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

	if (!env.NEWS_DB) return newsDatabaseUnavailable(origin, env);

	try {
		const today = new Date().toISOString().slice(0, 10);
		const result = await env.NEWS_DB.prepare(NEWS_PUBLIC_QUERY).bind(today).all();
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

async function handleNewsAdminApi(request, env, url, origin) {
	const identity = await authorizeAdmin(request, env);
	if (!identity) return newsAdminUnauthorized(origin, env);
	if (!env.NEWS_DB) return newsDatabaseUnavailable(origin, env);

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

	const relativePath = url.pathname.slice(NEWS_ADMIN_API_PREFIX.length).replace(/\/$/, "") || "/";

	try {
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
			await saveNewsRecord(env, news, "draft");
			return newsJsonResponse({ success: true, news }, 201, origin, env);
		}

		const publishMatch = relativePath.match(/^\/news\/([^/]+)\/publish$/);
		if (publishMatch && request.method === "POST") {
			const id = decodeURIComponent(publishMatch[1]);
			const existing = (await getAdminNews(env)).find((item) => item.id === id);
			if (!existing) return newsJsonResponse({ success: false, message: "News not found" }, 404, origin, env);

			const news = normalizeNewsInput(existing);
			await saveNewsRecord(env, news, "published");
			return newsJsonResponse({ success: true, news: { ...news, status: "published" } }, 200, origin, env);
		}

		const itemMatch = relativePath.match(/^\/news\/([^/]+)$/);
		if (itemMatch) {
			const id = decodeURIComponent(itemMatch[1]);

			if (request.method === "PUT") {
				const body = await readJsonRequest(request);
				const news = normalizeNewsInput({ ...body, id });
				await saveNewsRecord(env, news, "draft");
				return newsJsonResponse({ success: true, news }, 200, origin, env);
			}

			if (request.method === "DELETE") {
				const result = await env.NEWS_DB
					.prepare("UPDATE news SET status = 'archived', updated_at = ? WHERE id = ?")
					.bind(new Date().toISOString(), id)
					.run();
				if (!result.meta?.changes) return newsJsonResponse({ success: false, message: "News not found" }, 404, origin, env);
				return newsJsonResponse({ success: true }, 200, origin, env);
			}
		}

		if (relativePath === "/media" && request.method === "POST") {
			if (!env.NEWS_MEDIA) return newsDatabaseUnavailable(origin, env);
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

			const key = `news/${crypto.randomUUID()}.${allowedTypes[file.type]}`;
			await env.NEWS_MEDIA.put(key, file.stream(), {
				httpMetadata: {
					contentType: file.type,
					cacheControl: "public, max-age=31536000, immutable",
				},
			});
			return newsJsonResponse({ success: true, image: `${NEWS_MEDIA_PREFIX}${key}` }, 201, origin, env);
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
	if (!env.NEWS_MEDIA) return new Response("News media storage is not configured", { status: 503 });

	const key = url.pathname.slice(NEWS_MEDIA_PREFIX.length);
	if (!/^news\/[a-f0-9-]+\.(?:jpg|png|webp|avif)$/.test(key)) return new Response("Not found", { status: 404 });

	const object = await env.NEWS_MEDIA.get(key);
	if (!object) return new Response("Not found", { status: 404 });

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("Cache-Control", "public, max-age=31536000, immutable");
	headers.set("X-Content-Type-Options", "nosniff");
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

		if (isNewsAdminApiPath(url.pathname)) {
			return handleNewsAdminApi(request, env, url, origin);
		}

		if (url.pathname.startsWith(NEWS_MEDIA_PREFIX)) {
			return handleNewsMedia(request, env, url);
		}

		if (url.pathname === NEWS_ADMIN_PREFIX && (request.method === "GET" || request.method === "HEAD")) {
			return new Response(null, {
				status: 301,
				headers: {
					...COMMON_RESPONSE_HEADERS,
					Location: `${NEWS_ADMIN_PREFIX}/`,
				},
			});
		}

		if (isNewsAdminPath(url.pathname) && !isLocalHostname(requestHostname)) {
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

		if (url.pathname !== "/api/contact") {
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
		 * actually received /api/contact. It is not supplied by form data.
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
	validateFields,
};
