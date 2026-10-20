# SEO audit: getrimshot.com

Audited 2026-10-20 on branch `seo-optimization`.

## Setup

- **Stack:** hand-written static HTML, CSS and one JS file. There is no framework, router, bundler or `package.json`.
- **Rendering:** fully static. Each page is a real HTML file (`/index.html`, `/android/index.html`, `/support/index.html`, `/privacy/index.html`, `/404.html`). All copy is in the HTML. JS only swaps screenshots for the current theme, runs the show demo and handles the theme and accent toggles.
- **Hosting:** GitHub Pages (`CNAME` = `getrimshot.com`) behind Cloudflare. GitHub Pages serves `404.html` with a real 404 status, and paths without a trailing slash 301 to the trailing-slash URL.
- **Metadata:** written by hand in each page's `<head>`. There are no shared layouts, so any head change has to be made in all five files.
- **Build/tests/lint:** none. "Build" means the files as committed. Local preview: `python3 -m http.server 4173` (`.claude/launch.json`).

## Findings

### High

| # | Area | File | Finding | Fix |
|---|------|------|---------|-----|
| H1 | Structured data | `index.html` | No JSON-LD on any page, so Google gets no machine-readable app, publisher or site name. | Add `SoftwareApplication` (MobileApplication), `Organization` and `WebSite` JSON-LD using only facts already on the page (free, iOS + Android, App Store URL, screenshots). |
| H2 | Performance (LCP) | `index.html:78`, `assets/js/site.js:25` | The hero screenshot is the likely LCP element, but it has no `src` in the HTML. The deferred `site.js` sets `src`, so the browser can't find the image until the whole document has parsed and the script has run, and `fetchpriority="high"` does nothing on an image with no `src`. All four screenshots are also invisible to crawlers that don't run JS (only the `<noscript>` copies have a `src`). | Put the default (dark) `src` in the markup. `site.js` already keeps it when it matches and swaps it for light-theme visitors. Then drop the redundant `<noscript>` copies. |

### Medium

| # | Area | File | Finding | Fix |
|---|------|------|---------|-----|
| M1 | Metadata | `android/index.html:6-7` | Title is 22 chars and description 86 chars, and neither mentions "metronome" or "tuner". | Write a 50–60 char title and 140–160 char description. Mirror them in `og:title`/`og:description`. |
| M2 | Metadata | `support/index.html:6-7` | Title 17 chars, description 70 chars. | Same as M1. |
| M3 | Metadata | `privacy/index.html:6-7` | Title 24 chars. The description (75 chars) says "Everything stays on your iPhone", but the app is also on Android. | Longer title, plus a description that doesn't say iPhone-only. The **body copy** is iPhone-only too; see "Needs my decision". |
| M4 | Crawlability | Cloudflare (not in repo) | `http://getrimshot.com/` returns **200** instead of redirecting to HTTPS, so every page exists at two URLs. Canonical tags limit the damage, but a redirect is the proper fix. | Turn on **Always Use HTTPS** in Cloudflare (SSL/TLS → Edge Certificates). |
| M5 | Crawlability | DNS / Cloudflare (not in repo) | `https://www.getrimshot.com/` returns **404**. Anyone who types or links the www address hits a dead end. | Add a Cloudflare redirect rule from `www.getrimshot.com/*` to `https://getrimshot.com/$1` (301). |
| M6 | Content | `index.html:66` | The only H1 is "In time. In tune.", which contains neither "Rimshot", "metronome" nor "tuner". The H1 is a strong relevance signal. | Copy change, so it needs your decision (see below). |
| M7 | Images | `assets/screens/**/*.jpg` | Screenshots are 828×1800 JPEGs, 100–150 KB each. They render at about 276 CSS px wide, so 2× is ~552 px. They are not WebP/AVIF, and there's no `srcset`. | Generate WebP plus a ~552 px size and serve them with `srcset`. `cwebp` is installed. (`scripts/optimize-screens.sh` explains that `sips` AVIF output is broken.) This needs a small `site.js` change. |
| M8 | Accessibility / semantics | `index.html:39` (and the same block in every page) | The primary nav links are a bare `<ul>` inside `<header>`, not in a `<nav>` landmark. The footer `<nav>` is the only navigation landmark. | Wrap the list in `<nav aria-label="Primary">` and move the `margin-left: auto` so the layout doesn't change. |

