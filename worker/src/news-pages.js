import { MIRoKIT_NEWS } from "../../site/source/scripts/news-data.js";
import { NEWS_COPY, articleMarkup, escapeNews, newsText, newsSummary, newsMedia, publicNews } from "../../site/source/scripts/news-presentation.js";
import { NEWS_PUBLIC_QUERY, rowsToNews } from "./news.js";
import { getCanonicalSiteHostname } from "./hosts.js";

export function newsPageLanguage(request) {
  const url = new URL(request.url), requested = url.searchParams.get("lang");
  if (Object.hasOwn(NEWS_COPY, requested)) return requested;
  if (url.hostname.endsWith(".ru")) return "ru";
  if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return "de";
  return /^de\b/i.test(request.headers.get("Accept-Language") || "") ? "de" : "en";
}

export function newsCanonical(url, lang) {
  const host = getCanonicalSiteHostname(url.hostname);
  return `${host ? `https://${host}` : url.origin}${url.pathname}?lang=${lang}`;
}

function jsonScript(value) { return JSON.stringify(value).replaceAll("<", "\\u003c"); }

function pageShell({ url, lang, item, related = [], status = 200 }) {
  const copy = NEWS_COPY[lang];
  const title = item ? newsText(item, "title", lang) : status === 404 ? copy.missingTitle : copy.errorTitle;
  const description = item ? newsSummary(item, lang).teaser : status === 404 ? copy.missing : copy.error;
  const canonical = newsCanonical(url, lang), image = item && newsMedia(item.image);
  const absoluteImage = image ? new URL(image, canonical).href : "";
  const body = item ? articleMarkup(item, related, lang) : `<section class="nw-message"><p class="nw-kicker">${status}</p><h1>${escapeNews(title)}</h1><p>${escapeNews(description)}</p><a class="nw-back" href="/news/?lang=${lang}">${escapeNews(copy.back)}</a></section>`;
  return `<!DOCTYPE html><html lang="${lang}"><head>
    <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeNews(title)} — MIRoKIT</title><meta name="description" content="${escapeNews(description)}" />
    <link rel="canonical" href="${escapeNews(canonical)}" />
    ${Object.keys(NEWS_COPY).map((language) => `<link rel="alternate" hreflang="${language}" href="${escapeNews(newsCanonical(url, language))}" />`).join("")}
    <meta property="og:type" content="${item ? "article" : "website"}" /><meta property="og:title" content="${escapeNews(title)}" />
    <meta property="og:description" content="${escapeNews(description)}" /><meta property="og:url" content="${escapeNews(canonical)}" />
    <meta property="og:locale" content="${{ de: "de_DE", en: "en_GB", ru: "ru_RU" }[lang]}" />
    ${image ? `<meta property="og:image" content="${escapeNews(absoluteImage)}" /><meta property="og:image:alt" content="${escapeNews(newsText(item, "alt", lang))}" />` : ""}
    <meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />
    <meta name="twitter:title" content="${escapeNews(title)}" /><meta name="twitter:description" content="${escapeNews(description)}" />
    ${image ? `<meta name="twitter:image" content="${escapeNews(absoluteImage)}" />` : ""}
    ${item ? `<meta property="article:published_time" content="${item.publishedAt}T00:00:00Z" /><script type="application/ld+json">${jsonScript({ "@context": "https://schema.org", "@type": "NewsArticle", headline: title, description, datePublished: `${item.publishedAt}T00:00:00Z`, inLanguage: lang, mainEntityOfPage: canonical, ...(image ? { image: [absoluteImage] } : {}), publisher: { "@type": "Organization", name: "MIRoKIT" } })}</script>` : '<meta name="robots" content="noindex, follow" />'}
    <link rel="icon" href="/public/favicon/favicon.ico" />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Rubik:wght@400;500;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" />
    <link rel="stylesheet" href="/source/style/style.css" /><link rel="stylesheet" href="/source/style/subpage.css" /><link rel="stylesheet" href="/page/news/news.css" /><link rel="stylesheet" href="/source/style/news-extra.css" /><link rel="stylesheet" href="/page/news/article.css" /><link rel="stylesheet" href="/source/style/news-shared.css" />
  </head><body class="news-page news-article-page">
    <a class="nw-skip" href="#newsArticle">${escapeNews(copy.article)}</a>
    <header class="subpage-header"><a class="subpage-brand" href="/" aria-label="MIRoKIT"><img src="/public/assets/brand/miroKit_logo_full-1.png" alt="MIRoKIT" width="144" height="48" /></a><a class="subpage-home" href="/news/?lang=${lang}" data-news-index>${escapeNews(copy.news)}</a><div class="subpage-actions"><button class="subpage-theme" type="button" data-theme-toggle aria-pressed="false"><span aria-hidden="true">◐</span><span class="theme-toggle-label" data-key="theme_dark">Dark</span></button><select class="subpage-lang" data-lang-select aria-label="Language" data-i18n-attrs="aria-label:language_selector"><option value="de">DE</option><option value="en">EN</option><option value="ru">RU</option></select></div></header>
    <main class="nw-main" id="newsArticle" tabindex="-1">${body}</main>
    <script type="application/json" id="newsArticleData">${jsonScript({ item, related, status, lang })}</script>
    <script src="/source/scripts/language.js"></script><script src="/source/scripts/subpage.js"></script><script type="module" src="/page/news/article.js"></script>
  </body></html>`;
}

