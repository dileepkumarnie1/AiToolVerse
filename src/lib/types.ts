export type Pricing = 'free' | 'freemium' | 'paid';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Tool {
  slug: string;
  name: string;
  url: string;
  tagline: string;
  about?: string;
  pros: string[];
  cons: string[];
  capabilities: string[];
  pricing: Pricing;
  openSource: boolean;
  skillLevel: SkillLevel;
  popularity: number;
  addedAt: string;
  source: 'legacy' | 'hackernews' | 'producthunt' | 'suggestion' | 'manual';
  sourceUrl?: string;
}

export interface Capability {
  id: string;
  label: string;
  category: string;
  keywords: string[];
  howTo: string[];
  samplePrompt: string;
}

export interface Category {
  id: string;
  label: string;
  description: string;
}

export interface Choice {
  id: string;
  label: string;
  description?: string;
  capabilities: string[];
}

export interface PipelineStep {
  title: string;
  description: string;
  capability: string;
  tools: string[];
  tip?: string;
}

export interface Pipeline {
  slug: string;
  title: string;
  outcome: string;
  summary: string;
  goals: string[];
  interests: string[];
  difficulty: SkillLevel;
  timeToResult: string;
  steps: PipelineStep[];
}

/** Compact tool shape shipped to the browser for search and recommendations. */
export interface ToolIndexEntry {
  slug: string;
  name: string;
  tagline: string;
  capabilities: string[];
  category: string;
  pricing: Pricing;
  skillLevel: SkillLevel;
  popularity: number;
  addedAt: string;
}

export interface PipelineIndexEntry {
  slug: string;
  title: string;
  outcome: string;
  goals: string[];
  interests: string[];
  difficulty: SkillLevel;
  timeToResult: string;
  capabilities: string[];
  stepCount: number;
}

export interface Profile {
  goals: string[];
  tasks: string[];
  interests: string[];
  skill: SkillLevel;
  budget: Pricing;
}
