/* News archive page: one public feed for both bundled fallback and D1 content. */
const grid = document.getElementById("newsGrid");
const empty = document.getElementById("newsEmpty");
const count = document.getElementById("newsCount");
const clear = document.getElementById("newsClear");
const search = document.getElementById("newsSearch");
const suggestions = document.getElementById("newsSuggestions");
const sort = document.getElementById("newsSort");
const filters = [...document.querySelectorAll("[data-filter]")];
const dialog = document.getElementById("newsViewer");
const dialogImage = document.getElementById("newsViewerImage");
const dialogCategory = document.getElementById("newsViewerCategory");
const dialogDate = document.getElementById("newsViewerDate");
const dialogTitle = document.getElementById("newsViewerTitle");
const dialogBody = document.getElementById("newsViewerBody");
const dialogCounter = document.getElementById("newsViewerCounter");
const themeToggles = [...document.querySelectorAll("[data-theme-toggle]")];

const categoryKeys = {
  event: "news_category_events",
  interview: "news_category_interview",
  photo: "news_category_photo",
  announce: "news_category_announce",
};
const accents = { blue: "nw-blue", red: "nw-red", green: "nw-green", amber: "nw-amber", violet: "nw-violet" };
const state = { items: [...(typeof MIRoKIT_NEWS !== "undefined" ? MIRoKIT_NEWS : [])], filter: "all", query: "", sort: "newest", visible: [], activeIndex: 0 };

function text(item, field) {
  const value = item?.[field];
  if (field === "categoryLabel" && !value) {
    const key = categoryKeys[item?.category];
    return (key && (T[currentLang]?.[key] || T.en?.[key])) || item?.category || "News";
  }
  if (value && typeof value === "object") return value[currentLang] || value.en || value.ru || "";
  return String(value || "");
}

