import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let keys, verifyAccessJwt, authorizeAdmin;
const env = { ACCESS_TEAM_DOMAIN: "https://team.cloudflareaccess.com", ACCESS_AUDIENCE: "admin-app", ACCESS_ADMIN_EMAILS: "admin@example.org" };
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
async function token(claims = {}, kid = "first", header = {}) {
	const payload = { iss: env.ACCESS_TEAM_DOMAIN, aud: [env.ACCESS_AUDIENCE], exp: Math.floor(Date.now() / 1000) + 7200, email: "admin@example.org", ...claims };
	const input = `${encode({ alg: "RS256", kid, ...header })}.${encode(payload)}`;
	const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys[kid].privateKey, new TextEncoder().encode(input));
	return `${input}.${Buffer.from(signature).toString("base64url")}`;
}
beforeAll(async () => {
	keys = {};
	for (const kid of ["first", "second"]) {
		const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
		keys[kid] = { ...pair, jwk: { ...await crypto.subtle.exportKey("jwk", pair.publicKey), kid } };
	}
});
beforeEach(async () => {
	vi.resetModules();
	({ verifyAccessJwt, authorizeAdmin } = await import("./access.js"));
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2026-09-09T12:00:00Z"));
	vi.stubGlobal("fetch", vi.fn(async () => Response.json({ keys: [keys.first.jwk] })));
	vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Access JWT validation and key rotation", () => {
	it("validates an authentic token and reuses fresh keys", async () => {
		const jwt = await token();
		expect(await verifyAccessJwt(jwt, env)).toMatchObject({ email: "admin@example.org" });
		expect(await verifyAccessJwt(jwt, env)).not.toBeNull();
		expect(fetch).toHaveBeenCalledTimes(1);
	});
	it("refreshes cached keys once for an unknown kid after rotation", async () => {
		await verifyAccessJwt(await token(), env);
		vi.setSystemTime(Date.now() + 31_000);
		fetch.mockResolvedValueOnce(Response.json({ keys: [keys.second.jwk] }));
		expect(await verifyAccessJwt(await token({}, "second"), env)).not.toBeNull();
		expect(fetch).toHaveBeenCalledTimes(2);
	});
	it("bounds unknown-kid refreshes and shares concurrent fetches", async () => {
		await verifyAccessJwt(await token(), env);
		vi.setSystemTime(Date.now() + 31_000);
		const jwt = await token({}, "second");
		const results = await Promise.all(Array.from({ length: 8 }, () => verifyAccessJwt(jwt, env)));
		expect(results.every((result) => result === null)).toBe(true);
		expect(fetch).toHaveBeenCalledTimes(2);
	});
	it("expires cached keys after one hour even when the kid is known", async () => {
		await verifyAccessJwt(await token(), env);
		vi.setSystemTime(Date.now() + 3_600_001);
		fetch.mockResolvedValueOnce(Response.json({ keys: [keys.second.jwk] }));
		expect(await verifyAccessJwt(await token(), env)).toBeNull();
		expect(fetch).toHaveBeenCalledTimes(2);
	});
	it.each([{ nbf: 9999999999 }, { nbf: "0" }, { nbf: null }, { exp: 1 }, { exp: "9999999999" }, { iss: "https://wrong.cloudflareaccess.com" }, { aud: "another-app" }])("rejects invalid claims %j", async (claims) => {
		expect(await verifyAccessJwt(await token(claims), env)).toBeNull();
	});
	it("accepts nbf at the current second", async () => {
		expect(await verifyAccessJwt(await token({ nbf: Math.floor(Date.now() / 1000) }), env)).not.toBeNull();
	});
	it("rejects invalid signatures, algorithms and malformed tokens", async () => {
		const jwt = await token();
		expect(await verifyAccessJwt(`${jwt.slice(0, jwt.lastIndexOf(".") + 1)}AAAA`, env)).toBeNull();
		expect(await verifyAccessJwt(await token({}, "first", { alg: "none" }), env)).toBeNull();
		expect(await verifyAccessJwt("not.a.jwt", env)).toBeNull();
	});
	it("recovers after JWKS failures without keeping rejected promises", async () => {
		fetch.mockRejectedValueOnce(new Error("offline"));
		const jwt = await token();
		expect(await verifyAccessJwt(jwt, env)).toBeNull();
		expect(await verifyAccessJwt(jwt, env)).not.toBeNull();
	});
	it("enforces the admin email allowlist after signature verification", async () => {
		const request = new Request("https://mirokit.com/api/v1/admin/news", { headers: { "Cf-Access-Jwt-Assertion": await token({ email: "other@example.org" }) } });
		expect(await authorizeAdmin(request, env)).toBeNull();
	});
});
