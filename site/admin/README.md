# MIRoKIT Content Desk

- `index.html`: editor shell and forms for News, Gallery, Online Projects, Videos, Projects, World Points and Partners.
- `admin.css`: editor presentation and responsive layout.
- `admin.js`: tab navigation, forms, uploads and API requests.
- `media-preview.js`: protected media URLs and authenticated local Blob previews.
- `online-project-media.js`: Online-Projekte, Video-/PDF-Uploads und lokale PDF-Vorschau.
- Shared icons: `/public/favicon/` (no duplicate icon files here).

Open `/admin/` through the local Worker (`cd worker` then `npm run dev` from the repository root). A static HTML server or `file://` cannot provide the `/api/v1/admin/` endpoints. Production access requires the configured Cloudflare Access identity; local API access uses the configured development token.

CSS and script URLs are rooted at `/admin/`. Stored relative image URLs in gallery previews resolve from the website root. Never include `site/` in deployed URLs.

## Video workflow

- YouTube records store a YouTube embed source and always use YouTube's own player controls.
- `external` records need a direct HTTPS media URL (MP4, WebM or OGG), not a Drive/Dropbox share page. The remote server must support browser playback, CORS and byte ranges.
- `r2` records use `/media/v1/videos/...` and are uploaded from the Videos panel (maximum 95 MB per video). The Worker serves these files with byte-range responses.
- Subtitle tracks are WebVTT. Add one or more tracks, upload or paste the VTT text, then use `Cues bearbeiten` with the preview player to set cue start/end times from the current video position.
- Duration and dimensions are filled from HTML5 `loadedmetadata` for direct/R2 sources. YouTube metadata is not scraped; enter a fallback duration if the YouTube API is not available.
- Save as draft first. Publishing makes the video visible at `/api/v1/videos`; archiving removes it from the public feed but does not delete the stored media automatically.

## Private media previews

Owned R2 previews use `/api/v1/admin/media/<key>`, including drafts, pending uploads
and archived items. The production Access application must cover this path via
`/api/v1/admin/*`. The public `/media/v1/` URL only serves published content.

Locally the helper fetches preview bytes with `X-MiroKIT-Admin-Token` and creates
short-lived Blob URLs for media elements, revoking them on replacement. A local
video therefore downloads fully before its preview appears (up to the existing
95 MB limit). Production previews stream directly through Access and support
byte ranges. Tokens are never embedded in URLs or sent to external media hosts.
Subtitle edits create a new UUID path; old objects are retained privately unless
another published item still references them.

## Projects workflow

- Open the **Projects** tab and save a project as a draft first. Add a unique slug, start date, optional end date, theme, localized titles and alt texts.
- Publish only after checking the three language versions. The public `/api/v1/projects` response calculates `phase`: `past` when `endDate` is before today, `upcoming` before the start date, otherwise `current`.
- This is a computed archive, so no cron job or manual database move is needed. Project images can be uploaded in the same panel; pending R2 objects are promoted when the project is saved.

## Online-Projekte: Fotos, Videos und Dokumente

Im Bereich **Online-Projekte** zuerst die Medienart wählen. Alle drei Arten verwenden
die zehn gemeinsamen Themen aus `site/source/scripts/online-project-topics.js`.

- **Fotos:** Thema wählen, Bilddateien oder einen öffentlichen Google-Drive-Bildlink
  angeben. Titel und Bildbeschreibungen können in RU, EN und DE ergänzt werden.
  Bei mehreren Dateien gelten diese Texte für alle; individuelle Beschriftungen
  durch einzelne Uploads anlegen. **In „[Thema]“ veröffentlichen** veröffentlicht
  sofort. Bestehende Fotos ohne Thema lassen sich weiterhin unter **Noch ohne Thema**
  zuordnen. Die normale Galerie und ihre Ordner bleiben ein eigener Bereich.
- **Videos:** MP4, WebM oder OGV bis 95 MB auswählen. Ein Vorschaubild (JPG, PNG,
  WebP bis 2 MB), Beschreibung und Videotext sind optional. Die drei Titel sind
  Pflichtfelder. **Als Entwurf speichern** lädt die Datei hoch und hält sie privat;
  **Veröffentlichen** macht sie unmittelbar öffentlich sichtbar.
- **Dokumente:** PDF bis 20 MB auswählen. PDF.js erzeugt im Browser ein WebP-Bild
  der ersten Seite; beide Dateien werden beim Speichern hochgeladen. Eine lesbare
  PDF ohne Passwort ist erforderlich. Die drei Titel sind Pflichtfelder;
  Beschreibungen sind optional. Entwurf und Veröffentlichung funktionieren wie
  bei Videos. Auf der öffentlichen Seite öffnet ein Klick die PDF in einem neuen Tab.

Die Sprachgruppen lassen sich unabhängig öffnen; Russisch startet geöffnet.
Fehlende Pflichtfelder öffnen ihre Gruppe und erhalten einen zugeordneten Fehlertext.
Eine Dateiauswahl startet bei Videos und Dokumenten noch keinen Upload.

