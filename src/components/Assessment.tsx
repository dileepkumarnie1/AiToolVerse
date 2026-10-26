import { useEffect, useState } from 'react';
import taxonomy from '../data/taxonomy.json';
import { loadUserData, saveProfile, signInWithGoogle, useAuthUser } from '../lib/userData';
import type { Choice, Pricing, Profile, SkillLevel } from '../lib/types';

type StepId = 'goals' | 'tasks' | 'interests' | 'skill' | 'budget';
const STEPS: { id: StepId; title: string; hint: string }[] = [
  { id: 'goals', title: 'What brings you here?', hint: 'Pick all that apply.' },
  { id: 'tasks', title: 'What do you want AI to help with?', hint: 'Pick up to five. This shapes your recommendations most.' },
  { id: 'interests', title: 'Any hobbies or passions?', hint: 'Optional. We will add pipelines for them.' },
  { id: 'skill', title: 'How comfortable are you with AI tools?', hint: 'We will avoid tools that are too technical.' },
  { id: 'budget', title: 'What is your budget?', hint: 'You can always change this later.' },
];

const SKILLS: { id: SkillLevel; label: string; description: string }[] = [
  { id: 'beginner', label: 'New to AI', description: 'I have tried ChatGPT a few times, at most.' },
  { id: 'intermediate', label: 'Comfortable', description: 'I use a few AI tools regularly.' },
  { id: 'advanced', label: 'Power user', description: 'I am technical or happy to set things up.' },
];
const BUDGETS: { id: Pricing; label: string; description: string }[] = [
  { id: 'free', label: 'Free only', description: 'Free tools and free plans.' },
  { id: 'freemium', label: 'Mostly free', description: 'Free plans first; paid if it is clearly worth it.' },
  { id: 'paid', label: 'Paid is fine', description: 'Show me the best, whatever the price.' },
];

const MAX_TASKS = 5;

export default function Assessment() {
  const { ready, user, signInAvailable } = useAuthUser();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile>({ goals: [], tasks: [], interests: [], skill: 'beginner', budget: 'freemium' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ready) return;
    loadUserData()
      .then(({ profile: existing }) => {
        const goal = new URLSearchParams(window.location.search).get('goal');
        const preset = goal && taxonomy.goals.some((g) => g.id === goal) ? [goal] : [];
        if (existing) setProfile({ ...existing, goals: [...new Set([...existing.goals, ...preset])] });
        else if (preset.length) setProfile((p) => ({ ...p, goals: preset }));
      })
      .catch(() => {});
  }, [ready, user]);

  const current = STEPS[step];
  const toggle = (key: 'goals' | 'tasks' | 'interests', id: string) =>
    setProfile((p) => {
      const list = p[key];
      if (list.includes(id)) return { ...p, [key]: list.filter((x) => x !== id) };
      if (key === 'tasks' && list.length >= MAX_TASKS) return p;
      return { ...p, [key]: [...list, id] };
    });

  const canContinue = current.id === 'goals' ? profile.goals.length > 0 : current.id === 'tasks' ? profile.tasks.length > 0 : true;

  const finish = async (withSignIn: boolean) => {
    setSaving(true);
    try {
      if (withSignIn) await signInWithGoogle();
      await saveProfile(profile);
      window.location.assign('/dashboard/');
    } catch (e) {
      console.warn(e);
      setSaving(false);
    }
  };

  const multi = (key: 'goals' | 'tasks' | 'interests', options: Choice[]) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((o) => {
        const active = profile[key].includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(key, o.id)}
            className={`rounded-2xl border p-4 text-left transition ${
              active
                ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30'
                : 'border-ink-200 bg-white hover:border-ink-300 dark:border-white/10 dark:bg-ink-900'
            }`}
          >
            <span className="block font-medium text-ink-900 dark:text-white">{o.label}</span>
            {o.description && <span className="mt-0.5 block text-sm muted">{o.description}</span>}
          </button>
        );
      })}
    </div>
  );

  const single = <T extends string>(value: T, options: { id: T; label: string; description: string }[], set: (v: T) => void) => (
    <div className="grid gap-3" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => set(o.id)}
          className={`rounded-2xl border p-4 text-left transition ${
            value === o.id
              ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30'
              : 'border-ink-200 bg-white hover:border-ink-300 dark:border-white/10 dark:bg-ink-900'
          }`}
        >
          <span className="block font-medium text-ink-900 dark:text-white">{o.label}</span>
          <span className="mt-0.5 block text-sm muted">{o.description}</span>
        </button>
      ))}
    </div>
  );

  const isLast = step === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-2" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span key={s.id} className={`h-1.5 flex-1 rounded-full transition ${i <= step ? 'bg-brand-500' : 'bg-ink-200 dark:bg-white/10'}`} />
        ))}
      </div>
      <p className="mt-6 text-sm muted">
        Step {step + 1} of {STEPS.length}
      </p>
      <h1 className="heading-lg mt-1">{current.title}</h1>
      <p className="mt-2 muted">{current.hint}</p>

      <div className="mt-8">
        {current.id === 'goals' && multi('goals', taxonomy.goals)}
        {current.id === 'tasks' && multi('tasks', taxonomy.tasks)}
        {current.id === 'interests' && multi('interests', taxonomy.interests)}
        {current.id === 'skill' && single(profile.skill, SKILLS, (skill) => setProfile((p) => ({ ...p, skill })))}
        {current.id === 'budget' && single(profile.budget, BUDGETS, (budget) => setProfile((p) => ({ ...p, budget })))}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="btn-secondary" disabled={step === 0 || saving} onClick={() => setStep((s) => s - 1)}>
          Back
        </button>
        {!isLast && (
          <button type="button" className="btn-primary" disabled={!canContinue} onClick={() => setStep((s) => s + 1)}>
            Continue
          </button>
        )}
        {isLast && (
          <div className="flex flex-wrap gap-2">
            {signInAvailable && !user ? (
              <>
                <button type="button" className="btn-secondary" disabled={saving} onClick={() => finish(false)}>
                  Continue without account
                </button>
                <button type="button" className="btn-primary" disabled={saving} onClick={() => finish(true)}>
                  {saving ? 'Saving…' : 'Sign in & save my plan'}
                </button>
              </>
            ) : (
              <button type="button" className="btn-primary" disabled={saving} onClick={() => finish(false)}>
                {saving ? 'Saving…' : 'See my plan'}
              </button>
            )}
          </div>
        )}
      </div>
      <p className="mt-8 text-xs muted">
        Your answers are only used to recommend tools. Without an account they stay in this browser. With an account they are stored privately
        and you can delete them any time.
      </p>
    </div>
  );
}
