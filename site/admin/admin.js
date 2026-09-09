const LANGUAGES = ["ru", "en", "de"];
const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
let localAdminToken = sessionStorage.getItem("mirokitNewsAdminToken") || "";
let newsItems = [];
let galleryItems = [];
let galleryQuotes = [];
let worldPoints = [];
let partners = [];
let videos = [];
let editingId = null;
let editingWorldPointId = null;
let editingPartnerId = null;
let editingVideoId = null;
let videoSubtitleState = [];
let activeVideoSubtitleIndex = -1;
let videoCueState = [];

const form = document.getElementById("newsForm");
const notice = document.getElementById("notice");
const newsList = document.getElementById("newsList");
const formHeading = document.getElementById("formHeading");
const currentStatus = document.getElementById("currentStatus");
const imageFile = document.getElementById("imageFile");
const newsId = document.getElementById("newsId");
const checkSlugButton = document.getElementById("checkSlug");
const slugStatus = document.getElementById("slugStatus");
const galleryForm = document.getElementById("galleryForm");
const galleryFile = document.getElementById("galleryFile");
const gallerySourceUrl = document.getElementById("gallerySourceUrl");
const galleryList = document.getElementById("galleryList");
const quoteForm = document.getElementById("quoteForm");
const galleryQuoteList = document.getElementById("galleryQuoteList");
const worldPointForm = document.getElementById("worldPointForm");
const worldPointsList = document.getElementById("worldPointsList");
const partnerForm = document.getElementById("partnerForm");
const partnersList = document.getElementById("partnersList");
const partnerFile = document.getElementById("partnerFile");
const videoForm = document.getElementById("videoForm");
const videosList = document.getElementById("videosList");
const videoPreview = document.getElementById("videoPreview");
const videoSubtitleRows = document.getElementById("videoSubtitleRows");
const videoCueEditor = document.getElementById("videoCueEditor");
const videoFile = document.getElementById("videoFile");
const videoPosterFile = document.getElementById("videoPosterFile");
const newNewsButton = document.getElementById("newNews");
const adminTabs = [...document.querySelectorAll("[data-admin-tab]")];
const adminViews = [...document.querySelectorAll("[data-admin-view]")];
const deleteDialog = document.getElementById("deleteDialog");
const deleteDialogForm = document.getElementById("deleteDialogForm");
const deleteDialogTitle = document.getElementById("deleteDialogTitle");
const deleteDialogMessage = document.getElementById("deleteDialogMessage");
const deleteConfirmation = document.getElementById("deleteConfirmation");
const confirmDeleteButton = document.getElementById("confirmDelete");
let pendingDeletion = null;

function setAdminView(viewKey) {
	const selectedView = adminViews.some((view) => view.dataset.adminView === viewKey) ? viewKey : "news";
	adminViews.forEach((view) => { view.hidden = view.dataset.adminView !== selectedView; });
	adminTabs.forEach((tab) => {
		const isActive = tab.dataset.adminTab === selectedView;
		tab.classList.toggle("is-active", isActive);
		tab.setAttribute("aria-selected", String(isActive));
	});
	newNewsButton.hidden = selectedView !== "news";
}

function showNotice(message, error = false) {
	notice.textContent = message;
	notice.classList.toggle("error", error);
	if (error) focusAdminErrorField(message);
}

const localizedAdminFields = new Set(["title", "alt", "summary", "content", "description", "name", "city", "country"]);
const adminFieldIds = {
	id: ["newsId", "videoId", "worldPointId", "partnerId"],
	sourceUrl: ["videoSourceUrl"],
	sourceType: ["videoSourceType"],
	poster: ["videoPoster"],
	durationSeconds: ["videoDuration"],
	width: ["videoWidth"],
	height: ["videoHeight"],
	sortOrder: ["videoSortOrder", "worldSortOrder", "partnerSortOrder"],
	image: ["image", "galleryImage", "partnerImage"],
	category: ["category", "partnerCategory"],
	website: ["partnerWebsite"],
	latitude: ["worldLatitude"],
	longitude: ["worldLongitude"],
	pointStatus: ["worldPointKind"],
	flag: ["worldFlag"],
};

function visibleAdminField(fields) {
	return fields.find((field) => !field.closest("[hidden]")) || fields[0] || null;
}

function focusAdminErrorField(message) {
	const text = String(message || "");
	const localizedMatch = text.match(/\b(title|alt|summary|content|description|name|city|country)\.(ru|en|de)\b/i);
	let field = null;
	if (localizedMatch && localizedAdminFields.has(localizedMatch[1].toLowerCase())) {
		const name = localizedMatch[1].toLowerCase();
		const language = localizedMatch[2].toLowerCase();
		const selector = `[data-language="${language}"][data-field="${name}"], [data-video-language="${language}"][data-video-field="${name}"], [data-world-language="${language}"][data-world-field="${name}"], [data-partner-language="${language}"][data-partner-field="${name}"]`;
		field = visibleAdminField([...document.querySelectorAll(selector)]);
	}
	if (!field) {
		const languageMatch = text.match(/\b(?:translation|translations)\s+for\s+(ru|en|de)\b/i);
		if (languageMatch) {
			const language = languageMatch[1].toLowerCase();
			field = visibleAdminField([...document.querySelectorAll(`[data-language="${language}"], [data-video-language="${language}"], [data-world-language="${language}"], [data-partner-language="${language}"]`)]);
		}
	}
	if (!field) {
		const fieldMatch = text.match(/\b(sourceUrl|sourceType|poster|durationSeconds|width|height|sortOrder|image|category|website|latitude|longitude|pointStatus|flag|id)\b/i);
		const ids = fieldMatch ? adminFieldIds[fieldMatch[1]] || adminFieldIds[fieldMatch[1].toLowerCase()] : [];
		field = visibleAdminField((ids || []).map((id) => document.getElementById(id)).filter(Boolean));
	}
	if (!field) return;
	field.setAttribute("aria-invalid", "true");
	field.closest("label, fieldset")?.classList.add("has-error");
	field.focus({ preventScroll: false });
}

function clearAdminFieldError(event) {
	const field = event.target instanceof HTMLElement ? event.target.closest("input, select, textarea") : null;
	if (!field) return;
	field.removeAttribute("aria-invalid");
	field.closest("label, fieldset")?.classList.remove("has-error");
}

document.addEventListener("input", clearAdminFieldError);
document.addEventListener("change", clearAdminFieldError);

function isDeleteConfirmation(value) {
	return /^(delete|удалить)$/i.test(value.trim());
}

