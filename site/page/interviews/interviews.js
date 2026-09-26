/* global T, currentLang, setLang */
const $ = (id) => document.getElementById(id);

const copy = {
  ru: {
    skip: "Перейти к интервью", jump_label: "Разделы страницы интервью", materials_label: "Разделы материалов", nav_videos: "Разговоры", nav_materials: "Материалы", videos_kicker: "АРХИВ ИНТЕРВЬЮ", videos_title: "Слушайте людей за МИРоКИТ", videos_text: "Истории участников, партнёров и людей, которые помогают проекту расти.", loading: "Интервью загружаются…", no_interviews: "Архив интервью готов для первой опубликованной беседы.", no_videos: "В архиве пока нет опубликованных интервью. Новые разговоры появятся здесь после публикации.", load_error: "Архив интервью временно недоступен. Попробуйте ещё раз позже.", no_script: "Включите JavaScript, чтобы смотреть интервью.", materials_kicker: "ЧИТАТЬ · СКАЧАТЬ · ПОДЕЛИТЬСЯ", materials_title: "Материалы вокруг разговора", materials_text: "Полезные документы для участников, партнёров и СМИ. По мере роста архива здесь появятся новые материалы интервью.", material_tab_documents: "Документы", material_tab_brochures: "Проспекты", material_tab_forms: "Формуляры", material_tab_requests: "Запросы", material_document_label: "ДОКУМЕНТ", material_document_title: "Положение МИРоКИТ", material_document_text: "Актуальный документ проекта для знакомства и участия.", material_open: "Открыть документ ↗", brochures_title: "Проспекты появятся здесь", brochures_text: "Этот раздел подготовлен для проспектов и пресс-листов интервью.", forms_title: "Формуляры появятся здесь", forms_text: "Здесь можно будет разместить регистрационные и заявочные формы.", material_request_label: "ЗАПРОС", material_request_title: "Запрос на интервью", material_request_text: "Хотите предложить гостя, тему или разговор?", material_request_cta: "Связаться с командой ↗", footer_kicker: "МИРоКИТ / ДИАЛОГ", footer_title: "Каждый голос может открыть новую дверь.", footer_cta: "Поделиться историей ↗", video_label: "ИНТЕРВЬЮ"
  },
  en: {
    skip: "Skip to the interviews", jump_label: "Interview page sections", materials_label: "Interview material sections", nav_videos: "Conversations", nav_materials: "Materials", videos_kicker: "THE INTERVIEW ARCHIVE", videos_title: "Listen to the people behind MIRoKIT", videos_text: "Stories from participants, partners and the people who help the project grow.", loading: "Loading interviews…", no_interviews: "The interview archive is ready for its first published conversation.", no_videos: "There are no published interviews in the archive yet. New conversations will appear here after publication.", load_error: "The interview archive is temporarily unavailable. Please try again later.", no_script: "Please enable JavaScript to watch the interviews.", materials_kicker: "READ · DOWNLOAD · SHARE", materials_title: "Materials around the conversation", materials_text: "Useful documents for participants, partners and media. More interview materials can be added here as the archive grows.", material_tab_documents: "Documents", material_tab_brochures: "Brochures", material_tab_forms: "Forms", material_tab_requests: "Requests", material_document_label: "DOCUMENT", material_document_title: "MIRoKIT regulations", material_document_text: "The current project document for orientation and participation.", material_open: "Open document ↗", brochures_title: "Brochures will appear here", brochures_text: "This area is prepared for interview brochures and press sheets.", forms_title: "Forms will appear here", forms_text: "Registration and participation forms for interview projects can be added here.", material_request_label: "REQUEST", material_request_title: "Interview request", material_request_text: "Would you like to suggest a guest, topic or conversation?", material_request_cta: "Contact the team ↗", footer_kicker: "MIRoKIT / DIALOGUE", footer_title: "Every voice can open a new door.", footer_cta: "Share a story ↗", video_label: "INTERVIEW"
  },
  de: {
    skip: "Zu den Interviews springen", jump_label: "Bereiche der Interviewseite", materials_label: "Bereiche der Materialien", nav_videos: "Gespräche", nav_materials: "Materialien", videos_kicker: "DAS INTERVIEW-ARCHIV", videos_title: "Menschen hinter MIRoKIT zuhören", videos_text: "Geschichten von Teilnehmenden, Partnern und Menschen, die das Projekt wachsen lassen.", loading: "Interviews werden geladen…", no_interviews: "Das Interview-Archiv ist bereit für das erste veröffentlichte Gespräch.", no_videos: "Im Archiv gibt es noch keine veröffentlichten Interviews. Neue Gespräche erscheinen hier nach der Veröffentlichung.", load_error: "Das Interview-Archiv ist momentan nicht erreichbar. Bitte versuche es später erneut.", no_script: "Bitte aktiviere JavaScript, um Interviews anzusehen.", materials_kicker: "LESEN · HERUNTERLADEN · TEILEN", materials_title: "Materialien rund um das Gespräch", materials_text: "Nützliche Dokumente für Teilnehmende, Partner und Medien. Mit wachsendem Archiv kommen hier weitere Interviewmaterialien hinzu.", material_tab_documents: "Dokumente", material_tab_brochures: "Prospekte", material_tab_forms: "Formulare", material_tab_requests: "Anfragen", material_document_label: "DOKUMENT", material_document_title: "MIRoKIT-Bestimmungen", material_document_text: "Das aktuelle Projektdokument zur Orientierung und Teilnahme.", material_open: "Dokument öffnen ↗", brochures_title: "Prospekte erscheinen hier", brochures_text: "Dieser Bereich ist für Interviewprospekte und Presseblätter vorbereitet.", forms_title: "Formulare erscheinen hier", forms_text: "Hier können Anmelde- und Teilnahmeformulare für Interviewprojekte bereitgestellt werden.", material_request_label: "ANFRAGE", material_request_title: "Interview anfragen", material_request_text: "Du möchtest einen Gast, ein Thema oder ein Gespräch vorschlagen?", material_request_cta: "Team kontaktieren ↗", footer_kicker: "MIRoKIT / DIALOG", footer_title: "Jede Stimme kann eine neue Tür öffnen.", footer_cta: "Geschichte teilen ↗", video_label: "INTERVIEW"
  }
};

