const LANGUAGES = ["ru", "en", "de"];
const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
let localAdminToken = sessionStorage.getItem("mirokitNewsAdminToken") || "";
let newsItems = [];
let editingId = null;

const form = document.getElementById("newsForm");
const notice = document.getElementById("notice");
const newsList = document.getElementById("newsList");
const formHeading = document.getElementById("formHeading");
const currentStatus = document.getElementById("currentStatus");
const imageFile = document.getElementById("imageFile");

function showNotice(message, error = false) {
	notice.textContent = message;
	notice.classList.toggle("error", error);
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

function escapeHtml(value) {
	return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function field(language, name) {
	return form.querySelector(`[data-language="${language}"][data-field="${name}"]`);
}

function setFormValue(id, value = "") {
	document.getElementById(id).value = value;
}

function clearForm() {
	editingId = null;
	form.reset();
	setFormValue("accent", "blue");
	setFormValue("category", "event");
	formHeading.textContent = "Neue Meldung";
	currentStatus.textContent = "Entwurf";
	document.getElementById("archiveNews").hidden = true;
	showNotice("");
}

function populateForm(item) {
	editingId = item.id;
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
	const path = editingId ? `/news-admin/api/news/${encodeURIComponent(editingId)}` : "/news-admin/api/news";
	const response = await api(path, { method, body: JSON.stringify(payload) });
	editingId = response.news.id;
	await loadNews(editingId);
	return response.news;
}

async function loadNews(selectId = editingId) {
	const response = await api("/news-admin/api/news");
	newsItems = response.news || [];
	renderList();
	const selected = newsItems.find((item) => item.id === selectId);
	if (selected) populateForm(selected);
}

function renderList() {
	if (!newsItems.length) {
		newsList.innerHTML = '<p class="muted">Noch keine News vorhanden.</p>';
		return;
	}
	newsList.innerHTML = newsItems.map((item) => `<button class="news-item${item.id === editingId ? " active" : ""}" type="button" data-news-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.translations?.de?.title || item.id)}</strong><span>${escapeHtml(item.status)} · ${escapeHtml(item.publishedAt)}</span></button>`).join("");
}

newsList.addEventListener("click", (event) => {
	const button = event.target.closest("[data-news-id]");
	const item = newsItems.find((candidate) => candidate.id === button?.dataset.newsId);
	if (item) { populateForm(item); renderList(); }
});

form.addEventListener("submit", async (event) => {
	event.preventDefault();
	if (!form.reportValidity()) return;
	try { await saveNews(); showNotice("Entwurf gespeichert."); } catch (error) { showNotice(error.message, true); }
});

document.getElementById("newNews").addEventListener("click", clearForm);
document.getElementById("reloadNews").addEventListener("click", () => loadNews().catch((error) => showNotice(error.message, true)));
document.getElementById("publishNews").addEventListener("click", async () => {
	try {
		const item = await saveNews();
		await api(`/news-admin/api/news/${encodeURIComponent(item.id)}/publish`, { method: "POST" });
		await loadNews(item.id);
		showNotice("News veröffentlicht.");
	} catch (error) { showNotice(error.message, true); }
});
document.getElementById("archiveNews").addEventListener("click", async () => {
	if (!editingId || !window.confirm("Diese News archivieren?")) return;
	try { await api(`/news-admin/api/news/${encodeURIComponent(editingId)}`, { method: "DELETE" }); await loadNews(); clearForm(); showNotice("News archiviert."); } catch (error) { showNotice(error.message, true); }
});

imageFile.addEventListener("change", async () => {
	const file = imageFile.files?.[0];
	if (!file) return;
	const body = new FormData();
	body.append("file", file);
	try {
		showNotice("Bild wird hochgeladen …");
		const response = await api("/news-admin/api/media", { method: "POST", body });
		setFormValue("image", response.image);
		showNotice("Bild hochgeladen. Jetzt speichern oder veröffentlichen.");
	} catch (error) { showNotice(error.message, true); }
});

clearForm();
loadNews().catch((error) => showNotice(error.message, true));
