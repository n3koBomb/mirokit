import { afterEach, beforeEach, describe, expect, it } from "vitest";
import worker from "./index.js";
import { normalizeNewsInput, newsToStatements } from "./news.js";
import { createDatabase, executeStatements } from "../test/helpers/database.js";
import { newsPageLanguage } from "./news-pages.js";
import { articleParts, publicNews, parseNewsSummary, newsSummary, newsExtraMarkup, newsEventMarkup, newsImageKind, newsCategoryMarkup } from "../../site/source/scripts/news-presentation.js";
import { locationMapUrls } from "../../site/page/news/location-map.js";
import { transparentImageBounds } from "../../site/page/news/article-images.js";

let database;
beforeEach(() => { database = createDatabase(); });
afterEach(() => database.close());
function input(id = "example-story", overrides = {}) {
  return { id, publishedAt: "2020-01-02", category: "event", accent: "blue", image: "/public/example.png", linkUrl: "/public/rules.pdf", featured: 1,
    translations: Object.fromEntries(["de", "en", "ru"].map((lang) => [lang, { title: `Title ${lang} <unsafe>`, summary: `Teaser ${lang}`, alt: `Image ${lang}`, content: [`Full article ${lang}`, "## Second section", "Termin: 20.12.2026", "Ort: Düsseldorf", "[Zur Anmeldung](https://example.org/register)", "![Extra image](/public/extra.png)"] }])), ...overrides };
}
function save(value, status = "published") { executeStatements(database, newsToStatements(normalizeNewsInput(value), status, "2026-01-01T12:00:00Z")); }
const env = () => ({ SITE_DB: { prepare(sql) { return { bind(...args) { return { all: async () => ({ results: database.prepare(sql).all(...args) }) }; } }; } } });
const request = (path, options) => new Request(`https://mirokit.com${path}`, options);

