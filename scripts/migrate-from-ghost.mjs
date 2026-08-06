/**
 * One-time migration: Ghost Content API -> Astro content collections.
 *
 * - Fetches all posts and pages (with tags) from the Ghost Content API
 * - Downloads every referenced image into public/images/ (Ghost's image
 *   host goes away once DNS points at Cloudflare Pages)
 * - Rewrites internal links/images to local paths
 * - Converts HTML to Markdown, keeping embeds/figures as raw HTML
 * - Writes src/content/blog/<slug>.md and src/content/pages/<slug>.md
 *
 * Usage: node scripts/migrate-from-ghost.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import TurndownService from 'turndown';

const GHOST_URL = 'https://blog.axelarator.net';
const GHOST_KEY = '754ccc538a692fecdf38aa482a';
const API = `${GHOST_URL}/ghost/api/content`;

const ROOT = new URL('..', import.meta.url).pathname;
const IMAGES_DIR = path.join(ROOT, 'public/images');
const BLOG_DIR = path.join(ROOT, 'src/content/blog');
const PAGES_DIR = path.join(ROOT, 'src/content/pages');

// ---------------------------------------------------------------------------
// Ghost API

async function ghost(resource, params = {}) {
  const url = new URL(`${API}/${resource}/`);
  url.searchParams.set('key', GHOST_KEY);
  url.searchParams.set('limit', 'all');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ghost API ${resource}: ${res.status} ${await res.text()}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Image handling

const downloaded = new Map(); // remote URL -> local public path

/** Strip Ghost's on-the-fly resize prefix so we fetch the original. */
function originalImageUrl(u) {
  return u.replace(/\/content\/images\/size\/w\d+(?:h\d+)?\//, '/content/images/');
}

function isOwnImage(u) {
  return u.startsWith(`${GHOST_URL}/content/images/`) || u.startsWith('/content/images/');
}

async function downloadImage(rawUrl) {
  let u = originalImageUrl(rawUrl);
  if (u.startsWith('/')) u = GHOST_URL + u;
  if (downloaded.has(u)) return downloaded.get(u);

  const rel = new URL(u).pathname.replace(/^\/content\/images\//, '');
  const localPath = path.join(IMAGES_DIR, rel);
  const publicPath = `/images/${rel}`;

  await mkdir(path.dirname(localPath), { recursive: true });
  const res = await fetch(u);
  if (!res.ok) {
    console.warn(`  ! failed to download ${u}: ${res.status}`);
    return rawUrl; // leave the original URL in place rather than break it
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(localPath));
  downloaded.set(u, publicPath);
  console.log(`  ↓ ${publicPath}`);
  return publicPath;
}

/** Localize every own-domain image URL inside an HTML string. */
async function localizeImages(html) {
  const urls = new Set();
  // src/href attributes pointing at Ghost-hosted images
  for (const m of html.matchAll(/(?:src|href)="([^"]+\/content\/images\/[^"]+)"/g)) {
    urls.add(m[1]);
  }
  // srcset entries
  for (const m of html.matchAll(/srcset="([^"]+)"/g)) {
    for (const part of m[1].split(',')) {
      const u = part.trim().split(/\s+/)[0];
      if (u.includes('/content/images/')) urls.add(u);
    }
  }
  let out = html;
  for (const u of urls) {
    if (!isOwnImage(u)) continue;
    const local = await downloadImage(u);
    out = out.replaceAll(u, local);
  }
  // Drop srcset/sizes: variants now all point at the same original file
  out = out.replace(/\s(?:srcset|sizes)="[^"]*"/g, '');
  return out;
}

// ---------------------------------------------------------------------------
// HTML -> Markdown

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  hr: '---',
});
// Ghost cards that don't round-trip through Markdown: keep as HTML
turndown.keep(['figure', 'iframe', 'video', 'audio', 'table']);

function toMarkdown(html) {
  // Internal links -> relative paths so they work on the new host
  const relative = html.replaceAll(`${GHOST_URL}/`, '/').replaceAll('href="/"', 'href="/"');
  return turndown.turndown(relative);
}

// ---------------------------------------------------------------------------
// Frontmatter + file output

function yamlString(s) {
  return JSON.stringify(s ?? '');
}

async function writeEntry(dir, item, { withTags }) {
  let html = await localizeImages(item.html ?? '');
  let heroImage = '';
  if (item.feature_image && isOwnImage(item.feature_image)) {
    heroImage = await downloadImage(item.feature_image);
  } else if (item.feature_image) {
    heroImage = item.feature_image;
  }

  const description = item.custom_excerpt || item.excerpt?.split('\n')[0] || '';
  const lines = [
    '---',
    `title: ${yamlString(item.title)}`,
    `description: ${yamlString(description.trim())}`,
    `pubDate: ${item.published_at}`,
  ];
  if (item.updated_at && item.updated_at !== item.published_at) {
    lines.push(`updatedDate: ${item.updated_at}`);
  }
  if (heroImage) lines.push(`heroImage: ${yamlString(heroImage)}`);
  if (item.feature_image_caption) {
    lines.push(`heroImageCaption: ${yamlString(turndown.turndown(item.feature_image_caption))}`);
  }
  if (withTags) {
    const tags = (item.tags ?? []).filter((t) => t.visibility === 'public').map((t) => t.name);
    lines.push(`tags: ${JSON.stringify(tags)}`);
  }
  lines.push('---', '', toMarkdown(html), '');

  const file = path.join(dir, `${item.slug}.md`);
  await writeFile(file, lines.join('\n'));
  console.log(`✓ ${path.relative(ROOT, file)}`);
}

// ---------------------------------------------------------------------------

await mkdir(BLOG_DIR, { recursive: true });
await mkdir(PAGES_DIR, { recursive: true });

const { posts } = await ghost('posts', { include: 'tags', formats: 'html' });
console.log(`${posts.length} posts`);
for (const post of posts) await writeEntry(BLOG_DIR, post, { withTags: true });

const { pages } = await ghost('pages', { formats: 'html' });
console.log(`${pages.length} pages`);
for (const page of pages) await writeEntry(PAGES_DIR, page, { withTags: false });

console.log(`\nDone. ${downloaded.size} images downloaded to public/images/`);
