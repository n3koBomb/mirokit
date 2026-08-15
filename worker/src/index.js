const FORM_TYPES = new Set([
	"main-contact",
	"extra-contact",
]);

const TURNSTILE_TEST_SECRET =
	"1x0000000000000000000000000000000AA";

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
	env
) {
	return new Response(JSON.stringify(data), {
		status,

		headers: {
			"Content-Type":
				"application/json; charset=utf-8",

			"Cache-Control":
				"no-store",

			...corsHeaders(origin, env),
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

function validateFields(fields) {
	if (
		!fields ||
		typeof fields !== "object" ||
		Array.isArray(fields)
	) {
		throw new Error("Invalid fields");
	}

	const entries = Object.entries(fields);

	if (entries.length > 100) {
		throw new Error("Too many fields");
	}

	for (const [key, value] of entries) {
		if (key.length > 80) {
			throw new Error("Invalid field name");
		}

		const values = toArray(value);

		if (values.length > 30) {
			throw new Error("Too many field values");
		}

		for (const item of values) {
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
}) {
	const isLeague =
		formType === "extra-contact";

	const title = isLeague
		? "Neue MIRoKIT Liga-Anfrage"
		: "Neue Nachricht über mirokit.com";

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

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const origin = request.headers.get("Origin");

		if (url.pathname !== "/api/contact") {
			return jsonResponse(
				{ success: false, message: "Not found" },
				404,
				origin,
				env
			);
		}

		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: corsHeaders(
					origin,
					env
				),
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

		try {
			validateFields(fields);
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

		const requestOrigin =
			request.headers.get("Origin");

		const sourceDomain = requestOrigin
			? new URL(requestOrigin).hostname
			: "unknown";

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
							env.MAIL_FROM,

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