### Low

| # | Area | File | Finding | Fix |
|---|------|------|---------|-----|
| L1 | Structured data | `index.html:215-256` | The FAQ content supports `FAQPage`. Since 2023, Google shows FAQ rich results only for government and health sites, so the gain here is small (other engines and AI answers do still read it). | Add `FAQPage` JSON-LD that matches the visible Q&A word for word. |
| L2 | Structured data | `android/`, `support/`, `privacy/` | No `BreadcrumbList`. With a flat 2-level site the gain is small. | Add a 2-item `BreadcrumbList` (Home › Page). |
| L3 | Crawlability | `sitemap.xml` | No `<lastmod>`. | Add `<lastmod>` from each file's last git commit date. |
| L4 | Crawlability | (hosting) | `/index.html` returns 200 as a duplicate of `/`. The canonical tag already points to `/`. | Nothing needed. Never link to `/index.html`. |
| L5 | Social | all pages | The OG image is the 512×512 icon with `twitter:card=summary`. Link previews show a small square. | Make a 1200×630 social card and switch to `summary_large_image`. This needs a design asset. |
| L6 | Metadata | all pages | No `twitter:title`/`twitter:description`. X falls back to OG tags, so this is cosmetic. | Optional. Skip. |
| L7 | Conversion | `index.html:10-11` | The Apple Smart App Banner is commented out with a placeholder ID. The real ID (`6816163060`) is now known. | Enable `<meta name="apple-itunes-app" content="app-id=6816163060">`. This shows a banner on iOS Safari, so it's your call. |
| L8 | Hygiene | `assets/screens/**/*.PNG` | About 5.2 MB of original PNGs are deployed but never referenced. They're harmless to SEO but publicly reachable. | Move them out of the deployed tree, or keep them. Deleting is your call. |
| L9 | Performance | Cloudflare / GitHub Pages | `cache-control: max-age=600` on all assets. Repeat visits re-validate CSS, JS and images every 10 minutes. | Optional: add a Cloudflare cache rule for `/assets/*` with a longer edge and browser TTL. |

### Checked and fine

- `lang="en"`, `charset` and `viewport` are on every page.
- Titles and descriptions are unique across pages. The home title is 50 chars and its description 157 chars, both in range.
- Every indexable page has a canonical URL, and each one matches the sitemap and the trailing-slash URL the server redirects to.
- OG tags (type, url, title, description, image with dimensions and alt) are on every indexable page.
- `robots.txt` allows everything and points to the sitemap.
- The 404 page returns a real 404 status and has `noindex`, which is correct. No other page has `noindex`.
- All internal links resolve (`/`, `/#met`, `/#show`, `/#tuner`, `/#faq`, `/android/`, `/support/`, `/privacy/`). There are no redirect chains, and URLs are clean.
- Each page has exactly one H1, and headings go in order: H1 → H2. FAQ items are `<details>`/`<summary>`, which crawlers index.
- Every `<img>` has alt text. Decorative icons use `alt=""` correctly, and screenshots have descriptive alts. Every image has `width`/`height`, and `.screen` reserves space with `aspect-ratio`, so there's no layout shift. Below-the-fold screenshots use `loading="lazy"`.
- Performance: one 20 KB stylesheet, no web fonts (system stack), one deferred script, no third parties, so no preconnects are needed.
- Rendering: all text content is in the static HTML. Only the screenshots (H2) and the demo timeline need JS.
- Accessibility: skip link, `<main>`, `<footer>`, footer `<nav aria-label>`, `aria-current` on footer links, `aria-hidden` on decorative SVGs and pulse animations, and `aria-pressed` on toggles.
- Descriptive link text, apart from "See how to get it" (`index.html:228`), which is fine in context.

## Done

Phase 2 changes, each in its own commit on `seo-optimization`, and re-checked in Phase 3.

