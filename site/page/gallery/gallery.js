/* global T, currentLang, setLang */
const $ = (id) => document.getElementById(id);
const t = (key) => T[currentLang]?.[key] || T.en[key] || key;
const local = (item, field) => item?.[field]?.[currentLang] || item?.[field]?.en || item?.[field]?.ru || item?.[field]?.de || '';
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const grid = $('galleryGrid');
const dialog = $('galleryViewer');
const stage = $('galleryStage');
const viewerMeta = $('galleryViewerMeta');
const search = $('gallerySearch');
const suggestions = $('gallerySuggestions');
const sort = $('gallerySort');
const resources = { photos: { state: 'idle', items: [], folders: [], quotes: [] }, video: { state: 'idle', items: [] } };
let view = 'photos';
let visible = [];
let visibleFolders = [];
let activeFolder = '';
let limit = 24;
let selected = null;
let selectedQuote = null;
let selectedQuoteId = '';
let returnFocus = null;
let previousOverflow = '';
let activePlayer = null;

// Bundled archive photos remain available when no remote images have been published.
const archive = [
  ['/public/assets/images/news/online-course_painting_01-08-26.png', 'photo_story_1', 'photo_alt_1'],
  ['/public/assets/media/photos/events/events_example.webp', 'photo_story_2', 'photo_alt_2'],
  ['/public/assets/media/photos/team/team-run.png', 'photo_story_3', 'photo_alt_3'],
  ['/public/assets/media/photos/events/example.png', 'photo_story_4', 'photo_alt_4'],
].map(([image, titleKey, altKey], index) => ({
  id: `archive-${index + 1}`,
  image,
  titleKey,
  altKey,
  bundled: true,
  featured: index === 0
}));

function mediaUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';

  try {
    const url = new URL(value, location.origin);

    if (url.username || url.password) return '';

    return url.protocol === 'https:' ||
      (url.origin === location.origin && url.protocol === 'http:')
      ? url.href
      : '';
  } catch {
    return '';
  }
}

function youtubeUrl(value) {
  const safe = mediaUrl(value);

  if (!safe) return '';

  const url = new URL(safe);

  if (
    ![
      'www.youtube.com',
      'youtube.com',
      'www.youtube-nocookie.com',
      'youtube-nocookie.com'
    ].includes(url.hostname) ||
    !/^\/embed\/[\w-]{11}$/.test(url.pathname)
  ) {
    return '';
  }

  url.hostname = 'www.youtube-nocookie.com';

  return url.href;
}

function title(item) {
  return item.titleKey
    ? t(item.titleKey)
    : local(item, 'title') || 'MIRoKIT';
}

function subtitle(item) {
  return item.bundled
    ? t('ga_archive')
    : local(item, 'subtitle') || local(item, 'description');
}

function folderTitle(folder) {
  return local(folder, 'title') ||
    (typeof folder?.title === 'string' ? folder.title : '') ||
    folder?.folderTitle ||
    'MIRoKIT';
}

function folderSubtitle(folder) {
  return local(folder, 'subtitle') ||
    folder?.folderSubtitle ||
    '';
}

function alt(item) {
  return item.altKey
    ? t(item.altKey)
    : local(item, 'alt') || title(item);
}

