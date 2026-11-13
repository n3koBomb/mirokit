import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { inlineScripts } from "../scripts/inline-scripts.mjs";

describe("browser-compatible extraction of inline JavaScript", () => {
  it.each(["</script ignored>", "</script\n ignored>", "</SCRIPT data-note='x'>"])("does not bypass syntax checking with %j", (endTag) => {
    const scripts = inlineScripts(`<script>const invalid = ;${endTag}`);
    expect(scripts).toHaveLength(1);
    const result = spawnSync(process.execPath, ["--check"], { input: scripts[0].source, encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("SyntaxError");
  });
  it("handles quoted attribute delimiters, unquoted types and script-like text inside strings", () => {
    const scripts = inlineScripts(`<script data-note=">" type=module>import './module.js'; const text = '<script>'; </script>`);
    expect(scripts).toEqual([{ source: "import './module.js'; const text = '<script>'; ", module: true, line: 1 }]);
  });
  it("skips external scripts, JSON, comments, templates and scripting-enabled noscript", () => {
    const html = `<!-- <script>invalid = ;</script> -->
      <template><script>invalid = ;</script></template>
      <noscript><script>invalid = ;</script></noscript>
      <script src=external.js>invalid = ;</script><script src>invalid = ;</script>
      <script type="application/ld+json">{"name":"test"}</script>
      <script>const checked = true;</script>`;
    expect(inlineScripts(html).map((script) => script.source)).toEqual(["const checked = true;"]);
  });
  it("retains source order and distinguishes classic scripts from modules", () => {
    const scripts = inlineScripts(`<script>first();</script>\n<script type="module">second();</script>`);
    expect(scripts).toEqual([
      { source: "first();", module: false, line: 1 },
      { source: "second();", module: true, line: 2 },
    ]);
  });
});