function requestDeletion(target) {
	pendingDeletion = target;
	deleteDialogTitle.textContent = target.kind === "news" ? "News entfernen?" : target.kind === "gallery" ? "Gallery-Bild löschen?" : target.kind === "quote" ? "Gallery-Zitat entfernen?" : target.kind === "world" ? "World Point archivieren?" : target.kind === "video" ? "Video archivieren?" : "Partner archivieren?";
	deleteDialogMessage.textContent = target.kind === "news"
		? "Die News wird aus der öffentlichen Veröffentlichung entfernt."
		: target.kind === "gallery"
			? "Das Bild und seine R2-Metadaten werden endgültig gelöscht."
			: target.kind === "quote"
				? "Das Zitat wird aus der öffentlichen Gallery entfernt."
			: target.kind === "video"
				? "Das Video wird archiviert und ist danach nicht mehr öffentlich sichtbar."
				: "Der Inhalt wird archiviert und ist danach nicht mehr öffentlich sichtbar.";
	deleteConfirmation.value = "";
	confirmDeleteButton.disabled = true;
	deleteDialog.showModal();
	deleteConfirmation.focus();
}

async function executeDeletion(target) {
	try {
		if (target.kind === "news") {
			await api(`/api/v1/admin/news/${encodeURIComponent(target.id)}`, { method: "DELETE" });
			await loadNews();
			clearForm();
			showNotice("News entfernt.");
		} else if (target.kind === "gallery") {
			await api(`/api/v1/admin/gallery/${encodeURIComponent(target.key)}`, { method: "DELETE" });
			await loadGallery();
			showNotice("Gallery-Bild gelöscht.");
		} else if (target.kind === "quote") {
			await api(`/api/v1/admin/gallery/quotes/${encodeURIComponent(target.id)}`, { method: "DELETE" });
			await loadGallery();
			showNotice("Gallery-Zitat entfernt.");
		} else if (target.kind === "world") {
			await api(`/api/v1/admin/world-points/${encodeURIComponent(target.id)}`, { method: "DELETE" });
			await loadWorldPoints();
			clearWorldPointForm();
			showNotice("World Point archiviert.");
		} else if (target.kind === "partner") {
			await api(`/api/v1/admin/partners/${encodeURIComponent(target.id)}`, { method: "DELETE" });
			await loadPartners();
			clearPartnerForm();
			showNotice("Partner archiviert.");
		} else if (target.kind === "video") {
			await api(`/api/v1/admin/videos/${encodeURIComponent(target.id)}`, { method: "DELETE" });
			await loadVideos();
			clearVideoForm();
			showNotice("Video archiviert.");
		}
	} catch (error) {
		showNotice(error.message, true);
	}
}

function getLocalToken() {
	if (!isLocal || localAdminToken) return localAdminToken;
	localAdminToken = window.prompt("Lokales News-Admin-Token eingeben:")?.trim() || "";
	if (localAdminToken) sessionStorage.setItem("mirokitNewsAdminToken", localAdminToken);
	return localAdminToken;
}

async function api(path, options = {}) {
	const headers = new Headers(options.headers || {});
	headers.set("Accept", "application/json");
	if (isLocal) {
		const token = getLocalToken();
		if (token) headers.set("X-MiroKIT-Admin-Token", token);
	}
	if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");

	const response = await fetch(path, { ...options, headers, credentials: "same-origin" });
	let body = {};
	try { body = await response.json(); } catch { /* keep generic error */ }
	if (!response.ok) throw new Error(body.message || `Server returned ${response.status}`);
	return body;
}

// Stored static image paths are relative to the public site, not /admin/.
function resolveMediaUrl(value) {
	return new URL(value || "", `${window.location.origin}/`).href;
}