function duration(value) {
  if (!Number.isFinite(value) || value <= 0) return '';

  const seconds = Math.round(value);

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function urlFor(nextView = view) {
  const url = new URL(location.href);

  url.searchParams.set('view', nextView);
  url.searchParams.set('lang', currentLang);

  const query = !activeFolder && search.value.trim();

  if (query) {
    url.searchParams.set('q', query);
  } else {
    url.searchParams.delete('q');
  }

  if (!activeFolder && sort.value !== 'featured') {
    url.searchParams.set('sort', sort.value);
  } else {
    url.searchParams.delete('sort');
  }

  if (view === 'photos' && activeFolder) {
    url.searchParams.set('folder', activeFolder);
  } else {
    url.searchParams.delete('folder');
  }

  return url.pathname + url.search + url.hash;
}

function syncLinks() {
  document.querySelectorAll('[data-view]').forEach((link) => {
    link.href = urlFor(link.dataset.view);

    if (link.dataset.view === view) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });

  document
    .querySelectorAll('a[href^="/page/onlineProjects/"]')
    .forEach((link) => {
      const url = new URL(link.href);

      url.searchParams.set('lang', currentLang);
      link.href = url.pathname + url.search;
    });
}

function readLocation() {
  const params = new URLSearchParams(location.search);

  view = params.get('view') === 'video'
    ? 'video'
    : 'photos';

  search.value = view === 'photos' && params.get('folder')
    ? ''
    : (params.get('q') || '').slice(0, 200);

  sort.value = ['featured', 'newest', 'title'].includes(params.get('sort'))
    ? params.get('sort')
    : 'featured';

  activeFolder = view === 'photos'
    ? params.get('folder') || ''
    : '';

  if (
    ['ru', 'en', 'de'].includes(params.get('lang')) &&
    currentLang !== params.get('lang')
  ) {
    setLang(params.get('lang'));
  }

  limit = 24;
}

function renderQuote() {
  const showQuote = view === 'photos' && Boolean(activeFolder) && Boolean(selectedQuote);
  $('galleryQuote').hidden = !showQuote;
  $('galleryQuoteText').textContent = selectedQuote
    ? local(selectedQuote, 'quote')
    : t('gallery_quote');

  $('galleryQuoteBy').textContent = selectedQuote
    ? local(selectedQuote, 'byline')
    : t('gallery_quote_by');
}

function syncFolderControls() {
  const inFolder = view === 'photos' && Boolean(activeFolder);
  $('gallerySearch').closest('.ga-search-wrap').hidden = inFolder;
  $('gallerySort').closest('.ga-sort').hidden = inFolder;
  $('galleryClear').hidden = inFolder || !search.value.trim();
  document.querySelector('.ga-library').classList.toggle('is-folder-view', inFolder);
}

function renderSuggestions() {
  const active = document.activeElement === search;

  const items = active
    ? (
      view === 'photos' && !activeFolder
        ? visibleFolders.slice(0, 3)
        : visible.slice(0, 3)
    )
    : [];

  suggestions.innerHTML = items
    .map((item, index) => `
      <button
        type="button"
        role="option"
        class="ga-search-suggestion"
        data-suggestion-index="${index}"
      >
        <span>
          ${escape(
      view === 'photos' && !activeFolder
        ? t('ga_collection')
        : view === 'photos'
          ? t('ga_photos')
          : t('ga_videos')
    )}
        </span>
        <strong>
          ${escape(
      view === 'photos' && !activeFolder
        ? folderTitle(item)
        : title(item)
    )}
        </strong>
      </button>
    `)
    .join('');

  suggestions.hidden = !items.length;
  search.setAttribute('aria-expanded', String(Boolean(items.length)));
}

function render() {
  syncLinks();

  const resource = resources[view];
  const loading = ['idle', 'loading'].includes(resource.state);
  const bundled = view === 'photos' && !resource.items.length && !loading;
  const items = bundled ? archive : resource.items;

  const query = !activeFolder
    ? search.value
    .trim()
    .toLocaleLowerCase(currentLang)
    : '';

  const folders = view === 'photos'
    ? (
      resource.folders.length
        ? resource.folders
        : [{
          slug: 'archive',
          title: {
            ru: t('ga_archive'),
            en: t('ga_archive'),
            de: t('ga_archive')
          },
          subtitle: {
            ru: '',
            en: '',
            de: ''
          },
          cover: archive[0]?.image,
          count: archive.length,
          images: archive
        }]
    )
    : [];

  const folder = folders.find(
    (candidate) => candidate.slug === activeFolder
  );

  if (view === 'photos' && activeFolder && !folder) {
    activeFolder = '';
  }

  visibleFolders =
    view === 'photos' && !activeFolder
      ? folders
        .filter((item) =>
          `${folderTitle(item)} ${folderSubtitle(item)}`
            .toLocaleLowerCase(currentLang)
            .includes(query)
        )
        .sort((a, b) => {
          if (sort.value === 'title') {
            return folderTitle(a).localeCompare(
              folderTitle(b),
              currentLang
            );
          }

          const aDate = a.images?.[0]?.uploadedAt || '';
          const bDate = b.images?.[0]?.uploadedAt || '';

          return String(bDate).localeCompare(String(aDate));
        })
      : [];

  visible = (
    view === 'photos' && activeFolder
      ? folder?.images || []
      : view === 'photos'
        ? []
        : items
  )
    .filter((item) => activeFolder || `${title(item)} ${subtitle(item)}`
      .toLocaleLowerCase(currentLang)
      .includes(query))
    .sort((a, b) => {
      if (sort.value === 'title') {
        return title(a).localeCompare(title(b), currentLang);
      }

      if (
        sort.value === 'featured' &&
        Boolean(a.featured) !== Boolean(b.featured)
      ) {
        return Number(Boolean(b.featured)) -
          Number(Boolean(a.featured));
      }

      if (
        view === 'video' &&
        sort.value === 'featured' &&
        a.sortOrder !== b.sortOrder
      ) {
        return (a.sortOrder || 0) -
          (b.sortOrder || 0);
      }

      return String(
        b.uploadedAt || b.createdAt || ''
      ).localeCompare(
        String(a.uploadedAt || a.createdAt || '')
      );
    });

  renderSuggestions();
  syncFolderControls();

  const folderQuotes = activeFolder
    ? (resource.quotes || []).filter((quote) => quote.folderSlug === activeFolder)
    : [];
  if (!folderQuotes.some((quote) => quote.id === selectedQuoteId)) {
    selectedQuote = folderQuotes.length
      ? folderQuotes[Math.floor(Math.random() * folderQuotes.length)]
      : null;
    selectedQuoteId = selectedQuote?.id || '';
  } else {
    selectedQuote = folderQuotes.find((quote) => quote.id === selectedQuoteId) || null;
  }
  renderQuote();

  const count =
    view === 'photos' && !activeFolder
      ? visibleFolders.length
      : visible.length;

  $('galleryCollectionTitle').textContent =
    view === 'photos' && activeFolder
      ? folderTitle(folder)
      : t('ga_discover');

  $('galleryCollectionTitle').removeAttribute('data-key');
  $('galleryCollectionSubtitle').textContent = view === 'photos' && activeFolder
    ? folderSubtitle(folder)
    : t('ga_library_intro');
  $('galleryCollectionSubtitle').hidden = !$('galleryCollectionSubtitle').textContent;

  $('galleryBack').hidden =
    view !== 'photos' || !activeFolder;

  $('galleryCount').textContent =
    loading
      ? t('op_library_loading')
      : `${count} ${t(
        view === 'photos' && !activeFolder
          ? 'ga_folder_count'
          : view === 'photos'
            ? 'ga_photos'
            : 'ga_videos'
      )
      }`;

  $('galleryClear').hidden = !query;

  $('galleryStatus').hidden =
    loading ||
    (resource.state !== 'error' && count > 0);

  $('galleryStatusText').textContent =
    t(
      resource.state === 'error'
        ? 'ga_load_error'
        : query
          ? 'ga_no_results'
          : 'ga_empty_video'
    );

  $('galleryRetry').hidden =
    resource.state !== 'error';

  grid.setAttribute('aria-busy', String(loading));

  $('galleryMore').hidden =
    loading ||
    count <= limit ||
    (view === 'photos' && !activeFolder);

  if (loading) {
    grid.innerHTML =
      '<div class="ga-skeleton" aria-hidden="true"></div>'
        .repeat(6);

    return;
  }

  if (view === 'photos' && !activeFolder) {
    grid.innerHTML = visibleFolders
      .slice(0, limit)
      .map((folderItem) => {
        const cover = mediaUrl(folderItem.cover);

        return `
          <article class="ga-card ga-folder-card">
            <button
              class="ga-card-button"
              type="button"
              data-folder-slug="${escape(folderItem.slug)}"
              aria-label="${escape(
          `${t('gallery_open')}: ${folderTitle(folderItem)}`
        )}"
            >
              <span class="ga-folder-art">
                <span
                  class="ga-folder-ground"
                  aria-hidden="true"
                ></span>

                <span
                  class="ga-folder-back"
                  aria-hidden="true"
                >
                  <span class="ga-folder-back-shine"></span>
                </span>

                <span
                  class="ga-folder-papers"
                  aria-hidden="true"
                >
                  <span class="ga-folder-paper ga-folder-paper-back"></span>
                  <span class="ga-folder-paper ga-folder-paper-middle"></span>

                  <span class="ga-folder-paper ga-folder-photo">
                    ${cover
            ? `
                          <img
                            src="${escape(cover)}"
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        `
            : '<span class="ga-folder-photo-fallback"></span>'
          }
                  </span>
                </span>

                <span
                  class="ga-folder-front"
                  aria-hidden="true"
                >
                  <span class="ga-folder-edge"></span>

                  <span class="ga-folder-label">
                    <i></i>
                    <i></i>
                    <i></i>
                  </span>

                  <span class="ga-folder-gloss"></span>
                </span>
              </span>

              <span class="ga-card-copy">
                <small class="ga-folder-label-text">${escape(t('ga_folder_label'))}</small>
                <strong>${escape(folderTitle(folderItem))}</strong>
                <small>${escape(folderSubtitle(folderItem) || `${folderItem.count} ${t('ga_folder_count')}`)}</small>
              </span>
            </button>
          </article>
        `;
      })
      .join('');

    grid
      .querySelectorAll('.ga-folder-photo img')
      .forEach((image) => {
        image.addEventListener(
          'error',
          () => image.remove(),
          { once: true }
        );
      });

    return;
  }

  grid.innerHTML = visible
    .slice(0, limit)
    .map((item, index) => {
      const image = item.image || item.poster;
      const time = duration(item.durationSeconds);

      const fallback =
        !image && view === 'video'
          ? `
            <span class="ga-card-placeholder">
              <span aria-hidden="true">▷</span>
              <strong>${escape(title(item))}</strong>
            </span>
          `
          : '';

      const inFolder = view === 'photos' && activeFolder;
      return `
        <article class="ga-card">
          <button
            class="ga-card-button"
            type="button"
            data-index="${index}"
            aria-haspopup="dialog"
            aria-label="${escape(
        inFolder ? `${t('gallery_open')}: ${t('ga_photos')} ${index + 1}` : `${t('gallery_open')}: ${title(item)}`
      )}"
          >
            <span class="ga-card-media">
              ${image
          ? `
                    <img
                      src="${escape(image)}"
                      alt="${escape(alt(item))}"
                      loading="${index < 6 ? 'eager' : 'lazy'}"
                      decoding="async"
                    />
                  `
          : fallback
        }

              ${!inFolder && item.featured
          ? `
                    <span class="ga-featured">
                      ${escape(t('ga_selected'))}
                    </span>
                  `
          : ''
        }

              ${time
          ? `<span class="ga-duration">${time}</span>`
          : ''
        }

              <span
                class="ga-card-icon"
                aria-hidden="true"
              >
                ${view === 'video' ? '▷' : '↗'}
              </span>
            </span>

            ${inFolder ? '' : '<span class="ga-card-copy">'}
              ${inFolder ? '' : `
              <small>
                ${escape(
          subtitle(item) ||
          t(
            view === 'photos'
              ? 'photo_stories'
              : 'video_library'
          )
        )}
              </small>

              <strong>${escape(title(item))}</strong>
            </span>`}
          </button>
        </article>
      `;
    })
    .join('');

  grid.querySelectorAll('img').forEach((img) => {
    img.addEventListener(
      'error',
      () => img.classList.add('is-broken'),
      { once: true }
    );
  });
}

async function load(kind, retry = false) {
  const resource = resources[kind];

  if (
    resource.state === 'loading' ||
    (!retry && resource.state !== 'idle')
  ) {
    return;
  }

  resource.state = 'loading';

  if (view === kind) {
    render();
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    15000
  );

  try {
    const response = await fetch(
      kind === 'photos'
        ? '/api/v1/gallery?collection=gallery'
        : '/api/v1/videos',
      {
        headers: {
          Accept: 'application/json'
        },
        cache: 'no-store',
        signal: controller.signal
      }
    );

    if (!response.ok) {
      throw new Error(`Media API: ${response.status}`);
    }

    const data = await response.json();
    const items =
      kind === 'photos'
        ? data.gallery
        : data.videos;

    if (
      data.success === false ||
      !Array.isArray(items)
    ) {
      throw new Error('Invalid media response');
    }

    if (kind === 'photos') {
      resource.items = items
        .filter((item) =>
          item &&
          item.collection === 'gallery' &&
          item.status === 'published' &&
          mediaUrl(item.image)
        )
        .map((item) => ({
          ...item,
          id: item.key,
          image: mediaUrl(item.image)
        }));

      resource.folders = (
        Array.isArray(data.folders)
          ? data.folders
          : []
      )
        .map((folder) => ({
          ...folder,
          cover: mediaUrl(folder.cover),
          images: Array.isArray(folder.images)
            ? folder.images
              .filter((item) => mediaUrl(item.image))
              .map((item) => ({
                ...item,
                id: item.key,
                image: mediaUrl(item.image)
              }))
            : []
        }))
        .filter((folder) =>
          folder.slug &&
          folder.images.length
        );

      if (
        !resource.folders.length &&
        resource.items.length
      ) {
        const groups = new Map();

        for (const item of resource.items) {
          const slug =
            item.folderSlug || 'uncategorized';

          if (!groups.has(slug)) {
            groups.set(slug, {
              slug,
              title: {
                ru: item.folderTitle || title(item),
                en: item.folderTitle || title(item),
                de: item.folderTitle || title(item)
              },
              subtitle: {
                ru: item.folderSubtitle || '',
                en: item.folderSubtitle || '',
                de: item.folderSubtitle || ''
              },
              cover: item.image,
              count: 0,
              images: []
            });
          }

          const folder = groups.get(slug);

          folder.count += 1;
          folder.images.push(item);
        }

        resource.folders = [...groups.values()];
      }

      const quotes = Array.isArray(data.quotes)
        ? data.quotes.filter((quote) => quote?.quote)
        : [];
      resource.quotes = quotes;
      selectedQuote = null;
      selectedQuoteId = '';
    } else {
      resource.items = items
        .filter((item) =>
          item &&
          item.translations &&
          (
            item.sourceType === 'youtube'
              ? youtubeUrl(
                item.embedUrl ||
                item.sourceUrl
              )
              : mediaUrl(item.sourceUrl)
          )
        )
        .map((item) => ({
          ...item,
          sourceUrl: mediaUrl(item.sourceUrl),
          embedUrl: youtubeUrl(
            item.embedUrl || item.sourceUrl
          ),
          poster: mediaUrl(item.poster),
          ...Object.fromEntries(
            ['title', 'description', 'alt']
              .map((field) => [
                field,
                Object.fromEntries(
                  ['ru', 'en', 'de'].map((lang) => [
                    lang,
                    item.translations[lang]?.[field] || ''
                  ])
                )
              ])
          )
        }));
    }

    resource.state = 'ready';
  } catch {
    resource.state = 'error';
  } finally {
    clearTimeout(timeout);

    if (view === kind) {
      render();
    }
  }
}

function clearStage() {
  activePlayer?.destroy();
  activePlayer = null;

  stage
    .querySelector('iframe')
    ?.removeAttribute('src');

  stage.replaceChildren();
}

function viewerCopy() {
  if (!selected) return;

  const index = visible.indexOf(selected);

  $('galleryViewerTitle').textContent =
    title(selected);

  $('galleryViewerDescription').textContent =
    subtitle(selected);

  const metadata =
    view === 'video'
      ? [
        duration(selected.durationSeconds),
        selected.width && selected.height
          ? `${selected.width} × ${selected.height}`
          : '',
        selected.sourceType === 'youtube'
          ? 'YouTube'
          : selected.sourceType === 'r2'
            ? 'R2 / HTML5'
            : 'HTML5'
      ]
        .filter(Boolean)
        .join(' · ')
      : '';

  viewerMeta.textContent = metadata;
  viewerMeta.hidden = !metadata;

  const quote = local(selected, 'quote');

  $('galleryViewerQuote').textContent = quote;
  $('galleryViewerQuote').hidden = !quote;

  $('galleryViewerCount').textContent =
    `${index + 1} / ${visible.length}`;

  $('galleryPrevious').disabled =
    $('galleryNext').disabled =
    visible.length < 2;

  $('galleryOriginal').href =
    selected.image || selected.sourceUrl;

  const img = stage.querySelector('img');

  if (img) {
    img.alt = alt(selected);
  }

  const iframe = stage.querySelector('iframe');

  if (iframe) {
    iframe.title = title(selected);
  }
}

function formatTime(value) {
  if (!Number.isFinite(value) || value < 0) {
    return '00:00';
  }

  const seconds = Math.floor(value);

  return `${Math.floor(seconds / 60)}:${String(
    seconds % 60
  ).padStart(2, '0')}`;
}

function createControlButton(label, control, text) {
  const button = document.createElement('button');

  button.type = 'button';
  button.dataset.videoControl = control;
  button.setAttribute('aria-label', label);
  button.textContent = text;

  return button;
}

function createHtml5Player(item) {
  const player = document.createElement('div');

  player.className = 'ga-video-player';

  const mediaStage = document.createElement('div');

  mediaStage.className = 'ga-video-stage';

  const video = document.createElement('video');

  video.className = 'ga-video-element';
  video.playsInline = true;
  video.preload = 'metadata';
  video.tabIndex = 0;
  video.poster = item.poster || '';
  video.src = item.sourceUrl;

  mediaStage.append(video);

  const feedback = document.createElement('span');

  feedback.className = 'ga-video-feedback';
  feedback.setAttribute('aria-hidden', 'true');

  mediaStage.append(feedback);
  player.append(mediaStage);

  const controls = document.createElement('div');

  controls.className = 'ga-video-controls';
  controls.setAttribute(
    'aria-label',
    'Video controls'
  );

  const play = createControlButton(
    'Play or pause video',
    'play',
    '▶'
  );

  const time = document.createElement('span');

  time.dataset.videoControl = 'time';

  const seekWrap = document.createElement('span');

  seekWrap.className = 'ga-video-seek';

  const seek = document.createElement('input');

  seek.type = 'range';
  seek.min = '0';
  seek.max = '100';
  seek.step = '0.1';
  seek.value = '0';
  seek.dataset.videoControl = 'seek';
  seek.setAttribute(
    'aria-label',
    'Video position'
  );

  seekWrap.append(seek);

  const mute = createControlButton(
    'Mute or unmute video',
    'mute',
    '🔊'
  );

  const volumeWrap = document.createElement('span');

  volumeWrap.className = 'ga-video-volume-control';

  const volume = document.createElement('input');

  volume.type = 'range';
  volume.min = '0';
  volume.max = '1';
  volume.step = '0.05';
  volume.value = '1';
  volume.dataset.videoControl = 'volume';
  volume.setAttribute('aria-label', 'Volume');

  const volumeOutput = document.createElement('output');

  volumeOutput.dataset.videoControl =
    'volume-percent';
  volumeOutput.textContent = '100%';

  volumeWrap.append(volume, volumeOutput);

  const captions = createControlButton(
    'Turn subtitles on or off',
    'captions',
    'CC'
  );

  captions.className = 'ga-video-captions';
  captions.setAttribute('aria-pressed', 'false');

  const settings = createControlButton(
    'Subtitle settings',
    'settings',
    '⚙'
  );

  settings.setAttribute('aria-expanded', 'false');

  const fullscreen = createControlButton(
    'Open fullscreen',
    'fullscreen',
    '⛶'
  );

  controls.append(
    play,
    time,
    seekWrap,
    mute,
    volumeWrap,
    captions,
    settings,
    fullscreen
  );

  const settingsPanel = document.createElement('div');

  settingsPanel.className = 'ga-video-settings';
  settingsPanel.hidden = true;

  const settingsTitle = document.createElement('strong');

  settingsTitle.textContent = 'Subtitles';

  const settingsLabel = document.createElement('label');

  settingsLabel.textContent = 'Language';

  const trackSelect = document.createElement('select');

  trackSelect.setAttribute(
    'aria-label',
    'Subtitle language'
  );

  const offOption = document.createElement('option');

  offOption.value = '';
  offOption.textContent = 'Subtitles off';

  trackSelect.append(offOption);

  settingsPanel.append(
    settingsTitle,
    settingsLabel,
    trackSelect
  );

  player.append(controls, settingsPanel);
  stage.append(player);

  const tracks = [];

  for (const subtitle of item.subtitles || []) {
    const src = mediaUrl(subtitle.src);

    if (!src) continue;

    const track = document.createElement('track');

    track.kind = 'subtitles';
    track.src = src;
    track.srclang =
      subtitle.srcLang ||
      subtitle.language ||
      'en';
    track.label =
      subtitle.label ||
      track.srclang.toUpperCase();
    track.default = Boolean(subtitle.isDefault);

    video.append(track);
    tracks.push(track);

    const option = document.createElement('option');

    option.value = String(tracks.length - 1);
    option.textContent = track.label;

    trackSelect.append(option);
  }

  let feedbackTimer = 0;
  let lastVolume = 1;
  let selectedTrack = tracks.findIndex(
    (track) => track.default
  );

  const setTrack = (index) => {
    const validIndex =
      Number.isInteger(index) &&
        index >= 0 &&
        index < tracks.length
        ? index
        : -1;

    tracks.forEach((track, trackIndex) => {
      if (track.track) {
        track.track.mode =
          trackIndex === validIndex
            ? 'showing'
            : 'disabled';
      }
    });

    selectedTrack = validIndex;

    trackSelect.value =
      validIndex < 0
        ? ''
        : String(validIndex);

    captions.disabled = !tracks.length;
    settings.disabled = !tracks.length;

    captions.classList.toggle(
      'is-active',
      validIndex >= 0
    );

    captions.setAttribute(
      'aria-pressed',
      String(validIndex >= 0)
    );
  };

  const showFeedback = (text) => {
    window.clearTimeout(feedbackTimer);

    feedback.textContent = text;
    feedback.classList.remove('is-visible');

    void feedback.offsetWidth;

    feedback.classList.add('is-visible');

    feedbackTimer = window.setTimeout(
      () => feedback.classList.remove('is-visible'),
      650
    );
  };

  const sync = () => {
    const total = Number.isFinite(video.duration)
      ? video.duration
      : 0;

    const current = Number.isFinite(video.currentTime)
      ? video.currentTime
      : 0;

    seek.max = String(total || 100);
    seek.value = String(
      Math.min(current, total || 100)
    );

    time.textContent =
      `${formatTime(current)} / ${formatTime(total)}`;

    play.textContent = video.paused
      ? '▶'
      : '❚❚';

    play.setAttribute(
      'aria-label',
      video.paused
        ? 'Play video'
        : 'Pause video'
    );

    const percent = Math.round(
      Math.max(
        0,
        Math.min(
          1,
          video.muted
            ? 0
            : video.volume
        )
      ) * 100
    );

    volume.value = String(video.volume);
    volumeOutput.textContent = `${percent}%`;

    mute.textContent =
      video.muted || video.volume === 0
        ? '🔇'
        : '🔊';

    mute.setAttribute(
      'aria-label',
      video.muted || video.volume === 0
        ? 'Unmute video'
        : 'Mute video'
    );

    seek.style.setProperty(
      '--range-fill',
      `${total ? (current / total) * 100 : 0}%`
    );

    volume.style.setProperty(
      '--range-fill',
      `${percent}%`
    );
  };

  const togglePlayback = () => {
    const playback = video.paused
      ? video.play()
      : (video.pause(), null);

    playback?.catch(() => showFeedback('▶'));
  };

  play.addEventListener(
    'click',
    togglePlayback
  );

  video.addEventListener(
    'click',
    togglePlayback
  );

  video.addEventListener(
    'keydown',
    (event) => {
      if (
        event.key === ' ' ||
        event.key === 'Enter'
      ) {
        event.preventDefault();
        togglePlayback();
      }
    }
  );

  seek.addEventListener(
    'input',
    () => {
      video.currentTime = Number(seek.value);
      sync();
    }
  );

  mute.addEventListener(
    'click',
    () => {
      video.muted = !video.muted;

      if (
        !video.muted &&
        video.volume === 0
      ) {
        video.volume = lastVolume || 0.5;
      }

      sync();
    }
  );

  volume.addEventListener(
    'input',
    () => {
      video.volume = Number(volume.value);
      lastVolume =
        video.volume || lastVolume;
      video.muted = video.volume === 0;
      sync();
    }
  );

  captions.addEventListener(
    'click',
    () => {
      setTrack(
        selectedTrack >= 0
          ? -1
          : (
            tracks.findIndex(
              (track) => track.default
            ) >= 0
              ? tracks.findIndex(
                (track) => track.default
              )
              : 0
          )
      );
    }
  );

  settings.addEventListener(
    'click',
    () => {
      if (settings.disabled) return;

      settingsPanel.hidden =
        !settingsPanel.hidden;

      settings.setAttribute(
        'aria-expanded',
        String(!settingsPanel.hidden)
      );

      if (!settingsPanel.hidden) {
        trackSelect.focus();
      }
    }
  );

  trackSelect.addEventListener(
    'change',
    () => {
      setTrack(
        trackSelect.value === ''
          ? -1
          : Number(trackSelect.value)
      );
    }
  );

  fullscreen.addEventListener(
    'click',
    async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await player.requestFullscreen();
        }
      } catch {
        // Browser may deny fullscreen.
      }
    }
  );

  video.addEventListener(
    'loadedmetadata',
    () => {
      viewerMeta.textContent = [
        formatTime(video.duration),
        video.videoWidth &&
          video.videoHeight
          ? `${video.videoWidth} × ${video.videoHeight}`
          : '',
        'HTML5'
      ]
        .filter(Boolean)
        .join(' · ');

      viewerMeta.hidden = false;
      sync();
    }
  );

  [
    'timeupdate',
    'volumechange',
    'loadedmetadata',
    'ended'
  ].forEach((eventName) =>
    video.addEventListener(
      eventName,
      sync
    )
  );

  video.addEventListener(
    'play',
    () => {
      sync();
      showFeedback('▶');
    }
  );

  video.addEventListener(
    'pause',
    () => {
      sync();

      if (!video.ended) {
        showFeedback('❚❚');
      }
    }
  );

  video.addEventListener(
    'error',
    () => {
      $('galleryMediaError').hidden = false;
    }
  );

  setTrack(selectedTrack);
  sync();

  return {
    destroy() {
      window.clearTimeout(feedbackTimer);

      video.pause();
      video.removeAttribute('src');
      video.load();

      tracks.forEach((track) => track.remove());

      if (
        document.fullscreenElement === player
      ) {
        const exit = document.exitFullscreen?.();
        exit?.catch(() => { });
      }
    }
  };
}

