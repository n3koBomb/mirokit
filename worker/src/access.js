const ACCESS_JWKS_CACHE = new Map();
const ACCESS_JWKS_TTL_MS = 60 * 60 * 1000;
const ACCESS_JWKS_REFRESH_COOLDOWN_MS = 30 * 1000;

function isLocalHostname(hostname) {
	const normalized = String(hostname || "").toLowerCase();
	return normalized === "localhost" || normalized === "127.0.0.1";
}

function decodeBase64Url(value) {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
	const binary = atob(padded);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJsonPart(value) {
	return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function getAccessKeys(teamDomain, refresh = false) {
	const now = Date.now();
	let entry = ACCESS_JWKS_CACHE.get(teamDomain);
	if (!entry || entry.expiresAt <= now || (refresh && now - entry.fetchedAt >= ACCESS_JWKS_REFRESH_COOLDOWN_MS)) {
		entry = { fetchedAt: now, expiresAt: now + ACCESS_JWKS_TTL_MS };
		entry.promise = fetch(`${teamDomain}/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(5000) }).then(async (response) => {
			if (!response.ok) throw new Error(`Access certs request failed: ${response.status}`);
			const body = await response.json();
			if (!Array.isArray(body.keys)) throw new Error("Invalid Access certs response");
			return body.keys;
		});
		ACCESS_JWKS_CACHE.set(teamDomain, entry);
	}

	try {
		return await entry.promise;
	} catch (error) {
		if (ACCESS_JWKS_CACHE.get(teamDomain) === entry) ACCESS_JWKS_CACHE.delete(teamDomain);
		throw error;
	}
}

async function verifyAccessJwt(token, env) {
	const teamDomain = String(env.ACCESS_TEAM_DOMAIN || "").trim().replace(/\/$/, "");
	const audience = String(env.ACCESS_AUDIENCE || "").trim();
	if (!teamDomain || !audience || !token) return null;

	const parts = token.split(".");
	if (parts.length !== 3) return null;

	try {
		const header = decodeJsonPart(parts[0]);
		const payload = decodeJsonPart(parts[1]);
		if (header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) return null;

		let keyData = (await getAccessKeys(teamDomain)).find((key) => key.kid === header.kid);
		if (!keyData) keyData = (await getAccessKeys(teamDomain, true)).find((key) => key.kid === header.kid);
		if (!keyData) return null;

		const key = await crypto.subtle.importKey(
			"jwk",
			keyData,
			{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
			false,
			["verify"]
		);
		const validSignature = await crypto.subtle.verify(
			{ name: "RSASSA-PKCS1-v1_5" },
			key,
			decodeBase64Url(parts[2]),
			new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
		);
		if (!validSignature) return null;

		const now = Math.floor(Date.now() / 1000);
		const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
		if (
			payload.iss !== teamDomain ||
			!audiences.includes(audience) ||
			!Number.isFinite(payload.exp) ||
			payload.exp <= now ||
			(payload.nbf !== undefined && (!Number.isFinite(payload.nbf) || payload.nbf > now))
		) {
			return null;
		}

		return payload;
	} catch (error) {
		console.warn("Access JWT validation failed", error);
		return null;
	}
}

async function authorizeAdmin(request, env) {
	const url = new URL(request.url);
	const localToken = String(env.ADMIN_DEV_TOKEN || "");
	if (isLocalHostname(url.hostname) && localToken) {
		if (request.headers.get("X-MiroKIT-Admin-Token") === localToken) {
			return { email: "local@mirokit.test", local: true };
		}
		return null;
	}

	const payload = await verifyAccessJwt(
		request.headers.get("Cf-Access-Jwt-Assertion"),
		env
	);
	if (!payload) return null;

	const email = String(payload.email || "").trim().toLowerCase();
	const allowedEmails = String(env.ACCESS_ADMIN_EMAILS || "")
		.split(",")
		.map((value) => value.trim().toLowerCase())
		.filter(Boolean);
	if (!email || !allowedEmails.includes(email)) return null;

	return { email, local: false };
}

export { authorizeAdmin, isLocalHostname, verifyAccessJwt };
