# Store assets

Everything you upload to the Chrome Web Store and Edge Add-ons dashboards
lives here. Nothing in this directory is packaged inside the extension zip
(see `scripts/package.mjs` — only `manifest.json`, `icons/`, `src/`, and
`vendor/` ship).

For the paste-ready walkthrough of both submission forms, see
[`../SUBMISSION.md`](../SUBMISSION.md).

## Layout

```
store-assets/
├── screenshots/
│   ├── 01-viewer-with-outline.png     # 1280×800 hero — viewer + nested outline
│   ├── 02-add-bookmark.png            # 1280×800 — Add-bookmark dialog
│   ├── 03-nested-sidebar.png          # 1280×800 — sidebar with a collapsed branch
│   └── 04-popup.png                   # 1280×800 composite of the toolbar popup
└── promo-tiles/
    ├── promo-small-440x280.png        # Chrome required small tile (brand graphic)
    └── promo-marquee-1400x560.png     # Chrome optional marquee tile (brand graphic)
```

Edge Add-ons does not use promo tiles — only the screenshots and the
128×128 icon at `../icons/icon-128.png`.

## Regenerate

```bash
npm run screenshots     # Playwright drives the extension in real Chromium under xvfb
npm run promo-tiles     # PIL composes the two brand tiles from icons/icon-128.png
```

The screenshot capture builds a synthetic 22-page research-report PDF, bakes
a nested outline into it via `src/lib/outline.js`, then screenshots the
viewer in four states — so the store screenshots are always in sync with
what the actual extension renders.