function openMedia(index, trigger) {
  if (!visible.length) return;

  selected =
    visible[
    (index + visible.length) %
    visible.length
    ];

  clearStage();
  $('galleryMediaError').hidden = true;

  const failed = () => {
    $('galleryMediaError').hidden = false;
  };

  if (view === 'photos') {
    dialog.classList.add('ga-dialog--photo');
    const img = document.createElement('img');

    img.alt = alt(selected);
    img.addEventListener(
      'error',
      failed,
      { once: true }
    );

    img.src = selected.image;
    stage.append(img);
  } else if (selected.sourceType === 'youtube') {
    dialog.classList.remove('ga-dialog--photo');
    const iframe = document.createElement('iframe');

    iframe.title = title(selected);
    iframe.allow =
      'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy =
      'strict-origin-when-cross-origin';
    iframe.src = selected.embedUrl;

    stage.append(iframe);
  } else {
    dialog.classList.remove('ga-dialog--photo');
    activePlayer =
      createHtml5Player(selected);
  }

  viewerCopy();

  if (!dialog.open) {
    returnFocus =
      trigger || document.activeElement;

    previousOverflow =
      document.body.style.overflow;

    dialog.showModal();
    document.body.style.overflow = 'hidden';
    $('galleryClose').focus();
  }
}

