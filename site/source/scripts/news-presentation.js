// Shared by the public browser views and the Worker's article renderer.
export const NEWS_COPY = {
  de: {
    title: "Neues aus MIRoKIT", intro: "Begegnungen, Ideen und Geschichten aus unserer internationalen Gemeinschaft.",
    home: "Startseite", news: "Nachrichten", article: "Beitrag", all: "Alle", read: "Zum Beitrag", back: "Zur Nachrichtenübersicht",
    related: "Weitere Nachrichten", information: "Informationen und Downloads", more: "Weitere Informationen / Download",
    extraTitle: "Zusätzliche Informationen",
    eventDate: "Veranstaltungsdatum", location: "Ort", eventInformation: "Auf einen Blick",
    showMap: "Karte anzeigen", mapLoading: "Karte wird geladen …", mapError: "Die Kartenvorschau ist gerade nicht verfügbar. Du kannst den Ort über den Kartenlink öffnen.",
    mapTitle: "Karte: {place}", openMap: "In OpenStreetMap öffnen", closeMap: "Karte schließen",
    preview: "Linkvorschau", close: "Schließen", openLink: "Seite öffnen", enlargeImage: "Bild vergrößern",
    loading: "Nachrichten werden geladen …", fallback: "Die aktuellen Nachrichten konnten nicht geladen werden. Du siehst den gespeicherten Stand.",
    retry: "Erneut versuchen", empty: "Keine passenden Nachrichten gefunden.", noImage: "Bild nicht verfügbar",
    missingTitle: "Nachricht nicht gefunden", missing: "Dieser Beitrag ist nicht verfügbar oder wurde noch nicht veröffentlicht.",
    errorTitle: "Nachricht momentan nicht verfügbar", error: "Bitte versuche es später erneut.", search: "Nachrichten durchsuchen",
    categories: { event: "Veranstaltungen", interview: "Interviews", photo: "Fotoreportagen", announce: "Ankündigungen" },
  },
  en: {
    title: "News from MIRoKIT", intro: "Encounters, ideas and stories from our international community.",
    home: "Home", news: "News", article: "Article", all: "All", read: "Read the story", back: "Back to all news",
    related: "More stories", information: "Information and downloads", more: "More information / download",
    extraTitle: "Additional information",
    eventDate: "Event date", location: "Location", eventInformation: "At a glance",
    showMap: "Show map", mapLoading: "Loading map …", mapError: "The map preview is currently unavailable. You can open the location using the map link.",
    mapTitle: "Map: {place}", openMap: "Open in OpenStreetMap", closeMap: "Close map",
    preview: "Link preview", close: "Close", openLink: "Open page", enlargeImage: "Enlarge image",
    loading: "Loading news …", fallback: "The latest news could not be loaded. You are viewing the saved version.",
    retry: "Try again", empty: "No matching stories found.", noImage: "Image unavailable",
    missingTitle: "Story not found", missing: "This story is unavailable or has not been published yet.",
    errorTitle: "Story temporarily unavailable", error: "Please try again later.", search: "Search news",
    categories: { event: "Events", interview: "Interviews", photo: "Photo reports", announce: "Announcements" },
  },
  ru: {
    title: "Новости МИРоКИТ", intro: "Встречи, идеи и истории нашего международного сообщества.",
    home: "Главная", news: "Новости", article: "Статья", all: "Все", read: "Читать новость", back: "Ко всем новостям",
    related: "Другие новости", information: "Информация и материалы", more: "Подробнее / скачать",
    extraTitle: "Дополнительная информация",
    eventDate: "Дата мероприятия", location: "Место", eventInformation: "Краткая информация",
    showMap: "Показать карту", mapLoading: "Загрузка карты …", mapError: "Предпросмотр карты сейчас недоступен. Откройте место по ссылке на карту.",
    mapTitle: "Карта: {place}", openMap: "Открыть в OpenStreetMap", closeMap: "Закрыть карту",
    preview: "Предпросмотр ссылки", close: "Закрыть", openLink: "Открыть страницу", enlargeImage: "Увеличить изображение",
    loading: "Загрузка новостей …", fallback: "Не удалось загрузить свежие новости. Показана сохранённая версия.",
    retry: "Повторить", empty: "Подходящих новостей пока нет.", noImage: "Изображение недоступно",
    missingTitle: "Новость не найдена", missing: "Эта новость недоступна или ещё не опубликована.",
    errorTitle: "Новость временно недоступна", error: "Пожалуйста, попробуйте позже.", search: "Поиск новостей",
    categories: { event: "События", interview: "Интервью", photo: "Фоторепортажи", announce: "Анонсы" },
  },
};

