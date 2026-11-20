import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../../site/page/gallery/gallery.js', import.meta.url), 'utf8');
const photo = (id) => ({ key: `gallery/summer/${id}.webp`, folderSlug: 'summer', collection: 'gallery', status: 'published', image: `/media/v1/gallery/summer/${id}.webp` });
const photos = Array.from({ length: 30 }, (_, i) => photo(`photo-${i + 1}`));
const video = { id: 'our-summer-film', sourceType: 'youtube', embedUrl: 'https://www.youtube.com/embed/abcdefghijk', sourceUrl: 'https://www.youtube.com/embed/abcdefghijk', translations: { de: { title: 'Unser Sommer' }, en: { title: 'Our summer' } } };
const data = { success: true, gallery: photos, folders: [{ slug: 'summer', title: { en: 'Summer' }, images: photos }], videos: [video] };

// Run the real page script with a small DOM adapter; native browser layout is not emulated.
function page(query = '', response = data) {
  const elements = new Map();
  const closing = [];
  let context;
  function element(tag = 'div') {
    const events = new Map();
    const classes = new Set();
    return {
      tag, dataset: {}, style: {}, value: '', hidden: false, textContent: '', innerHTML: '', children: [], isConnected: true,
      classList: { add: (v) => classes.add(v), remove: (v) => classes.delete(v), contains: (v) => classes.has(v), toggle: (v, on) => on ? classes.add(v) : classes.delete(v) },
      setAttribute(name, value) { this[name] = value; },
      removeAttribute(name) { delete this[name]; },
      addEventListener(name, fn) { events.set(name, [...(events.get(name) || []), fn]); },
      async emit(name, event = {}) { for (const fn of events.get(name) || []) await fn(event); },
      closest() { return this; },
      querySelector(selector) { return this.children.find((child) => child.tag === selector) || (selector === '.theme-toggle-label' ? element() : null); },
      querySelectorAll() { return []; },
      append(...nodes) { this.children.push(...nodes); },
      replaceChildren(...nodes) { this.children = nodes; },
      focus() { context.document.activeElement = this; },
      select: vi.fn(),
      showModal() { this.open = true; },
      close() { this.open = false; closing.push(() => this.emit('close')); },
    };
  }
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  const document = Object.assign(element(), {
    getElementById: get, querySelector: get, querySelectorAll: () => [], createElement: element,
    body: element(), documentElement: element(), activeElement: element(),
  });
  context = createContext({
    URL, URLSearchParams, AbortController, console,
    setTimeout: () => 1, clearTimeout() {},
    document, window: element(), location: new URL(`https://mirokit.com/page/gallery/${query}`),
    localStorage: { getItem: () => null }, currentLang: 'en', T: { en: {}, de: {}, ru: {} },
    setLang(lang) { context.currentLang = lang; document.emit('mirokit:languagechange'); },
    navigator: { clipboard: { writeText: vi.fn(async () => {}) } },
    fetch: vi.fn(async () => ({ ok: true, json: async () => response })),
  });
  const entries = [context.location.href];
  let cursor = 0;
  context.history = {
    state: {},
    pushState(state, _, url) { this.state = state; context.location = new URL(url, context.location); entries.splice(++cursor); entries.push(context.location.href); },
    replaceState(state, _, url) { this.state = state; context.location = new URL(url, context.location); entries[cursor] = context.location.href; },
  };
  runInContext(source, context);
  return {
    context, get,
    run: (code) => runInContext(code, context),
    async flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); },
    async closeEvents() { while (closing.length) await closing.shift()(); },
    async go(delta) { cursor += delta; context.location = new URL(entries[cursor]); await context.window.emit('popstate'); },
  };
}

