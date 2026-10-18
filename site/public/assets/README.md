# MIRoKIT assets

Reviewed against the local tree on **18 October 2026**. `site/` is the document root; browser URLs for this directory start with `/public/assets/`. Uploaded R2 media uses `/media/v1/` and is managed separately.

## Current layout

| Directory | Purpose |
| --- | --- |
| `brand/` | Core identity images, including `mirokit-wordmark.png` |
| `backgrounds/` | Decorative images and section/photo/video backgrounds |
| `logos/` | Shared multilingual section-logo SVG |
| `images/news/`, `images/partners/` | Bundled news pictures and partner logos |
| `images/illustrations/` | World/game/age-group illustrations, Programs and Three Bears artwork |
| `media/photos/events/`, `projects/`, `team/` | Event, project and team photos |
| `media/videos/events/`, `interviews/`, `trailers/` | Static video categories; some directories remain placeholders |
| `media/videos/posters/`, `subtitles/` | Static posters and WebVTT files |
| `media/interviews/portraits/`, `audio/`, `transcripts/` | Interview materials, with transcripts excluded from public assets |
| `media/press/` | Source press material, excluded from public assets |
| `documents/posters/` | Poster/document images used by the site |
| `downloads/documents/`, `forms/`, `methodology/`, `certificates/` | Public downloads grouped by purpose |
| `archive/` | Raw/source exports, excluded from public assets |
| `uploads/incoming/` | Unsorted incoming material, excluded from public assets |

A directory is an organizational location, not proof that it contains approved material or an implemented media feature. Keep intentional empty placeholders empty until real content is supplied.

## Shared section logos

Active landingpage section headers use `logos/multilingual-logo_without_below_text.svg`, loaded through the shared SVG source and the `data-section-logo` / `data-logo-key` slots in `site/index.html`. The previous `logos/sections/` layout is not the current tree.

Inspect every consumer before changing shared geometry, IDs or language groups. Changes can affect many section headers. Preserve existing header contracts and RU/EN/DE handling; do not treat one visible slot as an isolated image.

The five Programs images are `images/illustrations/programs-01.png` through `programs-05.png`. They are static assets loaded from the landingpage, not files controlled by a D1 editor.

## Moving and adding files

Group files by purpose, not just extension. Avoid adding loose image exports to the `assets/` root. Use meaningful names, required dimensions and appropriate alternate text; preserve supplied copy and valid existing references.

When moving files, update HTML, CSS URLs, JavaScript data, `data-src`, `data-svg-src`, object sources and deferred backgrounds together. Preserve published old URLs through `site/_redirects` when they can still be referenced by external content.

Favicons are in `../favicon/`, the manifest in `../site.webmanifest`; PDF.js is in `../vendor/pdfjs/`. Do not duplicate favicon sets inside the admin directory or move backend uploads into this folder.

## Publication and rights

Most files under `site/public/` are static deployment content and do not become private when a D1 record is archived. Use the controlled R2 workflow for unpublished media. Exclusion from the asset bundle does not remove a file from Git history or make a public repository private.

`site/.assetsignore` excludes `archive/`, `uploads/`, interview transcripts and press material. The production Worker-first configuration also routes these prefixes through a denial response. Local and production route configuration differ; test actual delivery when changing this boundary.

Clear rights and publication consent before adding photos, logos, documents or recordings, especially children's media. The project license does not replace third-party rights. Preserve embedded and adjacent notices; [PDF.js](../vendor/pdfjs/README.md) has separate third-party licenses.

## Verification

Check actual file existence, browser-relative URLs, decoded SVG/illustration rendering, loading/fallback behavior, mobile sizing and network delivery. `check-js.mjs` deliberately skips `public/`; passing it does not validate these assets. The documentation audit checked direct HTML asset references, not every CSS, dynamic or external media URL, visual state, binary integrity or rights record.
