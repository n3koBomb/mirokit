import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import worker from "../src/index.js";
process.chdir(fileURLToPath(new URL("../../", import.meta.url)));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.MIROKIT_PLAYWRIGHT_MODULE || "playwright-core");
const axePath = process.env.MIROKIT_AXE_SCRIPT || require.resolve("axe-core/axe.min.js");
const root = path.resolve("site");
const objects = new Map();
let version = 0;
const object = (key, entry, range) => ({ key, ...entry, size: entry.bytes.length, httpEtag: `"${entry.etag}"`, body: range ? entry.bytes.slice(range.offset, range.offset + range.length) : entry.bytes, writeHttpMetadata(headers) { headers.set("Content-Type", entry.httpMetadata.contentType); } });
const env = { ADMIN_DEV_TOKEN: "browser-test", SITE_MEDIA: {
  async put(key, value, options = {}) { if (options.onlyIf && options.onlyIf.etagMatches !== objects.get(key)?.etag) return null; const entry = { bytes: new Uint8Array(await new Response(value).arrayBuffer()), ...options, etag: String(++version) }; objects.set(key, entry); return object(key, entry); },
  async get(key, options) { const entry = objects.get(key); return entry ? object(key, entry, options?.range) : null; },
  async head(key) { const entry = objects.get(key); return entry ? object(key, entry) : null; },
  async delete(key) { objects.delete(key); },
  async list({ prefix, cursor, limit = 100 }) { const entries = [...objects.entries()].filter(([key]) => key.startsWith(prefix)); const start = Number(cursor || 0); return { objects: entries.slice(start, start + limit).map(([key, entry]) => object(key, entry)), truncated: start + limit < entries.length, cursor: String(start + limit) }; }
} };
const photoBytes = new Uint8Array(await readFile(path.join(root, "public/assets/media/photos/events/example.png")));
for (let i = 0; i < 2; i++) await env.SITE_MEDIA.put(`gallery/${crypto.randomUUID()}.png`, photoBytes, { httpMetadata: { contentType: "image/png" }, customMetadata: { collection: "online-projects", status: "published", topic: i ? "photo" : "drawing", uploaded_at: "2026-10-02T10:00:00Z", title_ru: "Фото", title_en: "Photo", title_de: "Beispielfoto", alt_ru: "Фото", alt_en: "Photo", alt_de: "Teilnehmende bei MIRoKIT" } });
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".wasm": "application/wasm", ".bcmap": "application/octet-stream", ".ttf": "font/ttf", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost:4173");
    let response;
    if (url.pathname.includes("/online-projects/media") || url.pathname === "/api/v1/gallery" || url.pathname === "/api/v1/admin/gallery" || url.pathname.startsWith("/api/v1/admin/media/") || url.pathname.startsWith("/media/v1/")) {
      const parts = []; for await (const part of req) parts.push(part);
      response = await worker.fetch(new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(parts) }), env);
    } else if (url.pathname.startsWith("/api/")) response = Response.json({ success: true, gallery: [0, 1].map((i) => ({ key: `gallery/${i}.png`, collection: "online-projects", status: "published", topic: i ? "photo" : "drawing", image: "/public/assets/media/photos/events/example.png", title: { ru: "Фото", en: "Photo", de: "Beispielfoto" }, alt: { ru: "Фото", en: "Photo", de: "Teilnehmende bei MIRoKIT" } })), folders: [], quotes: [], news: [], videos: [], projects: [], partners: [], points: [], materials: [] });
    else {
      const target = path.resolve(root, `.${decodeURIComponent(url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname)}`);
      if (!target.startsWith(root + path.sep)) throw new Error("invalid path");
      response = new Response(await readFile(target), { headers: { "Content-Type": types[path.extname(target)] || "application/octet-stream" } });
    }
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { res.writeHead(404); res.end(String(error)); }
});
await new Promise((resolve) => server.listen(4173, "127.0.0.1", resolve));

function makePdf() {
  let source = "%PDF-1.4\n";
  const offsets = [0];
  const stream = "BT /F1 24 Tf 50 750 Td (MIRoKIT PDF preview) Tj ET";
  const entries = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  entries.forEach((entry, index) => { offsets.push(Buffer.byteLength(source)); source += `${index + 1} 0 obj\n${entry}\nendobj\n`; });
  const xref = Buffer.byteLength(source);
  source += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => String(offset).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(source);
}

