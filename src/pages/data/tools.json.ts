import type { APIRoute } from 'astro';
import { tools, toIndexEntry } from '../../lib/catalog';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(tools.map(toIndexEntry)), { headers: { 'content-type': 'application/json' } });