let interviews = [];
let materials = [];
let loading = false;
let failed = false;
const materialDefaults = new Map([...document.querySelectorAll('[data-material-panel]')].map((panel) => [panel.dataset.materialPanel, panel.innerHTML]));

function tr(key) { return copy[currentLang]?.[key] || copy.en[key] || key; }
function safeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, location.origin);
    if (url.username || url.password) return '';
    return url.protocol === 'https:' || (url.origin === location.origin && url.protocol === 'http:') ? url.href : '';
  } catch { return ''; }
}
function youtubeUrl(value) {
  const safe = safeUrl(value);
  if (!safe) return '';
  const url = new URL(safe);
  if (!['youtube.com', 'www.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(url.hostname) || !/^\/embed\/[\w-]{11}/.test(url.pathname)) return '';
  url.hostname = 'www.youtube-nocookie.com';
  return url.href;
}
function localized(item, field) { return item?.translations?.[currentLang]?.[field] || item?.translations?.en?.[field] || item?.translations?.ru?.[field] || ''; }
function duration(value) { if (!Number.isFinite(Number(value)) || Number(value) <= 0) return ''; const seconds = Math.round(Number(value)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }

function applyCopy() {
  document.querySelectorAll('[data-iv-key]').forEach((element) => {
    const value = tr(element.dataset.ivKey);
    element.textContent = value;
  });
  document.querySelectorAll('[data-iv-aria]').forEach((element) => element.setAttribute('aria-label', tr(element.dataset.ivAria)));
  document.title = `${currentLang === 'ru' ? 'Интервью' : currentLang === 'de' ? 'Interviews' : 'Interviews'} — MIRoKIT`;
  syncThemeButton();
}

function syncThemeButton() {
  const button = document.querySelector('[data-theme-toggle]');
  if (!button) return;
  const dark = document.body.classList.contains('theme-dark');
  const label = T[currentLang]?.[dark ? 'theme_light' : 'theme_dark'] || (dark ? 'Light theme' : 'Dark theme');
  button.setAttribute('aria-pressed', String(dark));
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  const labelNode = button.querySelector('.theme-toggle-label');
  if (labelNode) labelNode.textContent = label;
}

function renderVideoCard(item) {
  const source = safeUrl(item.sourceUrl);
  const embed = item.sourceType === 'youtube' ? youtubeUrl(item.embedUrl || item.sourceUrl) : '';
  if (!source && !embed) return '';
  const title = localized(item, 'title') || 'MIRoKIT';
  const description = localized(item, 'description');
  const poster = safeUrl(item.poster) || '/public/assets/backgrounds/videos_background_thumbnail.png';
  const media = embed
    ? `<iframe src="${escapeHtml(embed)}" title="${escapeHtml(title)}" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`
    : `<video controls preload="metadata" poster="${escapeHtml(poster)}" playsinline>${(item.subtitles || []).map((track) => { const src = safeUrl(track.src); return src ? `<track kind="subtitles" src="${escapeHtml(src)}" srclang="${escapeHtml(track.srcLang || track.language || 'en')}" label="${escapeHtml(track.label || String(track.language || '').toUpperCase())}"${track.isDefault ? ' default' : ''} />` : ''; }).join('')}<source src="${escapeHtml(source)}" />${escapeHtml(tr('load_error'))}</video>`;
  const meta = [duration(item.durationSeconds), item.sourceType === 'youtube' ? 'YouTube' : 'MIRoKIT'].filter(Boolean).join(' · ');
  return `<article class="iv-video-card"><div class="iv-player">${media}</div><div class="iv-video-copy"><span class="iv-card-label">${escapeHtml(tr('video_label'))}${meta ? ` · ${escapeHtml(meta)}` : ''}</span><h3>${escapeHtml(title)}</h3>${description ? `<p>${escapeHtml(description)}</p>` : ''}</div></article>`;
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
function renderVideos() {
  const grid = $('interviewVideoGrid');
  const status = $('interviewStatus');
  grid.innerHTML = interviews.map(renderVideoCard).join('');
  grid.setAttribute('aria-busy', String(loading));
  if (loading) { status.hidden = false; status.innerHTML = `<span class="iv-loader" aria-hidden="true"></span><span>${escapeHtml(tr('loading'))}</span>`; return; }
  status.hidden = true;
  if (failed || !grid.children.length) {
    status.hidden = false;
    status.innerHTML = `<span>${escapeHtml(failed ? tr('load_error') : tr('no_interviews'))}</span>`;
  }
}

function renderMaterials() {
  document.querySelectorAll('[data-material-panel]').forEach((panel) => {
    const items = materials.filter((item) => item.kind === panel.dataset.materialPanel);
    if (!items.length) {
      panel.innerHTML = materialDefaults.get(panel.dataset.materialPanel) || '';
      return;
    }
    panel.innerHTML = items.map((item) => {
      const title = localized(item, 'title') || item.id;
      const description = localized(item, 'description');
      const url = safeUrl(item.sourceUrl);
      if (!url) return '';
      const tone = item.kind === 'requests' ? 'yellow' : item.kind === 'forms' ? 'red' : 'blue';
      const label = item.kind === 'requests' ? tr('material_request_label') : tr('material_document_label');
      const linkLabel = item.kind === 'requests' ? tr('material_request_cta') : tr('material_open');
      return `<article class="iv-material-card iv-material-card--${tone}"><span class="iv-material-icon" aria-hidden="true">${item.kind === 'requests' ? '↗' : item.kind === 'forms' ? '✎' : '▤'}</span><span class="iv-card-label">${escapeHtml(label)}</span><h3>${escapeHtml(title)}</h3>${description ? `<p>${escapeHtml(description)}</p>` : ''}${item.fileName ? `<span class="iv-material-note">${escapeHtml(item.fileName)}</span>` : ''}<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(linkLabel)}</a></article>`;
    }).join('') || (materialDefaults.get(panel.dataset.materialPanel) || '');
  });
}
async function loadInterviews() {
  loading = true;
  renderVideos();
  try {
    const response = await fetch('/api/v1/interviews', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (response.status === 404) {
      interviews = [];
    } else {
      if (!response.ok) throw new Error(`Interview API: ${response.status}`);
      const data = await response.json();
      if (data.success === false || !Array.isArray(data.interviews)) throw new Error('Invalid interview response');
      interviews = data.interviews;
      materials = Array.isArray(data.materials) ? data.materials : [];
    }
  } catch { failed = true; }
  loading = false;
  renderVideos();
  renderMaterials();
}

function activateTab(attribute, value) {
  const tabs = [...document.querySelectorAll(`[data-${attribute}-tab]` )];
  const panels = [...document.querySelectorAll(`[data-${attribute}-panel]` )];
  const activeTab = tabs.find((tab) => tab.dataset[`${attribute}Tab`] === value);
  if (!activeTab) return;
  tabs.forEach((tab) => {
    const active = tab === activeTab;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  panels.forEach((panel) => {
    const active = panel.dataset[`${attribute}Panel`] === value;
    panel.classList.toggle('is-active', active);
    panel.hidden = !active;
  });
}

document.querySelectorAll('[data-interview-tab]').forEach((tab) => tab.addEventListener('click', () => activateTab('interview', tab.dataset.interviewTab)));
document.querySelectorAll('[data-material-tab]').forEach((tab) => tab.addEventListener('click', () => activateTab('material', tab.dataset.materialTab)));

document.addEventListener('mirokit:languagechange', () => { applyCopy(); renderVideos(); renderMaterials(); });
document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
  const theme = document.body.classList.contains('theme-dark') ? 'light' : 'dark';
  document.body.classList.toggle('theme-dark', theme === 'dark');
  document.documentElement.dataset.theme = theme;
  syncThemeButton();
  try { localStorage.setItem('mirokitTheme', theme); } catch { /* optional storage */ }
});

try { if (localStorage.getItem('mirokitTheme') === 'dark') { document.body.classList.add('theme-dark'); document.documentElement.dataset.theme = 'dark'; } } catch { /* optional storage */ }
syncThemeButton();
const urlLanguage = new URLSearchParams(location.search).get('lang');
if (['ru', 'en', 'de'].includes(urlLanguage) && urlLanguage !== currentLang) setLang(urlLanguage);
applyCopy();
renderVideos();
renderMaterials();
loadInterviews();
