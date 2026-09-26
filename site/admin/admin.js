import { createAdminMediaPreview } from "./media-preview.js";
import { ONLINE_PROJECT_TOPICS, isOnlineProjectTopic } from "../source/scripts/online-project-topics.js";

const LANGUAGES = ["ru", "en", "de"];
const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
let localAdminToken = sessionStorage.getItem("mirokitNewsAdminToken") || "";
let newsItems = [];
let galleryItems = [];
let galleryQuotes = [];
let worldPoints = [];
let partners = [];
let videos = [];
let interviewMaterials = [];
let projects = [];
let editingId = null;
let editingWorldPointId = null;
let editingPartnerId = null;
let editingVideoId = null;
let editingInterviewMaterialId = null;
let editingProjectId = null;
let videoSubtitleState = [];
let activeVideoSubtitleIndex = -1;
let videoCueState = [];
let videoPreviewVersion = 0;
let videoScope = "general";

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
const gallerySourceFields = document.getElementById("gallerySourceFields");
const galleryFolderTranslations = document.getElementById("galleryFolderTranslations");
const galleryTranslationsSection = document.getElementById("galleryTranslationsSection");
const galleryLanguagesHeading = document.getElementById("galleryLanguagesHeading");
const galleryLanguagesHelp = document.getElementById("galleryLanguagesHelp");
const galleryThumbnailFile = document.getElementById("galleryThumbnailFile");
const galleryList = document.getElementById("galleryList");
const galleryCollection = document.getElementById("galleryCollection");
const galleryTopic = document.getElementById("galleryTopic");
const galleryTopicFilter = document.getElementById("galleryTopicFilter");
const galleryPublishButton = document.getElementById("galleryPublishButton");
const onlineProjectLibraryLink = document.getElementById("onlineProjectLibraryLink");
for (const topic of ONLINE_PROJECT_TOPICS) {
	galleryTopic.add(new Option(topic.label, topic.id));
	galleryTopicFilter.add(new Option(topic.label, topic.id));
}
const quoteForm = document.getElementById("quoteForm");
const quoteFolder = document.getElementById("quoteFolder");
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
const interviewVideoEditorMount = document.getElementById("interviewVideoEditorMount");
const interviewVideosList = document.getElementById("interviewVideosList");
const interviewMaterialsList = document.getElementById("interviewMaterialsList");
const interviewMaterialForm = document.getElementById("interviewMaterialForm");
const interviewMaterialFile = document.getElementById("interviewMaterialFile");
const projectForm = document.getElementById("projectForm");
const projectsList = document.getElementById("projectsList");
const projectFile = document.getElementById("projectFile");
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
	const selectedView = viewKey === "online-projects" || adminViews.some((view) => view.dataset.adminView === viewKey) ? viewKey : "news";
	const panelKey = selectedView === "online-projects" ? "gallery" : selectedView;
	if (selectedView === "interviews") {
		videoScope = "interviews";
		interviewVideoEditorMount.append(videoForm);
		updateVideoEditorContext();
	} else if (selectedView === "videos") {
		videoScope = "general";
		document.getElementById("videoEditorMount").append(videoForm);
		updateVideoEditorContext();
	}
	adminViews.forEach((view) => { view.hidden = view.dataset.adminView !== panelKey; });
	adminTabs.forEach((tab) => {
		const isActive = tab.dataset.adminTab === selectedView;
		tab.classList.toggle("is-active", isActive);
		tab.setAttribute("aria-selected", String(isActive));
	});
	newNewsButton.hidden = selectedView !== "news";
	if (panelKey === "gallery") configureGalleryView(selectedView === "online-projects");
	if (selectedView === "videos") loadVideos().catch((error) => showNotice(error.message, true));
	if (selectedView === "interviews") {
		loadVideos().catch((error) => showNotice(error.message, true));
		loadInterviewMaterials().catch((error) => showNotice(error.message, true));
	}
}

function updateVideoEditorContext() {
	const interviews = videoScope === "interviews";
	document.getElementById("videoHeading").textContent = interviews ? "Neues Interview" : "Neues Video";
	document.querySelector("#videoForm .eyebrow").textContent = interviews ? "INTERVIEW VIDEO EDITOR" : "VIDEO EDITOR";
	document.querySelector("#videoForm .action-copy strong").textContent = interviews ? "Interview fertig?" : "Video fertig?";
	document.querySelector("#videoForm .action-copy span").textContent = interviews ? "Als Interview-Entwurf speichern oder veröffentlichen." : "Als Entwurf speichern oder veröffentlichen.";
}

function videoApiPath(id = "") {
	const base = videoScope === "interviews" ? "/api/v1/admin/interviews/videos" : "/api/v1/admin/videos";
	return id ? `${base}/${encodeURIComponent(id)}` : base;
}

function videoMediaApiPath() {
	return videoScope === "interviews" ? "/api/v1/admin/interviews/videos/media" : "/api/v1/admin/videos/media";
}

function configureGalleryView(isOnline) {
	galleryCollection.value = isOnline ? "online-projects" : "gallery";
	galleryTopic.required = isOnline;
	galleryTopic.disabled = !isOnline;
	for (const id of ["onlineProjectSteps", "onlineProjectDestination", "onlineProjectListControls"]) document.getElementById(id).hidden = !isOnline;
	document.getElementById("galleryQuotesSection").hidden = isOnline;
	gallerySourceFields.hidden = !isOnline;
	galleryTranslationsSection.hidden = isOnline;
	galleryFolderTranslations.hidden = isOnline;
	galleryFolderTranslations.querySelectorAll("[data-gallery-folder-field=title]").forEach((field) => { field.required = !isOnline; });
	gallerySourceUrl.required = false;
	document.getElementById("galleryPanelEyebrow").textContent = isOnline ? "10 THEMEN · BILDERBIBLIOTHEKEN" : "MEDIENARCHIV";
	document.getElementById("galleryPanelTitle").textContent = isOnline ? "Online-Projekte" : "Gallery-Bilder";
	document.getElementById("galleryIntroTitle").textContent = isOnline ? "So landet dein Bild im richtigen Thema" : "Bilder für die öffentliche Galerie";
	document.getElementById("galleryIntroText").textContent = isOnline ? "Hier verwaltest du die Bilder hinter den zehn Online-Projekte-Buttons. Jede Bibliothek sammelt die Arbeiten zu einem Thema." : "Wähle ein Bild aus, ergänze die Texte und veröffentliche es in der Galerie.";
	document.getElementById("adminViewGallery").setAttribute("aria-labelledby", isOnline ? "onlineProjectsTab" : "galleryTab");
	updateGalleryDestination();
	renderGalleryList();
}

