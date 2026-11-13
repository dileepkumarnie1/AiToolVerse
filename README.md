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
| `public/logos/*.webp` | Tool logos, stored locally so pages make no third-party requests. `src/data/logos.json` lists which tools have one |
| `src/data/trends.json` | How much each tool was discussed on Hacker News in the last 30 days |
| `src/data/weekly/*.json` | "This week in AI" issues, one file per issue |

| Command | What it does |
|---|---|
| `npm run logos` | Downloads the icon of each tool that has none yet from the tool's own website. Tools without a usable icon show a letter avatar |
| `npm run trends` | Rebuilds `trends.json`. The Trending page, the home page and the dashboard read it |
| `npm run weekly` | Drafts this week's issue from the most-discussed AI stories. Edit the file before committing |

New tools arrive via the **Discover new tools** workflow every 2 days as a pull request. The **Weekly issue and trending refresh** workflow opens a pull request every Monday with a drafted issue and fresh trending data. Nothing is published until you merge. To reject a tool or a story, delete it in the pull request.

## Features

- **Search from any page:** Ctrl/⌘ K or `/` opens a search over tools, comparisons and pipelines (`src/scripts/palette.ts`, index at `/data/search.json`).
- **Compare and alternatives:** `/compare/a-vs-b/` and `/alternatives/tool/`. The matchups come from hand-picked groups of real competitors (`RIVAL_GROUPS` in `src/lib/catalog.ts`); add a tool to a group to give it pages.
- **Trending:** `/trending/` ranks tools by Hacker News points. It measures attention, not quality; `/about/#trending` explains this to visitors.
- **This week in AI:** `/weekly/`, with an RSS feed at `/weekly/rss.xml`.
- **Newsletter:** set `PUBLIC_NEWSLETTER_ACTION` (your email provider's subscribe address), `PUBLIC_NEWSLETTER_FIELD` and `PUBLIC_NEWSLETTER_PROVIDER` to show the sign-up form. The form posts straight to the provider, the build adds the provider to the security policy, and the privacy page names it. Without these, visitors are offered the RSS feed.

## Design

- Two looks. Dark is the default; the header button switches to light and the choice is saved in the browser. `?theme=light` or `?theme=dark` in a link sets it.
- Motion and glass styles live in `src/styles/motion.css`; behaviour in `src/scripts/ui.ts`. Pages work without the script, and all movement is switched off for visitors whose device asks for reduced motion.
- The security policy blocks inline `style` attributes, so positions, delays and bar widths are set with classes in the stylesheet.
- The logo is `src/components/Logo.astro` (and `public/favicon.svg`): an "A" drawn as a constellation, each star a tool and each line a path between tools.

## Security model

- No API secrets in the browser. Only `PUBLIC_*` Firebase web config is shipped, and the build fails on secret-looking variable names.
- The Firebase project must stay on the **Spark (free) plan with no billing account** and must **not** enable the Gemini / Generative Language API.
- API key restricted to `aitoolverse.ai` referrers and to Identity Toolkit, Token Service, Cloud Firestore and Firebase App Check APIs.
- App Check (Google Cloud Fraud Defense, formerly reCAPTCHA Enterprise) enforced for Firestore. Do not enforce it for Authentication: sign-in runs before App Check loads, so that signed-out visitors never download reCAPTCHA.
- `firestore.rules` allows each user to access only their own document; suggestions are create-only and rate-limited.
- Strict CSP (hashed by Astro) plus security headers in `public/_headers`.
- GitHub Actions use keyless Workload Identity Federation; no service-account JSON keys.

## Setup checklist

1. **Cloudflare Pages:** connect this repo. Build command `npm run build`, output `dist`, env `NODE_VERSION=24`. Add the `PUBLIC_*` variables from `.env.example` when Firebase is ready.
2. **Firebase (new project, Spark plan):** enable Google sign-in, set authorized domains to `aitoolverse.ai` only, create Firestore, register a web app, register App Check with Fraud Defense (formerly reCAPTCHA Enterprise), then deploy `firestore.rules`.
3. **GitHub:** Settings → Actions → General → allow GitHub Actions to create pull requests. Optional secret `PRODUCTHUNT_TOKEN`. Enable secret scanning and push protection.
4. **Domain:** remove the custom domain from the old GitHub Pages repo, then add `aitoolverse.ai` in Cloudflare Pages.
