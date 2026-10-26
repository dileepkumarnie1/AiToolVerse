# AIToolVerse

Find the right AI tools and the step-by-step pipeline to reach your goal. Static Astro site on Cloudflare Pages; optional Firebase sign-in for syncing profiles.

## Develop

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # validates the catalog, then builds to dist/
```

## Content

| Path | What |
|---|---|
| `src/data/tools/*.json` | One file per tool (validated by `scripts/lib/catalog.mjs`) |
| `src/data/pipelines.json` | Step-by-step pipelines; each step names tools by slug |
| `src/data/taxonomy.json` | Categories, capabilities (with how-to steps), assessment options |

New tools arrive via the **Discover new tools** workflow every 2 days as a pull request. Nothing is published until you merge it. To reject a tool, delete its file in the PR. The next batch is not created while a discovery PR is open.

## Security model

- No API secrets in the browser. Only `PUBLIC_*` Firebase web config is shipped, and the build fails on secret-looking variable names.
- The Firebase project must stay on the **Spark (free) plan with no billing account** and must **not** enable the Gemini / Generative Language API.
- API key restricted to `aitoolverse.ai` referrers and to Identity Toolkit, Token Service, Cloud Firestore and Firebase App Check APIs.
- App Check (reCAPTCHA v3) enforced for Firestore and Authentication.
- `firestore.rules` allows each user to access only their own document; suggestions are create-only and rate-limited.
- Strict CSP (hashed by Astro) plus security headers in `public/_headers`.
- GitHub Actions use keyless Workload Identity Federation; no service-account JSON keys.

## Setup checklist

1. **Cloudflare Pages:** connect this repo. Build command `npm run build`, output `dist`, env `NODE_VERSION=24`. Add the `PUBLIC_*` variables from `.env.example` when Firebase is ready.
2. **Firebase (new project, Spark plan):** enable Google sign-in, set authorized domains to `aitoolverse.ai` only, create Firestore, register a web app, register App Check with reCAPTCHA v3, then deploy `firestore.rules`.
3. **GitHub:** Settings → Actions → General → allow GitHub Actions to create pull requests. Optional secret `PRODUCTHUNT_TOKEN`. Enable secret scanning and push protection.
4. **Domain:** remove the custom domain from the old GitHub Pages repo, then add `aitoolverse.ai` in Cloudflare Pages.
