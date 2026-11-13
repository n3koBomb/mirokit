import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { inlineScripts } from "../worker/scripts/inline-scripts.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
let checked = 0;
let failed = false;
function check(source, label, module = false) {
  const result = spawnSync(process.execPath, ["--check", ...(module ? ["--input-type=module"] : [])], { input: source, encoding: "utf8" });
  checked++;
  if (result.status !== 0) {
    failed = true;
    console.error(`${label}:\n${result.stderr || result.error}`);
  }
}
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || ["node_modules", ".git", ".wrangler", "public"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { walk(path); continue; }
    if (/\.(?:mjs|cjs|js)$/.test(entry.name)) check(readFileSync(path, "utf8"), relative(root, path), !entry.name.endsWith(".cjs"));
    if (entry.name.endsWith(".html")) {
      const html = readFileSync(path, "utf8");
      for (const script of inlineScripts(html)) {
        check(script.source, `${relative(root, path)}:${script.line} inline script`, script.module);
      }
    }
  }
}
for (const directory of ["site", "worker/src", "worker/scripts", "scripts"]) walk(join(root, directory));
console.log(`Checked ${checked} JavaScript files/inline scripts.`);
process.exitCode = failed ? 1 : 0;
