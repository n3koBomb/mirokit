# MIRoKIT asset structure

Use this folder layout when adding new media:

- `brand/` - MIRoKIT logos and core identity images.
- `backgrounds/` - decorative and section background images, including photo/video thumbnails.
- `logos/sections/` - section header logos.
- `images/news/` - images used by news cards.
- `images/partners/` - partner organization logos.
- `images/illustrations/` - explanatory artwork for World, game principles and age groups.
- `media/photos/events/` - event photo sets.
- `media/photos/projects/` - project-specific photo sets.
- `media/photos/team/` - team and backstage photos.
- `media/videos/events/` - event videos.
- `media/videos/interviews/` - interview videos.
- `media/videos/trailers/` - short teaser and trailer videos.
- `media/videos/posters/` - video poster images.
- `media/videos/subtitles/` - `.vtt` subtitle files for videos.
- `media/interviews/portraits/` - interview guest portraits.
- `media/interviews/audio/` - audio-only interviews.
- `media/interviews/transcripts/` - interview transcript files.
- `media/press/` - press photos and media-kit files.
- `documents/posters/` - poster-like document images already used by the site.
- `downloads/documents/` - downloadable PDFs and documents.
- `downloads/forms/` - downloadable forms.
- `downloads/methodology/` - methodical material downloads.
- `downloads/certificates/` - certificate templates or examples.
- `archive/` - raw exports, ZIP files, and source material that should not be linked directly from the page.
- `uploads/incoming/` - temporary holding folder for unsorted incoming files.

## Placement and URL rules

- Keep image files out of the `assets/` root. Sort by purpose, not file format.
- `brand/mirokit-wordmark.png` is the formerly UUID-named brand image.
- Static gallery photos belong in `media/photos/`; explanatory graphics belong in `images/illustrations/`.
- Section-logo variants stay in `logos/sections/`; unused copy exports belong in `archive/`.
- Browser URLs start with `/public/assets/`. `site/` is the document root, not part of the deployed URL.
- Favicons live in `../favicon/`; the site manifest is `../site.webmanifest`.
- Update HTML, deferred `data-src` / `data-deferred-background` attributes and JavaScript data together when moving files.
- Retain old published image URLs in `site/_redirects`, since content stored outside the repository can still reference them.
- Admin uploads are served through `/media/v1/` and are managed by the backend; do not move those into this static folder.
- `archive/`, `uploads/`, interview transcripts and press source material are excluded by `site/.assetsignore`.

Intentional empty image/video placeholders in HTML remain empty.