function updateGalleryDestination() {
	const topic = ONLINE_PROJECT_TOPICS.find((item) => item.id === galleryTopic.value);
	onlineProjectLibraryLink.href = `/page/onlineProjects/index.html?lang=de${topic ? `&topic=${topic.id}` : ""}`;
	galleryPublishButton.textContent = galleryCollection.value === "online-projects" && topic ? `In „${topic.label}“ veröffentlichen` : "Bilder als Entwurf hochladen";
}
galleryTopic.addEventListener("change", updateGalleryDestination);
galleryTopicFilter.addEventListener("change", renderGalleryList);

function showNotice(message, error = false, type = "") {
	if (!message) {
		notice.replaceChildren();
		return;
	}
	const kind = error ? "error" : type || (String(message).includes("…") ? "info" : "success");
	const toast = document.createElement("article");
	toast.className = `admin-toast admin-toast-${kind}`;
	toast.setAttribute("role", kind === "error" ? "alert" : "status");
	const icon = document.createElement("span");
	icon.className = "admin-toast-icon";
	icon.setAttribute("aria-hidden", "true");
	icon.textContent = kind === "error" ? "!" : kind === "info" ? "i" : "✓";
	const text = document.createElement("p");
	text.textContent = message;
	const close = document.createElement("button");
	close.className = "admin-toast-close";
	close.type = "button";
	close.setAttribute("aria-label", "Meldung schließen");
	close.textContent = "×";
	const dismiss = () => {
		toast.classList.add("is-leaving");
		window.setTimeout(() => toast.remove(), 220);
	};
	close.addEventListener("click", dismiss);
	toast.append(icon, text, close);
	notice.append(toast);
	window.requestAnimationFrame(() => toast.classList.add("is-visible"));
	window.setTimeout(dismiss, kind === "error" ? 9000 : kind === "info" ? 6500 : 5000);
	if (error) focusAdminErrorField(message);
}

