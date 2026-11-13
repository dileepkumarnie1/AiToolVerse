// Downloads each tool's own icon from its website and stores a small copy in public/logos/.
// Icons are fetched once at authoring time, so visitors never request them from third parties.
// Tools without a usable icon keep the monogram avatar.
//
//   node scripts/fetch-logos.mjs            fetch icons for tools that do not have one yet
//   node scripts/fetch-logos.mjs --all      refetch every icon
//   node scripts/fetch-logos.mjs --only=chatgpt,claude   refetch the named tools
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { ROOT, readTools } from './lib/catalog.mjs';

const OUT_DIR = join(ROOT, 'public/logos');
const MANIFEST = join(ROOT, 'src/data/logos.json');
const SIZE = 96;
const MIN_SOURCE = 48;
const MAX_BYTES = 600_000;
const CONCURRENCY = 16;
const UA = 'AIToolVerseBot/1.0 (+https://aitoolverse.ai)';
const refetchAll = process.argv.includes('--all');
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');

const get = async (url, ms = 9000) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': UA, accept: '*/*' } });
    if (!res.ok || new URL(res.url).protocol !== 'https:') return null;
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

const readHead = async (res) => {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let html = '';
  while (html.length < 300_000) {
    const { done, value } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
    if (html.includes('</head>')) break;
  }
  reader.cancel().catch(() => {});
  return html;
};

const attr = (tag, name) => tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] ?? '';

/** Icon URLs declared by the page, best first: touch icons, then the largest declared icon. */
const declaredIcons = (html, base) => {
  const found = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attr(tag, 'rel').toLowerCase();
    const href = attr(tag, 'href');
    if (!href || !/\bicon\b/.test(rel)) continue;
    const size = Number(attr(tag, 'sizes').match(/\d+/)?.[0] ?? 0);
    const svg = /\.svg(\?|$)/i.test(href) || /svg/i.test(attr(tag, 'type'));
    const rank = rel.includes('apple-touch-icon') ? 1000 + size : svg ? 900 : size;
    try {
      const url = new URL(href, base);
      if (url.protocol === 'https:') found.push({ url: url.toString(), rank });
    } catch {
      // ignore malformed href
    }
  }
  return found.sort((a, b) => b.rank - a.rank).map((f) => f.url);
};

/** .ico files are containers; modern ones hold a PNG that sharp can read. */
const largestPngInIco = (buf) => {
  if (buf.length < 22 || buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return null;
  let best = null;
  for (let i = 0; i < buf.readUInt16LE(4); i += 1) {
    const at = 6 + i * 16;
    if (at + 16 > buf.length) break;
    const width = buf[at] || 256;
    const size = buf.readUInt32LE(at + 8);
    const offset = buf.readUInt32LE(at + 12);
    const data = buf.subarray(offset, offset + size);
    if (data.length >= 8 && data.readUInt32BE(0) === 0x89504e47 && (!best || width > best.width)) best = { width, data };
  }
  return best?.data ?? null;
};

/**
 * Flattens the icon onto a solid tile so it reads on both the light and the dark look:
 * white for most icons, dark for a light glyph on a transparent background.
 */
const onTile = async (png) => {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = 0;
  let brightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 40) continue;
    opaque += 1;
    brightness += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  const clearRatio = 1 - opaque / (info.width * info.height);
  const lightGlyph = clearRatio > 0.15 && opaque > 0 && brightness / opaque > 225;
  return sharp(png)
    .flatten({ background: lightGlyph ? '#13131f' : '#ffffff' })
    .webp({ quality: 84 })
    .toBuffer();
};

const toLogo = async (url) => {
  const res = await get(url);
  if (!res) return null;
  const raw = Buffer.from(await res.arrayBuffer());
  if (raw.length < 100 || raw.length > MAX_BYTES) return null;
  const input = largestPngInIco(raw) ?? raw;
  try {
    const image = sharp(input, { density: 192 });
    const meta = await image.metadata();
    if (!meta.width || !meta.height) return null;
    if (meta.format !== 'svg' && Math.min(meta.width, meta.height) < MIN_SOURCE) return null;
    const resized = await image.resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    return await onTile(resized);
  } catch {
    return null;
  }
};

const logoFor = async (tool) => {
  const origin = new URL(tool.url).origin;
  const page = await get(tool.url);
  const candidates = [];
  if (page && (page.headers.get('content-type') ?? '').includes('text/html')) {
    candidates.push(...declaredIcons(await readHead(page), page.url));
  }
  candidates.push(`${origin}/apple-touch-icon.png`, `${origin}/favicon.ico`);
  for (const url of [...new Set(candidates)].slice(0, 5)) {
    const logo = await toLogo(url);
    if (logo) return logo;
  }
  return null;
};

mkdirSync(OUT_DIR, { recursive: true });
const tools = readTools().map((t) => t.data);
const queue = tools.filter((t) => (only ? only.includes(t.slug) : refetchAll || !existsSync(join(OUT_DIR, `${t.slug}.webp`))));
let done = 0;
let saved = 0;

const worker = async () => {
  for (let tool = queue.shift(); tool; tool = queue.shift()) {
    const logo = await logoFor(tool).catch(() => null);
    if (logo) {
      writeFileSync(join(OUT_DIR, `${tool.slug}.webp`), logo);
      saved += 1;
    }
    done += 1;
    if (done % 50 === 0) console.log(`${done} checked, ${saved} saved`);
  }
};

const total = queue.length;
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const slugs = new Set(tools.map((t) => t.slug));
const withLogo = readdirSync(OUT_DIR)
  .filter((f) => f.endsWith('.webp'))
  .map((f) => f.slice(0, -5))
  .filter((slug) => slugs.has(slug))
  .sort();
writeFileSync(MANIFEST, `${JSON.stringify(withLogo)}\n`);
console.log(`Checked ${total}, saved ${saved}. ${withLogo.length} of ${tools.length} tools now have a logo.`);
