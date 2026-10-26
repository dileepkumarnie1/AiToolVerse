import { useState, type SubmitEvent } from 'react';
import { getFirebase } from '../lib/firebase';
import { signInWithGoogle, useAuthUser } from '../lib/userData';

const MAX_PER_DAY = 5;

export default function SuggestForm() {
  const { ready, user, signInAvailable } = useAuthUser();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | 'limit'>('idle');

  if (!ready) return null;

  if (!signInAvailable) {
    return (
      <div className="card p-7">
        <p className="text-ink-700 dark:text-ink-200">Email the tool name, website and what it helps with. We review every suggestion.</p>
        <a className="btn-primary mt-5" href="mailto:support@aitoolverse.ai?subject=Tool%20suggestion">Email support@aitoolverse.ai</a>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="card p-7">
        <p className="text-ink-700 dark:text-ink-200">Sign in to suggest a tool. This keeps the directory free of spam.</p>
        <button type="button" className="btn-primary mt-5" onClick={() => signInWithGoogle().catch(() => {})}>Sign in with Google</button>
      </div>
    );
  }

  if (status === 'sent') {
    return (
      <div className="card p-7">
        <p className="font-semibold text-ink-900 dark:text-white">Thanks! Your suggestion is in the review queue.</p>
        <p className="mt-1 text-sm muted">Approved tools usually appear within a few days.</p>
        <button type="button" className="btn-secondary mt-5" onClick={() => setStatus('idle')}>Suggest another</button>
      </div>
    );
  }

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const url = String(form.get('url') || '').trim();
    const name = String(form.get('name') || '').trim();
    const note = String(form.get('note') || '').trim();
    setStatus('sending');
    try {
      const fb = await getFirebase();
      if (!fb) throw new Error('unavailable');
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const day = Math.floor(Date.now() / 86400000);
      // Rules allow MAX_PER_DAY create-only slots per user per day; a taken slot fails, so try the next.
      for (let n = 0; n < MAX_PER_DAY; n += 1) {
        try {
          await setDoc(doc(fb.db, 'suggestions', `${user.uid}_${day}_${n}`), { url, name, note, uid: user.uid, createdAt: serverTimestamp() });
          setStatus('sent');
          return;
        } catch {
          // slot taken or rejected; try next
        }
      }
      setStatus('limit');
    } catch {
      setStatus('error');
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-5 p-7">
      <div>
        <label htmlFor="s-url" className="text-sm font-medium text-ink-800 dark:text-ink-100">Website</label>
        <input id="s-url" name="url" type="url" required maxLength={300} pattern="https://.+" placeholder="https://" className="input mt-1.5" />
      </div>
      <div>
        <label htmlFor="s-name" className="text-sm font-medium text-ink-800 dark:text-ink-100">Tool name</label>
        <input id="s-name" name="name" required maxLength={80} className="input mt-1.5" />
      </div>
      <div>
        <label htmlFor="s-note" className="text-sm font-medium text-ink-800 dark:text-ink-100">What does it help with? <span className="muted">(optional)</span></label>
        <textarea id="s-note" name="note" maxLength={500} rows={3} className="input mt-1.5" />
      </div>
      {status === 'error' && <p className="text-sm text-rose-600">Something went wrong. Please try again.</p>}
      {status === 'limit' && <p className="text-sm text-rose-600">You have reached today's limit of {MAX_PER_DAY} suggestions.</p>}
      <button type="submit" className="btn-primary" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Submit for review'}
      </button>
    </form>
  );
}
