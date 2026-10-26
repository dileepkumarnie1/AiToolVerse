import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

export const ROOT = new URL('../../', import.meta.url).pathname;
export const TOOLS_DIR = join(ROOT, 'src/data/tools');
export const PIPELINES_FILE = join(ROOT, 'src/data/pipelines.json');
export const TAXONOMY = JSON.parse(readFileSync(join(ROOT, 'src/data/taxonomy.json'), 'utf8'));

const capabilityIds = TAXONOMY.capabilities.map((c) => c.id);
const plainText = (min, max) =>
  z.string().trim().min(min).max(max).refine((s) => !/[<>]/.test(s), 'must not contain HTML');

export const httpsUrl = z
  .url()
  .refine((u) => {
    const { protocol, hostname } = new URL(u);
    return protocol === 'https:' && hostname.includes('.') && !/^[\d.]+$/.test(hostname) && hostname !== 'localhost';
  }, 'must be a public https URL');

export const toolSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60),
    name: plainText(1, 80),
    url: httpsUrl,
    tagline: plainText(10, 220),
    about: plainText(0, 1500).optional(),
    pros: z.array(plainText(2, 200)).max(6).default([]),
    cons: z.array(plainText(2, 200)).max(6).default([]),
    capabilities: z.array(z.enum(capabilityIds)).min(1).max(5),
    pricing: z.enum(['free', 'freemium', 'paid']),
    openSource: z.boolean().default(false),
    skillLevel: z.enum(['beginner', 'intermediate', 'advanced']),
    popularity: z.number().int().min(0).max(100),
    addedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    source: z.enum(['legacy', 'hackernews', 'producthunt', 'suggestion', 'manual']),
    sourceUrl: httpsUrl.optional(),
  })
  .strict();

export const pipelineSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: plainText(5, 90),
    outcome: plainText(10, 200),
    summary: plainText(20, 400),
    goals: z.array(z.enum(TAXONOMY.goals.map((g) => g.id))).min(1),
    interests: z.array(z.enum(TAXONOMY.interests.map((i) => i.id))).default([]),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    timeToResult: plainText(3, 40),
    steps: z
      .array(
        z
          .object({
            title: plainText(3, 80),
            description: plainText(10, 400),
            capability: z.enum(capabilityIds),
            tools: z.array(z.string()).min(1).max(3),
            tip: plainText(5, 300).optional(),
          })
          .strict(),
      )
      .min(2)
      .max(8),
  })
  .strict();

export const readTools = () =>
  readdirSync(TOOLS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: f, data: JSON.parse(readFileSync(join(TOOLS_DIR, f), 'utf8')) }));

export const slugify = (value) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');

export const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
};

const keywordMatchers = TAXONOMY.capabilities.map((c) => ({
  id: c.id,
  patterns: c.keywords.map((k) => new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')),
}));

/** Capabilities whose keywords appear in any of the given texts, ordered by number of hits. */
export const inferCapabilities = (texts) => {
  const hay = texts.filter(Boolean).map((t) => String(t).toLowerCase());
  return keywordMatchers
    .map(({ id, patterns }) => ({ id, hits: patterns.reduce((n, p) => n + hay.filter((t) => p.test(t)).length, 0) }))
    .filter((m) => m.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map((m) => m.id);
};
