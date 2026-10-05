import { createAdminMediaPreview } from "./media-preview.js";
import { OnlineProjectMediaAdmin } from "./online-project-media.js";
import {
  isOnlineProjectTopic,
  ONLINE_PROJECT_TOPICS,
} from "../source/scripts/online-project-topics.js";

// Associate actionable feedback with the control, including screen-reader text.
function markFieldError(field, message) {
  if (!field) return;
  if (!field.id) field.id = `admin-field-${crypto.randomUUID()}`;
  const id = `${field.id}-error`;
  let error = document.getElementById(id);
  if (!error) {
    error = document.createElement("span");
    error.id = id;
    error.className = "field-error";
    const host = field.closest("label, .field-slug") || field.parentElement;
    host.append(error);
  }
  error.textContent = message;
  field.setAttribute("aria-invalid", "true");
  const descriptions = new Set((field.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
  descriptions.add(id);
  field.setAttribute("aria-describedby", [...descriptions].join(" "));
  for (let ancestor = field.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
  }
}

class AdminConfig {
  static languages = ["ru", "en", "de"];
  static localizedFields = new Set([
    "title",
    "alt",
    "summary",
    "content",
    "description",
    "name",
    "city",
    "country",
  ]);
  static fieldIds = {
    id: [
      "newsId",
      "videoId",
      "worldPointId",
      "partnerId",
      "projectId",
      "interviewMaterialId",
    ],
    sourceUrl: ["videoSourceUrl", "interviewMaterialSourceUrl"],
    sourceType: ["videoSourceType", "interviewMaterialSourceType"],
    poster: ["videoPoster"],
    durationSeconds: ["videoDuration"],
    width: ["videoWidth"],
    height: ["videoHeight"],
    sortOrder: [
      "videoSortOrder",
      "worldSortOrder",
      "partnerSortOrder",
      "interviewMaterialSortOrder",
    ],
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
  static get isLocal() {
    return ["localhost", "127.0.0.1"].includes(window.location.hostname);
  }
}

class AdminNotice {
  constructor(element) {
    this.element = element;
  }
  show(message, error = false, type = "") {
    if (!message) {
      this.element.replaceChildren();
      return;
    }
    const kind = error
      ? "error"
      : type || (String(message).includes("…") ? "info" : "success");
    const toast = document.createElement("div");
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
    const dismiss = () => toast.remove();
    close.addEventListener("click", dismiss);
    toast.append(icon, text, close);
    // Keep feedback readable until the next action or explicit dismissal.
    this.element.replaceChildren(toast);
    if (error) this.focusErrorField(message);
  }
  focusErrorField(message) {
    const text = String(message || "");
    const localizedMatch = text.match(
      /\b(title|alt|summary|content|description|name|city|country)\.(ru|en|de)\b/i,
    );
    let field = null;
    if (
      localizedMatch &&
      AdminConfig.localizedFields.has(localizedMatch[1].toLowerCase())
    ) {
      const name = localizedMatch[1].toLowerCase();
      const language = localizedMatch[2].toLowerCase();
      const selector =
        `[data-language="${language}"][data-field="${name}"], [data-video-language="${language}"][data-video-field="${name}"], [data-world-language="${language}"][data-world-field="${name}"], [data-partner-language="${language}"][data-partner-field="${name}"], [data-project-language="${language}"][data-project-field="${name}"], [data-interview-material-language="${language}"][data-interview-material-field="${name}"]`;
      field = this.visibleField([...document.querySelectorAll(selector)]);
    }
    if (!field) {
      const languageMatch = text.match(
        /\b(?:translation|translations)\s+for\s+(ru|en|de)\b/i,
      );
      if (languageMatch) {
        const language = languageMatch[1].toLowerCase();
        field = this.visibleField([
          ...document.querySelectorAll(
            `[data-language="${language}"], [data-video-language="${language}"], [data-world-language="${language}"], [data-partner-language="${language}"], [data-project-language="${language}"], [data-interview-material-language="${language}"]`,
          ),
        ]);
      }
    }
    if (!field) {
      const fieldMatch = text.match(
        /\b(sourceUrl|sourceType|poster|durationSeconds|width|height|sortOrder|image|category|website|linkUrl|latitude|longitude|pointStatus|flag|id)\b/i,
      );
      const ids = fieldMatch
        ? AdminConfig.fieldIds[fieldMatch[1]] ||
        AdminConfig.fieldIds[fieldMatch[1].toLowerCase()]
        : [];
      field = this.visibleField(
        (ids || []).map((id) => document.getElementById(id)).filter(Boolean),
      );
    }
    if (!field) return;
    markFieldError(field, message);
    field.focus({ preventScroll: false });
  }
  visibleField(fields) {
    return fields.find((field) => !field.closest("[hidden]")) || fields[0] ||
      null;
  }
}

class AdminServices {
  constructor() {
    this.notice = new AdminNotice(document.getElementById("notice"));
    this.localToken = sessionStorage.getItem("mirokitAdminToken") || "";
    const preview = createAdminMediaPreview({
      origin: window.location.origin,
      isLocal: AdminConfig.isLocal,
      getLocalToken: this.getLocalToken.bind(this),
      showNotice: this.showNotice.bind(this),
    });
    this.setMediaPreview = preview.setMediaPreview;
    this.fetchAdminMedia = preview.fetchAdminMedia;
  }
  showNotice(message, error = false, type = "") {
    this.notice.show(message, error, type);
  }
  getLocalToken() {
    if (!AdminConfig.isLocal || this.localToken) return this.localToken;
    this.localToken =
      window.prompt("Lokales Admin-Token eingeben:")?.trim() || "";
    if (this.localToken) {
      sessionStorage.setItem("mirokitAdminToken", this.localToken);
    }
    return this.localToken;
  }
  async api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    if (AdminConfig.isLocal) {
      const token = this.getLocalToken();
      if (token) headers.set("X-MiroKIT-Admin-Token", token);
    }
    if (options.body && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(path, {
      ...options,
      headers,
      credentials: "same-origin",
    });
    let body = {};
    try {
      body = await response.json();
    } catch { /* keep generic error */ }
    if (!response.ok) {
      throw new Error(body.message || `Server returned ${response.status}`);
    }
    return body;
  }
  escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  }
  field(form, language, name, prefix = "data") {
    return form.querySelector(
      `[${prefix}-language="${language}"][${prefix}-field="${name}"]`,
    );
  }
  setValue(id, value = "") {
    document.getElementById(id).value = value;
  }
  statusLabel(status) {
    return status === "published"
      ? "Veröffentlicht"
      : status === "archived"
        ? "Archiviert"
        : "Entwurf";
  }
  clearFieldError(event) {
    const field = event.target instanceof HTMLElement
      ? event.target.closest("input, select, textarea")
      : null;
    if (!field) return;
    field.removeAttribute("aria-invalid");
    field.closest("label, fieldset")?.classList.remove("has-error");
    const id = `${field.id}-error`;
    document.getElementById(id)?.remove();
    const descriptions = (field.getAttribute("aria-describedby") || "").split(/\s+/).filter((value) => value && value !== id);
    if (descriptions.length) field.setAttribute("aria-describedby", descriptions.join(" "));
    else field.removeAttribute("aria-describedby");
  }
}

class NewsAdmin {
  constructor(services, onDelete) {
    this.s = services;
    this.onDelete = onDelete;
    this.items = [];
    this.editingId = null;
    this.form = document.getElementById("newsForm");
    this.list = document.getElementById("newsList");
    this.imageFile = document.getElementById("imageFile");
    this.idField = document.getElementById("newsId");
    this.formHeading = document.getElementById("formHeading");
    this.currentStatus = document.getElementById("currentStatus");
    this.checkSlugButton = document.getElementById("checkSlug");
    this.slugStatus = document.getElementById("slugStatus");
  }
  bind() {
    this.list.addEventListener("click", (event) => this.handleListClick(event));
    this.form.addEventListener("submit", (event) => this.save(event));
    document.getElementById("newNews").addEventListener(
      "click",
      () => this.clear(),
    );
    this.checkSlugButton.addEventListener(
      "click",
      () => this.checkSlugAvailability(),
    );
    this.idField.addEventListener("input", () => {
      this.slugStatus.textContent = "";
    });
    document.getElementById("reloadNews").addEventListener(
      "click",
      () =>
        this.load().catch((error) => this.s.showNotice(error.message, true)),
    );
    document.getElementById("publishNews").addEventListener(
      "click",
      () => this.publish(),
    );
    document.getElementById("archiveNews").addEventListener("click", () => {
      if (this.editingId) this.onDelete({ kind: "news", id: this.editingId });
    });
    this.imageFile.addEventListener("change", () => this.uploadImage());
    document.getElementById("image").addEventListener("change", () => this.updateImagePreview());
  }
  field(language, name) {
    return this.s.field(this.form, language, name);
  }
  clear() {
    this.editingId = null;
    this.form.reset();
    this.idField.disabled = false;
    this.checkSlugButton.hidden = false;
    this.slugStatus.textContent = "";
    this.s.setValue("accent", "blue");
    this.s.setValue("category", "event");
    this.formHeading.textContent = "Neue Meldung";
    this.currentStatus.textContent = "Entwurf";
    document.getElementById("archiveNews").hidden = true;
    this.s.showNotice("");
    this.updateImagePreview();
  }
  populate(item) {
    this.form.querySelectorAll("[aria-invalid]").forEach((field) => this.s.clearFieldError({ target: field }));
    this.editingId = item.id;
    this.idField.disabled = true;
    this.checkSlugButton.hidden = true;
    this.slugStatus.textContent = "Bestehender Slug bleibt unverändert.";
    this.s.setValue("newsId", item.id);
    this.s.setValue("publishedAt", item.publishedAt);
    this.s.setValue("category", item.category);
    this.s.setValue("accent", item.accent);
    this.s.setValue("featured", item.featured || "");
    this.s.setValue("image", item.image);
    this.s.setValue("linkUrl", item.linkUrl);
    for (const language of AdminConfig.languages) {
      const translation = item.translations?.[language] || {};
      this.field(language, "alt").value = translation.alt || "";
      this.field(language, "title").value = translation.title || "";
      this.field(language, "summary").value = translation.summary || "";
      this.field(language, "content").value = (translation.content || []).join(
        "\n\n",
      );
    }
    this.formHeading.textContent = item.id;
    this.currentStatus.textContent = this.s.statusLabel(item.status);
    document.getElementById("archiveNews").hidden = item.status === "archived";
    this.updateImagePreview();
  }
  updateImagePreview() {
    const value = document.getElementById("image").value.trim();
    const figure = document.getElementById("newsImagePreview");
    const image = document.getElementById("newsPreviewImage");
    figure.hidden = !value;
    this.s.setMediaPreview(image, "src", value);
  }
  payload() {
    const translations = {};
    for (const language of AdminConfig.languages) {
      translations[language] = {
        alt: this.field(language, "alt").value.trim(),
        title: this.field(language, "title").value.trim(),
        summary: this.field(language, "summary").value.trim(),
        content: this.field(language, "content").value.split(/\n\s*\n|\n/).map((
          value,
        ) => value.trim()).filter(Boolean),
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
  async save(event) {
    event.preventDefault();
    if (!this.form.reportValidity()) return;
    try {
      await this.saveDraft();
      this.s.showNotice("Entwurf gespeichert.");
    } catch (error) {
      this.s.showNotice(error.message, true);
    }
  }
  async saveDraft() {
    const method = this.editingId ? "PUT" : "POST";
    const path = this.editingId
      ? `/api/v1/admin/news/${encodeURIComponent(this.editingId)}`
      : "/api/v1/admin/news";
    const response = await this.s.api(path, {
      method,
      body: JSON.stringify(this.payload()),
    });
    this.editingId = response.news.id;
    await this.load(this.editingId);
    return response.news;
  }
  async publish() {
    try {
      if (!this.form.reportValidity()) return;
      const item = await this.saveDraft();
      await this.s.api(
        `/api/v1/admin/news/${encodeURIComponent(item.id)}/publish`,
        { method: "POST" },
      );
      await this.load(item.id);
      this.s.showNotice("Meldung veröffentlicht.");
    } catch (error) {
      this.s.showNotice(error.message, true);
    }
  }
  async checkSlugAvailability() {
    const slug = this.idField.value.trim();
    if (!slug) {
      this.slugStatus.textContent = "Slug eingeben.";
      return;
    }
    try {
      const response = await this.s.api(
        `/api/v1/admin/news/availability?id=${encodeURIComponent(slug)}`,
      );
      this.slugStatus.textContent = response.available
        ? "✓ Slug ist verfügbar."
        : "✕ Slug ist bereits vergeben.";
    } catch (error) {
      this.slugStatus.textContent = error.message;
    }
  }
  async uploadImage() {
    const file = this.imageFile.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    try {
      this.s.showNotice("Bild wird hochgeladen …");
      const response = await this.s.api("/api/v1/admin/media", {
        method: "POST",
        body,
      });
      this.s.setValue("image", response.image);
      this.updateImagePreview();
      this.s.showNotice(
        "Bild hochgeladen. Jetzt speichern oder veröffentlichen.",
      );
    } catch (error) {
      this.s.showNotice(error.message, true);
    }
  }
  async load(selectId = this.editingId) {
    const response = await this.s.api("/api/v1/admin/news");
    this.items = response.news || [];
    this.render();
    const selected = this.items.find((item) => item.id === selectId);
    if (selected) this.populate(selected);
  }
  render() {
    if (!this.items.length) {
      this.list.innerHTML = '<p class="muted">Noch keine Meldungen vorhanden. Lege oben eine neue Meldung an.</p>';
      return;
    }
    this.list.innerHTML = this.items.map((item) =>
      `<article class="news-item${item.id === this.editingId ? " active" : ""
      }"><button class="news-item-select" type="button" data-news-id="${this.s.escapeHtml(item.id)
      }"><strong>${this.s.escapeHtml(item.translations?.de?.title || item.id)
      }</strong><span>${item.featured
        ? `Hervorgehoben · Rang ${this.s.escapeHtml(item.featured)} · `
        : ""
      }${this.s.escapeHtml(this.s.statusLabel(item.status))} · ${this.s.escapeHtml(item.publishedAt)
      }</span></button>${item.status !== "archived"
        ? `<button class="button button-danger button-remove" type="button" data-news-delete-id="${this.s.escapeHtml(item.id)
        }">Entfernen</button>`
        : ""
      }</article>`
    ).join("");
  }
  handleListClick(event) {
    const deleteButton = event.target.closest("[data-news-delete-id]");
    if (deleteButton) {
      this.onDelete({ kind: "news", id: deleteButton.dataset.newsDeleteId });
      return;
    }
    const button = event.target.closest("[data-news-id]");
    const item = this.items.find((candidate) =>
      candidate.id === button?.dataset.newsId
    );
    if (item) {
      this.populate(item);
      this.render();
    }
  }
}

class GalleryAdmin {
  constructor(services, onDelete) {
    this.s = services;
    this.onDelete = onDelete;
    this.items = [];
    this.quotes = [];
    this.selectedFiles = [];
    this.selectedPreviewUrls = [];
    this.form = document.getElementById("galleryForm");
    this.file = document.getElementById("galleryFile");
    this.dropzone = document.getElementById("galleryDropzone");
    this.selectedFilesList = document.getElementById("gallerySelectedFiles");
    this.sourceUrl = document.getElementById("gallerySourceUrl");
    this.sourceFields = document.getElementById("gallerySourceFields");
    this.folderTranslations = document.getElementById(
      "galleryFolderTranslations",
    );
    this.translationsSection = document.getElementById(
      "galleryTranslationsSection",
    );
    this.thumbnailFile = document.getElementById("galleryThumbnailFile");
    this.folderTarget = document.getElementById("galleryFolderTarget");
    this.folderSlug = document.getElementById("galleryFolderSlug");
    this.folderSlugStatus = document.getElementById("galleryFolderSlugStatus");
    this.list = document.getElementById("galleryList");
    this.collection = document.getElementById("galleryCollection");
    this.topic = document.getElementById("galleryTopic");
    this.topicFilter = document.getElementById("galleryTopicFilter");
    this.publishButton = document.getElementById("galleryPublishButton");
    this.libraryLink = document.getElementById("onlineProjectLibraryLink");
    this.quoteForm = document.getElementById("quoteForm");
    this.quoteFolder = document.getElementById("quoteFolder");
    this.quoteList = document.getElementById("galleryQuoteList");
  }
  bind() {
    for (const topic of ONLINE_PROJECT_TOPICS) {
      this.topic.add(new Option(topic.label, topic.id));
      this.topicFilter.add(new Option(topic.label, topic.id));
    }
    this.topic.addEventListener("change", () => this.updateDestination());
    this.topicFilter.addEventListener("change", () => this.renderList());
    this.collection.addEventListener(
      "change",
      () => this.configureView(this.collection.value === "online-projects"),
    );
    this.folderTarget.addEventListener("change", () => this.syncFolderTarget());
    this.folderSlug.addEventListener(
      "input",
      () => this.updateFolderSlugStatus(),
    );
    this.file.addEventListener("change", () => {
      this.addFiles(this.file.files || []);
      this.file.value = "";
    });
    this.dropzone.addEventListener("dragover", (event) => {
      event.preventDefault();
      this.dropzone.classList.add("is-dragging");
    });
    this.dropzone.addEventListener(
      "dragleave",
      () => this.dropzone.classList.remove("is-dragging"),
    );
    this.dropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      this.dropzone.classList.remove("is-dragging");
      this.addFiles(event.dataTransfer?.files || []);
    });
    this.dropzone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.file.click();
      }
    });
    this.selectedFilesList.addEventListener(
      "click",
      (event) => this.handleSelectedFilesClick(event),
    );
    this.list.addEventListener("click", (event) => this.handleListClick(event));
    this.quoteList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-quote-delete-id]");
      if (button) {
        this.onDelete({ kind: "quote", id: button.dataset.quoteDeleteId });
      }
    });
    this.form.addEventListener("submit", (event) => this.submit(event));
    this.quoteForm.addEventListener(
      "submit",
      (event) => this.submitQuote(event),
    );
    document.getElementById("reloadGallery").addEventListener(
      "click",
      () =>
        this.load().catch((error) => this.s.showNotice(error.message, true)),
    );
  }
  configureView(isOnline) {
    this.collection.value = isOnline ? "online-projects" : "gallery";
    this.topic.required = isOnline;
    this.topic.disabled = !isOnline;
    for (
      const id of [
        "onlineProjectSteps",
        "onlineProjectDestination",
        "onlineProjectListControls",
      ]
    ) document.getElementById(id).hidden = !isOnline;
    document.getElementById("galleryQuotesSection").hidden = isOnline;
    this.sourceFields.hidden = !isOnline;
    this.sourceUrl.disabled = !isOnline;
    this.thumbnailFile.disabled = isOnline;
    this.thumbnailFile.closest(".gallery-thumbnail-field").hidden = isOnline;
    document.getElementById("galleryUploadHeading").textContent = isOnline ? "Bilder auswählen" : "Bilder für den Ordner auswählen";
    document.querySelector("#galleryUploadHeading + p").textContent = isOnline
      ? "Dateien auswählen oder einen öffentlich freigegebenen Google-Drive-Bildlink einfügen."
      : "Mehrere Bilder auswählen. Sie werden zunächst als Entwurf hochgeladen und unten im Ordner geprüft.";
    this.translationsSection.hidden = isOnline;
    document.getElementById("onlinePhotoTranslations").hidden = !isOnline;
    document.querySelectorAll("[data-online-photo-field]").forEach((field) => field.disabled = !isOnline);
    this.folderTranslations.hidden = isOnline;
    this.folderTranslations.querySelectorAll(
      "[data-gallery-folder-field=title]",
    ).forEach((field) => {
      field.required = !isOnline;
    });
    this.folderSlug.required = !isOnline;
    this.folderSlug.disabled = isOnline;
    this.folderTarget.disabled = isOnline;
    this.folderTranslations.querySelectorAll("[data-gallery-folder-field]").forEach((field) => field.disabled = isOnline);
    if (isOnline) this.folderSlug.setCustomValidity("");
    else this.updateFolderSlugStatus();
    this.sourceUrl.required = false;
    document.getElementById("galleryPanelEyebrow").textContent = isOnline
      ? "10 THEMEN · MEDIENBIBLIOTHEK"
      : "MEDIENARCHIV";
    document.getElementById("galleryPanelTitle").textContent = isOnline
      ? "Online-Projekte"
      : "Galerie-Bilder";
    document.getElementById("galleryIntroTitle").textContent = isOnline
      ? "So landet dein Bild im richtigen Thema"
      : "Bilder für die öffentliche Galerie";
    document.getElementById("galleryIntroText").textContent = isOnline
      ? "Hier verwaltest du die Bilder hinter den zehn Online-Projekte-Buttons. Jede Bibliothek sammelt die Arbeiten zu einem Thema."
      : "Bilder auswählen, Ordner benennen und als Entwurf hochladen. Anschließend den Ordner unten prüfen und veröffentlichen.";
    document.getElementById("adminViewGallery").setAttribute(
      "aria-labelledby",
      isOnline ? "onlineProjectsTab" : "galleryTab",
    );
    this.updateDestination();
    this.renderList();
  }
  updateDestination() {
    const topic = ONLINE_PROJECT_TOPICS.find((item) =>
      item.id === this.topic.value
    );
    this.libraryLink.href = `/page/onlineProjects/index.html?lang=de${topic ? `&topic=${topic.id}` : ""
      }`;
    this.publishButton.textContent =
      this.collection.value === "online-projects" && topic
        ? `In „${topic.label}“ veröffentlichen`
        : "Bilder als Entwurf hochladen";
  }
  folderField(language, name) {
    return this.folderTranslations.querySelector(
      `[data-gallery-folder-language="${language}"][data-gallery-folder-field="${name}"]`,
    );
  }
  folderForSlug(slug) {
    return this.items.find((item) =>
      (item.collection || "gallery") === "gallery" && item.folderSlug === slug
    ) || null;
  }
  updateFolderSlugStatus() {
    if (this.collection.value !== "gallery") return;
    const slug = this.folderSlug.value.trim().toLowerCase();
    const valid = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(slug);
    const append = this.folderTarget.value !== "new";
    const used = Boolean(this.folderForSlug(slug));
    this.folderSlug.setCustomValidity(
      !valid
        ? "Der Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten."
        : (append
          ? (used ? "" : "Der ausgewählte Ordner existiert nicht mehr.")
          : (used
            ? "Dieser Slug wird bereits verwendet. Wähle den vorhandenen Ordner zum Ergänzen."
            : "")),
    );
    this.folderSlugStatus.textContent = !slug
      ? "Eine Adresse mit Kleinbuchstaben, Zahlen und Bindestrichen eingeben."
      : !valid
        ? "Slug prüfen: Kleinbuchstaben, Zahlen und Bindestriche verwenden."
        : append
          ? "Vorhandener Ordner: Neue Bilder werden hinten angefügt."
          : used
            ? "Dieser Slug ist bereits vergeben."
            : "Slug ist frei für einen neuen Ordner.";
    // Checking the status must not trigger the form's invalid-event feedback.
    this.folderSlugStatus.className = !slug ? "muted" : `muted ${this.folderSlug.validity.valid ? "is-valid" : "is-invalid"
      }`;
  }
  syncFolderTarget() {
    const append = this.folderTarget.value !== "new";
    const folder = append ? this.folderForSlug(this.folderTarget.value) : null;
    this.folderSlug.readOnly = append;
    if (folder) {
      this.folderSlug.value = folder.folderSlug;
      for (const language of AdminConfig.languages) {
        this.folderField(language, "title").value =
          folder.folderTitleTranslations?.[language] || folder.folderTitle ||
          "";
        this.folderField(language, "subtitle").value =
          folder.folderSubtitleTranslations?.[language] ||
          folder.folderSubtitle || "";
      }
    }
    this.updateFolderSlugStatus();
  }
  renderFolderTarget() {
    const selected = this.folderTarget.value || "new";
    const folders = new Map();
    this.items.filter((item) =>
      (item.collection || "gallery") === "gallery" && item.folderSlug
    ).forEach((item) => {
      const slug = item.folderSlug || "uncategorized";
      if (!folders.has(slug)) {
        folders.set(
          slug,
          item.folderTitleTranslations?.de || item.folderTitle || slug,
        );
      }
    });
    this.folderTarget.innerHTML =
      `<option value="new">Neuen Ordner anlegen</option>${[...folders.entries()].map(([slug, title]) =>
        `<option value="${this.s.escapeHtml(slug)
        }">Bestehenden Ordner ergänzen: ${this.s.escapeHtml(title)} (${this.s.escapeHtml(slug)
        })</option>`
      ).join("")
      }`;
    this.folderTarget.value = folders.has(selected) || selected === "new"
      ? selected
      : "new";
    this.syncFolderTarget();
  }
  renderSelectedFiles() {
    this.selectedPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    this.selectedPreviewUrls = [];
    this.selectedFilesList.replaceChildren();
    if (!this.selectedFiles.length) return;
    this.selectedFiles.forEach((file, index) => {
      const card = document.createElement("article");
      card.className = "gallery-selected-file";
      const image = document.createElement("img");
      const previewUrl = URL.createObjectURL(file);
      this.selectedPreviewUrls.push(previewUrl);
      image.src = previewUrl;
      image.alt = file.name;
      const copy = document.createElement("div");
      copy.innerHTML = `<strong>${this.s.escapeHtml(file.name)}</strong><span>${(file.size / 1024 / 1024).toFixed(2)
        } MB · Bild ${index + 1}</span>`;
      const actions = document.createElement("div");
      actions.className = "gallery-selected-file-actions";
      actions.innerHTML =
        `<button class="button button-small" type="button" aria-label="Ausgewähltes Bild nach oben verschieben" data-gallery-selected-move="up" data-gallery-selected-index="${index}"${index === 0 ? " disabled" : ""
        }>↑</button><button class="button button-small" type="button" aria-label="Ausgewähltes Bild nach unten verschieben" data-gallery-selected-move="down" data-gallery-selected-index="${index}"${index === this.selectedFiles.length - 1 ? " disabled" : ""
        }>↓</button><button class="button button-small button-danger" type="button" data-gallery-selected-remove="${index}">Entfernen</button>`;
      card.append(image, copy, actions);
      this.selectedFilesList.append(card);
    });
  }
  addFiles(files) {
    for (const file of files) {
      if (!file.type.startsWith("image/") || file.size === 0) continue;
      if (
        !this.selectedFiles.some((candidate) =>
          candidate.name === file.name && candidate.size === file.size &&
          candidate.lastModified === file.lastModified
        )
      ) this.selectedFiles.push(file);
    }
    this.renderSelectedFiles();
  }
  clearSelectedFiles() {
    this.selectedFiles = [];
    this.file.value = "";
    this.thumbnailFile.value = "";
    this.renderSelectedFiles();
  }
  handleSelectedFilesClick(event) {
    const remove = event.target.closest("[data-gallery-selected-remove]");
    if (remove) {
      this.selectedFiles.splice(
        Number(remove.dataset.gallerySelectedRemove),
        1,
      );
      this.renderSelectedFiles();
      return;
    }
    const move = event.target.closest("[data-gallery-selected-move]");
    if (!move) return;
    const index = Number(move.dataset.gallerySelectedIndex);
    const target = move.dataset.gallerySelectedMove === "up"
      ? index - 1
      : index + 1;
    if (target < 0 || target >= this.selectedFiles.length) return;
    [this.selectedFiles[index], this.selectedFiles[target]] = [
      this.selectedFiles[target],
      this.selectedFiles[index],
    ];
    this.renderSelectedFiles();
  }
  async load() {
    const response = await this.s.api("/api/v1/admin/gallery");
    this.items = response.gallery || [];
    this.renderFolderTarget();
    this.renderQuoteFolderOptions();
    this.renderList();
    try {
      const quoteResponse = await this.s.api("/api/v1/admin/gallery/quotes");
      this.quotes = quoteResponse.quotes || [];
    } catch (error) {
      this.quotes = [];
      console.info("[MIRoKIT] Gallery quotes are unavailable:", error.message);
    }
    this.renderQuoteList();
  }
  renderQuoteFolderOptions() {
    const selected = this.quoteFolder.value;
    const folders = new Map();
    this.items.filter((item) => (item.collection || "gallery") === "gallery")
      .forEach((item) => {
        const slug = item.folderSlug || "uncategorized";
        if (!folders.has(slug)) {
          folders.set(slug, item.folderTitle || "Gallery");
        }
      });
    this.quoteFolder.innerHTML = '<option value="">Ordner auswählen</option>' +
      [...folders.entries()].map(([slug, title]) =>
        `<option value="${this.s.escapeHtml(slug)}">${this.s.escapeHtml(title)
        }</option>`
      ).join("");
    if (folders.has(selected)) this.quoteFolder.value = selected;
  }
  renderList() {
    this.list.querySelectorAll("img").forEach((element) =>
      this.s.setMediaPreview(element, "src", "")
    );
    const isOnline = this.collection.value === "online-projects";
    const selectedTopic = this.topicFilter.value;
    const visibleItems = this.items.filter((item) =>
      (item.collection || "gallery") === this.collection.value
    ).filter((item) =>
      !isOnline || selectedTopic === "all" ||
      (selectedTopic === "unassigned"
        ? !isOnlineProjectTopic(item.topic)
        : item.topic === selectedTopic)
    );
    if (!visibleItems.length) {
      this.list.innerHTML = `<p class="muted">${isOnline
          ? "In dieser Auswahl gibt es noch keine Bilder. Wähle oben ein Thema und veröffentliche das erste Bild."
          : "Noch keine Galerie-Bilder vorhanden. Wähle oben Bilder und einen Ordner aus."
        }</p>`;
      return;
    }
    if (!isOnline) {
      const folders = new Map();
      visibleItems.forEach((item) => {
        const slug = item.folderSlug || "uncategorized";
        if (!folders.has(slug)) {
          folders.set(slug, {
            slug,
            title: item.folderTitleTranslations ||
            {
              ru: item.folderTitle || "Gallery",
              en: item.folderTitle || "Gallery",
              de: item.folderTitle || "Gallery",
            },
            subtitle: item.folderSubtitleTranslations ||
            {
              ru: item.folderSubtitle || "",
              en: item.folderSubtitle || "",
              de: item.folderSubtitle || "",
            },
            items: [],
          });
        }
        folders.get(slug).items.push(item);
      });
      const pendingFolders = new Map();
      visibleItems.filter((item) => item.status === "pending").forEach(
        (item) => {
          const key = item.folderSlug || "uncategorized";
          if (!pendingFolders.has(key)) pendingFolders.set(key, []);
          pendingFolders.get(key).push(item.key);
        },
      );
      const publishFolders = [...pendingFolders.entries()].map(
        ([slug, keys]) => {
          const folder = folders.get(slug);
          const title = folder?.title?.de || folder?.title?.en ||
            folder?.title?.ru || "Gallery";
          return `<div class="gallery-publish-batch"><div><strong>Entwurf: ${this.s.escapeHtml(title)
            }</strong><span>${keys.length} Bild${keys.length === 1 ? "" : "er"
            } warten auf Veröffentlichung.</span></div><button class="button button-primary button-small" type="button" data-gallery-publish-keys="${this.s.escapeHtml(JSON.stringify(keys))
            }">Ordner veröffentlichen</button></div>`;
        },
      ).join("");
      const folderPackages = [...folders.values()].map((folder) => {
        const thumbnail = folder.items.find((item) => item.folderThumbnail) ||
          folder.items[0];
        const folderKeys = JSON.stringify(folder.items.map((item) => item.key));
        const folderEditor =
          `<details class="gallery-folder-editor"><summary>Ordner bearbeiten</summary><div class="gallery-folder-edit-grid">${AdminConfig.languages.map((language) =>
            `<label>${language.toUpperCase()} Überschrift<input data-gallery-folder-edit-field="title" data-gallery-folder-edit-language="${language}" value="${this.s.escapeHtml(folder.title?.[language] || "")
            }" maxlength="120" /></label><label>${language.toUpperCase()} Titel<input data-gallery-folder-edit-field="subtitle" data-gallery-folder-edit-language="${language}" value="${this.s.escapeHtml(folder.subtitle?.[language] || "")
            }" maxlength="500" /></label>`
          ).join("")
          }<button class="button button-primary button-small" type="button" data-gallery-save-folder-keys="${this.s.escapeHtml(folderKeys)
          }">Ordner speichern</button></div></details>`;
        const items = folder.items.map((item) => {
          const alt = item.alt?.de || item.alt?.en || item.alt?.ru || "";
          return `<article class="gallery-admin-item" data-gallery-item-card="${this.s.escapeHtml(item.key)
            }"><img loading="lazy" data-media-url="${this.s.escapeHtml(item.image)
            }" alt="${this.s.escapeHtml(alt)
            }" /><div class="gallery-admin-copy"><strong>${this.s.escapeHtml(item.fileName || "Bild")
            }</strong><span class="gallery-image-order">Position ${item.sortOrder + 1
            } · ${""}${item.featured ? "Hervorgehoben · " : ""
            }${this.s.escapeHtml(this.s.statusLabel(item.status))
            }</span><details class="gallery-item-editor"><summary>Bildoptionen</summary><div class="gallery-item-edit-grid"><label class="feature-toggle"><input type="checkbox" data-gallery-edit-featured ${item.featured ? "checked" : ""
            } /><span>Hervorgehoben</span></label><button class="button button-primary button-small" type="button" data-gallery-save-key="${this.s.escapeHtml(item.key)
            }">Änderungen speichern</button></div></details><div class="gallery-item-actions"><button class="button button-small" type="button" aria-label="Bild nach oben verschieben" data-gallery-move="up" ${item === folder.items[0] ? "disabled" : ""
            }>↑</button><button class="button button-small" type="button" aria-label="Bild nach unten verschieben" data-gallery-move="down" ${item === folder.items[folder.items.length - 1] ? "disabled" : ""
            }>↓</button>${item.folderThumbnail
              ? '<span class="gallery-thumbnail-badge">Ordner-Thumbnail</span>'
              : `<button class="button button-small" type="button" data-gallery-thumbnail-key="${this.s.escapeHtml(item.key)
              }">Als Thumbnail verwenden</button>`
            }<button class="button button-danger button-remove" type="button" data-gallery-delete-key="${this.s.escapeHtml(item.key)
            }">Bild löschen</button></div></div></article>`;
        }).join("");
        const folderTitle = folder.title?.de || folder.title?.en ||
          folder.title?.ru || "Gallery";
        const folderSubtitle = folder.subtitle?.de || folder.subtitle?.en ||
          folder.subtitle?.ru || "";
        return `<details class="gallery-admin-folder"><summary><span class="gallery-folder-preview"><img loading="lazy" data-media-url="${this.s.escapeHtml(thumbnail?.image || "")
          }" alt="" /></span><span><strong>${this.s.escapeHtml(folderTitle)
          }</strong><small>${this.s.escapeHtml(folderSubtitle || "Ordner ohne Kurzbeschreibung")
          }</small><small>${folder.items.length} Bild${folder.items.length === 1 ? "" : "er"
          } · Paket öffnen</small></span></summary>${folderEditor}<div class="gallery-folder-order-actions"><span class="muted">Reihenfolge der Bilder</span><button class="button button-primary button-small" type="button" data-gallery-save-order="${this.s.escapeHtml(folder.slug)
          }">Reihenfolge speichern</button></div><div class="gallery-folder-package">${items}</div></details>`;
      }).join("");
      this.list.innerHTML = publishFolders + folderPackages;
      this.list.querySelectorAll("img[data-media-url]").forEach((element) =>
        this.s.setMediaPreview(element, "src", element.dataset.mediaUrl)
      );
      return;
    }
    const pendingFolders = new Map();
    if (!isOnline) {
      visibleItems.filter((item) => item.status === "pending").forEach(
        (item) => {
          const key = item.folderSlug || "uncategorized";
          if (!pendingFolders.has(key)) {
            pendingFolders.set(key, {
              title: item.folderTitle || "Gallery",
              keys: [],
            });
          }
          pendingFolders.get(key).keys.push(item.key);
        },
      );
    }
    const publishFolders = [...pendingFolders.values()].map((folder) =>
      `<div class="gallery-publish-batch"><div><strong>Entwurf: ${this.s.escapeHtml(folder.title)
      }</strong><span>${folder.keys.length} Bild${folder.keys.length === 1 ? "" : "er"
      } warten auf Veröffentlichung.</span></div><button class="button button-primary button-small" type="button" data-gallery-publish-keys="${this.s.escapeHtml(JSON.stringify(folder.keys))
      }">Ordner veröffentlichen</button></div>`
    ).join("");
    this.list.innerHTML = publishFolders + visibleItems.map((item, index) => {
      const title = item.title?.de || item.title?.en || item.title?.ru ||
        item.key;
      const alt = item.alt?.de || item.alt?.en || item.alt?.ru || "";
      const subtitle = item.subtitle?.de || item.subtitle?.en ||
        item.subtitle?.ru || "";
      const folderTitle = item.folderTitle || "Gallery";
      const topicName = ONLINE_PROJECT_TOPICS.find((topic) =>
        topic.id === item.topic
      )?.label || "Noch ohne Thema";
      const topicEditor = isOnline
        ? `<div class="gallery-topic-edit"><label for="galleryItemTopic${index}">Thema ändern</label><select id="galleryItemTopic${index}" data-gallery-item-topic><option value="">Bitte zuordnen</option>${ONLINE_PROJECT_TOPICS.map((topic) =>
          `<option value="${topic.id}"${topic.id === item.topic ? " selected" : ""
          }>${this.s.escapeHtml(topic.label)}</option>`
        ).join("")
        }</select><button class="button button-small" type="button" data-gallery-topic-key="${this.s.escapeHtml(item.key)
        }">Thema speichern</button></div>`
        : "";
      return `<article class="gallery-admin-item"><img loading="lazy" data-media-url="${this.s.escapeHtml(item.image)
        }" alt="${this.s.escapeHtml(alt)
        }" /><div class="gallery-admin-copy"><strong>${this.s.escapeHtml(title)
        }</strong><span class="gallery-folder-label">${this.s.escapeHtml(folderTitle)
        }</span>${subtitle ? `<span>${this.s.escapeHtml(subtitle)}</span>` : ""
        }<span>${isOnline ? `${this.s.escapeHtml(topicName)} · ` : ""}${item.sourceType === "drive" ? "Google Drive · " : ""
        }${item.featured ? "Hervorgehoben · " : ""}${this.s.escapeHtml(this.s.statusLabel(item.status))
        }</span>${topicEditor}<button class="button button-danger button-remove" type="button" data-gallery-delete-key="${this.s.escapeHtml(item.key)
        }">Bild löschen</button></div></article>`;
    }).join("");
    this.list.querySelectorAll("img[data-media-url]").forEach((element) =>
      this.s.setMediaPreview(element, "src", element.dataset.mediaUrl)
    );
  }
  renderQuoteList() {
    if (!this.quotes.length) {
      this.quoteList.innerHTML =
        '<p class="muted">Noch keine Zitate vorhanden. Wähle einen Ordner und ergänze das Zitat in drei Sprachen.</p>';
      return;
    }
    this.quoteList.innerHTML = this.quotes.map((item) => {
      const quote = item.quote?.de || item.quote?.en || item.quote?.ru || "";
      const byline = item.byline?.de || item.byline?.en || item.byline?.ru ||
        "";
      const folder = this.items.find((galleryItem) =>
        (galleryItem.folderSlug || "uncategorized") === item.folderSlug
      )?.folderTitle || item.folderSlug || "Nicht zugewiesen";
      return `<article class="gallery-quote-admin-item"><div><strong>„${this.s.escapeHtml(quote)
        }“</strong><span class="gallery-folder-label">${this.s.escapeHtml(folder)
        }</span>${byline ? `<span>${this.s.escapeHtml(byline)}</span>` : ""
        }<span>${this.s.escapeHtml(this.s.statusLabel(item.status))
        }</span></div><button class="button button-danger button-remove" type="button" data-quote-delete-id="${this.s.escapeHtml(item.id)
        }">Zitat entfernen</button></article>`;
    }).join("");
  }
  async handleListClick(event) {
    const publishButton = event.target.closest("[data-gallery-publish-keys]");
    if (publishButton) {
      publishButton.disabled = true;
      try {
        const keys = JSON.parse(publishButton.dataset.galleryPublishKeys);
        await this.s.api("/api/v1/admin/gallery/publish", {
          method: "POST",
          body: JSON.stringify({ keys }),
        });
        await this.load();
        this.s.showNotice(
          `${keys.length} Bild${keys.length === 1 ? "" : "er"
          }. Der Ordner ist jetzt öffentlich sichtbar.`,
        );
      } catch (error) {
        this.s.showNotice(error.message, true);
      } finally {
        publishButton.disabled = false;
      }
      return;
    }
    const moveButton = event.target.closest("[data-gallery-move]");
    if (moveButton) {
      const card = moveButton.closest("[data-gallery-item-card]");
      const packageElement = card?.closest(".gallery-folder-package");
      const sibling = moveButton.dataset.galleryMove === "up"
        ? card?.previousElementSibling
        : card?.nextElementSibling;
      if (card && sibling) {
        moveButton.dataset.galleryMove === "up"
          ? packageElement.insertBefore(card, sibling)
          : packageElement.insertBefore(sibling, card);
      }
      return;
    }
    const saveOrder = event.target.closest("[data-gallery-save-order]");
    if (saveOrder) {
      const packageElement = saveOrder.closest(".gallery-admin-folder")
        ?.querySelector(".gallery-folder-package");
      const keys = [
        ...(packageElement?.querySelectorAll("[data-gallery-item-card]") || []),
      ].map((card) => card.dataset.galleryItemCard);
      saveOrder.disabled = true;
      try {
        await this.s.api("/api/v1/admin/gallery/reorder", {
          method: "POST",
          body: JSON.stringify({ keys }),
        });
        await this.load();
        this.s.showNotice("Reihenfolge gespeichert.");
      } catch (error) {
        this.s.showNotice(error.message, true);
      } finally {
        saveOrder.disabled = false;
      }
      return;
    }
    const saveFolder = event.target.closest("[data-gallery-save-folder-keys]");
    if (saveFolder) {
      const editor = saveFolder.closest(".gallery-folder-editor");
      const folderTitle = {};
      const folderSubtitle = {};
      editor.querySelectorAll("[data-gallery-folder-edit-field]").forEach(
        (field) => {
          const target = field.dataset.galleryFolderEditField === "title"
            ? folderTitle
            : folderSubtitle;
          target[field.dataset.galleryFolderEditLanguage] = field.value.trim();
        },
      );
      let keys;
      try {
        keys = JSON.parse(saveFolder.dataset.gallerySaveFolderKeys);
      } catch {
        this.s.showNotice("Der Ordner konnte nicht gelesen werden.", true);
        return;
      }
      saveFolder.disabled = true;
      try {
        await Promise.all(
          keys.map((key) =>
            this.s.api(`/api/v1/admin/gallery/${encodeURIComponent(key)}`, {
              method: "PATCH",
              body: JSON.stringify({ folderTitle, folderSubtitle }),
            })
          ),
        );
        await this.load();
        this.s.showNotice("Ordner-Übersetzungen gespeichert.");
      } catch (error) {
        this.s.showNotice(error.message, true);
      } finally {
        saveFolder.disabled = false;
      }
      return;
    }
    const saveImage = event.target.closest("[data-gallery-save-key]");
    if (saveImage) {
      const card = saveImage.closest("[data-gallery-item-card]");
      saveImage.disabled = true;
      try {
        await this.s.api(
          `/api/v1/admin/gallery/${encodeURIComponent(saveImage.dataset.gallerySaveKey)
          }`,
          {
            method: "PATCH",
            body: JSON.stringify({
              featured: Boolean(
                card.querySelector("[data-gallery-edit-featured]")?.checked,
              ),
            }),
          },
        );
        await this.load();
        this.s.showNotice("Bildoptionen gespeichert.");
      } catch (error) {
        this.s.showNotice(error.message, true);
      } finally {
        saveImage.disabled = false;
      }
      return;
    }
    const thumbnailButton = event.target.closest(
      "[data-gallery-thumbnail-key]",
    );
    if (thumbnailButton) {
      thumbnailButton.disabled = true;
      try {
        await this.s.api(
          `/api/v1/admin/gallery/${encodeURIComponent(thumbnailButton.dataset.galleryThumbnailKey)
          }`,
          { method: "PATCH", body: JSON.stringify({ folderThumbnail: true }) },
        );
        await this.load();
        this.s.showNotice("Ordner-Thumbnail gespeichert.");
      } catch (error) {
        this.s.showNotice(error.message, true);
      } finally {
        thumbnailButton.disabled = false;
      }
      return;
    }
    const saveTopic = event.target.closest("[data-gallery-topic-key]");
    if (saveTopic) {
      const select = saveTopic.closest(".gallery-topic-edit").querySelector(
        "select",
      );
      if (!isOnlineProjectTopic(select.value)) {
        this.s.showNotice("Bitte am Bild ein Thema auswählen.", true);
        select.focus();
        return;
      }
      saveTopic.disabled = true;
      try {
        await this.s.api(
          `/api/v1/admin/gallery/${encodeURIComponent(saveTopic.dataset.galleryTopicKey)
          }`,
          { method: "PATCH", body: JSON.stringify({ topic: select.value }) },
        );
        await this.load();
        this.s.showNotice(
          "Thema gespeichert. Das Bild ist jetzt der gewählten Bibliothek zugeordnet.",
        );
      } catch (error) {
        this.s.showNotice(error.message, true);
      } finally {
        saveTopic.disabled = false;
      }
      return;
    }
    const deleteButton = event.target.closest("[data-gallery-delete-key]");
    if (deleteButton) {
      this.onDelete({
        kind: "gallery",
        key: deleteButton.dataset.galleryDeleteKey,
      });
    }
  }
  async submit(event) {
    event.preventDefault();
    if (this.publishButton.disabled || !this.form.reportValidity()) return;
    const files = [...this.selectedFiles];
    const thumbnail = this.collection.value === "gallery" ? this.thumbnailFile.files?.[0] : null;
    const sourceUrl = this.collection.value === "online-projects" ? this.sourceUrl.value.trim() : "";
    if (!files.length && !sourceUrl) {
      this.s.showNotice(
        "Bitte mindestens ein Bild oder eine Google-Drive-URL angeben.",
        true,
      );
      this.file.focus();
      return;
    }
    if (files.length && sourceUrl) {
      this.s.showNotice(
        "Bitte nur eine Quelle auswählen: Bilder oder Google-Drive-URL.",
        true,
      );
      this.sourceUrl.focus();
      return;
    }
    if (
      thumbnail && !files.some((file) =>
        file === thumbnail ||
        (file.name === thumbnail.name && file.size === thumbnail.size &&
          file.type === thumbnail.type)
      )
    ) {
      this.s.showNotice(
        "Das Thumbnail muss eines der ausgewählten Bilder sein.",
        true,
      );
      this.thumbnailFile.focus();
      return;
    }
    const body = new FormData();
    for (const file of files) body.append("file", file);
    if (thumbnail) body.append("thumbnail_file", thumbnail);
    if (sourceUrl) body.append("source_url", sourceUrl);
    const collection = this.collection.value;
    const topic = this.topic.value;
    body.append("collection", collection);
    if (collection === "online-projects") {
      body.append("topic", topic);
      document.querySelectorAll("[data-online-photo-field]").forEach((field) => body.append(`${field.dataset.onlinePhotoField}_${field.dataset.onlinePhotoLanguage}`, field.value.trim()));
    }
    if (collection === "gallery") {
      body.append(
        "folder_mode",
        this.folderTarget.value === "new" ? "new" : "append",
      );
      body.append("folder_slug", this.folderSlug.value.trim().toLowerCase());
      for (const language of AdminConfig.languages) {
        body.append(
          `folder_title_${language}`,
          this.folderField(language, "title").value.trim(),
        );
        body.append(
          `folder_subtitle_${language}`,
          this.folderField(language, "subtitle").value.trim(),
        );
      }
    }
    if (document.getElementById("galleryFeatured").checked) {
      body.append("featured", "true");
    }
    try {
      this.publishButton.disabled = true;
      this.s.showNotice(
        collection === "online-projects"
          ? "Bild wird hochgeladen und veröffentlicht …"
          : `${files.length} Bild${files.length === 1 ? "" : "er"
          } werden als Entwurf hochgeladen …`,
      );
      await this.s.api("/api/v1/admin/gallery", { method: "POST", body });
      const uploadedFolderSlug = collection === "gallery"
        ? this.folderSlug.value.trim().toLowerCase()
        : "";
      const currentCollection = this.collection.value;
      const currentTopic = this.topic.value;
      this.clearSelectedFiles();
      this.thumbnailFile.value = "";
      this.sourceUrl.value = "";
      document.getElementById("galleryFeatured").checked = false;
      this.collection.value = currentCollection;
      this.topic.value = currentTopic;
      if (
        collection === "gallery" && currentCollection === "gallery" &&
        uploadedFolderSlug
      ) this.folderTarget.value = uploadedFolderSlug;
      if (
        currentCollection === collection && currentTopic === topic &&
        collection === "online-projects"
      ) this.topicFilter.value = topic;
      this.updateDestination();
      await this.load();
      this.s.showNotice(
        collection === "online-projects"
          ? "Bild veröffentlicht. Über „Bibliothek öffnen“ kannst du es im gewählten Thema ansehen."
          : "Bilder als Entwurf hochgeladen. Öffne den Ordner unten, prüfe die Bilder und wähle „Ordner veröffentlichen“.",
      );
    } catch (error) {
      this.s.showNotice(error.message, true);
    } finally {
      this.publishButton.disabled = false;
    }
  }
  quoteField(language, name) {
    return this.s.field(this.quoteForm, language, name, "data-quote");
  }
  async submitQuote(event) {
    event.preventDefault();
    if (!this.quoteForm.reportValidity()) return;
    const translations = {};
    for (const language of AdminConfig.languages) {
      translations[language] = {
        quote: this.quoteField(language, "quote").value.trim(),
        byline: this.quoteField(language, "byline").value.trim(),
      };
    }
    try {
      this.s.showNotice("Zitat wird veröffentlicht …");
      await this.s.api("/api/v1/admin/gallery/quotes", {
        method: "POST",
        body: JSON.stringify({
          folderSlug: this.quoteFolder.value,
          translations,
        }),
      });
      this.quoteForm.reset();
      await this.load();
      this.s.showNotice("Zitat veröffentlicht.");
    } catch (error) {
      this.s.showNotice(error.message, true);
    }
  }
}