$('galleryClose').addEventListener(
  'click',
  () => dialog.close()
);

$('galleryPrevious').addEventListener(
  'click',
  () => openMedia(
    visible.indexOf(selected) - 1
  )
);

$('galleryNext').addEventListener(
  'click',
  () => openMedia(
    visible.indexOf(selected) + 1
  )
);

dialog.addEventListener(
  'close',
  () => {
    dialog.classList.remove('ga-dialog--photo');
    clearStage();
    selected = null;
    document.body.style.overflow =
      previousOverflow;

    const index =
      returnFocus?.dataset.index;

    render();

    const target =
      index !== undefined
        ? grid.querySelector(
          `[data-index="${index}"]`
        )
        : returnFocus;

    if (target?.isConnected) {
      target.focus({
        preventScroll: true
      });
    }
  }
);

let backdrop = false;

dialog.addEventListener(
  'pointerdown',
  (event) => {
    backdrop =
      event.target === dialog;
  }
);

dialog.addEventListener(
  'click',
  (event) => {
    if (
      backdrop &&
      event.target === dialog
    ) {
      dialog.close();
    }
  }
);

dialog.addEventListener(
  'keydown',
  (event) => {
    // Keep native video seeking/volume keyboard shortcuts available.
    if (
      view === 'photos' &&
      ['ArrowLeft', 'ArrowRight'].includes(
        event.key
      )
    ) {
      event.preventDefault();

      openMedia(
        visible.indexOf(selected) +
        (
          event.key === 'ArrowLeft'
            ? -1
            : 1
        )
      );
    }
  }
);

