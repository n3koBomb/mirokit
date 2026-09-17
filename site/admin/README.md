# MIRoKIT Content Desk

- `index.html`: editor shell and forms for News, Gallery, Online Projects, Videos, Projects, World Points and Partners.
- `admin.css`: editor presentation and responsive layout.
- `admin.js`: tab navigation, forms, uploads and API requests.
- `media-preview.js`: protected media URLs and authenticated local Blob previews.
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

## Online Projects workflow

1. Open the **Online-Projekte** tab and choose one of the ten image libraries.
2. Select an image file or provide a public Google Drive image URL. Add title, image description (alt text) and optional subtitle in RU, EN and DE.
3. Click **In „[Thema]“ veröffentlichen**, then **Bibliothek öffnen** to view the published image.

The public page `/page/onlineProjects/index.html?topic=drawing` opens a specific
library. Its theme navigation also includes all images. Existing online-project
images without a topic remain visible under **Alle Themen**; assign them in the
admin list using **Noch ohne Thema** and **Thema speichern**. Uploads keep the
selected library for the next image. The Gallery tab manages the separate normal
gallery and its quotes.

Topic IDs are shared by the page, admin and Worker in
`site/source/scripts/online-project-topics.js`. The Worker validates `topic` for
online-project uploads and stores it in R2 custom metadata. An authenticated
`PATCH /api/v1/admin/gallery/<encoded-key>` with `{ "topic": "drawing" }` changes
only the topic of an existing online-project image, preserving its bytes, other
metadata and publication status. No D1 migration is required.