**Bearbeiten** lädt einen gespeicherten Inhalt in das Formular. Thema und Texte
lassen sich ändern. Eine andere Datei als neuen Inhalt anlegen. **Als Entwurf
speichern** nimmt auch einen zuvor veröffentlichten Inhalt von der Website;
das Formular weist darauf hin. **Archivieren** verlangt eine Bestätigung und
entfernt den Inhalt aus der öffentlichen Bibliothek, behält jedoch die Dateien.
Archivierte Inhalte über den Statusfilter öffnen und bei Bedarf erneut veröffentlichen.
**Bibliothek öffnen** zeigt die passende Medienart und das Thema.

Öffentliche Direktlinks:

- Fotos: `/page/onlineProjects/?topic=drawing&lang=de`
- Videos: `/page/onlineProjects/?media=videos&topic=drawing&lang=de`
- Dokumente: `/page/onlineProjects/?media=documents&topic=drawing&lang=de`

Technik und Einbau:

- Die Dateien im bestehenden `site/` und `worker/` verwenden. Die neue
  `site/public/vendor/pdfjs/`-Bibliothek einschließlich Worker, Zeichentabellen,
  Schriften und WASM-Dateien gehört zur lokalen Website. Kein CDN ist erforderlich.
- Keine neuen Bindings oder Datenbankmigrationen. Der bestehende `SITE_MEDIA`-Speicher
  enthält Video-/PDF-Dateien unter `online-projects/files/`, Vorschaubilder unter
  `online-projects/previews/` und JSON-Datensätze unter `online-projects/records/`.
  Die Texte liegen in JSON und verbrauchen kein R2-Custom-Metadata-Budget.
- `GET /api/v1/online-projects/media` liefert ausschließlich veröffentlichte
  Videos und Dokumente. Fotos verwenden weiterhin die Galerie-Schnittstelle.
- `GET/POST /api/v1/admin/online-projects/media` listet Inhalte bzw. lädt einen
  Entwurf hoch. POST erwartet FormData mit `kind`, `topic`, `file`, `translations`
  (JSON für RU/EN/DE mit `title`, `description`, optional `transcript`) und
  `thumbnail` (bei PDFs Pflicht, bei Videos optional).
- `PATCH /api/v1/admin/online-projects/media/:id` speichert `topic`, `translations`
  und `status` (`draft` oder `published`). `DELETE` archiviert. Änderungen verwenden
  bedingte Schreibzugriffe, um gleichzeitig erfolgende Änderungen zu erkennen.
- Öffentliche Medienzugriffe prüfen den zugehörigen Datensatz bei jeder Anfrage;
  Entwürfe und archivierte Dateien sind auch mit bekanntem Direktlink gesperrt.
  Admin-Vorschauen verwenden die vorhandene Authentifizierung. Videos unterstützen
  Byte-Range-Anfragen. JSON-Datensätze sind über die Medienroute nicht abrufbar.

Lokale Prüfung mit der vorhandenen Node.js-Umgebung: im Ordner `worker/`
`npm test -- --run`. Die Umsetzung wurde ausschließlich lokal geändert und geprüft.
Prüfbericht und Screenshots: [`../../docs/online-project-media.md`](../../docs/online-project-media.md).

Die wiederholbare Browserprüfung liegt in `worker/scripts/check-online-project-media.mjs`.
Sie verwendet ausschließlich einen lokalen HTTP-Server auf Port 4173, Testdaten und
einen Speicher im Arbeitsspeicher. Zum Ausführen werden optional `playwright-core`
und `axe-core` benötigt, z. B. lokal im Ordner `worker/` über
`npm install --no-save --package-lock=false playwright-core@1.55.1 axe-core@4.10.3`.
Anschließend `node scripts/check-online-project-media.mjs` ausführen. Unter Windows
wird ein vorhandenes Edge verwendet; alternativ `MIROKIT_BROWSER_PATH` auf eine
Chromium-/Chrome-Datei setzen. Die Prüfung erzeugt die Screenshots im Ordner `docs/`.

## Gallery folder workflow

The normal **Gallery** tab accepts multiple files together with a folder name,
an optional validated slug and optional subtitles. Choose **Neuen Ordner anlegen**
for a new folder or select an existing folder to append files. Each file is first stored privately under
`gallery/pending/<folder-slug>/`; it is not included in the public Gallery
response. The admin list groups these pending items and provides authenticated
previews through `/api/v1/admin/media/...`.

Use **Ordner veröffentlichen** only after reviewing the complete group. The
button calls `POST /api/v1/admin/gallery/publish` with up to 100 pending keys.
The Worker moves the objects to `gallery/<folder-slug>/`, marks them
`published`, and exposes the folder through the public `folders` response. A
batch is deliberately not a D1 transaction, so a partial storage failure must
be reviewed in the admin list before retrying or deleting items.

The public Gallery opens folders with `?folder=<slug>` and provides a back
control to the folder list. Online Projects photos remain a separate immediate-
publication workflow and do not use this pending folder path. Folder images can
be reordered in the editor; the order is persisted through
`POST /api/v1/admin/gallery/reorder` and is limited to one normal Gallery folder
per request.
