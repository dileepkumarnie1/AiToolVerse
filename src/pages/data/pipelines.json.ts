import type { APIRoute } from 'astro';
import { pipelines, toPipelineIndexEntry } from '../../lib/catalog';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(pipelines.map(toPipelineIndexEntry)), { headers: { 'content-type': 'application/json' } });
