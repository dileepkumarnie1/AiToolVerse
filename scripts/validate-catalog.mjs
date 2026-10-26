// Validates every catalog file and pipeline. Runs before each build and in CI.
import { readFileSync } from 'node:fs';
import { PIPELINES_FILE, TAXONOMY, pipelineSchema, readTools, toolSchema, hostOf } from './lib/catalog.mjs';

const errors = [];
const slugs = new Set();
const hosts = new Map();

for (const { file, data } of readTools()) {
  const parsed = toolSchema.safeParse(data);
  if (!parsed.success) {
    errors.push(`${file}: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
    continue;
  }
  if (`${parsed.data.slug}.json` !== file) errors.push(`${file}: slug must match file name`);
  if (slugs.has(parsed.data.slug)) errors.push(`${file}: duplicate slug`);
  slugs.add(parsed.data.slug);
  const key = `${hostOf(parsed.data.url)}${new URL(parsed.data.url).pathname.replace(/\/$/, '')}`;
  if (hosts.has(key)) console.warn(`warn: ${file} shares URL with ${hosts.get(key)}`);
  hosts.set(key, file);
}

const pipelines = JSON.parse(readFileSync(PIPELINES_FILE, 'utf8'));
const pipelineSlugs = new Set();
for (const p of pipelines) {
  const parsed = pipelineSchema.safeParse(p);
  if (!parsed.success) {
    errors.push(`pipeline ${p.slug}: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
    continue;
  }
  if (pipelineSlugs.has(p.slug)) errors.push(`pipeline ${p.slug}: duplicate slug`);
  pipelineSlugs.add(p.slug);
  for (const step of p.steps) {
    for (const t of step.tools) if (!slugs.has(t)) errors.push(`pipeline ${p.slug}: unknown tool "${t}"`);
  }
}

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
for (const group of ['goals', 'tasks', 'interests']) {
  for (const { id } of TAXONOMY[group]) {
    if (!rules.includes(`'${id}'`)) errors.push(`firestore.rules: ${group} id "${id}" is missing from validProfile()`);
  }
}

if (errors.length) {
  console.error(`Catalog validation failed (${errors.length}):\n${errors.join('\n')}`);
  process.exit(1);
}
console.log(`Catalog OK: ${slugs.size} tools, ${pipelineSlugs.size} pipelines`);
