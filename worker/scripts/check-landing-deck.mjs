// Optional UI regression check. Requires playwright-core and a local Edge binary;
// override MIROKIT_PLAYWRIGHT_MODULE / MIROKIT_BROWSER_PATH for other installations.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MIRoKIT_NEWS } from "../../site/source/scripts/news-data.js";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.MIROKIT_PLAYWRIGHT_MODULE || "playwright-core");
const root = path.resolve(fileURLToPath(new URL("../../site/", import.meta.url)));
const output = fileURLToPath(new URL("../.wrangler/landing-browser-check/", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
let news = structuredClone(MIRoKIT_NEWS);
news[0].linkUrl = "/public/example.pdf";
for (const lang of ["de", "en", "ru"]) news[0].summary[lang] += ` {Zusatzinfo ${lang}\\nZweite Zeile\n\n**Hinweis** mit _Betonung_ und [Link](https://example.org/details).\n\n![Logo](/public/assets/brand/miroKit_logo_full-1.png "MIRoKIT")}`;
let failNews = false;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/v1/news" && !failNews) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ news }));
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end('{"error":"Offline browser fixture"}');
      return;
    }
    const target = path.resolve(root, `.${decodeURIComponent(url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname)}`);
    if (!target.startsWith(root + path.sep)) throw new Error("Invalid path");
    const body = await readFile(target);
    res.writeHead(200, { "Content-Type": `${types[path.extname(target)] || "application/octet-stream"}; charset=utf-8` });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const errors = [];
const checks = [];
try {
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.MIROKIT_BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--disable-gpu"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  context.setDefaultTimeout(10000);
  await context.route(/https:\/\//, (route) => route.abort());
  if (process.env.MIROKIT_BROWSER_FONTS === "1") await context.route(/^https:\/\/(?:fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)\//, (route) => route.continue());
  await context.addInitScript(() => {
    localStorage.setItem("mirokitLang", "de");
    localStorage.setItem("mirokitTheme", "light");
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install({ time: new Date("2026-11-13T12:00:00Z") });
  const deck = page.locator(".landing-deck");
  const rotator = page.locator("[data-news-rotator]");
  const active = () => page.locator("[data-news-slide]:not([hidden])");
  const current = () => page.locator("[data-news-current]").textContent();
  const progress = () => page.locator("[data-news-rotate-target].is-active").evaluate((el) => Number(el.style.getPropertyValue("--news-progress")));
  async function load() {
    await page.goto(origin);
    // Finish the unrelated intro with the same controlled clock before UI/timer checks.
    await page.waitForFunction(() => !document.getElementById("introLoader") || document.getElementById("introLoader").classList.contains("is-started"));
    await page.clock.runFor(5600);
    await deck.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    const first = page.locator('[data-news-rotate-target="0"]');
    if (await first.count()) await first.evaluate((button) => button.click());
    await page.clock.runFor(50);
    await active().waitFor();
  }
  await load();
  await page.locator(".news-extra").waitFor({ state: "attached" });

  // Keep the same story during geometry checks; autoplay is exercised after reload.
  await page.keyboard.press("Tab");
  await active().locator(".news-read-link").focus();

  // Real translations and both theme palettes must survive narrow layouts.
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1100 });
    for (const language of ["de", "ru", "en"]) {
      await page.evaluate((lang) => setLang(lang), language);
      for (const dark of [false, true]) {
        await page.evaluate((value) => document.body.classList.toggle("theme-dark", value), dark);
        await active().scrollIntoViewIfNeeded();
        await active().locator(".news-slide-media img").evaluate(img => img.decode());
        const geometry = await deck.evaluate((el) => {
          const slide = el.querySelector("[data-news-slide]:not([hidden])");
          const title = slide.querySelector(".news-title");
          const media = slide.querySelector(".news-slide-media");
          const image = media.querySelector("img");
          const content = slide.querySelector(".news-slide-content");
          const logos = [...el.querySelectorAll(".partner-block")];
          const badge = slide.querySelector(".news-image-eyebrow");
          const date = slide.querySelector("time");
          return {
            overflow: el.scrollWidth > el.clientWidth + 1,
            clippedTitle: getComputedStyle(title).overflow !== "visible" && title.scrollHeight > title.clientHeight + 1,
            titleClamp: getComputedStyle(title).webkitLineClamp,
            imageFit: getComputedStyle(media.querySelector("img")).objectFit,
            imageFillsFrame: Math.abs(media.getBoundingClientRect().height - image.getBoundingClientRect().height) < 1,
            inset: parseFloat(getComputedStyle(el).paddingInlineStart),
            columns: getComputedStyle(el.querySelector(".partner-group")).gridTemplateColumns.split(" ").filter((track) => parseFloat(track) > 0).length,
            mediaWidth: media.offsetWidth,
            mediaHeight: media.offsetHeight,
            stacked: content.getBoundingClientRect().top >= media.getBoundingClientRect().bottom - 1,
            logosUnframed: logos.every((logo) => getComputedStyle(logo).borderTopWidth === "0px"),
            categoryInMeta: badge.parentElement.classList.contains("news-card-meta"),
            categoryAligned: Math.abs((badge.getBoundingClientRect().top + badge.getBoundingClientRect().height / 2) - (date.getBoundingClientRect().top + date.getBoundingClientRect().height / 2)) < 2,
          };
        });
        assert.equal(geometry.overflow, false, `${width}/${language}/${dark}: overflow`);
        assert.equal(geometry.clippedTitle, false, `${width}/${language}/${dark}: title clipping ${JSON.stringify(geometry)}`);
        assert.equal(geometry.titleClamp, "none");
        assert.equal(geometry.imageFit, "contain");
        assert.equal(geometry.imageFillsFrame, true, `${width}/${language}/${dark}: empty image bands`);
        assert(geometry.inset >= 16, `${width}/${language}/${dark}: missing inner spacing`);
        assert(geometry.columns >= 1 && geometry.columns <= 8);
        assert.equal(geometry.stacked, width <= 1000, `${width}/${language}/${dark}: ${JSON.stringify(geometry)}`);
        assert.equal(geometry.logosUnframed, true);
        assert.equal(geometry.categoryInMeta, true);
        if (width >= 768) assert.equal(geometry.categoryAligned, true);
      }
    }
  }
  checks.push("320–1920 px: full titles, contained posters, wrapping logo columns, DE/RU/EN, light/dark");

  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() => { setLang("de"); document.body.classList.remove("theme-dark"); });
  await page.locator('[data-news-rotate-target="0"]').click();
  const screenshotStyle = ".topbar, .fixed-footer, .scroll-top-control { visibility: hidden !important; }";
  await deck.screenshot({ path: path.join(output, "desktop-light.png"), style: screenshotStyle });
  await page.evaluate(() => document.body.classList.add("theme-dark"));
  await deck.screenshot({ path: path.join(output, "desktop-dark.png"), style: screenshotStyle });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.body.classList.remove("theme-dark"));
  await deck.screenshot({ path: path.join(output, "mobile-light.png"), style: screenshotStyle });
  await page.evaluate(() => document.body.classList.add("theme-dark"));
  await deck.screenshot({ path: path.join(output, "mobile-dark.png"), style: screenshotStyle });

  await page.setViewportSize({ width: 1440, height: 1100 });
  await load();
  const extra = () => active().locator(".news-extra");
  for (const width of [320, 390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.clock.runFor(50);
    const content = active().locator(".news-slide-content");
    const before = await content.evaluate((el) => el.offsetTop);
    await extra().locator("summary").click();
    assert.equal(await content.evaluate((el) => el.offsetTop), before, `Opening extra info keeps the preview position at ${width}px`);
    const mediaBox = await active().locator(".news-slide-media").boundingBox();
    const triggerBox = await extra().locator("summary").boundingBox();
    assert(triggerBox.x >= mediaBox.x && triggerBox.x + triggerBox.width <= mediaBox.x + mediaBox.width, "Extra trigger stays over the image");
    const panel = await extra().locator(".news-extra-panel").boundingBox();
    const contentBox = await content.boundingBox();
    assert(panel.y >= Math.max(mediaBox.y + mediaBox.height, contentBox.y + contentBox.height), "Extra panel opens below image and preview");
    assert.equal(await extra().locator("strong").filter({ hasText: "Hinweis" }).count(), 1);
    assert.equal(await extra().locator('a[href="https://example.org/details"]').count(), 1);
    const graphic = extra().locator(".nw-image--graphic img");
    await graphic.evaluate(async (img) => { img.loading = "eager"; await img.decode(); });
    assert((await graphic.boundingBox()).width <= 300, "Extra-info logos stay compact");
    if (width === 1440) await deck.screenshot({ path: path.join(output, "desktop-open-extra.png"), style: screenshotStyle });
    await extra().locator("summary").click();
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await extra().locator("summary").focus();
  const originalUrl = page.url();
  await page.keyboard.press("Enter");
  assert.equal(await extra().evaluate((el) => el.open), true);
  assert.equal(page.url(), originalUrl);
  assert.match(await extra().locator(".news-extra-text").textContent(), /Zusatzinfo de\nZweite Zeile/);
  const extraProgress = await progress();
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement.blur());
  await page.clock.runFor(15000);
  assert.equal(await current(), "01");
  assert.equal(await progress(), extraProgress, "Open information pauses even without hover/focus");
  await page.evaluate(() => setLang("ru"));
  assert.equal(await extra().evaluate((el) => el.open), true);
  assert.match(await extra().locator(".news-extra-text").textContent(), /Zusatzinfo ru/);
  await extra().locator("summary").focus();
  await page.keyboard.press("Escape");
  assert.equal(await extra().evaluate((el) => el.open), false);
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await extra().locator("summary").evaluate((el) => getComputedStyle(el, "::before").animationName), "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => setLang("de"));
  await page.locator('[data-news-step="1"]').click();
  assert.equal(await active().locator(".news-extra").count(), 0);
  checks.push("Stable preview when extras open at 320–1920 px, image-bound trigger, category/date alignment, keyboard disclosure, rotation pause, language switch");

  await page.setViewportSize({ width: 1440, height: 1100 });
  await load();
  await page.clock.runFor(2000);
  assert.equal(await current(), "01");
  const beforeHover = await progress();
  assert(beforeHover > 0.25 && beforeHover < 0.4);
  await active().hover();
  const pausedProgress = await progress();
  await page.clock.runFor(9000);
  assert.equal(await current(), "01");
  assert.equal(await progress(), pausedProgress);
  await page.keyboard.press("Tab");
  await active().locator(".news-read-link").focus();
  await page.mouse.move(0, 0);
  await page.clock.runFor(9000);
  assert.equal(await current(), "01", "Focus keeps rotation paused after mouse leaves");
  await page.evaluate(() => document.activeElement.blur());
  await page.clock.runFor(9000);
  assert.equal(await progress(), pausedProgress, "Focus stop persists after leaving");
  await page.clock.runFor(Math.floor((1 - pausedProgress) * 6500) - 100);
  assert.equal(await current(), "01", "Resume keeps the remaining time");
  await page.clock.runFor(150);
  assert.equal(await current(), "02");
  assert(await progress() < 0.05);
  checks.push("6500 ms cadence and synchronized progress; overlapping hover/focus pause preserves remaining time");

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const beforeHidden = await progress();
  await page.clock.runFor(15000);
  assert.equal(await current(), "02");
  assert.equal(await progress(), beforeHidden);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(6500);
  assert.equal(await current(), "03");
  await page.clock.runFor(6500);
  assert.equal(await current(), "01");
  checks.push("Hidden tab pauses; last item wraps to first");

  await page.locator('[data-news-rotate-target="2"]').click();
  assert.equal(await current(), "03");
  assert(await progress() < .01, "Manual selection starts at the beginning");
  await page.locator('[data-news-step="1"]').click();
  assert.equal(await current(), "01");
  await page.locator('[data-news-step="-1"]').focus();
  await page.keyboard.press("Enter");
  assert.equal(await current(), "03");
  assert.equal(await progress(), 0, "Keyboard/manual navigation resets progress");
  assert.match(await active().locator(".news-read-link").getAttribute("href"), /^\/news\/[a-z0-9-]+\/\?lang=de$/);
  assert.equal(await active().locator(".news-read-link").evaluate((el) => el.tagName), "A");
  assert.equal(await page.locator("#newsModal").count(), 0);
  checks.push("Clickable progress, wraparound arrows, keyboard navigation, permanent article links");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await load();
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement.blur());
  const reducedIndex = await current();
  await page.clock.runFor(20000);
  assert.equal(await current(), reducedIndex);
  assert.equal(await page.locator("[data-news-remaining]").isVisible(), false);
  await page.locator('[data-news-step="1"]').click();
  assert.notEqual(await current(), reducedIndex);
  checks.push("Reduced motion disables autoplay; manual navigation remains available");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  news = [structuredClone(MIRoKIT_NEWS[0])];
  news[0].title.de = "Sehr langer deutscher Beitragstitel ".repeat(12);
  news[0].title.ru = "Очень длинный русский заголовок ".repeat(12);
  news[0].linkUrl = "/public/example.pdf";
  await load();
  assert.equal(await page.locator(".news-rotator-controls").count(), 0);
  assert.equal(await rotator.locator(".news-more-info-link").getAttribute("href"), "/public/example.pdf");
  for (const language of ["de", "ru"]) {
    await page.evaluate((lang) => setLang(lang), language);
    await page.setViewportSize({ width: 320, height: 844 });
    assert.equal(await deck.evaluate((el) => el.scrollWidth > el.clientWidth + 1), false);
    assert.equal(await active().locator(".news-title").evaluate((el) => getComputedStyle(el).overflow !== "visible" && el.scrollHeight > el.clientHeight + 1), false);
  }
  await page.clock.runFor(15000);
  assert.equal(await active().count(), 1);
  checks.push("Single item has no timer/navigation; long DE/RU titles and optional PDF link");

  news[0].image = "/public/missing.png";
  await load();
  await active().locator(".news-slide-media .nw-image-fallback:visible").waitFor();

  news = [];
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelector("[data-news-rotator]")?.textContent.includes("In dieser Kategorie"));
  assert.equal(await page.locator(".news-rotator-controls").count(), 0);
  failNews = true;
  await load();
  assert.equal(await page.locator("[data-news-slide]").count(), 3);
  checks.push("Empty API response and bundled fallback on API failure");
  assert.deepEqual(errors, [], "Browser JavaScript errors");
  console.log(JSON.stringify({ browser: "Chromium / Edge", checks, screenshots: output, errors }, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
