import type { Pricing, SkillLevel } from '../lib/types';

export const PRICING_LABEL: Record<Pricing, string> = { free: 'Free', freemium: 'Free plan', paid: 'Paid' };
export const SKILL_LABEL: Record<SkillLevel, string> = { beginner: 'Beginner-friendly', intermediate: 'Intermediate', advanced: 'Advanced' };

export const isNew = (addedAt: string, days = 14) => Date.now() - new Date(`${addedAt}T00:00:00Z`).getTime() < days * 86400_000;
