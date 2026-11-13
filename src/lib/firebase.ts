import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID as string | undefined,
};
const recaptchaSiteKey = import.meta.env.PUBLIC_RECAPTCHA_SITE_KEY as string | undefined;

export const isFirebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

export interface FirebaseAuthServices {
  app: FirebaseApp;
  auth: Auth;
}

export interface FirebaseServices extends FirebaseAuthServices {
  db: Firestore;
}

let authServices: Promise<FirebaseAuthServices | null> | null = null;
let services: Promise<FirebaseServices | null> | null = null;

/** Loads sign-in only. Every page uses this to learn whether the visitor is signed in. */
export const getFirebaseAuth = () => {
  if (!isFirebaseConfigured || typeof window === 'undefined') return Promise.resolve(null);
  authServices ??= (async () => {
    const [{ initializeApp }, { getAuth }] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
    const app = initializeApp(config as Required<typeof config>);
    return { app, auth: getAuth(app) };
  })();
  return authServices;
};

/** Adds App Check and the database. Only signed-in features call this, so other visitors never download them. */
export const getFirebase = () => {
  if (!isFirebaseConfigured || typeof window === 'undefined') return Promise.resolve(null);
  services ??= (async () => {
    const base = await getFirebaseAuth();
    if (!base) return null;
    if (recaptchaSiteKey) {
      const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');
      initializeAppCheck(base.app, { provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey), isTokenAutoRefreshEnabled: true });
    }
    const { getFirestore } = await import('firebase/firestore');
    return { ...base, db: getFirestore(base.app) };
  })();
  return services;
};
