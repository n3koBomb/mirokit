import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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
      for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
        if (/\bsrc\s*=/.test(match[1]) || !match[2].trim()) continue;
        const type = /\btype\s*=\s*["']([^"']+)["']/i.exec(match[1])?.[1];
        if (type && !["module", "text/javascript", "application/javascript"].includes(type)) continue;
        check(match[2], `${relative(root, path)} inline script`, type === "module");
      }
    }
  }
}
for (const directory of ["site", "worker/src", "worker/scripts", "scripts"]) walk(join(root, directory));
console.log(`Checked ${checked} JavaScript files/inline scripts.`);
process.exitCode = failed ? 1 : 0;
