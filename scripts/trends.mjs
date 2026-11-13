// Measures how much each catalog tool was discussed on Hacker News in the last 30 days and
// writes the result to src/data/trends.json. The Trending page and home page read that file.
//
//   node scripts/trends.mjs
//
// A story counts for a tool when it links to the tool's own website, or, for the well-known
// tools listed in TITLE_NAMES, when its headline names the tool.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readTools, hostOf } from './lib/catalog.mjs';

const OUT = join(ROOT, 'src/data/trends.json');
const WINDOW_DAYS = 30;
const CONCURRENCY = 4;
const API = 'https://hn.algolia.com/api/v1/search';
const since = Math.floor(Date.now() / 1000) - WINDOW_DAYS * 86400;

// Headline matching is limited to names that are unlikely to mean anything else.
// Matching is case-sensitive, so "Cursor" counts and "cursor" does not.
const TITLE_NAMES = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  'perplexity-ai': 'Perplexity',
  cursor: 'Cursor',
  'github-copilot': 'GitHub Copilot',
  'microsoft-copilot': 'Microsoft Copilot',
  midjourney: 'Midjourney',
  'dall-e-3': 'DALL-E',
  elevenlabs: 'ElevenLabs',
  heygen: 'HeyGen',
  synthesia: 'Synthesia',
  'suno-ai': 'Suno',
  lovable: 'Lovable',
  'bolt-new': 'Bolt.new',
  'notion-ai': 'Notion AI',
  grammarly: 'Grammarly',
  deepl: 'DeepL',
  quillbot: 'QuillBot',
  ideogram: 'Ideogram',
  'adobe-firefly': 'Adobe Firefly',
  'character-ai': 'Character.AI',
  grok: 'Grok',
  groq: 'Groq',
  'mistral-le-chat': 'Mistral',
  'meta-ai': 'Meta AI',
  openrouter: 'OpenRouter',
  'devin-cognition': 'Devin',
  codeium: 'Codeium',
  windsurf: 'Windsurf',
  tabnine: 'Tabnine',
  raycast: 'Raycast',
  supabase: 'Supabase',
  pinecone: 'Pinecone',
  langgraph: 'LangGraph',
  'llama-index': 'LlamaIndex',
  zapier: 'Zapier',
  n8n: 'n8n',
  descript: 'Descript',
  'notebook-llm': 'NotebookLM',
  'kling-ai': 'Kling',
  'stable-diffusion': 'Stable Diffusion',
  'hugging-face': 'Hugging Face',
  ollama: 'Ollama',
  replit: 'Replit',
  'v0': 'v0',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = new Map();

/** One search request, retried with a growing pause when the API is busy or the connection drops. */
// Websites that belong to a company or host many products. A catalog entry that points at the front
// page of one of these, or is identified only by a query string, gets no website matches:
// stories about the whole site are not stories about that tool.
const SHARED_SITES = new Set([
  'github.com', 'huggingface.co', 'marketplace.visualstudio.com', 'anthropic.com', 'openai.com', 'google.com',
  'microsoft.com', 'aws.amazon.com', 'adobe.com', 'ibm.com', 'salesforce.com', 'ai.meta.com',
]);

const search = async (params) => {
  const url = `${API}?${new URLSearchParams({ tags: 'story', hitsPerPage: '100', ...params })}`;
  let reason = '';
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await sleep(1500 * 2 ** (attempt - 1));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (res.ok) return (await res.json()).hits ?? [];
      reason = `HTTP ${res.status}`;
      if (res.status < 429) break; // a 4xx other than "too many requests" will not succeed on retry
    } catch (err) {
      reason = err.name === 'AbortError' ? 'timeout' : String(err.cause?.code ?? err.message);
    } finally {
      clearTimeout(timer);
    }
  }
  failures.set(reason, (failures.get(reason) ?? 0) + 1);
  throw new Error(reason);
};

const pathOf = (url) => new URL(url).pathname.replace(/\/+$/, '').toLowerCase();
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const tools = readTools().map((t) => ({ ...t.data, host: hostOf(t.data.url), path: pathOf(t.data.url) }));
const hosts = new Set(tools.map((t) => t.host));
const stories = new Map(tools.map((t) => [t.slug, new Map()]));
let failed = 0;

const add = (slug, hit) => {
  if (!hit.points) return;
  stories.get(slug).set(hit.objectID, { id: hit.objectID, title: String(hit.title ?? '').trim(), points: hit.points });
};

/** Stories that link to the tool's own site. */
const byWebsite = async (tool) => {
  if (SHARED_SITES.has(tool.host) && (tool.path === '' || new URL(tool.url).search)) return;
  const hits = await search({
    query: `${tool.host}${tool.path}`,
    restrictSearchableAttributes: 'url',
    numericFilters: `created_at_i>${since}`,
  });
  // On a host shared with other catalog tools, a story belongs to the tool with the longest matching path.
  const rivals = tools.filter((t) => t.host === tool.host && t.path.length > tool.path.length && t.path.startsWith(tool.path));
  for (const hit of hits) {
    if (!hit.url) continue;
    const host = hostOf(hit.url);
    const path = pathOf(hit.url);
    const sameSite = host === tool.host || (host.endsWith(`.${tool.host}`) && !hosts.has(host));
    if (!sameSite || !path.startsWith(tool.path)) continue;
    if (rivals.some((r) => path.startsWith(r.path))) continue;
    add(tool.slug, hit);
  }
};

/** Stories whose headline names the tool. */
const byHeadline = async (tool, name) => {
  const hits = await search({
    query: `"${name}"`,
    restrictSearchableAttributes: 'title',
    numericFilters: `created_at_i>${since},points>5`,
  });
  const pattern = new RegExp(`(^|[^A-Za-z0-9])${escapeRegex(name)}([^A-Za-z0-9]|$)`);
  for (const hit of hits) if (pattern.test(hit.title ?? '')) add(tool.slug, hit);
};

const jobs = [
  ...tools.map((tool) => () => byWebsite(tool)),
  ...tools.filter((t) => TITLE_NAMES[t.slug]).map((tool) => () => byHeadline(tool, TITLE_NAMES[tool.slug])),
];
const total = jobs.length;
let done = 0;
const worker = async () => {
  for (let job = jobs.shift(); job; job = jobs.shift()) {
    await job().catch(() => {
      failed += 1;
    });
    done += 1;
    if (done % 200 === 0) console.log(`${done} of ${total} lookups`);
  }
};
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// A failed run must not replace good data with a near-empty file.
if (failed > total * 0.1) {
  console.error(`${failed} of ${total} lookups failed (${[...failures].map(([k, n]) => `${k}: ${n}`).join(', ')}); keeping the existing trends file.`);
  process.exit(1);
}

const result = {};
for (const tool of tools) {
  const list = [...stories.get(tool.slug).values()].sort((a, b) => b.points - a.points);
  if (list.length === 0) continue;
  result[tool.slug] = {
    points: list.reduce((sum, s) => sum + s.points, 0),
    stories: list.length,
    top: list[0],
  };
}
const ranked = Object.fromEntries(Object.entries(result).sort((a, b) => b[1].points - a[1].points));
writeFileSync(
  OUT,
  `${JSON.stringify({ source: 'Hacker News', windowDays: WINDOW_DAYS, updatedAt: new Date().toISOString().slice(0, 10), tools: ranked }, null, 2)}\n`,
);
console.log(`${Object.keys(ranked).length} of ${tools.length} tools were discussed in the last ${WINDOW_DAYS} days (${failed} lookups failed).`);
