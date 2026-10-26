import taxonomy from '../data/taxonomy.json';
import type { PipelineIndexEntry, Profile, SkillLevel, ToolIndexEntry } from './types';

const SKILL_RANK: Record<SkillLevel, number> = { beginner: 0, intermediate: 1, advanced: 2 };

const choiceCaps = (list: { id: string; capabilities: string[] }[], ids: string[]) =>
  list.filter((c) => ids.includes(c.id)).flatMap((c) => c.capabilities);

/** How much each capability matters to this user: tasks > interests > broad goals. */
export const capabilityWeights = (profile: Profile) => {
  const weights = new Map<string, number>();
  const add = (caps: string[], w: number) => caps.forEach((c) => weights.set(c, (weights.get(c) ?? 0) + w));
  add(choiceCaps(taxonomy.goals, profile.goals), 1);
  add(choiceCaps(taxonomy.interests, profile.interests), 1.5);
  add(choiceCaps(taxonomy.tasks, profile.tasks), 2.5);
  return weights;
};

const fitMultiplier = (tool: Pick<ToolIndexEntry, 'pricing' | 'skillLevel'>, profile: Profile) => {
  if (profile.budget === 'free' && tool.pricing === 'paid') return 0;
  let m = profile.budget === 'freemium' && tool.pricing === 'paid' ? 0.7 : 1;
  const gap = SKILL_RANK[tool.skillLevel] - SKILL_RANK[profile.skill];
  if (gap === 2) m *= 0.45;
  else if (gap === 1) m *= 0.8;
  return m;
};

export const scoreTool = (tool: ToolIndexEntry, weights: Map<string, number>, profile: Profile) => {
  const relevance = tool.capabilities.reduce((sum, c, i) => sum + (weights.get(c) ?? 0) * (i === 0 ? 1 : 0.6), 0);
  if (relevance === 0) return 0;
  return relevance * fitMultiplier(tool, profile) * (0.3 + tool.popularity / 100);
};

/** Top tools for the profile, with at most `perCapability` sharing the same primary capability. */
export const recommendTools = (all: ToolIndexEntry[], profile: Profile, limit = 12, perCapability = 2) => {
  const weights = capabilityWeights(profile);
  const counts = new Map<string, number>();
  return all
    .map((tool) => ({ tool, score: scoreTool(tool, weights, profile) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .filter(({ tool }) => {
      const key = tool.capabilities[0];
      const n = counts.get(key) ?? 0;
      if (n >= perCapability) return false;
      counts.set(key, n + 1);
      return true;
    })
    .slice(0, limit)
    .map((x) => x.tool);
};

/** The user's most important capabilities, each with its best-fitting tools. */
export const toolkitByCapability = (all: ToolIndexEntry[], profile: Profile, sections = 4, perSection = 3) => {
  const weights = capabilityWeights(profile);
  return [...weights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, sections)
    .map(([capability]) => ({
      capability,
      tools: all
        .filter((t) => t.capabilities.includes(capability))
        .map((tool) => ({ tool, score: fitMultiplier(tool, profile) * (0.3 + tool.popularity / 100) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, perSection)
        .map((x) => x.tool),
    }))
    .filter((s) => s.tools.length > 0);
};

export const recommendPipelines = (all: PipelineIndexEntry[], profile: Profile, limit = 4) => {
  const weights = capabilityWeights(profile);
  return all
    .map((p) => {
      const goalHits = p.goals.filter((g) => profile.goals.includes(g)).length;
      const interestHits = p.interests.filter((i) => profile.interests.includes(i)).length;
      const capScore = p.capabilities.reduce((s, c) => s + (weights.get(c) ?? 0), 0);
      const tooHard = SKILL_RANK[p.difficulty] - SKILL_RANK[profile.skill] >= 2 ? 0.5 : 1;
      return { p, score: (goalHits * 3 + interestHits * 4 + capScore * 0.6) * tooHard };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
};

export const isValidProfile = (value: unknown): value is Profile => {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  const strList = (v: unknown) => Array.isArray(v) && v.length <= 20 && v.every((x) => typeof x === 'string');
  return (
    strList(p.goals) &&
    strList(p.tasks) &&
    strList(p.interests) &&
    ['beginner', 'intermediate', 'advanced'].includes(p.skill as string) &&
    ['free', 'freemium', 'paid'].includes(p.budget as string)
  );
};