let touch = null;

stage.addEventListener(
  'touchstart',
  (event) => {
    touch =
      view === 'photos' &&
        event.touches.length === 1
        ? {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY
        }
        : null;
  },
  { passive: true }
);

stage.addEventListener(
  'touchend',
  (event) => {
    if (
      !touch ||
      !event.changedTouches.length
    ) {
      return;
    }

    const dx =
      event.changedTouches[0].clientX -
      touch.x;

    const dy =
      event.changedTouches[0].clientY -
      touch.y;

    if (
      Math.abs(dx) > 60 &&
      Math.abs(dx) > Math.abs(dy) * 1.5
    ) {
      openMedia(
        visible.indexOf(selected) +
        (dx < 0 ? 1 : -1)
      );
    }

    touch = null;
  },
  { passive: true }
);

function openFolder(slug, trigger) {
  if (!slug) return;

  activeFolder = slug;
  limit = 24;
  search.value = '';

  history.pushState({}, '', urlFor());
  render();

  trigger?.focus();
}

grid.addEventListener(
  'click',
  (event) => {
    const folderButton =
      event.target.closest(
        '[data-folder-slug]'
      );

    if (folderButton) {
      openFolder(
        folderButton.dataset.folderSlug,
        folderButton
      );

      return;
    }

    const button =
      event.target.closest('[data-index]');

    if (button) {
      openMedia(
        Number(button.dataset.index),
        button
      );
    }
  }
);