export function escapeNews(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

export function newsText(item, field, lang) {
  const value = item?.[field];
  if (value && typeof value === "object" && !Array.isArray(value)) return value[lang] || value.en || value.ru || value.de || (field === "content" ? [] : "");
  return value || (field === "content" ? [] : "");
}

export function parseNewsSummary(value) {
  const source = String(value ?? "").trim();
  const match = source.match(/^([\s\S]*?)\s*\{([\s\S]*)\}\s*$/);
  return { summary: match ? match[1].trim() : source, sectionExtra: match ? match[2].replace(/\\n/g, "\n").trim() : "" };
}

export function newsSummary(item, lang) {
  const { summary, sectionExtra } = parseNewsSummary(newsText(item, "summary", lang));
  return { teaser: summary, extra: sectionExtra };
}

export function newsExtraMarkup(extra, lang, article = false) {
  if (!String(extra || "").trim()) return "";
  const title = escapeNews(NEWS_COPY[lang]?.extraTitle || NEWS_COPY.en.extraTitle);
  const text = articleContent(extra.split(/\n\s*\n/), lang);
  return `<details class="news-extra"><summary title="${title}"><span class="news-extra-symbol" aria-hidden="true">!</span><span class="${article ? "news-extra-label" : "sr-only"}">${title}</span>${article ? '<span class="news-extra-chevron" aria-hidden="true">⌄</span>' : ""}</summary><div class="news-extra-panel">${article ? "" : `<strong class="news-extra-title">${title}</strong>`}<div class="news-extra-text">${text}</div></div></details>`;
}

const newsExtraRoots = new WeakSet();
export function installNewsExtras(root) {
  if (!root || newsExtraRoots.has(root)) return;
  newsExtraRoots.add(root);
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const details = event.target instanceof Element ? event.target.closest(".news-extra[open]") : null;
    if (!details) return;
    event.preventDefault();
    event.stopPropagation();
    details.open = false;
    details.querySelector("summary").focus();
  });
}

export function newsHref(item, lang) {
  return `/news/${encodeURIComponent(item.id)}/?lang=${encodeURIComponent(lang)}`;
}

export function newsIndexHref(lang) { return `/news/?lang=${encodeURIComponent(lang)}`; }

export function publicNews(items, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return items.filter((item) => item && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id) && /^\d{4}-\d{2}-\d{2}$/.test(item.publishedAt)
    && item.publishedAt <= today && (!item.status || item.status === "published") && item.title && item.summary && item.content)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
}

