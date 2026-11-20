import { NEWS_COPY, articleMarkup, escapeNews, newsIndexHref, newsText, newsSummary, installNewsImageFallback, installNewsExtras } from "../../source/scripts/news-presentation.js";
import { installNewsLocationMaps } from "./location-map.js";
import { installArticleInteractions } from "./article-interactions.js";
import { installArticleImages } from "./article-images.js";

const data = JSON.parse(document.getElementById("newsArticleData").textContent);
const main = document.getElementById("newsArticle");
let disposeInteractions;

function renderArticle() {
  const extraWasOpen = Boolean(main.querySelector(".news-extra[open]"));
  disposeInteractions?.();
  const lang = currentLang, copy = NEWS_COPY[lang], item = data.item;
  const url = new URL(location.href);
  url.searchParams.set("lang", lang);
  history.replaceState(history.state, "", url);
  document.querySelector("[data-news-index]").href = newsIndexHref(lang);
  document.querySelector("[data-news-index]").textContent = copy.news;
  const title = item ? newsText(item, "title", lang) : data.status === 404 ? copy.missingTitle : copy.errorTitle;
  const description = item ? newsSummary(item, lang).teaser : data.status === 404 ? copy.missing : copy.error;
  main.innerHTML = item ? articleMarkup(item, data.related, lang) : `<section class="nw-message"><p class="nw-kicker">${data.status}</p><h1>${escapeNews(title)}</h1><p>${escapeNews(description)}</p><a class="nw-back" href="${newsIndexHref(lang)}">${escapeNews(copy.back)}</a></section>`;
  if (extraWasOpen && main.querySelector(".news-extra")) main.querySelector(".news-extra").open = true;
  document.title = `${title} — MIRoKIT`;
  const canonical = new URL(document.querySelector('link[rel="canonical"]').href);
  canonical.searchParams.set("lang", lang);
  document.querySelector('link[rel="canonical"]').href = canonical;
  const values = { description, "og:title": title, "og:description": description, "og:url": canonical.href, "og:locale": { de: "de_DE", en: "en_GB", ru: "ru_RU" }[lang], "twitter:title": title, "twitter:description": description };
  if (item) values["og:image:alt"] = newsText(item, "alt", lang);
  for (const [name, value] of Object.entries(values)) document.querySelector(`meta[name="${name}"],meta[property="${name}"]`)?.setAttribute("content", value);
  const schema = document.querySelector('script[type="application/ld+json"]');
  if (schema) {
    const json = JSON.parse(schema.textContent);
    Object.assign(json, { headline: title, description, inLanguage: lang, mainEntityOfPage: canonical.href });
    schema.textContent = JSON.stringify(json);
  }
  installNewsImageFallback(main);
  installArticleImages(main);
  installNewsExtras(main);
  installNewsLocationMaps(main);
  disposeInteractions = installArticleInteractions(main, [data.item, ...data.related], lang);
}

document.addEventListener("mirokit:languagechange", renderArticle);
renderArticle();
