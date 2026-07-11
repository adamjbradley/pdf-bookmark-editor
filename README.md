# PDF Bookmark Editor — Chrome/Edge extension

Open a PDF, add/rename/remove **outline bookmarks** (the collapsible table of
contents that shows in the sidebar of every PDF reader), and save a new copy.
Everything runs locally in the browser — the PDF never leaves your machine.

Manifest V3, no service worker, only the `storage` permission, no host
permissions.

- **Viewer** — bundled Mozilla PDF.js (`vendor/pdfjs/`).
- **Outline editor** — reads existing bookmarks via `pdf-lib`, lets you edit
  them in a sidebar, and writes them back to the PDF as a proper
  `/Outlines` dictionary with `/PageMode /UseOutlines` so bookmarks appear
  automatically when the saved file is opened in any PDF reader.

## Load unpacked (dev)

```bash
cd chromeExtension
npm install
npm run vendor          # populate vendor/pdfjs/ and vendor/pdf-lib/
npm run icons           # regenerate the 16/32/48/128 PNG icons
```

Then in the browser:

1. Open `chrome://extensions` (or `edge://extensions`).
2. Toggle **Developer mode**.
3. Click **Load unpacked** and pick the `chromeExtension/` directory.
4. Click the extension's toolbar icon → **Open editor** → drop a PDF.

## Build a store-ready zip

```bash
npm run build           # vendor + icons + package → dist/pdf-bookmark-editor-<version>.zip
```

Upload the resulting zip to the [Chrome Web Store developer
dashboard](https://chrome.google.com/webstore/devconsole/) or the [Edge
Add-ons partner center](https://partner.microsoft.com/dashboard/microsoftedge).
The zip contains only the runtime files (manifest, icons, source, vendor) —
no `node_modules`, no build scripts, no `.map` files.

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
