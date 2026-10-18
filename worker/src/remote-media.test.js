import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDriveImage } from "./remote-media.js";

const source = "https://drive.google.com/uc?id=example";
afterEach(() => vi.unstubAllGlobals());

describe("Google Drive image download", () => {
  it.each(["image/jpeg", "image/png", "image/webp", "image/avif"])("downloads %s and retains exact bytes", async (type) => {
    const bytes = new Uint8Array([0, 255, 1, 128]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(bytes, { headers: { "Content-Type": `${type.toUpperCase()}; charset=binary` } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchDriveImage(source, bytes.length);
    expect(new Uint8Array(result.body)).toEqual(bytes);
    expect(result.contentType).toBe(type);
    expect(fetchMock).toHaveBeenCalledWith(source, {
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg" }, redirect: "manual", signal: expect.any(AbortSignal),
    });
  });

  it.each(["not a url", "http://drive.google.com/image", "https://evil.test/image", "https://drive.google.com.evil.test/image", "https://user:pass@drive.google.com/image", "https://drive.google.com:8443/image"])("rejects unsafe initial URL %s before fetching", async (url) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchDriveImage(url, 10)).rejects.toThrow("not allowed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([301, 302, 303, 307, 308])("follows an allowed relative redirect with status %i", async (status) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status, headers: { Location: "/download/image" } }))
      .mockResolvedValueOnce(new Response("abc", { headers: { "Content-Type": "image/png" } }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await fetchDriveImage(source, 3)).contentType).toBe("image/png");
    expect(fetchMock.mock.calls[1][0]).toBe("https://drive.google.com/download/image");
    expect(fetchMock.mock.calls[1][1].signal).toBe(fetchMock.mock.calls[0][1].signal);
  });

  it.each(["https://docs.google.com/image", "https://drive.usercontent.google.com/image", "https://lh3.googleusercontent.com/image"])("accepts image host %s", async (url) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("abc", { headers: { "Content-Type": "image/webp" } })));
    expect((await fetchDriveImage(url, 3)).body.byteLength).toBe(3);
  });

  it.each([
    [302, {}, "no destination"], [404, {}, "unavailable"], [500, {}, "unavailable"],
    [200, {}, "supported image"], [200, { "Content-Type": "image/svg+xml" }, "supported image"],
    [200, { "Content-Type": "text/html" }, "supported image"],
    [200, { "Content-Type": "image/png", "Content-Length": "11" }, "8 MB"],
  ])("rejects status %i and headers %j and cancels the body", async (status, headers, message) => {
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status, headers })));
    await expect(fetchDriveImage(source, 10)).rejects.toThrow(message);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each([null, ""])("rejects an empty image body %j", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { headers: { "Content-Type": "image/png" } })));
    await expect(fetchDriveImage(source, 10)).rejects.toThrow("empty");
  });

  it("combines streamed chunks up to the exact byte limit", async () => {
    const body = new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array([1, 2]));
      controller.enqueue(new Uint8Array([3, 4]));
      controller.close();
    } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { headers: { "Content-Type": "image/png" } })));
    expect(new Uint8Array((await fetchDriveImage(source, 4)).body)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("enforces the streamed limit even when Content-Length understates the body", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(4)); }, cancel });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { headers: { "Content-Type": "image/png", "Content-Length": "1" } })));
    await expect(fetchDriveImage(source, 5)).rejects.toThrow("8 MB");
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  });

  it("releases the reader when the stream fails", async () => {
    const body = new ReadableStream({ start(controller) { controller.error(new Error("stream failed")); } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { headers: { "Content-Type": "image/png" } })));
    await expect(fetchDriveImage(source, 10)).rejects.toThrow("stream failed");
    expect(body.locked).toBe(false);
  });

  it("propagates network and timeout failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError")));
    await expect(fetchDriveImage(source, 10)).rejects.toMatchObject({ name: "TimeoutError" });
  });
});
