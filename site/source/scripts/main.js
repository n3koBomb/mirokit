/* eslint-disable no-undef */
/* The translation object and language switch live in language.js. */
const scroller = document.querySelector(".site-main.scroller"), progress = document.getElementById("progress"), burger = document.querySelector(".burger"), mobileMenu = document.getElementById("mobileMenu"), backdrop = document.getElementById("mobileBackdrop"), closeBtn = document.querySelector(".close-menu"), modal = document.getElementById("signupModal"), toast = document.getElementById("toast");
let currentTheme = "light";
try {
   currentTheme = localStorage.getItem("mirokitTheme") === "dark" ? "dark" : "light";
} catch {
   // Theme still works for the current page when storage is blocked.
}
const panels = [...document.querySelectorAll(".panel")];
const scrollTopControl = document.getElementById("scrollTopControl");
const revealElements = [...document.querySelectorAll(".fu")];
const themeToggles = [...document.querySelectorAll("[data-theme-toggle]")];
const newsRotator = document.querySelector("[data-news-rotator]");
const newsGridFull = document.querySelector("[data-news-grid]");
const newsFilterBtns = [...document.querySelectorAll(".news-filter-btn")];
const newsEmpty = document.getElementById("newsEmpty");
let activeNewsFilter = "all";
let newsItems = MIRoKIT_NEWS;
let newsHeroItems = [];
let newsSlideIndex = 0;
let newsRotationTimer = 0;
let revealFrame = 0;
let revealObserver = null;
let deferredImageObserver = null;
let deferredBackgroundObserver = null;

const newsCategoryTranslationKeys = {
   event: "news_category_events",
   interview: "news_category_interview",
   photo: "news_category_photo",
   announce: "news_category_announce",
};

function loadDeferredImage(image) {
   if (!image?.dataset.src) return;
   if (image.dataset.srcset) image.setAttribute("srcset", image.dataset.srcset);
   image.setAttribute("fetchpriority", "low");
   image.setAttribute("src", image.dataset.src);
   delete image.dataset.src;
}

function loadDeferredBackground(element) {
   const source = element?.dataset.deferredBackground;
   if (!source || element.dataset.backgroundLoaded === "true") return;
   const absoluteSource = new URL(source, document.baseURI).href;
   const safeSource = absoluteSource.replace(/["\\)]/g, "\\$&");
   element.style.setProperty("--deferred-background", `url("${safeSource}")`);
   element.dataset.backgroundLoaded = "true";
}

function initDeferredMedia() {
   const images = [...document.querySelectorAll("img[data-src]")];
   const heroPartnerImages = images.filter((image) => image.closest("#hero .partner-showcase"));
   const viewportImages = images.filter((image) => !heroPartnerImages.includes(image));
   const backgrounds = [...document.querySelectorAll("[data-deferred-background]")];

   if ("IntersectionObserver" in window) {
      deferredImageObserver = new IntersectionObserver(
         (entries) => entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            loadDeferredImage(entry.target);
            deferredImageObserver.unobserve(entry.target);
         }),
         { rootMargin: "100px 0px", threshold: 0.01 },
      );
      viewportImages.forEach((image) => deferredImageObserver.observe(image));

      deferredBackgroundObserver = new IntersectionObserver(
         (entries) => entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            loadDeferredBackground(entry.target);
            deferredBackgroundObserver.unobserve(entry.target);
         }),
         { rootMargin: "500px 0px", threshold: 0.01 },
      );
      backgrounds.forEach((element) => deferredBackgroundObserver.observe(element));
   } else {
      window.setTimeout(() => {
         const viewportLimit = window.innerHeight + 100;
         viewportImages.forEach((image) => {
            const bounds = image.getBoundingClientRect();
            if (bounds.top <= viewportLimit && bounds.bottom >= -100) loadDeferredImage(image);
         });
         backgrounds.forEach((element) => {
            const bounds = element.getBoundingClientRect();
            if (bounds.top <= window.innerHeight + 500 && bounds.bottom >= -500) loadDeferredBackground(element);
         });
      }, 1500);
   }

   const releaseHeroPartnerImages = () => heroPartnerImages.forEach(loadDeferredImage);
   const partnerShowcase = document.querySelector("#hero .partner-showcase");
   window.addEventListener("scroll", releaseHeroPartnerImages, { once: true, passive: true });
   partnerShowcase?.addEventListener("pointerenter", releaseHeroPartnerImages, { once: true });
   partnerShowcase?.addEventListener("focusin", releaseHeroPartnerImages, { once: true });
}

function observeDeferredImages(root = document) {
   const images = [...root.querySelectorAll("img[data-src]")];
   if (!images.length) return;

   if (deferredImageObserver) {
      images.forEach((image) => deferredImageObserver.observe(image));
      return;
   }

   if (!("IntersectionObserver" in window)) {
      window.setTimeout(() => {
         const viewportLimit = window.innerHeight + 100;
         images.forEach((image) => {
            const bounds = image.getBoundingClientRect();
            if (bounds.top <= viewportLimit && bounds.bottom >= -100) loadDeferredImage(image);
         });
      }, 1500);
   }
}

function initDeferredWorldMap() {
   const worldSection = document.getElementById("world");
   if (!worldSection) return;

   let started = false;
   const start = () => {
      if (started) return;
      started = true;
      const scriptUrl = new URL("source/scripts/mirokit-world-map.js", document.baseURI).href;
      import(scriptUrl).catch((error) => console.warn("MIRoKIT world map could not be loaded.", error));
   };

   if (!("IntersectionObserver" in window)) {
      window.addEventListener("load", () => window.setTimeout(start, 1200), { once: true });
      return;
   }

   const observer = new IntersectionObserver(
      (entries) => {
         if (!entries.some((entry) => entry.isIntersecting)) return;
         observer.disconnect();
         start();
      },
      { rootMargin: "600px 0px", threshold: 0.01 },
   );
   observer.observe(worldSection);
}

// Temporary deactivation hook for links, controls, cards, and sections.
const temporaryDisabledSelector = "[data-temporarily-disabled], .is-temporarily-disabled";
const temporaryDisabledStates = new WeakMap();
let trackedTemporaryDisabledElements = new Set();

function rememberAndDisable(element, removeFromTabOrder = false) {
   if (!temporaryDisabledStates.has(element)) {
      temporaryDisabledStates.set(element, {
         ariaDisabled: element.getAttribute("aria-disabled"),
         tabindex: element.getAttribute("tabindex"),
      });
   }
   element.setAttribute("aria-disabled", "true");
   if (removeFromTabOrder && !element.matches("[disabled]")) element.tabIndex = -1;
}

function restoreTemporaryDisabled(element) {
   const state = temporaryDisabledStates.get(element);
   if (!state) return;
   if (state.ariaDisabled === null) element.removeAttribute("aria-disabled");
   else element.setAttribute("aria-disabled", state.ariaDisabled);
   if (state.tabindex === null) element.removeAttribute("tabindex");
   else element.setAttribute("tabindex", state.tabindex);
   temporaryDisabledStates.delete(element);
}

function syncTemporaryDisabled() {
   const activeElements = new Set();

   document.querySelectorAll(temporaryDisabledSelector).forEach((element) => {
      activeElements.add(element);
      rememberAndDisable(element);

      const controls = element.matches("a[href], button, input, select, textarea, [tabindex]")
         ? [element]
         : [...element.querySelectorAll("a[href], button, input, select, textarea, [tabindex]")];
      controls.forEach((control) => {
         if (control.disabled) return;
         activeElements.add(control);
         rememberAndDisable(control, true);
      });
   });

   trackedTemporaryDisabledElements.forEach((element) => {
      if (!activeElements.has(element)) restoreTemporaryDisabled(element);
   });
   trackedTemporaryDisabledElements = activeElements;
}

function initTemporaryDisabled() {
   syncTemporaryDisabled();

   document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest(temporaryDisabledSelector) : null;
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
   }, true);

   document.addEventListener("submit", (event) => {
      const target = event.target instanceof Element ? event.target.closest(temporaryDisabledSelector) : null;
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
   }, true);

   const observer = new MutationObserver((records) => {
      const markerChanged = records.some((record) => {
         if (record.type === "childList") return true;
         if (record.attributeName === "data-temporarily-disabled") return true;
         if (record.attributeName !== "class" || !(record.target instanceof Element)) return false;
         const wasDisabled = /(?:^|\s)is-temporarily-disabled(?:\s|$)/.test(record.oldValue || "");
         const isDisabled = record.target.classList.contains("is-temporarily-disabled");
         return wasDisabled !== isDisabled;
      });
      if (markerChanged) syncTemporaryDisabled();
   });
   observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "data-temporarily-disabled"],
      attributeOldValue: true,
      childList: true,
      subtree: true,
   });
}

initTemporaryDisabled();

function syncThemeControls() {
   const isDark = currentTheme === "dark";
   document.body.classList.toggle("theme-dark", isDark);
   document.documentElement.dataset.theme = currentTheme;
   const labelKey = isDark ? "theme_light" : "theme_dark";
   const label = T[currentLang]?.[labelKey] || (isDark ? "Light theme" : "Dark theme");
   themeToggles.forEach((toggle) => {
      toggle.setAttribute("aria-pressed", String(isDark));
      toggle.setAttribute("aria-label", label);
      toggle.setAttribute("title", label);
      const text = toggle.querySelector(".theme-toggle-label");
      if (text) text.textContent = label;
      const icon = toggle.querySelector("i");
      if (icon) {
         icon.classList.toggle("fa-moon", !isDark);
         icon.classList.toggle("fa-sun", isDark);
      }
   });
}

