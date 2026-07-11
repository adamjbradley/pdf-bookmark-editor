# Store submission — step-by-step

Paste-ready text and click paths for both the **Chrome Web Store** and
**Microsoft Edge Add-ons**. Everything referenced here lives in this repo —
the zip you upload comes from `dist/`, the screenshots from
`store-assets/screenshots/`, and the promo tiles from
`store-assets/promo-tiles/`.

Total real-time cost, assuming you already have a Google account and don't
mind the one-time $5 Chrome dev-account fee: **~30–45 minutes of typing +
1–3 days waiting for review.**

---

## 0 · Prereqs (one-time, ~5 min)

- **Chrome Web Store developer registration** — <https://chrome.google.com/webstore/devconsole>. $5 one-time payment. Sign in with the Google account you want tied to the listing.
- **Microsoft Partner Center — Edge Add-ons** — <https://partner.microsoft.com/dashboard/microsoftedge/overview>. Free. Sign in with a personal Microsoft account (not a work/school account, unless your org has enabled it).
- **Enable GitHub Pages** on this repo — [Settings → Pages → Deploy from a branch → `main` / `/docs`](https://github.com/adamjbradley/pdf-bookmark-editor/settings/pages) — so the privacy URL <https://adamjbradley.github.io/pdf-bookmark-editor/PRIVACY.html> resolves. Chrome's submission form validates the URL.
- **Cut a release** so you have a signed zip to upload — [Actions → Release → Run workflow](https://github.com/adamjbradley/pdf-bookmark-editor/actions/workflows/release.yml). The job publishes `pdf-bookmark-editor-<version>.zip` on the [Releases page](https://github.com/adamjbradley/pdf-bookmark-editor/releases). Download that zip locally — the store forms want the local file, not a URL.

---

## 1 · Chrome Web Store (~20 min)

Start at <https://chrome.google.com/webstore/devconsole> → **New item**.

### 1a. Upload the package

- **File:** `pdf-bookmark-editor-0.1.0.zip` (from the release). Wait for it to unpack and validate — should be green in a few seconds.

### 1b. "Store listing" tab

| Field | Paste this |
|---|---|
| Product name | `PDF Bookmark Editor` |
| Summary (short desc) | `Open a PDF, add/rename/delete outline bookmarks, save a new copy. Local-only — files never leave your browser.` |
| Description (long) | Everything under **Long description** in [`STORE_LISTING.md`](STORE_LISTING.md) — copy the plain text below the heading, no Markdown. |
| Category | **Productivity** |
| Language | English (United States) |
| Store icon (128×128) | `icons/icon-128.png` |
| Small promo tile (440×280) | `store-assets/promo-tiles/promo-small-440x280.png` |
| Marquee promo tile (1400×560) — *optional* | `store-assets/promo-tiles/promo-marquee-1400x560.png` |
| Screenshots (1280×800, 1–5) | Upload all four in order:<br>1. `store-assets/screenshots/01-viewer-with-outline.png`<br>2. `store-assets/screenshots/02-add-bookmark.png`<br>3. `store-assets/screenshots/03-nested-sidebar.png`<br>4. `store-assets/screenshots/04-popup.png` |

### 1c. "Privacy practices" tab

This is the section most rejections come from. The answers below are all "no data collected".

- **Single purpose:** paste this exact wording:
  > This extension has one purpose: to let a user open a PDF and edit its outline bookmarks (the collapsible table of contents shown by every PDF reader), then save a modified copy. All work happens locally in the browser.
- **Permission justification — `storage`:** paste this:
  > Used to persist a single user preference — the last zoom level in the built-in PDF viewer — via `chrome.storage.local` on the user's device. No user content or personal data is stored.
- **Remote code use:** answer **"No, I am not using remote code"**. The extension bundles Mozilla PDF.js and `pdf-lib` in `vendor/` and loads no external scripts.
- **Data collection disclosures** — check **only** the "I do not collect user data" box. Leave everything else unchecked.
- **Certifications:**
  - ☑ I do not sell or transfer user data to third parties
  - ☑ I do not use or transfer user data for purposes unrelated to my item's single purpose
  - ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes

- **Privacy policy URL:** `https://adamjbradley.github.io/pdf-bookmark-editor/PRIVACY.html`

### 1d. "Distribution" tab

- **Visibility:** start with **Unlisted** for the first submission. This gives you a working "Add to Chrome" URL to share while you sanity-check the listing. Flip to **Public** later from the same dashboard — no re-review is triggered by that flip alone.
- **Distribution regions:** All regions.
- **Pricing:** Free.

### 1e. Submit for review

Click **Submit for review** at the top-right. Typical wait for a
`storage`-only extension with no host permissions and a public source
link: **same-day to 3 business days**. You'll get email at the address on
the dev-console profile.

If review comes back with a change request, the most likely items are:

- **"Explain the permission you request"** — copy the `storage` justification from 1c into any inline reviewer prompt.
- **"Provide a working demo"** — the source repo link and the release zip both suffice; mention that Load unpacked from the zip reproduces the store install.

---

## 2 · Microsoft Edge Add-ons (~10 min)

Start at <https://partner.microsoft.com/dashboard/microsoftedge/overview> →
**Extensions** → **New Extension**.

### 2a. Package

- **Zip:** the same `pdf-bookmark-editor-0.1.0.zip`. Edge does its own MV3 validation.

### 2b. Availability

- **Markets:** All markets.
- **Visibility:** Public (Edge doesn't have the same "unlisted" concept as Chrome — hidden is only for private users you invite).
- **Notes for certification** — paste this:
  > This extension edits PDF outline bookmarks locally. It requests only the `storage` permission to persist a zoom preference, has no host permissions, no service worker, and makes no network requests. Bundled libraries: Mozilla PDF.js (Apache 2.0) and pdf-lib (MIT), both vendored non-minified under `vendor/`. Source: https://github.com/adamjbradley/pdf-bookmark-editor

### 2c. Properties (Store listing)

Same fields as Chrome:

- **Category:** **Productivity**.
- **Privacy policy URL:** `https://adamjbradley.github.io/pdf-bookmark-editor/PRIVACY.html`
- **Website:** `https://adamjbradley.github.io/pdf-bookmark-editor/`
- **Support link:** `https://github.com/adamjbradley/pdf-bookmark-editor/issues`
- **Screenshots:** the same four `store-assets/screenshots/*.png`. Edge accepts 1280×800.
- **Store logo:** upload `icons/icon-128.png` at 300×300 (Edge will center-crop) or resize to 300×300 with padding.

Edge does **not** use promo tiles — skip those.

### 2d. Submit for review

Click **Submit** at the end. Edge certification is usually **within 24 hours** for extensions with clean permission footprints.

---

## 3 · After both are live

1. Update `STORE_LISTING.md` with the store URLs (the "Store URLs" section at the bottom).
2. Update `docs/index.html`'s CTA to add an **Add to Chrome** button next to the direct-download button. (Once you paste the URLs I can wire this in one edit.)
3. Update `manifest.json`'s `homepage_url` field to point at your Chrome Web Store listing — this makes the "Website" link on `chrome://extensions/` deep-link to the store page.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| "Purple triangle" warning on the zip upload | You uploaded the `dist/e2e/*.pdf` folder by mistake, or a zip that includes `node_modules/`. Re-run `npm run package` to produce a clean zip. |
| "Manifest V2 items are no longer accepted" | Chrome's uploader is refusing an old build. Verify `"manifest_version": 3` in the top-level `manifest.json` of the zip. |
| Review rejected with "Excessive permissions" | Shouldn't happen — we only ask for `storage`. Double-check that no accidental `host_permissions` entry snuck into `manifest.json`. |
| Privacy policy URL 404 | GitHub Pages hasn't published yet, or you skipped step 0's Pages toggle. Check <https://adamjbradley.github.io/pdf-bookmark-editor/PRIVACY.html> resolves before submitting. |
| Screenshot rejected as "not at required resolution" | The store validators sometimes disagree with each other on scale factors. Re-run `npm run screenshots` — the viewport is pinned to 1280×800, so re-capture always produces the right size. |
