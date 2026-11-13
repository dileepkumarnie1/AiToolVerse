import taxonomy from '../data/taxonomy.json';
import pipelinesData from '../data/pipelines.json';
import logoSlugs from '../data/logos.json';
import trendsData from '../data/trends.json';
import type { Capability, Category, Choice, Comparison, Pipeline, PipelineIndexEntry, Tool, ToolIndexEntry, TrendData, WeeklyIssue } from './types';

const toolModules = import.meta.glob<Tool>('../data/tools/*.json', { eager: true, import: 'default' });

const withLogo = new Set(logoSlugs as string[]);

export const tools: Tool[] = Object.values(toolModules)
  .map((t) => ({ ...t, logo: withLogo.has(t.slug) }))
  .sort((a, b) => b.popularity - a.popularity || a.name.localeCompare(b.name));
export const toolBySlug = new Map(tools.map((t) => [t.slug, t]));

export const trends = trendsData as TrendData;
export const trendOf = (tool: Pick<Tool, 'slug'>) => trends.tools[tool.slug];

/** The catalog sometimes lists one product twice; this identifies the product by its website address. */
const siteKey = (tool: Pick<Tool, 'url'>) => {
  const u = new URL(tool.url);
  return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
};
const onePerSite = (list: Tool[]) => {
  const seen = new Set<string>();
  return list.filter((t) => !seen.has(siteKey(t)) && seen.add(siteKey(t)));
};

