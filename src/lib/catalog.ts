import taxonomy from '../data/taxonomy.json';
import pipelinesData from '../data/pipelines.json';
import type { Capability, Category, Choice, Pipeline, PipelineIndexEntry, Tool, ToolIndexEntry } from './types';

const toolModules = import.meta.glob<Tool>('../data/tools/*.json', { eager: true, import: 'default' });

export const tools: Tool[] = Object.values(toolModules).sort(
  (a, b) => b.popularity - a.popularity || a.name.localeCompare(b.name),
);
export const toolBySlug = new Map(tools.map((t) => [t.slug, t]));

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
