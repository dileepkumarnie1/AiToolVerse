// Finds trending AI tools and writes them as new catalog files for review in a pull request.
// Nothing is published until a maintainer merges the PR.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, TOOLS_DIR, readTools, toolSchema, slugify, hostOf, inferCapabilities } from './lib/catalog.mjs';

const STATE_FILE = join(ROOT, 'src/data/discovery-state.json');
const MAX_NEW = Number(process.env.DISCOVERY_MAX_NEW || 8);
const LOOKBACK_DAYS = Number(process.env.DISCOVERY_LOOKBACK_DAYS || 3);
const RESEEN_AFTER_DAYS = 120;
const PRODUCTHUNT_TOKEN = process.env.PRODUCTHUNT_TOKEN || '';
const SUMMARY_FILE = process.env.DISCOVERY_SUMMARY_FILE || join(tmpdir(), 'discovery-summary.md');
const today = new Date().toISOString().slice(0, 10);

const SKIP_HOSTS = [
  'github.com', 'gitlab.com', 'youtube.com', 'youtu.be', 'x.com', 'twitter.com', 'medium.com', 'substack.com',
  'arxiv.org', 'news.ycombinator.com', 'producthunt.com', 'reddit.com', 'linkedin.com', 'apps.apple.com',
  'play.google.com', 'chromewebstore.google.com', 'huggingface.co', 'docs.google.com', 'notion.site',
  'techcrunch.com', 'theverge.com', 'wikipedia.org', 'vercel.app', 'netlify.app', 'pages.dev', 'github.io',
];
const AI_SIGNAL = /\b(ai|a\.i\.|gpt|llm|agent|agents|genai|machine learning|neural|copilot|chatbot|generat\w*|diffusion|claude|gemini|openai)\b/i;
const STORY_TITLE = /^(i|we|my|our|how|why|what|when|ask|tell|the story|lessons)\b/i;
const ARTICLE_PATH = /\/(blog|posts?|articles?|news|docs?|papers?|research|p)\//i;

const isSkippedHost = (host) => SKIP_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
const isProductPage = (url) => {
  const { pathname } = new URL(url);
  return !ARTICLE_PATH.test(`${pathname}/`) && pathname.split('/').filter(Boolean).length <= 1;
};
const shortName = (title) => title.split(/\s[–—|-]\s|:\s|,\s|\s\(/)[0].trim();

const decodeEntities = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '')
    .replace(/&gt;/g, '')
    .replace(/&#x?[0-9a-f]+;/gi, ' ');

const clean = (s, max) => {
  const text = decodeEntities(String(s || ''))
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
};

const fetchWithTimeout = async (url, init = {}, ms = 8000) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
};

/** Reads at most 512 KB of a public https page and returns its final URL, title and description. */
const inspectSite = async (url) => {
  const res = await fetchWithTimeout(url, { headers: { 'user-agent': 'AIToolVerseBot/1.0 (+https://aitoolverse.ai)' } });
  const finalUrl = new URL(res.url);
  if (!res.ok || finalUrl.protocol !== 'https:' || !(res.headers.get('content-type') || '').includes('text/html')) return null;

  const reader = res.body.getReader();
  let html = '';
  const decoder = new TextDecoder();
  while (html.length < 512_000) {
    const { done, value } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
    if (html.includes('</head>')) break;
  }
  reader.cancel().catch(() => {});

  const meta = (name) =>
    html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'))?.[1] ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`, 'i'))?.[1] ||
    '';
  finalUrl.hash = '';
  [...finalUrl.searchParams.keys()].filter((k) => /^utm_|^ref$/.test(k)).forEach((k) => finalUrl.searchParams.delete(k));
  return {
    url: finalUrl.toString(),
    title: clean(meta('og:site_name') || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '', 120),
    description: clean(meta('description') || meta('og:description'), 220),
  };
};

const fromHackerNews = async () => {
  const since = Math.floor(Date.now() / 1000) - LOOKBACK_DAYS * 86400;
  const url = `https://hn.algolia.com/api/v1/search?tags=show_hn&numericFilters=created_at_i>${since},points>=25&hitsPerPage=100`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`HN API ${res.status}`);
  const { hits } = await res.json();
  return hits
    .filter((h) => h.url && AI_SIGNAL.test(h.title))
    .map((h) => ({ ...h, title: h.title.replace(/^show hn:\s*/i, '') }))
    .filter((h) => !STORY_TITLE.test(h.title))
    .map((h) => ({
      name: clean(shortName(h.title), 80),
      url: h.url,
      hint: clean(h.title, 220),
      score: h.points,
      source: 'hackernews',
      sourceUrl: `https://news.ycombinator.com/item?id=${h.objectID}`,
    }));
};