describe('Gallery media links', () => {
  it('keeps the requested folder while the API is still loading', async () => {
    const app = page('?view=photos&folder=summer&lang=de');
    expect(app.run('activeFolder')).toBe('summer');
    await app.flush();
    expect(app.run('activeFolder')).toBe('summer');
    expect(app.get('galleryGrid').innerHTML).toContain('photo=photo-1');
    expect(app.get('galleryGrid').innerHTML).toContain('<a');
  });

  it('opens a photo beyond the first page and preserves it across reload and reordering', async () => {
    const app = page('?view=photos&folder=summer&photo=photo-30&lang=de');
    await app.flush();
    expect(app.get('galleryViewer').open).toBe(true);
    expect(app.get('galleryStage').children[0].src).toContain('photo-30.webp');
    expect(app.get('galleryGrid').innerHTML).toContain('photo=photo-30');
    const reload = page(app.context.location.search, { ...data, folders: [{ ...data.folders[0], images: [...photos].reverse() }] });
    await reload.flush();
    expect(reload.get('galleryStage').children[0].src).toContain('photo-30.webp');
  });

  it('resolves a video admin slug without view and drops an incompatible search filter', async () => {
    const app = page('?video=our-summer-film&q=outdated&lang=de&campaign=summer');
    await app.flush();
    expect(app.get('galleryViewer').open).toBe(true);
    expect(app.get('galleryViewerTitle').textContent).toBe('Unser Sommer');
    expect(app.context.location.searchParams.get('view')).toBe('video');
    expect(app.context.location.searchParams.has('q')).toBe(false);
    expect(app.context.location.searchParams.get('campaign')).toBe('summer');
  });

  it('restores selection with back/forward and ignores a queued close after reopening', async () => {
    const app = page('?folder=summer');
    await app.flush();
    app.run('openMedia(0)');
    app.run('openMedia(1)');
    expect(app.context.location.searchParams.get('photo')).toBe('photo-2');
    await app.go(-1);
    expect(app.get('galleryViewer').open).toBe(false);
    expect(app.context.document.body.style.overflow).not.toBe('hidden');
    await app.go(1);
    await app.closeEvents();
    expect(app.get('galleryViewer').open).toBe(true);
    expect(app.get('galleryStage').children[0].src).toContain('photo-2.webp');
    app.context.setLang('ru');
    expect(app.context.location.searchParams.get('photo')).toBe('photo-2');
    expect(app.context.location.searchParams.get('lang')).toBe('ru');
    app.get('galleryViewer').close();
    await app.closeEvents();
    expect(app.context.location.searchParams.has('photo')).toBe(false);
    expect(app.context.location.searchParams.get('folder')).toBe('summer');
    expect(app.get('galleryStage').children).toHaveLength(0);
  });

  it('copies the complete URL and offers manual selection when clipboard access fails', async () => {
    const app = page('?folder=summer&photo=photo-1&lang=de');
    await app.flush();
    await app.get('galleryCopyLink').emit('click');
    expect(app.context.navigator.clipboard.writeText).toHaveBeenCalledWith(app.context.location.href);
    expect(app.get('galleryShareStatus').textContent).toBe('ga_link_copied');
    app.context.navigator.clipboard.writeText.mockRejectedValueOnce(new Error('denied'));
    await app.get('galleryCopyLink').emit('click');
    expect(app.get('galleryShareStatus').textContent).toBe('ga_copy_manual');
  });

  it.each(['?folder=summer&photo=removed', '?folder=missing&photo=photo-1', '?video=removed'])('handles unavailable links safely: %s', async (query) => {
    const app = page(query);
    await app.flush();
    expect(app.get('galleryViewer').open).not.toBe(true);
    expect(app.get('galleryStatus').hidden).toBe(false);
    expect(app.get('galleryStatusText').textContent).toBe('ga_link_missing');
  });

  it('infers the photo folder and encodes slugs without leaking selection into tabs', async () => {
    const app = page('?photo=photo-1&lang=de');
    await app.flush();
    expect(app.context.location.searchParams.get('folder')).toBe('summer');
    const tab = new URL(app.run("urlFor('video')"), app.context.location);
    expect(tab.searchParams.has('folder')).toBe(false);
    expect(tab.searchParams.has('photo')).toBe(false);
    const link = new URL(app.run("urlFor('video', { id: 'film & friends/2026' })"), app.context.location);
    expect(link.searchParams.get('video')).toBe('film & friends/2026');
  });

  it('opens bundled archive links even when the media API is unavailable', async () => {
    const app = page('?folder=archive&photo=archive-1', { success: false });
    await app.flush();
    expect(app.get('galleryViewer').open).toBe(true);
    expect(app.get('galleryStage').children[0].src).toContain('/public/assets/');
  });

  it('opens the requested medium after retrying a failed API request', async () => {
    const app = page('?folder=summer&photo=photo-3', { success: false });
    await app.flush();
    expect(app.get('galleryViewer').open).not.toBe(true);
    expect(app.get('galleryStatusText').textContent).toBe('ga_load_error');
    app.context.fetch.mockResolvedValueOnce({ ok: true, json: async () => data });
    await app.get('galleryRetry').emit('click');
    await app.flush();
    expect(app.get('galleryStage').children[0].src).toContain('photo-3.webp');
  });

  it('keeps a pending direct link when the language changes before loading completes', async () => {
    const app = page('?folder=summer&photo=photo-3&lang=en');
    app.context.setLang('de');
    await app.flush();
    expect(app.get('galleryViewer').open).toBe(true);
    expect(app.context.location.searchParams.get('photo')).toBe('photo-3');
    expect(app.context.location.searchParams.get('lang')).toBe('de');
  });
});
