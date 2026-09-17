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

function initDeferredMedia() {
   const images = [...document.querySelectorAll("img[data-src]")];
   const heroPartnerImages = images.filter((image) => image.closest("#hero .partner-showcase"));
   const viewportImages = images.filter((image) => !heroPartnerImages.includes(image));

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
   } else {
      window.setTimeout(() => {
         const viewportLimit = window.innerHeight + 100;
         viewportImages.forEach((image) => {
            const bounds = image.getBoundingClientRect();
            if (bounds.top <= viewportLimit && bounds.bottom >= -100) loadDeferredImage(image);
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
   const newsForGrid = newsGridFull?.hasAttribute("data-news-preview")
      ? [...new Map([...newsHeroItems, ...visibleNews].map((item) => [item.id, item])).values()].slice(0, 5)
      : visibleNews;
   if (newsGridFull) newsGridFull.innerHTML = newsForGrid.map((item, index) => newsCardMarkup(item, index)).join("");
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
   renderRemotePartners();
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

loadRemoteNews();
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

const partnersCountLabels = [...document.querySelectorAll("[data-partners-count]")];
const partnersStatic = document.getElementById("partnersStatic");
const partnersRemote = document.getElementById("partnersRemote");
let partnerItems = [];
loadRemotePartners();

// Carry the selected language into the standalone media libraries.
function updateMediaPageLinks() {
   document.querySelectorAll('a[href^="/page/onlineProjects/"], a[href^="/page/gallery/"]').forEach((link) => {
      const url = new URL(link.href);
      url.searchParams.set("lang", currentLang);
      link.href = url.pathname + url.search;
   });
}
document.addEventListener("mirokit:languagechange", updateMediaPageLinks);
updateMediaPageLinks();

const projectsPanel = document.getElementById("projects");
const projectsViews = [...document.querySelectorAll("[data-projects-view]")];
const projectsLogo = projectsPanel?.querySelector(".section-logo img");
const projectsCurrentGrid = document.getElementById("projectsCurrentGrid");
const projectsPastGrid = document.getElementById("projectsPastGrid");
const projectsFeatureTitle = document.getElementById("projectsFeatureTitle");
const projectsFeatureDescription = document.getElementById("projectsFeatureDescription");
let remoteProjects = [];
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

const projectCategoryLabels = {
   creative: { ru: "Творчество", en: "Creative practice", de: "Kreativität" },
   game: { ru: "Игра и соревнование", en: "Games and competition", de: "Spiel und Wettbewerb" },
   dialogue: { ru: "Диалог и встреча", en: "Dialogue and encounter", de: "Dialog und Begegnung" },
   media: { ru: "Медиа и истории", en: "Media and stories", de: "Medien und Geschichten" },
   network: { ru: "Международная сеть", en: "International network", de: "Internationales Netzwerk" },
   education: { ru: "Образование и методика", en: "Education and method", de: "Bildung und Methodik" },
};
const projectIcons = { creative: "fa-paintbrush", game: "fa-chess-board", dialogue: "fa-people-group", media: "fa-photo-film", network: "fa-globe", education: "fa-book-open-reader" };

function projectText(item, field) {
   const values = item.translations?.[currentLang] || item.translations?.en || item.translations?.ru || {};
   return values[field] || (field === "title" ? item.id : "");
}

function projectCategoryLabel(category) {
   return projectCategoryLabels[category]?.[currentLang] || projectCategoryLabels[category]?.en || category || "MIRoKIT";
}

function projectDateLabel(value) {
   if (!value) return "";
   return new Intl.DateTimeFormat({ ru: "ru-RU", en: "en-GB", de: "de-DE" }[currentLang] || "en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function projectPhaseLabel(phase) {
   return ({ current: { ru: "Сейчас", en: "Current", de: "Aktuell" }, upcoming: { ru: "Скоро", en: "Upcoming", de: "Demnächst" }, past: { ru: "Архив", en: "Archive", de: "Archiv" } }[phase]?.[currentLang] || phase);
}

function projectCardMarkup(item, index) {
   const title = projectText(item, "title");
   const description = projectText(item, "description");
   const alt = projectText(item, "alt");
   const phase = item.phase === "past" ? "past" : item.phase === "upcoming" ? "upcoming" : "current";
   const image = item.image ? `<img loading="lazy" data-src="${escapeHtml(item.image)}" alt="${escapeHtml(alt)}" />` : `<i class="fa-solid ${projectIcons[item.category] || projectIcons.creative}" aria-hidden="true"></i>`;
   const link = item.linkUrl || "#contact";
   const linkAttrs = link.startsWith("/") || link.startsWith("#") ? `data-nav-link${link === "#contact" ? ' data-link-key="main-contact"' : ""}` : 'target="_blank" rel="noopener noreferrer"';
   const dateRange = `${projectDateLabel(item.startDate)}${item.endDate ? ` – ${projectDateLabel(item.endDate)}` : ""}`;
   const cardClass = index === 0 && phase !== "past" ? " project-card--wide" : "";
   return `<article class="project-card project-card--remote${cardClass} fu d${Math.min(index + 1, 4)}"><a class="project-shot ${item.image ? "project-shot--photo" : `project-shot--icon project-shot--${escapeHtml(item.accent || "blue")}`}" href="${escapeHtml(link)}" ${linkAttrs} aria-label="${escapeHtml(title)}">${image}<span class="project-status project-status--${phase}"><i class="fa-solid ${phase === "past" ? "fa-check" : phase === "upcoming" ? "fa-clock" : "fa-satellite-dish"}" aria-hidden="true"></i> ${escapeHtml(projectPhaseLabel(phase))}</span></a><div class="project-body"><span class="project-chip">${escapeHtml(projectCategoryLabel(item.category))}</span><h3>${escapeHtml(title)}</h3>${description ? `<p>${escapeHtml(description)}</p>` : ""}<div class="project-meta"><span>${escapeHtml(dateRange || projectPhaseLabel(phase))}</span><span>MIRoKIT</span></div><div class="project-actions"><a class="mini-btn mini-primary" href="${escapeHtml(link)}" ${linkAttrs}>${escapeHtml(currentLang === "de" ? "Projekt öffnen" : currentLang === "ru" ? "Открыть проект" : "Open project")}</a></div></div></article>`;
}

function renderRemoteProjects() {
   if (!projectsCurrentGrid || !projectsPastGrid) return;
   const current = remoteProjects.filter((item) => item.phase !== "past");
   const past = remoteProjects.filter((item) => item.phase === "past");
   projectsCurrentGrid.innerHTML = current.length ? current.map(projectCardMarkup).join("") : `<p class="projects-empty">${escapeHtml(currentLang === "de" ? "Noch keine aktuellen Projekte veröffentlicht." : currentLang === "ru" ? "Актуальных проектов пока нет." : "No current projects have been published yet.")}</p>`;
   projectsPastGrid.innerHTML = past.length ? past.map(projectCardMarkup).join("") : `<p class="projects-empty">${escapeHtml(currentLang === "de" ? "Noch keine vergangenen Projekte im Archiv." : currentLang === "ru" ? "В архиве пока нет завершённых проектов." : "No past projects are in the archive yet.")}</p>`;
   if (projectsFeatureTitle && current[0]) projectsFeatureTitle.textContent = projectText(current[0], "title");
   if (projectsFeatureDescription && current[0]) projectsFeatureDescription.textContent = projectText(current[0], "description");
   const stats = projectsPanel?.querySelectorAll(".projects-live-stats dt");
   if (stats?.length) {
      stats[0].textContent = String(current.length);
      stats[1].textContent = String(past.length);
      stats[2].textContent = String(remoteProjects.filter((item) => item.featured).length);
   }
   observeDeferredImages(projectsPanel || document);
   registerRevealElements(projectsCurrentGrid);
   registerRevealElements(projectsPastGrid);
}

async function loadRemoteProjects() {
   if (!projectsCurrentGrid || !projectsPastGrid) return;
   try {
      const response = await fetch("/api/v1/projects", { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error(`Projects API returned ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.projects)) throw new Error("Projects API returned invalid data");
      remoteProjects = payload.projects.filter((item) => item?.id && item?.startDate && item?.translations);
      renderRemoteProjects();
   } catch (error) {
      console.info("[MIRoKIT] Using bundled projects fallback:", error.message);
   }
}

document.querySelectorAll("button[data-projects-link]").forEach((button) =>
   button.addEventListener("click", () => setProjectsView(button.dataset.linkKey || "current_projects")),
);

document.addEventListener("mirokit:languagechange", () => {
   if (remoteProjects.length) renderRemoteProjects();
});

loadRemoteProjects();

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
   if (document.querySelector(".news-modal.show")) return;

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
