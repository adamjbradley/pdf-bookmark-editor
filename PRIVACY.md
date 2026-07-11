# Privacy Policy — PDF Bookmark Editor

Effective date: 2026-07-11

## Summary

PDF Bookmark Editor is a **local-only** browser extension. It does not
collect, transmit, or store any personal information, browsing history, or
document content on any remote server. It has no analytics, no telemetry,
no ads, and no third-party trackers.

## What data the extension handles

- **PDF files you open in the editor.** These are read from disk into memory
  by your browser and processed entirely within the extension's own tab.
  They are never sent over the network.
- **User preferences** (e.g. the last zoom level and sidebar state). These
  are stored using the browser's built-in `chrome.storage.local` API on
  your device. They are not synced anywhere unless you enable the browser's
  own settings sync, which is out of this extension's control.

## What data the extension does *not* collect

- Your browsing history
- Any identifiers (device ID, IP address, cookies)
- The names or contents of any PDF you open
- The bookmarks you create
- Any usage metrics (opens, clicks, saves)

## Permissions rationale

The extension requests exactly one permission:

- **`storage`** — to remember your zoom and sidebar preferences between
  sessions.

It does **not** request:

- Access to any website (`host_permissions`)
- Access to your tabs, browsing history, cookies, downloads, or any other
  browser data
- The ability to run in the background (no service worker)

## Third-party code

The extension bundles two open-source libraries — Mozilla PDF.js and
`pdf-lib` — for viewing and modifying PDFs. Both run inside the extension's
own tab and make no network requests. No data leaves your browser.

## Contact

Questions? File an issue at the repository this extension is published from,
or contact the developer via the email address on the store listing.
