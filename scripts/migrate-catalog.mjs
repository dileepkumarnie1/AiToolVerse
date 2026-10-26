// One-time import of the legacy AI-Tools-Gemini3 catalog into src/data/tools/*.json.
// Usage: node scripts/migrate-catalog.mjs <path-to-legacy-tools.json>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TOOLS_DIR, toolSchema, slugify, hostOf, inferCapabilities } from './lib/catalog.mjs';

const source = process.argv[2];
if (!source) {
  console.error('Usage: node scripts/migrate-catalog.mjs <legacy tools.json>');
  process.exit(1);
}

const SECTION_CAPS = {
  'Language & Chat': ['chat-assistant'],
  'Image Generation': ['image-generation'],
  'Video Tools': ['video-generation'],
  'Code Assistance': ['code-assistant'],
  'Audio & Music': ['music-generation'],
  'Design Tools': ['graphic-design'],
  Research: ['research-search'],
  'Marketing & SEO': ['marketing-seo'],
  'Data Analysis': ['data-analysis'],
  '3D Modeling': ['gaming-3d'],
  'Ethical AI': ['responsible-ai'],
  Education: ['education-tutor'],
  Crypto: ['finance'],
  'Prompt Enhancers': ['prompt-tools'],
  "Most famous agentic AI's": ['agents'],
  'Workflow Automation': ['automation'],
  'Search & Knowledge Discovery': ['research-search'],
  'AI Safety & Ethics': ['responsible-ai'],
  'Customer Support & Chatbots': ['customer-support'],
  'Legal & Compliance': ['legal'],
  'Healthcare & Medical AI': ['health-fitness'],
  'Finance & Accounting': ['finance'],
  'HR & Recruitment': ['hr-recruiting'],
  'Voice & Speech AI': ['voice-tts'],
  'Gaming & Entertainment': ['gaming-3d'],
  Cybersecurity: ['cybersecurity'],
  'Sales & CRM': ['sales-crm'],
  'Social Media & Content': ['social-media'],
  'E\u2011commerce & Retail': ['ecommerce'],
  'E-commerce & Retail': ['ecommerce'],
  'Real Estate & PropTech': ['real-estate'],
  'GitHub AI Projects': ['developer-api'],
  'AI Browsers': ['browser'],
  'AI Presentation Tools': ['presentations'],
  'Meeting Assistants': ['meeting-notes'],
  'Email Assistants': ['email'],
  'Translation & Localization': ['translation'],
  'Knowledge Management': ['notes-knowledge'],
  'Scheduling & Calendar': ['scheduling'],
  'Podcast Tools': ['podcast'],
  'AI Social Media Creation': ['social-media'],
  'Logo & Branding': ['logo-branding'],
  'Avatar & Virtual Influencer': ['avatar-video'],
  'AI Screen Recording & Tutorials': ['screen-recording'],
  'AI Note-Taking & PKM': ['notes-knowledge'],
  'AI Voice Cloning & TTS': ['voice-tts'],
  'AI Paraphrasing & Rewriting': ['writing'],
  'AI Background Removal': ['photo-editing'],
  'AI Form & Survey Builders': ['forms-surveys'],
  'AI Diagram & Flowchart Tools': ['diagrams'],
  'AI Document Tools': ['notes-knowledge'],
  'AI Travel & Booking': ['travel'],
  'AI Fitness & Wellness': ['health-fitness'],
  'AI Agriculture & Farming': ['industry-ops'],
  'AI Writing Assistants': ['writing'],
  'AI Photo Editing': ['photo-editing'],
  'AI Personal Finance': ['finance'],
  'AI Fashion & Styling': ['fashion'],
  'AI Developer Tools & APIs': ['developer-api'],
  'AI Transcription & Captioning': ['transcription'],
  'AI Interior Design': ['interior-design'],
  'AI Summarization Tools': ['summarization'],
  'AI Chatbot Builders': ['customer-support'],
  'AI Scientific Research': ['science'],
  'AI Supply Chain': ['industry-ops'],
  'AI Content Moderation': ['industry-ops'],
  'AI Customer Analytics': ['data-analysis'],
};

