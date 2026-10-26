import { useEffect, useMemo, useState } from 'react';
import taxonomy from '../data/taxonomy.json';
import ToolTile from './ToolTile';
import PipelineTile from './PipelineTile';
import { capabilityWeights, recommendPipelines, recommendTools, scoreTool, toolkitByCapability } from '../lib/match';
import { deleteMyData, loadUserData, onUserDataChange, signInWithGoogle, useAuthUser } from '../lib/userData';
import type { PipelineIndexEntry, Profile, ToolIndexEntry } from '../lib/types';

const capLabel = new Map(taxonomy.capabilities.map((c) => [c.id, c.label]));
const label = (id: string) => capLabel.get(id) ?? id;

export default function Dashboard() {
  const { ready, user, signInAvailable } = useAuthUser();
  const [tools, setTools] = useState<ToolIndexEntry[] | null>(null);
  const [pipelines, setPipelines] = useState<PipelineIndexEntry[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetch('/data/tools.json').then((r) => r.json()), fetch('/data/pipelines.json').then((r) => r.json())])
      .then(([t, p]) => {
        setTools(t);
        setPipelines(p);
      })
      .catch(() => setError('Could not load tools. Please refresh.'));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const refresh = () =>
      loadUserData()
        .then((d) => {
          setProfile(d.profile);
          setSaved(d.savedTools);
        })
        .catch(() => setError('Could not load your saved data.'))
        .finally(() => setLoaded(true));
    refresh();
    return onUserDataChange(refresh);
  }, [ready, user]);

  const plan = useMemo(() => {
    if (!tools || !profile) return null;
    const weights = capabilityWeights(profile);
    const cutoff = new Date(Date.now() - 45 * 86400_000).toISOString().slice(0, 10);
    return {
      picks: recommendTools(tools, profile, 6),
      pipelines: recommendPipelines(pipelines, profile, 4),
      toolkit: toolkitByCapability(tools, profile, 4, 3),
      fresh: tools
        .filter((t) => t.addedAt >= cutoff && scoreTool(t, weights, profile) > 0)
        .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
        .slice(0, 4),
    };
  }, [tools, pipelines, profile]);

  const trending = useMemo(
    () => (tools ? [...tools].sort((a, b) => b.addedAt.localeCompare(a.addedAt) || b.popularity - a.popularity).slice(0, 8) : []),
    [tools],
  );
  const savedTools = useMemo(() => (tools ? saved.map((s) => tools.find((t) => t.slug === s)).filter((t) => t !== undefined) : []), [tools, saved]);

  if (error) return <p className="card p-6 text-rose-600">{error}</p>;
  if (!loaded || !tools) return <div className="h-64 animate-pulse rounded-2xl bg-ink-100 dark:bg-white/5" aria-label="Loading" />;

  const name = user?.displayName?.split(' ')[0];

  if (!profile) {
    return (
      <div>
        <div className="card p-8 sm:p-10">
          <p className="eyebrow">Welcome{name ? `, ${name}` : ''}</p>
          <h1 className="heading-lg mt-2">Let's build your personal AI toolkit</h1>
          <p className="mt-2 max-w-xl muted">Answer five quick questions and we will recommend the tools and pipelines that fit your goals, skills and budget.</p>
          <a href="/start/" className="btn-primary mt-6">Start the assessment</a>
        </div>
        <h2 className="heading-lg mt-14">Trending right now</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {trending.map((t) => (
            <ToolTile key={t.slug} tool={t} capabilityLabel={label(t.capabilities[0])} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Your plan</p>
          <h1 className="heading-lg mt-2">{name ? `${name}, here` : 'Here'} is your AI toolkit</h1>
          <p className="mt-2 muted">
            Based on: {profile.tasks.map((t) => taxonomy.tasks.find((x) => x.id === t)?.label).filter(Boolean).join(', ')}
          </p>
        </div>
        <a href="/start/" className="btn-secondary">Edit answers</a>
      </div>

      {signInAvailable && !user && (
        <div className="card mt-6 flex flex-col items-start justify-between gap-3 border-brand-200 bg-brand-50/60 p-5 sm:flex-row sm:items-center dark:bg-brand-500/5">
          <p className="text-sm text-ink-700 dark:text-ink-200">Your plan is saved in this browser only. Sign in to keep it across devices.</p>
          <button type="button" className="btn-primary" onClick={() => signInWithGoogle().catch(() => {})}>Sign in with Google</button>
        </div>
      )}

      <section className="mt-12" aria-labelledby="picks">
        <h2 id="picks" className="text-xl font-semibold tracking-tight text-ink-900 dark:text-white">Your top picks</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plan?.picks.map((t) => (
            <ToolTile key={t.slug} tool={t} capabilityLabel={label(t.capabilities[0])} reason={`Matches: ${t.capabilities.slice(0, 2).map(label).join(' · ')}`} />
          ))}
        </div>
      </section>

      {plan && plan.pipelines.length > 0 && (
        <section className="mt-14" aria-labelledby="paths">
          <h2 id="paths" className="text-xl font-semibold tracking-tight text-ink-900 dark:text-white">Pipelines for you</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {plan.pipelines.map((p) => (
              <PipelineTile key={p.slug} pipeline={p} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-14" aria-labelledby="toolkit">
        <h2 id="toolkit" className="text-xl font-semibold tracking-tight text-ink-900 dark:text-white">Your toolkit by task</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {plan?.toolkit.map((s) => (
            <div key={s.capability} className="card p-5">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold text-ink-900 dark:text-white">{label(s.capability)}</h3>
                <a href={`/best/${s.capability}/`} className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">More →</a>
              </div>
              <ul className="mt-3 divide-y divide-ink-100 dark:divide-white/5">
                {s.tools.map((t) => (
                  <li key={t.slug}>
                    <a href={`/tools/${t.slug}/`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-brand-700 dark:hover:text-brand-300">
                      <span className="font-medium">{t.name}</span>
                      <span className="truncate text-xs muted">{t.tagline.slice(0, 60)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {plan && plan.fresh.length > 0 && (
        <section className="mt-14" aria-labelledby="fresh">
          <h2 id="fresh" className="text-xl font-semibold tracking-tight text-ink-900 dark:text-white">New for you</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plan.fresh.map((t) => (
              <ToolTile key={t.slug} tool={t} capabilityLabel={label(t.capabilities[0])} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-14" aria-labelledby="saved">
        <h2 id="saved" className="text-xl font-semibold tracking-tight text-ink-900 dark:text-white">Saved tools</h2>
        {savedTools.length === 0 ? (
          <p className="mt-3 text-sm muted">Tap “Save” on any tool page to keep it here.</p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {savedTools.map((t) => (
              <ToolTile key={t.slug} tool={t} capabilityLabel={label(t.capabilities[0])} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-16 border-t border-ink-200 pt-8 dark:border-white/10">
        <h2 className="text-sm font-semibold text-ink-900 dark:text-white">Your data</h2>
        <p className="mt-1 text-sm muted">We store only your answers and saved tools{user ? ' in your account' : ' in this browser'}.</p>
        <button
          type="button"
          className="mt-4 text-sm font-semibold text-rose-600 hover:underline"
          onClick={async () => {
            if (!window.confirm('Delete your answers, saved tools' + (user ? ' and your account' : '') + '? This cannot be undone.')) return;
            try {
              await deleteMyData();
              window.location.assign('/');
            } catch {
              setError('For security, please sign out and sign in again, then retry deleting your account.');
            }
          }}
        >
          Delete my data{user ? ' and account' : ''}
        </button>
      </section>
    </div>
  );
}