const fromProductHunt = async () => {
  if (!PRODUCTHUNT_TOKEN) return [];
  const postedAfter = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString();
  const query = `query($after: DateTime!) { posts(first: 40, order: VOTES, postedAfter: $after, topic: "artificial-intelligence") {
    edges { node { name tagline website url votesCount } } } }`;
  const res = await fetchWithTimeout('https://api.producthunt.com/v2/api/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${PRODUCTHUNT_TOKEN}` },
    body: JSON.stringify({ query, variables: { after: postedAfter } }),
  });
  if (!res.ok) throw new Error(`Product Hunt API ${res.status}`);
  const json = await res.json();
  return (json.data?.posts?.edges || [])
    .filter(({ node }) => node.votesCount >= 50)
    .map(({ node }) => ({
      name: clean(node.name, 80),
      url: node.website,
      hint: clean(node.tagline, 220),
      score: node.votesCount,
      source: 'producthunt',
      sourceUrl: node.url,
    }));
};

const main = async () => {
  const existing = readTools().map((t) => t.data);
  const knownHosts = new Set(existing.map((t) => hostOf(t.url)));
  const knownSlugs = new Set(existing.map((t) => t.slug));
  const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { seen: {} };
  const cutoff = new Date(Date.now() - RESEEN_AFTER_DAYS * 86400_000).toISOString().slice(0, 10);

  const results = await Promise.allSettled([fromProductHunt(), fromHackerNews()]);
  results.filter((r) => r.status === 'rejected').forEach((r) => console.warn(`source failed: ${r.reason}`));
  const candidates = results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort((a, b) => b.score - a.score);

  const added = [];
  for (const c of candidates) {
    if (added.length >= MAX_NEW) break;
    let host;
    try {
      host = hostOf(c.url);
      if (new URL(c.url).protocol !== 'https:') continue;
    } catch {
      continue;
    }
    if (!host || knownHosts.has(host) || isSkippedHost(host) || (state.seen[host] && state.seen[host] > cutoff)) continue;
    state.seen[host] = today;

    let site;
    try {
      site = await inspectSite(c.url);
    } catch {
      continue;
    }
    if (!site || isSkippedHost(hostOf(site.url)) || knownHosts.has(hostOf(site.url)) || !isProductPage(site.url)) continue;

    const text = [c.name, c.hint, site.title, site.description];
    if (!AI_SIGNAL.test(text.join(' '))) continue;
    const capabilities = inferCapabilities(text).slice(0, 3);
    if (capabilities.length === 0) continue;

    let slug = slugify(c.name);
    if (!slug || knownSlugs.has(slug)) slug = slugify(`${c.name}-${host.split('.')[0]}`);
    if (!slug || knownSlugs.has(slug)) continue;

    const name = site.title && site.title.length <= 30 ? shortName(site.title) : c.name;
    const tool = {
      slug,
      name,
      url: site.url,
      tagline: site.description.length >= 10 ? site.description : c.hint,
      pros: [],
      cons: [],
      capabilities,
      pricing: 'freemium',
      openSource: false,
      skillLevel: capabilities.some((x) => ['developer-api', 'code-assistant'].includes(x)) ? 'advanced' : 'beginner',
      popularity: Math.min(80, 55 + Math.round(Math.log2(Math.max(1, c.score)) * 2)),
      addedAt: today,
      source: c.source,
      sourceUrl: c.sourceUrl,
    };
    const parsed = toolSchema.safeParse(tool);
    if (!parsed.success) continue;

    writeFileSync(join(TOOLS_DIR, `${slug}.json`), `${JSON.stringify(parsed.data, null, 2)}\n`);
    knownHosts.add(host);
    knownSlugs.add(slug);
    added.push({ ...parsed.data, score: c.score });
  }

  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);

  const rows = added.map(
    (t) => `| [${t.name}](${t.url}) | ${t.tagline.replace(/\|/g, '/')} | ${t.capabilities.join(', ')} | [${t.source}](${t.sourceUrl}) (${t.score}) | \`src/data/tools/${t.slug}.json\` |`,
  );
  writeFileSync(
    SUMMARY_FILE,
    [
      `## ${added.length} new AI tool candidate(s) — ${today}`,
      '',
      'Nothing is published until this PR is merged.',
      '',
      '**To review:** open each site. To reject a tool, delete its file in this PR. Fix `pricing`, `skillLevel`, `capabilities` or the tagline if needed, then merge.',
      '',
      '| Tool | Tagline | Capabilities | Source (score) | File |',
      '|---|---|---|---|---|',
      ...rows,
    ].join('\n'),
  );
  console.log(`Added ${added.length} candidate(s). Summary: ${SUMMARY_FILE}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