function setTheme(theme) {
   currentTheme = theme === "dark" ? "dark" : "light";
   try {
      localStorage.setItem("mirokitTheme", currentTheme);
   } catch {
      // Theme still applies for the current page when storage is blocked.
   }
   syncThemeControls();
}

const newsCategoryClasses = {
   blue: "cat-blue",
   green: "cat-green",
   red: "cat-red",
   violet: "cat-violet",
};

function newsText(item, field) {
   const values = item[field] || {};
   if (field === "categoryLabel" && !item[field]) {
      const key = newsCategoryTranslationKeys[item.category];
      return T[currentLang]?.[key] || T.en?.[key] || item.category || "";
   }
   return values[currentLang] || values.en || values.ru || "";
}

function escapeHtml(value) {
   const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
   return String(value ?? "").replace(/[&<>"']/g, (character) => entities[character]);
}

function galleryText(item, field) {
   const values = item[field] || {};
   return values[currentLang] || values.en || values.ru || "";
}

function galleryQuoteMarkup(quote) {
   const text = galleryText(quote, "quote");
   const byline = galleryText(quote, "byline");
   return `<article class="photo-story photo-story--quote" data-gallery-quote><i class="fa-solid fa-quote-left" aria-hidden="true"></i><p>${escapeHtml(`«${text}»`)}</p>${byline ? `<small>${escapeHtml(byline)}</small>` : ""}</article>`;
}

function createGalleryQuoteElement(quote) {
   if (!quote) return originalStaticQuote?.cloneNode(true) || null;
   const template = document.createElement("template");
   template.innerHTML = galleryQuoteMarkup(quote).trim();
   return template.content.firstElementChild;
}

function appendGalleryQuote(grid) {
   const quote = createGalleryQuoteElement(selectedGalleryQuote);
   if (quote) grid.append(quote);
}

function renderRemoteGallery() {
   if (!remoteGalleryGrid || !staticGalleryGrid) return;
   const items = galleryItems.filter((item) => item?.image);
   if (!items.length) {
      const currentQuote = staticGalleryGrid.querySelector(".photo-story--quote");
      const quote = createGalleryQuoteElement(selectedGalleryQuote);
      if (currentQuote && quote) currentQuote.replaceWith(quote);
      staticGalleryGrid.hidden = false;
      remoteGalleryGrid.hidden = true;
      galleryCountLabels.forEach((label) => { label.textContent = "180+"; });
      return;
   }

   remoteGalleryGrid.innerHTML = items.map((item) => {
      const title = galleryText(item, "title") || "MIRoKIT Gallery";
      const alt = galleryText(item, "alt") || title;
      const subtitle = galleryText(item, "subtitle") || "Gallery";
      const featureClass = item.featured ? " photo-story--feature" : "";
      return `<button class="photo-story${featureClass}" type="button" data-gallery-image data-gallery-title="${escapeHtml(title)}" aria-label="${escapeHtml(`Фото открыть: ${title}`)}"><img loading="lazy" src="${escapeHtml(item.image)}" alt="${escapeHtml(alt)}" /><span><small>${escapeHtml(subtitle)}</small><strong>${escapeHtml(title)}</strong></span></button>`;
   }).join("");

   appendGalleryQuote(remoteGalleryGrid);
   staticGalleryGrid.hidden = true;
   remoteGalleryGrid.hidden = false;
   galleryCountLabels.forEach((label) => { label.textContent = String(items.length); });
}

function partnerCategoryLabel(category) {
   const key = { public: "partner_public", social: "partner_social", education: "partner_education" }[category];
   return (key && (T[currentLang]?.[key] || T.en?.[key])) || category || "Partners";
}

function renderRemotePartners() {
   if (!partnersRemote || !partnersStatic || !partnerItems.length) return;
   const groups = new Map();
   partnerItems.forEach((item) => {
      if (!groups.has(item.category)) groups.set(item.category, []);
      groups.get(item.category).push(item);
   });
   partnersRemote.innerHTML = [...groups.entries()].map(([category, items]) => `<article class="partner-logo-group"><h3>${escapeHtml(partnerCategoryLabel(category))}</h3><div class="partner-logo-wall">${items.map((item) => {
      const translations = item.translations || {};
      const localized = translations[currentLang] || translations.en || translations.ru || {};
      const name = localized.name || item.id;
      const tile = `<figure class="partner-logo-tile${item.featured ? " partner-logo-tile--wide" : ""}"><img loading="lazy" src="${escapeHtml(item.image || "")}" alt="${escapeHtml(localized.alt || name)}" /><figcaption>${escapeHtml(name)}</figcaption></figure>`;
      return item.website ? `<a class="partner-logo-link" href="${escapeHtml(item.website)}" target="_blank" rel="noopener noreferrer">${tile}</a>` : tile;
   }).join("")}</div></article>`).join("");
   partnersStatic.hidden = true;
   partnersRemote.hidden = false;
}

function videoText(item, field) {
   const values = item.translations?.[currentLang] || item.translations?.en || item.translations?.ru || {};
   return values[field] || "";
}

function formatVideoDuration(value) {
   if (value === null || value === undefined || !Number.isFinite(Number(value))) return "";
   const total = Math.max(0, Math.round(Number(value)));
   return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function videoTriggerAttributes(item, title, poster) {
   const subtitles = JSON.stringify(item.subtitles || []);
   const type = item.sourceType || "external";
   const source = type === "youtube" ? "" : item.sourceUrl || "";
   const embed = type === "youtube" ? item.embedUrl || item.sourceUrl || "" : "";
   return `data-gallery-video data-video-type="${escapeHtml(type)}" data-video-src="${escapeHtml(source)}" data-video-embed="${escapeHtml(embed)}" data-video-title="${escapeHtml(title)}" data-video-poster="${escapeHtml(poster)}" data-video-duration="${escapeHtml(item.durationSeconds ?? "")}" data-video-width="${escapeHtml(item.width ?? "")}" data-video-height="${escapeHtml(item.height ?? "")}" data-video-subtitles="${escapeHtml(subtitles)}"`;
}

function renderRemoteVideos() {
   if (!videoRemoteLibrary || !videoStaticLibrary) return;
   const items = videoItems.filter((item) => item?.sourceUrl && item?.translations);
   if (!items.length) {
      videoStaticLibrary.hidden = false;
      videoRemoteLibrary.hidden = true;
      videosCountLabels.forEach((label) => { label.textContent = "24"; });
      return;
   }
   videosCountLabels.forEach((label) => { label.textContent = String(items.length); });
   const featured = items.find((item) => item.featured) || items[0];
   const rest = items.filter((item) => item !== featured);
   const spotlightTitle = videoText(featured, "title") || featured.id;
   const spotlightPoster = featured.poster || "";
   const spotlight = `<article class="video-spotlight fu d1"><button class="video-spotlight-open" type="button" ${videoTriggerAttributes(featured, spotlightTitle, spotlightPoster)} aria-haspopup="dialog" aria-label="Video im Vollbild öffnen: ${escapeHtml(spotlightTitle)}">${spotlightPoster ? `<img loading="lazy" src="${escapeHtml(spotlightPoster)}" alt="${escapeHtml(videoText(featured, "alt") || spotlightTitle)}" />` : ""}<span class="video-play-button"><i class="fa-solid fa-play" aria-hidden="true"></i></span><small>${escapeHtml(formatVideoDuration(featured.durationSeconds))}</small></button><section><span>${escapeHtml(featured.sourceType === "youtube" ? "YouTube" : "MIRoKIT Videothek")}</span><h3>${escapeHtml(spotlightTitle)}</h3><p>${escapeHtml(videoText(featured, "description"))}</p><button class="btn-primary" type="button" ${videoTriggerAttributes(featured, spotlightTitle, spotlightPoster)} aria-haspopup="dialog"><i class="fa-solid fa-play" aria-hidden="true"></i> Video ansehen</button></section></article>`;
   const cards = rest.map((item, index) => {
      const title = videoText(item, "title") || item.id;
      const poster = item.poster || "";
      const triggerAttributes = videoTriggerAttributes(item, title, poster);
      return `<article class="video-card fu d${Math.min(index + 2, 4)}" ${triggerAttributes} role="button" tabindex="0" aria-haspopup="dialog" aria-label="Video öffnen: ${escapeHtml(title)}"><span>${poster ? `<img loading="lazy" src="${escapeHtml(poster)}" alt="${escapeHtml(videoText(item, "alt") || title)}" />` : ""}<i class="fa-solid fa-play" aria-hidden="true"></i></span><div><small>${escapeHtml(item.sourceType === "youtube" ? "YouTube" : "Video")} · ${escapeHtml(formatVideoDuration(item.durationSeconds))}</small><strong>${escapeHtml(title)}</strong><button type="button" ${triggerAttributes} aria-haspopup="dialog">Öffnen</button></div></article>`;
   }).join("");
   videoRemoteLibrary.innerHTML = `${spotlight}<div class="video-list">${cards}</div>`;
   registerRevealElements(videoRemoteLibrary);
   videoStaticLibrary.hidden = true;
   videoRemoteLibrary.hidden = false;
}

function formatNewsDate(date) {
   const locale = { ru: "ru-RU", en: "en-GB", de: "de-DE" }[currentLang] || "en-GB";
   return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function isPublishedNews(item) {
   return new Date(`${item.publishedAt}T23:59:59`).getTime() <= Date.now();
}

function newsFeaturedRank(item) {
   const rank = Number(item.featured);
   return Number.isFinite(rank) && rank > 0 ? rank : Number.POSITIVE_INFINITY;
}

function sortNews(items) {
   return [...items].sort((a, b) => {
      const dateDifference = new Date(`${b.publishedAt}T12:00:00`) - new Date(`${a.publishedAt}T12:00:00`);
      return dateDifference || String(a.id).localeCompare(String(b.id));
   });
}

function getPublishedNews() {
   return sortNews(newsItems.filter(isPublishedNews));
}

function getVisibleNews() {
   return getPublishedNews().filter((item) => activeNewsFilter === "all" || item.category === activeNewsFilter);
}

function getHeroNews() {
   return getPublishedNews().slice(0, 3).sort((a, b) => {
      const aRank = newsFeaturedRank(a);
      const bRank = newsFeaturedRank(b);
      if (aRank !== bRank) return aRank === Number.POSITIVE_INFINITY ? 1 : bRank === Number.POSITIVE_INFINITY ? -1 : aRank - bRank;
      return new Date(`${b.publishedAt}T12:00:00`) - new Date(`${a.publishedAt}T12:00:00`);
   });
}

function stopNewsRotation() {
   window.clearTimeout(newsRotationTimer);
   newsRotationTimer = 0;
}

function scheduleNewsRotation() {
   stopNewsRotation();
   if (!newsRotator || newsHeroItems.length < 2 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
   newsRotationTimer = window.setTimeout(() => showNewsSlide(newsSlideIndex + 1), 6500);
}

function showNewsSlide(index) {
   if (!newsRotator || !newsHeroItems.length) return;
   newsSlideIndex = (index + newsHeroItems.length) % newsHeroItems.length;
   newsRotator.querySelectorAll("[data-news-slide]").forEach((slide, slideIndex) => {
      const isActive = slideIndex === newsSlideIndex;
      slide.hidden = !isActive;
      slide.classList.toggle("is-active", isActive);
   });
   newsRotator.querySelectorAll("[data-news-rotate-target]").forEach((dot) => {
      const isActive = Number(dot.dataset.newsRotateTarget) === newsSlideIndex;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-current", String(isActive));
   });
   const current = newsRotator.querySelector("[data-news-current]");
   if (current) current.textContent = String(newsSlideIndex + 1).padStart(2, "0");
   scheduleNewsRotation();
}

function newsHeroSlideMarkup(item, index) {
   const title = newsText(item, "title");
   const summary = newsText(item, "summary");
   const category = newsText(item, "categoryLabel");
   const accentClass = newsCategoryClasses[item.accent] || newsCategoryClasses.blue;
   const position = String(index + 1).padStart(2, "0");
   const readableLabel = T[currentLang]?.news_full || "Read in full";
   const storyLabel = T[currentLang]?.news_read || "Read the story";

   return `<article class="news-slide" data-news-slide="${index}" hidden>
            <a class="news-slide-media" href="#news" data-news-open="${escapeHtml(item.id)}" aria-label="${escapeHtml(`${readableLabel}: ${title}`)}">
               <img loading="lazy" data-src="${escapeHtml(item.image)}" alt="${escapeHtml(newsText(item, "alt"))}" /><span class="category ${accentClass}">${escapeHtml(category)}</span>
            </a>
            <div class="news-slide-content"><div class="news-card-meta"><span>${position} / NEWS</span><time datetime="${escapeHtml(item.publishedAt)}">${escapeHtml(formatNewsDate(item.publishedAt))}</time></div><h3 class="news-title">${escapeHtml(title)}</h3><p class="news-slide-summary">${escapeHtml(summary)}</p><a class="news-read-link" href="#news" data-news-open="${escapeHtml(item.id)}">${escapeHtml(storyLabel)} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></div>
         </article>`;
}

function renderHeroNews() {
   if (!newsRotator) return;
   const previousId = newsHeroItems[newsSlideIndex]?.id;
   newsHeroItems = getHeroNews();
   const chooseNewsLabel = T[currentLang]?.choose_news || "Choose a news item";
   const dots = newsHeroItems.map((_, index) => {
      const isActive = index === 0;
      const label = T[currentLang]?.[`show_news_${index + 1}`] || `Show news item ${index + 1}`;
      return `<button class="news-rotator-dot${isActive ? " is-active" : ""}" type="button" data-news-rotate-target="${index}" aria-label="${escapeHtml(label)}" aria-current="${String(isActive)}"></button>`;
   }).join("");
   const controls = newsHeroItems.length > 1 ? `<div class="news-rotator-controls" aria-label="${escapeHtml(chooseNewsLabel)}"><div class="news-rotator-dots">${dots}</div><span class="news-rotator-status"><span data-news-current>01</span> / ${String(newsHeroItems.length).padStart(2, "0")}</span></div>` : "";
   newsRotator.innerHTML = newsHeroItems.map(newsHeroSlideMarkup).join("") + controls;
   const restoredIndex = newsHeroItems.findIndex((item) => item.id === previousId);
   showNewsSlide(restoredIndex >= 0 ? restoredIndex : 0);
}

function newsCardMarkup(item, index, isHero = false) {
   const title = newsText(item, "title");
   const summary = newsText(item, "summary");
   const category = newsText(item, "categoryLabel");
   const accentClass = newsCategoryClasses[item.accent] || newsCategoryClasses.blue;
   const cardClass = isHero ? (item.featured === 1 ? "news-card--featured" : "news-card--compact") : "";
   const position = String(index + 1).padStart(2, "0");
   const readableLabel = T[currentLang]?.news_full || "Read in full";

   if (!isHero) {
      return `<div class="news-card-full-wrap${item.featured === 1 ? " featured" : ""}" data-category="${escapeHtml(item.category)}" data-news-id="${escapeHtml(item.id)}">
               <button type="button" class="news-card-full" data-news-open="${escapeHtml(item.id)}" aria-label="${escapeHtml(`${readableLabel}: ${title}`)}">
                  <span class="news-full-img-wrap"><img loading="lazy" data-src="${escapeHtml(item.image)}" alt="${escapeHtml(newsText(item, "alt"))}" /><span class="category ${accentClass}">${escapeHtml(category)}</span></span>
                  <span class="news-full-body"><span class="news-full-date"><i class="fa-regular fa-calendar" aria-hidden="true"></i> ${escapeHtml(formatNewsDate(item.publishedAt))}</span><span class="news-full-title">${escapeHtml(title)}</span><span class="news-full-excerpt">${escapeHtml(summary)}</span><span class="news-full-readmore">${escapeHtml(readableLabel)} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></span>
               </button>
            </div>`;
   }

   const storyLabel = T[currentLang]?.news_read || "Read the story";
   return `<article class="news-card ${cardClass}" data-news-id="${escapeHtml(item.id)}">
            <a class="news-card-media" href="#news" data-news-open="${escapeHtml(item.id)}" aria-label="${escapeHtml(`${readableLabel}: ${title}`)}">
               <img loading="lazy" data-src="${escapeHtml(item.image)}" alt="${escapeHtml(newsText(item, "alt"))}" /><span class="news-card-index">${position}</span><span class="category ${accentClass}">${escapeHtml(category)}</span><span class="news-card-scan" aria-hidden="true"><i class="fa-solid fa-arrow-up-right-from-square"></i></span>
            </a>
            <div class="news-body"><div class="news-card-meta"><span>${position} / NEWS</span><time datetime="${escapeHtml(item.publishedAt)}">${escapeHtml(formatNewsDate(item.publishedAt))}</time></div><h3 class="news-title">${escapeHtml(title)}</h3><p class="news-slide-summary">${escapeHtml(summary)}</p><div class="news-footer"><span>${escapeHtml(category)}</span><a class="news-read-link" href="#news" data-news-open="${escapeHtml(item.id)}">${escapeHtml(storyLabel)} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></div></div>
         </article>`;
}

function renderNewsViews() {
   renderHeroNews();

   const visibleNews = getVisibleNews();
   if (newsGridFull) newsGridFull.innerHTML = visibleNews.map((item, index) => newsCardMarkup(item, index)).join("");
   if (newsEmpty) newsEmpty.hidden = visibleNews.length > 0;
   observeDeferredImages();
}

newsRotator?.addEventListener("click", (event) => {
   const dot = event.target instanceof Element ? event.target.closest("[data-news-rotate-target]") : null;
   if (!dot || !newsRotator.contains(dot)) return;
   showNewsSlide(Number(dot.dataset.newsRotateTarget));
});
newsRotator?.addEventListener("mouseenter", stopNewsRotation);
newsRotator?.addEventListener("mouseleave", scheduleNewsRotation);
newsRotator?.addEventListener("focusin", stopNewsRotation);
newsRotator?.addEventListener("focusout", (event) => {
   if (!newsRotator.contains(event.relatedTarget)) scheduleNewsRotation();
});

newsFilterBtns.forEach((button) => button.addEventListener("click", () => {
   activeNewsFilter = button.dataset.filter || "all";
   newsFilterBtns.forEach((filterButton) => {
      const isActive = filterButton === button;
      filterButton.classList.toggle("is-active", isActive);
      filterButton.setAttribute("aria-pressed", String(isActive));
   });
   renderNewsViews();
}));

document.addEventListener("mirokit:languagechange", () => {
   renderNewsViews();
   renderRemoteGallery();
   renderRemotePartners();
   renderRemoteVideos();
});
renderNewsViews();

async function loadRemoteNews() {
   try {
      const response = await fetch("/api/v1/news", { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error(`News API returned ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.news)) throw new Error("News API returned invalid data");
      newsItems = payload.news.filter((item) => item && typeof item.id === "string" && typeof item.publishedAt === "string" && typeof item.image === "string" && item.image.trim() && item.title && item.summary && item.alt && item.content);
      renderNewsViews();
   } catch (error) {
      console.info("[MIRoKIT] Using bundled news fallback:", error.message);
   }
}

async function loadRemoteGallery() {
   try {
      const response = await fetch("/api/v1/gallery", { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error(`Gallery API returned ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.gallery)) throw new Error("Gallery API returned invalid data");
      galleryItems = payload.gallery;
      galleryQuotes = Array.isArray(payload.quotes) ? payload.quotes.filter((quote) => quote?.quote) : [];
      selectedGalleryQuote = galleryQuotes.length ? galleryQuotes[Math.floor(Math.random() * galleryQuotes.length)] : null;
      renderRemoteGallery();
   } catch (error) {
      console.info("[MIRoKIT] Using bundled gallery fallback:", error.message);
   }
}

async function loadRemotePartners() {
   if (!partnersRemote || !partnersStatic) return;
   try {
      const response = await fetch("/api/v1/partners", { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error(`Partners API returned ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.partners)) throw new Error("Partners API returned invalid data");
      partnerItems = payload.partners.filter((item) => item?.image && item?.translations);
      renderRemotePartners();
   } catch (error) {
      console.info("[MIRoKIT] Using bundled partners fallback:", error.message);
   }
}

async function loadRemoteVideos() {
   if (!videoRemoteLibrary || !videoStaticLibrary) return;
   try {
      const response = await fetch("/api/v1/videos", { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error(`Videos API returned ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.videos)) throw new Error("Videos API returned invalid data");
      videoItems = payload.videos;
      renderRemoteVideos();
   } catch (error) {
      console.info("[MIRoKIT] Using bundled video fallback:", error.message);
   }
}

loadRemoteNews();
loadRemoteGallery();
initDeferredMedia();
initDeferredWorldMap();

themeToggles.forEach((toggle) => toggle.addEventListener("click", () => setTheme(currentTheme === "dark" ? "light" : "dark")));
syncThemeControls();

function revealVisibleElements() {
   revealFrame = 0;
   const revealLine = window.innerHeight * 0.82;
   revealElements.forEach((element) => {
      if (element.classList.contains("vis")) return;
      const bounds = element.getBoundingClientRect();
      if (bounds.top <= revealLine && bounds.bottom > 0) element.classList.add("vis");
   });
}

function scheduleReveal() {
   if (!revealFrame) revealFrame = requestAnimationFrame(revealVisibleElements);
}

function registerRevealElements(root) {
   if (!root) return;
   [...root.querySelectorAll(".fu")].forEach((element) => {
      if (!revealElements.includes(element)) revealElements.push(element);
      if (revealObserver) revealObserver.observe(element);
   });
   scheduleReveal();
}

function syncReadingProgress() {
   const scrollableHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
   const progress = scrollableHeight ? Math.min(Math.max(window.scrollY / scrollableHeight, 0), 1) : 0;
   const percent = Math.round(progress * 100);
   document.documentElement.style.setProperty("--scroll-progress-value", percent);
   document.documentElement.style.setProperty("--scroll-progress", `${percent}%`);
   document.documentElement.style.setProperty("--scroll-progress-offset", 100 - percent);
   document.documentElement.style.setProperty("--scroll-progress-angle", `${percent * 3.6}deg`);
   document.documentElement.style.setProperty("--scroll-glow-opacity", String(0.18 + progress * 0.38));
   if (scrollTopControl) {
      const percentNode = scrollTopControl.querySelector(".scroll-top-percent");
      if (percentNode) percentNode.textContent = `${percent}%`;
      scrollTopControl.classList.toggle("is-visible", window.scrollY > Math.min(180, window.innerHeight * 0.18) || percent > 1);
      scrollTopControl.classList.toggle("is-complete", percent >= 99);
   }
}

function syncFooterTaskbar() {
   if (!panels.length) return;

   const active = panels.reduce((best, panel) => {
      const currentDistance = Math.abs(panel.getBoundingClientRect().top);
      const bestDistance = Math.abs(best.getBoundingClientRect().top);
      return currentDistance < bestDistance ? panel : best;
   }, panels[0]);

   document.body.classList.toggle("is-home", active?.id === "hero");
   syncReadingProgress();
}

function initIntroLoader() {
   const introLoader = document.getElementById("introLoader");
   const introLogo = introLoader?.querySelector(".intro-loader-logo");
   const headerLogo = document.querySelector(".topbar .logo-placeholder");
   const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

   if (!introLoader || !introLogo || !headerLogo || reducedMotion) {
      document.body.classList.remove("intro-loading");
      introLoader?.remove();
      return;
   }

   let started = false;

   async function inlineIntroSvg() {
      const svgSource = introLogo.dataset.svgSrc;
      if (!svgSource) return false;

      try {
         const response = await fetch(svgSource, { cache: "force-cache" });
         if (!response.ok) throw new Error(`SVG request failed: ${response.status}`);

         const svgDocument = new DOMParser().parseFromString(await response.text(), "image/svg+xml");
         const svg = svgDocument.documentElement;
         if (svg.nodeName.toLowerCase() !== "svg" || svg.querySelector("parsererror")) throw new Error("Invalid intro SVG");

         svg.removeAttribute("width");
         svg.removeAttribute("height");
         svg.setAttribute("viewBox", "0 0 344 338");
         svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
         svg.setAttribute("aria-hidden", "true");
         svg.classList.add("intro-logo-svg");

         const pieces = [...svg.querySelectorAll("path")];
         pieces.forEach((path, index) => {
            const piece = document.createElementNS("http://www.w3.org/2000/svg", "g");
            piece.classList.add("intro-logo-piece");
            piece.style.setProperty("--piece-angle", `${index % 2 ? 5 : -5}deg`);
            piece.style.setProperty("--piece-mid-angle", `${index % 2 ? -1.75 : 1.75}deg`);
            piece.style.setProperty("--piece-delay", `${(0.52 + index * 0.1).toFixed(2)}s`);
            path.replaceWith(piece);
            piece.append(path);
         });

         introLogo.replaceChildren(document.importNode(svg, true));
         introLogo.classList.add("is-svg-ready");
         return true;
      } catch (error) {
         console.warn("MIRoKIT intro SVG could not be inlined.", error);
         const fallback = document.createElement("img");
         fallback.src = introLogo.dataset.svgSrc;
         fallback.alt = "SVG-LOGOofMIRoKIT";
         fallback.setAttribute("aria-hidden", "true");
         fallback.className = "intro-logo-fallback";
         introLogo.replaceChildren(fallback);
         return false;
      }
   }

   const finishIntro = () => {
      if (introLoader.dataset.finished) return;
      introLoader.dataset.finished = "true";
      document.body.classList.remove("intro-loading");
      introLoader.classList.add("is-finished");
      // window.setTimeout(() => introLoader.remove(), 750);
   };

   const moveLogoToHeader = () => {
      if (!started || introLoader.dataset.moving) return;
      introLoader.dataset.moving = "true";
      introLoader.classList.add("is-moving");

      const introRect = introLogo.getBoundingClientRect();
      const headerRect = headerLogo.getBoundingClientRect();
      const targetSize = Math.max(24, Math.min(headerRect.height * 0.5, introRect.width));
      const targetLeft = headerRect.left + headerRect.width * 0.075;
      const targetTop = headerRect.top + headerRect.height * 0.245;
      const translateX = targetLeft + targetSize / 2 - (introRect.left + introRect.width / 2);
      const translateY = targetTop + targetSize / 2 - (introRect.top + introRect.height / 2);
      const scale = targetSize / introRect.width;

      if (typeof introLogo.animate !== "function") {
         finishIntro();
         return;
      }

      const movement = introLogo.animate(
         [
            { transform: "translate3d(0, 0, 0) rotate(0deg) scale(1)" },
            { transform: `translate3d(${translateX}px, ${translateY}px, 0) rotate(0deg) scale(${scale})` },
         ],
         {
            duration: 1450,
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            fill: "forwards",
         },
      );
      movement.onfinish = finishIntro;
      window.setTimeout(finishIntro, 1750);
   };

   const startIntro = () => {
      if (started) return;
      started = true;
      introLoader.classList.add("is-started");
      window.setTimeout(moveLogoToHeader, 3650);
   };

   inlineIntroSvg().then(startIntro).catch(startIntro);
}

initIntroLoader();
const contactViews = [...document.querySelectorAll("[data-contact-view]")];

function setContactView(viewKey = "main-contact") {
   const selectedKey = contactViews.some((view) => view.dataset.contactView === viewKey) ? viewKey : "main-contact";

   contactViews.forEach((view) => {
      view.hidden = view.dataset.contactView !== selectedKey;
   });
   const activeContactView = contactViews.find((view) => view.dataset.contactView === selectedKey);
   const contactQuicklinks = activeContactView?.querySelector(".contact-quicklinks");
   if (contactQuicklinks && revealObserver) {
      revealObserver.unobserve(contactQuicklinks);
      revealObserver.observe(contactQuicklinks);
   }
   scheduleReveal();
   document.querySelectorAll('[href="#contact"][data-link-key]').forEach((link) => {
      const isCurrent = link.dataset.linkKey === selectedKey;
      link.classList.toggle("is-current", isCurrent);
      if (isCurrent) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
   });

}

setContactView();

const galleryViews = [...document.querySelectorAll("[data-gallery-view]")];
const galleryPhotoView = document.querySelector('[data-gallery-view="photos"]');
const staticGalleryGrid = galleryPhotoView?.querySelector("[data-gallery-static-grid]");
const remoteGalleryGrid = galleryPhotoView?.querySelector("[data-gallery-remote-grid]");
const galleryCountLabels = [...document.querySelectorAll("[data-gallery-count]")];
const partnersCountLabels = [...document.querySelectorAll("[data-partners-count]")];
const videosCountLabels = [...document.querySelectorAll("[data-video-count]")];
const partnersStatic = document.getElementById("partnersStatic");
const partnersRemote = document.getElementById("partnersRemote");
const videoStaticLibrary = document.getElementById("staticVideoLibrary");
const videoRemoteLibrary = document.getElementById("remoteVideoLibrary");
const originalStaticQuote = staticGalleryGrid?.querySelector(".photo-story--quote")?.cloneNode(true);
let galleryItems = [];
let galleryQuotes = [];
let selectedGalleryQuote = null;
let partnerItems = [];
let videoItems = [];

loadRemotePartners();
loadRemoteVideos();
function setGalleryView(viewKey = "gallery-main") {
   const selectedKey = galleryViews.some((view) => view.dataset.galleryView === viewKey) ? viewKey : "gallery-main";

   galleryViews.forEach((view) => {
      view.hidden = view.dataset.galleryView !== selectedKey;
   });
   scheduleReveal();
   document.querySelectorAll("[data-gallery-link]").forEach((link) => {
      const isCurrent = link.dataset.linkKey === selectedKey;
      link.classList.toggle("is-current", isCurrent);
      if (isCurrent) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
   });

}

setGalleryView();

const onlineProjectsPanel = document.getElementById("onlineProjects");
const onlineProjectsViews = [...(onlineProjectsPanel?.querySelectorAll("[data-online-projects-view]") || [])];
const onlineProjectsLinks = [...(onlineProjectsPanel?.querySelectorAll("[data-online-projects-link]") || [])];
const onlineProjectsNavViewport = onlineProjectsPanel?.querySelector("[data-online-projects-nav-viewport]");
const onlineProjectsScrollButtons = [...(onlineProjectsPanel?.querySelectorAll("[data-online-projects-scroll]") || [])];
const onlineProjectsReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");

function updateOnlineProjectsScrollControls() {
   if (!onlineProjectsNavViewport || !onlineProjectsScrollButtons.length) return;

   const maxScroll = Math.max(0, onlineProjectsNavViewport.scrollWidth - onlineProjectsNavViewport.clientWidth);
   const hasOverflow = maxScroll > 2;
   const atStart = onlineProjectsNavViewport.scrollLeft <= 2;
   const atEnd = onlineProjectsNavViewport.scrollLeft >= maxScroll - 2;

   onlineProjectsScrollButtons.forEach((button) => {
      const isPrevious = button.dataset.onlineProjectsScroll === "previous";
      button.hidden = !hasOverflow;
      button.disabled = !hasOverflow || (isPrevious ? atStart : atEnd);
      button.setAttribute("aria-disabled", String(button.disabled));
   });
}

function scrollOnlineProjectsNav(direction) {
   if (!onlineProjectsNavViewport) return;
   const distance = Math.max(180, onlineProjectsNavViewport.clientWidth * 0.72);
   onlineProjectsNavViewport.scrollBy({
      left: direction * distance,
      behavior: onlineProjectsReducedMotion?.matches ? "auto" : "smooth",
   });
}

function setOnlineProjectsView(viewKey = "drawing") {
   if (!onlineProjectsViews.length) return;
   const selectedKey = onlineProjectsViews.some((view) => view.dataset.onlineProjectsView === viewKey) ? viewKey : "drawing";

   onlineProjectsViews.forEach((view) => {
      const isCurrent = view.dataset.onlineProjectsView === selectedKey;
      view.hidden = !isCurrent;
      view.classList.toggle("is-current", isCurrent);
   });

   onlineProjectsLinks.forEach((link) => {
      const isCurrent = link.dataset.linkKey === selectedKey;
      link.classList.toggle("is-active", isCurrent);
      link.classList.toggle("is-current", isCurrent);
      link.setAttribute("aria-selected", String(isCurrent));
      link.tabIndex = isCurrent ? 0 : -1;
   });

   const selectedLink = onlineProjectsLinks.find((link) => link.dataset.linkKey === selectedKey);
   if (selectedLink && onlineProjectsNavViewport && window.matchMedia?.("(max-width: 760px)").matches) {
      selectedLink.scrollIntoView({
         behavior: onlineProjectsReducedMotion?.matches ? "auto" : "smooth",
         block: "nearest",
         inline: "nearest",
      });
   }

   scheduleReveal();
   updateOnlineProjectsScrollControls();
}

onlineProjectsLinks.forEach((link) => {
   link.addEventListener("click", () => setOnlineProjectsView(link.dataset.linkKey || "drawing"));
   link.addEventListener("keydown", (event) => {
      if (!onlineProjectsLinks.length || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const currentIndex = onlineProjectsLinks.indexOf(link);
      let nextIndex = currentIndex;
      if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + onlineProjectsLinks.length) % onlineProjectsLinks.length;
      if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % onlineProjectsLinks.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = onlineProjectsLinks.length - 1;
      const nextLink = onlineProjectsLinks[nextIndex];
      nextLink.focus();
      setOnlineProjectsView(nextLink.dataset.linkKey || "drawing");
   });
});

onlineProjectsScrollButtons.forEach((button) => {
   button.addEventListener("click", () => scrollOnlineProjectsNav(button.dataset.onlineProjectsScroll === "previous" ? -1 : 1));
});

onlineProjectsNavViewport?.addEventListener("scroll", updateOnlineProjectsScrollControls, { passive: true });
onlineProjectsNavViewport?.addEventListener("keydown", (event) => {
   if (event.target !== onlineProjectsNavViewport) return;
   if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollOnlineProjectsNav(-1);
   }
   if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollOnlineProjectsNav(1);
   }
});
window.addEventListener("resize", updateOnlineProjectsScrollControls, { passive: true });
document.addEventListener("mirokit:languagechange", updateOnlineProjectsScrollControls);
setOnlineProjectsView();

const projectsPanel = document.getElementById("projects");
const projectsViews = [...document.querySelectorAll("[data-projects-view]")];
const projectsLogo = projectsPanel?.querySelector(".section-logo img");
const projectsLogoByView = {
   current_projects: "public/assets/logos/sections/current_projects_page.png",
   pas_projects: "public/assets/logos/sections/past_projects_page.png",
};

function setProjectsView(viewKey = "current_projects") {
   const selectedKey = projectsViews.some((view) => view.dataset.projectsView === viewKey) ? viewKey : "current_projects";

   projectsViews.forEach((view) => {
      view.hidden = view.dataset.projectsView !== selectedKey;
   });
   scheduleReveal();
   document.querySelectorAll("[data-projects-link]").forEach((link) => {
      const isCurrent = link.dataset.linkKey === selectedKey;
      link.classList.toggle("is-current", isCurrent);
      link.classList.toggle("is-active", isCurrent);
      if (link.getAttribute("role") === "tab") {
         link.setAttribute("aria-selected", String(isCurrent));
         link.removeAttribute("aria-current");
      } else if (isCurrent) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
   });

   if (projectsLogo) {
      projectsLogo.src = projectsLogoByView[selectedKey] || projectsLogoByView.current_projects;
      projectsLogo.alt = selectedKey === "pas_projects" ? "Logo vergangene Projekte MIRoKIT" : "Logo aktuelle Projekte MIRoKIT";
   }
}

setProjectsView();

document.querySelectorAll("button[data-projects-link]").forEach((button) =>
   button.addEventListener("click", () => setProjectsView(button.dataset.linkKey || "current_projects")),
);

function getHashTarget(hash) {
   if (!hash || !hash.startsWith("#")) return null;
   try {
      return document.querySelector(hash);
   } catch {
      return null;
   }
}

function goToHash(hash) {
   const target = getHashTarget(hash);
   if (!target) return;

   target.scrollIntoView({
      behavior: "smooth",
      block: "start",
   });

   history.replaceState(null, "", hash);
}
document.querySelectorAll("[data-nav-link]").forEach((a) =>
   a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (href && href.startsWith("#")) {
         e.preventDefault();
         if (href === "#contact" && a.dataset.linkKey) setContactView(a.dataset.linkKey);
         if (href === "#gallery") setGalleryView(a.dataset.linkKey || "gallery-main");
         if (href === "#projects") setProjectsView(a.dataset.linkKey || "current_projects");
         goToHash(href);
         closeDesktopMenus();
         closeMenu();
      }
   }),
);

if (scrollTopControl) {
   const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
   let launchTimer = 0;

   scrollTopControl.addEventListener("click", () => {
      window.clearTimeout(launchTimer);
      scrollTopControl.classList.remove("is-launching");
      void scrollTopControl.offsetWidth;
      scrollTopControl.classList.add("is-launching");

      const behavior = reducedMotion?.matches ? "auto" : "smooth";
      document.getElementById("hero")?.scrollIntoView({ behavior, block: "start" });
      if (location.hash !== "#hero") history.replaceState(null, "", "#hero");

      launchTimer = window.setTimeout(() => scrollTopControl.classList.remove("is-launching"), 780);
   });
}

window.addEventListener("scroll", syncFooterTaskbar, { passive: true });
window.addEventListener("resize", syncReadingProgress, { passive: true });
requestAnimationFrame(syncFooterTaskbar);

window.addEventListener("keydown", (e) => {
   if (document.querySelector(".gallery-media-modal.show, .news-modal.show")) return;

   if (e.key === "Escape") {
      closeMenu();
      closeModal();
   }
});
function openMenu() {
   mobileMenu.classList.add("show");
   backdrop.classList.add("show");
   burger.setAttribute("aria-expanded", "true");
   mobileMenu.setAttribute("aria-hidden", "false");
   document.body.classList.add("menu-open");
}
function closeMenu() {
   mobileMenu.classList.remove("show");
   backdrop.classList.remove("show");
   burger.setAttribute("aria-expanded", "false");
   mobileMenu.setAttribute("aria-hidden", "true");
   document.body.classList.remove("menu-open");
   document.querySelectorAll(".mobile-sub-toggle").forEach((button) => {
      button.setAttribute("aria-expanded", "false");
      button.classList.remove("is-open");
   });
   document.querySelectorAll(".mobile-sub").forEach((submenu) => submenu.classList.remove("open"));
}
burger.addEventListener("click", () => (burger.getAttribute("aria-expanded") === "true" ? closeMenu() : openMenu()));
backdrop.addEventListener("click", closeMenu);
closeBtn.addEventListener("click", closeMenu);
document.querySelectorAll(".mobile-sub-toggle").forEach((btn) =>
   btn.addEventListener("click", () => {
      const submenu = btn.nextElementSibling;
      const isOpen = submenu?.classList.toggle("open") ?? false;
      btn.classList.toggle("is-open", isOpen);
      btn.setAttribute("aria-expanded", String(isOpen));
      submenu?.setAttribute("aria-hidden", String(!isOpen));
   }),
);

const desktopNav = document.querySelector(".desktop-nav");

function closeDesktopMenus() {
   desktopNav?.querySelectorAll(".nav-item.is-open, .submenu-item.is-open").forEach((item) => item.classList.remove("is-open"));
   desktopNav?.querySelectorAll(".submenu-toggle[aria-expanded=\"true\"]").forEach((button) => button.setAttribute("aria-expanded", "false"));
}

desktopNav?.querySelectorAll(".submenu-toggle").forEach((button) => {
   button.addEventListener("click", (event) => {
      event.stopPropagation();
      const item = button.closest(".nav-item, .submenu-item");
      const isOpen = item?.classList.toggle("is-open") ?? false;
      button.setAttribute("aria-expanded", String(isOpen));
      if (isOpen) {
         desktopNav.querySelectorAll(".nav-item.is-open, .submenu-item.is-open").forEach((other) => {
            if (other !== item && !item?.contains(other) && !other.contains(item)) other.classList.remove("is-open");
         });
      }
   });
   button.addEventListener("focus", () => {
      const item = button.closest(".nav-item, .submenu-item");
      item?.classList.add("is-open");
      button.setAttribute("aria-expanded", "true");
   });
});

desktopNav?.addEventListener("pointerleave", closeDesktopMenus);
document.addEventListener("pointerdown", (event) => {
   if (desktopNav && !desktopNav.contains(event.target)) closeDesktopMenus();
});
revealObserver = new IntersectionObserver(
   (es) =>
      es.forEach((e) => {
         if (e.isIntersecting) e.target.classList.add("vis");
      }),
   { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
);
revealElements.forEach((el) => revealObserver.observe(el));
window.addEventListener("scroll", scheduleReveal, { passive: true });
scheduleReveal();
function openModal() {
   modal.classList.add("show");
   modal.setAttribute("aria-hidden", "false");
   document.body.classList.add("menu-open");
   modal.querySelector("input")?.focus();
}
function closeModal() {
   modal.classList.remove("show");
   modal.setAttribute("aria-hidden", "true");
   document.body.classList.remove("menu-open");
}
document.querySelectorAll("[data-open-modal]").forEach((b) => b.addEventListener("click", openModal));
document.querySelector(".modal-close").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
   if (e.target === modal) closeModal();
});
function showToast(msg) {
   toast.textContent = msg;
   toast.classList.add("show");
   setTimeout(() => toast.classList.remove("show"), 2600);
}
document.getElementById("signupForm").addEventListener("submit", (e) => {
   e.preventDefault();
   const fd = new FormData(e.currentTarget);
   const subject = encodeURIComponent(T[currentLang].mail_subject);
   const body = encodeURIComponent(`${T[currentLang].mail_name}: ${fd.get("name")}\n${T[currentLang].mail_email}: ${fd.get("email")}\n\n${T[currentLang].mail_message}:\n${fd.get("message")}`);
   showToast(T[currentLang].toast_sent);
   closeModal();
   location.href = `mailto:info@mirokit.org?subject=${subject}&body=${body}`;
});

// --- #gallery: zugängliche Foto-Lightbox und Video-Modal ---
const galleryImageModal = document.getElementById("galleryImageModal");
const galleryVideoModal = document.getElementById("galleryVideoModal");
let galleryImageButtons = [];
const galleryImageModalImg = galleryImageModal.querySelector(".gallery-image-stage img");
const galleryImageCaption = galleryImageModal.querySelector(".gallery-image-caption");
const galleryVideoCard = galleryVideoModal.querySelector(".gallery-video-modal-card");
const galleryVideoPlayerShell = document.getElementById("galleryVideoPlayerShell");
const galleryVideo = galleryVideoModal.querySelector(".gallery-modal-video");
const galleryYoutube = galleryVideoModal.querySelector(".gallery-modal-youtube");
const galleryVideoStageFeedback = document.getElementById("galleryVideoStageFeedback");
const galleryVideoTitle = document.getElementById("galleryVideoModalTitle");
const galleryVideoNote = document.getElementById("galleryVideoModalNote");
const galleryVideoMeta = document.getElementById("galleryVideoModalMeta");
const galleryVideoControls = document.getElementById("galleryVideoControls");
const galleryVideoPlay = galleryVideoControls.querySelector('[data-video-control="play"]');
const galleryVideoSeek = galleryVideoControls.querySelector('[data-video-control="seek"]');
const galleryVideoSeekWrap = document.getElementById("galleryVideoSeekWrap");
const galleryVideoTime = galleryVideoControls.querySelector('[data-video-control="time"]');
const galleryVideoMute = galleryVideoControls.querySelector('[data-video-control="mute"]');
const galleryVideoVolume = galleryVideoControls.querySelector('[data-video-control="volume"]');
const galleryVideoVolumePercent = galleryVideoControls.querySelector('[data-video-control="volume-percent"]');
const galleryVideoCaptions = galleryVideoControls.querySelector('[data-video-control="captions"]');
const galleryVideoSettingsButton = galleryVideoControls.querySelector('[data-video-control="settings"]');
const galleryVideoSettings = document.getElementById("galleryVideoSettings");
const galleryVideoTrack = document.getElementById("galleryVideoTrack");
const galleryVideoFullscreen = galleryVideoControls.querySelector('[data-video-control="fullscreen"]');
let galleryImageIndex = 0;
let galleryModalTrigger = null;
let galleryVideoFeedbackTimer = 0;
let galleryVideoSelectedTrack = "";

function getGalleryImageButtons() {
   const grid = remoteGalleryGrid && !remoteGalleryGrid.hidden ? remoteGalleryGrid : staticGalleryGrid;
   return grid ? [...grid.querySelectorAll("[data-gallery-image]")] : [];
}

function galleryFocusable(modalEl) {
   return [...modalEl.querySelectorAll('button, [href], input, select, textarea, video[controls], iframe, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && !el.closest("[hidden]"));
}

function renderGalleryImage(index) {
   galleryImageButtons = getGalleryImageButtons();
   if (!galleryImageButtons.length) return;
   galleryImageIndex = (index + galleryImageButtons.length) % galleryImageButtons.length;
   const trigger = galleryImageButtons[galleryImageIndex];
   const image = trigger.querySelector("img");
   galleryImageModalImg.src = image.currentSrc || image.src;
   galleryImageModalImg.alt = image.alt;
   galleryImageCaption.textContent = `${galleryImageIndex + 1} / ${galleryImageButtons.length} — ${trigger.dataset.galleryTitle}`;
}

function openGalleryImageModal(trigger) {
   galleryModalTrigger = trigger;
   renderGalleryImage(getGalleryImageButtons().indexOf(trigger));
   galleryImageModal.classList.add("show");
   galleryImageModal.setAttribute("aria-hidden", "false");
   document.body.classList.add("menu-open");
   galleryImageModal.querySelector(".gallery-modal-close").focus();
}

function closeGalleryImageModal() {
   galleryImageModal.classList.remove("show");
   galleryImageModal.setAttribute("aria-hidden", "true");
   document.body.classList.remove("menu-open");
   galleryModalTrigger?.focus();
}

function showGalleryVideoFeedback(isPaused) {
   if (!galleryVideoStageFeedback || !galleryVideoModal.classList.contains("show")) return;
   window.clearTimeout(galleryVideoFeedbackTimer);
   galleryVideoStageFeedback.textContent = isPaused ? "❚❚" : "▶";
   galleryVideoStageFeedback.classList.remove("is-visible");
   void galleryVideoStageFeedback.offsetWidth;
   galleryVideoStageFeedback.classList.add("is-visible");
   galleryVideoFeedbackTimer = window.setTimeout(() => galleryVideoStageFeedback.classList.remove("is-visible"), 700);
}

function syncGalleryVideoControls() {
   const duration = Number.isFinite(galleryVideo.duration) ? galleryVideo.duration : 0;
   const current = Number.isFinite(galleryVideo.currentTime) ? galleryVideo.currentTime : 0;
   galleryVideoSeek.max = String(duration || 100);
   galleryVideoSeek.value = String(Math.min(current, duration || 100));
   galleryVideoTime.textContent = `${formatVideoDuration(current) || "00:00"} / ${formatVideoDuration(duration) || "00:00"}`;
   galleryVideoPlay.innerHTML = `<i class="fa-solid fa-${galleryVideo.paused ? "play" : "pause"}" aria-hidden="true"></i>`;
   galleryVideoPlay.setAttribute("aria-label", galleryVideo.paused ? "Video abspielen" : "Video pausieren");
   galleryVideoMute.innerHTML = `<i class="fa-solid fa-volume-${galleryVideo.muted || galleryVideo.volume === 0 ? "xmark" : "high"}" aria-hidden="true"></i>`;
   galleryVideoMute.setAttribute("aria-label", galleryVideo.muted || galleryVideo.volume === 0 ? "Ton einschalten" : "Ton ausschalten");
   const seekPercent = duration ? (current / duration) * 100 : 0;
   const volumePercent = Math.max(0, Math.min(100, (galleryVideo.muted ? 0 : galleryVideo.volume) * 100));
   galleryVideoSeek.style.setProperty("--range-fill", `${seekPercent}%`);
   galleryVideoSeekWrap.style.setProperty("--seek-fill", `${seekPercent}%`);
   galleryVideoVolume.style.setProperty("--range-fill", `${volumePercent}%`);
   galleryVideoVolumePercent.textContent = `${Math.round(volumePercent)}%`;
}

function setGalleryVideoTrack(index) {
   const tracks = [...galleryVideo.querySelectorAll("track")];
   const selectedIndex = tracks.some((track, trackIndex) => String(trackIndex) === String(index)) ? String(index) : "";
   if (selectedIndex !== "") galleryVideoSelectedTrack = selectedIndex;
   tracks.forEach((track, trackIndex) => {
      if (track.track) track.track.mode = String(trackIndex) === selectedIndex ? "showing" : "disabled";
   });
   galleryVideoTrack.value = selectedIndex;
   const captionsEnabled = selectedIndex !== "";
   galleryVideoCaptions.disabled = !tracks.length;
   galleryVideoSettingsButton.disabled = !tracks.length;
   galleryVideoCaptions.setAttribute("aria-pressed", String(captionsEnabled));
   galleryVideoCaptions.setAttribute("aria-label", captionsEnabled ? "Untertitel ausschalten" : "Untertitel einschalten");
   galleryVideoCaptions.classList.toggle("is-active", captionsEnabled);
}

function syncGalleryVideoTracks() {
   const tracks = [...galleryVideo.querySelectorAll("track")];
   galleryVideoTrack.innerHTML = '<option value="">Untertitel aus</option>';
   let defaultIndex = "";
   tracks.forEach((track, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = track.label || track.srclang.toUpperCase();
      galleryVideoTrack.append(option);
      if (track.default && defaultIndex === "") defaultIndex = String(index);
   });
   setGalleryVideoTrack(galleryVideoSelectedTrack || defaultIndex);
}

function withVideoAutoplay(url) {
   try {
      const parsed = new URL(url, document.baseURI);
      parsed.searchParams.set("autoplay", "1");
      return parsed.href;
   } catch {
      return url;
   }
}

function openGalleryVideoModal(trigger, { autoplay = true } = {}) {
   galleryModalTrigger = trigger;
   const poster = trigger.dataset.videoPoster || trigger.querySelector("img")?.currentSrc || trigger.closest(".video-card")?.querySelector("img")?.currentSrc || "";
   const source = trigger.dataset.videoSrc;
   const type = trigger.dataset.videoType || "external";
   const embed = trigger.dataset.videoEmbed || "";
   const usesYoutube = type === "youtube" && Boolean(embed);
   const usesHtml5 = Boolean(source);
   galleryVideoCard.dataset.videoRenderer = usesYoutube ? "youtube" : usesHtml5 ? "html5" : "none";
   galleryVideoPlayerShell.hidden = !(usesYoutube || usesHtml5);
   galleryVideo.poster = poster;
   galleryVideoTitle.textContent = trigger.dataset.videoTitle || T[currentLang].gallery_video_modal;
   galleryVideoNote.hidden = usesYoutube || usesHtml5;
   galleryVideoMeta.textContent = [trigger.dataset.videoDuration ? formatVideoDuration(trigger.dataset.videoDuration) : "", trigger.dataset.videoWidth && trigger.dataset.videoHeight ? `${trigger.dataset.videoWidth} × ${trigger.dataset.videoHeight}` : "", type === "youtube" ? "YouTube" : "HTML5"].filter(Boolean).join(" · ");
   galleryVideoMeta.hidden = !galleryVideoMeta.textContent;
   galleryVideo.querySelectorAll("track").forEach((track) => track.remove());
   galleryVideo.removeAttribute("src");
   galleryYoutube.removeAttribute("src");
   if (usesYoutube) {
      galleryVideo.hidden = true;
      galleryVideo.controls = false;
      galleryVideoControls.hidden = true;
      galleryYoutube.hidden = false;
      galleryYoutube.src = autoplay ? withVideoAutoplay(embed) : embed;
   } else {
      galleryYoutube.hidden = true;
      galleryVideo.hidden = !source;
      galleryVideo.controls = false;
      galleryVideoControls.hidden = !source;
      if (source) galleryVideo.src = source;
      try {
         const subtitles = JSON.parse(trigger.dataset.videoSubtitles || "[]");
         subtitles.forEach((subtitle) => {
            if (!subtitle.src) return;
            const track = document.createElement("track");
            track.kind = "subtitles";
            track.src = subtitle.src;
            track.srclang = subtitle.srcLang || subtitle.language || "en";
            track.label = subtitle.label || track.srclang.toUpperCase();
            track.default = Boolean(subtitle.isDefault);
            galleryVideo.append(track);
         });
      } catch { /* malformed optional subtitle metadata must not block playback */ }
      syncGalleryVideoTracks();
      galleryVideo.load();
   }
   galleryVideoModal.classList.add("show");
   galleryVideoModal.setAttribute("aria-hidden", "false");
   document.body.classList.add("menu-open");
   syncGalleryVideoFullscreen();
   if (usesHtml5 && autoplay) {
      const playback = galleryVideo.play();
      playback?.catch(() => { /* browser autoplay policy may require the play button */ });
   }
   (usesYoutube ? galleryYoutube : usesHtml5 ? galleryVideo : galleryVideoModal.querySelector(".gallery-modal-close")).focus();
}

function closeGalleryVideoModal() {
   if (document.fullscreenElement === galleryVideoPlayerShell) {
      const exit = document.exitFullscreen?.();
      exit?.catch(() => { });
   }
   galleryVideo.pause();
   galleryVideoPlayerShell.hidden = true;
   delete galleryVideoCard.dataset.videoRenderer;
   galleryVideo.removeAttribute("src");
   galleryVideo.load();
   galleryVideo.querySelectorAll("track").forEach((track) => track.remove());
   galleryYoutube.removeAttribute("src");
   galleryVideo.hidden = false;
   galleryVideo.controls = true;
   galleryVideoControls.hidden = true;
   galleryYoutube.hidden = true;
   galleryVideoTrack.innerHTML = '<option value="">Untertitel aus</option>';
   galleryVideoCaptions.disabled = false;
   galleryVideoCaptions.setAttribute("aria-pressed", "false");
   galleryVideoCaptions.setAttribute("aria-label", "Untertitel ein oder aus");
   galleryVideoCaptions.classList.remove("is-active");
   galleryVideoSettingsButton.disabled = false;
   galleryVideoSettings.hidden = true;
   galleryVideoSettingsButton.setAttribute("aria-expanded", "false");
   galleryVideoSelectedTrack = "";
   galleryVideoMeta.textContent = "";
   galleryVideoMeta.hidden = true;
   galleryVideoModal.classList.remove("show");
   galleryVideoModal.setAttribute("aria-hidden", "true");
   galleryVideoStageFeedback?.classList.remove("is-visible");
   document.body.classList.remove("menu-open");
   galleryModalTrigger?.focus();
}

galleryVideo.addEventListener("loadedmetadata", () => {
   if (!galleryVideo.duration || !galleryModalTrigger) return;
   galleryVideoMeta.textContent = [formatVideoDuration(galleryVideo.duration), galleryVideo.videoWidth && galleryVideo.videoHeight ? `${galleryVideo.videoWidth} × ${galleryVideo.videoHeight}` : "", "HTML5"].filter(Boolean).join(" · ");
   galleryVideoMeta.hidden = false;
   syncGalleryVideoControls();
});
["timeupdate", "volumechange", "ended"].forEach((eventName) => galleryVideo.addEventListener(eventName, syncGalleryVideoControls));
galleryVideo.addEventListener("play", () => {
   syncGalleryVideoControls();
   showGalleryVideoFeedback(false);
});
galleryVideo.addEventListener("pause", () => {
   syncGalleryVideoControls();
   if (!galleryVideo.ended) showGalleryVideoFeedback(true);
});
galleryVideo.addEventListener("click", () => {
   if (galleryVideo.hidden || galleryVideoCard.dataset.videoRenderer !== "html5") return;
   if (galleryVideo.paused) {
      const playback = galleryVideo.play();
      playback?.catch(() => { });
   } else {
      galleryVideo.pause();
   }
});
galleryVideoPlay.addEventListener("click", () => {
   if (galleryVideo.paused) {
      const playback = galleryVideo.play();
      playback?.catch(() => { });
   } else {
      galleryVideo.pause();
   }
});
galleryVideoSeek.addEventListener("input", () => { galleryVideo.currentTime = Number(galleryVideoSeek.value); });
galleryVideoMute.addEventListener("click", () => { galleryVideo.muted = !galleryVideo.muted; syncGalleryVideoControls(); });
galleryVideoVolume.addEventListener("input", () => { galleryVideo.volume = Number(galleryVideoVolume.value); galleryVideo.muted = galleryVideo.volume === 0; });
galleryVideoCaptions.addEventListener("click", () => {
   const tracks = [...galleryVideo.querySelectorAll("track")];
   if (!tracks.length) return;
   if (galleryVideoTrack.value === "") {
      const defaultIndex = tracks.findIndex((track) => track.default);
      setGalleryVideoTrack(galleryVideoSelectedTrack || (defaultIndex >= 0 ? defaultIndex : 0));
   } else {
      galleryVideoSelectedTrack = galleryVideoTrack.value;
      setGalleryVideoTrack("");
   }
});
galleryVideoSettingsButton.addEventListener("click", () => {
   if (galleryVideoSettingsButton.disabled) return;
   const isOpen = !galleryVideoSettings.hidden;
   galleryVideoSettings.hidden = isOpen;
   galleryVideoSettingsButton.setAttribute("aria-expanded", String(!isOpen));
   if (!isOpen) galleryVideoTrack.focus();
});
galleryVideoTrack.addEventListener("change", () => {
   setGalleryVideoTrack(galleryVideoTrack.value);
});
function syncGalleryVideoFullscreen() {
   const isFullscreen = document.fullscreenElement === galleryVideoPlayerShell;
   galleryVideoFullscreen.innerHTML = `<i class="fa-solid fa-${isFullscreen ? "compress" : "expand"}" aria-hidden="true"></i>`;
   galleryVideoFullscreen.setAttribute("aria-label", isFullscreen ? "Vollbild verlassen" : "Vollbild öffnen");
}

galleryVideoFullscreen.addEventListener("click", async () => {
   try {
      if (document.fullscreenElement) {
         await document.exitFullscreen?.();
      } else {
         await galleryVideoPlayerShell.requestFullscreen?.();
      }
   } catch {
      /* Fullscreen can be denied by the browser or embedding context. */
   }
   syncGalleryVideoFullscreen();
});
document.addEventListener("fullscreenchange", syncGalleryVideoFullscreen);
document.addEventListener("click", (event) => {
   if (galleryVideoSettings.hidden || galleryVideoSettings.contains(event.target) || event.target === galleryVideoSettingsButton) return;
   galleryVideoSettings.hidden = true;
   galleryVideoSettingsButton.setAttribute("aria-expanded", "false");
});

galleryPhotoView?.addEventListener("click", (event) => {
   const button = event.target instanceof Element ? event.target.closest("[data-gallery-image]") : null;
   if (button && galleryPhotoView.contains(button)) openGalleryImageModal(button);
});
document.querySelectorAll("[data-gallery-video]").forEach((button) => button.addEventListener("click", () => openGalleryVideoModal(button, { autoplay: true })));
videoRemoteLibrary?.addEventListener("click", (event) => {
   const button = event.target instanceof Element ? event.target.closest("[data-gallery-video]") : null;
   if (button && videoRemoteLibrary.contains(button)) openGalleryVideoModal(button, { autoplay: true });
});
videoRemoteLibrary?.addEventListener("keydown", (event) => {
   if (!(event.target instanceof Element) || !event.target.matches("article.video-card[data-gallery-video]")) return;
   if (event.key !== "Enter" && event.key !== " ") return;
   event.preventDefault();
   openGalleryVideoModal(event.target, { autoplay: true });
});
galleryImageModal.querySelector(".gallery-modal-close").addEventListener("click", closeGalleryImageModal);
galleryImageModal.querySelector(".gallery-modal-prev").addEventListener("click", () => renderGalleryImage(galleryImageIndex - 1));
galleryImageModal.querySelector(".gallery-modal-next").addEventListener("click", () => renderGalleryImage(galleryImageIndex + 1));
galleryVideoModal.querySelector(".gallery-modal-close").addEventListener("click", closeGalleryVideoModal);
galleryImageModal.addEventListener("click", (e) => {
   if (e.target === galleryImageModal) closeGalleryImageModal();
});
galleryVideoModal.addEventListener("click", (e) => {
   if (e.target === galleryVideoModal) closeGalleryVideoModal();
});
document.addEventListener("keydown", (e) => {
   const activeModal = galleryImageModal.classList.contains("show") ? galleryImageModal : galleryVideoModal.classList.contains("show") ? galleryVideoModal : null;
   if (!activeModal) return;
   if (e.key === "Escape") {
      e.preventDefault();
      activeModal === galleryImageModal ? closeGalleryImageModal() : closeGalleryVideoModal();
      return;
   }
   if (activeModal === galleryImageModal && e.key === "ArrowRight") {
      e.preventDefault();
      renderGalleryImage(galleryImageIndex + 1);
      return;
   }
   if (activeModal === galleryImageModal && e.key === "ArrowLeft") {
      e.preventDefault();
      renderGalleryImage(galleryImageIndex - 1);
      return;
   }
   if (e.key === "Tab") {
      const focusables = galleryFocusable(activeModal);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
         e.preventDefault();
         last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
         e.preventDefault();
         first.focus();
      }
   }
});

// --- #news: Modal mit Vor/Zurück-Navigation zwischen den Karten ---
const newsModal = document.getElementById("newsModal");
const newsModalCard = newsModal.querySelector(".news-modal-card");
const newsModalImg = newsModal.querySelector(".news-modal-image img");
const newsModalCategory = newsModal.querySelector(".news-modal-category");
const newsModalDate = newsModal.querySelector(".news-modal-date");
const newsModalTitle = document.getElementById("newsModalTitle");
const newsModalBody = newsModal.querySelector(".news-modal-body-text");
const newsModalCounter = newsModal.querySelector(".news-modal-counter");
let newsIndex = 0;
let newsOpenedFrom = null;

function renderNewsModal(index) {
   const visible = getVisibleNews();
   if (!visible.length) return;
   newsIndex = (index + visible.length) % visible.length;
   const item = visible[newsIndex];
   newsModalImg.src = item.image;
   newsModalImg.alt = newsText(item, "alt");
   newsModalCategory.textContent = newsText(item, "categoryLabel");
   newsModalCategory.className = `category news-modal-category ${newsCategoryClasses[item.accent] || newsCategoryClasses.blue}`;
   newsModalDate.innerHTML = `<i class="fa-regular fa-calendar" aria-hidden="true"></i> ${escapeHtml(formatNewsDate(item.publishedAt))}`;
   newsModalTitle.textContent = newsText(item, "title");
   newsModalBody.replaceChildren(...(newsText(item, "content") || []).map((paragraph) => {
      const node = document.createElement("p");
      node.textContent = paragraph;
      return node;
   }));
   newsModalCounter.textContent = `${newsIndex + 1} / ${visible.length}`;
}

function openNewsModal(startIndex) {
   newsOpenedFrom = document.activeElement;
   renderNewsModal(startIndex);
   newsModal.classList.add("show");
   newsModal.setAttribute("aria-hidden", "false");
   document.body.classList.add("menu-open");
   newsModal.querySelector(".news-modal-close").focus();
}

function closeNewsModal() {
   newsModal.classList.remove("show");
   newsModal.setAttribute("aria-hidden", "true");
   document.body.classList.remove("menu-open");
   newsOpenedFrom?.focus();
}

function openNewsById(newsId) {
   let visible = getVisibleNews();
   let itemIndex = visible.findIndex((item) => item.id === newsId);
   if (itemIndex < 0) {
      activeNewsFilter = "all";
      newsFilterBtns.forEach((button) => {
         const isActive = button.dataset.filter === "all";
         button.classList.toggle("is-active", isActive);
         button.setAttribute("aria-pressed", String(isActive));
      });
      renderNewsViews();
      visible = getVisibleNews();
      itemIndex = visible.findIndex((item) => item.id === newsId);
   }
   if (itemIndex >= 0) openNewsModal(itemIndex);
}

document.addEventListener("click", (event) => {
   const trigger = event.target instanceof Element ? event.target.closest("[data-news-open]") : null;
   if (!trigger) return;
   event.preventDefault();
   openNewsById(trigger.dataset.newsOpen);
});
document.addEventListener("mirokit:languagechange", () => {
   if (newsModal.classList.contains("show")) renderNewsModal(newsIndex);
});
newsModal.querySelector(".news-modal-close").addEventListener("click", closeNewsModal);
newsModal.querySelector(".news-modal-prev").addEventListener("click", () => renderNewsModal(newsIndex - 1));
newsModal.querySelector(".news-modal-next").addEventListener("click", () => renderNewsModal(newsIndex + 1));
newsModal.addEventListener("click", (e) => {
   if (e.target === newsModal) closeNewsModal();
});
document.addEventListener("keydown", (e) => {
   if (!newsModal.classList.contains("show")) return;
   if (e.key === "Escape") {
      closeNewsModal();
      return;
   }
   if (e.key === "ArrowRight") {
      renderNewsModal(newsIndex + 1);
      return;
   }
   if (e.key === "ArrowLeft") {
      renderNewsModal(newsIndex - 1);
      return;
   }
   if (e.key === "Tab") {
      const focusables = newsModalCard.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0],
         last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
         e.preventDefault();
         last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
         e.preventDefault();
         first.focus();
      }
   }
});

scroller.addEventListener("scroll", () => {
   const max = scroller.scrollHeight - scroller.clientHeight;

   if (progress) {
      progress.style.width = (max ? (scroller.scrollTop / max) * 100 : 0) + "%";
   }
});

window.addEventListener("load", () => {
   if (getHashTarget(location.hash)) setTimeout(() => goToHash(location.hash), 80);
});
