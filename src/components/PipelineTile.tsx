import type { PipelineIndexEntry } from '../lib/types';
import { SKILL_LABEL } from '../lib/labels';

export default function PipelineTile({ pipeline }: { pipeline: Pick<PipelineIndexEntry, 'slug' | 'title' | 'outcome' | 'difficulty' | 'timeToResult' | 'stepCount'> }) {
  return (
    <a href={`/pipelines/${pipeline.slug}/`} className="card card-hover group flex h-full flex-col p-6">
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: pipeline.stepCount }).map((_, i) => (
          <span key={i} className="h-1.5 flex-1 rounded-full bg-linear-to-r from-brand-400 to-fuchsia-400 opacity-70 first:opacity-100" />
        ))}
      </div>
      <h3 className="mt-5 text-lg font-semibold tracking-tight text-ink-900 group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">
        {pipeline.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{pipeline.outcome}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <span className="chip">{pipeline.stepCount} steps</span>
        <span className="chip">{pipeline.timeToResult}</span>
        <span className="chip">{SKILL_LABEL[pipeline.difficulty]}</span>
      </div>
    </a>
  );
}
