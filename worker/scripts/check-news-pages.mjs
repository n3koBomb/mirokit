// Optional local browser check; uses the real Worker and in-memory news fixtures.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../src/index.js";
import { MIRoKIT_NEWS } from "../../site/source/scripts/news-data.js";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.MIROKIT_PLAYWRIGHT_MODULE || "playwright-core");
const root = path.resolve(fileURLToPath(new URL("../../site/", import.meta.url)));
const output = fileURLToPath(new URL("../.wrangler/news-browser-check/", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const news = structuredClone(MIRoKIT_NEWS);
news[0].linkUrl = "/public/rules.pdf";
for (const lang of ["de", "en", "ru"]) {
  const labels = { de: ["Veranstaltungsdatum", "Ort"], en: ["Event date", "Location"], ru: ["Дата мероприятия", "Место"] }[lang];
  news[0].content[lang].push("## Test section", `${labels[0]}: 20.12.2026`, `${labels[1]}: Düsseldorf, Deutschland`, "Anmeldung: [Zum Anmeldeformular](https://example.org/register)", "![Extra image](/public/assets/media/photos/events/example.png)");
  news[0].content[lang].push("### Test details", "Text with **strong words**, _emphasis_ and an [inline link](https://example.org/story).", "*Literal stars* and __Literal underscores__", "- First point", "- Second point", "1. First step\n2. Second step", '![Small illustration](/public/test-article-small.svg "Photo: MIRoKIT")');
  news[0].summary[lang] += ` {Extra ${lang}\\nSecond line}`;
}
let mode = "normal";
async function assets(request) {
  const url = new URL(request.url);
  if (url.pathname === "/public/test-article-small.svg") return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160"><rect width="240" height="160" fill="#d7e7ff"/><circle cx="120" cy="80" r="50" fill="#1565ff"/></svg>', { headers: { "Content-Type": "image/svg+xml" } });
  const imageFixtures = {
    "/public/test-article-photo.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#cddfff"/><circle cx="600" cy="400" r="260" fill="#1565ff"/></svg>',
    "/public/test-article-logo.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#fff"/><circle cx="450" cy="300" r="230" fill="#1565ff"/></svg>',
    "/public/test-article-transparent.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><rect x="400" y="450" width="200" height="100" fill="#1565ff"/></svg>',
  };
  if (imageFixtures[url.pathname]) return new Response(imageFixtures[url.pathname], { headers: { "Content-Type": "image/svg+xml" } });
  const target = path.resolve(root, `.${decodeURIComponent(url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname)}`);
  if (!target.startsWith(root + path.sep)) return new Response("Not found", { status: 404 });
  try { return new Response(await readFile(target), { headers: { "Content-Type": `${types[path.extname(target)] || "application/octet-stream"}; charset=utf-8` } }); }
  catch { return new Response("Not found", { status: 404 }); }
}
const env = { ASSETS: { fetch: assets }, SITE_DB: { prepare() { return { bind() { return { all: async () => {
  if (mode === "error") throw new Error("Fixture failure");
  return { results: (mode === "empty" ? [] : news).flatMap((item) => ["de", "en", "ru"].map((language) => ({ id: item.id, published_at: item.publishedAt, category: item.category, accent: item.accent, image_url: mode === "images" ? "/public/missing.png" : item.image, link_url: item.linkUrl || "", featured: item.featured || null, language, title: item.title[language], summary: item.summary[language], alt: item.alt[language], content_json: JSON.stringify(item.content[language]) }))) };
} }; } }; } } };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let response;
    if (url.pathname === "/api/v1/news") {
      response = mode === "error" ? Response.json({ error: "Fixture unavailable" }, { status: 503 }) : Response.json({ news: mode === "empty" ? [] : news.map((item) => mode === "images" ? { ...item, image: "/public/missing.png" } : item) });
    } else if (url.pathname.startsWith("/api/")) response = Response.json({ error: "Offline fixture" }, { status: 503 });
    else response = await worker.fetch(new Request(url, { method: req.method }), env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { console.error(error); res.writeHead(500); res.end("Fixture error"); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const errors = [], checks = [];
let browser;
try {
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.MIROKIT_BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--disable-gpu"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  context.setDefaultTimeout(12000);
  await context.route(/https:\/\//, (route) => route.abort());
  if (process.env.MIROKIT_BROWSER_FONTS === "1") await context.route(/^https:\/\/(?:fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)\//, (route) => route.continue());
  let mapLookups = 0, mapMode = "normal";
  await context.route(/^https:\/\/photon\.komoot\.io\/api\//, (route) => {
    mapLookups++;
    assert.equal(new URL(route.request().url()).searchParams.get("q"), "Düsseldorf, Deutschland");
    const headers = { "Access-Control-Allow-Origin": "*" };
    return mapMode === "error" ? route.fulfill({ status: 503, headers, json: {} }) : route.fulfill({ headers, json: { features: [{ geometry: { type: "Point", coordinates: [6.77, 51.23] } }] } });
  });
  await context.route(/^https:\/\/www\.openstreetmap\.org\/export\/embed\.html/, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body>Local map test fixture</body></html>" }));
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  async function archive(query = "?lang=de") {
    const response = await page.goto(`${origin}/news/${query}`);
    assert.equal(response.status(), 200);
    await page.waitForFunction(() => document.getElementById("newsGrid")?.getAttribute("aria-busy") === "false");
  }
  await archive();
  const archiveCategoryStyle = await page.locator("#newsFeatured .news-category-badge").evaluate((el) => ({ background: getComputedStyle(el).backgroundColor, font: getComputedStyle(el).font }));
  if (process.env.MIROKIT_BROWSER_FONTS === "1") {
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.fonts.check('800 16px "Montserrat"') && document.fonts.check('400 16px "Rubik"')), true);
  }
  assert.equal(await page.locator("#newsFeatured .nw-card").count(), 1);
  assert.equal(await page.locator("#newsGrid .nw-card").count(), 5);
  assert.equal(await page.locator("#newsFilters [data-filter]").count(), 5);
  assert.equal(await page.locator("dialog").count(), 0);
  for (const width of [320, 390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const lang of ["de", "en", "ru"]) {
      await page.selectOption("[data-lang-select]", lang);
      for (const dark of [false, true]) {
        await page.evaluate((value) => document.body.classList.toggle("theme-dark", value), dark);
        assert.equal(await page.locator(".nw-main").evaluate((el) => el.scrollWidth > el.clientWidth + 1), false, `Archive ${width}/${lang}/${dark}: overflow`);
        assert.equal(await page.locator(".nw-card h2").first().evaluate((el) => getComputedStyle(el).webkitLineClamp), "none");
      }
    }
  }
  checks.push("Magazine lead/grid, real categories, 320–1920 px, DE/EN/RU, light/dark");
  await page.setViewportSize({ width: 768, height: 700 });
  await archive("?lang=de&category=event&sort=featured&q=MIRoKIT");
  await page.locator("#newsFeatured img").evaluate((img) => img.decode());
  assert.equal(await page.locator('[data-filter="event"]').getAttribute("aria-pressed"), "true");
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: "instant" }));
  const previousY = await page.evaluate(() => window.scrollY);
  assert(previousY > 100, "Archive must scroll as a normal document");
  const href = await page.locator("#newsFeatured a.nw-card-link").getAttribute("href");
  await page.locator("#newsFeatured a.nw-card-link").click();
  await page.waitForURL(/\/news\/online-drawing-competition\//);
  assert.deepEqual(await page.locator(".nw-article-head .news-category-badge").evaluate((el) => ({ background: getComputedStyle(el).backgroundColor, font: getComputedStyle(el).font })), archiveCategoryStyle);
  assert.equal(await page.locator("#newsModal, #newsViewer, dialog").count(), 0);
  assert.equal(await page.locator(".nw-information").count(), 1);
  assert.equal(await page.locator('.nw-download').getAttribute("href"), "/public/rules.pdf");
  assert.equal(await page.locator('.nw-event-details').count(), 0);
  assert.equal(await page.locator('.nw-reading a[href="https://example.org/register"]').textContent(), "Zum Anmeldeformular");
  assert.equal(await page.locator('.nw-reading > h2').first().textContent(), "Test section");
  assert.equal(await page.locator(".nw-event-facts dd").first().textContent(), "20.12.2026");
  assert.equal(mapLookups, 0, "No external location lookup before the visitor requests a map");
  assert.equal(await page.locator(".nw-map-stage iframe").count(), 0);
  await page.locator(".nw-map-load").focus();
  await page.keyboard.press("Enter");
  await page.locator(".nw-map-stage iframe").waitFor();
  assert.equal(mapLookups, 1);
  assert.equal(new URL(await page.locator(".nw-map-stage iframe").getAttribute("src")).searchParams.get("marker"), "51.23,6.77");
  assert.match(await page.locator(".nw-map-link").getAttribute("href"), /#map=16\/51.23\/6.77/);
  assert.equal(await page.locator(".nw-map-close").isVisible(), true);
  assert.equal(await page.locator(".nw-place-link").getAttribute("aria-expanded"), "true");
  await page.locator(".nw-map-close").focus();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".nw-map-stage iframe").count(), 0);
  assert.equal(await page.locator(".nw-map-load").evaluate((el) => el === document.activeElement), true);
  await page.locator(".nw-place-link").click();
  await page.locator(".nw-map-stage iframe").waitFor();
  assert.equal(mapLookups, 1, "Clicking the place reuses the existing map coordinates");
  await page.selectOption("[data-lang-select]", "en");
  mapMode = "error";
  await page.locator(".nw-map-load").click();
  await page.waitForFunction(() => document.querySelector(".nw-map-status")?.textContent.includes("unavailable"));
  assert.equal(await page.locator(".nw-map-load").isEnabled(), true);
  assert.equal(await page.locator(".nw-map-link").isVisible(), true);
  mapMode = "normal";
  await page.locator(".nw-map-load").click();
  await page.locator(".nw-map-stage iframe").waitFor();
  const lookupCount = mapLookups;
  await page.selectOption("[data-lang-select]", "de");
  await page.locator(".nw-map-load").click();
  await page.locator(".nw-map-stage iframe").waitFor();
  assert.equal(mapLookups, lookupCount, "Reuse successful location lookup after changing language back");
  checks.push("Event date and place, map loads only on click, correct coordinates, lookup errors/retry/cache and map links");
  await page.reload();
  assert.match(await page.title(), /Online-Zeichenwettbewerb/);
  assert.equal(await page.locator(".nw-reading p").count() > 2, true);
  const extra = page.locator(".nw-reading > .news-extra");
  assert.equal(await extra.count(), 1);
  await extra.locator("summary").focus();
  await page.keyboard.press("Enter");
  assert.equal(await extra.evaluate((el) => el.open), true);
  assert.equal(await extra.locator(".news-extra-text").textContent(), "Extra de\nSecond line");
  await page.selectOption("[data-lang-select]", "ru");
  assert.equal(await extra.evaluate((el) => el.open), true);
  assert.equal(await extra.locator(".news-extra-text").textContent(), "Extra ru\nSecond line");
  await extra.locator("summary").focus();
  await page.keyboard.press("Escape");
  assert.equal(await extra.evaluate((el) => el.open), false);
  await page.goBack();
  await page.waitForFunction(() => document.getElementById("newsGrid")?.getAttribute("aria-busy") === "false");
  assert.equal(await page.locator("#newsSearch").inputValue(), "MIRoKIT");
  assert.equal(await page.locator("#newsSort").inputValue(), "featured");
  assert.equal(await page.locator('[data-filter="event"]').getAttribute("aria-pressed"), "true");
  await page.waitForFunction((y) => Math.abs(window.scrollY - y) < 30, previousY).catch(async (error) => {
    console.log("Scroll diagnostic", { previousY, current: await page.evaluate(() => ({ y: scrollY, height: document.documentElement.scrollHeight, url: location.href, state: history.state, stored: Object.entries(sessionStorage) })) });
    throw error;
  });
  checks.push("Real article links, direct load/reload, downloads, ordinary text links, back restores query/filter/sort/scroll");

  const newTab = await context.newPage();
  await newTab.goto(`${origin}${href}`);
  assert.equal(await newTab.locator("h1").count(), 1);
  await newTab.close();
  await page.goto(`${origin}${href}`);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const lang of ["de", "en", "ru"]) {
      await page.selectOption("[data-lang-select]", lang);
      for (const dark of [false, true]) {
        await page.evaluate((value) => document.body.classList.toggle("theme-dark", value), dark);
        assert.equal(await page.locator(".nw-main").evaluate((el) => el.scrollWidth > el.clientWidth + 1), false, `Article ${width}/${lang}/${dark}: overflow`);
        assert.match(await page.locator('link[rel="canonical"]').getAttribute("href"), new RegExp(`lang=${lang}`));
        assert.equal(await page.locator(".nw-reading").evaluate((el) => el.clientWidth <= 760), true);
        const alignment = await page.evaluate(() => [".nw-breadcrumbs", ".nw-article-head", ".nw-reading"].map((selector) => document.querySelector(selector).getBoundingClientRect().left));
        assert(Math.max(...alignment) - Math.min(...alignment) < 1, "Breadcrumb, heading and prose share one left edge");
        const dimensions = await page.locator('.nw-body-image img[src="/public/test-article-small.svg"]').evaluate(async (img) => { img.loading = "eager"; await img.decode(); return { width: img.width, height: img.height }; });
        assert(dimensions.width <= 240, "Small images must not be upscaled");
        assert(Math.abs(dimensions.width / dimensions.height - 1.5) < .02, "Inline images retain their aspect ratio");
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.selectOption("[data-lang-select]", "de");
  if (!await page.locator("body").evaluate((el) => el.classList.contains("theme-dark"))) await page.locator("[data-theme-toggle]").click();
  await page.evaluate(async () => { const images = [...document.querySelectorAll(".nw-media img")]; images.forEach((img) => { img.loading = "eager"; }); await Promise.allSettled(images.map((img) => img.decode())); });
  await page.screenshot({ path: path.join(output, "article-desktop-dark.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(output, "article-mobile-dark.png"), fullPage: true });
  checks.push("Article reading column, responsive text/images, localized URLs/metadata, separate tab");

  await page.setViewportSize({ width: 1440, height: 1000 });
  const inlineLink = page.locator('a[href="https://example.org/story"]').first();
  await inlineLink.hover();
  await page.locator(".nw-link-preview:not([hidden])").waitFor();
  assert.equal(await page.locator(".nw-preview-title").textContent(), "inline link");
  assert.match(await page.locator(".nw-preview-target").textContent(), /example.org\/story/);
  await page.locator(".nw-link-preview").hover();
  await page.waitForTimeout(300);
  assert.equal(await page.locator(".nw-link-preview").isVisible(), true, "Preview stays open while hovered");
  await inlineLink.focus();
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(".nw-preview-close").evaluate((el) => el === document.activeElement), true);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".nw-link-preview").isVisible(), false);
  assert.equal(await inlineLink.evaluate((el) => el === document.activeElement), true);
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(".nw-reading h3").first().textContent(), "Test details");
  assert.equal(await page.locator(".nw-reading p > strong").first().textContent(), "strong words");
  assert.equal(await page.locator(".nw-reading p > em").first().textContent(), "emphasis");
  const literalParagraph = page.locator(".nw-reading p").filter({ hasText: "*Literal stars* and __Literal underscores__" });
  assert.equal(await literalParagraph.count(), 1);
  assert.equal(await literalParagraph.locator("strong, em").count(), 0);
  assert.equal(await page.locator(".nw-reading > ul > li").count(), 2);
  assert.equal(await page.locator(".nw-reading > ol > li").count(), 2);
  assert.equal(await page.locator("figcaption").textContent(), "Photo: MIRoKIT");
  const illustration = page.locator('.nw-body-image .nw-image-open').last();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const link of [illustration, page.locator(".nw-article-image .nw-image-open")]) {
      await link.click();
      const dialog = page.locator(".nw-image-dialog[open]");
      await dialog.waitFor();
      await dialog.locator("img").evaluate((img) => img.decode());
      const box = await dialog.boundingBox();
      assert(Math.abs(box.x + box.width / 2 - width / 2) < 2, `Image dialog horizontally centered at ${width}px`);
      assert(Math.abs(box.y + box.height / 2 - 844 / 2) < 2, `Image dialog vertically centered at ${width}px`);
      if (width === 390 || width === 1440) await page.screenshot({ path: path.join(output, `image-dialog-${width}.png`) });
      await page.keyboard.press("Escape");
      assert.equal(await page.locator(".nw-image-dialog[open]").count(), 0);
      assert.equal(await link.evaluate((el) => el === document.activeElement), true);
    }
  }
  checks.push("Rich prose/headings/lists/captions, no small-image upscaling, keyboard/hover previews, image enlargement and Escape/focus return");

  const savedRich = structuredClone(news[0]);
  const relatedItem = await page.evaluate(() => JSON.parse(document.getElementById("newsArticleData").textContent).related[0]);
  for (const lang of ["de", "en", "ru"]) {
    news[0].summary[lang] = `Intro ${lang} {### Extra ${lang}\n\n**Important** and [details](https://example.org/extra).\n\n- One\n- Two\n\n![Logo](/public/test-article-transparent.svg "Extra image")\n\nOrt: This stays ordinary extra text.}`;
    news[0].content[lang].push(`[Related story](/news/${relatedItem.id}/?lang=${lang})`);
  }
  await page.goto(`${origin}/news/${news[0].id}/?lang=de`);
  await page.locator(".news-extra summary").click();
  assert.equal(await page.locator(".news-extra-panel h3").textContent(), "Extra de");
  assert.equal(await page.locator(".news-extra-panel li").count(), 2);
  assert.equal(await page.locator(".news-extra-panel .nw-event-facts").count(), 0);
  const relatedLink = page.locator('.nw-reading p a').filter({ hasText: "Related story" });
  await relatedLink.focus();
  await page.locator(".nw-link-preview:not([hidden])").waitFor();
  assert.equal(await page.locator(".nw-preview-title").textContent(), relatedItem.title.de);
  assert.equal(await page.locator(".nw-link-preview p").textContent(), relatedItem.summary.de);
  await page.locator(".nw-link-preview").screenshot({ path: path.join(output, "article-link-preview.png") });
  await page.keyboard.press("Escape");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const extraLink = page.locator('.news-extra-panel a[href="https://example.org/extra"]');
    await page.locator(".news-extra summary").focus();
    await extraLink.focus();
    await page.locator(".nw-link-preview:not([hidden])").waitFor();
    const previewBox = await page.locator(".nw-link-preview").boundingBox();
    assert(previewBox.x >= 0 && previewBox.x + previewBox.width <= width, "Link preview fits the viewport");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".news-extra").evaluate((el) => el.open), true, "Escape dismisses the preview before its parent disclosure");
    await page.locator(".nw-place-link").click();
    await page.locator(".nw-map-stage iframe").waitFor();
    const mapBox = await page.locator(".nw-map-stage iframe").boundingBox();
    assert(mapBox.height >= 280 && mapBox.width <= width, "Map is readable on mobile/tablet/desktop");
    await page.locator(".nw-map-close").click();
  }
  await page.setViewportSize({ width: 768, height: 1000 });
  if (await page.locator("body").evaluate((el) => el.classList.contains("theme-dark"))) await page.locator("[data-theme-toggle]").click();
  await page.evaluate(() => { document.activeElement?.blur(); scrollTo({ top: 0, behavior: "instant" }); });
  await page.waitForFunction(() => scrollY === 0 && getComputedStyle(document.body).backgroundColor === "rgb(238, 243, 250)").catch(async (error) => {
    console.log("Article screenshot diagnostic", await page.evaluate(() => ({ y: scrollY, background: getComputedStyle(document.body).backgroundColor, theme: document.body.className })));
    throw error;
  });
  await page.screenshot({ path: path.join(output, "article-tablet-extra-light.png"), fullPage: true });
  await page.evaluate(() => scrollTo({ top: 700, behavior: "instant" }));
  assert.match(await page.locator(".subpage-header").evaluate((el) => getComputedStyle(el).backgroundColor), /^rgb\(/, "Sticky header is opaque");
  await page.locator("[data-theme-toggle]").click();
  assert.match(await page.locator(".subpage-header").evaluate((el) => getComputedStyle(el).backgroundColor), /^rgb\(/, "Dark sticky header is opaque too");
  await page.locator("[data-theme-toggle]").click();
  await page.setViewportSize({ width: 320, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "24px"; });
  assert.equal(await page.locator(".nw-main").evaluate((el) => el.scrollWidth > el.clientWidth + 1), false, "Enlarged text reflows");
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.locator(".news-extra summary").evaluate((el) => getComputedStyle(el).transitionDuration), "0s");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  Object.assign(news[0], savedRich);
  for (const category of ["event", "interview", "photo", "announce"]) {
    const story = news.find((item) => item.category === category);
    await page.goto(`${origin}/news/${story.id}/?lang=de`);
    assert.equal(await page.locator("h1").textContent(), story.title.de);
    if (!story.summary.de.includes("{")) assert.equal(await page.locator(".news-extra").count(), 0);
    assert.equal(await page.locator(".nw-reading").evaluate((el) => el.scrollWidth > el.clientWidth + 1), false);
  }
  checks.push("All four article categories, formatted arbitrary extras, local story previews, mobile maps, reduced motion and opaque sticky navigation");

  const noScriptContext = await browser.newContext({ javaScriptEnabled: false });
  await noScriptContext.route(/https:\/\//, (route) => route.abort());
  const noScriptPage = await noScriptContext.newPage();
  await noScriptPage.goto(`${origin}${href}`);
  await noScriptPage.locator(".news-extra > summary").click();
  assert.equal(await noScriptPage.locator(".news-extra-text").isVisible(), true);
  assert.equal(await noScriptPage.locator(".news-extra-text").textContent(), "Extra de\nSecond line");
  assert.equal(await noScriptPage.locator(".nw-map-load").isVisible(), false);
  assert.equal(await noScriptPage.locator(".nw-map-link").isVisible(), true);
  await noScriptContext.close();
  checks.push("Extra information on shared/reloaded article URLs, keyboard and language updates, works without JavaScript");

  const missing = await page.goto(`${origin}/news/not-a-real-story/?lang=de`);
  assert.equal(missing.status(), 404);
  assert.match(await page.locator("h1").textContent(), /nicht gefunden/);
  mode = "images";
  await archive();
  await page.evaluate(() => document.querySelectorAll(".nw-media img").forEach((img) => { img.loading = "eager"; }));
  await page.waitForFunction(() => document.querySelectorAll(".nw-media.is-missing").length === 6);
  assert.equal(await page.locator(".nw-image-fallback:visible").count(), 6);
  mode = "empty";
  await archive();
  assert.equal(await page.locator("#newsEmpty").isVisible(), true);
  assert.equal(await page.locator("#newsFilters [data-filter]").count(), 1);
  mode = "error";
  await archive();
  assert.equal(await page.locator("#newsRetry").isVisible(), true);
  const unavailable = await page.goto(`${origin}${href}`);
  assert.equal(unavailable.status(), 503);
  mode = "normal";
  await archive();
  await page.locator("#newsSearch").fill("no-matches-unique");
  assert.equal(await page.locator("#newsEmpty").isVisible(), true);
  await page.locator("#newsClear").click();
  assert.equal(await page.locator("#newsFeatured .nw-card").count(), 1);
  await page.evaluate(async () => { const images = [...document.querySelectorAll(".nw-media img")]; images.forEach((img) => { img.loading = "eager"; }); await Promise.allSettled(images.map((img) => img.decode())); });
  await page.screenshot({ path: path.join(output, "archive-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: path.join(output, "archive-desktop.png"), fullPage: true });

  const saved = structuredClone(news[0]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [category, alt, image, role, limit] of [
    ["event", "Plakat", saved.image, "poster", 840],
    ["photo", "Photo report", "/public/test-article-photo.svg", "photo", 1040],
    ["announce", "Association logo", "/public/test-article-logo.svg", "graphic", 320],
  ]) {
    Object.assign(news[0], { category, image }); news[0].alt.de = alt;
    await page.goto(`${origin}/news/${news[0].id}/?lang=de`);
    const media = page.locator(".nw-article-image .nw-media");
    await media.locator("img").evaluate((img) => img.decode());
    assert(await media.evaluate((el, role) => el.classList.contains(`nw-image--${role}`), role));
    const box = await media.locator("img").boundingBox();
    assert(box.width <= limit, `${role} respects its size limit`);
    if (role === "photo") assert(box.width > 840, "Photos may be wider than posters");
  }
  Object.assign(news[0], structuredClone(saved));
  news[0].content.de = ["Text before the graphics.", '![Logo](/public/test-article-transparent.svg "Transparent logo")', "Text between images.", '![Additional photograph](/public/test-article-photo.svg "Article photo")'];
  await page.goto(`${origin}/news/${news[0].id}/?lang=de`);
  const transparent = page.locator('.nw-reading img[src="/public/test-article-transparent.svg"]');
  await transparent.evaluate(async (img) => { img.loading = "eager"; await img.decode(); });
  await page.locator(".nw-reading .nw-image-trimmed").waitFor();
  const croppedBox = await page.locator(".nw-reading .nw-image-trimmed").boundingBox();
  assert(croppedBox.width <= 320 && croppedBox.height < 180, "Transparent file margins do not become reading whitespace");
  const captionGap = await page.locator(".nw-body-image").first().evaluate((figure) => figure.querySelector("figcaption").getBoundingClientRect().top - figure.querySelector(".nw-media").getBoundingClientRect().bottom);
  assert(captionGap >= 4 && captionGap <= 8, "Caption stays directly below visible graphic");
  await page.locator('.nw-reading img[src="/public/test-article-photo.svg"]').evaluate(async (img) => { img.loading = "eager"; await img.decode(); });
  assert((await page.locator('.nw-reading img[src="/public/test-article-photo.svg"]').boundingBox()).width > 320, "Article photographs still use the reading column");
  await transparent.click();
  assert.equal(await page.locator(".nw-image-dialog img").getAttribute("src"), `${origin}/public/test-article-transparent.svg`);
  await page.keyboard.press("Escape");
  const relatedLinks = await page.locator(".nw-related .nw-read").evaluateAll((links) => links.map((link) => link.getBoundingClientRect().bottom));
  assert(Math.max(...relatedLinks) - Math.min(...relatedLinks) < 2, "Related news actions align at the bottom");
  const relatedIds = await page.evaluate(() => JSON.parse(document.getElementById("newsArticleData").textContent).related.map((item) => item.id));
  const savedRelated = relatedIds.map((id) => structuredClone(news.find((item) => item.id === id)));
  relatedIds.forEach((id, index) => {
    const item = news.find((entry) => entry.id === id);
    item.title.de = index === 0 ? "Eine kurze Nachricht" : "Internationale Begegnungen und gemeinsame kreative Projekte mit vielen verschiedenen Gruppen ".repeat(index);
    item.summary.de = "Ein kurzer Einblick in die Zusammenarbeit. ".repeat(index * 3 + 1);
  });
  await page.goto(`${origin}/news/${news[0].id}/?lang=de`);
  const alignedLongCards = await page.locator(".nw-related .nw-read").evaluateAll((links) => links.map((link) => link.getBoundingClientRect().bottom));
  assert(Math.max(...alignedLongCards) - Math.min(...alignedLongCards) < 2, "Different title/teaser lengths preserve bottom alignment");
  await page.evaluate(() => { document.activeElement?.blur(); scrollTo({ top: 0, behavior: "instant" }); });
  await page.screenshot({ path: path.join(output, "article-image-variants-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 320, height: 844 });
  assert.equal(await page.locator(".nw-main").evaluate((el) => el.scrollWidth > el.clientWidth + 1), false);
  for (const original of savedRelated) Object.assign(news.find((item) => item.id === original.id), original);
  const longAddress = "Ein sehr langer Name des internationalen Begegnungszentrums, Musterstraße 123, 40210 Düsseldorf, Deutschland";
  news[0].content.de = [`Ort: ${longAddress}`];
  await page.goto(`${origin}/news/${news[0].id}/?lang=de`);
  assert.equal(await page.locator(".nw-event-facts").evaluate((el) => el.scrollWidth > el.clientWidth + 1), false, "Long address and map actions fit 320px");
  assert.equal(new URL(await page.locator(".nw-map-link").getAttribute("href")).searchParams.get("query"), longAddress);
  Object.assign(news[0], saved);
  checks.push("Compact complete posters, wider cover photos, compact logos, transparent margin display trim, original enlargement, matching categories, aligned related actions");
  news[0].title.de = "Ein sehr langer deutscher Artikeltitel mit internationalen Begegnungen ".repeat(5);
  news[0].title.ru = "Очень длинный заголовок международной новости ".repeat(7);
  news[0].content.de = Array(5).fill("Ein langer Absatz mit vielen Informationen über die internationale Zusammenarbeit. ".repeat(35));
  news[0].content.ru = Array(5).fill("Длинный абзац о международном сотрудничестве и творчестве. ".repeat(35));
  await page.setViewportSize({ width: 320, height: 844 });
  for (const lang of ["de", "ru"]) {
    await page.goto(`${origin}/news/${news[0].id}/?lang=${lang}`);
    assert.equal(await page.locator(".nw-main").evaluate((el) => el.scrollWidth > el.clientWidth + 1), false);
    assert.equal(await page.locator("h1").evaluate((el) => getComputedStyle(el).webkitLineClamp), "none");
  }
  Object.assign(news[0], saved);
  checks.push("Long German/Russian titles and multi-page text at 320 px");
  checks.push("Missing articles return 404, database failures return 503, broken images, empty/filter/no-results/fallback states");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ browser: "Chromium / Edge", checks, errors, screenshots: output }, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