export async function handleNewsPage(request, env) {
  const url = new URL(request.url);
  const legacy = /^\/(?:site\/)?page\/news(?:\/index\.html|\/)?$/.test(url.pathname);
  if (!legacy && url.pathname !== "/news" && !url.pathname.startsWith("/news/")) return null;
  if (!["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  if (legacy || url.pathname === "/news" || /^\/news\/[a-z0-9-]+$/.test(url.pathname)) {
    const target = legacy ? "/news/" : `${url.pathname}/`;
    return new Response(null, { status: 301, headers: { Location: `${target}${url.search}` } });
  }
  if (url.pathname === "/news/") {
    const asset = new URL("/page/news/", url);
    asset.search = url.search;
    const assetRequest = new Request(asset, request);
    assetRequest.headers.delete("If-None-Match");
    assetRequest.headers.delete("If-Modified-Since");
    const response = await env.ASSETS.fetch(assetRequest);
    if (response.status !== 200 || request.method === "HEAD" || !response.headers.get("Content-Type")?.includes("text/html")) return response;
    const lang = newsPageLanguage(request), copy = NEWS_COPY[lang], canonical = newsCanonical(url, lang);
    const html = (await response.text())
      .replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
      .replace(/<title>[^<]*<\/title>/, `<title>${escapeNews(copy.title)} — MIRoKIT</title>`)
      .replace(/(<meta name="description" content=")[^"]*("\s*\/?>)/, `$1${escapeNews(copy.intro)}$2`)
      .replace(/(<link rel="canonical" href=")[^"]*("\s*\/?>)/, `$1${escapeNews(canonical)}$2`)
      .replace(/(<meta property="og:url" content=")[^"]*("\s*\/?>)/, `$1${escapeNews(canonical)}$2`)
      .replace(/(<meta property="og:title" content=")[^"]*("\s*\/?>)/, `$1${escapeNews(copy.title)}$2`)
      .replace(/(<meta property="og:description" content=")[^"]*("\s*\/?>)/, `$1${escapeNews(copy.intro)}$2`);
    const headers = new Headers(response.headers);
    headers.delete("Content-Length");
    headers.delete("ETag");
    headers.set("Cache-Control", "no-store");
    headers.set("Vary", "Accept-Language");
    return new Response(html, { status: response.status, headers });
  }
  const lang = newsPageLanguage(request), slug = url.pathname.match(/^\/news\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/)?.[1];
  let item = null, related = [], status = 404;
  if (slug) {
    try {
      let items;
      if (env.SITE_DB) {
        const result = await env.SITE_DB.prepare(NEWS_PUBLIC_QUERY).bind(new Date().toISOString().slice(0, 10)).all();
        items = publicNews(rowsToNews(result.results || []));
      } else items = publicNews(MIRoKIT_NEWS);
      item = items.find((entry) => entry.id === slug) || null;
      if (item) {
        status = 200;
        related = items.filter((entry) => entry.id !== item.id).sort((a, b) => Number(b.category === item.category) - Number(a.category === item.category)).slice(0, 3);
      }
    } catch {
      // Never replace a failing authoritative database with stale published copy.
      status = 503;
    }
  }
  return new Response(request.method === "HEAD" ? null : pageShell({ url, lang, item, related, status }), {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", Vary: "Accept-Language", ...(status !== 200 ? { "X-Robots-Tag": "noindex, follow" } : {}) },
  });
}