export function newsMedia(value) {
  const source = String(value || "").trim().replace(/^(?:\.\/|\/site\/|site\/)?public\//, "/public/");
  if (/^\/(?:public|media\/v1)\//.test(source) && !source.includes("..") && !/[\\\r\n]/.test(source)) return source;
  try { const url = new URL(source); return url.protocol === "https:" ? url.href : ""; } catch { return ""; }
}

export function newsLink(value) {
  const source = String(value || "").trim();
  if (/^\/(?!\/)/.test(source) && !/[\\\r\n]/.test(source) && !source.includes("..")) return source;
  try { const url = new URL(source); return url.protocol === "https:" ? url.href : ""; } catch { return ""; }
}

export function newsDate(value, lang) {
  return new Intl.DateTimeFormat({ ru: "ru-RU", de: "de-DE", en: "en-GB" }[lang] || "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

export function newsCategory(item, lang) {
  return newsText(item, "categoryLabel", lang) || NEWS_COPY[lang].categories[item.category] || item.category;
}

export function newsCategoryMarkup(item, lang, extraClass = "") {
  const fallback = { event: "blue", photo: "green", interview: "red", announce: "violet" }[item.category] || "blue";
  const accent = ["blue", "green", "red", "amber", "violet"].includes(item.accent) ? item.accent : fallback;
  return `<span class="nw-category news-category-badge cat-${accent}${extraClass ? ` ${escapeNews(extraClass)}` : ""}" data-news-category="${escapeNews(item.category)}">${escapeNews(newsCategory(item, lang))}</span>`;
}

export function newsImageKind(item, lang, cover = false) {
  const alt = newsText(item, "alt", lang);
  if (/\b(?:logo|emblem|icon)\b|логотип|эмблем|значок/iu.test(alt)) return "graphic";
  if (!cover) return "photo";
  if (/\b(?:poster|plakat|flyer)\b|афиша|плакат/iu.test(alt)) return "poster";
  if (/\b(?:photo|photograph|foto|fotografie|portrait|porträt)\b|фото|портрет/iu.test(alt)) return "photo";
  return item.category === "photo" || item.category === "interview" ? "photo" : "poster";
}

export function newsImage(item, lang, eager = false, kind = "") {
  const source = newsMedia(item.image);
  return `<span class="nw-media${source ? "" : " is-missing"}${kind ? ` nw-image--${escapeNews(kind)}` : ""}">${source ? `<img src="${escapeNews(source)}" alt="${escapeNews(newsText(item, "alt", lang))}" loading="${eager ? "eager" : "lazy"}" decoding="async" />` : ""}<span class="nw-image-fallback"${source ? " hidden" : ""}>${escapeNews(NEWS_COPY[lang].noImage)}</span></span>`;
}

export function newsCard(item, lang, featured = false) {
  const copy = NEWS_COPY[lang];
  return `<article class="nw-card${featured ? " nw-card-featured" : ""}"><a class="nw-card-link" href="${escapeNews(newsHref(item, lang))}">${newsImage(item, lang, featured)}<div class="nw-card-body"><div class="nw-meta">${newsCategoryMarkup(item, lang)}<time datetime="${item.publishedAt}">${escapeNews(newsDate(item.publishedAt, lang))}</time></div><h2>${escapeNews(newsText(item, "title", lang))}</h2><p>${escapeNews(newsSummary(item, lang).teaser)}</p><span class="nw-read">${escapeNews(copy.read)} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></div></a></article>`;
}

function inlineText(source, depth = 0) {
  if (depth > 6) return escapeNews(source);
  const pattern = /\[([^\]\n]+)\]\(([^\s)]+)\)|(?<!\*)\*\*([^*]+)\*\*(?!\*)|(?<!_)_([^_\n]+)_(?!_)/g;
  let result = "", end = 0;
  for (const match of source.matchAll(pattern)) {
    result += escapeNews(source.slice(end, match.index));
    if (match[1]) {
      const href = newsLink(match[2]);
      result += href ? `<a href="${escapeNews(href)}">${inlineText(match[1], depth + 1)}</a>` : escapeNews(match[0]);
    } else {
      const strong = match[3];
      const tag = strong ? "strong" : "em";
      result += `<${tag}>${inlineText(strong || match[4], depth + 1)}</${tag}>`;
    }
    end = match.index + match[0].length;
  }
  return result + escapeNews(source.slice(end));
}

function articleImage(source, alt, lang, caption = "") {
  const item = { image: source, alt: { [lang]: alt } };
  return `<figure class="nw-body-image"><a class="nw-image-open" href="${escapeNews(source)}" target="_blank" rel="noopener" aria-label="${escapeNews(NEWS_COPY[lang].enlargeImage)}${alt ? `: ${escapeNews(alt)}` : ""}">${newsImage(item, lang, false, newsImageKind(item, lang))}</a>${caption ? `<figcaption>${inlineText(caption)}</figcaption>` : ""}</figure>`;
}

// Markdown-lite keeps the existing string-array contract. No editor HTML is trusted.
function articleContent(content, lang) {
  const blocks = [];
  let paragraph = [], list = null;
  const flushParagraph = () => { if (paragraph.length) blocks.push(`<p>${inlineText(paragraph.join("\n"))}</p>`); paragraph = []; };
  const flushList = () => {
    if (list) blocks.push(`<${list.tag}${list.start !== 1 && list.tag === "ol" ? ` start="${list.start}"` : ""}>${list.items.map((text) => `<li>${inlineText(text)}</li>`).join("")}</${list.tag}>`);
    list = null;
  };
  for (const value of content) {
    if (typeof value !== "string") continue;
    // Adjacent array items are separate paragraphs, but consecutive list items join.
    flushParagraph();
    for (const raw of value.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) { flushParagraph(); flushList(); continue; }
      const heading = line.match(/^(#{2,3})\s+(.+)$/);
      const image = line.match(/^!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)$/);
      const bullet = line.match(/^(?:[-+*]\s+(.+)|(\d{1,6})[.)]\s+(.+))$/);
      if (bullet) {
        flushParagraph();
        const tag = bullet[1] ? "ul" : "ol";
        if (list && list.tag !== tag) flushList();
        list ||= { tag, start: Number(bullet[2] || 1), items: [] };
        list.items.push(bullet[1] || bullet[3]);
      } else {
        flushList();
        if (heading || (image && newsMedia(image[2]))) {
          flushParagraph();
          blocks.push(heading ? `<h${heading[1].length}>${inlineText(heading[2])}</h${heading[1].length}>` : articleImage(newsMedia(image[2]), image[1], lang, image[3]));
        } else paragraph.push(line);
      }
    }
  }
  flushParagraph(); flushList();
  return blocks.join("");
}

export function articleParts(item, lang) {
  const body = [];
  const details = { date: "", location: "" };
  const fields = { veranstaltungsdatum: "date", "event date": "date", "дата мероприятия": "date", ort: "location", location: "location", "место": "location" };
  const content = newsText(item, "content", lang);
  for (const value of Array.isArray(content) ? content : []) {
    if (typeof value !== "string") continue;
    const line = value.trim();
    const match = line.match(/^([^:]+):\s*(.+)$/);
    const field = match && Object.hasOwn(fields, match[1].trim().toLowerCase()) ? fields[match[1].trim().toLowerCase()] : "";
    if (field && !details[field]) { details[field] = match[2].trim(); continue; }
    body.push(line);
  }
  return { body: articleContent(body, lang), details };
}

export function newsEventMarkup(details, lang) {
  if (!details.date && !details.location) return "";
  const copy = NEWS_COPY[lang];
  const mapLocation = details.location && details.location.length <= 300 && !/^(?:online|онлайн|virtuell|virtual)(?:$|[\s/()–—-])/iu.test(details.location) ? details.location : "";
  const mapUrl = new URL("https://www.openstreetmap.org/search");
  mapUrl.searchParams.set("query", mapLocation);
  const preview = mapLocation ? `<div class="nw-location-preview" data-news-map-address="${escapeNews(mapLocation)}" data-news-map-lang="${lang}"><div class="nw-map-actions"><button type="button" class="nw-map-load" aria-expanded="false" aria-controls="newsLocationMap" hidden><i class="fa-solid fa-map-location-dot" aria-hidden="true"></i> ${escapeNews(copy.showMap)}</button><a class="nw-map-link" href="${escapeNews(mapUrl.href)}" target="_blank" rel="noopener noreferrer">${escapeNews(copy.openMap)} <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a></div><p class="nw-map-status" role="status" hidden></p><div class="nw-map-stage" id="newsLocationMap" hidden><button type="button" class="nw-map-close">${escapeNews(copy.closeMap)} <span aria-hidden="true">×</span></button><div class="nw-map-frame"></div></div></div>` : "";
  return `<section class="nw-event-facts" aria-labelledby="newsEventTitle"><h2 id="newsEventTitle">${escapeNews(copy.eventInformation)}</h2><dl>${details.date ? `<div><dt>${escapeNews(copy.eventDate)}</dt><dd>${escapeNews(details.date)}</dd></div>` : ""}${details.location ? `<div><dt>${escapeNews(copy.location)}</dt><dd>${mapLocation ? `<a class="nw-place-link" href="${escapeNews(mapUrl.href)}" target="_blank" rel="noopener noreferrer" data-news-map-open><i class="fa-solid fa-location-dot" aria-hidden="true"></i>${escapeNews(details.location)}</a>` : escapeNews(details.location)}${preview}</dd></div>` : ""}</dl></section>`;
}

export function articleMarkup(item, related, lang) {
  const copy = NEWS_COPY[lang], { teaser, extra } = newsSummary(item, lang), { body, details } = articleParts(item, lang);
  const link = newsLink(item.linkUrl);
  return `<nav class="nw-breadcrumbs" aria-label="${escapeNews(copy.article)}"><a href="/">${escapeNews(copy.home)}</a><span aria-hidden="true">/</span><a href="${newsIndexHref(lang)}">${escapeNews(copy.news)}</a><span aria-hidden="true">/</span><span>${escapeNews(copy.article)}</span></nav>
    <article class="nw-article"><header class="nw-article-head">${newsCategoryMarkup(item, lang)}<h1>${escapeNews(newsText(item, "title", lang))}</h1><time datetime="${item.publishedAt}">${escapeNews(newsDate(item.publishedAt, lang))}</time>${teaser ? `<p class="nw-lead">${inlineText(teaser)}</p>` : ""}</header><div class="nw-article-image">${newsMedia(item.image) ? `<a class="nw-image-open" href="${escapeNews(newsMedia(item.image))}" target="_blank" rel="noopener" aria-label="${escapeNews([copy.enlargeImage, newsText(item, "alt", lang)].filter(Boolean).join(": "))}">${newsImage(item, lang, true, newsImageKind(item, lang, true))}</a>` : newsImage(item, lang, true)}</div><div class="nw-reading">${newsExtraMarkup(extra, lang, true)}${newsEventMarkup(details, lang)}${body}${link ? `<aside class="nw-information" aria-labelledby="newsInfoTitle"><h2 id="newsInfoTitle">${escapeNews(copy.information)}</h2><a class="nw-download" href="${escapeNews(link)}"><i class="fa-solid fa-file-arrow-down" aria-hidden="true"></i><span>${escapeNews(copy.more)}</span><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a></aside>` : ""}</div></article>
    ${related.length ? `<section class="nw-related" aria-labelledby="newsRelatedTitle"><h2 id="newsRelatedTitle">${escapeNews(copy.related)}</h2><div class="nw-grid">${related.map((entry) => newsCard(entry, lang)).join("")}</div></section>` : ""}<a class="nw-back" href="${newsIndexHref(lang)}"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> ${escapeNews(copy.back)}</a>`;
}

export function installNewsImageFallback(root = document) {
  root.querySelectorAll(".nw-media img").forEach((img) => {
    const failed = () => { img.hidden = true; img.parentElement.classList.add("is-missing"); img.parentElement.querySelector(".nw-image-fallback").hidden = false; };
    img.addEventListener("error", failed, { once: true });
    if (img.complete && !img.naturalWidth) failed();
  });
}
