/* global T, currentLang, setLang */
import { ONLINE_PROJECT_TOPICS, isOnlineProjectTopic } from "../../source/scripts/online-project-topics.js";

const byId = (id) => document.getElementById(id);
const grid = byId("onlineProjectPhotoGrid");
const filters = byId("onlineProjectFilters");
const modal = byId("onlineProjectPhotoModal");
const modalImage = byId("onlineProjectModalImage");
const empty = byId("onlineProjectEmpty");
let items = [];
let visibleItems = [];
let activeTopic = "all";
let activeIndex = 0;
let loadState = "loading";
let returnFocus = null;
let previousOverflow = "";
let layoutFrame = 0;
let loadVersion = 0;
const t = (key) => T[currentLang]?.[key] || T.en[key] || key;
const localized = (item, field) => item?.[field]?.[currentLang] || item?.[field]?.en || item?.[field]?.ru || item?.[field]?.de || "";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const topicLabel = (topic) => isOnlineProjectTopic(topic) ? t(`op_nav_${topic}`) : t("op_library_all");

function topicUrl(topic) {
 const url = new URL(window.location.href);
 if (topic === "all") url.searchParams.delete("topic");
 else url.searchParams.set("topic", topic);
 url.searchParams.set("lang", currentLang);
 return url;
}

function readLocation() {
 const params = new URLSearchParams(window.location.search);
 activeTopic = isOnlineProjectTopic(params.get("topic")) ? params.get("topic") : "all";
 const language = params.get("lang");
 if (["ru", "en", "de"].includes(language) && language !== currentLang) setLang(language);
}

function renderFilters() {
 filters.innerHTML = [{ id: "all", icon: "fa-border-all" }, ...ONLINE_PROJECT_TOPICS].map((topic) =>
  `<a class="online-project-filter" href="${escapeHtml(topicUrl(topic.id).pathname + topicUrl(topic.id).search)}" data-topic="${topic.id}"${activeTopic === topic.id ? ' aria-current="page"' : ""}><i class="fa-solid ${topic.icon}" aria-hidden="true"></i><span>${escapeHtml(topicLabel(topic.id))}</span></a>`
 ).join("");
}

// Resize the grid spans after image loads, font changes or viewport resizing.
// Cards stay in source order, so keyboard navigation follows the visual rows.
function scheduleLayout() {
 if (layoutFrame) return;
 layoutFrame = requestAnimationFrame(() => {
  layoutFrame = 0;
  grid.querySelectorAll(".online-project-photo").forEach((card) => {
   const height = card.firstElementChild.getBoundingClientRect().height;
   card.style.gridRowEnd = `span ${Math.ceil(height + 22)}`;
  });
 });
}
const resizeObserver = new ResizeObserver(scheduleLayout);
resizeObserver.observe(grid);

function renderPhotos() {
 resizeObserver.disconnect();
 visibleItems = items.filter((item) => activeTopic === "all" || item.topic === activeTopic);
 byId("onlineProjectPhotosTitle").textContent = topicLabel(activeTopic);
 byId("onlineProjectPhotoCount").textContent = loadState === "loading" ? t("op_library_loading") : loadState === "error" ? t("op_library_unavailable") : `${visibleItems.length} ${t("op_library_images")}`;
 grid.setAttribute("aria-busy", String(loadState === "loading"));
 empty.hidden = loadState === "loading" || (loadState === "ready" && visibleItems.length > 0);
 byId("onlineProjectEmptyText").textContent = t(loadState === "error" ? "op_library_error" : "op_library_empty");
 byId("onlineProjectRetry").hidden = loadState !== "error";
 grid.innerHTML = visibleItems.map((item, index) => {
  const title = localized(item, "title") || "MIRoKIT";
  const label = topicLabel(item.topic);
  return `<article class="online-project-photo"><button class="online-project-photo-button" type="button" data-photo-index="${index}" aria-label="${escapeHtml(t("op_library_open") + ": " + title)}"><span class="online-project-photo-media"><img loading="${index < 10 ? "eager" : "lazy"}" decoding="async" src="${escapeHtml(item.image)}" alt="${escapeHtml(localized(item, "alt") || title)}" /><span class="online-project-photo-expand"><i class="fa-solid fa-expand" aria-hidden="true"></i></span></span><span class="online-project-photo-copy"><small>${escapeHtml(label)}</small><strong>${escapeHtml(title)}</strong></span></button></article>`;
 }).join("");
 grid.querySelectorAll("img").forEach((img) => {
  const finish = () => {
   img.classList.toggle("is-loaded", img.naturalWidth > 0);
   img.classList.toggle("is-broken", img.naturalWidth === 0);
   scheduleLayout();
  };
  img.addEventListener("load", finish, { once: true });
  img.addEventListener("error", finish, { once: true });
  if (img.complete) finish();
 });
 resizeObserver.observe(grid);
 grid.querySelectorAll(".online-project-photo-button").forEach((button) => resizeObserver.observe(button));
 scheduleLayout();
}

function selectTopic(topic, push = true) {
 if (modal.open) modal.close();
 activeTopic = isOnlineProjectTopic(topic) ? topic : "all";
 if (push) history.pushState({}, "", topicUrl(activeTopic));
 renderFilters();
 renderPhotos();
 const selected = filters.querySelector('[aria-current="page"]');
 selected?.focus({ preventScroll: true });
 revealSelectedFilter();
}

