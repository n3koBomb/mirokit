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
let activeMedia = "photos";
const mediaStates = { photos: "loading", videos: "loading", documents: "loading" };
let activeIndex = 0;
let loadState = "loading";
let returnFocus = null;
let previousOverflow = "";
let layoutFrame = 0;
let loadVersion = 0;
const activeVideoStateWriters = new Set();
window.addEventListener("pagehide", () => activeVideoStateWriters.forEach((save) => save()));
const t = (key) => T[currentLang]?.[key] || T.en[key] || key;
const localized = (item, field) => item?.[field]?.[currentLang] || item?.[field]?.en || item?.[field]?.ru || item?.[field]?.de || "";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const topicLabel = (topic) => isOnlineProjectTopic(topic) ? t(`op_nav_${topic}`) : t("op_library_all");

function topicUrl(topic) {
 const url = new URL(window.location.href);
 if (topic === "all") url.searchParams.delete("topic");
 else url.searchParams.set("topic", topic);
 url.searchParams.set("lang", currentLang);
 if (activeMedia === "photos") url.searchParams.delete("media");
 else url.searchParams.set("media", activeMedia);
 return url;
}

function readLocation() {
 const params = new URLSearchParams(window.location.search);
 activeTopic = isOnlineProjectTopic(params.get("topic")) ? params.get("topic") : "all";
 activeMedia = ["videos", "documents"].includes(params.get("media")) ? params.get("media") : "photos";
 const language = params.get("lang");
 if (["ru", "en", "de"].includes(language) && language !== currentLang) setLang(language);
}

function renderFilters() {
 byId("onlineProjectMediaNav").innerHTML = ["photos", "videos", "documents"].map((kind) => {
  const url = topicUrl(activeTopic);
  if (kind === "photos") url.searchParams.delete("media");
  else url.searchParams.set("media", kind);
  return `<a href="${escapeHtml(url.pathname + url.search)}" data-media="${kind}"${activeMedia === kind ? ' aria-current="page"' : ""}>${escapeHtml(t(`op_media_${kind}`))}</a>`;
 }).join("");
 filters.hidden = false;
 filters.innerHTML = [{ id: "all", icon: "fa-border-all" }, ...ONLINE_PROJECT_TOPICS].map((topic) =>
  `<a class="online-project-filter" href="${escapeHtml(topicUrl(topic.id).pathname + topicUrl(topic.id).search)}" data-topic="${topic.id}"${activeTopic === topic.id ? ' aria-current="page"' : ""}><i class="fa-solid ${topic.icon}" aria-hidden="true"></i><span>${escapeHtml(topicLabel(topic.id))}</span></a>`
 ).join("");
}

function createPlayerButton(control, label, text) {
 const button = document.createElement("button");
 button.type = "button";
 button.dataset.videoControl = control;
 button.setAttribute("aria-label", label);
 button.textContent = text;
 return button;
}

function savedVideoState(url) {
 try {
  const value = JSON.parse(localStorage.getItem(`mirokitOnlineProjectVideo:${url}`) || "null");
  return value && typeof value === "object" ? value : {};
 } catch { return {}; }
}

