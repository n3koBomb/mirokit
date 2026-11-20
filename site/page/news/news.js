import { MIRoKIT_NEWS } from "../../source/scripts/news-data.js";
import { NEWS_COPY, publicNews, newsCard, newsText, newsCategory, installNewsImageFallback } from "../../source/scripts/news-presentation.js";

const grid = document.getElementById("newsGrid");
const featured = document.getElementById("newsFeatured");
const filters = document.getElementById("newsFilters");
const search = document.getElementById("newsSearch");
const sort = document.getElementById("newsSort");
const clear = document.getElementById("newsClear");
const loadState = document.getElementById("newsLoadState");
const retry = document.getElementById("newsRetry");
const params = new URLSearchParams(location.search);
const state = { items: [], filter: params.get("category") || "all", query: (params.get("q") || "").slice(0, 200), sort: ["newest", "featured", "title"].includes(params.get("sort")) ? params.get("sort") : "newest", loading: true, fallback: false };
search.value = state.query;
sort.value = state.sort;
let restoring = true;
history.scrollRestoration = "manual";
const scrollKey = () => `mirokitNewsScroll:${location.pathname}${location.search}`;
let savedScroll = Number(history.state?.newsScroll) || 0;
try { savedScroll = Number(sessionStorage.getItem(scrollKey())) || savedScroll; } catch { /* history state still works */ }

function rememberScroll() {
  savedScroll = window.scrollY;
  history.replaceState({ ...history.state, newsScroll: window.scrollY }, "");
  try { sessionStorage.setItem(scrollKey(), String(window.scrollY)); } catch { /* history state still works */ }
}
async function restoreScroll() {
  if (!savedScroll) { restoring = false; return; }
  await Promise.race([
    Promise.allSettled([...document.querySelectorAll("#newsFeatured img")].map((img) => img.decode())),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  requestAnimationFrame(() => requestAnimationFrame(() => { window.scrollTo({ top: savedScroll, behavior: "instant" }); restoring = false; }));
}
function writeUrl() {
  const url = new URL(location.href);
  url.searchParams.set("lang", currentLang);
  for (const [name, value] of [["category", state.filter === "all" ? "" : state.filter], ["q", state.query], ["sort", state.sort === "newest" ? "" : state.sort]]) {
    if (value) url.searchParams.set(name, value); else url.searchParams.delete(name);
  }
  history.replaceState(history.state, "", url);
}
function renderFilters(items) {
  const categories = [...new Set(items.map((item) => item.category))];
  if (!state.loading && state.filter !== "all" && !categories.includes(state.filter)) state.filter = "all";
  const copy = NEWS_COPY[currentLang];
  filters.replaceChildren(...["all", ...categories].map((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.filter = category;
    button.textContent = category === "all" ? copy.all : copy.categories[category] || newsCategory(items.find((item) => item.category === category), currentLang);
    button.classList.toggle("is-active", state.filter === category);
    button.setAttribute("aria-pressed", String(state.filter === category));
    return button;
  }));
}
function render() {
  const lang = currentLang, copy = NEWS_COPY[lang];
  const items = publicNews(state.items);
  renderFilters(items);
  const query = state.query.toLocaleLowerCase(lang);
  const visible = items.filter((item) => (state.filter === "all" || item.category === state.filter) && (!query || [newsText(item, "title", lang), newsText(item, "summary", lang), newsCategory(item, lang)].join(" ").toLocaleLowerCase(lang).includes(query)));
  visible.sort((a, b) => {
    if (state.sort === "title") return newsText(a, "title", lang).localeCompare(newsText(b, "title", lang), lang);
    if (state.sort === "featured") { const difference = (Number(a.featured) || Infinity) - (Number(b.featured) || Infinity); if (difference && Number.isFinite(difference)) return difference; if (a.featured && !b.featured) return -1; if (!a.featured && b.featured) return 1; }
    return b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id);
  });
  const [lead, ...rest] = visible;
  featured.innerHTML = lead ? newsCard(lead, lang, true) : "";
  grid.innerHTML = rest.map((item) => newsCard(item, lang)).join("");
  grid.setAttribute("aria-busy", String(state.loading));
  document.getElementById("newsArchiveTitle").textContent = copy.title;
  document.getElementById("newsIntroduction").textContent = copy.intro;
  document.getElementById("newsCount").textContent = state.loading ? "" : `${visible.length} · ${copy.news}`;
  const empty = document.getElementById("newsEmpty");
  empty.hidden = state.loading || visible.length > 0;
  empty.textContent = copy.empty;
  document.getElementById("newsLoadMessage").textContent = state.loading ? copy.loading : state.fallback ? copy.fallback : "";
  loadState.hidden = !state.loading && !state.fallback;
  retry.hidden = !state.fallback || state.loading;
  retry.textContent = copy.retry;
  clear.hidden = !state.query && state.filter === "all";
  document.title = `${copy.title} — MIRoKIT`;
  document.querySelector('meta[name="description"]').content = copy.intro;
  document.querySelector('meta[property="og:title"]').content = copy.title;
  document.querySelector('meta[property="og:description"]').content = copy.intro;
  writeUrl();
  const canonical = new URL("/news/", location.origin);
  canonical.search = `?lang=${lang}`;
  document.querySelector('link[rel="canonical"]').href = canonical;
  document.querySelector('meta[property="og:url"]').content = canonical.href;
  installNewsImageFallback(document.getElementById("newsArchive"));
}
async function load() {
  state.loading = true;
  render();
  const controller = new AbortController(), timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch("/api/v1/news", { headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error("News unavailable");
    const payload = await response.json();
    if (!Array.isArray(payload.news)) throw new Error("Invalid news response");
    state.items = payload.news;
    state.fallback = false;
  } catch {
    state.items = MIRoKIT_NEWS;
    state.fallback = true;
  } finally {
    clearTimeout(timeout);
    state.loading = false;
    render();
    if (restoring) restoreScroll();
  }
}
filters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  render();
  [...filters.querySelectorAll("[data-filter]")].find((candidate) => candidate.dataset.filter === state.filter)?.focus();
});
search.addEventListener("input", () => { state.query = search.value.trim(); render(); });
sort.addEventListener("change", () => { state.sort = sort.value; render(); });
clear.addEventListener("click", () => { state.query = ""; state.filter = "all"; search.value = ""; render(); search.focus(); });
retry.addEventListener("click", load);
document.addEventListener("mirokit:languagechange", render);
window.addEventListener("pagehide", rememberScroll);
window.addEventListener("pageshow", (event) => { if (event.persisted) restoreScroll(); });
document.addEventListener("click", (event) => { if (event.target.closest("a[href]")) rememberScroll(); }, { capture: true });
load();