const localizedAdminFields = new Set(["title", "alt", "summary", "content", "description", "name", "city", "country"]);
const adminFieldIds = {
	id: ["newsId", "videoId", "worldPointId", "partnerId", "projectId", "interviewMaterialId"],
	sourceUrl: ["videoSourceUrl", "interviewMaterialSourceUrl"],
	sourceType: ["videoSourceType", "interviewMaterialSourceType"],
	poster: ["videoPoster"],
	durationSeconds: ["videoDuration"],
	width: ["videoWidth"],
	height: ["videoHeight"],
	sortOrder: ["videoSortOrder", "worldSortOrder", "partnerSortOrder", "interviewMaterialSortOrder"],
	image: ["image", "galleryImage", "partnerImage", "projectImage"],
	category: ["category", "partnerCategory"],
	startDate: ["projectStartDate"],
	endDate: ["projectEndDate"],
	accent: ["accent", "projectAccent"],
	topic: ["galleryTopic"],
	website: ["partnerWebsite"],
	linkUrl: ["linkUrl", "projectLinkUrl"],
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
			const selector = `[data-language="${language}"][data-field="${name}"], [data-video-language="${language}"][data-video-field="${name}"], [data-world-language="${language}"][data-world-field="${name}"], [data-partner-language="${language}"][data-partner-field="${name}"], [data-project-language="${language}"][data-project-field="${name}"], [data-interview-material-language="${language}"][data-interview-material-field="${name}"]`;
		field = visibleAdminField([...document.querySelectorAll(selector)]);
	}
	if (!field) {
		const languageMatch = text.match(/\b(?:translation|translations)\s+for\s+(ru|en|de)\b/i);
		if (languageMatch) {
			const language = languageMatch[1].toLowerCase();
				field = visibleAdminField([...document.querySelectorAll(`[data-language="${language}"], [data-video-language="${language}"], [data-world-language="${language}"], [data-partner-language="${language}"], [data-project-language="${language}"], [data-interview-material-language="${language}"]`)]);
		}
	}
	if (!field) {
		const fieldMatch = text.match(/\b(sourceUrl|sourceType|poster|durationSeconds|width|height|sortOrder|image|category|website|linkUrl|latitude|longitude|pointStatus|flag|id)\b/i);
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
	deleteDialogTitle.textContent = target.kind === "news" ? "News entfernen?" : target.kind === "gallery" ? "Gallery-Bild löschen?" : target.kind === "quote" ? "Gallery-Zitat entfernen?" : target.kind === "world" ? "World Point archivieren?" : target.kind === "video" ? "Video archivieren?" : target.kind === "interview-video" ? "Interview archivieren?" : target.kind === "interview-material" ? "Interview-Material archivieren?" : target.kind === "project" ? "Projekt archivieren?" : "Partner archivieren?";
	deleteDialogMessage.textContent = target.kind === "news"
		? "Die News wird aus der öffentlichen Veröffentlichung entfernt."
		: target.kind === "gallery"
			? "Das Bild und seine R2-Metadaten werden endgültig gelöscht."
			: target.kind === "quote"
				? "Das Zitat wird aus der öffentlichen Gallery entfernt."
			: target.kind === "video" || target.kind === "interview-video"
				? "Das Video wird archiviert und ist danach nicht mehr öffentlich sichtbar."
			: target.kind === "interview-material"
				? "Das Material wird archiviert und ist danach nicht mehr öffentlich sichtbar."
			: target.kind === "project"
				? "Das Projekt wird archiviert und ist danach nicht mehr öffentlich sichtbar."
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
		} else if (target.kind === "interview-video") {
			await api(`/api/v1/admin/interviews/videos/${encodeURIComponent(target.id)}`, { method: "DELETE" });
			await loadVideos();
			clearVideoForm();
			showNotice("Interview archiviert.");
		} else if (target.kind === "interview-material") {
			await api(`/api/v1/admin/interviews/materials/${encodeURIComponent(target.id)}`, { method: "DELETE" });
			await loadInterviewMaterials();
			clearInterviewMaterialForm();
			showNotice("Interview-Material archiviert.");
		} else if (target.kind === "project") {
			await api(`/api/v1/admin/projects/${encodeURIComponent(target.id)}`, { method: "DELETE" });
			await loadProjects();
			clearProjectForm();
			showNotice("Projekt archiviert.");
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

const { fetchAdminMedia, setMediaPreview } = createAdminMediaPreview({
	origin: window.location.origin, isLocal, getLocalToken, showNotice,
});

function escapeHtml(value) {
	return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function field(language, name) {
	return form.querySelector(`[data-language="${language}"][data-field="${name}"]`);
}

function galleryFolderField(language, name) {
	return galleryForm.querySelector(`[data-gallery-folder-language="${language}"][data-gallery-folder-field="${name}"]`);
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
	updateVideoEditorContext();
}

function clearInterviewMaterialForm() {
	editingInterviewMaterialId = null;
	interviewMaterialForm.reset();
	document.getElementById("interviewMaterialId").disabled = false;
	document.getElementById("interviewMaterialHeading").textContent = "Neues Material";
	document.getElementById("interviewMaterialStatus").textContent = "Entwurf";
	document.getElementById("archiveInterviewMaterial").hidden = true;
	document.getElementById("interviewMaterialKind").value = "documents";
	document.getElementById("interviewMaterialSourceType").value = "r2";
	document.getElementById("interviewMaterialSortOrder").value = "0";
}

function clearProjectForm() {
	editingProjectId = null;
	projectForm.reset();
	document.getElementById("projectId").disabled = false;
	document.getElementById("projectHeading").textContent = "Neues Projekt";
	document.getElementById("projectStatus").textContent = "Entwurf";
	document.getElementById("archiveProject").hidden = true;
	document.getElementById("projectCategory").value = "creative";
	document.getElementById("projectAccent").value = "blue";
	document.getElementById("projectSortOrder").value = "0";
	const today = new Date().toISOString().slice(0, 10);
	document.getElementById("projectStartDate").value = today;
	renderProjects();
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
			const response = await fetchAdminMedia(subtitle.src);
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

function interviewMaterialField(language, name) {
	return interviewMaterialForm.querySelector(`[data-interview-material-language="${language}"][data-interview-material-field="${name}"]`);
}

function interviewMaterialPayload() {
	return {
		id: document.getElementById("interviewMaterialId").value.trim(),
		kind: document.getElementById("interviewMaterialKind").value,
		sourceType: document.getElementById("interviewMaterialSourceType").value,
		sourceUrl: document.getElementById("interviewMaterialSourceUrl").value.trim(),
		fileName: document.getElementById("interviewMaterialFileName").value.trim(),
		mimeType: document.getElementById("interviewMaterialFile").dataset.mimeType || "",
		sizeBytes: document.getElementById("interviewMaterialFile").dataset.sizeBytes || null,
		featured: document.getElementById("interviewMaterialFeatured").checked,
		sortOrder: Number(document.getElementById("interviewMaterialSortOrder").value || 0),
		translations: Object.fromEntries(LANGUAGES.map((language) => [language, {
			title: interviewMaterialField(language, "title").value.trim(),
			description: interviewMaterialField(language, "description").value.trim(),
			alt: interviewMaterialField(language, "alt").value.trim(),
		}])),
	};
}

function populateInterviewMaterial(item) {
	editingInterviewMaterialId = item.id;
	document.getElementById("interviewMaterialId").value = item.id;
	document.getElementById("interviewMaterialId").disabled = true;
	document.getElementById("interviewMaterialKind").value = item.kind || "documents";
	document.getElementById("interviewMaterialSourceType").value = item.sourceType || "external";
	document.getElementById("interviewMaterialSourceUrl").value = item.sourceUrl || "";
	document.getElementById("interviewMaterialFileName").value = item.fileName || "";
	document.getElementById("interviewMaterialSortOrder").value = item.sortOrder || 0;
	document.getElementById("interviewMaterialFeatured").checked = Boolean(item.featured);
	const fileInput = document.getElementById("interviewMaterialFile");
	delete fileInput.dataset.mimeType;
	delete fileInput.dataset.sizeBytes;
	for (const language of LANGUAGES) {
		const translation = item.translations?.[language] || {};
		interviewMaterialField(language, "title").value = translation.title || "";
		interviewMaterialField(language, "description").value = translation.description || "";
		interviewMaterialField(language, "alt").value = translation.alt || "";
	}
	document.getElementById("interviewMaterialHeading").textContent = item.id;
	document.getElementById("interviewMaterialStatus").textContent = item.status === "published" ? "Veröffentlicht" : item.status === "archived" ? "Archiviert" : "Entwurf";
	document.getElementById("archiveInterviewMaterial").hidden = item.status === "archived";
	renderInterviewMaterials();
}

async function setVideoPreview() {
	const version = ++videoPreviewVersion;
	const sourceType = document.getElementById("videoSourceType").value;
	const source = document.getElementById("videoSourceUrl").value.trim();
	if (sourceType === "youtube" || !source) {
		videoPreview.pause();
		setMediaPreview(videoPreview, "src", "");
		setMediaPreview(videoPreview, "poster", "");
		videoPreview.hidden = true;
		return;
	}
	await Promise.all([
		setMediaPreview(videoPreview, "src", source),
		setMediaPreview(videoPreview, "poster", document.getElementById("videoPoster").value.trim()),
	]);
	if (version !== videoPreviewVersion) return;
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

function populateProject(item) {
	editingProjectId = item.id;
	document.getElementById("projectId").value = item.id;
	document.getElementById("projectId").disabled = true;
	document.getElementById("projectStartDate").value = item.startDate || "";
	document.getElementById("projectEndDate").value = item.endDate || "";
	document.getElementById("projectCategory").value = item.category || "creative";
	document.getElementById("projectAccent").value = item.accent || "blue";
	document.getElementById("projectImage").value = item.image || "";
	document.getElementById("projectLinkUrl").value = item.linkUrl || "";
	document.getElementById("projectFeatured").checked = Boolean(item.featured);
	document.getElementById("projectSortOrder").value = item.sortOrder || 0;
	for (const language of LANGUAGES) {
		const translation = item.translations?.[language] || {};
		projectField(language, "title").value = translation.title || "";
		projectField(language, "alt").value = translation.alt || "";
		projectField(language, "description").value = translation.description || "";
	}
	document.getElementById("projectHeading").textContent = item.id;
	document.getElementById("projectStatus").textContent = item.status === "published" ? "Veröffentlicht" : item.status === "archived" ? "Archiviert" : "Entwurf";
	document.getElementById("archiveProject").hidden = item.status === "archived";
	renderProjects();
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

function projectField(language, name) {
	return projectForm.querySelector(`[data-project-language="${language}"][data-project-field="${name}"]`);
}

function projectPayload() {
	return {
		id: document.getElementById("projectId").value.trim(),
		startDate: document.getElementById("projectStartDate").value,
		endDate: document.getElementById("projectEndDate").value || null,
		category: document.getElementById("projectCategory").value,
		accent: document.getElementById("projectAccent").value,
		image: document.getElementById("projectImage").value.trim(),
		linkUrl: document.getElementById("projectLinkUrl").value.trim(),
		featured: document.getElementById("projectFeatured").checked,
		sortOrder: Number(document.getElementById("projectSortOrder").value || 0),
		translations: Object.fromEntries(LANGUAGES.map((language) => [language, {
			title: projectField(language, "title").value.trim(),
			alt: projectField(language, "alt").value.trim(),
			description: projectField(language, "description").value.trim(),
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
	setFormValue("linkUrl", item.linkUrl);
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
		linkUrl: document.getElementById("linkUrl").value.trim(),
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
	renderQuoteFolderOptions();
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

function renderQuoteFolderOptions() {
	const selected = quoteFolder.value;
	const folders = new Map();
	galleryItems.filter((item) => (item.collection || "gallery") === "gallery").forEach((item) => {
		const slug = item.folderSlug || "uncategorized";
		if (!folders.has(slug)) folders.set(slug, item.folderTitle || "Gallery");
	});
	quoteFolder.innerHTML = '<option value="">Ordner auswählen</option>' + [...folders.entries()].map(([slug, title]) => `<option value="${escapeHtml(slug)}">${escapeHtml(title)}</option>`).join("");
	if (folders.has(selected)) quoteFolder.value = selected;
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
	const response = await api(videoApiPath());
	videos = response.videos || [];
	renderVideos();
	const selected = videos.find((item) => item.id === selectId);
	if (selected) await populateVideo(selected);
}

async function loadInterviewMaterials(selectId = editingInterviewMaterialId) {
	const response = await api("/api/v1/admin/interviews/materials");
	interviewMaterials = response.materials || [];
	renderInterviewMaterials();
	const selected = interviewMaterials.find((item) => item.id === selectId);
	if (selected) populateInterviewMaterial(selected);
}

async function loadProjects(selectId = editingProjectId) {
	const response = await api("/api/v1/admin/projects");
	projects = response.projects || [];
	renderProjects();
	const selected = projects.find((item) => item.id === selectId);
	if (selected) populateProject(selected);
}

function formatVideoDuration(value) {
	if (value === null || value === undefined || !Number.isFinite(Number(value))) return "Dauer unbekannt";
	const total = Math.max(0, Math.round(Number(value)));
	return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function renderVideos() {
	const list = videoScope === "interviews" ? interviewVideosList : videosList;
	if (!videos.length) {
		list.innerHTML = videoScope === "interviews" ? '<p class="muted">Noch keine Interview-Videos vorhanden. Lege zuerst ein Gespräch an.</p>' : '<p class="muted">Noch keine Videos vorhanden.</p>';
		return;
	}
	list.innerHTML = videos.map((item) => {
		const translation = item.translations?.de || item.translations?.en || item.translations?.ru || {};
		const deleteAttribute = videoScope === "interviews" ? "data-interview-video-delete-id" : "data-video-delete-id";
		return `<article class="news-item${item.id === editingVideoId ? " active" : ""}"><button class="news-item-select" type="button" data-video-id="${escapeHtml(item.id)}"><strong>${escapeHtml(translation.title || item.id)}</strong><span>${escapeHtml(item.sourceType)} · ${formatVideoDuration(item.durationSeconds)} · ${escapeHtml(item.status)}</span></button>${item.status !== "archived" ? `<button class="button button-danger button-remove" type="button" ${deleteAttribute}="${escapeHtml(item.id)}">Archivieren</button>` : ""}</article>`;
	}).join("");
}

function renderInterviewMaterials() {
	if (!interviewMaterials.length) {
		interviewMaterialsList.innerHTML = '<p class="muted">Noch keine Interview-Materialien vorhanden. Lege zuerst ein Dokument, einen Prospekt, ein Formular oder eine Anfrage an.</p>';
		return;
	}
	interviewMaterialsList.innerHTML = interviewMaterials.map((item) => {
		const translation = item.translations?.de || item.translations?.en || item.translations?.ru || {};
		return `<article class="news-item${item.id === editingInterviewMaterialId ? " active" : ""}"><button class="news-item-select" type="button" data-interview-material-id="${escapeHtml(item.id)}"><strong>${escapeHtml(translation.title || item.id)}</strong><span>${escapeHtml(item.kind)} · ${escapeHtml(item.status)}${item.fileName ? ` · ${escapeHtml(item.fileName)}` : ""}</span></button>${item.status !== "archived" ? `<button class="button button-danger button-remove" type="button" data-interview-material-delete-id="${escapeHtml(item.id)}">Archivieren</button>` : ""}</article>`;
	}).join("");
}

function renderProjects() {
	if (!projects.length) {
		projectsList.innerHTML = '<p class="muted">Noch keine Projekte vorhanden. Lege zuerst einen Entwurf an.</p>';
		return;
	}
	projectsList.innerHTML = projects.map((item) => {
		const translation = item.translations?.de || item.translations?.en || item.translations?.ru || {};
		const phase = item.phase === "past" ? "Past" : item.phase === "upcoming" ? "Upcoming" : "Current";
		return `<article class="news-item${item.id === editingProjectId ? " active" : ""}"><button class="news-item-select" type="button" data-project-id="${escapeHtml(item.id)}"><strong>${escapeHtml(translation.title || item.id)}</strong><span>${escapeHtml(phase)} · ${escapeHtml(item.status)} · ${escapeHtml(item.startDate)}${item.endDate ? ` – ${escapeHtml(item.endDate)}` : ""}</span></button>${item.status !== "archived" ? `<button class="button button-danger button-remove" type="button" data-project-delete-id="${escapeHtml(item.id)}">Archivieren</button>` : ""}</article>`;
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
	galleryList.querySelectorAll("img").forEach((element) => setMediaPreview(element, "src", ""));
	const isOnline = galleryCollection.value === "online-projects";
	const selectedTopic = galleryTopicFilter.value;
	const visibleItems = galleryItems.filter((item) => (item.collection || "gallery") === galleryCollection.value)
		.filter((item) => !isOnline || selectedTopic === "all" || (selectedTopic === "unassigned" ? !isOnlineProjectTopic(item.topic) : item.topic === selectedTopic));
	if (!visibleItems.length) {
		galleryList.innerHTML = `<p class="muted">${isOnline ? "In dieser Auswahl gibt es noch keine Bilder. Wähle oben ein Thema und veröffentliche das erste Bild." : "Noch keine Gallery-Bilder vorhanden."}</p>`;
		return;
	}
	if (!isOnline) {
		const folders = new Map();
		visibleItems.forEach((item) => {
			const slug = item.folderSlug || "uncategorized";
			if (!folders.has(slug)) folders.set(slug, {
				slug,
				title: item.folderTitleTranslations || { ru: item.folderTitle || "Gallery", en: item.folderTitle || "Gallery", de: item.folderTitle || "Gallery" },
				subtitle: item.folderSubtitleTranslations || { ru: item.folderSubtitle || "", en: item.folderSubtitle || "", de: item.folderSubtitle || "" },
				items: [],
			});
			folders.get(slug).items.push(item);
		});
		const pendingFolders = new Map();
		visibleItems.filter((item) => item.status === "pending").forEach((item) => {
			const key = item.folderSlug || "uncategorized";
			if (!pendingFolders.has(key)) pendingFolders.set(key, []);
			pendingFolders.get(key).push(item.key);
		});
		const publishFolders = [...pendingFolders.entries()].map(([slug, keys]) => {
			const folder = folders.get(slug);
			const title = folder?.title?.de || folder?.title?.en || folder?.title?.ru || "Gallery";
			return `<div class="gallery-publish-batch"><div><strong>Pending: ${escapeHtml(title)}</strong><span>${keys.length} Bild${keys.length === 1 ? "" : "er"} warten auf Veröffentlichung.</span></div><button class="button button-primary button-small" type="button" data-gallery-publish-keys="${escapeHtml(JSON.stringify(keys))}">Ordner veröffentlichen</button></div>`;
		}).join("");
		const folderPackages = [...folders.values()].map((folder) => {
			const thumbnail = folder.items.find((item) => item.folderThumbnail) || folder.items[0];
			const folderKeys = JSON.stringify(folder.items.map((item) => item.key));
			const folderEditor = `<details class="gallery-folder-editor"><summary>Ordner-Übersetzungen bearbeiten</summary><div class="gallery-folder-edit-grid">${LANGUAGES.map((language) => `<label>${language.toUpperCase()} Überschrift<input data-gallery-folder-edit-field="title" data-gallery-folder-edit-language="${language}" value="${escapeHtml(folder.title?.[language] || "")}" maxlength="120" /></label><label>${language.toUpperCase()} Titel<input data-gallery-folder-edit-field="subtitle" data-gallery-folder-edit-language="${language}" value="${escapeHtml(folder.subtitle?.[language] || "")}" maxlength="500" /></label>`).join("")}<button class="button button-primary button-small" type="button" data-gallery-save-folder-keys="${escapeHtml(folderKeys)}">Ordner speichern</button></div></details>`;
			const items = folder.items.map((item) => {
				const alt = item.alt?.de || item.alt?.en || item.alt?.ru || "";
				return `<article class="gallery-admin-item" data-gallery-item-card="${escapeHtml(item.key)}"><img loading="lazy" data-media-url="${escapeHtml(item.image)}" alt="${escapeHtml(alt)}" /><div class="gallery-admin-copy"><strong>Bild</strong><span>${item.status === "pending" ? "Entwurf · " : ""}${item.featured ? "Hervorgehoben · " : ""}${escapeHtml(item.status)}</span><details class="gallery-item-editor"><summary>Bildoptionen</summary><div class="gallery-item-edit-grid"><label class="feature-toggle"><input type="checkbox" data-gallery-edit-featured ${item.featured ? "checked" : ""} /><span>Hervorgehoben</span></label><button class="button button-primary button-small" type="button" data-gallery-save-key="${escapeHtml(item.key)}">Änderungen speichern</button></div></details><div class="gallery-item-actions">${item.folderThumbnail ? "<span class=\"gallery-thumbnail-badge\">Ordner-Thumbnail</span>" : `<button class="button button-small" type="button" data-gallery-thumbnail-key="${escapeHtml(item.key)}">Als Thumbnail verwenden</button>`}<button class="button button-danger button-remove" type="button" data-gallery-delete-key="${escapeHtml(item.key)}">Bild löschen</button></div></div></article>`;
			}).join("");
			const folderTitle = folder.title?.de || folder.title?.en || folder.title?.ru || "Gallery";
			const folderSubtitle = folder.subtitle?.de || folder.subtitle?.en || folder.subtitle?.ru || "";
			return `<details class="gallery-admin-folder" open><summary><span class="gallery-folder-preview"><img loading="lazy" data-media-url="${escapeHtml(thumbnail?.image || "")}" alt="" /></span><span><strong>${escapeHtml(folderTitle)}</strong><small>${escapeHtml(folderSubtitle || "Ordner ohne Kurzbeschreibung")}</small><small>${folder.items.length} Bild${folder.items.length === 1 ? "" : "er"} · Paket öffnen</small></span></summary>${folderEditor}<div class="gallery-folder-package">${items}</div></details>`;
		}).join("");
		galleryList.innerHTML = publishFolders + folderPackages;
		galleryList.querySelectorAll("img[data-media-url]").forEach((element) => setMediaPreview(element, "src", element.dataset.mediaUrl));
		return;
	}

	const pendingFolders = new Map();
	if (!isOnline) visibleItems.filter((item) => item.status === "pending").forEach((item) => {
		const key = item.folderSlug || "uncategorized";
		if (!pendingFolders.has(key)) pendingFolders.set(key, { title: item.folderTitle || "Gallery", keys: [] });
		pendingFolders.get(key).keys.push(item.key);
	});
	const publishFolders = [...pendingFolders.values()].map((folder) => `<div class="gallery-publish-batch"><div><strong>Pending: ${escapeHtml(folder.title)}</strong><span>${folder.keys.length} Bild${folder.keys.length === 1 ? "" : "er"} warten auf Veröffentlichung.</span></div><button class="button button-primary button-small" type="button" data-gallery-publish-keys="${escapeHtml(JSON.stringify(folder.keys))}">Ordner veröffentlichen</button></div>`).join("");
	galleryList.innerHTML = publishFolders + visibleItems.map((item, index) => {
		const title = item.title?.de || item.title?.en || item.title?.ru || item.key;
		const alt = item.alt?.de || item.alt?.en || item.alt?.ru || "";
		const subtitle = item.subtitle?.de || item.subtitle?.en || item.subtitle?.ru || "";
		const folderTitle = item.folderTitle || "Gallery";
		const topicName = ONLINE_PROJECT_TOPICS.find((topic) => topic.id === item.topic)?.label || "Noch ohne Thema";
		const topicEditor = isOnline ? `<div class="gallery-topic-edit"><label for="galleryItemTopic${index}">Thema ändern</label><select id="galleryItemTopic${index}" data-gallery-item-topic><option value="">Bitte zuordnen</option>${ONLINE_PROJECT_TOPICS.map((topic) => `<option value="${topic.id}"${topic.id === item.topic ? " selected" : ""}>${escapeHtml(topic.label)}</option>`).join("")}</select><button class="button button-small" type="button" data-gallery-topic-key="${escapeHtml(item.key)}">Thema speichern</button></div>` : "";
		return `<article class="gallery-admin-item"><img loading="lazy" data-media-url="${escapeHtml(item.image)}" alt="${escapeHtml(alt)}" /><div class="gallery-admin-copy"><strong>${escapeHtml(title)}</strong><span class="gallery-folder-label">${escapeHtml(folderTitle)}</span>${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""}<span>${isOnline ? `${escapeHtml(topicName)} · ` : ""}${item.sourceType === "drive" ? "Google Drive · " : ""}${item.featured ? "Hervorgehoben · " : ""}${escapeHtml(item.status)}</span>${topicEditor}<button class="button button-danger button-remove" type="button" data-gallery-delete-key="${escapeHtml(item.key)}">Bild löschen</button></div></article>`;
	}).join("");
	galleryList.querySelectorAll("img[data-media-url]").forEach((element) => setMediaPreview(element, "src", element.dataset.mediaUrl));
}

function renderQuoteList() {
	if (!galleryQuotes.length) {
		galleryQuoteList.innerHTML = '<p class="muted">Noch keine Gallery-Zitate vorhanden.</p>';
		return;
	}

	galleryQuoteList.innerHTML = galleryQuotes.map((item) => {
		const quote = item.quote?.de || item.quote?.en || item.quote?.ru || "";
		const byline = item.byline?.de || item.byline?.en || item.byline?.ru || "";
		const folder = galleryItems.find((galleryItem) => (galleryItem.folderSlug || "uncategorized") === item.folderSlug)?.folderTitle || item.folderSlug || "Nicht zugewiesen";
		return `<article class="gallery-quote-admin-item"><div><strong>„${escapeHtml(quote)}“</strong><span class="gallery-folder-label">${escapeHtml(folder)}</span>${byline ? `<span>${escapeHtml(byline)}</span>` : ""}<span>${escapeHtml(item.status)}</span></div><button class="button button-danger button-remove" type="button" data-quote-delete-id="${escapeHtml(item.id)}">Zitat entfernen</button></article>`;
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

galleryList.addEventListener("click", async (event) => {
	const publishButton = event.target.closest("[data-gallery-publish-keys]");
	if (publishButton) {
		publishButton.disabled = true;
		try {
			const keys = JSON.parse(publishButton.dataset.galleryPublishKeys);
			await api("/api/v1/admin/gallery/publish", { method: "POST", body: JSON.stringify({ keys }) });
			await loadGallery();
			showNotice(`${keys.length} Bild${keys.length === 1 ? "" : "er"} veröffentlicht und dem R2-Ordner zugeordnet.`);
		} catch (error) { showNotice(error.message, true); }
		finally { publishButton.disabled = false; }
		return;
	}
	const saveFolder = event.target.closest("[data-gallery-save-folder-keys]");
	if (saveFolder) {
		const editor = saveFolder.closest(".gallery-folder-editor");
		const folderTitle = {};
		const folderSubtitle = {};
		editor.querySelectorAll("[data-gallery-folder-edit-field]").forEach((field) => {
			const target = field.dataset.galleryFolderEditField === "title" ? folderTitle : folderSubtitle;
			target[field.dataset.galleryFolderEditLanguage] = field.value.trim();
		});
		let keys;
		try { keys = JSON.parse(saveFolder.dataset.gallerySaveFolderKeys); } catch { showNotice("Der Ordner konnte nicht gelesen werden.", true); return; }
		saveFolder.disabled = true;
		try {
			await Promise.all(keys.map((key) => api(`/api/v1/admin/gallery/${encodeURIComponent(key)}`, {
				method: "PATCH",
				body: JSON.stringify({ folderTitle, folderSubtitle }),
			})));
			await loadGallery();
			showNotice("Ordner-Übersetzungen gespeichert.");
		} catch (error) { showNotice(error.message, true); }
		finally { saveFolder.disabled = false; }
		return;
	}
	const saveImage = event.target.closest("[data-gallery-save-key]");
	if (saveImage) {
		const card = saveImage.closest("[data-gallery-item-card]");
		const payload = { featured: Boolean(card.querySelector("[data-gallery-edit-featured]")?.checked) };
		saveImage.disabled = true;
		try {
			await api(`/api/v1/admin/gallery/${encodeURIComponent(saveImage.dataset.gallerySaveKey)}`, { method: "PATCH", body: JSON.stringify(payload) });
			await loadGallery();
			showNotice("Bildoptionen gespeichert.");
		} catch (error) { showNotice(error.message, true); }
		finally { saveImage.disabled = false; }
		return;
	}
	const thumbnailButton = event.target.closest("[data-gallery-thumbnail-key]");
	if (thumbnailButton) {
		thumbnailButton.disabled = true;
		try {
			await api(`/api/v1/admin/gallery/${encodeURIComponent(thumbnailButton.dataset.galleryThumbnailKey)}`, { method: "PATCH", body: JSON.stringify({ folderThumbnail: true }) });
			await loadGallery();
			showNotice("Ordner-Thumbnail gespeichert.");
		} catch (error) { showNotice(error.message, true); }
		finally { thumbnailButton.disabled = false; }
		return;
	}
	const saveTopic = event.target.closest("[data-gallery-topic-key]");
	if (saveTopic) {
		const select = saveTopic.closest(".gallery-topic-edit").querySelector("select");
		if (!isOnlineProjectTopic(select.value)) { showNotice("Bitte am Bild ein Thema auswählen.", true); select.focus(); return; }
		saveTopic.disabled = true;
		try {
			await api(`/api/v1/admin/gallery/${encodeURIComponent(saveTopic.dataset.galleryTopicKey)}`, { method: "PATCH", body: JSON.stringify({ topic: select.value }) });
			await loadGallery();
			showNotice("Thema gespeichert. Das Bild ist jetzt der gewählten Bibliothek zugeordnet.");
		} catch (error) { showNotice(error.message, true); }
		finally { saveTopic.disabled = false; }
		return;
	}
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

interviewVideosList.addEventListener("click", (event) => {
	const deleteButton = event.target.closest("[data-interview-video-delete-id]");
	if (deleteButton) {
		requestDeletion({ kind: "interview-video", id: deleteButton.dataset.interviewVideoDeleteId });
		return;
	}
	const button = event.target.closest("[data-video-id]");
	const item = videos.find((candidate) => candidate.id === button?.dataset.videoId);
	if (item) populateVideo(item).then(renderVideos);
});

interviewMaterialsList.addEventListener("click", (event) => {
	const deleteButton = event.target.closest("[data-interview-material-delete-id]");
	if (deleteButton) {
		requestDeletion({ kind: "interview-material", id: deleteButton.dataset.interviewMaterialDeleteId });
		return;
	}
	const button = event.target.closest("[data-interview-material-id]");
	const item = interviewMaterials.find((candidate) => candidate.id === button?.dataset.interviewMaterialId);
	if (item) populateInterviewMaterial(item);
});

projectsList.addEventListener("click", (event) => {
	const deleteButton = event.target.closest("[data-project-delete-id]");
	if (deleteButton) {
		requestDeletion({ kind: "project", id: deleteButton.dataset.projectDeleteId });
		return;
	}
	const button = event.target.closest("[data-project-id]");
	const item = projects.find((candidate) => candidate.id === button?.dataset.projectId);
	if (item) populateProject(item);
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
	if (galleryPublishButton.disabled) return;
	if (!galleryForm.reportValidity()) return;
	const files = [...(galleryFile.files || [])];
	const thumbnail = galleryThumbnailFile.files?.[0];
	const sourceUrl = gallerySourceUrl.value.trim();
	if (!files.length && !sourceUrl) {
		showNotice("Bitte mindestens ein Bild oder eine Google-Drive-URL angeben.", true);
		galleryFile.focus();
		return;
	}
	if (files.length && sourceUrl) {
		showNotice("Bitte nur eine Quelle auswählen: Bilder oder Google-Drive-URL.", true);
		gallerySourceUrl.focus();
		return;
	}
	if (thumbnail && !files.some((file) => file === thumbnail || (file.name === thumbnail.name && file.size === thumbnail.size && file.type === thumbnail.type))) {
		showNotice("Das Thumbnail muss eines der ausgewählten Bilder sein.", true);
		galleryThumbnailFile.focus();
		return;
	}

	const body = new FormData();
	for (const file of files) body.append("file", file);
	if (thumbnail) body.append("thumbnail_file", thumbnail);
	if (sourceUrl) body.append("source_url", sourceUrl);
	const collection = galleryCollection.value;
	const topic = galleryTopic.value;
	body.append("collection", collection);
	if (collection === "online-projects") body.append("topic", topic);
	if (collection === "gallery") {
		for (const language of LANGUAGES) {
			body.append(`folder_title_${language}`, galleryFolderField(language, "title").value.trim());
			body.append(`folder_subtitle_${language}`, galleryFolderField(language, "subtitle").value.trim());
		}
	}
	if (document.getElementById("galleryFeatured").checked) body.append("featured", "true");

	try {
		galleryPublishButton.disabled = true;
		showNotice(collection === "online-projects" ? "Bild wird hochgeladen und veröffentlicht …" : `${files.length} Bild${files.length === 1 ? "" : "er"} werden als Entwurf hochgeladen …`);
		await api("/api/v1/admin/gallery", { method: "POST", body });
		// A completed upload must not undo a library/tab change made while waiting.
		const currentCollection = galleryCollection.value;
		const currentTopic = galleryTopic.value;
		galleryForm.reset();
		galleryCollection.value = currentCollection;
		galleryTopic.value = currentTopic;
		if (currentCollection === collection && currentTopic === topic && collection === "online-projects") galleryTopicFilter.value = topic;
		updateGalleryDestination();
		await loadGallery();
		showNotice(collection === "online-projects" ? "Bild veröffentlicht. Über „Bibliothek öffnen“ kannst du es im gewählten Thema ansehen." : "Bilder stehen jetzt in Pending. Veröffentliche sie unten gesammelt in den gewählten Ordner.");
	} catch (error) { showNotice(error.message, true); }
	finally { galleryPublishButton.disabled = false; }
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
			await api("/api/v1/admin/gallery/quotes", { method: "POST", body: JSON.stringify({ folderSlug: quoteFolder.value, translations }) });
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
		const response = await api(videoApiPath(editingVideoId), {
			method: editingVideoId ? "PUT" : "POST",
			body: JSON.stringify(payload),
		});
		editingVideoId = response.video.id;
		await loadVideos(editingVideoId);
		showNotice("Video als Entwurf gespeichert.");
	} catch (error) { showNotice(error.message, true); }
});

interviewMaterialForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	if (!interviewMaterialForm.reportValidity()) return;
	try {
		const response = await api(editingInterviewMaterialId ? `/api/v1/admin/interviews/materials/${encodeURIComponent(editingInterviewMaterialId)}` : "/api/v1/admin/interviews/materials", {
			method: editingInterviewMaterialId ? "PUT" : "POST",
			body: JSON.stringify(interviewMaterialPayload()),
		});
		editingInterviewMaterialId = response.material.id;
		await loadInterviewMaterials(editingInterviewMaterialId);
		showNotice("Interview-Material als Entwurf gespeichert.");
	} catch (error) { showNotice(error.message, true); }
});

projectForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	if (!projectForm.reportValidity()) return;
	try {
		const payload = projectPayload();
		const response = await api(editingProjectId ? `/api/v1/admin/projects/${encodeURIComponent(editingProjectId)}` : "/api/v1/admin/projects", {
			method: editingProjectId ? "PUT" : "POST",
			body: JSON.stringify(payload),
		});
		editingProjectId = response.project.id;
		await loadProjects(editingProjectId);
		showNotice("Projekt als Entwurf gespeichert.");
	} catch (error) { showNotice(error.message, true); }
});

projectFile.addEventListener("change", async () => {
	const file = projectFile.files?.[0];
	if (!file) return;
	const body = new FormData();
	body.append("file", file);
	try {
		showNotice("Projektbild wird nach R2 hochgeladen …");
		const response = await api("/api/v1/admin/projects/media", { method: "POST", body });
		document.getElementById("projectImage").value = response.image;
		showNotice("Projektbild hochgeladen. Jetzt Metadaten speichern.");
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
		const response = await api(videoMediaApiPath(), { method: "POST", body });
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
		const response = await api(videoMediaApiPath(), { method: "POST", body });
		document.getElementById("videoPoster").value = response.url;
		setVideoPreview();
		showNotice("Poster hochgeladen. Jetzt Metadaten speichern.");
	} catch (error) { showNotice(error.message, true); }
});

interviewMaterialFile.addEventListener("change", async () => {
	const file = interviewMaterialFile.files?.[0];
	if (!file) return;
	const body = new FormData();
	body.append("file", file);
	try {
		showNotice("Interview-Material wird nach R2 hochgeladen …");
		const response = await api("/api/v1/admin/interviews/materials/media", { method: "POST", body });
		document.getElementById("interviewMaterialSourceType").value = "r2";
		document.getElementById("interviewMaterialSourceUrl").value = response.url;
		document.getElementById("interviewMaterialFileName").value = response.fileName || file.name;
		interviewMaterialFile.dataset.mimeType = response.mimeType || file.type;
		interviewMaterialFile.dataset.sizeBytes = String(response.sizeBytes || file.size);
		showNotice("Material hochgeladen. Jetzt Metadaten speichern oder veröffentlichen.");
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
		const response = await api(videoApiPath(editingVideoId), { method: editingVideoId ? "PUT" : "POST", body: JSON.stringify(payload) });
		editingVideoId = response.video.id;
		await api(`${videoApiPath(editingVideoId)}/publish`, { method: "POST" });
		await loadVideos(editingVideoId);
		showNotice(videoScope === "interviews" ? "Interview veröffentlicht." : "Video veröffentlicht.");
	} catch (error) { showNotice(error.message, true); }
});
document.getElementById("archiveVideo").addEventListener("click", () => { if (editingVideoId) requestDeletion({ kind: videoScope === "interviews" ? "interview-video" : "video", id: editingVideoId }); });
document.getElementById("newInterviewMaterial").addEventListener("click", clearInterviewMaterialForm);
document.getElementById("publishInterviewMaterial").addEventListener("click", async () => {
	try {
		if (!interviewMaterialForm.reportValidity()) return;
		const payload = interviewMaterialPayload();
		const response = await api(editingInterviewMaterialId ? `/api/v1/admin/interviews/materials/${encodeURIComponent(editingInterviewMaterialId)}` : "/api/v1/admin/interviews/materials", { method: editingInterviewMaterialId ? "PUT" : "POST", body: JSON.stringify(payload) });
		editingInterviewMaterialId = response.material.id;
		await api(`/api/v1/admin/interviews/materials/${encodeURIComponent(editingInterviewMaterialId)}/publish`, { method: "POST" });
		await loadInterviewMaterials(editingInterviewMaterialId);
		showNotice("Interview-Material veröffentlicht.");
	} catch (error) { showNotice(error.message, true); }
});
document.getElementById("archiveInterviewMaterial").addEventListener("click", () => { if (editingInterviewMaterialId) requestDeletion({ kind: "interview-material", id: editingInterviewMaterialId }); });
document.getElementById("reloadInterviewContent").addEventListener("click", () => Promise.all([loadVideos(), loadInterviewMaterials()]).catch((error) => showNotice(error.message, true)));
document.querySelectorAll("[data-interview-content-tab]").forEach((tab) => tab.addEventListener("click", () => {
	const selected = tab.dataset.interviewContentTab;
	document.querySelectorAll("[data-interview-content-tab]").forEach((item) => {
		const active = item === tab;
		item.classList.toggle("is-active", active);
		item.setAttribute("aria-selected", String(active));
	});
	document.querySelectorAll("[data-interview-content-pane]").forEach((pane) => {
		pane.hidden = pane.dataset.interviewContentPane !== selected;
	});
}));
document.getElementById("newProject").addEventListener("click", clearProjectForm);
document.getElementById("reloadProjects").addEventListener("click", () => loadProjects().catch((error) => showNotice(error.message, true)));
document.getElementById("publishProject").addEventListener("click", async () => {
	try {
		if (!projectForm.reportValidity()) return;
		const payload = projectPayload();
		const response = await api(editingProjectId ? `/api/v1/admin/projects/${encodeURIComponent(editingProjectId)}` : "/api/v1/admin/projects", { method: editingProjectId ? "PUT" : "POST", body: JSON.stringify(payload) });
		editingProjectId = response.project.id;
		await api(`/api/v1/admin/projects/${encodeURIComponent(editingProjectId)}/publish`, { method: "POST" });
		await loadProjects(editingProjectId);
		showNotice("Projekt veröffentlicht. Das Datum steuert seine Current/Past-Ansicht automatisch.");
	} catch (error) { showNotice(error.message, true); }
});
document.getElementById("archiveProject").addEventListener("click", () => { if (editingProjectId) requestDeletion({ kind: "project", id: editingProjectId }); });
adminTabs.forEach((tab) => tab.addEventListener("click", () => setAdminView(tab.dataset.adminTab)));

clearForm();
clearWorldPointForm();
clearPartnerForm();
clearVideoForm();
clearInterviewMaterialForm();
clearProjectForm();
setAdminView("news");
loadNews().catch((error) => showNotice(error.message, true));
loadGallery().catch((error) => showNotice(error.message, true));
loadWorldPoints().catch((error) => showNotice(error.message, true));
loadPartners().catch((error) => showNotice(error.message, true));
loadProjects().catch((error) => showNotice(error.message, true));