function createOnlineProjectPlayer(item, title) {
 const player = document.createElement("div");
 player.className = "ga-video-player online-project-video-player";
 const mediaStage = document.createElement("div");
 mediaStage.className = "ga-video-stage";
 const video = document.createElement("video");
 video.className = "ga-video-element";
 video.playsInline = true;
 video.preload = "metadata";
 video.tabIndex = 0;
 video.controls = false;
 video.setAttribute("aria-label", title);
 if (item.thumbnail) video.poster = item.thumbnail;
 video.src = item.url;
 mediaStage.append(video);
 player.append(mediaStage);

 const controls = document.createElement("div");
 controls.className = "ga-video-controls";
 controls.setAttribute("aria-label", "Video controls");
 const play = createPlayerButton("play", "Play video", "▶");
 const time = document.createElement("span");
 time.dataset.videoControl = "time";
 const seekWrap = document.createElement("span");
 seekWrap.className = "ga-video-seek";
 const seek = document.createElement("input");
 seek.type = "range"; seek.min = "0"; seek.max = "100"; seek.step = "0.1"; seek.value = "0";
 seek.dataset.videoControl = "seek"; seek.setAttribute("aria-label", "Video position");
 seekWrap.append(seek);
 const mute = createPlayerButton("mute", "Mute video", "🔊");
 const volumeWrap = document.createElement("span");
 volumeWrap.className = "ga-video-volume-control";
 const volume = document.createElement("input");
 volume.type = "range"; volume.min = "0"; volume.max = "1"; volume.step = "0.05"; volume.value = "1";
 volume.dataset.videoControl = "volume"; volume.setAttribute("aria-label", "Volume");
 const volumeOutput = document.createElement("output");
 volumeOutput.dataset.videoControl = "volume-percent"; volumeOutput.textContent = "100%";
 volumeWrap.append(volume, volumeOutput);
 const fullscreen = createPlayerButton("fullscreen", "Open fullscreen", "⛶");
 controls.append(play, time, seekWrap, mute, volumeWrap, fullscreen);
 player.append(controls);

 const stored = savedVideoState(item.url);
 let lastVolume = Number.isFinite(stored.volume) && stored.volume > 0 ? stored.volume : 1;
 video.volume = Number.isFinite(stored.volume) ? Math.max(0, Math.min(1, stored.volume)) : 1;
 video.muted = Boolean(stored.muted);
 let saveTimer = 0;
 let lastProgressWrite = 0;
 const storeState = (includeTime = true) => {
  try {
   const state = savedVideoState(item.url);
   state.volume = video.volume;
   state.muted = video.muted;
   if (includeTime && Number.isFinite(video.currentTime)) state.currentTime = video.currentTime;
   localStorage.setItem(`mirokitOnlineProjectVideo:${item.url}`, JSON.stringify(state));
  } catch { /* Storage can be unavailable in private browsing. */ }
 };
 const persistProgress = () => {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => storeState(), 800);
 };
 const formatTime = (value) => {
  if (!Number.isFinite(value) || value < 0) return "00:00";
  const seconds = Math.floor(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
 };
 const sync = () => {
  const total = Number.isFinite(video.duration) ? video.duration : 0;
  const current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  seek.max = String(total || 100);
  seek.value = String(Math.min(current, total || 100));
  time.textContent = `${formatTime(current)} / ${formatTime(total)}`;
  play.textContent = video.paused ? "▶" : "❚❚";
  play.setAttribute("aria-label", video.paused ? "Play video" : "Pause video");
  const percent = Math.round((video.muted ? 0 : video.volume) * 100);
  volume.value = String(video.volume);
  volumeOutput.textContent = `${percent}%`;
  mute.textContent = video.muted || video.volume === 0 ? "🔇" : "🔊";
  mute.setAttribute("aria-label", video.muted || video.volume === 0 ? "Unmute video" : "Mute video");
  seek.style.setProperty("--range-fill", `${total ? current / total * 100 : 0}%`);
  volume.style.setProperty("--range-fill", `${percent}%`);
 };
 const togglePlayback = () => video.paused ? video.play().catch(() => {}) : video.pause();
 play.addEventListener("click", togglePlayback);
 video.addEventListener("click", togglePlayback);
 video.addEventListener("keydown", (event) => {
  if (event.key === " " || event.key === "Enter") { event.preventDefault(); togglePlayback(); }
 });
 seek.addEventListener("input", () => { video.currentTime = Number(seek.value); sync(); persistProgress(); });
 mute.addEventListener("click", () => {
  video.muted = !video.muted;
  if (!video.muted && video.volume === 0) video.volume = lastVolume || 0.5;
  sync(); storeState(false);
 });
 volume.addEventListener("input", () => {
  video.volume = Number(volume.value);
  lastVolume = video.volume || lastVolume;
  video.muted = video.volume === 0;
  sync(); storeState(false);
 });
 fullscreen.addEventListener("click", async () => {
  try {
   if (document.fullscreenElement) await document.exitFullscreen();
   else await player.requestFullscreen();
  } catch { /* Browser may deny fullscreen. */ }
 });
 video.addEventListener("loadedmetadata", () => {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (Number.isFinite(stored.currentTime) && stored.currentTime > 0 && (!duration || stored.currentTime < duration - 1)) video.currentTime = stored.currentTime;
  sync();
 });
 ["timeupdate", "volumechange", "loadedmetadata", "play", "pause", "ended"].forEach((name) => video.addEventListener(name, sync));
 video.addEventListener("timeupdate", () => {
  if (video.currentTime - lastProgressWrite >= 3) {
   lastProgressWrite = video.currentTime;
   storeState();
  }
 });
 video.addEventListener("volumechange", () => storeState(false));
 const saveBeforeRemoval = () => { window.clearTimeout(saveTimer); storeState(); };
 activeVideoStateWriters.add(saveBeforeRemoval);
 player.saveOnlineVideoState = saveBeforeRemoval;
 sync();
 return player;
}