function revealSelectedFilter() {
 const selected = filters.querySelector('[aria-current="page"]');
 if (selected && filters.scrollWidth > filters.clientWidth) filters.scrollLeft = selected.offsetLeft - filters.offsetLeft - 4;
}

function updateModal() {
 const item = visibleItems[activeIndex];
 if (!item) return;
 modalImage.hidden = false;
 byId("onlineProjectModalError").hidden = true;
 if (modalImage.getAttribute("src") !== item.image) modalImage.src = item.image;
 modalImage.alt = localized(item, "alt") || localized(item, "title");
 byId("onlineProjectModalTitle").textContent = localized(item, "title") || "MIRoKIT";
 byId("onlineProjectModalSubtitle").textContent = localized(item, "subtitle");
 byId("onlineProjectModalTopic").textContent = topicLabel(item.topic);
 byId("onlineProjectModalCount").textContent = `${activeIndex + 1} / ${visibleItems.length}`;
 byId("onlineProjectModalOriginal").href = item.image;
 byId("onlineProjectModalPrevious").disabled = visibleItems.length < 2;
 byId("onlineProjectModalNext").disabled = visibleItems.length < 2;
}

function openPhoto(index, trigger) {
 if (!visibleItems.length) return;
 activeIndex = (index + visibleItems.length) % visibleItems.length;
 updateModal();
 if (!modal.open) {
  returnFocus = trigger || document.activeElement;
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  modal.showModal();
  byId("onlineProjectModalClose").focus();
 }
}

modalImage.addEventListener("error", () => {
 modalImage.hidden = true;
 byId("onlineProjectModalError").hidden = false;
});
modal.addEventListener("close", () => {
 document.body.style.overflow = previousOverflow;
 modalImage.removeAttribute("src");
 if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
});
byId("onlineProjectModalClose").addEventListener("click", () => modal.close());
byId("onlineProjectModalPrevious").addEventListener("click", () => openPhoto(activeIndex - 1));
byId("onlineProjectModalNext").addEventListener("click", () => openPhoto(activeIndex + 1));
let backdropPointer = false;
modal.addEventListener("pointerdown", (event) => { backdropPointer = event.target === modal; });
modal.addEventListener("click", (event) => { if (backdropPointer && event.target === modal) modal.close(); });
modal.addEventListener("keydown", (event) => {
 if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
  event.preventDefault();
  openPhoto(activeIndex + (event.key === "ArrowLeft" ? -1 : 1));
 }
});
let touchStart = null;
modalImage.addEventListener("touchstart", (event) => { touchStart = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }, { passive: true });
modalImage.addEventListener("touchend", (event) => {
 if (!touchStart || !event.changedTouches.length) return;
 const dx = event.changedTouches[0].clientX - touchStart.x;
 const dy = event.changedTouches[0].clientY - touchStart.y;
 if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) openPhoto(activeIndex + (dx < 0 ? 1 : -1));
 touchStart = null;
}, { passive: true });

filters.addEventListener("click", (event) => {
 const link = event.target.closest("[data-topic]");
 if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
 event.preventDefault();
 selectTopic(link.dataset.topic);
});
grid.addEventListener("click", (event) => {
 const button = event.target.closest("[data-photo-index]");
 if (button) openPhoto(Number(button.dataset.photoIndex), button);
});
byId("onlineProjectRetry").addEventListener("click", loadPhotos);
window.addEventListener("popstate", () => { readLocation(); selectTopic(activeTopic, false); });
document.addEventListener("mirokit:languagechange", () => {
 history.replaceState({}, "", topicUrl(activeTopic));
 renderFilters();
 // Keep the original card connected while the native dialog is open.
 if (modal.open) updateModal();
 else renderPhotos();
 syncTheme();
});

function syncTheme(theme = document.documentElement.dataset.theme || "light") {
 const dark = theme === "dark";
 document.documentElement.dataset.theme = theme;
 document.body.classList.toggle("theme-dark", dark);
 const toggle = document.querySelector("[data-theme-toggle]");
 toggle.setAttribute("aria-pressed", String(dark));
 toggle.setAttribute("aria-label", t(dark ? "theme_light" : "theme_dark"));
 toggle.title = toggle.getAttribute("aria-label");
 toggle.querySelector("i").className = `fa-solid ${dark ? "fa-sun" : "fa-moon"}`;
 toggle.querySelector("span").textContent = toggle.title;
}
document.querySelector("[data-theme-toggle]").addEventListener("click", () => {
 const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
 syncTheme(theme);
 try { localStorage.setItem("mirokitTheme", theme); } catch { /* Theme works without storage. */ }
});

async function loadPhotos() {
 const version = ++loadVersion;
 loadState = "loading";
 renderPhotos();
 try {
  const response = await fetch("../../api/v1/gallery?collection=online-projects", { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Gallery returned ${response.status}`);
  const payload = await response.json();
  if (payload.success === false || !Array.isArray(payload.gallery)) throw new Error("Invalid gallery response");
  if (version !== loadVersion) return;
  items = payload.gallery.filter((item) => item.collection === "online-projects" && item.status === "published" && typeof item.image === "string");
  loadState = "ready";
 } catch {
  if (version !== loadVersion) return;
  items = [];
  loadState = "error";
 }
 renderPhotos();
}

readLocation();
try { syncTheme(localStorage.getItem("mirokitTheme") === "dark" ? "dark" : "light"); } catch { syncTheme(); }
renderFilters();
revealSelectedFilter();
loadPhotos();
