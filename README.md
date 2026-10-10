# Scalium website

Marketing site for **Scalium**: Meta Ads brand scaling, marketing management and growth marketing.
Bilingual (English / Română), dark and minimal, with scroll-driven animation. It ships as a WordPress theme
and as a plain static site, both built from the same source.

| | |
|---|---|
| **WordPress theme** | `dist/scalium-wordpress-theme.zip` |
| **Static site** | `dist/site/` (open `index.html`, or upload the folder to any host) |
| **Lighthouse (mobile)** | Performance 100, Accessibility 100, Best Practices 100, SEO 100 |
| **First visit weight** | about 190 KB total (HTML, CSS, JS, fonts, hero image) |

## Install on WordPress

1. In WordPress go to **Appearance → Themes → Add New Theme → Upload Theme**.
2. Choose `dist/scalium-wordpress-theme.zip`, then **Install Now** and **Activate**.
3. That's it. On activation the theme creates the **Contact** page (`/contact/`) that every
   "Contact us" button opens.

On WordPress.com, uploading a theme needs a paid plan (Personal or higher). Any self-hosted
WordPress 6.3+ works.

### Filling in the contact page
The contact page is intentionally blank for now. Edit the **Contact** page in WordPress
(Pages → Contact) and whatever you add there (text, a form block, pricing) appears under the heading.

## What's on the page

1. **Hero**: "Scale smarter with Meta Ads", with the dashboard key visual, which tilts toward the cursor and
   sinks back as you scroll. Blue light trails run along the background curves.
2. **Statement**: the positioning line lights up word by word as you read it.
3. **Services**: the three services (Meta Ads scaling, marketing management, growth marketing),
   each with deliverables. A sticky screen beside them swaps visuals as you scroll.
4. **Process**: Create, Launch, Analyze, Automate, Scale. On desktop it scrolls sideways
   while a blue beam fills the timeline.
5. **Results**: the performance dashboard zooms into place and the figures count up.
6. **Closing call to action**: "Growing together." with the **Contact us for more information and pricing** button.

"Dashing" blue accents run through the whole page: light that runs along hairlines as sections appear, a streak
across buttons on hover, the scroll-progress line under the menu, and a blue-edged wipe between pages.

All motion is switched off for visitors who ask for reduced motion, and the layout falls back to a static
vertical version.

### Before launch
- **Results figures** (+42% ROAS, +68% leads, +53% revenue, −37% CAC) come from the brand key visuals and are
  labeled "Illustrative figures". Replace them with real client results in `src/index.html` (search for
  `data-count`).
- Add the contact details to the Contact page.

## Editing content

- English copy lives directly in `src/index.html` and `src/contact.html`.
- Romanian copy lives in `src/assets/js/i18n.js` (one line per text, same keys as the `data-i18n` attributes).
- Visitors' language choice is remembered. Romanian browsers get Romanian automatically, and `?lang=ro` or
  `?lang=en` in the URL forces a language.

After editing, rebuild:

```bash
npm install
npm run build    # writes dist/site and dist/scalium-wordpress-theme.zip
npm test         # clicks through every button, the language switch and the menu in a real browser
```

## Project layout

```
brand/            original key visuals and logo (source of every image on the site)
src/              site source: pages, partials, CSS, JS, fonts, generated images
wordpress/        theme-only files (functions.php, style.css, fallback template, screenshot)
scripts/          build, image pipeline, logo tracing, font subsetting, tests
dist/             build output (committed so the theme zip is always ready to upload)
```

Asset pipeline (only needed when the brand files change):

- `npm run logo` traces `brand/5.jpg` into the vector logos in `src/assets/img/`.
- `npm run images` crops the key visuals and writes responsive AVIF/WebP files, favicons and the OG image.
- `npm run fonts` subsets Mona Sans and Martian Mono (needs `pip install fonttools brotli`).

Typefaces: Mona Sans (headlines in its semi-expanded width) and Martian Mono for small technical labels,
both self-hosted under the SIL Open Font License. Icons: Phosphor. Animation: GSAP + ScrollTrigger.
