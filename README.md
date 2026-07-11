# PDF Bookmark Editor — Chrome/Edge extension

Open a PDF, add/rename/remove **outline bookmarks** (the collapsible table of
contents that shows in the sidebar of every PDF reader), and save a new copy.
Everything runs locally in the browser — the PDF never leaves your machine.

## Install

### Easiest — one zip, three clicks

1. **[⬇ Download the latest release zip](https://github.com/adamjbradley/pdf-bookmark-editor/releases/latest)** and unzip it into a folder you'll keep (e.g. `~/extensions/pdf-bookmark-editor/`).
2. Open `chrome://extensions/` (or `edge://extensions/`) → flip **Developer mode** on.
3. Click **Load unpacked** → pick the unzipped folder → click the extension icon → **Open editor** → drop a PDF.

There's also a friendly landing page with these steps + screenshots at
**<https://adamjbradley.github.io/pdf-bookmark-editor/>** (once GitHub Pages is enabled on this repo, see [Enabling Pages](#enabling-github-pages) below).

### For developers — load unpacked from source

```bash
git clone https://github.com/adamjbradley/pdf-bookmark-editor
cd pdf-bookmark-editor
# vendor/ and icons/ are committed, so nothing to build; just Load unpacked.
```

Then the same three steps above, pointing Load unpacked at the cloned directory.


Manifest V3, no service worker, only the `storage` permission, no host
permissions.

- **Viewer** — bundled Mozilla PDF.js (`vendor/pdfjs/`).
- **Outline editor** — reads existing bookmarks via `pdf-lib`, lets you edit
  them in a sidebar, and writes them back to the PDF as a proper
  `/Outlines` dictionary with `/PageMode /UseOutlines` so bookmarks appear
  automatically when the saved file is opened in any PDF reader.

## Rebuild vendor libs / icons from source

The committed `vendor/` and `icons/` are ready to use, so most contributors
don't need this. Only run these if you're bumping PDF.js or pdf-lib, or
tweaking the icon design:

```bash
npm install
npm run vendor          # copy pdfjs-dist + pdf-lib runtimes into vendor/
npm run icons           # regenerate the 16/32/48/128 PNG icons
```

## Cut a new release

```bash
# bump manifest.json + package.json version, then:
git tag v0.1.1
git push --tags
```

The `.github/workflows/release.yml` workflow runs `npm ci`, runs `npm run
verify` (outline round-trip), packages the zip, and attaches it to a new
GitHub Release. The tag has to match `manifest.json`'s `version` — the
workflow refuses to release if they diverge.

Or build the zip locally without cutting a release:

```bash
npm run build           # vendor + icons + package → dist/pdf-bookmark-editor-<version>.zip
```

Upload the resulting zip to the [Chrome Web Store developer
dashboard](https://chrome.google.com/webstore/devconsole/) or the [Edge
Add-ons partner center](https://partner.microsoft.com/dashboard/microsoftedge).
The zip contains only the runtime files (manifest, icons, source, vendor) —
no `node_modules`, no build scripts, no `.map` files.

## Enabling GitHub Pages

The `docs/` directory is a ready-to-serve one-page install site (plus a
plain-HTML privacy policy at `docs/PRIVACY.html`, which is the URL to give
the Chrome Web Store submission form). Turn it on once:

1. **Settings → Pages** in this repo.
2. **Source:** *Deploy from a branch*.
3. **Branch:** `main` / `docs`.
4. Save.

GitHub will publish it at `https://adamjbradley.github.io/pdf-bookmark-editor/`
within a minute. The landing page's download button fetches the latest
GitHub release asset at runtime, so it always points at the newest zip
without redeploying.

## Verify the outline writer

```bash
npm run verify          # round-trip test: build a PDF, add nested bookmarks, re-parse
```

This exercises `src/lib/outline.js` end-to-end without a browser and asserts
the reparsed tree matches the input tree exactly.

## Store submission checklist

See [`STORE_LISTING.md`](STORE_LISTING.md) for the copy to paste into the
listing form and [`PRIVACY.md`](PRIVACY.md) for the privacy disclosure. Both
Chrome and Edge require:

- 128×128 store icon (use `icons/icon-128.png`)
- At least one 1280×800 screenshot (drop in `store-assets/`)
- A short (≤132 char) description and a longer description
- A privacy policy URL — either host `PRIVACY.md` publicly or link to the
  repo's rendered copy

The [`store-assets/`](store-assets/) directory is where you keep the screenshots
and promotional tiles you upload to the store. It is **not** shipped inside
the extension zip.

## Files

```
manifest.json               MV3 manifest
icons/                      16/32/48/128 PNGs
src/popup/                  toolbar popup — one button that opens the viewer
src/viewer/                 the main editor page (PDF.js + outline sidebar)
src/lib/outline.js          pdf-lib low-level read/write of /Outlines
vendor/pdfjs/               Mozilla PDF.js runtime (pinned via npm)
vendor/pdf-lib/             pdf-lib runtime (pinned via npm)
scripts/vendor.mjs          copies pdfjs-dist + pdf-lib into vendor/
scripts/generate-icons.py   renders icons at required sizes
scripts/package.mjs         zips the extension for store upload
scripts/verify-outline.mjs  end-to-end sanity check for the outline writer
```

## Permissions rationale (for the store review)

| Permission | Reason |
|------------|--------|
| `storage`  | Persist user preferences (last zoom level, sidebar open state) across sessions. No PDF data is stored. |

No host permissions, no content scripts, no service worker, no network access.
The extension only runs when you explicitly open the editor page.

## Bundled third-party code

- [PDF.js](https://mozilla.github.io/pdf.js/) v5.7.284 — Apache 2.0
- [pdf-lib](https://pdf-lib.js.org/) v1.17.1 — MIT

Both are vendored non-minified so store reviewers can inspect them. Regenerate
by re-running `npm install && npm run vendor`.
