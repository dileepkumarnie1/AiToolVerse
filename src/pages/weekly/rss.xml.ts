import type { APIRoute } from 'astro';
import { weeklyIssues } from '../../lib/catalog';

const SITE = 'https://aitoolverse.ai';
const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = () => {
  const items = weeklyIssues
    .map((issue) => {
      const link = `${SITE}/weekly/${issue.slug}/`;
      const summary = `${issue.intro} ${issue.news.map((n) => n.title).join(' · ')}`;
      return `<item><title>${escape(issue.title)}</title><link>${link}</link><guid isPermaLink="true">${link}</guid><pubDate>${new Date(`${issue.date}T08:00:00Z`).toUTCString()}</pubDate><description>${escape(summary)}</description></item>`;
    })
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>This week in AI · AIToolVerse</title><link>${SITE}/weekly/</link><description>The AI news people discussed most, and the tools at the centre of it.</description><language>en</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
};
