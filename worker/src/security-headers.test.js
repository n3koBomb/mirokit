import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import worker from "./index.js";
import { CSP_REPORT_ONLY } from "./security-headers.js";

describe("shared content security policy", () => {
  const directives = new Map(CSP_REPORT_ONLY.split("; ").map((directive) => {
    const [name, ...sources] = directive.split(" ");
    return [name, sources];
  }));

  it("denies plugins and restricts document and form origins", () => {
    expect(directives.get("default-src")).toEqual(["'self'"]);
    expect(directives.get("object-src")).toEqual(["'none'"]);
    for (const name of ["base-uri", "form-action", "frame-ancestors"]) {
      expect(directives.get(name)).toEqual(["'self'"]);
    }
  });

  it("allows required integrations without permitting inline or evaluated scripts", () => {
    expect(directives.get("script-src")).toEqual(["'self'", "https://challenges.cloudflare.com", "https://cdn.jsdelivr.net"]);
    expect(directives.get("frame-src")).toEqual(["https://challenges.cloudflare.com", "https://www.youtube.com", "https://www.youtube-nocookie.com"]);
    expect(directives.get("img-src")).toContain("blob:");
    expect(directives.get("media-src")).toContain("blob:");
  });

  it("matches the static asset header policy", () => {
    const headers = readFileSync(new URL("../../site/_headers", import.meta.url), "utf8");
    expect(headers.match(/Content-Security-Policy-Report-Only: (.+)/)[1]).toBe(CSP_REPORT_ONLY);
  });

  it.each(["/", "/admin/"])("attaches the policy in report-only mode to %s", async (path) => {
    const response = await worker.fetch(new Request(`http://localhost${path}`), {
      ASSETS: { fetch: async () => new Response("page", { headers: { "Content-Type": "text/html" } }) },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Security-Policy-Report-Only")).toBe(CSP_REPORT_ONLY);
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