function escapeHtml(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value ?? "").replace(/[&<>"']/g, (character) => entities[character]);
}

function mediaUrl(value) {
  const source = String(value || "");
  if (source.startsWith("./public/")) return `/${source.slice(2)}`;
  if (source.startsWith("public/")) return `/${source}`;
  return source;
}

function dateValue(value) {
  return new Date(`${value}T12:00:00`).getTime();
}

function dateLabel(value) {
  const locale = { ru: "ru-RU", en: "en-GB", de: "de-DE" }[currentLang] || "en-GB";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function published(item) {
  return item?.publishedAt && dateValue(item.publishedAt) <= Date.now();
}

function matches(item) {
  if (!published(item)) return false;
  if (state.filter !== "all" && item.category !== state.filter) return false;
  if (!state.query) return true;
  const haystack = [text(item, "title"), text(item, "summary"), text(item, "categoryLabel")].join(" ").toLocaleLowerCase();
  return haystack.includes(state.query.toLocaleLowerCase());
}

function sorted(items) {
  return [...items].sort((a, b) => {
    if (state.sort === "title") return text(a, "title").localeCompare(text(b, "title"), currentLang);
    if (state.sort === "featured") {
      const aRank = Number(a.featured) || Number.POSITIVE_INFINITY;
      const bRank = Number(b.featured) || Number.POSITIVE_INFINITY;
      if (aRank !== bRank) return aRank - bRank;
    }
    return dateValue(b.publishedAt) - dateValue(a.publishedAt) || String(a.id).localeCompare(String(b.id));
  });
}

function card(item, index) {
  const accent = accents[item.accent] || accents.blue;
  const featured = Number(item.featured) > 0;
  const title = text(item, "title");
  const category = text(item, "categoryLabel");
  const image = mediaUrl(item.image);
  return `<article class="nw-card${featured ? " is-featured" : ""} ${accent}">
    <button type="button" class="nw-card-button" data-news-open="${escapeHtml(item.id)}" aria-label="${escapeHtml(`${T[currentLang]?.news_full || "Read in full"}: ${title}`)}">
      <span class="nw-card-media"><img src="${escapeHtml(image)}" alt="${escapeHtml(text(item, "alt"))}" loading="lazy" /><span class="nw-card-number">${String(index + 1).padStart(2, "0")}</span><span class="nw-card-category">${escapeHtml(category)}</span></span>
      <span class="nw-card-body"><span class="nw-card-date">${escapeHtml(dateLabel(item.publishedAt))}</span><strong>${escapeHtml(title)}</strong><span class="nw-card-summary">${escapeHtml(text(item, "summary"))}</span><span class="nw-read">${escapeHtml(T[currentLang]?.news_full || "Read in full")} <i aria-hidden="true">↗</i></span></span>
    </button>
  </article>`;
}

function renderSuggestions() {
  const active = document.activeElement === search;
  const items = active ? state.visible.slice(0, 3) : [];
  suggestions.innerHTML = items.map((item, index) => `<button type="button" role="option" class="nw-search-suggestion" data-suggestion-index="${index}"><span>${escapeHtml(text(item, "categoryLabel"))}</span><strong>${escapeHtml(text(item, "title"))}</strong></button>`).join("");
  suggestions.hidden = !items.length;
  search.setAttribute("aria-expanded", String(Boolean(items.length)));
}

function render() {
  state.visible = sorted(state.items.filter(matches));
  grid.innerHTML = state.visible.map(card).join("");
  renderSuggestions();
  grid.setAttribute("aria-busy", "false");
  empty.hidden = state.visible.length > 0;
  clear.hidden = !state.query;
  count.textContent = `${state.visible.length} · ${T[currentLang]?.news_title || "News"}`;
}

function openItem(id) {
  const index = state.visible.findIndex((item) => item.id === id);
  if (index < 0) return;
  state.activeIndex = index;
  renderDialog();
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function renderDialog() {
  const item = state.visible[state.activeIndex];
  if (!item) return;
  dialogImage.src = mediaUrl(item.image);
  dialogImage.alt = text(item, "alt");
  dialogCategory.textContent = text(item, "categoryLabel");
  dialogCategory.className = `nw-dialog-category ${accents[item.accent] || accents.blue}`;
  dialogDate.textContent = dateLabel(item.publishedAt);
  dialogTitle.textContent = text(item, "title");
  dialogBody.replaceChildren(...(text(item, "content") || []).map((paragraph) => {
    const node = document.createElement("p");
    node.textContent = paragraph;
    return node;
  }));
  dialogCounter.textContent = `${state.activeIndex + 1} / ${state.visible.length}`;
}

function syncTheme() {
  let theme = "light";
  try { theme = localStorage.getItem("mirokitTheme") === "dark" ? "dark" : "light"; } catch { /* current-page theme still works */ }
  document.body.classList.toggle("theme-dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
  const label = T[currentLang]?.[theme === "dark" ? "theme_light" : "theme_dark"] || (theme === "dark" ? "Light theme" : "Dark theme");
  themeToggles.forEach((toggle) => {
    toggle.setAttribute("aria-pressed", String(theme === "dark"));
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
    const labelNode = toggle.querySelector(".theme-toggle-label");
    if (labelNode) labelNode.textContent = label;
  });
}

themeToggles.forEach((toggle) => toggle.addEventListener("click", () => {
  const next = document.body.classList.contains("theme-dark") ? "light" : "dark";
  try { localStorage.setItem("mirokitTheme", next); } catch { /* ignored */ }
  document.body.classList.toggle("theme-dark", next === "dark");
  document.documentElement.dataset.theme = next;
  syncTheme();
}));

filters.forEach((button) => button.addEventListener("click", () => {
  state.filter = button.dataset.filter || "all";
  filters.forEach((candidate) => {
    const active = candidate === button;
    candidate.classList.toggle("is-active", active);
    candidate.setAttribute("aria-pressed", String(active));
  });
  render();
}));
search.addEventListener("input", () => { state.query = search.value.trim(); render(); });
search.addEventListener("focus", renderSuggestions);
search.addEventListener("blur", () => window.setTimeout(renderSuggestions, 120));
suggestions.addEventListener("mousedown", (event) => event.preventDefault());
suggestions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-suggestion-index]");
  if (!button) return;
  suggestions.hidden = true;
  search.setAttribute("aria-expanded", "false");
  openItem(state.visible[Number(button.dataset.suggestionIndex)]?.id);
});
sort.addEventListener("change", () => { state.sort = sort.value; render(); });
clear.addEventListener("click", () => { search.value = ""; state.query = ""; search.focus(); render(); });
grid.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-news-open]");
  if (trigger) openItem(trigger.dataset.newsOpen);
});
document.getElementById("newsClose").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
document.getElementById("newsPrevious").addEventListener("click", () => { state.activeIndex = (state.activeIndex - 1 + state.visible.length) % state.visible.length; renderDialog(); });
document.getElementById("newsNext").addEventListener("click", () => { state.activeIndex = (state.activeIndex + 1) % state.visible.length; renderDialog(); });
document.addEventListener("keydown", (event) => {
  if (!dialog.open) return;
  if (event.key === "ArrowLeft") document.getElementById("newsPrevious").click();
  if (event.key === "ArrowRight") document.getElementById("newsNext").click();
});
document.addEventListener("mirokit:languagechange", () => { syncTheme(); render(); if (dialog.open) renderDialog(); });

syncTheme();
render();

fetch("/api/v1/news", { headers: { Accept: "application/json" }, cache: "no-store" })
  .then((response) => { if (!response.ok) throw new Error(`News API returned ${response.status}`); return response.json(); })
  .then((payload) => {
    if (!Array.isArray(payload.news)) throw new Error("News API returned invalid data");
    state.items = payload.news.filter((item) => item?.id && item?.publishedAt && item?.image && item?.title && item?.summary && item?.content);
    render();
  })
  .catch((error) => console.info("[MIRoKIT] Using bundled news fallback:", error.message));
