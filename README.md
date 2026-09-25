# getrimshot.com

Landing site for Rimshot, the metronome and tuner for iPhone. Plain HTML, CSS and JS with no build step.

```
index.html            Landing page
privacy/index.html    Privacy policy (App Store "Privacy Policy URL")
support/index.html    Support page (App Store "Support URL")
404.html              Not-found page
assets/css/site.css   All styles, theme tokens at the top
assets/js/site.js     Theme switch, accent preview, show demo
assets/img/           Icon (placeholder) and apple-touch-icon
assets/screens/       App screenshots, see below
scripts/              optimize-screens.sh (makes JPEG web copies of screenshots)
```

## Preview locally

Links are root-relative (`/assets/...`), so serve the folder instead of opening the file directly:

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173.

## Before launch

**App Store link.** Replace the placeholder `id0000000000` everywhere:

```bash
grep -rl 'id0000000000' --include='*.html' . | xargs sed -i '' 's/id0000000000/id1234567890/g'
```

To show Safari's Smart App Banner, uncomment the `apple-itunes-app` meta tag in `index.html` and add the same ID.

**Screenshots.** The original iPhone screenshots (raw PNGs, no frame) live in `assets/screens/light/` and `assets/screens/dark/`, with the same file names in each. The page doesn't load the PNGs. It loads 828px-wide JPEG copies made from them, about 100 KB each, which brings one theme's four screenshots down from about 3.2 MB to about 470 KB. The site draws the phone frame and Dynamic Island around each one.

| Original | Used in |
| --- | --- |
| `met.PNG` | Hero |
| `show.PNG` | Show mode |
| `tuner.PNG` | Tuner mode |
| `settings.PNG` | Settings |

After adding or replacing a screenshot, regenerate the web copies (macOS only, uses the built-in `sips`):

```bash
sh scripts/optimize-screens.sh
```

Each phone frame's `data-shot` attribute in `index.html` holds a path like `/assets/screens/{theme}/met.jpg`. `site.js` fills in the theme, so only the current theme's image downloads. If a file is missing, the site falls back to the other theme, then to a labeled placeholder.

**Icon.** `assets/img/icon.svg` and `assets/img/apple-touch-icon.png` are placeholders. Swap in the real app icon, keeping the same file names. The PNG should be 180 × 180 with square corners.

## Theme

Dark by default. The visitor's choice is saved in `localStorage` under `theme`. Colors are tokens at the top of `site.css`. The accent is iOS system red, `#ff383c` in light and `#ff4245` in dark, the same as the app.

The accent swatches in the Settings section preview colors on the page only and aren't saved. Each swatch sets `--c-l` and `--c-d` (fill in light and dark) and `data-ink-l` and `data-ink-d` (a text-safe shade) in `index.html`. Change them to match the app's real options.

## Deploy

Any static host works: GitHub Pages, Cloudflare Pages, Netlify or Vercel. Point the host at the repo root with no build command. Every host listed serves `404.html` automatically.
