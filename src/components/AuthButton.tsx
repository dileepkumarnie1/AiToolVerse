import { useState } from 'react';
import { signInWithGoogle, signOutUser, useAuthUser } from '../lib/userData';

export default function AuthButton() {
  const { ready, user, signInAvailable } = useAuthUser();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  if (!ready) return <span className="inline-block h-9 w-20" aria-hidden="true" />;

  if (!signInAvailable) {
    return (
      <a href="/dashboard/" className="btn-secondary">
        My tools
      </a>
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        className="btn-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await signInWithGoogle();
          } catch (e) {
            console.warn('Sign-in cancelled or failed', e);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    );
  }

  const initial = (user.displayName || user.email || '?').charAt(0).toUpperCase();
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-ink-200 bg-white text-sm font-semibold dark:border-white/10 dark:bg-ink-800"
        aria-label="Account menu"
      >
        {user.photoURL ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : initial}
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 mt-2 w-52 p-1.5 text-sm shadow-xl">
          <p className="truncate px-3 py-2 text-xs muted">{user.displayName || user.email}</p>
          <a role="menuitem" href="/dashboard/" className="block rounded-lg px-3 py-2 hover:bg-ink-100 dark:hover:bg-white/5">
            My dashboard
          </a>
          <a role="menuitem" href="/start/" className="block rounded-lg px-3 py-2 hover:bg-ink-100 dark:hover:bg-white/5">
            Retake assessment
          </a>
          <button
            role="menuitem"
            type="button"
            className="block w-full rounded-lg px-3 py-2 text-left hover:bg-ink-100 dark:hover:bg-white/5"
            onClick={() => signOutUser().then(() => setOpen(false))}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
