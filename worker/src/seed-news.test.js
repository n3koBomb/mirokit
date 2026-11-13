import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { MIRoKIT_NEWS } from "../../site/source/scripts/news-data.js";

describe("shared static news module", () => {
  it("keeps localized fallback content available to browsers and the seed", () => {
    expect(MIRoKIT_NEWS.length).toBeGreaterThan(0);
    expect(new Set(MIRoKIT_NEWS.map((item) => item.id)).size).toBe(MIRoKIT_NEWS.length);
    for (const item of MIRoKIT_NEWS) for (const language of ["ru", "en", "de"]) {
      expect(item.title[language]).toBeTruthy();
      expect(item.summary[language]).toBeTruthy();
      expect(item.content[language].length).toBeGreaterThan(0);
    }
  });
  it("prepares the seed from the imported module in dry-run mode without a database", () => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/seed-news.mjs", import.meta.url)), "--dry-run"], {
      cwd: fileURLToPath(new URL("../../", import.meta.url)), encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(`Prepared ${MIRoKIT_NEWS.length * 4} SQL statements for ${MIRoKIT_NEWS.length} news items.`);
  });
});