// Resize the grid spans after image loads, font changes or viewport resizing.
// Cards stay in source order, so keyboard navigation follows the visual rows.
function scheduleLayout() {
 if (activeMedia !== "photos") return;
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
 grid.querySelectorAll(".online-project-video-player").forEach((player) => {
  player.saveOnlineVideoState?.();
  activeVideoStateWriters.delete(player.saveOnlineVideoState);
  player.querySelector("video")?.pause();
 });
 grid.querySelectorAll("video").forEach((video) => video.pause());
 loadState = mediaStates[activeMedia];
 visibleItems = items.filter((item) => (item.mediaKind || "photos") === activeMedia && (activeTopic === "all" || item.topic === activeTopic));
 grid.classList.toggle("online-project-resource-grid", activeMedia !== "photos");
 byId("onlineProjectMediaEyebrow").removeAttribute("data-key");
 byId("onlineProjectMediaEyebrow").textContent = t(`op_media_${activeMedia}`);
 byId("onlineProjectPhotosTitle").textContent = topicLabel(activeTopic);
 const countKey = activeMedia === "photos" ? "op_library_images" : visibleItems.length === 1 ? `op_media_${activeMedia}_one` : `op_media_${activeMedia}`;
 byId("onlineProjectPhotoCount").textContent = loadState === "loading" ? t("op_library_loading") : loadState === "error" ? t("op_library_unavailable") : `${visibleItems.length} ${t(countKey)}`;
 grid.setAttribute("aria-busy", String(loadState === "loading"));
 empty.hidden = loadState === "loading" || (loadState === "ready" && visibleItems.length > 0);
 byId("onlineProjectEmptyText").textContent = t(loadState === "error" ? "op_library_error" : "op_library_empty");
 byId("onlineProjectRetry").hidden = loadState !== "error";
 grid.innerHTML = visibleItems.map((item, index) => {
  const title = localized(item, "title") || "MIRoKIT";
  const label = topicLabel(item.topic);
  if (activeMedia !== "photos") {
   const description = localized(item, "description");
   const copy = `<div class="online-project-resource-copy"><small>${escapeHtml(label)}</small><h3>${escapeHtml(title)}</h3>${description ? `<p>${escapeHtml(description)}</p>` : ""}</div>`;
   if (activeMedia === "documents") return `<article class="online-project-resource online-project-document"><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(title + " · " + t("op_media_new_tab"))}"><span class="online-project-document-preview"><img src="${escapeHtml(item.thumbnail)}" alt="" loading="lazy" /><span class="online-project-document-badge">PDF</span></span>${copy}<span class="online-project-document-action">${escapeHtml(t("op_media_open_pdf"))} ↗ <span class="online-project-new-tab">${escapeHtml(t("op_media_new_tab"))}</span></span></a></article>`;
   const transcript = localized(item, "transcript");
   return `<article class="online-project-resource online-project-video"><div data-online-video-player="${index}"></div>${copy}${transcript ? `<details class="online-project-transcript"><summary>${escapeHtml(t("op_media_transcript"))}</summary><p>${escapeHtml(transcript)}</p></details>` : ""}</article>`;
  }
  return `<article class="online-project-photo"><button class="online-project-photo-button" type="button" data-photo-index="${index}" aria-label="${escapeHtml(t("op_library_open") + ": " + title)}"><span class="online-project-photo-media"><img loading="${index < 10 ? "eager" : "lazy"}" decoding="async" src="${escapeHtml(item.image)}" alt="${escapeHtml(localized(item, "alt") || title)}" /><span class="online-project-photo-expand"><i class="fa-solid fa-expand" aria-hidden="true"></i></span></span><span class="online-project-photo-copy"><small>${escapeHtml(label)}</small><strong>${escapeHtml(title)}</strong></span></button></article>`;
 }).join("");
 if (activeMedia === "videos") {
  grid.querySelectorAll("[data-online-video-player]").forEach((mount) => {
   const item = visibleItems[Number(mount.dataset.onlineVideoPlayer)];
   if (item) mount.replaceWith(createOnlineProjectPlayer(item, localized(item, "title") || "MIRoKIT"));
  });
 }
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
 if (activeMedia !== "photos") return;
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
 if (activeMedia === "photos") filters.querySelector('[aria-current="page"]')?.focus({ preventScroll: true });
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
byId("onlineProjectMediaNav").addEventListener("click", (event) => {
 const link = event.target.closest("[data-media]");
 if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
 event.preventDefault();
 if (modal.open) modal.close();
 activeMedia = link.dataset.media;
 history.pushState({}, "", topicUrl(activeTopic));
 renderFilters();
 renderPhotos();
 byId("onlineProjectMediaNav").querySelector('[aria-current="page"]')?.focus({ preventScroll: true });
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
 for (const kind of Object.keys(mediaStates)) mediaStates[kind] = "loading";
 renderPhotos();
 const photos = async () => { try {
  const response = await fetch("../../api/v1/gallery?collection=online-projects", { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Gallery returned ${response.status}`);
  const payload = await response.json();
  if (payload.success === false || !Array.isArray(payload.gallery)) throw new Error("Invalid gallery response");
  if (version !== loadVersion) return;
  items = items.filter((item) => item.mediaKind).concat(payload.gallery.filter((item) => item.collection === "online-projects" && item.status === "published" && typeof item.image === "string"));
  mediaStates.photos = "ready";
 } catch {
  if (version !== loadVersion) return;
  items = items.filter((item) => item.mediaKind);
  mediaStates.photos = "error";
 }
 if (activeMedia === "photos") renderPhotos();
 };
 const resources = async () => { try {
  const response = await fetch("/api/v1/online-projects/media", { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error("Media unavailable");
  const payload = await response.json();
  if (payload.success === false || !Array.isArray(payload.media)) throw new Error("Invalid media response");
  if (version !== loadVersion) return;
  const safeUrl = (value) => typeof value === "string" && /^\/media\/v1\/online-projects\//.test(value);
  items = items.filter((item) => !item.mediaKind).concat(payload.media.filter((item) => item.status === "published" && ["video", "document"].includes(item.kind) && safeUrl(item.url) && (!item.thumbnail || safeUrl(item.thumbnail))).map((item) => ({ ...item, mediaKind: item.kind === "video" ? "videos" : "documents" })));
  mediaStates.videos = mediaStates.documents = "ready";
 } catch {
  if (version !== loadVersion) return;
  items = items.filter((item) => !item.mediaKind);
  mediaStates.videos = mediaStates.documents = "error";
 }
 if (activeMedia !== "photos") renderPhotos();
 };
 await Promise.all([photos(), resources()]);
}

readLocation();
try { syncTheme(localStorage.getItem("mirokitTheme") === "dark" ? "dark" : "light"); } catch { syncTheme(); }
renderFilters();
revealSelectedFilter();
loadPhotos();