grid.addEventListener(
  'pointermove',
  (event) => {
    if (event.pointerType === 'touch') {
      return;
    }

    const art =
      event.target.closest('.ga-folder-art');

    if (!art) return;

    const bounds =
      art.getBoundingClientRect();

    art.style.setProperty(
      '--ga-folder-rx',
      `${(
        (
          (event.clientY - bounds.top) /
          bounds.height
        ) - 0.5
      ) * -2.5}deg`
    );

    art.style.setProperty(
      '--ga-folder-ry',
      `${(
        (
          (event.clientX - bounds.left) /
          bounds.width
        ) - 0.5
      ) * 3.5}deg`
    );
  }
);

grid.addEventListener(
  'pointerout',
  (event) => {
    const art =
      event.target.closest('.ga-folder-art');

    if (
      !art ||
      (
        event.relatedTarget &&
        art.contains(event.relatedTarget)
      )
    ) {
      return;
    }

    art.style.removeProperty(
      '--ga-folder-rx'
    );

    art.style.removeProperty(
      '--ga-folder-ry'
    );
  }
);

$('galleryBack').addEventListener(
  'click',
  () => {
    activeFolder = '';
    history.pushState({}, '', urlFor());
    render();
  }
);

document
  .querySelector('.ga-tabs')
  .addEventListener(
    'click',
    (event) => {
      const link =
        event.target.closest('[data-view]');

      if (
        !link ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();

      view = link.dataset.view;
      activeFolder = '';
      limit = 24;

      history.pushState({}, '', urlFor());
      render();
      load(view);
    }
  );

search.addEventListener(
  'input',
  () => {
    limit = 24;
    history.replaceState({}, '', urlFor());
    render();
  }
);

search.addEventListener(
  'focus',
  renderSuggestions
);

search.addEventListener(
  'blur',
  () => window.setTimeout(
    renderSuggestions,
    120
  )
);

suggestions.addEventListener(
  'mousedown',
  (event) => event.preventDefault()
);

suggestions.addEventListener(
  'click',
  (event) => {
    const button =
      event.target.closest(
        '[data-suggestion-index]'
      );

    if (!button) return;

    suggestions.hidden = true;
    search.setAttribute(
      'aria-expanded',
      'false'
    );

    if (
      view === 'photos' &&
      !activeFolder
    ) {
      openFolder(
        visibleFolders[
          Number(button.dataset.suggestionIndex)
        ]?.slug,
        button
      );
    } else {
      openMedia(
        Number(button.dataset.suggestionIndex),
        button
      );
    }
  }
);

sort.addEventListener(
  'change',
  () => {
    limit = 24;
    history.replaceState({}, '', urlFor());
    render();
  }
);

$('galleryClear').addEventListener(
  'click',
  () => {
    search.value = '';
    search.dispatchEvent(
      new Event('input')
    );
    search.focus();
  }
);

$('galleryRetry').addEventListener(
  'click',
  () => load(view, true)
);

$('galleryMore').addEventListener(
  'click',
  () => {
    const previous = limit;

    limit += 24;
    render();

    grid
      .querySelector(
        `[data-index="${previous}"]`
      )
      ?.focus();
  }
);

window.addEventListener(
  'popstate',
  () => {
    if (dialog.open) {
      dialog.close();
    }

    readLocation();
    render();
    load(view);
  }
);

function syncTheme(theme) {
  const dark = theme === 'dark';

  document.documentElement.dataset.theme =
    dark ? 'dark' : 'light';

  document.body.classList.toggle(
    'theme-dark',
    dark
  );

  const button =
    document.querySelector(
      '[data-theme-toggle]'
    );

  button.setAttribute(
    'aria-pressed',
    String(dark)
  );

  button.setAttribute(
    'aria-label',
    t(
      dark
        ? 'theme_light'
        : 'theme_dark'
    )
  );

  button.querySelector(
    '.theme-toggle-label'
  ).textContent = t(
    dark
      ? 'theme_light'
      : 'theme_dark'
  );
}

document
  .querySelector('[data-theme-toggle]')
  .addEventListener(
    'click',
    () => {
      const theme =
        document.body.classList.contains(
          'theme-dark'
        )
          ? 'light'
          : 'dark';

      syncTheme(theme);

      try {
        localStorage.setItem(
          'mirokitTheme',
          theme
        );
      } catch {
        // Optional storage.
      }
    }
  );

readLocation();

try {
  syncTheme(
    localStorage.getItem('mirokitTheme')
  );
} catch {
  syncTheme('light');
}

document.addEventListener(
  'mirokit:languagechange',
  () => {
    document.title =
      `${t('menu_gallery')} — MIRoKIT`;

    history.replaceState(
      {},
      '',
      urlFor()
    );

    syncTheme(
      document.documentElement.dataset.theme
    );

    renderQuote();
    syncLinks();

    if (dialog.open) {
      viewerCopy();
    } else {
      render();
    }
  }
);

document.title =
  `${t('menu_gallery')} — MIRoKIT`;

render();
load(view);
