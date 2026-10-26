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

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let services: Promise<FirebaseServices | null> | null = null;

/** Loads Firebase only when a feature needs it, so pages stay fast and work without it. */
export const getFirebase = () => {
  if (!isFirebaseConfigured || typeof window === 'undefined') return Promise.resolve(null);
  services ??= (async () => {
    const [{ initializeApp }, { getAuth }, { getFirestore }] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]);
    const app = initializeApp(config as Required<typeof config>);
    if (recaptchaSiteKey) {
      const { initializeAppCheck, ReCaptchaV3Provider } = await import('firebase/app-check');
      initializeAppCheck(app, { provider: new ReCaptchaV3Provider(recaptchaSiteKey), isTokenAutoRefreshEnabled: true });
    }
    return { app, auth: getAuth(app), db: getFirestore(app) };
  })();
  return services;
};
