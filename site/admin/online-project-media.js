import { ONLINE_PROJECT_TOPICS } from "../source/scripts/online-project-topics.js";

const byId = (id) => document.getElementById(id);
const languages = ["ru", "en", "de"];
const API = "/api/v1/admin/online-projects/media";

async function pdfThumbnail(file) {
  const pdfjs = await import("../public/vendor/pdfjs/pdf.min.mjs");
  const base = new URL("../public/vendor/pdfjs/", import.meta.url).href;
  pdfjs.GlobalWorkerOptions.workerSrc = `${base}pdf.worker.min.mjs`;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, cMapUrl: `${base}cmaps/`, cMapPacked: true, standardFontDataUrl: `${base}standard_fonts/`, wasmUrl: `${base}wasm/` });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const original = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(800 / original.width, 1600 / original.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport, background: "white" }).promise;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", .85));
    if (!blob) throw new Error("Die PDF-Vorschau konnte nicht erzeugt werden.");
    return new File([blob], "erste-seite.webp", { type: "image/webp" });
  } finally { await task.destroy(); }
}

class OnlineProjectMediaAdmin {
  constructor(services, markError, onDelete) {
    this.s = services;
    this.markError = markError;
    this.onDelete = onDelete;
    this.form = byId("onlineMediaForm");
    this.kind = "photos";
    this.items = [];
    this.id = "";
    this.status = "draft";
    this.urls = [];
    this.previewVersion = 0;
    this.busy = false;
    this.enabled = false;
  }
  bind() {
    for (const topic of ONLINE_PROJECT_TOPICS) {
      byId("onlineMediaTopic").add(new Option(topic.label, topic.id));
      byId("onlineMediaTopicFilter").add(new Option(topic.label, topic.id));
    }
    byId("onlineAdminMediaNav").addEventListener("click", (event) => {
      const button = event.target.closest("[data-online-media]");
      if (button && !this.busy) this.selectKind(button.dataset.onlineMedia);
    });
    byId("onlineMediaFile").addEventListener("change", () => this.previewFile());
    byId("onlineMediaTopic").addEventListener("change", () => this.updateLibraryLink());
    byId("onlineMediaPosterFile").addEventListener("change", () => this.previewPoster());
    byId("newOnlineMedia").addEventListener("click", () => { this.clear(); byId("onlineMediaTopic").focus(); });
    byId("reloadOnlineMedia").addEventListener("click", () => this.load().catch((error) => this.s.showNotice(error.message, true)));
    for (const id of ["onlineMediaTopicFilter", "onlineMediaStatusFilter"]) byId(id).addEventListener("change", () => this.renderList());
    byId("archiveOnlineMedia").addEventListener("click", () => {
      if (this.id && !this.busy) this.onDelete({ kind: "online-media", id: this.id });
    });
    byId("onlineMediaList").addEventListener("click", (event) => {
      const button = event.target.closest("[data-online-edit]");
      const item = this.items.find((entry) => entry.id === button?.dataset.onlineEdit);
      if (item && !this.busy) this.populate(item);
    });
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.save(event.submitter?.id === "publishOnlineMedia" ? "published" : "draft");
    });
  }
  setEnabled(enabled) {
    this.enabled = enabled;
    byId("onlineAdminMediaNav").hidden = !enabled;
    this.applyVisibility();
    if (enabled && this.kind !== "photos") this.load().catch((error) => this.s.showNotice(error.message, true));
  }
  selectKind(kind) {
    if (this.kind !== kind) { this.kind = kind; this.clear(); }
    this.applyVisibility();
    if (kind !== "photos") this.load().catch((error) => this.s.showNotice(error.message, true));
  }
  applyVisibility() {
    const resources = this.enabled && this.kind !== "photos";
    byId("onlineProjectResources").hidden = !resources;
    byId("galleryForm").hidden = resources;
    byId("galleryList").hidden = resources;
    byId("galleryListHeading").hidden = resources;
    byId("onlineProjectListControls").hidden = resources || !this.enabled;
    byId("onlineProjectSteps").hidden = true;
    byId("onlineAdminMediaNav").querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.onlineMedia === this.kind)));
    byId("galleryIntroTitle").textContent = this.enabled ? "Medien nach Themen verwalten" : "Bilder für die öffentliche Galerie";
    byId("galleryIntroText").textContent = this.enabled ? "Wähle Fotos, Videos oder Dokumente. Jeder Inhalt gehört zu einem der zehn Themen." : "Bilder auswählen, Ordner benennen und als Entwurf hochladen. Anschließend den Ordner unten prüfen und veröffentlichen.";
    byId("onlineMediaHeading").textContent = this.kind === "document" ? "PDF-Dokumente verwalten" : "Videos verwalten";
    byId("newOnlineMedia").textContent = this.kind === "document" ? "Neues Dokument" : "Neues Video";
    byId("onlineMediaFileHelp").textContent = this.kind === "document" ? "PDF · maximal 20 MB. Die erste Seite wird automatisch als Vorschau erzeugt. Die Dateiauswahl lädt noch nichts hoch." : "MP4, WebM oder OGV · maximal 95 MB. Die Dateiauswahl lädt noch nichts hoch.";
    byId("onlineMediaFile").accept = this.kind === "document" ? "application/pdf,.pdf" : "video/mp4,video/webm,video/ogg";
    byId("onlineMediaPosterLabel").hidden = this.kind !== "video";
    byId("onlineMediaPosterFile").disabled = this.kind !== "video" || Boolean(this.id);
    this.form.querySelectorAll("[data-online-transcript]").forEach((label) => { label.hidden = this.kind !== "video"; label.querySelector("textarea").disabled = this.kind !== "video"; });
    byId("onlineMediaTranscriptHelp").hidden = this.kind !== "video";
    byId("onlineMediaLanguagesHelp").textContent = this.kind === "document" ? "Ein Titel pro Sprache ist Pflicht. Eine Beschreibung ist optional." : "Ein Titel pro Sprache ist Pflicht. Beschreibung und Videotext sind optional.";
    this.renderList();
  }
  releasePreview() {
    this.previewVersion++;
    this.urls.forEach((url) => URL.revokeObjectURL(url));
    this.urls = [];
    byId("onlineMediaPreviewVideo").pause();
    for (const id of ["onlineMediaPreviewVideo", "onlineMediaPreviewImage"]) {
      const element = byId(id);
      this.s.setMediaPreview(element, "src", "");
      element.hidden = true;
    }
    this.s.setMediaPreview(byId("onlineMediaPreviewVideo"), "poster", "");
    byId("onlineMediaPreview").hidden = true;
  }
  previewUrl(file) { const url = URL.createObjectURL(file); this.urls.push(url); return url; }
  setBusy(value) {
    this.busy = value;
    this.form.setAttribute("aria-busy", String(value));
    for (const id of ["saveOnlineMedia", "publishOnlineMedia", "newOnlineMedia"]) byId(id).disabled = value;
    byId("archiveOnlineMedia").disabled = value || !this.id || this.status === "archived";
    byId("onlineAdminMediaNav").querySelectorAll("button").forEach((button) => button.disabled = value);
  }
  async previewFile() {
    byId("onlineMediaFile").setCustomValidity("");
    this.releasePreview();
    this.setBusy(false);
    this.thumbnail = null;
    const version = this.previewVersion;
    const file = byId("onlineMediaFile").files[0];
    byId("onlineMediaFileName").textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : "";
    if (!file) { this.setBusy(false); return; }
    const limit = this.kind === "document" ? 20 : 95;
    const validType = this.kind === "document" ? file.type === "application/pdf" || (!file.type && /\.pdf$/i.test(file.name)) : ["video/mp4", "video/webm", "video/ogg"].includes(file.type);
    if (!validType || !file.size || file.size > limit * 1024 * 1024) {
      const message = `Bitte ${this.kind === "document" ? "eine PDF-Datei" : "MP4, WebM oder OGV"} mit maximal ${limit} MB auswählen.`;
      byId("onlineMediaFile").setCustomValidity(message);
      this.markError(byId("onlineMediaFile"), message);
      return;
    }
    if (this.kind === "video") {
      const video = byId("onlineMediaPreviewVideo");
      video.src = this.previewUrl(file); video.hidden = false;
      byId("onlineMediaPreview").hidden = false;
      byId("onlineMediaPreviewCaption").textContent = "Video vor dem Speichern prüfen";
      this.previewPoster();
      return;
    }
    this.setBusy(true);
    byId("onlineMediaFileName").textContent = `${file.name} · PDF-Vorschau wird erstellt …`;
    try {
      const thumbnail = await pdfThumbnail(file);
      if (version !== this.previewVersion) return;
      this.thumbnail = thumbnail;
      const image = byId("onlineMediaPreviewImage");
      image.src = this.previewUrl(thumbnail); image.hidden = false;
      byId("onlineMediaPreview").hidden = false;
      byId("onlineMediaPreviewCaption").textContent = "Erste Seite der PDF · wird als Vorschaubild gespeichert";
      byId("onlineMediaFileName").textContent = `${file.name} · Vorschau bereit`;
    } catch {
      if (version !== this.previewVersion) return;
      this.markError(byId("onlineMediaFile"), "Die PDF-Vorschau konnte nicht erstellt werden. Bitte eine lesbare PDF ohne Passwort auswählen.");
      byId("onlineMediaFile").setCustomValidity("Bitte eine lesbare PDF ohne Passwort auswählen.");
      byId("onlineMediaFileName").textContent = "PDF-Vorschau nicht verfügbar.";
    } finally { if (version === this.previewVersion) this.setBusy(false); }
  }
  previewPoster() {
    if (this.kind !== "video") return;
    byId("onlineMediaPosterFile").setCustomValidity("");
    const file = byId("onlineMediaPosterFile").files[0];
    this.thumbnail = file || null;
    if (file && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024)) {
      byId("onlineMediaPosterFile").setCustomValidity("Bitte JPG, PNG oder WebP mit maximal 2 MB auswählen.");
      this.markError(byId("onlineMediaPosterFile"), "Bitte JPG, PNG oder WebP mit maximal 2 MB auswählen.");
      return;
    }
    const video = byId("onlineMediaPreviewVideo");
    video.removeAttribute("poster");
    if (file) video.poster = this.previewUrl(file);
  }
  clear() {
    this.releasePreview();
    this.form.reset();
    byId("onlineMediaFile").setCustomValidity("");
    byId("onlineMediaPosterFile").setCustomValidity("");
    this.id = ""; this.status = "draft"; this.thumbnail = null;
    byId("onlineMediaFile").disabled = false;
    byId("onlineMediaFile").required = true;
    byId("onlineMediaFileName").textContent = "";
    byId("onlineMediaStatus").textContent = "Neuer Inhalt";
    this.form.querySelectorAll(".language-details").forEach((group, index) => group.open = index === 0);
    this.updatePublishHelp();
    this.updateLibraryLink();
    this.setBusy(false);
    byId("onlineMediaPosterFile").disabled = this.kind !== "video";
  }
  updatePublishHelp() {
    byId("onlineMediaPublishHelp").textContent = this.status === "published"
      ? "Dieser Inhalt ist öffentlich. „Als Entwurf speichern“ nimmt ihn von der Website. „Veröffentlichen“ speichert Änderungen und hält ihn öffentlich."
      : "Als Entwurf speichern lädt neue Dateien hoch und hält den Inhalt privat. Veröffentlichen macht ihn unmittelbar öffentlich sichtbar. Archivieren nimmt ihn von der Website; die Datei bleibt gespeichert.";
  }
  updateLibraryLink() {
    const url = new URL("/page/onlineProjects/", location.origin);
    url.searchParams.set("media", this.kind === "document" ? "documents" : "videos");
    url.searchParams.set("lang", "de");
    if (byId("onlineMediaTopic").value) url.searchParams.set("topic", byId("onlineMediaTopic").value);
    byId("onlineMediaLibraryLink").href = url.pathname + url.search;
  }
  populate(item) {
    this.clear();
    this.id = item.id; this.status = item.status;
    byId("onlineMediaTopic").value = item.topic;
    byId("onlineMediaFile").disabled = true; byId("onlineMediaFile").required = false;
    byId("onlineMediaPosterFile").disabled = true;
    byId("onlineMediaFileName").textContent = `${item.fileName} · bereits gespeichert. Für eine andere Datei einen neuen Inhalt anlegen.`;
    byId("onlineMediaStatus").textContent = this.s.statusLabel(item.status);
    for (const language of languages) for (const field of ["title", "description", "transcript"]) this.field(language, field).value = item[field]?.[language] || "";
    const element = byId(item.kind === "document" ? "onlineMediaPreviewImage" : "onlineMediaPreviewVideo");
    element.hidden = false;
    this.s.setMediaPreview(element, "src", item.kind === "document" ? item.thumbnail : item.url);
    if (item.kind === "video" && item.thumbnail) this.s.setMediaPreview(element, "poster", item.thumbnail);
    byId("onlineMediaPreview").hidden = false;
    byId("onlineMediaPreviewCaption").textContent = item.kind === "document" ? "Gespeicherte erste PDF-Seite" : "Gespeichertes Video";
    this.updatePublishHelp();
    this.updateLibraryLink();
    this.setBusy(false);
    byId("onlineMediaTopic").focus();
  }
  field(language, field) { return this.form.querySelector(`[data-online-language="${language}"][data-online-field="${field}"]`); }
  async save(status) {
    if (this.busy) return;
    const fields = [...this.form.querySelectorAll("input, select, textarea")].filter((field) => !field.disabled);
    const invalid = fields.filter((field) => !field.checkValidity() || (field.required && field.type !== "file" && !field.value.trim()));
    if (invalid.length) {
      invalid.forEach((field) => this.markError(field, field.validity.customError ? field.validationMessage : "Bitte dieses Pflichtfeld ausfüllen oder die Eingabe korrigieren."));
      invalid[0].focus(); return;
    }
    if (!this.id && this.kind === "document" && !this.thumbnail) { this.markError(byId("onlineMediaFile"), "Bitte die PDF erneut auswählen, damit eine Vorschau erzeugt werden kann."); byId("onlineMediaFile").focus(); return; }
    const translations = Object.fromEntries(languages.map((language) => [language, Object.fromEntries(["title", "description", "transcript"].map((field) => [field, this.field(language, field).value.trim()]))]));
    const topic = byId("onlineMediaTopic").value;
    this.setBusy(true);
    // Lock all editor fields while an upload is in progress to keep its preview and metadata together.
    const enabled = [...this.form.elements].filter((field) => !field.disabled);
    enabled.forEach((field) => field.disabled = true);
    try {
      this.s.showNotice("Inhalt wird gespeichert …");
      if (!this.id) {
        const form = new FormData();
        form.append("kind", this.kind); form.append("topic", topic);
        form.append("translations", JSON.stringify(translations));
        const file = byId("onlineMediaFile").files[0];
        const uploadFile = !file.type && this.kind === "document" ? new File([file], file.name, { type: "application/pdf" }) : file;
        form.append("file", uploadFile);
        if (this.thumbnail) form.append("thumbnail", this.thumbnail);
        const result = await this.s.api(API, { method: "POST", body: form });
        this.id = result.media.id;
      }
      const result = await this.s.api(`${API}/${this.id}`, { method: "PATCH", body: JSON.stringify({ topic, status, translations }) });
      await this.load();
      this.populate(result.media);
      this.s.showNotice(status === "published" ? "Inhalt veröffentlicht. Er ist jetzt in der Online-Projekte-Bibliothek sichtbar." : "Als Entwurf gespeichert. Der Inhalt ist nicht öffentlich sichtbar.");
    } catch (error) { this.s.showNotice(error.message, true); }
    finally {
      enabled.forEach((field) => field.disabled = false);
      byId("onlineMediaFile").disabled = Boolean(this.id);
      byId("onlineMediaFile").required = !this.id;
      byId("onlineMediaPosterFile").disabled = Boolean(this.id) || this.kind !== "video";
      this.setBusy(false);
    }
  }
  async load() {
    byId("onlineMediaList").setAttribute("aria-busy", "true");
    try { const result = await this.s.api(API); this.items = result.media; this.renderList(); }
    finally { byId("onlineMediaList").setAttribute("aria-busy", "false"); }
  }
  renderList() {
    const list = byId("onlineMediaList");
    list.querySelectorAll("img").forEach((image) => this.s.setMediaPreview(image, "src", ""));
    const topic = byId("onlineMediaTopicFilter").value;
    const status = byId("onlineMediaStatusFilter").value;
    const items = this.items.filter((item) => item.kind === this.kind && (topic === "all" || item.topic === topic) && (status === "all" || (status === "active" ? item.status !== "archived" : item.status === status)));
    const escape = (text) => this.s.escapeHtml(text);
    list.innerHTML = items.length ? items.map((item) => `<article class="online-media-list-item">${item.thumbnail ? `<img alt="" loading="lazy" data-media-url="${escape(item.thumbnail)}" />` : '<span class="online-media-placeholder" aria-hidden="true">▶</span>'}<div><strong>${escape(item.title.de || item.title.ru)}</strong><span>${escape(ONLINE_PROJECT_TOPICS.find((entry) => entry.id === item.topic)?.label || "")} · ${escape(this.s.statusLabel(item.status))}</span><span>${escape(item.fileName)}</span></div><button class="button button-small" type="button" data-online-edit="${escape(item.id)}" aria-label="${escape(item.title.de + " bearbeiten")}">Bearbeiten</button></article>`).join("") : '<p class="muted">Keine Inhalte in dieser Auswahl. Oben eine neue Datei und ihre Sprachversionen ergänzen.</p>';
    list.querySelectorAll("img").forEach((image) => this.s.setMediaPreview(image, "src", image.dataset.mediaUrl));
  }
}

export { OnlineProjectMediaAdmin };