class WorldPointsAdmin {
  constructor(services, onDelete) {
    this.s = services;
    this.onDelete = onDelete;
    this.items = [];
    this.editingId = null;
    this.form = document.getElementById("worldPointForm");
    this.list = document.getElementById("worldPointsList");
  }
  bind() {
    this.list.addEventListener("click", (event) => this.handleListClick(event));
    this.form.addEventListener("submit", (event) => this.save(event));
    document.getElementById("newWorldPoint").addEventListener(
      "click",
      () => this.clear(),
    );
    document.getElementById("reloadWorldPoints").addEventListener(
      "click",
      () =>
        this.load().catch((error) => this.s.showNotice(error.message, true)),
    );
    document.getElementById("publishWorldPoint").addEventListener(
      "click",
      () => this.publish(),
    );
    document.getElementById("archiveWorldPoint").addEventListener(
      "click",
      () => {
        if (this.editingId) {
          this.onDelete({
            kind: "world",
            id: this.editingId,
          });
        }
      },
    );
  }
  field(language, name) {
    return this.s.field(this.form, language, name, "data-world");
  }
  clear() {
    this.editingId = null;
    this.form.reset();
    document.getElementById("worldPointId").disabled = false;
    document.getElementById("worldPointHeading").textContent =
      "Neuer Standort";
    document.getElementById("worldPointStatus").textContent = "Entwurf";
    document.getElementById("archiveWorldPoint").hidden = true;
    document.getElementById("worldPointKind").value = "planned";
    document.getElementById("worldSortOrder").value = "0";
  }
  populate(item) {
    this.form.querySelectorAll("[aria-invalid]").forEach((field) => this.s.clearFieldError({ target: field }));
    this.editingId = item.id;
    const id = document.getElementById("worldPointId");
    id.value = item.id;
    id.disabled = true;
    document.getElementById("worldLatitude").value = item.latitude;
    document.getElementById("worldLongitude").value = item.longitude;
    document.getElementById("worldPointKind").value = item.pointStatus;
    document.getElementById("worldFlag").value = item.flag || "";
    document.getElementById("worldSortOrder").value = item.sortOrder || 0;
    for (const language of AdminConfig.languages) {
      const translation = item.translations?.[language] || {};
      this.field(language, "city").value = translation.city || "";
      this.field(language, "country").value = translation.country || "";
      this.field(language, "description").value = translation.description || "";
    }
    document.getElementById("worldPointHeading").textContent = item.id;
    document.getElementById("worldPointStatus").textContent = this.s
      .statusLabel(item.status);
    document.getElementById("archiveWorldPoint").hidden =
      item.status === "archived";
    this.render();
  }
  payload() {
    return {
      id: document.getElementById("worldPointId").value.trim(),
      latitude: Number(document.getElementById("worldLatitude").value),
      longitude: Number(document.getElementById("worldLongitude").value),
      pointStatus: document.getElementById("worldPointKind").value,
      flag: document.getElementById("worldFlag").value.trim(),
      sortOrder: Number(document.getElementById("worldSortOrder").value || 0),
      translations: Object.fromEntries(
        AdminConfig.languages.map((
          language,
        ) => [language, {
          city: this.field(language, "city").value.trim(),
          country: this.field(language, "country").value.trim(),
          description: this.field(language, "description").value.trim(),
        }]),
      ),
    };
  }
  async save(event) {
    event.preventDefault();
    if (!this.form.reportValidity()) return;
    try {
      const response = await this.s.api(
        this.editingId
          ? `/api/v1/admin/world-points/${encodeURIComponent(this.editingId)}`
          : "/api/v1/admin/world-points",
        {
          method: this.editingId ? "PUT" : "POST",
          body: JSON.stringify(this.payload()),
        },
      );
      this.editingId = response.point.id;
      await this.load(this.editingId);
      this.s.showNotice("Standort als Entwurf gespeichert.");
    } catch (error) {
      this.s.showNotice(error.message, true);
    }
  }
  async publish() {
    try {
      if (!this.form.reportValidity()) return;
      const response = await this.s.api(
        this.editingId
          ? `/api/v1/admin/world-points/${encodeURIComponent(this.editingId)}`
          : "/api/v1/admin/world-points",
        {
          method: this.editingId ? "PUT" : "POST",
          body: JSON.stringify(this.payload()),
        },
      );
      this.editingId = response.point.id;
      await this.s.api(
        `/api/v1/admin/world-points/${encodeURIComponent(this.editingId)
        }/publish`,
        { method: "POST" },
      );
      await this.load(this.editingId);
      this.s.showNotice("Standort veröffentlicht.");
    } catch (error) {
      this.s.showNotice(error.message, true);
    }
  }
  async load(selectId = this.editingId) {
    const response = await this.s.api("/api/v1/admin/world-points");
    this.items = response.points || [];
    this.render();
    const selected = this.items.find((item) => item.id === selectId);
    if (selected) this.populate(selected);
  }
  render() {
    if (!this.items.length) {
      this.list.innerHTML =
        '<p class="muted">Noch keine Standorte vorhanden. Lege unten einen neuen Standort an.</p>';
      return;
    }
    this.list.innerHTML = this.items.map((item) => {
      const translation = item.translations?.de || item.translations?.en ||
        item.translations?.ru || {};
      return `<article class="news-item${item.id === this.editingId ? " active" : ""
        }"><button class="news-item-select" type="button" data-world-id="${this.s.escapeHtml(item.id)
        }"><strong>${this.s.escapeHtml(translation.city || item.id)
        }</strong><span>${this.s.escapeHtml(translation.country || "")} · ${this.s.escapeHtml(item.pointStatus)
        } · ${this.s.escapeHtml(this.s.statusLabel(item.status))}</span></button>${item.status !== "archived"
          ? `<button class="button button-danger button-remove" type="button" data-world-delete-id="${this.s.escapeHtml(item.id)
          }">Archivieren</button>`
          : ""
        }</article>`;
    }).join("");
  }
  handleListClick(event) {
    const deleteButton = event.target.closest("[data-world-delete-id]");
    if (deleteButton) {
      this.onDelete({ kind: "world", id: deleteButton.dataset.worldDeleteId });
      return;
    }
    const button = event.target.closest("[data-world-id]");
    const item = this.items.find((candidate) =>
      candidate.id === button?.dataset.worldId
    );
    if (item) this.populate(item);
  }
}

class PartnersAdmin {
  constructor(services, onDelete) {
    this.s = services;
    this.onDelete = onDelete;
    this.items = [];
    this.editingId = null;
    this.form = document.getElementById("partnerForm");
    this.list = document.getElementById("partnersList");
    this.file = document.getElementById("partnerFile");
  }
  bind() {
    this.list.addEventListener("click", (event) => this.handleListClick(event));
    this.form.addEventListener("submit", (event) => this.save(event));
    this.file.addEventListener("change", () => this.upload());
    document.getElementById("newPartner").addEventListener(
      "click",
      () => this.clear(),
    );
    document.getElementById("reloadPartners").addEventListener(
      "click",
      () =>
        this.load().catch((error) => this.s.showNotice(error.message, true)),
    );
    document.getElementById("publishPartner").addEventListener(
      "click",
      () => this.publish(),
    );
    document.getElementById("archivePartner").addEventListener("click", () => {
      if (this.editingId) {
        this.onDelete({ kind: "partner", id: this.editingId });
      }
    });
  }
  field(language, name) {
    return this.s.field(this.form, language, name, "data-partner");
  }
  clear() {
    this.editingId = null;
    this.form.reset();
    document.getElementById("partnerId").disabled = false;
    document.getElementById("partnerHeading").textContent = "Neuer Partner";
    document.getElementById("partnerStatus").textContent = "Entwurf";
    document.getElementById("archivePartner").hidden = true;
    document.getElementById("partnerCategory").value = "public";
    document.getElementById("partnerSortOrder").value = "0";
  }
  populate(item) {
    this.form.querySelectorAll("[aria-invalid]").forEach((field) => this.s.clearFieldError({ target: field }));
    this.editingId = item.id;
    const id = document.getElementById("partnerId");
    id.value = item.id;
    id.disabled = true;
    document.getElementById("partnerCategory").value = item.category ||
      "public";
    document.getElementById("partnerWebsite").value = item.website || "";
    document.getElementById("partnerImage").value = item.image || "";
    document.getElementById("partnerFeatured").checked = Boolean(item.featured);
    document.getElementById("partnerSortOrder").value = item.sortOrder || 0;
    for (const language of AdminConfig.languages) {
      const translation = item.translations?.[language] || {};
      this.field(language, "name").value = translation.name || "";
      this.field(language, "alt").value = translation.alt || "";
      this.field(language, "description").value = translation.description || "";
    }
    document.getElementById("partnerHeading").textContent = item.id;
    document.getElementById("partnerStatus").textContent = this.s.statusLabel(
      item.status,
    );
    document.getElementById("archivePartner").hidden =
      item.status === "archived";
    this.render();
  }
  payload() {
    return {
      id: document.getElementById("partnerId").value.trim(),
      category: document.getElementById("partnerCategory").value,
      image: document.getElementById("partnerImage").value.trim(),
      website: document.getElementById("partnerWebsite").value.trim(),
      featured: document.getElementById("partnerFeatured").checked,
      sortOrder: Number(document.getElementById("partnerSortOrder").value || 0),
      translations: Object.fromEntries(
        AdminConfig.languages.map((
          language,
        ) => [language, {
          name: this.field(language, "name").value.trim(),
          alt: this.field(language, "alt").value.trim(),
          description: this.field(language, "description").value.trim(),
        }]),
      ),
    };
  }
  async save(event) {
    event.preventDefault();
    if (!this.form.reportValidity()) return;
    try {
      const response = await this.s.api(
        this.editingId
          ? `/api/v1/admin/partners/${encodeURIComponent(this.editingId)}`
          : "/api/v1/admin/partners",
        {
          method: this.editingId ? "PUT" : "POST",
          body: JSON.stringify(this.payload()),
        },
      );
      this.editingId = response.partner.id;
      await this.load(this.editingId);
      this.s.showNotice("Partner als Entwurf gespeichert.");
    } catch (error) {
      this.s.showNotice(error.message, true);
    }
  }
  async publish() {
    try {
      if (!this.form.reportValidity()) return;
      const response = await this.s.api(
        this.editingId
          ? `/api/v1/admin/partners/${encodeURIComponent(this.editingId)}`
          : "/api/v1/admin/partners",
        {
          method: this.editingId ? "PUT" : "POST",
          body: JSON.stringify(this.payload()),
        },
      );
      this.editingId = response.partner.id;
      await this.s.api(
        `/api/v1/admin/partners/${encodeURIComponent(this.editingId)}/publish`,
        { method: "POST" },
      );
      await this.load(this.editingId);
      this.s.showNotice("Partner veröffentlicht.");
    } catch (error) {
      this.s.showNotice(error.message, true);
    }
  }
  async upload() {
    const file = this.file.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    try {
      this.s.showNotice("Partner-Logo wird hochgeladen …");
      const response = await this.s.api("/api/v1/admin/partners/media", {
        method: "POST",
        body,
      });
      this.s.setValue("partnerImage", response.image);
      this.s.showNotice(
        "Logo hochgeladen. Jetzt speichern oder veröffentlichen.",
      );
    } catch (error) {
      this.s.showNotice(error.message, true);
    }
  }
  async load(selectId = this.editingId) {
    const response = await this.s.api("/api/v1/admin/partners");
    this.items = response.partners || [];
    this.render();
    const selected = this.items.find((item) => item.id === selectId);
    if (selected) this.populate(selected);
  }
  render() {
    if (!this.items.length) {
      this.list.innerHTML =
        '<p class="muted">Noch keine Partners vorhanden.</p>';
      return;
    }
    this.list.innerHTML = this.items.map((item) => {
      const translation = item.translations?.de || item.translations?.en ||
        item.translations?.ru || {};
      return `<article class="news-item${item.id === this.editingId ? " active" : ""
        }"><button class="news-item-select" type="button" data-partner-id="${this.s.escapeHtml(item.id)
        }"><strong>${this.s.escapeHtml(translation.name || item.id)
        }</strong><span>${this.s.escapeHtml(item.category)} · ${item.featured ? "Hervorgehoben · " : ""
        }${this.s.escapeHtml(this.s.statusLabel(item.status))}</span></button>${item.status !== "archived"
          ? `<button class="button button-danger button-remove" type="button" data-partner-delete-id="${this.s.escapeHtml(item.id)
          }">Archivieren</button>`
          : ""
        }</article>`;
    }).join("");
  }
  handleListClick(event) {
    const deleteButton = event.target.closest("[data-partner-delete-id]");
    if (deleteButton) {
      this.onDelete({
        kind: "partner",
        id: deleteButton.dataset.partnerDeleteId,
      });
      return;
    }
    const button = event.target.closest("[data-partner-id]");
    const item = this.items.find((candidate) =>
      candidate.id === button?.dataset.partnerId
    );
    if (item) this.populate(item);
  }
}

class VideoAdmin {
  constructor(services, onDelete) {
    this.s = services;
    this.onDelete = onDelete;
    this.items = [];
    this.editingId = null;
    this.scope = "general";
    this.subtitleState = [];
    this.activeSubtitleIndex = -1;
    this.cueState = [];
    this.previewVersion = 0;
    this.form = document.getElementById("videoForm");
    this.list = document.getElementById("videosList");
    this.interviewList = document.getElementById("interviewVideosList");
    this.preview = document.getElementById("videoPreview");
    this.subtitleRows = document.getElementById("videoSubtitleRows");
    this.cueEditor = document.getElementById("videoCueEditor");
    this.file = document.getElementById("videoFile");
    this.posterFile = document.getElementById("videoPosterFile");
  }
  bind() {
    this.list.addEventListener("click", (event) => this.handleListClick(event));
    this.interviewList.addEventListener(
      "click",
      (event) => this.handleListClick(event),
    );
    this.form.addEventListener("submit", (event) => this.save(event));
    document.getElementById("newVideo").addEventListener(
      "click",
      () => this.clear(),
    );
    document.getElementById("reloadVideos").addEventListener(
      "click",
      () =>
        this.load().catch((error) => this.s.showNotice(error.message, true)),
    );
    document.getElementById("publishVideo").addEventListener(
      "click",
      () => this.publish(),
    );
    document.getElementById("archiveVideo").addEventListener("click", () => {
      if (this.editingId) {
        this.onDelete({
          kind: this.scope === "interviews" ? "interview-video" : "video",
          id: this.editingId,
        });
      }
    });
    this.file.addEventListener("change", () => this.upload("video"));
    this.posterFile.addEventListener("change", () => this.upload("poster"));
    document.getElementById("videoSourceType").addEventListener(
      "change",
      () => this.setPreview(),
    );
    document.getElementById("videoSourceUrl").addEventListener(
      "input",
      () => this.setPreview(),
    );
    document.getElementById("videoPoster").addEventListener(
      "input",
      () => this.setPreview(),
    );
    this.preview.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(this.preview.duration)) {
        document.getElementById("videoDuration").value = this.preview.duration
          .toFixed(2);
      }
      if (this.preview.videoWidth) {
        document.getElementById("videoWidth").value = this.preview.videoWidth;
      }
      if (this.preview.videoHeight) {
        document.getElementById("videoHeight").value = this.preview.videoHeight;
      }
    });
    document.getElementById("addVideoSubtitle").addEventListener(
      "click",
      () => this.addSubtitle(),
    );
    this.subtitleRows.addEventListener(
      "input",
      (event) => this.handleSubtitleInput(event),
    );
    this.subtitleRows.addEventListener(
      "change",
      (event) => this.handleSubtitleChange(event),
    );
    this.subtitleRows.addEventListener(
      "click",
      (event) => this.handleSubtitleClick(event),
    );
    this.cueEditor.addEventListener("input", () => this.syncCues());
    this.cueEditor.addEventListener(
      "click",
      (event) => this.handleCueClick(event),
    );
  }
  setScope(scope) {
    this.scope = scope;
    this.updateContext();
  }
  updateContext() {
    const interviews = this.scope === "interviews";
    document.getElementById("videoHeading").textContent = interviews
      ? "Neues Interview"
      : "Neues Video";
    document.querySelector("#videoForm .eyebrow").textContent = interviews
      ? "INTERVIEW BEARBEITEN"
      : "VIDEO BEARBEITEN";
    document.querySelector("#videoForm .action-copy strong").textContent =
      interviews ? "Interview fertig?" : "Video fertig?";
    document.querySelector("#videoForm .action-copy span").textContent =
      interviews
        ? "Interview-Entwurf speichern → Angaben prüfen → veröffentlichen."
        : "Entwurf speichern → Angaben prüfen → veröffentlichen.";
  }
  apiPath(id = "") {
    const base = this.scope === "interviews"
      ? "/api/v1/admin/interviews/videos"
      : "/api/v1/admin/videos";
    return id ? `${base}/${encodeURIComponent(id)}` : base;
  }
  mediaApiPath() {
    return this.scope === "interviews"
      ? "/api/v1/admin/interviews/videos/media"
      : "/api/v1/admin/videos/media";
  }
  field(language, name) {
    return this.s.field(this.form, language, name, "data-video");
  }
  clear() {
    this.editingId = null;
    this.form.reset();
    this.subtitleState = [];
    this.activeSubtitleIndex = -1;
    this.cueState = [];
    document.getElementById("videoId").disabled = false;
    document.getElementById("videoHeading").textContent = "Neues Video";
    document.getElementById("videoStatus").textContent = "Entwurf";
    document.getElementById("archiveVideo").hidden = true;
    document.getElementById("videoSourceType").value = "youtube";
    document.getElementById("videoSortOrder").value = "0";
    this.preview.removeAttribute("src");
    this.preview.hidden = true;
    this.cueEditor.hidden = true;
    this.renderSubtitleRows();
    this.updateContext();
  }
  parseTime(value) {
    const parts = String(value || "").trim().split(":").map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return Number(parts[0]) || 0;
  }
  formatTime(value) {
    const total = Math.max(0, Number(value) || 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = (total % 60).toFixed(3).padStart(6, "0");
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")
      }:${seconds}`;
  }
  parseCues(content) {
    const lines = String(content || "").replace(/^\uFEFF/, "").split(/\r?\n/);
    const cues = [];
    for (let index = 0; index < lines.length; index += 1) {
      const timing = lines[index].match(/^(?:[^\s]+\s+)?(\S+)\s+-->\s+(\S+)/);
      if (!timing) continue;
      const text = [];
      for (
        let cursor = index + 1;
        cursor < lines.length && lines[cursor].trim();
        cursor += 1
      ) text.push(lines[cursor]);
      cues.push({
        start: this.parseTime(timing[1]),
        end: this.parseTime(timing[2]),
        text: text.join("\n"),
      });
    }
    return cues;
  }
  serializeCues(cues) {
    return `WEBVTT\n\n${cues.map((cue) =>
      `${this.formatTime(cue.start)} --> ${this.formatTime(Math.max(cue.end, cue.start + 0.1))
      }\n${cue.text || ""}`
    ).join("\n\n")
      }\n`;
  }
  syncSubtitleRows() {
    this.subtitleRows.querySelectorAll("[data-video-subtitle-index]").forEach(
      (row) => {
        const index = Number(row.dataset.videoSubtitleIndex);
        const item = this.subtitleState[index];
        if (!item) return;
        item.language =
          row.querySelector('[data-video-subtitle-field="language"]')?.value ||
          item.language;
        item.label =
          row.querySelector('[data-video-subtitle-field="label"]')?.value
            .trim() || item.label;
        item.srcLang =
          row.querySelector('[data-video-subtitle-field="srcLang"]')?.value
            .trim() || item.language;
        item.content =
          row.querySelector("[data-video-subtitle-content]")?.value ||
          item.content || "";
        item.isDefault = Boolean(
          row.querySelector('[data-video-subtitle-field="default"]')?.checked,
        );
      },
    );
  }
  syncCues() {
    this.cueEditor.querySelectorAll("[data-video-cue-index]").forEach((row) => {
      const index = Number(row.dataset.videoCueIndex);
      if (!this.cueState[index]) return;
      this.cueState[index] = {
        start: this.parseTime(
          row.querySelector('[data-video-cue-field="start"]')?.value,
        ),
        end: this.parseTime(
          row.querySelector('[data-video-cue-field="end"]')?.value,
        ),
        text: row.querySelector('[data-video-cue-field="text"]')?.value || "",
      };
    });
    if (
      this.activeSubtitleIndex >= 0 &&
      this.subtitleState[this.activeSubtitleIndex]
    ) {
      this.subtitleState[this.activeSubtitleIndex].content = this.serializeCues(
        this.cueState,
      );
    }
  }
  renderCueEditor() {
    if (
      this.activeSubtitleIndex < 0 ||
      !this.subtitleState[this.activeSubtitleIndex]
    ) {
      this.cueEditor.hidden = true;
      return;
    }
    this.cueEditor.hidden = false;
    this.cueEditor.innerHTML =
      `<div class="video-cue-editor-head"><strong>Cues bearbeiten · ${this.s.escapeHtml(
        this.subtitleState[this.activeSubtitleIndex].label || "Untertitel",
      )
      }</strong><button class="button button-small" type="button" data-video-add-cue>＋ Cue</button></div>${this.cueState.length
        ? this.cueState.map((cue, index) =>
          `<div class="video-cue-row" data-video-cue-index="${index}"><label><span>Start</span><input data-video-cue-field="start" value="${this.s.escapeHtml(this.formatTime(cue.start))
          }" /></label><button class="button button-small" type="button" data-video-cue-now="start" data-video-cue-index="${index}">aktuell</button><label><span>Ende</span><input data-video-cue-field="end" value="${this.s.escapeHtml(this.formatTime(cue.end))
          }" /></label><button class="button button-small" type="button" data-video-cue-now="end" data-video-cue-index="${index}">aktuell</button><label class="video-cue-text"><span>Text</span><textarea data-video-cue-field="text" rows="2">${this.s.escapeHtml(cue.text)
          }</textarea></label><button class="button button-danger button-small" type="button" data-video-remove-cue="${index}">×</button></div>`
        ).join("")
        : '<p class="muted">Noch keine Cues. Füge einen Cue hinzu oder lade eine WebVTT-Datei hoch.</p>'
      }`;
  }
  renderSubtitleRows() {
    if (!this.subtitleState.length) {
      this.subtitleRows.innerHTML =
        '<p class="muted">Noch keine Untertitel hinzugefügt.</p>';
      this.cueEditor.hidden = true;
      return;
    }
    this.subtitleRows.innerHTML = this.subtitleState.map((item, index) =>
      `<article class="video-subtitle-row" data-video-subtitle-index="${index}"><div class="video-subtitle-row-head"><strong>Spur ${index + 1
      }</strong><button class="button button-small" type="button" data-video-edit-subtitle="${index}">Cues bearbeiten</button><button class="button button-danger button-small" type="button" data-video-remove-subtitle="${index}">Entfernen</button></div><div class="field-grid field-grid-three"><label><span>Sprache</span><select data-video-subtitle-field="language"><option value="ru"${item.language === "ru" ? " selected" : ""
      }>RU</option><option value="en"${item.language === "en" ? " selected" : ""
      }>EN</option><option value="de"${item.language === "de" ? " selected" : ""
      }>DE</option></select></label><label><span>Label</span><input data-video-subtitle-field="label" value="${this.s.escapeHtml(item.label || "")
      }" maxlength="100" /></label><label><span>Sprachcode</span><input data-video-subtitle-field="srcLang" value="${this.s.escapeHtml(item.srcLang || item.language || "")
      }" maxlength="10" /></label></div><label class="file-label"><span>WebVTT-Datei</span><input data-video-subtitle-file type="file" accept=".vtt,text/vtt" /></label><label><span>WebVTT-Inhalt</span><textarea data-video-subtitle-content rows="5" spellcheck="false" placeholder="WEBVTT\n\n00:00:00.000 --> 00:00:03.000\nText">${this.s.escapeHtml(item.content || "")
      }</textarea></label><label class="feature-toggle"><input data-video-subtitle-field="default" type="checkbox"${item.isDefault ? " checked" : ""
      } /><span>Standardspur</span></label></article>`
    ).join("");
  }
  async populate(item) {
    this.editingId = item.id;
    document.getElementById("videoId").value = item.id;
    document.getElementById("videoId").disabled = true;
    document.getElementById("videoSourceType").value = item.sourceType ||
      "external";
    document.getElementById("videoSourceUrl").value = item.sourceUrl || "";
    document.getElementById("videoPoster").value = item.poster || "";
    document.getElementById("videoDuration").value = item.durationSeconds ?? "";
    document.getElementById("videoWidth").value = item.width ?? "";
    document.getElementById("videoHeight").value = item.height ?? "";
    document.getElementById("videoSortOrder").value = item.sortOrder || 0;
    document.getElementById("videoFeatured").checked = Boolean(item.featured);
    for (const language of AdminConfig.languages) {
      const translation = item.translations?.[language] || {};
      this.field(language, "title").value = translation.title || "";
      this.field(language, "alt").value = translation.alt || "";
      this.field(language, "description").value = translation.description || "";
    }
    this.subtitleState = (item.subtitles || []).map((subtitle) => ({
      ...subtitle,
      content: "",
      file: null,
    }));
    this.activeSubtitleIndex = -1;
    document.getElementById("videoHeading").textContent = item.id;
    document.getElementById("videoStatus").textContent = this.s.statusLabel(
      item.status,
    );
    document.getElementById("archiveVideo").hidden = item.status === "archived";
    this.setPreview();
    this.renderSubtitleRows();
    await Promise.all(this.subtitleState.map(async (subtitle, index) => {
      if (!subtitle.src) return;
      try {
        const response = await this.s.fetchAdminMedia(subtitle.src);
        if (response.ok) {
          this.subtitleState[index].content = await response.text();
        }
      } catch {
        /* keep subtitle metadata available even when the file is offline */
      }
    }));
    this.renderSubtitleRows();
  }
  payload() {
    this.syncSubtitleRows();
    this.syncCues();
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
      translations: Object.fromEntries(
        AdminConfig.languages.map((
          language,
        ) => [language, {
          title: this.field(language, "title").value.trim(),
          alt: this.field(language, "alt").value.trim(),
          description: this.field(language, "description").value.trim(),
        }]),
      ),
      subtitles: this.subtitleState.map(({ file, ...subtitle }) => subtitle),
    };
  }
  async setPreview() {
    const version = ++this.previewVersion;
    const sourceType = document.getElementById("videoSourceType").value;
    const source = document.getElementById("videoSourceUrl").value.trim();
    if (sourceType === "youtube" || !source) {
      this.preview.pause();
      this.s.setMediaPreview(this.preview, "src", "");
      this.s.setMediaPreview(this.preview, "poster", "");
      this.preview.hidden = true;
      return;
    }
    await Promise.all([
      this.s.setMediaPreview(this.preview, "src", source),
      this.s.setMediaPreview(
        this.preview,
        "poster",
        document.getElementById("videoPoster").value.trim(),
      ),
    ]);
    if (version !== this.previewVersion) return;
    this.preview.hidden = false;
    this.preview.load();
  }
  async save(event) {
    event.preventDefault();
    if (!this.form.reportValidity()) return;
    try {
      const response = await this.s.api(this.apiPath(this.editingId), {
        method: this.editingId ? "PUT" : "POST",
        body: JSON.stringify(this.payload()),
      });
      this.editingId = response.video.id;
      await this.load(this.editingId);
      this.s.showNotice("Video als Entwurf gespeichert.");
    } catch (error) {
      this.s.showNotice(error.message, true);
    }
  }
  async publish() {
    try {
      if (!this.form.reportValidity()) return;
      const response = await this.s.api(this.apiPath(this.editingId), {
        method: this.editingId ? "PUT" : "POST",
        body: JSON.stringify(this.payload()),
      });
      this.editingId = response.video.id;
      await this.s.api(`${this.apiPath(this.editingId)}/publish`, {
        method: "POST",
      });
      await this.load(this.editingId);
      this.s.showNotice(
        this.scope === "interviews"
          ? "Interview veröffentlicht."
          : "Video veröffentlicht.",
      );
    } catch (error) {
      this.s.showNotice(error.message, true);
    }
  }
  async upload(kind) {
    const file = (kind === "video" ? this.file : this.posterFile).files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    body.append("kind", kind);
    try {
      this.s.showNotice(
        `${kind === "video" ? "Video" : "Vorschaubild"} wird hochgeladen …`,
      );
      const response = await this.s.api(this.mediaApiPath(), {
        method: "POST",
        body,
      });
      if (kind === "video") {
        document.getElementById("videoSourceType").value = "r2";
        document.getElementById("videoSourceUrl").value = response.url;
      } else document.getElementById("videoPoster").value = response.url;
      this.setPreview();
      this.s.showNotice(
        `${kind === "video" ? "Video" : "Vorschaubild"
        } hochgeladen. Jetzt Metadaten speichern.`,
      );
    } catch (error) {
      this.s.showNotice(error.message, true);
    }
  }
  async load(selectId = this.editingId) {
    const response = await this.s.api(this.apiPath());
    this.items = response.videos || [];
    this.render();
    const selected = this.items.find((item) => item.id === selectId);
    if (selected) await this.populate(selected);
  }
  formatDuration(value) {
    if (
      value === null || value === undefined || !Number.isFinite(Number(value))
    ) return "Dauer unbekannt";
    const total = Math.max(0, Math.round(Number(value)));
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")
      }`;
  }
  render() {
    const list = this.scope === "interviews" ? this.interviewList : this.list;
    if (!this.items.length) {
      list.innerHTML = this.scope === "interviews"
        ? '<p class="muted">Noch keine Interview-Videos vorhanden. Lege zuerst ein Gespräch an.</p>'
        : '<p class="muted">Noch keine Videos vorhanden.</p>';
      return;
    }
    list.innerHTML = this.items.map((item) => {
      const translation = item.translations?.de || item.translations?.en ||
        item.translations?.ru || {};
      const deleteAttribute = this.scope === "interviews"
        ? "data-interview-video-delete-id"
        : "data-video-delete-id";
      return `<article class="news-item${item.id === this.editingId ? " active" : ""
        }"><button class="news-item-select" type="button" data-video-id="${this.s.escapeHtml(item.id)
        }"><strong>${this.s.escapeHtml(translation.title || item.id)
        }</strong><span>${this.s.escapeHtml(item.sourceType)} · ${this.formatDuration(item.durationSeconds)
        } · ${this.s.escapeHtml(this.s.statusLabel(item.status))}</span></button>${item.status !== "archived"
          ? `<button class="button button-danger button-remove" type="button" ${deleteAttribute}="${this.s.escapeHtml(item.id)
          }">Archivieren</button>`
          : ""
        }</article>`;
    }).join("");
  }
  handleListClick(event) {
    const deleteButton = event.target.closest(
      "[data-video-delete-id], [data-interview-video-delete-id]",
    );
    if (deleteButton) {
      this.onDelete({
        kind: this.scope === "interviews" ? "interview-video" : "video",
        id: deleteButton.dataset.videoDeleteId ||
          deleteButton.dataset.interviewVideoDeleteId,
      });
      return;
    }
    const button = event.target.closest("[data-video-id]");
    const item = this.items.find((candidate) =>
      candidate.id === button?.dataset.videoId
    );
    if (item) this.populate(item).then(() => this.render());
  }
  addSubtitle() {
    this.syncSubtitleRows();
    this.subtitleState.push({
      id: "",
      language: "de",
      label: "Deutsch",
      srcLang: "de",
      src: "",
      content: "WEBVTT\n\n",
      isDefault: this.subtitleState.length === 0,
      sortOrder: this.subtitleState.length,
      file: null,
    });
    this.renderSubtitleRows();
  }
  handleSubtitleInput(event) {
    this.syncSubtitleRows();
    if (event.target.matches("[data-video-subtitle-content]")) {
      const row = event.target.closest("[data-video-subtitle-index]");
      if (
        row &&
        Number(row.dataset.videoSubtitleIndex) === this.activeSubtitleIndex
      ) {
        this.cueState = this.parseCues(event.target.value);
        this.renderCueEditor();
      }
    }
  }
  async handleSubtitleChange(event) {
    const row = event.target.closest("[data-video-subtitle-index]");
    if (!row) return;
    const index = Number(row.dataset.videoSubtitleIndex);
    if (event.target.matches("[data-video-subtitle-file]")) {
      const file = event.target.files?.[0];
      if (file) {
        this.subtitleState[index].file = file;
        this.subtitleState[index].content = await file.text();
        this.renderSubtitleRows();
      }
    }
    this.syncSubtitleRows();
  }
  handleSubtitleClick(event) {
    const remove = event.target.closest("[data-video-remove-subtitle]");
    if (remove) {
      this.subtitleState.splice(Number(remove.dataset.videoRemoveSubtitle), 1);
      this.activeSubtitleIndex = -1;
      this.renderSubtitleRows();
      return;
    }
    const edit = event.target.closest("[data-video-edit-subtitle]");
    if (edit) {
      this.syncSubtitleRows();
      this.activeSubtitleIndex = Number(edit.dataset.videoEditSubtitle);
      this.cueState = this.parseCues(
        this.subtitleState[this.activeSubtitleIndex]?.content,
      );
      this.renderCueEditor();
    }
  }
  handleCueClick(event) {
    if (event.target.closest("[data-video-add-cue]")) {
      this.syncCues();
      const start = Number(this.preview.currentTime || 0);
      this.cueState.push({ start, end: start + 2, text: "" });
      this.renderCueEditor();
      return;
    }
    const now = event.target.closest("[data-video-cue-now]");
    if (now) {
      this.syncCues();
      const index = Number(now.dataset.videoCueIndex);
      this.cueState[index][now.dataset.videoCueNow] = Number(
        this.preview.currentTime || 0,
      );
      this.renderCueEditor();
      return;
    }
    const remove = event.target.closest("[data-video-remove-cue]");
    if (remove) {
      this.syncCues();
      this.cueState.splice(Number(remove.dataset.videoRemoveCue), 1);
      this.renderCueEditor();
    }
  }
}

class InterviewMaterialsAdmin {
  constructor(services, onDelete) {
    this.s = services;
    this.onDelete = onDelete;
    this.items = [];
    this.editingId = null;
    this.form = document.getElementById("interviewMaterialForm");
    this.list = document.getElementById("interviewMaterialsList");
    this.file = document.getElementById("interviewMaterialFile");
  }
  bind() {
    this.list.addEventListener("click", (event) => this.handleListClick(event));
    this.form.addEventListener("submit", (event) => this.save(event));
    this.file.addEventListener("change", () => this.upload());
    document.getElementById("newInterviewMaterial").addEventListener(
      "click",
      () => this.clear(),
    );
    document.getElementById("publishInterviewMaterial").addEventListener(
      "click",
      () => this.publish(),
    );
    document.getElementById("archiveInterviewMaterial").addEventListener(
      "click",
      () => {
        if (this.editingId) {
          this.onDelete({
            kind: "interview-material",
            id: this.editingId,
          });
        }
      },
    );
  }
  field(language, name) {
    return this.s.field(this.form, language, name, "data-interview-material");
  }
  clear() {
    this.editingId = null;
    this.form.reset();
    document.getElementById("interviewMaterialId").disabled = false;
    document.getElementById("interviewMaterialHeading").textContent =
      "Neues Material";
    document.getElementById("interviewMaterialStatus").textContent = "Entwurf";
    document.getElementById("archiveInterviewMaterial").hidden = true;
    document.getElementById("interviewMaterialKind").value = "documents";
    document.getElementById("interviewMaterialSourceType").value = "r2";
    document.getElementById("interviewMaterialSortOrder").value = "0";
  }
  populate(item) {
    this.form.querySelectorAll("[aria-invalid]").forEach((field) => this.s.clearFieldError({ target: field }));
    this.editingId = item.id;
    document.getElementById("interviewMaterialId").value = item.id;
    document.getElementById("interviewMaterialId").disabled = true;
    document.getElementById("interviewMaterialKind").value = item.kind ||
      "documents";
    document.getElementById("interviewMaterialSourceType").value =
      item.sourceType || "external";
    document.getElementById("interviewMaterialSourceUrl").value =
      item.sourceUrl || "";
    document.getElementById("interviewMaterialFileName").value =
      item.fileName || "";
    document.getElementById("interviewMaterialSortOrder").value =
      item.sortOrder || 0;
    document.getElementById("interviewMaterialFeatured").checked = Boolean(
      item.featured,
    );
    delete this.file.dataset.mimeType;
    delete this.file.dataset.sizeBytes;
    for (const language of AdminConfig.languages) {
      const translation = item.translations?.[language] || {};
      this.field(language, "title").value = translation.title || "";
      this.field(language, "description").value = translation.description || "";
      this.field(language, "alt").value = translation.alt || "";
    }
    document.getElementById("interviewMaterialHeading").textContent = item.id;
    document.getElementById("interviewMaterialStatus").textContent = this.s
      .statusLabel(item.status);
    document.getElementById("archiveInterviewMaterial").hidden =
      item.status === "archived";
    this.render();
  }
  payload() {
    return {
      id: document.getElementById("interviewMaterialId").value.trim(),
      kind: document.getElementById("interviewMaterialKind").value,
      sourceType: document.getElementById("interviewMaterialSourceType").value,
      sourceUrl: document.getElementById("interviewMaterialSourceUrl").value
        .trim(),
      fileName: document.getElementById("interviewMaterialFileName").value
        .trim(),
      mimeType: this.file.dataset.mimeType || "",
      sizeBytes: this.file.dataset.sizeBytes || null,
      featured: document.getElementById("interviewMaterialFeatured").checked,
      sortOrder: Number(
        document.getElementById("interviewMaterialSortOrder").value || 0,
      ),
      translations: Object.fromEntries(
        AdminConfig.languages.map((
          language,
        ) => [language, {
          title: this.field(language, "title").value.trim(),
          description: this.field(language, "description").value.trim(),
          alt: this.field(language, "alt").value.trim(),
        }]),
      ),
    };
  }
  async save(event) {
    event.preventDefault();
    if (!this.form.reportValidity()) return;
    try {
      const response = await this.s.api(
        this.editingId
          ? `/api/v1/admin/interviews/materials/${encodeURIComponent(this.editingId)
          }`
          : "/api/v1/admin/interviews/materials",
        {
          method: this.editingId ? "PUT" : "POST",
          body: JSON.stringify(this.payload()),
        },
      );
      this.editingId = response.material.id;
      await this.load(this.editingId);
      this.s.showNotice("Interview-Material als Entwurf gespeichert.");
    } catch (error) {
      this.s.showNotice(error.message, true);
    }
  }
  async publish() {
    try {
      if (!this.form.reportValidity()) return;
      const response = await this.s.api(
        this.editingId
          ? `/api/v1/admin/interviews/materials/${encodeURIComponent(this.editingId)
          }`
          : "/api/v1/admin/interviews/materials",
        {
          method: this.editingId ? "PUT" : "POST",
          body: JSON.stringify(this.payload()),
        },
      );
      this.editingId = response.material.id;
      await this.s.api(
        `/api/v1/admin/interviews/materials/${encodeURIComponent(this.editingId)
        }/publish`,
        { method: "POST" },
      );
      await this.load(this.editingId);
      this.s.showNotice("Interview-Material veröffentlicht.");
    } catch (error) {
      this.s.showNotice(error.message, true);
    }
  }
  async upload() {
    const file = this.file.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    try {
      this.s.showNotice("Interview-Material wird hochgeladen …");
      const response = await this.s.api(
        "/api/v1/admin/interviews/materials/media",
        { method: "POST", body },
      );
      document.getElementById("interviewMaterialSourceType").value = "r2";
      document.getElementById("interviewMaterialSourceUrl").value =
        response.url;
      document.getElementById("interviewMaterialFileName").value =
        response.fileName || file.name;
      this.file.dataset.mimeType = response.mimeType || file.type;
      this.file.dataset.sizeBytes = String(response.sizeBytes || file.size);
      this.s.showNotice(
        "Material hochgeladen. Jetzt Metadaten speichern oder veröffentlichen.",
      );
    } catch (error) {
      this.s.showNotice(error.message, true);
    }
  }
  async load(selectId = this.editingId) {
    const response = await this.s.api("/api/v1/admin/interviews/materials");
    this.items = response.materials || [];
    this.render();
    const selected = this.items.find((item) => item.id === selectId);
    if (selected) this.populate(selected);
  }
  render() {
    if (!this.items.length) {
      this.list.innerHTML =
        '<p class="muted">Noch keine Interview-Materialien vorhanden. Lege zuerst ein Dokument, einen Prospekt, ein Formular oder eine Anfrage an.</p>';
      return;
    }
    this.list.innerHTML = this.items.map((item) => {
      const translation = item.translations?.de || item.translations?.en ||
        item.translations?.ru || {};
      return `<article class="news-item${item.id === this.editingId ? " active" : ""
        }"><button class="news-item-select" type="button" data-interview-material-id="${this.s.escapeHtml(item.id)
        }"><strong>${this.s.escapeHtml(translation.title || item.id)
        }</strong><span>${this.s.escapeHtml(item.kind)} · ${this.s.escapeHtml(this.s.statusLabel(item.status))
        }${item.fileName ? ` · ${this.s.escapeHtml(item.fileName)}` : ""
        }</span></button>${item.status !== "archived"
          ? `<button class="button button-danger button-remove" type="button" data-interview-material-delete-id="${this.s.escapeHtml(item.id)
          }">Archivieren</button>`
          : ""
        }</article>`;
    }).join("");
  }
  handleListClick(event) {
    const deleteButton = event.target.closest(
      "[data-interview-material-delete-id]",
    );
    if (deleteButton) {
      this.onDelete({
        kind: "interview-material",
        id: deleteButton.dataset.interviewMaterialDeleteId,
      });
      return;
    }
    const button = event.target.closest("[data-interview-material-id]");
    const item = this.items.find((candidate) =>
      candidate.id === button?.dataset.interviewMaterialId
    );
    if (item) this.populate(item);
  }
}

class ProjectsAdmin {
  constructor(services, onDelete) {
    this.s = services;
    this.onDelete = onDelete;
    this.items = [];
    this.editingId = null;
    this.form = document.getElementById("projectForm");
    this.list = document.getElementById("projectsList");
    this.file = document.getElementById("projectFile");
  }
  bind() {
    this.list.addEventListener("click", (event) => this.handleListClick(event));
    this.form.addEventListener("submit", (event) => this.save(event));
    this.file.addEventListener("change", () => this.upload());
    document.getElementById("newProject").addEventListener(
      "click",
      () => this.clear(),
    );
    document.getElementById("reloadProjects").addEventListener(
      "click",
      () =>
        this.load().catch((error) => this.s.showNotice(error.message, true)),
    );
    document.getElementById("publishProject").addEventListener(
      "click",
      () => this.publish(),
    );
    document.getElementById("archiveProject").addEventListener("click", () => {
      if (this.editingId) {
        this.onDelete({ kind: "project", id: this.editingId });
      }
    });
  }
  field(language, name) {
    return this.s.field(this.form, language, name, "data-project");
  }
  clear() {
    this.editingId = null;
    this.form.reset();
    document.getElementById("projectId").disabled = false;
    document.getElementById("projectHeading").textContent = "Neues Projekt";
    document.getElementById("projectStatus").textContent = "Entwurf";
    document.getElementById("archiveProject").hidden = true;
    document.getElementById("projectCategory").value = "creative";
    document.getElementById("projectAccent").value = "blue";
    document.getElementById("projectSortOrder").value = "0";
    document.getElementById("projectStartDate").value = new Date().toISOString()
      .slice(0, 10);
    this.render();
  }
  populate(item) {
    this.form.querySelectorAll("[aria-invalid]").forEach((field) => this.s.clearFieldError({ target: field }));
    this.editingId = item.id;
    document.getElementById("projectId").value = item.id;
    document.getElementById("projectId").disabled = true;
    document.getElementById("projectStartDate").value = item.startDate || "";
    document.getElementById("projectEndDate").value = item.endDate || "";
    document.getElementById("projectCategory").value = item.category ||
      "creative";
    document.getElementById("projectAccent").value = item.accent || "blue";
    document.getElementById("projectImage").value = item.image || "";
    document.getElementById("projectLinkUrl").value = item.linkUrl || "";
    document.getElementById("projectFeatured").checked = Boolean(item.featured);
    document.getElementById("projectSortOrder").value = item.sortOrder || 0;
    for (const language of AdminConfig.languages) {
      const translation = item.translations?.[language] || {};
      this.field(language, "title").value = translation.title || "";
      this.field(language, "alt").value = translation.alt || "";
      this.field(language, "description").value = translation.description || "";
    }
    document.getElementById("projectHeading").textContent = item.id;
    document.getElementById("projectStatus").textContent = this.s.statusLabel(
      item.status,
    );
    document.getElementById("archiveProject").hidden =
      item.status === "archived";
    this.render();
  }
  payload() {
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
      translations: Object.fromEntries(
        AdminConfig.languages.map((
          language,
        ) => [language, {
          title: this.field(language, "title").value.trim(),
          alt: this.field(language, "alt").value.trim(),
          description: this.field(language, "description").value.trim(),
        }]),
      ),
    };
  }
  async save(event) {
    event.preventDefault();
    if (!this.form.reportValidity()) return;
    try {
      const response = await this.s.api(
        this.editingId
          ? `/api/v1/admin/projects/${encodeURIComponent(this.editingId)}`
          : "/api/v1/admin/projects",
        {
          method: this.editingId ? "PUT" : "POST",
          body: JSON.stringify(this.payload()),
        },
      );
      this.editingId = response.project.id;
      await this.load(this.editingId);
      this.s.showNotice("Projekt als Entwurf gespeichert.");
    } catch (error) {
      this.s.showNotice(error.message, true);
    }
  }
  async publish() {
    try {
      if (!this.form.reportValidity()) return;
      const response = await this.s.api(
        this.editingId
          ? `/api/v1/admin/projects/${encodeURIComponent(this.editingId)}`
          : "/api/v1/admin/projects",
        {
          method: this.editingId ? "PUT" : "POST",
          body: JSON.stringify(this.payload()),
        },
      );
      this.editingId = response.project.id;
      await this.s.api(
        `/api/v1/admin/projects/${encodeURIComponent(this.editingId)}/publish`,
        { method: "POST" },
      );
      await this.load(this.editingId);
      this.s.showNotice(
        "Projekt veröffentlicht. Der Zeitraum bestimmt, ob es bevorstehend, aktuell oder vergangen ist.",
      );
    } catch (error) {
      this.s.showNotice(error.message, true);
    }
  }
  async upload() {
    const file = this.file.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    try {
      this.s.showNotice("Projektbild wird hochgeladen …");
      const response = await this.s.api("/api/v1/admin/projects/media", {
        method: "POST",
        body,
      });
      this.s.setValue("projectImage", response.image);
      this.s.showNotice("Projektbild hochgeladen. Jetzt Metadaten speichern.");
    } catch (error) {
      this.s.showNotice(error.message, true);
    }
  }
  async load(selectId = this.editingId) {
    const response = await this.s.api("/api/v1/admin/projects");
    this.items = response.projects || [];
    this.render();
    const selected = this.items.find((item) => item.id === selectId);
    if (selected) this.populate(selected);
  }
  render() {
    if (!this.items.length) {
      this.list.innerHTML =
        '<p class="muted">Noch keine Projekte vorhanden. Lege zuerst einen Entwurf an.</p>';
      return;
    }
    this.list.innerHTML = this.items.map((item) => {
      const translation = item.translations?.de || item.translations?.en ||
        item.translations?.ru || {};
      const phase = item.phase === "past"
        ? "Vergangen"
        : item.phase === "upcoming"
          ? "Bevorstehend"
          : "Aktuell";
      return `<article class="news-item${item.id === this.editingId ? " active" : ""
        }"><button class="news-item-select" type="button" data-project-id="${this.s.escapeHtml(item.id)
        }"><strong>${this.s.escapeHtml(translation.title || item.id)
        }</strong><span>${this.s.escapeHtml(phase)} · ${this.s.escapeHtml(this.s.statusLabel(item.status))
        } · ${this.s.escapeHtml(item.startDate)}${item.endDate ? ` – ${this.s.escapeHtml(item.endDate)}` : ""
        }</span></button>${item.status !== "archived"
          ? `<button class="button button-danger button-remove" type="button" data-project-delete-id="${this.s.escapeHtml(item.id)
          }">Archivieren</button>`
          : ""
        }</article>`;
    }).join("");
  }
  handleListClick(event) {
    const deleteButton = event.target.closest("[data-project-delete-id]");
    if (deleteButton) {
      this.onDelete({
        kind: "project",
        id: deleteButton.dataset.projectDeleteId,
      });
      return;
    }
    const button = event.target.closest("[data-project-id]");
    const item = this.items.find((candidate) =>
      candidate.id === button?.dataset.projectId
    );
    if (item) this.populate(item);
  }
}

class AdminDeleteDialog {
  constructor(services, execute) {
    this.s = services;
    this.execute = execute;
    this.pending = null;
    this.dialog = document.getElementById("deleteDialog");
    this.form = document.getElementById("deleteDialogForm");
    this.title = document.getElementById("deleteDialogTitle");
    this.message = document.getElementById("deleteDialogMessage");
    this.confirmation = document.getElementById("deleteConfirmation");
    this.confirmButton = document.getElementById("confirmDelete");
  }
  bind() {
    this.confirmation.addEventListener("input", () => {
      this.confirmButton.disabled = !this.isConfirmation(
        this.confirmation.value,
      );
    });
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!this.pending || !this.isConfirmation(this.confirmation.value)) {
        return;
      }
      const target = this.pending;
      this.pending = null;
      this.dialog.close();
      this.execute(target);
    });
    document.getElementById("cancelDelete").addEventListener("click", () => {
      this.pending = null;
      this.dialog.close();
    });
  }
  isConfirmation(value) {
    return /^(delete|удалить)$/i.test(value.trim());
  }
  request(target) {
    this.pending = target;
    this.title.textContent = target.kind === "news"
      ? "Meldung archivieren?"
      : target.kind === "gallery"
        ? "Galerie-Bild löschen?"
        : target.kind === "quote"
          ? "Galerie-Zitat entfernen?"
          : target.kind === "world"
            ? "Standort archivieren?"
            : target.kind === "video"
              ? "Video archivieren?"
              : target.kind === "interview-video"
                ? "Interview archivieren?"
                : target.kind === "interview-material"
                  ? "Interview-Material archivieren?"
                  : target.kind === "project"
                    ? "Projekt archivieren?"
                    : "Partner archivieren?";
    if (target.kind === "online-media") this.title.textContent = "Inhalt archivieren?";
    this.message.textContent = target.kind === "news"
      ? "Die Meldung wird archiviert und ist danach nicht mehr öffentlich sichtbar."
      : target.kind === "gallery"
        ? "Das Bild wird endgültig aus der Galerie gelöscht."
        : target.kind === "quote"
          ? "Das Zitat wird aus der öffentlichen Galerie entfernt."
          : target.kind === "video" || target.kind === "interview-video"
            ? "Das Video wird archiviert und ist danach nicht mehr öffentlich sichtbar."
            : target.kind === "interview-material"
              ? "Das Material wird archiviert und ist danach nicht mehr öffentlich sichtbar."
              : target.kind === "project"
                ? "Das Projekt wird archiviert und ist danach nicht mehr öffentlich sichtbar."
                : "Der Inhalt wird archiviert und ist danach nicht mehr öffentlich sichtbar.";
    if (target.kind === "online-media") this.message.textContent = "Der Inhalt wird von der öffentlichen Online-Projekte-Seite entfernt. Die Datei bleibt gespeichert und kann später erneut veröffentlicht werden.";
    this.confirmation.value = "";
    this.confirmButton.disabled = true;
    this.dialog.showModal();
    this.confirmation.focus();
  }
}

class AdminShell {
  constructor(services, modules) {
    this.s = services;
    this.modules = modules;
    this.tabs = [...document.querySelectorAll("[data-admin-tab]")];
    this.views = [...document.querySelectorAll("[data-admin-view]")];
    this.newNews = document.getElementById("newNews");
  }
  bind() {
    this.tabs.forEach((tab) =>
      tab.addEventListener("click", () => this.setView(tab.dataset.adminTab))
    );
    this.bindTabKeyboard(this.tabs);
    this.bindTabKeyboard([...document.querySelectorAll("[data-interview-content-tab]")]);
    const orientation = () => document.querySelector(".admin-tabs").setAttribute("aria-orientation", window.matchMedia("(max-width: 980px)").matches ? "horizontal" : "vertical");
    orientation();
    window.matchMedia("(max-width: 980px)").addEventListener("change", orientation);
    document.getElementById("openGuide").addEventListener("click", () => {
      document.getElementById("quickGuide").open = true;
    });
    this.newNews.addEventListener("click", () => {
      document.getElementById("newsId").focus();
    });
    document.addEventListener("reset", (event) => {
      event.target.querySelectorAll("[aria-invalid]").forEach((field) => this.s.clearFieldError({ target: field }));
    }, true);
    document.addEventListener("invalid", (event) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
      const message = field.validity.valueMissing ? "Bitte dieses Pflichtfeld ausfüllen."
        : field.validity.patternMismatch ? "Bitte das angegebene Format verwenden. Kleinbuchstaben, Zahlen und Bindestriche sind erlaubt."
          : field.validity.typeMismatch ? "Bitte eine gültige Adresse eingeben."
            : field.validationMessage;
      markFieldError(field, message);
    }, true);
    const statuses = [...document.querySelectorAll(".status-badge")];
    const refreshStatuses = () => statuses.forEach((badge) => {
      badge.dataset.status = badge.textContent === "Veröffentlicht" ? "published" : badge.textContent === "Archiviert" ? "archived" : "draft";
    });
    statuses.forEach((badge) => new MutationObserver(refreshStatuses).observe(badge, { childList: true, characterData: true, subtree: true }));
    refreshStatuses();
    document.addEventListener(
      "input",
      (event) => this.s.clearFieldError(event),
    );
    document.addEventListener(
      "change",
      (event) => this.s.clearFieldError(event),
    );
    document.querySelectorAll("[data-interview-content-tab]").forEach((tab) =>
      tab.addEventListener(
        "click",
        () => this.setInterviewContent(tab.dataset.interviewContentTab),
      )
    );
  }
  bindTabKeyboard(tabs) {
    tabs.forEach((tab, index) => tab.addEventListener("keydown", (event) => {
      let target;
      if (["ArrowDown", "ArrowRight"].includes(event.key)) target = (index + 1) % tabs.length;
      else if (["ArrowUp", "ArrowLeft"].includes(event.key)) target = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") target = 0;
      else if (event.key === "End") target = tabs.length - 1;
      else return;
      event.preventDefault();
      tabs.forEach((item, i) => item.tabIndex = i === target ? 0 : -1);
      tabs[target].focus();
    }));
  }
  updateGuidance(key) {
    const standard = ["Entwurf speichern & prüfen", "Pflichtfelder ausfüllen, als Entwurf speichern und alle Sprachversionen prüfen.", "Veröffentlichen", "Mit „Veröffentlichen“ wird der Inhalt auf der Website sichtbar."];
    const content = {
      news: ["Meldungen", "Neuigkeiten, Veranstaltungen und Berichte für die Website erstellen.", "So veröffentlichst du eine Meldung", "Inhalt vorbereiten", "Grunddaten und Titelbild angeben. Texte in RU, EN und DE ausfüllen.", ...standard, "Hochladen allein veröffentlicht noch keine Meldung. Das Datum ist das angezeigte Datum, keine automatische Freigabe."],
      gallery: ["Galerie", "Bilder in Ordnern sammeln, prüfen und gemeinsam veröffentlichen.", "So veröffentlichst du einen Galerieordner", "Bilder & Ordner wählen", "Dateien auswählen. Einen vorhandenen Ordner ergänzen oder einen neuen Ordner in drei Sprachen benennen.", "Als Entwurf hochladen", "„Bilder als Entwurf hochladen“ speichert die Auswahl zunächst privat. Den Ordner unten öffnen und prüfen.", "Ordner veröffentlichen", "Unten im Ordner „Ordner veröffentlichen“ anklicken. Erst dann sind die neuen Bilder öffentlich.", "Galerie-Bilder werden zuerst als Entwurf gespeichert. Ein Zitat wird über „Zitat veröffentlichen“ sofort sichtbar."],
      "online-projects": ["Online-Projekte", "Fotos, Videos und PDF-Dokumente den zehn Themen zuordnen.", "So ergänzt du Medien in einem Thema", "Medienart & Thema wählen", "Fotos, Videos oder Dokumente wählen und das passende Thema angeben.", "Datei & Texte prüfen", "Eine Datei auswählen, die Vorschau prüfen und die Sprachversionen ergänzen. Bei PDFs entsteht die Vorschau aus der ersten Seite.", "Speichern & veröffentlichen", "Videos und Dokumente als Entwurf speichern und anschließend veröffentlichen. Fotos werden über „In … veröffentlichen“ sofort sichtbar.", "Fotos werden sofort veröffentlicht. Videos und Dokumente bleiben über „Als Entwurf speichern“ privat. Archivieren nimmt sie von der Website und behält die Dateien."],
      videos: ["Videos", "YouTube-Videos oder eigene Videodateien mit mehrsprachigen Texten verwalten.", "So veröffentlichst du ein Video", "Video & Texte ergänzen", "Videoquelle auswählen, Link einfügen oder Datei hochladen. Titel und Bildbeschreibungen in drei Sprachen ergänzen.", ...standard, "Untertitel sind optional. Eigene Videodateien: maximal 95 MB. Ein Upload allein veröffentlicht das Video noch nicht."],
      interviews: ["Interviews", "Videos und begleitende Materialien für die Interview-Seite verwalten.", "So ergänzt du ein Interview", "Inhaltsart auswählen", "Links zwischen „Videos“ und „Materialien“ wählen. Quelle, Datei und Sprachversionen ergänzen.", ...standard, "Interview-Videos gehören zur Interview-Seite. Unter „Materialien“ können Dokumente, Prospekte, Formulare und Anfragen ergänzt werden."],
      projects: ["Projekte", "Projekte beschreiben und über ihren Zeitraum einordnen.", "So veröffentlichst du ein Projekt", "Zeitraum & Texte ergänzen", "Startdatum und optional ein Enddatum angeben. Titel und Bildbeschreibungen in drei Sprachen ausfüllen.", ...standard, "Nach dem Enddatum zählt das Projekt automatisch zu den vergangenen Projekten. Ohne Enddatum bleibt es aktuell."],
      world: ["Weltkarte", "Standorte und Länder auf der öffentlichen Weltkarte pflegen.", "So ergänzt du einen Standort", "Position & Texte angeben", "Breiten- und Längengrad eintragen. Stadt und Land in RU, EN und DE ergänzen.", ...standard, "Koordinaten bestimmen die Position auf der Karte. Die Art des Standorts kennzeichnet Hauptstandort, durchgeführte oder geplante Veranstaltung."],
      partners: ["Partner", "Organisationen, Logos und Links für die Partnerübersicht pflegen.", "So ergänzt du einen Partner", "Organisation & Logo ergänzen", "Kategorie auswählen, Logo hochladen und Namen sowie Bildbeschreibungen in drei Sprachen eintragen.", ...standard, "Die Website-Adresse ist optional. Kleinere Sortierungswerte erscheinen zuerst."],
    }[key];
    const ids = ["workspaceCategory", "workspaceDescription", "guideTitle", "guideStep1Title", "guideStep1", "guideStep2Title", "guideStep2", "guideStep3Title", "guideStep3"];
    ids.forEach((id, index) => document.getElementById(id).textContent = content[index]);
    document.getElementById("workspaceTitle").textContent = content[0];
    const note = document.getElementById("workflowNote");
    const label = document.createElement("strong");
    label.textContent = "Gut zu wissen: ";
    note.replaceChildren(label, document.createTextNode(content[9]));
  }
  setInterviewContent(selected) {
    document.querySelectorAll("[data-interview-content-tab]").forEach(
      (item) => {
        const active = item.dataset.interviewContentTab === selected;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", String(active));
        item.tabIndex = active ? 0 : -1;
      },
    );
    document.querySelectorAll("[data-interview-content-pane]").forEach(
      (pane) => {
        pane.hidden = pane.dataset.interviewContentPane !== selected;
      },
    );
  }
  setView(viewKey) {
    const selectedView = viewKey === "online-projects" ||
      this.views.some((view) => view.dataset.adminView === viewKey)
      ? viewKey
      : "news";
    const panelKey = selectedView === "online-projects"
      ? "gallery"
      : selectedView;
    if (selectedView === "interviews") {
      this.modules.video.setScope("interviews");
      document.getElementById("interviewVideoEditorMount").append(
        this.modules.video.form,
      );
    } else if (selectedView === "videos") {
      this.modules.video.setScope("general");
      document.getElementById("videoEditorMount").append(
        this.modules.video.form,
      );
    }
    this.views.forEach((view) => {
      view.hidden = view.dataset.adminView !== panelKey;
    });
    this.tabs.forEach((tab) => {
      const active = tab.dataset.adminTab === selectedView;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    this.newNews.hidden = selectedView !== "news";
    this.updateGuidance(selectedView);
    if (panelKey === "gallery") {
      this.modules.gallery.configureView(selectedView === "online-projects");
    }
    this.modules.onlineMedia.setEnabled(selectedView === "online-projects");
    if (selectedView === "videos") {
      this.modules.video.load().catch((error) =>
        this.s.showNotice(error.message, true)
      );
    }
    if (selectedView === "interviews") {
      this.modules.video.load().catch((error) =>
        this.s.showNotice(error.message, true)
      );
      this.modules.materials.load().catch((error) =>
        this.s.showNotice(error.message, true)
      );
    }
  }
  start() {
    this.modules.news.clear();
    this.modules.world.clear();
    this.modules.partners.clear();
    this.modules.video.clear();
    this.modules.materials.clear();
    this.modules.projects.clear();
    this.setView("news");
    this.modules.news.load().catch((error) =>
      this.s.showNotice(error.message, true)
    );
    this.modules.gallery.load().catch((error) =>
      this.s.showNotice(error.message, true)
    );
    this.modules.world.load().catch((error) =>
      this.s.showNotice(error.message, true)
    );
    this.modules.partners.load().catch((error) =>
      this.s.showNotice(error.message, true)
    );
    this.modules.projects.load().catch((error) =>
      this.s.showNotice(error.message, true)
    );
  }
}

class AdminApp {
  constructor() {
    this.s = new AdminServices();
    this.modules = {};
    this.deleteDialog = new AdminDeleteDialog(
      this.s,
      (target) => this.executeDeletion(target),
    );
    const requestDeletion = (target) => this.deleteDialog.request(target);
    this.modules.news = new NewsAdmin(this.s, requestDeletion);
    this.modules.gallery = new GalleryAdmin(this.s, requestDeletion);
    this.modules.onlineMedia = new OnlineProjectMediaAdmin(this.s, markFieldError, requestDeletion);
    this.modules.world = new WorldPointsAdmin(this.s, requestDeletion);
    this.modules.partners = new PartnersAdmin(this.s, requestDeletion);
    this.modules.video = new VideoAdmin(this.s, requestDeletion);
    this.modules.materials = new InterviewMaterialsAdmin(
      this.s,
      requestDeletion,
    );
    this.modules.projects = new ProjectsAdmin(this.s, requestDeletion);
    Object.values(this.modules).forEach((module) => module.bind());
    this.deleteDialog.bind();
    this.shell = new AdminShell(this.s, this.modules);
    this.shell.bind();
  }
  async executeDeletion(target) {
    try {
      if (target.kind === "online-media") {
        await this.s.api(`/api/v1/admin/online-projects/media/${encodeURIComponent(target.id)}`, { method: "DELETE" });
        await this.modules.onlineMedia.load();
        this.modules.onlineMedia.clear();
        this.s.showNotice("Inhalt archiviert. Die Datei bleibt gespeichert und ist nicht mehr öffentlich sichtbar.");
        return;
      }
      if (target.kind === "news") {
        await this.s.api(
          `/api/v1/admin/news/${encodeURIComponent(target.id)}`,
          { method: "DELETE" },
        );
        await this.modules.news.load();
        this.modules.news.clear();
        this.s.showNotice("Meldung archiviert.");
      } else if (target.kind === "gallery") {
        await this.s.api(
          `/api/v1/admin/gallery/${encodeURIComponent(target.key)}`,
          { method: "DELETE" },
        );
        await this.modules.gallery.load();
        this.s.showNotice("Galerie-Bild gelöscht.");
      } else if (target.kind === "quote") {
        await this.s.api(
          `/api/v1/admin/gallery/quotes/${encodeURIComponent(target.id)}`,
          { method: "DELETE" },
        );
        await this.modules.gallery.load();
        this.s.showNotice("Zitat entfernt.");
      } else if (target.kind === "world") {
        await this.s.api(
          `/api/v1/admin/world-points/${encodeURIComponent(target.id)}`,
          { method: "DELETE" },
        );
        await this.modules.world.load();
        this.modules.world.clear();
        this.s.showNotice("Standort archiviert.");
      } else if (target.kind === "partner") {
        await this.s.api(
          `/api/v1/admin/partners/${encodeURIComponent(target.id)}`,
          { method: "DELETE" },
        );
        await this.modules.partners.load();
        this.modules.partners.clear();
        this.s.showNotice("Partner archiviert.");
      } else if (target.kind === "video") {
        await this.s.api(
          `/api/v1/admin/videos/${encodeURIComponent(target.id)}`,
          { method: "DELETE" },
        );
        this.modules.video.setScope("general");
        await this.modules.video.load();
        this.modules.video.clear();
        this.s.showNotice("Video archiviert.");
      } else if (target.kind === "interview-video") {
        await this.s.api(
          `/api/v1/admin/interviews/videos/${encodeURIComponent(target.id)}`,
          { method: "DELETE" },
        );
        this.modules.video.setScope("interviews");
        await this.modules.video.load();
        this.modules.video.clear();
        this.s.showNotice("Interview archiviert.");
      } else if (target.kind === "interview-material") {
        await this.s.api(
          `/api/v1/admin/interviews/materials/${encodeURIComponent(target.id)}`,
          { method: "DELETE" },
        );
        await this.modules.materials.load();
        this.modules.materials.clear();
        this.s.showNotice("Interview-Material archiviert.");
      } else if (target.kind === "project") {
        await this.s.api(
          `/api/v1/admin/projects/${encodeURIComponent(target.id)}`,
          { method: "DELETE" },
        );
        await this.modules.projects.load();
        this.modules.projects.clear();
        this.s.showNotice("Projekt archiviert.");
      }
    } catch (error) {
      this.s.showNotice(error.message, true);
    }
  }
  start() {
    this.shell.start();
  }
}

new AdminApp().start();