const plainName = (tool: Pick<Tool, 'name'>) => tool.name.replace(/\s*\(.*?\)/g, '').trim().toLowerCase();
const namedWithin = (short: string, long: string) => short.length >= 4 && new RegExp(`(^|[^a-z0-9])${short.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(long);

/**
 * Tools ranked by how much they were discussed on Hacker News in the measured window.
 * The catalog lists some products more than once ("Claude" and "Anthropic Claude"), so an entry is
 * skipped when a higher-ranked one has the same website, the same top story, or its name inside this one's.
 */
export const trendingTools = (limit = 20) => {
  const kept: Tool[] = [];
  const ranked = tools.filter((t) => trends.tools[t.slug]).sort((a, b) => trends.tools[b.slug].points - trends.tools[a.slug].points);
  for (const tool of ranked) {
    if (kept.length >= limit) break;
    const repeat = kept.some(
      (k) =>
        siteKey(k) === siteKey(tool) ||
        trends.tools[k.slug].top.id === trends.tools[tool.slug].top.id ||
        namedWithin(plainName(k), plainName(tool)) ||
        namedWithin(plainName(tool), plainName(k)),
    );
    if (!repeat) kept.push(tool);
  }
  return kept;
};

/** Tools added in the last `days` days. Empty until tools are added after the first catalog import. */
export const recentlyAdded = (days = 30, limit = 12) => {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  return [...tools].filter((t) => t.addedAt >= cutoff).sort((a, b) => b.addedAt.localeCompare(a.addedAt)).slice(0, limit);
};

export const categories = taxonomy.categories as Category[];
export const capabilities = taxonomy.capabilities as Capability[];
export const goals = taxonomy.goals as Choice[];
export const tasks = taxonomy.tasks as Choice[];
export const interests = taxonomy.interests as Choice[];
export const capabilityById = new Map(capabilities.map((c) => [c.id, c]));
export const categoryById = new Map(categories.map((c) => [c.id, c]));

export const pipelines = pipelinesData as Pipeline[];
export const pipelineBySlug = new Map(pipelines.map((p) => [p.slug, p]));

export const categoryOf = (tool: Pick<Tool, 'capabilities'>) => capabilityById.get(tool.capabilities[0])?.category ?? 'writing';

export const toolsWithCapability = (capabilityId: string) => tools.filter((t) => t.capabilities.includes(capabilityId));

export const toolsInCategory = (categoryId: string) => tools.filter((t) => categoryOf(t) === categoryId);

export const alternativesFor = (tool: Tool, limit = 6) => {
  const caps = new Set(tool.capabilities);
  return tools
    .filter((t) => t.slug !== tool.slug)
    .map((t) => ({ t, overlap: t.capabilities.filter((c) => caps.has(c)).length + (t.capabilities[0] === tool.capabilities[0] ? 1 : 0) }))
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || b.t.popularity - a.t.popularity)
    .slice(0, limit)
    .map((x) => x.t);
};

export const pipelinesUsingTool = (slug: string) => pipelines.filter((p) => p.steps.some((s) => s.tools.includes(slug)));

export const pipelinesForCapability = (capabilityId: string) =>
  pipelines.filter((p) => p.steps.some((s) => s.capability === capabilityId));

/** Step alternatives: other popular tools with the same capability, excluding the step's picks. */
export const stepAlternatives = (capabilityId: string, exclude: string[], limit = 4) =>
  toolsWithCapability(capabilityId)
    .filter((t) => !exclude.includes(t.slug))
    .slice(0, limit);

export const newestTools = (limit = 12) =>
  [...tools].sort((a, b) => b.addedAt.localeCompare(a.addedAt) || b.popularity - a.popularity).slice(0, limit);

export const toIndexEntry = (t: Tool): ToolIndexEntry => ({
  slug: t.slug,
  name: t.name,
  tagline: t.tagline,
  capabilities: t.capabilities,
  category: categoryOf(t),
  pricing: t.pricing,
  skillLevel: t.skillLevel,
  popularity: t.popularity,
  addedAt: t.addedAt,
  ...(t.logo ? { logo: true } : {}),
  ...(trends.tools[t.slug] ? { trend: trends.tools[t.slug].points } : {}),
});

export const toPipelineIndexEntry = (p: Pipeline): PipelineIndexEntry => ({
  slug: p.slug,
  title: p.title,
  outcome: p.outcome,
  goals: p.goals,
  interests: p.interests,
  difficulty: p.difficulty,
  timeToResult: p.timeToResult,
  capabilities: [...new Set(p.steps.map((s) => s.capability))],
  stepCount: p.steps.length,
});

/* ---------- Comparisons and alternatives ---------- */

// Groups of well-known tools that are real alternatives to each other, best-known first.
// They are chosen by hand: the catalog's task tags are too coarse to pick fair matchups automatically.
// A slug that is missing from the catalog is skipped.
const RIVAL_GROUPS: { label: string; tools: string[] }[] = [
  { label: 'AI chat assistants', tools: ['chatgpt', 'claude', 'gemini', 'perplexity-ai', 'microsoft-copilot', 'grok', 'deepseek-chat', 'mistral-le-chat', 'meta-ai', 'kimi', 'poe'] },
  { label: 'AI coding assistants', tools: ['cursor', 'github-copilot', 'claude-code', 'windsurf', 'openai-codex', 'codeium', 'cline', 'tabnine', 'google-antigravity', 'zed', 'gemini-cli', 'kiro', 'amp', 'continue', 'aider', 'amazon-q-developer', 'jetbrains-ai-assistant'] },
  { label: 'AI app builders', tools: ['lovable', 'bolt-new', 'v0', 'replit-agent', 'base44', 'bubble', 'builder-io'] },
  { label: 'AI website builders', tools: ['wix', 'webflow', 'framer-ai'] },
  { label: 'AI image generators', tools: ['midjourney', 'dall-e-3', 'ideogram', 'adobe-firefly', 'leonardo-ai', 'stable-diffusion', 'flux', 'freepik', 'recraft', 'dreamstudio', 'nightcafe'] },
  { label: 'AI video generators', tools: ['runway', 'pika', 'kling-ai', 'sora', 'luma-dream-machine', 'google-veo', 'google-flow', 'hailuo-ai', 'higgsfield', 'pixverse', 'dreamina', 'invideo', 'haiper'] },
  { label: 'AI avatar video tools', tools: ['synthesia', 'heygen', 'd-id', 'colossyan', 'tavus', 'captions'] },
  { label: 'AI voice generators', tools: ['elevenlabs', 'murf-ai', 'play-ht', 'wellsaid-labs', 'resemble-ai', 'speechify', 'naturalreader', 'cartesia', 'hume-ai'] },
  { label: 'AI music generators', tools: ['suno-ai', 'udio', 'aiva', 'soundraw', 'boomy', 'mubert'] },
  { label: 'AI meeting assistants', tools: ['otter-ai', 'fireflies-ai', 'fathom', 'granola', 'tl-dv', 'read-ai', 'zoom-ai-companion', 'krisp', 'avoma', 'circleback'] },
  { label: 'AI dictation tools', tools: ['wispr-flow', 'superwhisper'] },
  { label: 'AI writing assistants', tools: ['grammarly', 'quillbot', 'ai21-wordtune', 'languagetool', 'prowritingaid', 'hemingway-editor', 'sudowrite', 'lex', 'novelai'] },
  { label: 'AI marketing copy tools', tools: ['jasper-ai', 'copy-ai', 'writesonic', 'anyword', 'rytr', 'hyperwrite'] },
  { label: 'SEO tools', tools: ['semrush', 'ahrefs', 'surfer-seo', 'clearscope', 'frase'] },
  { label: 'Automation platforms', tools: ['zapier', 'n8n', 'make', 'gumloop', 'ifttt', 'pipedream', 'activepieces', 'bardeen', 'lindy'] },
  { label: 'AI agents', tools: ['manus', 'genspark', 'openclaw'] },
  { label: 'AI research tools', tools: ['perplexity-ai', 'consensus', 'elicit', 'notebook-llm', 'you-com', 'chatpdf', 'scite', 'scispace', 'paperpal', 'semantic-scholar', 'kagi'] },
  { label: 'AI note-taking tools', tools: ['notion-ai', 'obsidian', 'mem', 'reflect', 'tana', 'capacities', 'coda-ai'] },
  { label: 'AI presentation makers', tools: ['gamma', 'beautiful-ai', 'tome', 'canva-presentations', 'pitch', 'decktopus', 'napkin-ai', 'plusai', 'magicslides'] },
  { label: 'AI video editors', tools: ['capcut', 'descript', 'veed-io', 'opus-clip', 'kapwing', 'filmora', 'submagic', 'pictory', 'clipchamp'] },
  { label: 'AI design tools', tools: ['canva-ai', 'figma-ai', 'adobe-express', 'picsart', 'uizard', 'google-stitch', 'looka', 'designs-ai', 'visily'] },
  { label: 'AI translation tools', tools: ['deepl', 'google-translate', 'unbabel', 'lokalise-ai'] },
  { label: 'AI browsers', tools: ['perplexity-comet', 'chatgpt-atlas', 'dia', 'arc-browser'] },
  { label: 'AI customer support agents', tools: ['intercom-fin', 'zendesk-ai', 'decagon', 'sierra', 'tidio'] },
  { label: 'AI voice agent platforms', tools: ['vapi', 'retell-ai'] },
  { label: 'AI model platforms', tools: ['hugging-face', 'openrouter', 'groq', 'together-ai', 'replicate', 'fireworks-ai', 'cerebras', 'amazon-bedrock'] },
  { label: 'Language learning apps', tools: ['duolingo-max', 'speak', 'elsa-speak'] },
];
// Each group's five best-known tools are compared with one another; the whole group is listed as alternatives.
const COMPARED_PER_GROUP = 5;
// Matchups shown first on the Compare page and on the home page.
const HEADLINE_MATCHUPS = [
  ['chatgpt', 'claude'],
  ['cursor', 'github-copilot'],
  ['midjourney', 'ideogram'],
  ['synthesia', 'heygen'],
  ['chatgpt', 'gemini'],
  ['lovable', 'bolt-new'],
  ['otter-ai', 'fireflies-ai'],
  ['elevenlabs', 'murf-ai'],
  ['zapier', 'n8n'],
  ['suno-ai', 'udio'],
  ['runway', 'pika'],
  ['grammarly', 'quillbot'],
];

export const compareSlug = (a: Pick<Tool, 'slug'>, b: Pick<Tool, 'slug'>) => [a.slug, b.slug].sort().join('-vs-');

const rivalGroups = RIVAL_GROUPS.map((group) => ({ label: group.label, tools: onePerSite(group.tools.map((slug) => toolBySlug.get(slug)).filter((t) => t !== undefined)) }));
const comparisonBySlug = new Map<string, Comparison>();
for (const group of rivalGroups) {
  const compared = group.tools.slice(0, COMPARED_PER_GROUP);
  compared.forEach((a, i) =>
    compared.slice(i + 1).forEach((b) => {
      const slug = compareSlug(a, b);
      if (!comparisonBySlug.has(slug)) comparisonBySlug.set(slug, { slug, a, b, group: group.label });
    }),
  );
}

/** Well-known tools from the groups above, taking each group's best-known tool first so the list is varied. */
export const knownTools = [
  ...new Set(
    Array.from({ length: Math.max(...rivalGroups.map((g) => g.tools.length)) }, (_, i) => rivalGroups.map((g) => g.tools[i]))
      .flat()
      .filter((t) => t !== undefined),
  ),
];

export const comparisons = [...comparisonBySlug.values()];
export const headlineComparisons = HEADLINE_MATCHUPS.map(([a, b]) => comparisonBySlug.get([a, b].sort().join('-vs-'))).filter((c) => c !== undefined);
export const comparisonFor = (a: Tool, b: Tool) => comparisonBySlug.get(compareSlug(a, b));
export const comparisonsWith = (tool: Tool) => comparisons.filter((c) => c.a === tool || c.b === tool);

/** The other tools in this tool's group or groups, best-known first. Empty for tools outside the curated groups. */
export const rivalsFor = (tool: Tool) => [...new Set(rivalGroups.filter((g) => g.tools.includes(tool)).flatMap((g) => g.tools))].filter((t) => t !== tool);
export const rivalGroupOf = (tool: Tool) => rivalGroups.find((g) => g.tools.includes(tool))?.label;
export const hasAlternativesPage = (tool: Tool) => rivalsFor(tool).length >= 3;
export const toolsWithAlternatives = tools.filter(hasAlternativesPage);

/* ---------- This week in AI ---------- */

const weeklyModules = import.meta.glob<WeeklyIssue>('../data/weekly/*.json', { eager: true, import: 'default' });
export const weeklyIssues = Object.values(weeklyModules).sort((a, b) => b.date.localeCompare(a.date));
