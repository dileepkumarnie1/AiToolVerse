import type { Pricing, SkillLevel } from '../lib/types';

export const PRICING_LABEL: Record<Pricing, string> = { free: 'Free', freemium: 'Free plan', paid: 'Paid' };
export const SKILL_LABEL: Record<SkillLevel, string> = { beginner: 'Beginner-friendly', intermediate: 'Intermediate', advanced: 'Advanced' };

export const isNew = (addedAt: string, days = 14) => Date.now() - new Date(`${addedAt}T00:00:00Z`).getTime() < days * 86400_000;

/** "ChatGPT (OpenAI)" -> "ChatGPT". */
export const shortName = (name: string) => name.replace(/\s*\(.*?\)/g, '').trim();

/** "2026-11-13" -> "13 November 2026". */
export const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Width step (1-20, in 5% steps) for a trend bar: the tool's points as a share of the leader's.
 * Bars use classes, not inline widths, because the site's security policy blocks inline styles.
 */
export const heatLevel = (points: number, top: number) => Math.max(1, Math.min(20, Math.ceil((points / Math.max(1, top)) * 20)));
