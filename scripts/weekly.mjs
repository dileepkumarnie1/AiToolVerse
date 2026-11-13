// Drafts a "This week in AI" issue as src/data/weekly/<date>.json for a person to review and edit.
//
//   node scripts/weekly.mjs            draft this week's issue
//   node scripts/weekly.mjs --force    replace today's draft
//
// News: the AI stories with the most points on Hacker News in the last 7 days, each linked to its source.
// Tools: the catalog tools discussed most (from src/data/trends.json; run scripts/trends.mjs first).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readTools, hostOf } from './lib/catalog.mjs';

const DIR = join(ROOT, 'src/data/weekly');
const TRENDS = join(ROOT, 'src/data/trends.json');
const API = 'https://hn.algolia.com/api/v1/search';
const NEWS_COUNT = 8;
const TOOL_COUNT = 6;
const MIN_POINTS = 100;
const since = Math.floor(Date.now() / 1000) - 7 * 86400;
const today = new Date().toISOString().slice(0, 10);
const file = join(DIR, `${today}.json`);

if (existsSync(file) && !process.argv.includes('--force')) {
  console.error(`${file} already exists. Edit it, or pass --force to replace it.`);
  process.exit(1);
}

const AI_TOPIC =
  /(^|[^A-Za-z])(AI|A\.I\.|AGI|LLMs?|GPT[-\w.]*|ChatGPT|OpenAI|Anthropic|Claude|Gemini|DeepMind|Mistral|Llama|Copilot|Nvidia|machine learning|neural|diffusion|transformers?|agents?|chatbots?)([^A-Za-z]|$)/;
const QUERIES = ['AI', 'LLM', 'GPT', 'OpenAI', 'Anthropic', 'Claude', 'Gemini', 'model', 'agents'];
const clean = (s) => String(s ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();

const search = async (query) => {
  const url = `${API}?${new URLSearchParams({ tags: 'story', hitsPerPage: '50', query, numericFilters: `created_at_i>${since},points>=${MIN_POINTS}` })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HN API ${res.status}`);
  return (await res.json()).hits ?? [];
};

const hits = new Map();
for (const query of QUERIES) for (const hit of await search(query)) hits.set(hit.objectID, hit);

const perSource = new Map();
const seenStories = new Set();
const news = [...hits.values()]
  .filter((h) => h.url?.startsWith('https://') && AI_TOPIC.test(h.title ?? ''))
  .sort((a, b) => b.points - a.points)
  // The same article is often submitted more than once; keep the submission with the most points.
  .filter((h) => {
    const keys = [clean(h.title).toLowerCase(), h.url.replace(/[?#].*$/, '').replace(/\/+$/, '')];
    if (keys.some((k) => seenStories.has(k))) return false;
    keys.forEach((k) => seenStories.add(k));
    return true;
  })
  // At most two stories from one website, so a single source cannot fill the issue.
  .filter((h) => {
    const host = hostOf(h.url);
    perSource.set(host, (perSource.get(host) ?? 0) + 1);
    return perSource.get(host) <= 2;
  })
  .slice(0, NEWS_COUNT)
  .map((h) => ({
    title: clean(h.title).slice(0, 200),
    url: h.url,
    source: hostOf(h.url),
    points: h.points,
    discussion: `https://news.ycombinator.com/item?id=${h.objectID}`,
  }));

if (news.length < 3) {
  console.error(`Only ${news.length} AI stories reached ${MIN_POINTS} points this week; no issue drafted.`);
  process.exit(1);
}

// The same product can be listed twice in the catalog; keep one entry per website.
const siteOf = new Map(readTools().map((t) => [t.data.slug, `${hostOf(t.data.url)}${new URL(t.data.url).pathname.replace(/\/+$/, '')}`]));
// Two entries with the same top story are also treated as one product.
const seen = new Set();
const trendTools = existsSync(TRENDS) ? JSON.parse(readFileSync(TRENDS, 'utf8')).tools : {};
const tools = Object.keys(trendTools)
  .filter((slug) => {
    const keys = [siteOf.get(slug), `story:${trendTools[slug].top.id}`];
    if (!siteOf.has(slug) || keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  })
  .slice(0, TOOL_COUNT);

mkdirSync(DIR, { recursive: true });
const number = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== `${today}.json`).length + 1;
const label = new Date(`${today}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const issue = {
  slug: today,
  number,
  date: today,
  title: `This week in AI: ${label}`,
  intro: 'The AI stories people discussed most this week, and the tools at the centre of the conversation.',
  news,
  tools,
};
writeFileSync(file, `${JSON.stringify(issue, null, 2)}\n`);
console.log(`Drafted issue ${number} with ${news.length} stories and ${tools.length} tools: ${file}`);
console.log('Read it, edit the title and intro, remove anything you do not want to publish, then commit.');
