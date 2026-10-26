import ToolAvatar from './ToolAvatar';
import { PRICING_LABEL, isNew } from '../lib/labels';
import type { ToolIndexEntry } from '../lib/types';

interface Props {
  tool: Pick<ToolIndexEntry, 'slug' | 'name' | 'tagline' | 'pricing' | 'addedAt'>;
  capabilityLabel?: string;
  reason?: string;
}

export default function ToolTile({ tool, capabilityLabel, reason }: Props) {
  return (
    <a href={`/tools/${tool.slug}/`} className="card card-hover group flex h-full flex-col gap-3 p-5">
      <div className="flex items-start gap-3">
        <ToolAvatar slug={tool.slug} name={tool.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-ink-900 group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">
              {tool.name}
            </h3>
            {isNew(tool.addedAt) && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                New
              </span>
            )}
          </div>
          {capabilityLabel && <p className="mt-0.5 text-xs muted">{capabilityLabel}</p>}
        </div>
      </div>
      <p className="line-clamp-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{tool.tagline}</p>
      {reason && <p className="text-xs font-medium text-brand-700 dark:text-brand-300">{reason}</p>}
      <div className="mt-auto flex items-center justify-between pt-1">
        <span className="chip">{PRICING_LABEL[tool.pricing]}</span>
        <span className="text-xs font-medium text-ink-400 transition group-hover:text-brand-600">View →</span>
      </div>
    </a>
  );
}
