# Store listing copy — PDF Bookmark Editor

Paste-ready text and a submission checklist for the Chrome Web Store and
Microsoft Edge Add-ons.

## Extension name

`PDF Bookmark Editor`

## Short description (≤132 chars, Chrome + Edge)

Open a PDF, add/rename/delete outline bookmarks, and save a new copy. Local-only — files never leave your browser.

## Long description

Add, rename, and remove outline bookmarks (the collapsible table of
contents shown in the sidebar of every PDF reader) in any PDF, right in
your browser.

Features
• Bundled PDF.js viewer — no external plugin required
• Sidebar tree editor: add top-level or child bookmarks, rename, delete
• Save writes a proper /Outlines dictionary that every major PDF reader
  understands (Chrome, Edge, Safari, Preview, Adobe Acrobat, Foxit,
  Firefox, Sumatra, Okular, PDF.js, mobile readers, …)
• Sets /PageMode /UseOutlines so the bookmarks pane opens automatically
• Keyboard shortcuts: ← / → to page, Ctrl/Cmd+B to add a bookmark,
  Ctrl/Cmd+S to save

Privacy
The extension is entirely local. Nothing is uploaded, no analytics, no
tracking. It only requests the `storage` permission to remember your
zoom/sidebar preferences between sessions.

Ideal for
• Adding a proper table of contents to scanned PDFs, technical manuals,
  or academic PDFs that shipped without one
• Fixing broken or noisy auto-generated outlines
• Splitting long PDFs into readable sections without editing the content

Open-source. Bundles Mozilla PDF.js (Apache 2.0) and pdf-lib (MIT).

## Category

Productivity

## Tags / keywords

pdf, bookmarks, outline, table of contents, toc, viewer, annotate,
navigation

## Screenshots you need to capture

Drop these into `store-assets/` (they are not shipped in the extension zip).

| # | Filename                       | Size          | What to show                                                  |
|---|--------------------------------|---------------|----------------------------------------------------------------|
| 1 | `screenshot-1-viewer.png`      | 1280×800      | The full viewer with a real PDF loaded and 3–5 bookmarks in the sidebar |
| 2 | `screenshot-2-add-bookmark.png`| 1280×800      | The "Add bookmark" dialog open, showing title + page number    |
| 3 | `screenshot-3-nested.png`      | 1280×800      | Bookmarks nested two levels deep, one expanded, one collapsed  |
| 4 | `screenshot-4-save.png`        | 1280×800      | The saved PDF re-opened in Chrome's built-in viewer showing the new bookmarks pane |
| 5 | `promo-tile-small.png`         | 440×280       | Small promo tile (Chrome only, recommended)                    |
| 6 | `promo-tile-marquee.png`       | 1400×560      | Marquee tile (Chrome, optional)                                |

Edge additionally requires a 300×188 store logo — reuse
`icon-128.png` on a plain white background scaled to 300×188 with padding.

## Submission checklist

- [ ] `npm run build` produced a zip in `dist/`
- [ ] Test-loaded the unpacked extension in a fresh Chrome profile
- [ ] Test-loaded the unpacked extension in a fresh Edge profile
- [ ] Opened a real multi-page PDF, added 3 bookmarks, saved, re-opened
      the saved PDF in a different reader — bookmarks visible
- [ ] Icons render crisply at 16/32/48/128 (check the toolbar and the
      `chrome://extensions` card)
- [ ] Privacy policy URL is reachable (either hosted `PRIVACY.md` or GH raw)
- [ ] Store listing screenshots captured at 1280×800
- [ ] Long description reads well with the store's rendering (no markdown)
- [ ] Support email is set on the developer profile
- [ ] Payment / signup for the Chrome Web Store developer account done
      (US$5 one-time fee)
- [ ] Payment / signup for the Microsoft Partner Center done (free)

## Store URLs (fill in after first publish)

- Chrome Web Store: _(pending)_
- Microsoft Edge Add-ons: _(pending)_
