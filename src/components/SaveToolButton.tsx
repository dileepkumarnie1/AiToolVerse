import { useEffect, useState } from 'react';
import { loadUserData, onUserDataChange, toggleSavedTool, useAuthUser } from '../lib/userData';

export default function SaveToolButton({ slug }: { slug: string }) {
  const { ready, user } = useAuthUser();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const refresh = () => loadUserData().then((d) => setSaved(d.savedTools.includes(slug))).catch(() => {});
    refresh();
    return onUserDataChange(refresh);
  }, [ready, user, slug]);

  return (
    <button
      type="button"
      className="btn-secondary"
      aria-pressed={saved}
      disabled={!ready || busy}
      onClick={async () => {
        setBusy(true);
        try {
          setSaved(await toggleSavedTool(slug));
        } finally {
          setBusy(false);
        }
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-4 w-4 ${saved ? 'fill-rose-500 stroke-rose-500' : 'fill-none stroke-current'}`} strokeWidth="2">
        <path d="M12 21s-7-4.35-9.5-8.5C.9 9.6 2.6 5.5 6.5 5.5c2.1 0 3.5 1.2 5.5 3.3 2-2.1 3.4-3.3 5.5-3.3 3.9 0 5.6 4.1 4 7-2.5 4.15-9.5 8.5-9.5 8.5Z" />
      </svg>
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}