| Finding | What changed | Commit |
|---------|--------------|--------|
| H1, L1, L2 | JSON-LD. Home has `Organization`, `WebSite`, `MobileApplication` (free, iOS + Android, App Store install link, screenshots, feature list, no rating) and a `FAQPage` copied from the visible FAQ. Android, Support and Privacy each have a `BreadcrumbList`. | `64a6e25` |
| H2, M7, L8 | Screenshots have a real `src` (dark set) plus `srcset` at 640/828 px. `site.js` swaps in the light set when needed. They're now WebP at ~20–45 KB, down from 100–150 KB JPEGs. The `<noscript>` copies, JPEGs and PNG originals are removed (the PNGs are still in git history). `scripts/optimize-screens.sh` now outputs WebP and takes the PNG folder as an argument. | `f180312` |
| M1–M3 | Titles are now 53–55 chars and descriptions 145–157 chars, mirrored in OG tags. The home title adds "App". | `3cfa18c` |
| M3 (body) | The privacy policy covers iPhone and Android: permission paths, the Android notification permission, Google backups and Google Play diagnostics. Effective date is now October 20, 2026. The support microphone fix covers both platforms. The Android claims were checked against the Android app's manifest and dependencies: no INTERNET permission and no analytics libraries. | `c850285` |
| M6 | The H1 is now "Rimshot.", and "In time. In tune." is a smaller tagline beneath it. | `5c191fb` |
| M8 | Header links are wrapped in `<nav aria-label="Primary">`. The layout is unchanged. | `3e2df36` |
| L3 | The sitemap has `<lastmod>`. | `d118878` |
| L5 | There's a 1200×630 social card (`assets/social/rimshot-card.jpg`, source `scripts/social-card.html`), and pages use `summary_large_image`. | `3cfa18c` |
| L7 | The Smart App Banner is on for Home, Android, Support and Privacy. | `056b2b8` |

**Phase 3 checks** (there's no build, test or lint setup, so these were run by hand against `python3 -m http.server`):
- All 22 internal URLs referenced by the pages return 200 (pages, assets, OG image, screenshots, sitemap, robots), and every `/#anchor` target exists.
- Each page has one H1. Titles are 53–55 chars and descriptions 145–157 chars on every indexable page. Every `<img>` has `alt`, `width` and `height`.
- All JSON-LD blocks parse as valid JSON.
- `html-validate` reports only issues that were already there before this branch (lowercase `<!doctype>` and `role="radio"` on the swatch buttons). Nothing new.
- In headless Chrome, both the dark and light themes load the right WebP from `srcset`, with no fallback to the placeholder.
- Hero screenshots at 1440 px and 390 px look right. The social card renders at exactly 1200×630.

**Known trade-off:** a returning visitor who chose the light theme now downloads the dark hero screenshot (~20 KB) before `site.js` swaps it. That's the cost of making the image discoverable early, which matters more for LCP and crawlers.

## Needs my decision

1. **Show sharing on Android.** The homepage says "Sharing: Send shows to your band" and the FAQ answers "Can I share a show with my band? Of course." The Android app has no show sharing. That copy, and the FAQ JSON-LD that mirrors it, should say iPhone only, or wait until Android has sharing.
2. **HTTP → HTTPS (M4).** Turn on Cloudflare **Always Use HTTPS**. `http://getrimshot.com/` currently returns 200.
3. **www (M5).** Add a Cloudflare redirect rule from `www.getrimshot.com/*` to `https://getrimshot.com/$1` (301). The www address currently returns 404.
4. **Organization vs Person.** The JSON-LD presents Rimshot as an Organization founded by Neil Dembla. If Rimshot isn't a business, I can switch the publisher to a Person.
5. **Ratings.** Google shows star ratings in search only when an app's structured data includes reviews or ratings, and the rating has to be visible on the page. Showing App Store ratings on the site would enable that. It's not done, because the site has no ratings to cite.
6. **Asset caching (L9).** Optionally add a Cloudflare cache rule with a long TTL for `/assets/*`. Filenames aren't versioned, so a changed asset would take that long to update everywhere.
7. **Deployed tooling.** `scripts/` (the optimize script and the social card template) is publicly served. The card page has `noindex`. Excluding `scripts/` from the deploy would need a `_config.yml` `exclude:` entry.
8. **H1 keywords.** "Rimshot." contains no "metronome" or "tuner". The tagline and lede right below it do. That's fine, but a heading like "Rimshot. The metronome & tuner." would be a stronger signal if you ever want it.
