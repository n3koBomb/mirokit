import { describe, expect, it } from "vitest";
import { adminMethodResponse } from "./admin-methods.js";

// Explicit endpoint contracts also protect route precedence (e.g. /media and /publish).
const routes = [
  ["online-projects/media", ["GET", "POST"]],
  ["online-projects/media/item", ["PATCH", "DELETE"]],
  ...["news", "videos", "partners", "world-points", "projects", "interviews/videos", "interviews/materials", "gallery", "gallery/quotes"].map((path) => [path, ["GET", "POST"]]),
  ["news/availability", ["GET"]],
  ...["media", "videos/media", "partners/media", "projects/media", "interviews/videos/media", "interviews/materials/media", "gallery/publish", "gallery/reorder"].map((path) => [path, ["POST"]]),
  ...["news", "videos", "partners", "world-points", "projects", "interviews/videos", "interviews/materials"].map((path) => [`${path}/item/publish`, ["POST"]]),
  ...["news", "videos", "projects", "interviews/videos", "interviews/materials"].map((path) => [`${path}/item`, ["PUT", "DELETE"]]),
  ...["partners", "world-points"].map((path) => [`${path}/item`, ["POST", "PUT", "DELETE"]]),
  ["gallery/quotes/item", ["DELETE"]],
  ["gallery/gallery/pending/item.webp", ["PATCH", "DELETE"]],
];

describe("admin endpoint method contracts", () => {
  it.each(routes)("accepts declared methods and rejects all others for %s", async (path, allowed) => {
    for (const suffix of ["", "/"]) {
      const url = new URL(`http://localhost/api/v1/admin/${path}${suffix}`);
      for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
        const result = adminMethodResponse(new Request(url, { method }), url.pathname);
        if (allowed.includes(method)) expect(result).toBeNull();
        else {
          expect(result.status).toBe(405);
          expect(result.headers.get("Allow")).toBe(allowed.join(", "));
          expect(result.headers.get("Cache-Control")).toBe("private, no-store");
          expect(result.headers.get("X-Content-Type-Options")).toBe("nosniff");
          expect(result.headers.get("Content-Type")).toBe("application/json");
          expect(await result.json()).toEqual({ success: false, message: "Method not allowed" });
        }
      }
    }
  });

  it.each(["", "unknown", "news/item/unknown", "gallery/quotes/item/unknown", "online-projects/media/item/unknown"])("returns 404 for unknown path %s", async (path) => {
    const url = new URL(`http://localhost/api/v1/admin/${path}`);
    const response = adminMethodResponse(new Request(url), url.pathname);
    expect(response.status).toBe(404);
    expect(response.headers.get("Allow")).toBeNull();
    expect(await response.json()).toEqual({ success: false, message: "Not found" });
  });
});
