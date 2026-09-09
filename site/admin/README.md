# MIRoKIT Content Desk

- `index.html`: editor shell and forms for News, Gallery, Videos, World Points and Partners.
- `admin.css`: editor presentation and responsive layout.
- `admin.js`: tab navigation, forms, uploads and API requests.
- Shared icons: `/public/favicon/` (no duplicate icon files here).

Open `/admin/` through the local Worker (`cd worker` then `npm run dev` from the repository root). A static HTML server or `file://` cannot provide the `/api/v1/admin/` endpoints. Production access requires the configured Cloudflare Access identity; local API access uses the configured development token.

CSS and script URLs are rooted at `/admin/`. Stored relative image URLs in gallery previews resolve from the website root. Never include `site/` in deployed URLs.

## Video workflow

- YouTube records store a YouTube embed source and always use YouTube's own player controls.
- `external` records need a direct HTTPS media URL (MP4, WebM or OGG), not a Drive/Dropbox share page. The remote server must support browser playback, CORS and byte ranges.
- `r2` records use `/media/v1/videos/...` and are uploaded from the Videos panel (maximum 95 MB per video). The Worker serves these files with byte-range responses.
- Gallery images can be assigned to `Online-Projekte`; the Gallery panel accepts either a local image upload or a public Google Drive image URL. Drive images are imported into R2 before publication.
- Subtitle tracks are WebVTT. Add one or more tracks, upload or paste the VTT text, then use `Cues bearbeiten` with the preview player to set cue start/end times from the current video position.
- Duration and dimensions are filled from HTML5 `loadedmetadata` for direct/R2 sources. YouTube metadata is not scraped; enter a fallback duration if the YouTube API is not available.
- Save as draft first. Publishing makes the video visible at `/api/v1/videos`; archiving removes it from the public feed but does not delete the stored media automatically.
