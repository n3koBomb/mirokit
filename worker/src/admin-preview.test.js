import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdminMediaPreview } from "../../site/admin/media-preview.js";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function preview(isLocal = true) {
	return createAdminMediaPreview({ origin: "http://localhost:8787", isLocal, getLocalToken: () => "private-token", showNotice: vi.fn() });
}
function element() {
	const attributes = new Map();
	return { isConnected: true, getAttribute: (name) => attributes.get(name), setAttribute: (name, value) => attributes.set(name, value), removeAttribute: (name) => attributes.delete(name) };
}

describe("admin media previews", () => {
	it("uses protected URLs for site media and resolves static media from the root", () => {
		const { resolveMediaUrl } = preview();
		expect(resolveMediaUrl("/media/v1/news/pending/abc.webp")).toBe("http://localhost:8787/api/v1/admin/media/news/pending/abc.webp");
		expect(resolveMediaUrl("https://ligamirokit.com/media/v1/news/abc.webp")).toBe("http://localhost:8787/api/v1/admin/media/news/abc.webp");
		expect(resolveMediaUrl("public/logo.png")).toBe("http://localhost:8787/public/logo.png");
		expect(resolveMediaUrl("")).toBe("");
	});
	it("attaches the local token only to same-origin preview requests", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => new Response("media")));
		const { fetchAdminMedia } = preview();
		await fetchAdminMedia("/media/v1/subtitles/abc.vtt");
		await fetchAdminMedia("https://external.example/media/v1/subtitles/abc.vtt");
		expect(fetch.mock.calls[0][1].headers.get("X-MiroKIT-Admin-Token")).toBe("private-token");
		expect(fetch.mock.calls[0][1].cache).toBe("no-store");
		expect(fetch.mock.calls[1][1].headers.has("X-MiroKIT-Admin-Token")).toBe(false);
		expect(fetch.mock.calls[0][0]).not.toContain("private-token");
	});
	it("keeps production previews streamable through the Access-protected URL", async () => {
		vi.stubGlobal("fetch", vi.fn());
		const target = element();
		await preview(false).setMediaPreview(target, "src", "/media/v1/videos/abc.mp4");
		expect(target.getAttribute("src")).toBe("http://localhost:8787/api/v1/admin/media/videos/abc.mp4");
		expect(fetch).not.toHaveBeenCalled();
	});
	it("creates local authenticated blobs and revokes them when cleared", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => new Response("video")));
		vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
		const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		const target = element();
		const { setMediaPreview } = preview();
		await setMediaPreview(target, "src", "/media/v1/videos/abc.mp4");
		expect(target.getAttribute("src")).toBe("blob:preview");
		await setMediaPreview(target, "src", "");
		expect(target.getAttribute("src")).toBeUndefined();
		expect(revoke).toHaveBeenCalledWith("blob:preview");
	});
	it("does not replace a newer preview with a slow response", async () => {
		let resolveOld;
		vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => { resolveOld = resolve; })));
		const create = vi.spyOn(URL, "createObjectURL");
		const target = element();
		const { setMediaPreview } = preview();
		const old = setMediaPreview(target, "src", "/media/v1/videos/abc.mp4");
		await setMediaPreview(target, "src", "https://external.example/new.mp4");
		resolveOld(new Response("old video"));
		await old;
		expect(target.getAttribute("src")).toBe("https://external.example/new.mp4");
		expect(create).not.toHaveBeenCalled();
	});
});
