import type { APIRoute } from 'astro';
import { capabilityById, comparisons, pipelines, tools } from '../../lib/catalog';

const shortName = (name: string) => name.replace(/\s*\(.*?\)/g, '').trim();

// Compact index for the search box that opens from any page (src/scripts/palette.ts).
// Rows are arrays to keep the file small: the field order is documented in palette.ts.
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      tools: tools.map((t) => [t.slug, t.name, t.tagline, capabilityById.get(t.capabilities[0])?.label ?? '', t.pricing, t.logo ? 1 : 0, t.popularity]),
      pipelines: pipelines.map((p) => [p.slug, p.title, p.outcome]),
      comparisons: comparisons.map((c) => [c.slug, shortName(c.a.name), shortName(c.b.name)]),
    }),
    { headers: { 'content-type': 'application/json' } },
  );
