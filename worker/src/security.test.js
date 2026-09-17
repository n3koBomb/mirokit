import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import worker from "./index.js";
import { getCanonicalSiteHostname } from "./hosts.js";
import { CSP_REPORT_ONLY } from "./security-headers.js";
import { fetchDriveImage } from "./remote-media.js";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("explicit site hostnames", () => {
	it.each(["evil.com", "example.ru", "mirokit.com.evil.com", "evilmirokit.com", "preview.workers.dev", "localhost"])("does not classify %s as a production hostname", (host) => {
		expect(getCanonicalSiteHostname(host)).toBeNull();
	});
	it.each([["www.ligamirokit.com", "mirokit.com"], [" MIROKIT.RU. ", "mirokit.ru"]])("recognizes %s", (host, canonical) => {
		expect(getCanonicalSiteHostname(host)).toBe(canonical);
	});
	it("retains aliases in document redirects", async () => {
		const response = await worker.fetch(new Request("https://ligamirokit.com/index.html"), {});
		expect(response.headers.get("Location")).toBe("https://ligamirokit.com/");
	});
	it("does not redirect the canonical online-projects URL to itself", async () => {
		const response = await worker.fetch(new Request("https://ligamirokit.com/page/onlineProjects/"), { ASSETS: { fetch: async () => new Response("page") } });
		expect(response.status).toBe(200);
		expect(response.headers.get("Location")).toBeNull();
	});
});

describe("security headers and admin methods", () => {
	it("uses the same report-only CSP for Worker and static responses", async () => {
		const staticPolicy = readFileSync(new URL("../../site/_headers", import.meta.url), "utf8").match(/Content-Security-Policy-Report-Only: (.+)/)[1];
		expect(staticPolicy).toBe(CSP_REPORT_ONLY);
		const response = await worker.fetch(new Request("http://localhost/admin/"), { ASSETS: { fetch: async () => new Response("admin", { headers: { "Content-Type": "text/html" } }) } });
		expect(response.headers.get("Content-Security-Policy-Report-Only")).toBe(CSP_REPORT_ONLY);
		expect(response.headers.get("Content-Security-Policy")).toBeNull();
		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
	});
	it.each([["news", "PATCH"], ["partners/item/publish", "DELETE"], ["world-points/item/publish", "PUT"], ["videos/media", "DELETE"], ["gallery/something", "POST"]])("rejects %s with %s before accessing storage", async (path, method) => {
		const response = await worker.fetch(new Request(`http://localhost/api/v1/admin/${path}`, { method, headers: { "X-MiroKIT-Admin-Token": "token" } }), { ADMIN_DEV_TOKEN: "token" });
		expect(response.status).toBe(405);
		expect(response.headers.get("Allow")).toBeTruthy();
	});
});

describe("Google Drive import boundaries", () => {
	it.each(["http://127.0.0.1/image", "https://evil.example/image", "https://drive.google.com.evil.example/image", "https://user:pass@drive.google.com/image", "https://drive.google.com:444/image"])("rejects redirects to %s before following them", async (location) => {
		vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 302, headers: { Location: location } })));
		await expect(fetchDriveImage("https://drive.google.com/uc?id=example", 100)).rejects.toThrow("not allowed");
		expect(fetch).toHaveBeenCalledTimes(1);
	});
	it("permits approved Google image redirects", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: "https://drive.usercontent.google.com/download?id=example" } })).mockResolvedValueOnce(new Response("image", { headers: { "Content-Type": "image/png" } })));
		const result = await fetchDriveImage("https://drive.google.com/uc?id=example", 100);
		expect(new TextDecoder().decode(result.body)).toBe("image");
		expect(fetch.mock.calls.every(([, options]) => options.redirect === "manual")).toBe(true);
	});
	it("limits redirect loops", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 302, headers: { Location: "/loop" } })));
		await expect(fetchDriveImage("https://drive.google.com/uc?id=example", 100)).rejects.toThrow("Too many");
		expect(fetch).toHaveBeenCalledTimes(6);
	});
	it("bounds streamed bytes even without Content-Length", async () => {
		const cancel = vi.fn();
		vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(8)); }, cancel }), { headers: { "Content-Type": "image/png" } })));
		await expect(fetchDriveImage("https://drive.google.com/uc?id=example", 10)).rejects.toThrow("8 MB");
		expect(cancel).toHaveBeenCalled();
	});
});
