import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { getFirebase, isFirebaseConfigured } from './firebase';
import { isValidProfile } from './match';
import type { Profile } from './types';

const PROFILE_KEY = 'atv_profile_v1';
const SAVED_KEY = 'atv_saved_tools_v1';
const MAX_SAVED = 300;
const SYNC_EVENT = 'atv-user-data';

export interface UserState {
  ready: boolean;
  user: User | null;
  signInAvailable: boolean;
}

const readLocal = <T,>(key: string, guard: (v: unknown) => v is T): T | null => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return guard(value) ? value : null;
  } catch {
    return null;
  }
};

const isSlugList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length <= MAX_SAVED && v.every((x) => typeof x === 'string' && /^[a-z0-9-]{1,60}$/.test(x));

export const useAuthUser = (): UserState => {
  const [state, setState] = useState<UserState>({ ready: !isFirebaseConfigured, user: null, signInAvailable: isFirebaseConfigured });
  useEffect(() => {
    let unsubscribe = () => {};
    getFirebase().then(async (fb) => {
      if (!fb) return setState({ ready: true, user: null, signInAvailable: false });
      const { onAuthStateChanged } = await import('firebase/auth');
      unsubscribe = onAuthStateChanged(fb.auth, (user) => setState({ ready: true, user, signInAvailable: true }));
    });
    return () => unsubscribe();
  }, []);
  return state;
};

export const signInWithGoogle = async () => {
  const fb = await getFirebase();
  if (!fb) return;
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  await signInWithPopup(fb.auth, new GoogleAuthProvider());
  await syncLocalToAccount();
};

export const signOutUser = async () => {
  const fb = await getFirebase();
  if (!fb) return;
  const { signOut } = await import('firebase/auth');
  await signOut(fb.auth);
};

const userDoc = async () => {
  const fb = await getFirebase();
  const user = fb?.auth.currentUser;
  if (!fb || !user) return null;
  const firestore = await import('firebase/firestore');
  return { firestore, ref: firestore.doc(fb.db, 'users', user.uid), user };
};

interface UserData {
  profile: Profile | null;
  savedTools: string[];
}

export const loadUserData = async (): Promise<UserData> => {
  const local: UserData = { profile: readLocal(PROFILE_KEY, isValidProfile), savedTools: readLocal(SAVED_KEY, isSlugList) ?? [] };
  const d = await userDoc();
  if (!d) return local;
  const snap = await d.firestore.getDoc(d.ref);
  const data = snap.data();
  return {
    profile: isValidProfile(data?.profile) ? data.profile : local.profile,
    savedTools: isSlugList(data?.savedTools) ? data.savedTools : local.savedTools,
  };
};

const writeUserData = async (patch: Partial<UserData>) => {
  if (patch.profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(patch.profile));
  if (patch.savedTools) localStorage.setItem(SAVED_KEY, JSON.stringify(patch.savedTools.slice(0, MAX_SAVED)));
  window.dispatchEvent(new Event(SYNC_EVENT));
  const d = await userDoc();
  if (!d) return;
  await d.firestore.setDoc(d.ref, { ...patch, updatedAt: d.firestore.serverTimestamp() }, { merge: true });
};

export const saveProfile = (profile: Profile) => writeUserData({ profile });

export const toggleSavedTool = async (slug: string) => {
  const { savedTools } = await loadUserData();
  const next = savedTools.includes(slug) ? savedTools.filter((s) => s !== slug) : [slug, ...savedTools];
  await writeUserData({ savedTools: next });
  return next.includes(slug);
};

/** After first sign-in, keep anything the visitor set up before logging in. */
const syncLocalToAccount = async () => {
  const d = await userDoc();
  if (!d) return;
  const snap = await d.firestore.getDoc(d.ref);
  const remote = snap.data();
  const profile = readLocal(PROFILE_KEY, isValidProfile);
  const saved = readLocal(SAVED_KEY, isSlugList) ?? [];
  const patch: Partial<UserData> = {};
  if (!isValidProfile(remote?.profile) && profile) patch.profile = profile;
  if (saved.length) {
    const remoteSaved = isSlugList(remote?.savedTools) ? remote.savedTools : [];
    patch.savedTools = [...new Set([...remoteSaved, ...saved])].slice(0, MAX_SAVED);
  }
  if (Object.keys(patch).length) await writeUserData(patch);
};

/** Deletes the account document, the sign-in account and local data. */
export const deleteMyData = async () => {
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(SAVED_KEY);
  const d = await userDoc();
  if (d) {
    await d.firestore.deleteDoc(d.ref);
    const { deleteUser } = await import('firebase/auth');
    await deleteUser(d.user);
  }
  window.dispatchEvent(new Event(SYNC_EVENT));
};

export const onUserDataChange = (cb: () => void) => {
  window.addEventListener(SYNC_EVENT, cb);
  return () => window.removeEventListener(SYNC_EVENT, cb);
};
