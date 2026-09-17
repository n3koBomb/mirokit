import { describe, expect, it } from 'vitest';
import worker from './index.js';
import { rowsToPublicVideos, VIDEOS_PUBLIC_QUERY } from './videos.js';

describe('standalone Gallery routing', () => {
  it.each(['/page/gallery', '/page/gallery/index.html'])("canonicalizes %s without losing filters or language", async (path) => {
    const response = await worker.fetch(new Request(`https://ligamirokit.ru${path}?view=video&lang=ru&q=team`), {});
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('https://ligamirokit.ru/page/gallery/?view=video&lang=ru&q=team');
  });
  it.each(['GET', 'HEAD'])("serves the canonical page for %s without a redirect loop", async (method) => {
    const response = await worker.fetch(new Request('https://mirokit.com/page/gallery/', { method }), { ASSETS: { fetch: async () => new Response(method === 'HEAD' ? null : 'gallery') } });
    expect(response.status).toBe(200);
    expect(response.headers.get('Location')).toBeNull();
  });
  it('includes the new page in the same-host sitemap', async () => {
    const response = await worker.fetch(new Request('https://mirokit.ru/sitemap.xml'), {});
    expect(await response.text()).toContain('<loc>https://mirokit.ru/page/gallery/</loc>');
  });
  it('keeps collection filtering and publication boundaries across R2 pages', async () => {
    const queries = [];
    const object = (id, metadata) => ({ key: `gallery/00000000-0000-0000-0000-${id.padStart(12, '0')}.webp`, customMetadata: metadata });
    const response = await worker.fetch(new Request('https://mirokit.com/api/v1/gallery?collection=gallery'), {
      SITE_MEDIA: { list: async (query) => {
        queries.push(query);
        return query.cursor ? { objects: [object('3', { status: 'published', collection: 'online-projects' }), object('4', { status: 'archived', collection: 'gallery' })] } : { truncated: true, cursor: 'next', objects: [object('1', { status: 'published', collection: 'gallery' }), object('2', { status: 'published' })] };
      } },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.gallery).toHaveLength(2);
    expect(data.gallery.every((item) => item.collection === 'gallery' && item.status === 'published' && item.image.startsWith('/media/v1/gallery/'))).toBe(true);
    expect(queries[1].cursor).toBe('next');
  });
});

describe('Gallery video sorting contract', () => {
  it('exposes timestamps while keeping public status private and translated records grouped', () => {
    const row = { id: 'film', status: 'published', source_type: 'r2', source_url: '/media/v1/videos/test.webm', created_at: '2026-09-01T12:00:00Z', updated_at: '2026-09-02T12:00:00Z' };
    const [video] = rowsToPublicVideos([{ ...row, language: 'en', title: 'Together' }, { ...row, language: 'de', title: 'Zusammen' }]);
    expect(video.createdAt).toBe(row.created_at);
    expect(video.updatedAt).toBe(row.updated_at);
    expect(video.translations.de.title).toBe('Zusammen');
    expect(video).not.toHaveProperty('status');
    expect(VIDEOS_PUBLIC_QUERY).toContain('v.created_at, v.updated_at');
    expect(VIDEOS_PUBLIC_QUERY).toContain("WHERE v.status = 'published'");
  });
});