describe("permanent news pages", () => {
  it.each(["de", "en", "ru"])("includes translated extra information in direct %s article HTML without mixing it into the teaser", async (lang) => {
    const value = input();
    value.translations[lang].summary = `Teaser ${lang}\nsecond line {Extra ${lang}\\nSecond extra line <script>alert(1)</script>}`;
    save(value);
    const response = await worker.fetch(request(`/news/example-story/?lang=${lang}`), env());
    const html = await response.text();
    expect(html).toContain('<details class="news-extra">');
    expect(html).toContain('href="/source/style/news-extra.css"');
    expect(html).toContain(`class="news-extra-text"><p>Extra ${lang}\nSecond extra line &lt;script&gt;alert(1)&lt;/script&gt;</p>`);
    expect(html).toContain('class="news-extra-label"');
    expect(html).toContain('href="/page/news/article.css"');
    expect(html).toContain(`class="nw-lead">Teaser ${lang}\nsecond line</p>`);
    expect(html).not.toContain('<script>alert(1)</script>');
  });
  it("shares summary parsing and omits the extra button for absent or empty braces", () => {
    expect(parseNewsSummary("Intro\ncontinued {First\\nSecond\n\nThird}")).toEqual({ summary: "Intro\ncontinued", sectionExtra: "First\nSecond\n\nThird" });
    expect(newsSummary({ summary: { de: "Intro {Extra}" } }, "de")).toEqual({ teaser: "Intro", extra: "Extra" });
    expect(parseNewsSummary("Plain summary")).toEqual({ summary: "Plain summary", sectionExtra: "" });
    expect(newsExtraMarkup(parseNewsSummary("Intro {  }").sectionExtra, "de")).toBe("");
    expect(newsExtraMarkup("", "de")).toBe("");
  });
  it.each(["de", "en", "ru"])("serves full localized HTML and sharing metadata on a direct %s request", async (lang) => {
    save(input());
    const response = await worker.fetch(request(`/news/example-story/?lang=${lang}`), env());
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain(`Full article ${lang}`);
    expect(html).toContain(`Title ${lang} &lt;unsafe&gt;`);
    expect(html).toContain('<h2>Second section</h2>');
    expect(html).toContain('<p>Termin: 20.12.2026</p>');
    expect(html).toContain('class="nw-place-link"');
    expect(html).toContain('Düsseldorf</a><div class="nw-location-preview"');
    expect(html).toContain('data-news-map-address="Düsseldorf"');
    expect(html).toContain('href="https://example.org/register"');
    expect(html).toContain('href="/public/rules.pdf"');
    expect(html).toContain('src="/public/extra.png"');
    expect(html).toContain(`<link rel="canonical" href="https://mirokit.com/news/example-story/?lang=${lang}"`);
    expect(html).toContain('property="og:type" content="article"');
    expect(html).toContain('property="og:image" content="https://mirokit.com/public/example.png"');
    expect(html).toContain('"@type":"NewsArticle"');
    expect(html).not.toContain('<unsafe>');
    expect(response.headers.get("Content-Security-Policy-Report-Only")).toBeTruthy();
  });
  it("preserves Admin slug/content updates without a second article dataset", async () => {
    save(input());
    const value = input();
    value.translations.de.content = ["Updated in the existing Admin editor"];
    save(value);
    expect(await (await worker.fetch(request("/news/example-story/?lang=de"), env())).text()).toContain("Updated in the existing Admin editor");
  });
  it.each(["draft", "archived", "future", "missing", "invalid/path"])("returns a real 404 for %s and never falls back to archived bundled data", async (kind) => {
    save(input("online-drawing-competition", kind === "future" ? { publishedAt: "2999-01-01" } : {}), ["draft", "archived"].includes(kind) ? kind : "published");
    const slug = ["draft", "archived", "future"].includes(kind) ? "online-drawing-competition" : kind;
    const response = await worker.fetch(request(`/news/${slug}/?lang=de`), env());
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("Nachricht nicht gefunden");
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
  });
  it("returns 503 on database failure without resurrecting bundled content", async () => {
    const response = await worker.fetch(request("/news/online-drawing-competition/"), { SITE_DB: { prepare() { throw new Error("private database details"); } } });
    expect(response.status).toBe(503);
    const html = await response.text();
    expect(html).not.toContain("private database details");
    expect(html).not.toContain("Poster for the international");
  });
  it.each(["/news", "/page/news", "/page/news/", "/page/news/index.html", "/site/page/news", "/site/page/news/"])("redirects %s to the clean archive URL, retaining language and filters", async (path) => {
    const response = await worker.fetch(request(`${path}?lang=ru&category=event`), {});
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe("/news/?lang=ru&category=event");
  });
  it("serves /news/ from the existing archive asset and canonicalizes article trailing slashes", async () => {
    const response = await worker.fetch(request("/news/?lang=de"), { ASSETS: { fetch: async (asset) => { expect(new URL(asset.url).pathname).toBe("/page/news/"); return new Response("archive", { headers: { "Content-Type": "text/html" } }); } } });
    expect(await response.text()).toBe("archive");
    const redirect = await worker.fetch(request("/news/example-story?lang=de"), {});
    expect(redirect.headers.get("Location")).toBe("/news/example-story/?lang=de");
  });
  it("supports HEAD, rejects mutations, and keeps the bundled local development view", async () => {
    const head = await worker.fetch(request("/news/online-drawing-competition/", { method: "HEAD" }), {});
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    const post = await worker.fetch(request("/news/example/", { method: "POST" }), {});
    expect(post.status).toBe(405);
    expect(post.headers.get("Allow")).toBe("GET, HEAD");
  });
  it("selects language by explicit URL, then established host/device defaults", () => {
    expect(newsPageLanguage(new Request("http://localhost/news/a/"))).toBe("de");
    expect(newsPageLanguage(new Request("https://mirokit.ru/news/a/"))).toBe("ru");
    expect(newsPageLanguage(request("/news/a/", { headers: { "Accept-Language": "de-DE,de;q=0.9" } }))).toBe("de");
    expect(newsPageLanguage(new Request("https://mirokit.ru/news/a/?lang=en"))).toBe("en");
  });
  it("excludes drafts and UTC future dates, and escapes editor syntax instead of accepting HTML", () => {
    const item = { id: "example", publishedAt: "2020-01-01", title: { de: "Title" }, summary: { de: "Teaser" }, content: { de: ["Text"] } };
    expect(publicNews([{ ...item, status: "draft" }, { ...item, publishedAt: "2999-01-01" }])).toEqual([]);
    const parts = articleParts({ category: "event", content: { de: ["<script>alert(1)</script>", "[bad](javascript:alert)", "![bad](javascript:alert)", "Anmeldung: javascript:alert", "## <img onerror=alert(1)>"] } }, "de");
    expect(parts.body).not.toContain("<script>");
    expect(parts.body).not.toContain("<img");
    expect(parts.body).not.toContain('href="javascript:');
  });
  it.each(["event", "interview", "photo", "announce"])("renders registration text and explicit links consistently for %s", (category) => {
    const { body } = articleParts({ category, content: { de: ["Termin: 20.12.2026", "Ort: Düsseldorf", "Teilnahme: Alle Teams", "Anmeldung: https://example.org/register", "Registration: https://example.org/register", "Регистрация: https://example.org/register", "[Zur Anmeldung](https://example.org/register)"] } }, "de");
    expect(body).toContain('<p>Anmeldung: https://example.org/register</p>');
    expect(body).toContain('<p>Registration: https://example.org/register</p>');
    expect(body).toContain('<p>Регистрация: https://example.org/register</p>');
    expect(body).toContain('<p>Teilnahme: Alle Teams</p>');
    expect(body.match(/href="https:\/\/example.org\/register"/g)).toHaveLength(1);
    expect(body).not.toContain('<dl');
  });
  it.each([
    ["de", "Veranstaltungsdatum", "Ort", "Veranstaltungsdatum"],
    ["en", "Event date", "Location", "Event date"],
    ["ru", "Дата мероприятия", "Место", "Дата мероприятия"],
  ])("recognizes the two explicit date/place fields for %s without restoring registration shortcuts", (lang, dateField, locationField, dateLabel) => {
    const content = [`${dateField}: 20.12.2026, 14:00`, `${locationField}: Düsseldorf, Deutschland`, "Anmeldung: https://example.org/register", "Termin: Alter freier Text"];
    const { body, details } = articleParts({ content: { [lang]: content } }, lang);
    expect(details).toEqual({ date: "20.12.2026, 14:00", location: "Düsseldorf, Deutschland" });
    expect(body).toContain('<p>Anmeldung: https://example.org/register</p>');
    expect(body).toContain('<p>Termin: Alter freier Text</p>');
    const markup = newsEventMarkup(details, lang);
    expect(markup).toContain(`<dt>${dateLabel}</dt>`);
    expect(markup).toContain('data-news-map-address="Düsseldorf, Deutschland"');
    expect(markup).not.toContain('<iframe');
    expect(markup).not.toContain('src="https://');
  });
  it("omits absent fields/maps, preserves repeated place paragraphs and safely escapes location text", () => {
    expect(newsEventMarkup({ date: "", location: "" }, "de")).toBe("");
    expect(newsEventMarkup({ date: "Heute", location: "" }, "de")).not.toContain('nw-location-preview');
    expect(newsEventMarkup({ date: "", location: "Online" }, "de")).not.toContain('nw-location-preview');
    expect(newsEventMarkup({ date: "", location: "Онлайн / Zoom" }, "ru")).not.toContain('nw-location-preview');
    const { body, details } = articleParts({ content: { de: ["Ort: Düsseldorf", "Ort: Weiterer freier Text"] } }, "de");
    expect(details.location).toBe("Düsseldorf");
    expect(body).toContain('Ort: Weiterer freier Text');
    expect(newsEventMarkup({ date: "<script>", location: '<img src=x onerror="alert(1)">' }, "de")).not.toContain('<img src=x');
  });
  it("builds a bounded OpenStreetMap preview with the correct latitude/longitude order", () => {
    const urls = locationMapUrls([6.77, 51.23]);
    const embed = new URL(urls.embed);
    expect(embed.origin).toBe("https://www.openstreetmap.org");
    expect(embed.searchParams.get("marker")).toBe("51.23,6.77");
    const bbox = embed.searchParams.get("bbox").split(",").map(Number);
    expect(bbox[0]).toBeCloseTo(6.758);
    expect(bbox[3]).toBeCloseTo(51.238);
    expect(urls.full).toContain('#map=16/51.23/6.77');
    for (const value of [null, [], ["6.77", 51.23], [181, 20], [6, 91], [NaN, 20]]) expect(() => locationMapUrls(value)).toThrow();
  });
  it("renders rich prose, heading levels, adjacent lists and image captions without changing the content model", () => {
    const { body } = articleParts({ content: { de: [
      "Ein **wichtiger** Absatz mit _Betonung_ und [einem **Link**](https://example.org/).",
      "## Abschnitt\nText nach der Überschrift.\n### Details\nMehr Text.",
      "- Erster Punkt", "- Zweiter [Link](/news/example/)",
      "3. Schritt drei\n4. Schritt vier", "Weiterer Absatz.",
      '![Motiv](/public/example.png "Foto: **MIRoKIT**")',
    ] } }, "de");
    expect(body).toContain('<strong>wichtiger</strong>');
    expect(body).toContain('<em>Betonung</em>');
    expect(body).toContain('<a href="https://example.org/">einem <strong>Link</strong></a>');
    expect(body).toContain('<h2>Abschnitt</h2><p>Text nach der Überschrift.</p><h3>Details</h3>');
    expect(body).toContain('<ul><li>Erster Punkt</li><li>Zweiter <a href="/news/example/">Link</a></li></ul>');
    expect(body).toContain('<ol start="3"><li>Schritt drei</li><li>Schritt vier</li></ol><p>Weiterer Absatz.</p>');
    expect(body).toContain('<figcaption>Foto: <strong>MIRoKIT</strong></figcaption>');
    expect(body).toContain('class="nw-image-open"');
    expect(body).not.toContain('undefined');
  });
  it("formats arbitrary article extras without interpreting them as event fields and rejects executable markup", () => {
    const extra = newsExtraMarkup('Ort: Freier Zusatztext\n\n### Hinweis\n**Wichtig**: [Details](https://example.org/)\n- Punkt\n\n<script>alert(1)</script> [bad](javascript:alert)', "de", true);
    expect(extra).toContain('<p>Ort: Freier Zusatztext</p>');
    expect(extra).toContain('<h3>Hinweis</h3>');
    expect(extra).toContain('<strong>Wichtig</strong>');
    expect(extra).toContain('<a href="https://example.org/">Details</a>');
    expect(extra).toContain('<ul><li>Punkt</li></ul>');
    expect(extra).not.toContain('nw-event-facts');
    expect(extra).not.toContain('<script>');
    expect(extra).not.toContain('href="javascript:');
    expect(newsExtraMarkup("", "de", true)).toBe("");
  });
  it.each(["de", "en", "ru"])("uses only double asterisks for strong and single underscores for emphasis in %s", (lang) => {
    const text = "**Strong** _Emphasis_ *Literal stars* __Literal underscores__ ***Triple stars*** ___Triple underscores___";
    const expected = "<strong>Strong</strong> <em>Emphasis</em> *Literal stars* __Literal underscores__ ***Triple stars*** ___Triple underscores___";
    expect(articleParts({ content: { [lang]: [text] } }, lang).body).toBe(`<p>${expected}</p>`);
    expect(newsExtraMarkup(text, lang, true)).toContain(`<p>${expected}</p>`);
    const { body } = articleParts({ content: { [lang]: ["**_Both_** [_Link_](https://example.org/)"] } }, lang);
    expect(body).toContain("<strong><em>Both</em></strong>");
    expect(body).toContain('<a href="https://example.org/"><em>Link</em></a>');
  });
  it("uses the same UTC publication boundary in browser views and the database", () => {
    const item = { id: "example", publishedAt: "2026-11-13", title: { de: "Title" }, summary: { de: "Teaser" }, content: { de: ["Text"] } };
    expect(publicNews([item], new Date("2026-11-12T23:59:59Z"))).toHaveLength(0);
    expect(publicNews([item], new Date("2026-11-13T00:00:00Z"))).toHaveLength(1);
  });
  it("distinguishes image roles using category and description without file-specific rules", () => {
    expect(newsImageKind({ category: "event", alt: "Poster" }, "en", true)).toBe("poster");
    expect(newsImageKind({ category: "photo", alt: "Group photo" }, "en", true)).toBe("photo");
    expect(newsImageKind({ category: "event", alt: "Group photo" }, "en", true)).toBe("photo");
    expect(newsImageKind({ category: "interview", alt: "Portrait" }, "en", true)).toBe("photo");
    expect(newsImageKind({ category: "photo", alt: "Plakat" }, "de", true)).toBe("poster");
    for (const alt of ["Logo des Vereins", "Association logo", "Логотип клуба"]) expect(newsImageKind({ alt }, "de")).toBe("graphic");
    expect(newsImageKind({ alt: "Additional photograph" }, "en")).toBe("photo");
  });
  it("finds padded transparent margins and keeps opaque/empty images intact", () => {
    const pixels = new Uint8ClampedArray(100 * 100 * 4);
    expect(transparentImageBounds(pixels, 100, 100)).toBeNull();
    for (let y = 20; y < 60; y++) for (let x = 30; x < 70; x++) pixels[(y * 100 + x) * 4 + 3] = 255;
    expect(transparentImageBounds(pixels, 100, 100)).toEqual({ left: 28, top: 18, width: 44, height: 44 });
    pixels.fill(255);
    expect(transparentImageBounds(pixels, 100, 100)).toBeNull();
  });
  it("shares category accents and safe typography markup across news views", () => {
    expect(newsCategoryMarkup({ category: "photo", accent: "green" }, "de")).toContain('news-category-badge cat-green');
    expect(newsCategoryMarkup({ category: "interview" }, "en")).toContain('news-category-badge cat-red');
    expect(newsCategoryMarkup({ category: "event", accent: 'blue" onclick="alert(1)' }, "de")).not.toContain('onclick');
    const extra = newsExtraMarkup('**Hinweis**\n\n[Mehr](https://example.org/)\n\n![Grafik](/public/example.png "Bildnachweis")', "de");
    expect(extra).toContain('<strong>Hinweis</strong>');
    expect(extra).toContain('href="https://example.org/"');
    expect(extra).toContain('<figcaption>Bildnachweis</figcaption>');
    expect(extra).not.toContain('nw-event-facts');
  });
});