function escapeHtml(value) {
	return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function field(language, name) {
	return form.querySelector(`[data-language="${language}"][data-field="${name}"]`);
}

function galleryField(language, name) {
	return galleryForm.querySelector(`[data-gallery-language="${language}"][data-gallery-field="${name}"]`);
}

function quoteField(language, name) {
	return quoteForm.querySelector(`[data-quote-language="${language}"][data-quote-field="${name}"]`);
}

function worldField(language, name) {
	return worldPointForm.querySelector(`[data-world-language="${language}"][data-world-field="${name}"]`);
}

function partnerField(language, name) {
	return partnerForm.querySelector(`[data-partner-language="${language}"][data-partner-field="${name}"]`);
}

function videoField(language, name) {
	return videoForm.querySelector(`[data-video-language="${language}"][data-video-field="${name}"]`);
}

function setFormValue(id, value = "") {
	document.getElementById(id).value = value;
}

function clearForm() {
	editingId = null;
	form.reset();
	newsId.disabled = false;
	checkSlugButton.hidden = false;
	slugStatus.textContent = "";
	setFormValue("accent", "blue");
	setFormValue("category", "event");
	formHeading.textContent = "Neue Meldung";
	currentStatus.textContent = "Entwurf";
	document.getElementById("archiveNews").hidden = true;
	showNotice("");
}

function clearWorldPointForm() {
	editingWorldPointId = null;
	worldPointForm.reset();
	document.getElementById("worldPointId").disabled = false;
	document.getElementById("worldPointHeading").textContent = "Neuer World Point";
	document.getElementById("worldPointStatus").textContent = "Entwurf";
	document.getElementById("archiveWorldPoint").hidden = true;
	document.getElementById("worldPointKind").value = "planned";
	document.getElementById("worldSortOrder").value = "0";
}

function clearPartnerForm() {
	editingPartnerId = null;
	partnerForm.reset();
	document.getElementById("partnerId").disabled = false;
	document.getElementById("partnerHeading").textContent = "Neuer Partner";
	document.getElementById("partnerStatus").textContent = "Entwurf";
	document.getElementById("archivePartner").hidden = true;
	document.getElementById("partnerCategory").value = "public";
	document.getElementById("partnerSortOrder").value = "0";
}

function clearVideoForm() {
	editingVideoId = null;
	videoForm.reset();
	videoSubtitleState = [];
	activeVideoSubtitleIndex = -1;
	videoCueState = [];
	document.getElementById("videoId").disabled = false;
	document.getElementById("videoHeading").textContent = "Neues Video";
	document.getElementById("videoStatus").textContent = "Entwurf";
	document.getElementById("archiveVideo").hidden = true;
	document.getElementById("videoSourceType").value = "youtube";
	document.getElementById("videoSortOrder").value = "0";
	videoPreview.removeAttribute("src");
	videoPreview.hidden = true;
	videoCueEditor.hidden = true;
	renderVideoSubtitleRows();
}

function parseVttTime(value) {
	const parts = String(value || "").trim().split(":").map(Number);
	if (parts.some((part) => !Number.isFinite(part))) return 0;
	if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
	if (parts.length === 2) return parts[0] * 60 + parts[1];
	return Number(parts[0]) || 0;
}

function formatVttTime(value) {
	const total = Math.max(0, Number(value) || 0);
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = (total % 60).toFixed(3).padStart(6, "0");
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${seconds}`;
}

function parseVttCues(content) {
	const lines = String(content || "").replace(/^\uFEFF/, "").split(/\r?\n/);
	const cues = [];
	for (let index = 0; index < lines.length; index += 1) {
		const timing = lines[index].match(/^(?:[^\s]+\s+)?(\S+)\s+-->\s+(\S+)/);
		if (!timing) continue;
		const text = [];
		for (let cursor = index + 1; cursor < lines.length && lines[cursor].trim(); cursor += 1) text.push(lines[cursor]);
		cues.push({ start: parseVttTime(timing[1]), end: parseVttTime(timing[2]), text: text.join("\n") });
	}
	return cues;
}

function serializeVttCues(cues) {
	return `WEBVTT\n\n${cues.map((cue) => `${formatVttTime(cue.start)} --> ${formatVttTime(Math.max(cue.end, cue.start + 0.1))}\n${cue.text || ""}`).join("\n\n")}\n`;
}

function syncVideoSubtitleRows() {
	videoSubtitleRows.querySelectorAll("[data-video-subtitle-index]").forEach((row) => {
		const index = Number(row.dataset.videoSubtitleIndex);
		const item = videoSubtitleState[index];
		if (!item) return;
		item.language = row.querySelector('[data-video-subtitle-field="language"]')?.value || item.language;
		item.label = row.querySelector('[data-video-subtitle-field="label"]')?.value.trim() || item.label;
		item.srcLang = row.querySelector('[data-video-subtitle-field="srcLang"]')?.value.trim() || item.language;
		item.content = row.querySelector("[data-video-subtitle-content]")?.value || item.content || "";
		item.isDefault = Boolean(row.querySelector('[data-video-subtitle-field="default"]')?.checked);
	});
}

function renderVideoCueEditor() {
	if (activeVideoSubtitleIndex < 0 || !videoSubtitleState[activeVideoSubtitleIndex]) {
		videoCueEditor.hidden = true;
		return;
	}
	videoCueEditor.hidden = false;
	videoCueEditor.innerHTML = `<div class="video-cue-editor-head"><strong>Cues bearbeiten · ${escapeHtml(videoSubtitleState[activeVideoSubtitleIndex].label || "Untertitel")}</strong><button class="button button-small" type="button" data-video-add-cue>＋ Cue</button></div>${videoCueState.length ? videoCueState.map((cue, index) => `<div class="video-cue-row" data-video-cue-index="${index}"><label><span>Start</span><input data-video-cue-field="start" value="${escapeHtml(formatVttTime(cue.start))}" /></label><button class="button button-small" type="button" data-video-cue-now="start" data-video-cue-index="${index}">aktuell</button><label><span>Ende</span><input data-video-cue-field="end" value="${escapeHtml(formatVttTime(cue.end))}" /></label><button class="button button-small" type="button" data-video-cue-now="end" data-video-cue-index="${index}">aktuell</button><label class="video-cue-text"><span>Text</span><textarea data-video-cue-field="text" rows="2">${escapeHtml(cue.text)}</textarea></label><button class="button button-danger button-small" type="button" data-video-remove-cue="${index}">×</button></div>`).join("") : `<p class="muted">Noch keine Cues. Füge einen Cue hinzu oder lade eine WebVTT-Datei hoch.</p>`}`;
}

function syncVideoCues() {
	videoCueEditor.querySelectorAll("[data-video-cue-index]").forEach((row) => {
		const index = Number(row.dataset.videoCueIndex);
		if (!videoCueState[index]) return;
		videoCueState[index] = {
			start: parseVttTime(row.querySelector('[data-video-cue-field="start"]')?.value),
			end: parseVttTime(row.querySelector('[data-video-cue-field="end"]')?.value),
			text: row.querySelector('[data-video-cue-field="text"]')?.value || "",
		};
	});
	if (activeVideoSubtitleIndex >= 0 && videoSubtitleState[activeVideoSubtitleIndex]) videoSubtitleState[activeVideoSubtitleIndex].content = serializeVttCues(videoCueState);
}

function renderVideoSubtitleRows() {
	if (!videoSubtitleState.length) {
		videoSubtitleRows.innerHTML = '<p class="muted">Noch keine Untertitel hinzugefügt.</p>';
		videoCueEditor.hidden = true;
		return;
	}
	videoSubtitleRows.innerHTML = videoSubtitleState.map((item, index) => `<article class="video-subtitle-row" data-video-subtitle-index="${index}"><div class="video-subtitle-row-head"><strong>Spur ${index + 1}</strong><button class="button button-small" type="button" data-video-edit-subtitle="${index}">Cues bearbeiten</button><button class="button button-danger button-small" type="button" data-video-remove-subtitle="${index}">Entfernen</button></div><div class="field-grid field-grid-three"><label><span>Sprache</span><select data-video-subtitle-field="language"><option value="ru"${item.language === "ru" ? " selected" : ""}>RU</option><option value="en"${item.language === "en" ? " selected" : ""}>EN</option><option value="de"${item.language === "de" ? " selected" : ""}>DE</option></select></label><label><span>Label</span><input data-video-subtitle-field="label" value="${escapeHtml(item.label || "")}" maxlength="100" /></label><label><span>Sprachcode</span><input data-video-subtitle-field="srcLang" value="${escapeHtml(item.srcLang || item.language || "")}" maxlength="10" /></label></div><label class="file-label"><span>WebVTT-Datei</span><input data-video-subtitle-file type="file" accept=".vtt,text/vtt" /></label><label><span>WebVTT-Inhalt</span><textarea data-video-subtitle-content rows="5" spellcheck="false" placeholder="WEBVTT\n\n00:00:00.000 --> 00:00:03.000\nText">${escapeHtml(item.content || "")}</textarea></label><label class="feature-toggle"><input data-video-subtitle-field="default" type="checkbox"${item.isDefault ? " checked" : ""} /><span>Standardspur</span></label></article>`).join("");
}

async function populateVideo(item) {
	editingVideoId = item.id;
	document.getElementById("videoId").value = item.id;
	document.getElementById("videoId").disabled = true;
	document.getElementById("videoSourceType").value = item.sourceType || "external";
	document.getElementById("videoSourceUrl").value = item.sourceUrl || "";
	document.getElementById("videoPoster").value = item.poster || "";
	document.getElementById("videoDuration").value = item.durationSeconds ?? "";
	document.getElementById("videoWidth").value = item.width ?? "";
	document.getElementById("videoHeight").value = item.height ?? "";
	document.getElementById("videoSortOrder").value = item.sortOrder || 0;
	document.getElementById("videoFeatured").checked = Boolean(item.featured);
	for (const language of LANGUAGES) {
		const translation = item.translations?.[language] || {};
		videoField(language, "title").value = translation.title || "";
		videoField(language, "alt").value = translation.alt || "";
		videoField(language, "description").value = translation.description || "";
	}
	videoSubtitleState = (item.subtitles || []).map((subtitle) => ({ ...subtitle, content: "", file: null }));
	activeVideoSubtitleIndex = -1;
	document.getElementById("videoHeading").textContent = item.id;
	document.getElementById("videoStatus").textContent = item.status === "published" ? "Veröffentlicht" : item.status === "archived" ? "Archiviert" : "Entwurf";
	document.getElementById("archiveVideo").hidden = item.status === "archived";
	setVideoPreview();
	renderVideoSubtitleRows();
	await Promise.all(videoSubtitleState.map(async (subtitle, index) => {
		if (!subtitle.src) return;
		try {
			const response = await fetch(resolveMediaUrl(subtitle.src), { cache: "no-store" });
			if (response.ok) videoSubtitleState[index].content = await response.text();
		} catch { /* keep subtitle metadata available even when the file is offline */ }
	}));
	renderVideoSubtitleRows();
}

function videoPayload() {
	syncVideoSubtitleRows();
	syncVideoCues();
	return {
		id: document.getElementById("videoId").value.trim(),
		sourceType: document.getElementById("videoSourceType").value,
		sourceUrl: document.getElementById("videoSourceUrl").value.trim(),
		poster: document.getElementById("videoPoster").value.trim(),
		durationSeconds: document.getElementById("videoDuration").value || null,
		width: document.getElementById("videoWidth").value || null,
		height: document.getElementById("videoHeight").value || null,
		featured: document.getElementById("videoFeatured").checked,
		sortOrder: Number(document.getElementById("videoSortOrder").value || 0),
		translations: Object.fromEntries(LANGUAGES.map((language) => [language, {
			title: videoField(language, "title").value.trim(),
			alt: videoField(language, "alt").value.trim(),
			description: videoField(language, "description").value.trim(),
		}])),
		subtitles: videoSubtitleState.map(({ file, ...subtitle }) => subtitle),
	};
}

function setVideoPreview() {
	const sourceType = document.getElementById("videoSourceType").value;
	const source = document.getElementById("videoSourceUrl").value.trim();
	if (sourceType === "youtube" || !source) {
		videoPreview.pause();
		videoPreview.removeAttribute("src");
		videoPreview.hidden = true;
		return;
	}
	videoPreview.src = resolveMediaUrl(source);
	videoPreview.poster = resolveMediaUrl(document.getElementById("videoPoster").value.trim());
	videoPreview.hidden = false;
	videoPreview.load();
}

function populateWorldPoint(item) {
	editingWorldPointId = item.id;
	const id = document.getElementById("worldPointId");
	id.value = item.id;
	id.disabled = true;
	document.getElementById("worldLatitude").value = item.latitude;
	document.getElementById("worldLongitude").value = item.longitude;
	document.getElementById("worldPointKind").value = item.pointStatus;
	document.getElementById("worldFlag").value = item.flag || "";
	document.getElementById("worldSortOrder").value = item.sortOrder || 0;
	for (const language of LANGUAGES) {
		const translation = item.translations?.[language] || {};
		worldField(language, "city").value = translation.city || "";
		worldField(language, "country").value = translation.country || "";
		worldField(language, "description").value = translation.description || "";
	}
	document.getElementById("worldPointHeading").textContent = item.id;
	document.getElementById("worldPointStatus").textContent = item.status === "published" ? "Veröffentlicht" : item.status === "archived" ? "Archiviert" : "Entwurf";
	document.getElementById("archiveWorldPoint").hidden = item.status === "archived";
	renderWorldPoints();
}

function populatePartner(item) {
	editingPartnerId = item.id;
	const id = document.getElementById("partnerId");
	id.value = item.id;
	id.disabled = true;
	document.getElementById("partnerCategory").value = item.category || "public";
	document.getElementById("partnerWebsite").value = item.website || "";
	document.getElementById("partnerImage").value = item.image || "";
	document.getElementById("partnerFeatured").checked = Boolean(item.featured);
	document.getElementById("partnerSortOrder").value = item.sortOrder || 0;
	for (const language of LANGUAGES) {
		const translation = item.translations?.[language] || {};
		partnerField(language, "name").value = translation.name || "";
		partnerField(language, "alt").value = translation.alt || "";
		partnerField(language, "description").value = translation.description || "";
	}
	document.getElementById("partnerHeading").textContent = item.id;
	document.getElementById("partnerStatus").textContent = item.status === "published" ? "Veröffentlicht" : item.status === "archived" ? "Archiviert" : "Entwurf";
	document.getElementById("archivePartner").hidden = item.status === "archived";
	renderPartners();
}

function worldPointPayload() {
	return {
		id: document.getElementById("worldPointId").value.trim(),
		latitude: Number(document.getElementById("worldLatitude").value),
		longitude: Number(document.getElementById("worldLongitude").value),
		pointStatus: document.getElementById("worldPointKind").value,
		flag: document.getElementById("worldFlag").value.trim(),
		sortOrder: Number(document.getElementById("worldSortOrder").value || 0),
		translations: Object.fromEntries(LANGUAGES.map((language) => [language, {
			city: worldField(language, "city").value.trim(),
			country: worldField(language, "country").value.trim(),
			description: worldField(language, "description").value.trim(),
		}])),
	};
}

function partnerPayload() {
	return {
		id: document.getElementById("partnerId").value.trim(),
		category: document.getElementById("partnerCategory").value,
		image: document.getElementById("partnerImage").value.trim(),
		website: document.getElementById("partnerWebsite").value.trim(),
		featured: document.getElementById("partnerFeatured").checked,
		sortOrder: Number(document.getElementById("partnerSortOrder").value || 0),
		translations: Object.fromEntries(LANGUAGES.map((language) => [language, {
			name: partnerField(language, "name").value.trim(),
			alt: partnerField(language, "alt").value.trim(),
			description: partnerField(language, "description").value.trim(),
		}])),
	};
}

function populateForm(item) {
	editingId = item.id;
	newsId.disabled = true;
	checkSlugButton.hidden = true;
	slugStatus.textContent = "Bestehender Slug bleibt unverändert.";
	setFormValue("newsId", item.id);
	setFormValue("publishedAt", item.publishedAt);
	setFormValue("category", item.category);
	setFormValue("accent", item.accent);
	setFormValue("featured", item.featured || "");
	setFormValue("image", item.image);
	for (const language of LANGUAGES) {
		const translation = item.translations?.[language] || {};
		field(language, "alt").value = translation.alt || "";
		field(language, "title").value = translation.title || "";
		field(language, "summary").value = translation.summary || "";
		field(language, "content").value = (translation.content || []).join("\n\n");
	}
	formHeading.textContent = item.id;
	currentStatus.textContent = item.status === "published" ? "Veröffentlicht" : item.status === "archived" ? "Archiviert" : "Entwurf";
	document.getElementById("archiveNews").hidden = item.status === "archived";
}

async function checkSlugAvailability() {
	const slug = newsId.value.trim();
	if (!slug) {
		slugStatus.textContent = "Slug eingeben.";
		return;
	}

	try {
		const response = await api(`/api/v1/admin/news/availability?id=${encodeURIComponent(slug)}`);
		slugStatus.textContent = response.available ? "✓ Slug ist verfügbar." : "✕ Slug ist bereits vergeben.";
	} catch (error) {
		slugStatus.textContent = error.message;
	}
}

function formPayload() {
	const translations = {};
	for (const language of LANGUAGES) {
		translations[language] = {
			alt: field(language, "alt").value.trim(),
			title: field(language, "title").value.trim(),
			summary: field(language, "summary").value.trim(),
			content: field(language, "content").value.split(/\n\s*\n|\n/).map((value) => value.trim()).filter(Boolean),
		};
	}

	const featured = document.getElementById("featured").value;
	return {
		id: document.getElementById("newsId").value.trim(),
		publishedAt: document.getElementById("publishedAt").value,
		category: document.getElementById("category").value,
		accent: document.getElementById("accent").value,
		featured: featured ? Number(featured) : false,
		image: document.getElementById("image").value.trim(),
		translations,
	};
}

async function saveNews() {
	const payload = formPayload();
	const method = editingId ? "PUT" : "POST";
	const path = editingId ? `/api/v1/admin/news/${encodeURIComponent(editingId)}` : "/api/v1/admin/news";
	const response = await api(path, { method, body: JSON.stringify(payload) });
	editingId = response.news.id;
	await loadNews(editingId);
	return response.news;
}

async function loadNews(selectId = editingId) {
	const response = await api("/api/v1/admin/news");
	newsItems = response.news || [];
	renderList();
	const selected = newsItems.find((item) => item.id === selectId);
	if (selected) populateForm(selected);
}

async function loadGallery() {
	const response = await api("/api/v1/admin/gallery");
	galleryItems = response.gallery || [];
	renderGalleryList();
	try {
		const quoteResponse = await api("/api/v1/admin/gallery/quotes");
		galleryQuotes = quoteResponse.quotes || [];
	} catch (error) {
		galleryQuotes = [];
		console.info("[MIRoKIT] Gallery quotes are unavailable:", error.message);
	}
	renderQuoteList();
}

async function loadWorldPoints(selectId = editingWorldPointId) {
	const response = await api("/api/v1/admin/world-points");
	worldPoints = response.points || [];
	renderWorldPoints();
	const selected = worldPoints.find((item) => item.id === selectId);
	if (selected) populateWorldPoint(selected);
}

async function loadPartners(selectId = editingPartnerId) {
	const response = await api("/api/v1/admin/partners");
	partners = response.partners || [];
	renderPartners();
	const selected = partners.find((item) => item.id === selectId);
	if (selected) populatePartner(selected);
}

async function loadVideos(selectId = editingVideoId) {
	const response = await api("/api/v1/admin/videos");
	videos = response.videos || [];
	renderVideos();
	const selected = videos.find((item) => item.id === selectId);
	if (selected) await populateVideo(selected);
}

function formatVideoDuration(value) {
	if (value === null || value === undefined || !Number.isFinite(Number(value))) return "Dauer unbekannt";
	const total = Math.max(0, Math.round(Number(value)));
	return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function renderVideos() {
	if (!videos.length) {
		videosList.innerHTML = '<p class="muted">Noch keine Videos vorhanden.</p>';
		return;
	}
	videosList.innerHTML = videos.map((item) => {
		const translation = item.translations?.de || item.translations?.en || item.translations?.ru || {};
		return `<article class="news-item${item.id === editingVideoId ? " active" : ""}"><button class="news-item-select" type="button" data-video-id="${escapeHtml(item.id)}"><strong>${escapeHtml(translation.title || item.id)}</strong><span>${escapeHtml(item.sourceType)} · ${formatVideoDuration(item.durationSeconds)} · ${escapeHtml(item.status)}</span></button>${item.status !== "archived" ? `<button class="button button-danger button-remove" type="button" data-video-delete-id="${escapeHtml(item.id)}">Archivieren</button>` : ""}</article>`;
	}).join("");
}

function renderWorldPoints() {
	if (!worldPoints.length) {
		worldPointsList.innerHTML = '<p class="muted">Noch keine World Points vorhanden.</p>';
		return;
	}
	worldPointsList.innerHTML = worldPoints.map((item) => {
		const translation = item.translations?.de || item.translations?.en || item.translations?.ru || {};
		return `<article class="news-item${item.id === editingWorldPointId ? " active" : ""}"><button class="news-item-select" type="button" data-world-id="${escapeHtml(item.id)}"><strong>${escapeHtml(translation.city || item.id)}</strong><span>${escapeHtml(translation.country || "")} · ${escapeHtml(item.pointStatus)} · ${escapeHtml(item.status)}</span></button>${item.status !== "archived" ? `<button class="button button-danger button-remove" type="button" data-world-delete-id="${escapeHtml(item.id)}">Archivieren</button>` : ""}</article>`;
	}).join("");
}

function renderPartners() {
	if (!partners.length) {
		partnersList.innerHTML = '<p class="muted">Noch keine Partners vorhanden.</p>';
		return;
	}
	partnersList.innerHTML = partners.map((item) => {
		const translation = item.translations?.de || item.translations?.en || item.translations?.ru || {};
		return `<article class="news-item${item.id === editingPartnerId ? " active" : ""}"><button class="news-item-select" type="button" data-partner-id="${escapeHtml(item.id)}"><strong>${escapeHtml(translation.name || item.id)}</strong><span>${escapeHtml(item.category)} · ${item.featured ? "Hervorgehoben · " : ""}${escapeHtml(item.status)}</span></button>${item.status !== "archived" ? `<button class="button button-danger button-remove" type="button" data-partner-delete-id="${escapeHtml(item.id)}">Archivieren</button>` : ""}</article>`;
	}).join("");
}

function renderGalleryList() {
	if (!galleryItems.length) {
		galleryList.innerHTML = '<p class="muted">Noch keine Gallery-Bilder vorhanden.</p>';
		return;
	}

	galleryList.innerHTML = galleryItems.map((item) => {
		const title = item.title?.de || item.title?.en || item.title?.ru || item.key;
		const alt = item.alt?.de || item.alt?.en || item.alt?.ru || "";
		const subtitle = item.subtitle?.de || item.subtitle?.en || item.subtitle?.ru || "";
		return `<article class="gallery-admin-item"><img loading="lazy" src="${escapeHtml(resolveMediaUrl(item.image))}" alt="${escapeHtml(alt)}" /><div class="gallery-admin-copy"><strong>${escapeHtml(title)}</strong>${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""}<span>${item.collection === "online-projects" ? "Online-Projekte · " : ""}${item.sourceType === "drive" ? "Google Drive · " : ""}${item.featured ? "Hervorgehoben · " : ""}${escapeHtml(item.status)}</span><button class="button button-danger button-remove" type="button" data-gallery-delete-key="${escapeHtml(item.key)}">Bild löschen</button></div></article>`;
	}).join("");
}

function renderQuoteList() {
	if (!galleryQuotes.length) {
		galleryQuoteList.innerHTML = '<p class="muted">Noch keine Gallery-Zitate vorhanden.</p>';
		return;
	}

	galleryQuoteList.innerHTML = galleryQuotes.map((item) => {
		const quote = item.quote?.de || item.quote?.en || item.quote?.ru || "";
		const byline = item.byline?.de || item.byline?.en || item.byline?.ru || "";
		return `<article class="gallery-quote-admin-item"><div><strong>„${escapeHtml(quote)}“</strong>${byline ? `<span>${escapeHtml(byline)}</span>` : ""}<span>${escapeHtml(item.status)}</span></div><button class="button button-danger button-remove" type="button" data-quote-delete-id="${escapeHtml(item.id)}">Zitat entfernen</button></article>`;
	}).join("");
}

function renderList() {
	if (!newsItems.length) {
		newsList.innerHTML = '<p class="muted">Noch keine News vorhanden.</p>';
		return;
	}
	newsList.innerHTML = newsItems.map((item) => `<article class="news-item${item.id === editingId ? " active" : ""}"><button class="news-item-select" type="button" data-news-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.translations?.de?.title || item.id)}</strong><span>${item.featured ? `Hervorgehoben · Rang ${escapeHtml(item.featured)} · ` : ""}${escapeHtml(item.status)} · ${escapeHtml(item.publishedAt)}</span></button>${item.status !== "archived" ? `<button class="button button-danger button-remove" type="button" data-news-delete-id="${escapeHtml(item.id)}">Entfernen</button>` : ""}</article>`).join("");
}

newsList.addEventListener("click", (event) => {
	const deleteButton = event.target.closest("[data-news-delete-id]");
	if (deleteButton) {
		requestDeletion({ kind: "news", id: deleteButton.dataset.newsDeleteId });
		return;
	}
	const button = event.target.closest("[data-news-id]");
	const item = newsItems.find((candidate) => candidate.id === button?.dataset.newsId);
	if (item) { populateForm(item); renderList(); }
});

galleryList.addEventListener("click", (event) => {
	const deleteButton = event.target.closest("[data-gallery-delete-key]");
	if (deleteButton) requestDeletion({ kind: "gallery", key: deleteButton.dataset.galleryDeleteKey });
});

galleryQuoteList.addEventListener("click", (event) => {
	const deleteButton = event.target.closest("[data-quote-delete-id]");
	if (deleteButton) requestDeletion({ kind: "quote", id: deleteButton.dataset.quoteDeleteId });
});

worldPointsList.addEventListener("click", (event) => {
	const deleteButton = event.target.closest("[data-world-delete-id]");
	if (deleteButton) {
		requestDeletion({ kind: "world", id: deleteButton.dataset.worldDeleteId });
		return;
	}
	const button = event.target.closest("[data-world-id]");
	const item = worldPoints.find((candidate) => candidate.id === button?.dataset.worldId);
	if (item) populateWorldPoint(item);
});

partnersList.addEventListener("click", (event) => {
	const deleteButton = event.target.closest("[data-partner-delete-id]");
	if (deleteButton) {
		requestDeletion({ kind: "partner", id: deleteButton.dataset.partnerDeleteId });
		return;
	}
	const button = event.target.closest("[data-partner-id]");
	const item = partners.find((candidate) => candidate.id === button?.dataset.partnerId);
	if (item) populatePartner(item);
});

videosList.addEventListener("click", (event) => {
	const deleteButton = event.target.closest("[data-video-delete-id]");
	if (deleteButton) {
		requestDeletion({ kind: "video", id: deleteButton.dataset.videoDeleteId });
		return;
	}
	const button = event.target.closest("[data-video-id]");
	const item = videos.find((candidate) => candidate.id === button?.dataset.videoId);
	if (item) populateVideo(item).then(renderVideos);
});

form.addEventListener("submit", async (event) => {
	event.preventDefault();
	if (!form.reportValidity()) return;
	try { await saveNews(); showNotice("Entwurf gespeichert."); } catch (error) { showNotice(error.message, true); }
});

document.getElementById("newNews").addEventListener("click", clearForm);
checkSlugButton.addEventListener("click", checkSlugAvailability);
newsId.addEventListener("input", () => { slugStatus.textContent = ""; });
document.getElementById("reloadNews").addEventListener("click", () => loadNews().catch((error) => showNotice(error.message, true)));
document.getElementById("publishNews").addEventListener("click", async () => {
	try {
		const item = await saveNews();
		await api(`/api/v1/admin/news/${encodeURIComponent(item.id)}/publish`, { method: "POST" });
		await loadNews(item.id);
		showNotice("News veröffentlicht.");
	} catch (error) { showNotice(error.message, true); }
});
document.getElementById("archiveNews").addEventListener("click", async () => {
	if (editingId) requestDeletion({ kind: "news", id: editingId });
});

imageFile.addEventListener("change", async () => {
	const file = imageFile.files?.[0];
	if (!file) return;
	const body = new FormData();
	body.append("file", file);
	try {
		showNotice("Bild wird hochgeladen …");
		const response = await api("/api/v1/admin/media", { method: "POST", body });
		setFormValue("image", response.image);
		showNotice("Bild hochgeladen. Jetzt speichern oder veröffentlichen.");
	} catch (error) { showNotice(error.message, true); }
});

galleryForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	if (!galleryForm.reportValidity()) return;
	const file = galleryFile.files?.[0];
	const sourceUrl = gallerySourceUrl.value.trim();
	if (!file && !sourceUrl) {
		showNotice("Bitte eine Datei oder eine Google-Drive-URL angeben.", true);
		galleryFile.focus();
		return;
	}
	if (file && sourceUrl) {
		showNotice("Bitte nur eine Quelle auswählen: Datei oder Google-Drive-URL.", true);
		gallerySourceUrl.focus();
		return;
	}

	const body = new FormData();
	if (file) body.append("file", file);
	if (sourceUrl) body.append("source_url", sourceUrl);
	body.append("collection", document.getElementById("galleryCollection").value);
	for (const language of LANGUAGES) {
		body.append(`title_${language}`, galleryField(language, "title").value.trim());
		body.append(`alt_${language}`, galleryField(language, "alt").value.trim());
		body.append(`subtitle_${language}`, galleryField(language, "subtitle").value.trim());
	}
	if (document.getElementById("galleryFeatured").checked) body.append("featured", "true");

	try {
		showNotice("Gallery-Bild wird hochgeladen …");
		await api("/api/v1/admin/gallery", { method: "POST", body });
		galleryForm.reset();
		await loadGallery();
		showNotice("Gallery-Bild veröffentlicht.");
	} catch (error) { showNotice(error.message, true); }
});

quoteForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	if (!quoteForm.reportValidity()) return;

	const translations = {};
	for (const language of LANGUAGES) {
		translations[language] = {
			quote: quoteField(language, "quote").value.trim(),
			byline: quoteField(language, "byline").value.trim(),
		};
	}

	try {
		showNotice("Gallery-Zitat wird veröffentlicht …");
		await api("/api/v1/admin/gallery/quotes", { method: "POST", body: JSON.stringify({ translations }) });
		quoteForm.reset();
		await loadGallery();
		showNotice("Gallery-Zitat veröffentlicht.");
	} catch (error) { showNotice(error.message, true); }
});

worldPointForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	if (!worldPointForm.reportValidity()) return;
	try {
		const response = await api(editingWorldPointId ? `/api/v1/admin/world-points/${encodeURIComponent(editingWorldPointId)}` : "/api/v1/admin/world-points", {
			method: editingWorldPointId ? "PUT" : "POST",
			body: JSON.stringify(worldPointPayload()),
		});
		editingWorldPointId = response.point.id;
		await loadWorldPoints(editingWorldPointId);
		showNotice("World Point als Entwurf gespeichert.");
	} catch (error) { showNotice(error.message, true); }
});

partnerFile.addEventListener("change", async () => {
	const file = partnerFile.files?.[0];
	if (!file) return;
	const body = new FormData();
	body.append("file", file);
	try {
		showNotice("Partner-Logo wird hochgeladen …");
		const response = await api("/api/v1/admin/partners/media", { method: "POST", body });
		setFormValue("partnerImage", response.image);
		showNotice("Logo hochgeladen. Jetzt speichern oder veröffentlichen.");
	} catch (error) { showNotice(error.message, true); }
});

partnerForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	if (!partnerForm.reportValidity()) return;
	try {
		const response = await api(editingPartnerId ? `/api/v1/admin/partners/${encodeURIComponent(editingPartnerId)}` : "/api/v1/admin/partners", {
			method: editingPartnerId ? "PUT" : "POST",
			body: JSON.stringify(partnerPayload()),
		});
		editingPartnerId = response.partner.id;
		await loadPartners(editingPartnerId);
		showNotice("Partner als Entwurf gespeichert.");
	} catch (error) { showNotice(error.message, true); }
});

videoForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	if (!videoForm.reportValidity()) return;
	try {
		const payload = videoPayload();
		const response = await api(editingVideoId ? `/api/v1/admin/videos/${encodeURIComponent(editingVideoId)}` : "/api/v1/admin/videos", {
			method: editingVideoId ? "PUT" : "POST",
			body: JSON.stringify(payload),
		});
		editingVideoId = response.video.id;
		await loadVideos(editingVideoId);
		showNotice("Video als Entwurf gespeichert.");
	} catch (error) { showNotice(error.message, true); }
});

videoFile.addEventListener("change", async () => {
	const file = videoFile.files?.[0];
	if (!file) return;
	const body = new FormData();
	body.append("file", file);
	body.append("kind", "video");
	try {
		showNotice("Video wird nach R2 hochgeladen …");
		const response = await api("/api/v1/admin/videos/media", { method: "POST", body });
		document.getElementById("videoSourceType").value = "r2";
		document.getElementById("videoSourceUrl").value = response.url;
		setVideoPreview();
		showNotice("Video hochgeladen. Jetzt Metadaten speichern.");
	} catch (error) { showNotice(error.message, true); }
});

videoPosterFile.addEventListener("change", async () => {
	const file = videoPosterFile.files?.[0];
	if (!file) return;
	const body = new FormData();
	body.append("file", file);
	body.append("kind", "poster");
	try {
		showNotice("Poster wird nach R2 hochgeladen …");
		const response = await api("/api/v1/admin/videos/media", { method: "POST", body });
		document.getElementById("videoPoster").value = response.url;
		setVideoPreview();
		showNotice("Poster hochgeladen. Jetzt Metadaten speichern.");
	} catch (error) { showNotice(error.message, true); }
});

document.getElementById("videoSourceType").addEventListener("change", setVideoPreview);
document.getElementById("videoSourceUrl").addEventListener("input", setVideoPreview);
document.getElementById("videoPoster").addEventListener("input", setVideoPreview);
videoPreview.addEventListener("loadedmetadata", () => {
	if (Number.isFinite(videoPreview.duration)) document.getElementById("videoDuration").value = videoPreview.duration.toFixed(2);
	if (videoPreview.videoWidth) document.getElementById("videoWidth").value = videoPreview.videoWidth;
	if (videoPreview.videoHeight) document.getElementById("videoHeight").value = videoPreview.videoHeight;
});

document.getElementById("addVideoSubtitle").addEventListener("click", () => {
	syncVideoSubtitleRows();
	videoSubtitleState.push({ id: "", language: "de", label: "Deutsch", srcLang: "de", src: "", content: "WEBVTT\n\n", isDefault: videoSubtitleState.length === 0, sortOrder: videoSubtitleState.length, file: null });
	renderVideoSubtitleRows();
});

videoSubtitleRows.addEventListener("input", (event) => {
	syncVideoSubtitleRows();
	if (event.target.matches("[data-video-subtitle-content]")) {
		const row = event.target.closest("[data-video-subtitle-index]");
		if (row && Number(row.dataset.videoSubtitleIndex) === activeVideoSubtitleIndex) {
			videoCueState = parseVttCues(event.target.value);
			renderVideoCueEditor();
		}
	}
});

videoSubtitleRows.addEventListener("change", async (event) => {
	const row = event.target.closest("[data-video-subtitle-index]");
	if (!row) return;
	const index = Number(row.dataset.videoSubtitleIndex);
	if (event.target.matches("[data-video-subtitle-file]")) {
		const file = event.target.files?.[0];
		if (file) {
			videoSubtitleState[index].file = file;
			videoSubtitleState[index].content = await file.text();
			renderVideoSubtitleRows();
		}
	}
	syncVideoSubtitleRows();
});

videoSubtitleRows.addEventListener("click", (event) => {
	const removeButton = event.target.closest("[data-video-remove-subtitle]");
	if (removeButton) {
		const index = Number(removeButton.dataset.videoRemoveSubtitle);
		videoSubtitleState.splice(index, 1);
		activeVideoSubtitleIndex = -1;
		renderVideoSubtitleRows();
		return;
	}
	const editButton = event.target.closest("[data-video-edit-subtitle]");
	if (editButton) {
		syncVideoSubtitleRows();
		activeVideoSubtitleIndex = Number(editButton.dataset.videoEditSubtitle);
		videoCueState = parseVttCues(videoSubtitleState[activeVideoSubtitleIndex]?.content);
		renderVideoCueEditor();
	}
});

videoCueEditor.addEventListener("input", syncVideoCues);
videoCueEditor.addEventListener("click", (event) => {
	if (event.target.closest("[data-video-add-cue]")) {
		syncVideoCues();
		const start = Number(videoPreview.currentTime || 0);
		videoCueState.push({ start, end: start + 2, text: "" });
		renderVideoCueEditor();
		return;
	}
	const nowButton = event.target.closest("[data-video-cue-now]");
	if (nowButton) {
		syncVideoCues();
		const index = Number(nowButton.dataset.videoCueIndex);
		const field = nowButton.dataset.videoCueNow;
		videoCueState[index][field] = Number(videoPreview.currentTime || 0);
		renderVideoCueEditor();
		return;
	}
	const removeButton = event.target.closest("[data-video-remove-cue]");
	if (removeButton) {
		syncVideoCues();
		videoCueState.splice(Number(removeButton.dataset.videoRemoveCue), 1);
		renderVideoCueEditor();
	}
});

deleteConfirmation.addEventListener("input", () => {
	confirmDeleteButton.disabled = !isDeleteConfirmation(deleteConfirmation.value);
});

deleteDialogForm.addEventListener("submit", (event) => {
	event.preventDefault();
	if (!pendingDeletion || !isDeleteConfirmation(deleteConfirmation.value)) return;
	const target = pendingDeletion;
	pendingDeletion = null;
	deleteDialog.close();
	executeDeletion(target);
});

document.getElementById("cancelDelete").addEventListener("click", () => {
	pendingDeletion = null;
	deleteDialog.close();
});

document.getElementById("reloadGallery").addEventListener("click", () => loadGallery().catch((error) => showNotice(error.message, true)));
document.getElementById("newWorldPoint").addEventListener("click", clearWorldPointForm);
document.getElementById("reloadWorldPoints").addEventListener("click", () => loadWorldPoints().catch((error) => showNotice(error.message, true)));
document.getElementById("publishWorldPoint").addEventListener("click", async () => {
	try {
		if (!worldPointForm.reportValidity()) return;
		const response = await api(editingWorldPointId ? `/api/v1/admin/world-points/${encodeURIComponent(editingWorldPointId)}` : "/api/v1/admin/world-points", { method: editingWorldPointId ? "PUT" : "POST", body: JSON.stringify(worldPointPayload()) });
		editingWorldPointId = response.point.id;
		await api(`/api/v1/admin/world-points/${encodeURIComponent(editingWorldPointId)}/publish`, { method: "POST" });
		await loadWorldPoints(editingWorldPointId);
		showNotice("World Point veröffentlicht.");
	} catch (error) { showNotice(error.message, true); }
});
document.getElementById("archiveWorldPoint").addEventListener("click", () => { if (editingWorldPointId) requestDeletion({ kind: "world", id: editingWorldPointId }); });
document.getElementById("newPartner").addEventListener("click", clearPartnerForm);
document.getElementById("reloadPartners").addEventListener("click", () => loadPartners().catch((error) => showNotice(error.message, true)));
document.getElementById("publishPartner").addEventListener("click", async () => {
	try {
		if (!partnerForm.reportValidity()) return;
		const response = await api(editingPartnerId ? `/api/v1/admin/partners/${encodeURIComponent(editingPartnerId)}` : "/api/v1/admin/partners", { method: editingPartnerId ? "PUT" : "POST", body: JSON.stringify(partnerPayload()) });
		editingPartnerId = response.partner.id;
		await api(`/api/v1/admin/partners/${encodeURIComponent(editingPartnerId)}/publish`, { method: "POST" });
		await loadPartners(editingPartnerId);
		showNotice("Partner veröffentlicht.");
	} catch (error) { showNotice(error.message, true); }
});
document.getElementById("archivePartner").addEventListener("click", () => { if (editingPartnerId) requestDeletion({ kind: "partner", id: editingPartnerId }); });
document.getElementById("newVideo").addEventListener("click", clearVideoForm);
document.getElementById("reloadVideos").addEventListener("click", () => loadVideos().catch((error) => showNotice(error.message, true)));
document.getElementById("publishVideo").addEventListener("click", async () => {
	try {
		if (!videoForm.reportValidity()) return;
		const payload = videoPayload();
		const response = await api(editingVideoId ? `/api/v1/admin/videos/${encodeURIComponent(editingVideoId)}` : "/api/v1/admin/videos", { method: editingVideoId ? "PUT" : "POST", body: JSON.stringify(payload) });
		editingVideoId = response.video.id;
		await api(`/api/v1/admin/videos/${encodeURIComponent(editingVideoId)}/publish`, { method: "POST" });
		await loadVideos(editingVideoId);
		showNotice("Video veröffentlicht.");
	} catch (error) { showNotice(error.message, true); }
});
document.getElementById("archiveVideo").addEventListener("click", () => { if (editingVideoId) requestDeletion({ kind: "video", id: editingVideoId }); });
adminTabs.forEach((tab) => tab.addEventListener("click", () => setAdminView(tab.dataset.adminTab)));

clearForm();
clearWorldPointForm();
clearPartnerForm();
clearVideoForm();
setAdminView("news");
loadNews().catch((error) => showNotice(error.message, true));
loadGallery().catch((error) => showNotice(error.message, true));
loadWorldPoints().catch((error) => showNotice(error.message, true));
loadPartners().catch((error) => showNotice(error.message, true));
loadVideos().catch((error) => showNotice(error.message, true));
