import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), 'PUBLIC_');
const authDomain = env.PUBLIC_FIREBASE_AUTH_DOMAIN || '';

// Only public, domain-restricted values may use the PUBLIC_ prefix; they ship to every browser.
const leaked = Object.keys(env).filter((k) => /SECRET|PRIVATE|SERVICE_ACCOUNT|GEMINI|OPENAI|ANTHROPIC|TOKEN/i.test(k));
if (leaked.length) throw new Error(`Refusing to expose secret-looking env vars to the browser: ${leaked.join(', ')}`);

export default defineConfig({
  site: 'https://aitoolverse.ai',
  trailingSlash: 'always',
  markdown: { syntaxHighlight: false },
  integrations: [react(), sitemap({ filter: (page) => !/\/(dashboard|suggest)\//.test(page) })],
  vite: { plugins: [tailwindcss()] },
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "form-action 'self'",
        "font-src 'self'",
        "img-src 'self' data: https://lh3.googleusercontent.com",
        [
          "connect-src 'self'",
          'https://identitytoolkit.googleapis.com',
          'https://securetoken.googleapis.com',
          'https://firestore.googleapis.com',
          'https://firebaseinstallations.googleapis.com',
          'https://content-firebaseappcheck.googleapis.com',
          'https://www.google.com',
        ].join(' '),
        `frame-src https://www.google.com https://recaptcha.google.com${authDomain ? ` https://${authDomain}` : ''}`,
      ],
      scriptDirective: {
        resources: ["'self'", 'https://apis.google.com', 'https://www.google.com/recaptcha/', 'https://www.gstatic.com/recaptcha/'],
      },
    },
  },
});
