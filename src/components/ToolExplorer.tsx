import { useEffect, useMemo, useState } from 'react';
import MiniSearch from 'minisearch';
import ToolTile from './ToolTile';
import type { Category, ToolIndexEntry } from '../lib/types';

interface Props {
  initialTools: ToolIndexEntry[];
  categories: Category[];
  capabilityLabels: Record<string, string>;
  initialCategory?: string;
}

const PAGE = 48;

export default function ToolExplorer({ initialTools, categories, capabilityLabels, initialCategory = '' }: Props) {
  const [all, setAll] = useState<ToolIndexEntry[]>(initialTools);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [pricing, setPricing] = useState('');
  const [skill, setSkill] = useState('');
  const [sort, setSort] = useState<'popular' | 'newest'>('popular');
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setQuery(q.slice(0, 100));
    fetch('/data/tools.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: ToolIndexEntry[]) => setAll(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');
    window.history.replaceState(null, '', url);
    setLimit(PAGE);
  }, [query, category, pricing, skill, sort]);

  const search = useMemo(() => {
    const ms = new MiniSearch<ToolIndexEntry & { id: string; caps: string }>({
      fields: ['name', 'tagline', 'caps'],
      storeFields: ['slug'],
      searchOptions: { boost: { name: 3, caps: 2 }, prefix: true, fuzzy: 0.15 },
    });
    ms.addAll(all.map((t) => ({ ...t, id: t.slug, caps: t.capabilities.map((c) => capabilityLabels[c] ?? c).join(' ') })));
    return ms;
  }, [all, capabilityLabels]);

  const results = useMemo(() => {
    let list = all;
    if (query.trim()) {
      const bySlug = new Map(all.map((t) => [t.slug, t]));
      list = search
        .search(query.trim())
        .map((r) => ({ tool: bySlug.get(r.id as string)!, score: r.score * (0.5 + (bySlug.get(r.id as string)?.popularity ?? 0) / 100) }))
        .filter((x) => x.tool)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.tool);
    } else if (sort === 'newest') {
      list = [...all].sort((a, b) => b.addedAt.localeCompare(a.addedAt) || b.popularity - a.popularity);
    }
    return list.filter(
      (t) => (!category || t.category === category) && (!pricing || t.pricing === pricing) && (!skill || t.skillLevel === skill),
    );
  }, [all, search, query, category, pricing, skill, sort]);

  const select = 'input w-auto py-2 pr-8';

  return (
    <div>
      <div className="card sticky top-[4.5rem] z-30 flex flex-col gap-3 p-3 shadow-lg sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="tool-search">Search tools</label>
        <input
          id="tool-search"
          type="search"
          value={query}
          maxLength={100}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or task, e.g. “transcribe interviews”"
          className="input flex-1 py-2"
        />
        <div className="flex flex-wrap gap-2">
          <select aria-label="Category" className={select} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <select aria-label="Pricing" className={select} value={pricing} onChange={(e) => setPricing(e.target.value)}>
            <option value="">Any price</option>
            <option value="free">Free</option>
            <option value="freemium">Free plan</option>
            <option value="paid">Paid</option>
          </select>
          <select aria-label="Skill level" className={select} value={skill} onChange={(e) => setSkill(e.target.value)}>
            <option value="">Any level</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          {!query && (
            <select aria-label="Sort" className={select} value={sort} onChange={(e) => setSort(e.target.value as 'popular' | 'newest')}>
              <option value="popular">Most popular</option>
              <option value="newest">Newest</option>
            </select>
          )}
        </div>
      </div>

      <p className="mt-6 text-sm muted" aria-live="polite">
        {results.length} {results.length === 1 ? 'tool' : 'tools'}
        {query && <> for “{query}”</>}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {results.slice(0, limit).map((t) => (
          <ToolTile key={t.slug} tool={t} capabilityLabel={capabilityLabels[t.capabilities[0]]} />
        ))}
      </div>

      {results.length === 0 && (
        <div className="card mt-4 p-10 text-center">
          <p className="font-semibold">No tools match those filters.</p>
          <p className="mt-1 text-sm muted">Try fewer words, or let us recommend tools for your goal.</p>
          <a href="/start/" className="btn-primary mt-5">Get recommendations</a>
        </div>
      )}

      {results.length > limit && (
        <div className="mt-10 text-center">
          <button type="button" className="btn-secondary" onClick={() => setLimit((l) => l + PAGE)}>
            Show more ({results.length - limit} left)
          </button>
        </div>
      )}
    </div>
  );
}