const SECTION_POPULARITY = { 'Most Popular': 90, 'Trending This Week': 85, 'Fresh Picks (Jan 2026)': 70 };
const SECTION_ADDED = { 'Fresh Picks (Jan 2026)': '2026-01-15', 'Trending This Week': '2026-01-15' };
const TRACKING = ['ref', 'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

const cleanUrl = (raw) => {
  try {
    const u = new URL(raw.trim());
    if (u.protocol === 'http:') u.protocol = 'https:';
    TRACKING.forEach((p) => u.searchParams.delete(p));
    u.hash = '';
    return u.toString();
  } catch {
    return '';
  }
};

const isExcluded = (url) => {
  const u = new URL(url);
  const host = hostOf(url);
  const path = u.pathname.toLowerCase();
  if (host === 'github.com' && path.split('/').filter(Boolean).length >= 2 && !path.startsWith('/features')) return true;
  if (host === 'openai.com' && (path.startsWith('/research/') || path === '/open-models')) return true;
  if (host === 'huggingface.co' && /^\/(docs|ethics|evaluate|inference-api)/.test(path)) return true;
  if (host === 'deepmind.google' && /^\/(discover\/blog|health)/.test(path)) return true;
  return false;
};

const pricingOf = (tags) => {
  const t = tags.map((x) => x.toLowerCase());
  if (t.includes('free') || t.includes('open source') || t.includes('open-source')) return 'free';
  if (t.includes('freemium')) return 'freemium';
  if (t.includes('paid') || t.includes('subscription') || t.includes('enterprise')) return 'paid';
  return 'freemium';
};

const skillOf = (caps, openSource) => {
  if (caps.some((c) => ['developer-api', 'code-assistant'].includes(c)) || openSource) return 'advanced';
  if (caps.some((c) => ['agents', 'automation', 'data-analysis', 'cybersecurity', 'app-builder'].includes(c))) return 'intermediate';
  return 'beginner';
};

const sentence = (text, max) => {
  const clean = String(text || '').replace(/\s+/g, ' ').replace(/[<>]/g, '').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
};

const legacy = JSON.parse(readFileSync(source, 'utf8'));
const byKey = new Map();

for (const section of legacy) {
  for (const raw of section.tools) {
    const url = cleanUrl(raw.link || '');
    if (!url || isExcluded(url) || !raw.name) continue;

    const key = `${slugify(raw.name.replace(/\(.*?\)/g, ''))}::${hostOf(url)}`;
    const tags = raw.tags || [];
    const sectionCaps = SECTION_CAPS[section.name] || [];
    const entry = byKey.get(key) || { raw, url, tags: new Set(), sectionCaps: new Set(), sections: new Set() };
    tags.forEach((t) => entry.tags.add(t));
    sectionCaps.forEach((c) => entry.sectionCaps.add(c));
    entry.sections.add(section.name);
    if ((raw.about || '').length > (entry.raw.about || '').length) entry.raw = raw;
    byKey.set(key, entry);
  }
}

mkdirSync(TOOLS_DIR, { recursive: true });
const usedSlugs = new Set();
let written = 0;
const failures = [];

for (const { raw, url, tags, sectionCaps, sections } of byKey.values()) {
  const tagList = [...tags];
  const openSource = tagList.some((t) => /open[ -]?source/i.test(t));
  const inferred = inferCapabilities([raw.name, ...tagList, ...sections]);
  let capabilities = [...new Set([...sectionCaps, ...inferred])].slice(0, 4);
  if (capabilities.length === 0) capabilities = inferCapabilities([raw.description]).slice(0, 2);
  if (capabilities.length === 0) capabilities = ['chat-assistant'];

  let slug = slugify(raw.name.replace(/\(.*?\)/g, ''));
  if (usedSlugs.has(slug)) slug = slugify(`${slug}-${hostOf(url).split('.')[0]}`);
  if (usedSlugs.has(slug)) continue;
  usedSlugs.add(slug);

  const popularity = Math.min(100, Math.max(...[...sections].map((s) => SECTION_POPULARITY[s] || 50)) + (sections.size - 1) * 3);
  const addedAt = [...sections].map((s) => SECTION_ADDED[s]).find(Boolean) || '2026-01-01';

  const tool = {
    slug,
    name: sentence(raw.name, 80),
    url,
    tagline: sentence(raw.description || `${raw.name} AI tool`, 220),
    about: raw.about ? sentence(raw.about, 1500) : undefined,
    pros: (raw.pros || []).slice(0, 6).map((p) => sentence(p, 200)).filter((p) => p.length >= 2),
    cons: (raw.cons || []).slice(0, 6).map((c) => sentence(c, 200)).filter((c) => c.length >= 2),
    capabilities,
    pricing: pricingOf(tagList),
    openSource,
    skillLevel: skillOf(capabilities, openSource),
    popularity,
    addedAt,
    source: 'legacy',
  };

  const parsed = toolSchema.safeParse(tool);
  if (!parsed.success) {
    failures.push(`${slug}: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
    continue;
  }
  writeFileSync(join(TOOLS_DIR, `${slug}.json`), `${JSON.stringify(parsed.data, null, 2)}\n`);
  written += 1;
}

console.log(`Wrote ${written} tools to ${TOOLS_DIR}`);
if (failures.length) console.log(`Skipped ${failures.length}:\n${failures.join('\n')}`);
