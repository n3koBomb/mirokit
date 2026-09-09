const ACCESS_JWKS_CACHE = new Map();

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

async function getAccessKeys(teamDomain) {
	if (!ACCESS_JWKS_CACHE.has(teamDomain)) {
		const promise = fetch(`${teamDomain}/cdn-cgi/access/certs`).then(async (response) => {
			if (!response.ok) throw new Error(`Access certs request failed: ${response.status}`);
			const body = await response.json();
			if (!Array.isArray(body.keys)) throw new Error("Invalid Access certs response");
			return body.keys;
		});
		ACCESS_JWKS_CACHE.set(teamDomain, promise);
	}

	try {
		return await ACCESS_JWKS_CACHE.get(teamDomain);
	} catch (error) {
		ACCESS_JWKS_CACHE.delete(teamDomain);
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
		if (header.alg !== "RS256" || !header.kid) return null;

		const keyData = (await getAccessKeys(teamDomain)).find((key) => key.kid === header.kid);
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
			payload.exp <= now
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