let browser;
const errors = [];
const checks = [];
const axeResults = [];
async function audit(page, label) {
  await page.addScriptTag({ content: await readFile(axePath, "utf8") });
  const result = await page.evaluate(() => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }));
  const violations = result.violations.map((issue) => ({ id: issue.id, impact: issue.impact, nodes: issue.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) }));
  axeResults.push({ label, violations });
  console.log("AXE", label, JSON.stringify(violations));
}
try {
  const edgePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  const executablePath = process.env.MIROKIT_BROWSER_PATH || (existsSync(edgePath) ? edgePath : undefined);
  browser = await chromium.launch({ executablePath, headless: true, args: ["--disable-gpu"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  context.setDefaultTimeout(15000);
  context.setDefaultNavigationTimeout(20000);
  await context.route(/https:\/\//, (route) => route.abort());
  await context.addInitScript(() => sessionStorage.setItem("mirokitAdminToken", "browser-test"));
  const page = await context.newPage();
  page.on("pageerror", (error) => { errors.push(error.message); console.log("Page error:", error.message); });
  await page.goto("http://localhost:4173/admin/");
  await page.locator("#onlineProjectsTab").click();
  assert.equal(await page.locator("#quickGuide").getAttribute("open"), null);
  assert.equal(await page.locator(".rail-link").count(), 0);
  await page.locator('[data-online-media="document"]').click();
  assert.equal(await page.locator("#galleryForm").isVisible(), false);
  await page.locator("#onlineMediaTopic").selectOption("drawing");
  await page.locator("#onlineMediaFile").setInputFiles({ name: "test.pdf", mimeType: "application/pdf", buffer: makePdf() });
  await page.waitForFunction(() => document.getElementById("onlineMediaFileName").textContent.includes("Vorschau bereit"));
  assert.equal(await page.locator("#onlineMediaPreviewImage").evaluate((image) => image.naturalWidth > 0), true);
  await page.locator("#onlineMediaTitleRu").fill("Тестовый документ");
  await page.locator("#saveOnlineMedia").click();
  assert.equal(await page.locator("#onlineMediaTitleEn").evaluate((input) => input.closest("details").open), true);
  assert.equal(await page.locator("#onlineMediaTitleEn").getAttribute("aria-invalid"), "true");
  assert.equal(await page.locator("#onlineMediaTitleEn").evaluate((field) => document.activeElement === field), true);
  await page.locator("#onlineMediaTitleEn").fill("Test document");
  await page.locator("#onlineMediaTitleDe").fill("Testdokument");
  await page.locator("#onlineMediaDescriptionDe").fill("Beschreibung der PDF");
  await page.locator("#saveOnlineMedia").click();
  await page.waitForFunction(() => document.getElementById("onlineMediaStatus").textContent === "Entwurf");
  assert.equal((await (await context.request.get("http://localhost:4173/api/v1/online-projects/media")).json()).media.length, 0);
  checks.push("PDF first-page thumbnail, closed-language validation and private draft upload");
  await page.locator("#publishOnlineMedia").click();
  await page.waitForFunction(() => document.getElementById("onlineMediaStatus").textContent === "Veröffentlicht");
  const publicItems = (await (await context.request.get("http://localhost:4173/api/v1/online-projects/media")).json()).media;
  assert.equal(publicItems.length, 1);
  assert.equal((await context.request.get(`http://localhost:4173${publicItems[0].url}`)).headers()["content-type"], "application/pdf");
  await mkdir("docs/screenshots", { recursive: true });
  await page.locator(".admin-toast-close").click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: "docs/screenshots/online-project-admin-desktop.png", fullPage: true, animations: "disabled", timeout: 45000 });
  await audit(page, "Admin light desktop");
  const publicPage = await context.newPage();
  await publicPage.emulateMedia({ reducedMotion: "reduce" });
  publicPage.on("pageerror", (error) => { errors.push(error.message); console.log("Public page error:", error.message); });
  await publicPage.goto("http://localhost:4173/page/onlineProjects/?media=documents&topic=drawing&lang=de");
  await publicPage.locator(".online-project-document img").waitFor();
  assert.equal(await publicPage.locator(".online-project-document a").getAttribute("target"), "_blank");
  assert.equal(await publicPage.locator(".online-project-document h3").textContent(), "Testdokument");
  await publicPage.locator("#onlineProjectTopicSelect").selectOption("poetry");
  assert.equal(await publicPage.locator(".online-project-document").count(), 0);
  await publicPage.goBack();
  await publicPage.locator(".online-project-document").waitFor();
  await publicPage.locator("[data-lang-select]").selectOption("en");
  assert.equal(await publicPage.locator(".online-project-document h3").textContent(), "Test document");
  await publicPage.locator("[data-lang-select]").selectOption("de");
  await publicPage.screenshot({ path: "docs/screenshots/online-project-documents-desktop.png", fullPage: true, animations: "disabled", timeout: 45000 });
  await audit(publicPage, "Documents light desktop");
  checks.push("Public PDF thumbnail, _blank link, topic filter, history and language switching");
  const popupPromise = publicPage.waitForEvent("popup");
  await publicPage.locator(".online-project-document a").click();
  const popup = await popupPromise;
  await popup.waitForURL((url) => url.href !== "about:blank");
  assert.ok(popup.url().includes(publicItems[0].url) || popup.url().startsWith("chrome-extension://"));
  await popup.close();
  await publicPage.locator('[data-media="photos"]').click();
  assert.equal(await publicPage.locator(".online-project-photo").count(), 1);
  await publicPage.locator('[data-topic="all"]').click();
  assert.equal(await publicPage.locator(".online-project-photo").count(), 2);
  await publicPage.locator("[data-photo-index='0']").click();
  assert.equal(await publicPage.locator("#onlineProjectPhotoModal").evaluate((dialog) => dialog.open), true);
  await publicPage.keyboard.press("ArrowRight");
  assert.equal(await publicPage.locator("#onlineProjectModalCount").textContent(), "2 / 2");
  await publicPage.keyboard.press("Escape");
  assert.equal(await publicPage.locator("[data-photo-index='0']").evaluate((button) => document.activeElement === button), true);
  await publicPage.locator('[data-media="documents"]').click();
  checks.push("PDF opens in a separate tab; original photo filters, modal arrows, Escape and focus return");
  await page.locator('[data-online-media="video"]').click();
  const videoBytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 180;
    const ctx = canvas.getContext("2d"); const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks = []; recorder.ondataavailable = (event) => chunks.push(event.data);
    const done = new Promise((resolve) => recorder.onstop = resolve);
    recorder.start();
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? "#1758b6" : "#173b68"; ctx.fillRect(0, 0, 320, 180); await new Promise((resolve) => setTimeout(resolve, 100)); }
    recorder.stop(); await done; stream.getTracks().forEach((track) => track.stop());
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
  await page.locator("#onlineMediaTopic").selectOption("drawing");
  await page.locator("#onlineMediaFile").setInputFiles({ name: "test.webm", mimeType: "video/webm", buffer: Buffer.from(videoBytes) });
  await page.locator("#onlineMediaTitleRu").fill("Видео");
  await page.locator("#onlineMediaTitleEn").evaluate((field) => field.closest("details").open = true);
  await page.locator("#onlineMediaTitleEn").fill("Video");
  await page.locator("#onlineMediaTitleDe").evaluate((field) => field.closest("details").open = true);
  await page.locator("#onlineMediaTitleDe").fill("Testvideo");
  await page.locator("#onlineMediaTranscriptDe").fill("Text zum Video");
  await page.locator("#publishOnlineMedia").click();
  await page.waitForFunction(() => document.getElementById("onlineMediaStatus").textContent === "Veröffentlicht");
  await publicPage.locator('[data-media="videos"]').click();
  await publicPage.reload();
  await publicPage.locator(".online-project-video video").waitFor();
  await publicPage.locator(".online-project-video video").evaluate(async (video) => { await video.play(); });
  await publicPage.locator(".online-project-transcript summary").click();
  await audit(publicPage, "Videos desktop");
  assert.equal(await publicPage.locator(".online-project-transcript p").textContent(), "Text zum Video");
  await publicPage.locator('[data-media="documents"]').click();
  assert.equal(await publicPage.locator("video").count(), 0);
  checks.push("Video upload, authenticated preview, playback and localized transcript");
  await page.locator('[data-online-media="document"]').click();
  await page.locator("[data-online-edit]").click();
  await page.locator("#archiveOnlineMedia").click();
  await page.locator("#deleteConfirmation").fill("DELETE");
  await page.locator("#confirmDelete").click();
  await page.waitForFunction(() => document.getElementById("notice").textContent.includes("Inhalt archiviert"));
  assert.equal((await context.request.get(`http://localhost:4173${publicItems[0].url}`)).status(), 404);
  await page.locator("#onlineMediaStatusFilter").selectOption("archived");
  await page.locator("[data-online-edit]").click();
  await page.locator("#publishOnlineMedia").click();
  await page.waitForFunction(() => document.getElementById("onlineMediaStatus").textContent === "Veröffentlicht");
  checks.push("Archive confirmation, direct-file revocation and republishing");
  for (const mode of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: mode, reducedMotion: "reduce" });
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `admin overflow at ${width} ${mode}`);
    }
  }
  await page.locator(".admin-toast-close").click();
  await page.bringToFront();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: "docs/screenshots/online-project-admin-mobile-dark.png", fullPage: false, animations: "disabled", timeout: 45000 });
  await audit(page, "Admin dark mobile");
  await publicPage.locator('[data-media="documents"]').click();
  await publicPage.reload();
  for (const width of [1440, 768, 390, 320]) {
    await publicPage.setViewportSize({ width, height: 900 });
    assert.equal(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `public overflow at ${width}`);
  }
  await publicPage.bringToFront();
  await publicPage.screenshot({ path: "docs/screenshots/online-project-documents-mobile.png", fullPage: true, animations: "disabled", timeout: 45000 });
  await publicPage.locator("[data-theme-toggle]").click();
  await audit(publicPage, "Documents dark mobile");
  await publicPage.locator("[data-theme-toggle]").click();
  await page.emulateMedia({ forcedColors: "active" });
  assert.equal(await page.locator('[data-online-media="document"]').evaluate((button) => getComputedStyle(button).outlineStyle), "solid");
  checks.push("Responsive layout at 1440/768/390/320px, dark mode, reduced motion and forced colors");
  await page.emulateMedia({ colorScheme: "light", forcedColors: "none" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => document.documentElement.style.fontSize = "32px");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.evaluate(() => document.documentElement.style.fontSize = "16px");
  await publicPage.evaluate(() => document.documentElement.style.fontSize = "32px");
  assert.equal(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await publicPage.evaluate(() => document.documentElement.style.fontSize = "16px");
  checks.push("200% text-size layout without horizontal page overflow");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#galleryTab").click();
  assert.equal(await page.locator("#galleryForm").isVisible(), true);
  assert.equal(await page.locator("#galleryList").isVisible(), true);
  assert.equal(await page.locator("#onlineAdminMediaNav").isVisible(), false);
  assert.equal(await page.locator("#galleryTopic").isDisabled(), true);
  await page.locator("#newsTab").click();
  await page.locator("#newsId").fill("browser-validation");
  await page.locator("#image").fill("/public/assets/media/photos/events/example.png");
  await page.locator("#editor-title-ru-192").fill("Заголовок");
  await page.locator("#editor-alt-ru-191").fill("Описание");
  await page.locator("#editor-summary-ru-193").fill("Кратко");
  await page.locator("#editor-content-ru-194").fill("Текст");
  await page.locator("#publishNews").click();
  assert.equal(await page.locator("#editor-title-en-196").evaluate((field) => field.closest("details").open), true);
  assert.equal(await page.locator("#editor-title-en-196").getAttribute("aria-invalid"), "true");
  const skipLink = page.locator(".skip-link");
  await skipLink.focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#mainContent").evaluate((main) => document.activeElement === main), true);
  await page.locator("#newsTab").focus();
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.locator("#galleryTab").evaluate((tab) => document.activeElement === tab), true);
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#galleryForm").isVisible(), true);
  checks.push("Existing news validation opens closed languages; skip link and keyboard navigation");
  const duplicateIds = await page.evaluate(() => { const ids = [...document.querySelectorAll("[id]")].map((el) => el.id); return ids.filter((id, i) => ids.indexOf(id) !== i); });
  assert.deepEqual(duplicateIds, []);
  checks.push("Existing gallery navigation and DOM ID integrity");
  await page.locator("#onlineProjectsTab").click();
  await page.locator('[data-online-media="photos"]').click();
  await page.locator("#galleryTopic").selectOption("drawing");
  await page.locator("#galleryFile").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: Buffer.from(photoBytes) });
  await page.locator("#onlinePhotoTitleRu").fill("Новая работа");
  await page.locator("#onlinePhotoTitleEn").evaluate((field) => field.closest("details").open = true);
  await page.locator("#onlinePhotoTitleEn").fill("New work");
  await page.locator("#onlinePhotoTitleDe").evaluate((field) => field.closest("details").open = true);
  await page.locator("#onlinePhotoTitleDe").fill("Neue Arbeit");
  await page.locator("#onlinePhotoAltDe").fill("MIRoKIT bei einer Veranstaltung");
  await page.locator("#galleryPublishButton").click();
  await page.waitForFunction(() => document.getElementById("notice").textContent.includes("Bild veröffentlicht"));
  const gallery = (await (await context.request.get("http://localhost:4173/api/v1/gallery?collection=online-projects")).json()).gallery;
  assert.ok(gallery.some((item) => item.title.de === "Neue Arbeit" && item.alt.de === "MIRoKIT bei einer Veranstaltung"));
  checks.push("Photo upload preserves RU/EN/DE captions through the existing gallery API");
  assert.deepEqual(errors, []);
  assert.ok(axeResults.every((result) => result.violations.length === 0));
  console.log(JSON.stringify({ checks, errors, axeResults }, null, 2));
} finally { await browser?.close(); server.close(); }
