#!/usr/bin/env node
// End-to-end smoke test against real Chromium.
//
// 1. Build a sample multi-page PDF (via pdf-lib).
// 2. Launch a headed Chromium persistent context with the extension loaded
//    unpacked.
// 3. Open the extension's viewer.html.
// 4. Feed the PDF into the file input.
// 5. Wait for the sidebar + first page to render.
// 6. Add a bookmark, save, and intercept the download.
// 7. Re-parse the downloaded PDF and assert the outline round-trips.
// 8. Capture screenshots along the way.

import { chromium } from "playwright-core";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "../vendor/pdf-lib/pdf-lib.esm.js";
import { readOutline } from "../src/lib/outline.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const artifacts = join(root, "dist", "e2e");
await rm(artifacts, { recursive: true, force: true });
await mkdir(artifacts, { recursive: true });

async function pollForExtensionId(userDataDir, extPath, timeoutMs = 10_000) {
  const prefs = join(userDataDir, "Default", "Preferences");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const raw = await readFile(prefs, "utf8");
      const data = JSON.parse(raw);
      const settings = data?.extensions?.settings ?? {};
      for (const [id, info] of Object.entries(settings)) {
        if (info?.path === extPath && /^[a-p]{32}$/.test(id)) return id;
      }
    } catch {
      /* file not written yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

// --- build a sample PDF ---
async function buildSamplePdf(pages = 12) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 1; i <= pages; i++) {
    const p = doc.addPage([612, 792]);
    p.drawText(`Page ${i}`, {
      x: 220,
      y: 400,
      size: 96,
      font,
      color: rgb(0.1, 0.1, 0.6),
    });
    p.drawText(`Chapter ${Math.ceil(i / 3)}`, {
      x: 220,
      y: 500,
      size: 22,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
  }
  return await doc.save();
}

const samplePath = join(artifacts, "sample.pdf");
const sampleBytes = await buildSamplePdf();
await writeFile(samplePath, sampleBytes);
console.log(`built sample PDF: ${samplePath} (${sampleBytes.length} B)`);

// --- launch chromium with the extension ---
const executablePath = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
if (!existsSync(executablePath)) {
  throw new Error(`Chromium not found at ${executablePath}`);
}
const userDataDir = join(artifacts, "user-data");
await mkdir(userDataDir, { recursive: true });

console.log("launching Chromium with extension loaded…");
// Chromium's headless mode doesn't reliably load unpacked extensions, so this
// script must be invoked under xvfb-run (see `npm run e2e`).
const ctx = await chromium.launchPersistentContext(userDataDir, {
  executablePath,
  headless: false,
  args: [
    `--disable-extensions-except=${root}`,
    `--load-extension=${root}`,
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--no-first-run",
  ],
  viewport: { width: 1280, height: 800 },
});

// Our MV3 extension has no service worker (no background needed), so we can't
// grab the ID from ctx.serviceWorkers(). Instead we parse the Preferences
// file that chromium writes at startup and look up our extension by its
// on-disk path — the unpacked-extension ID chromium assigns is deterministic
// per path but not per-repo, so we can't hardcode it.
const extId = await pollForExtensionId(userDataDir, root);
if (!extId) {
  await ctx.close();
  throw new Error(
    "Could not determine extension ID from Preferences — chromium may have refused to load the extension.",
  );
}
console.log(`extension id: ${extId}`);

const viewerUrl = `chrome-extension://${extId}/src/viewer/viewer.html`;
const page = await ctx.newPage();
page.on("pageerror", (err) => console.error("[page error]", err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.error("[console]", msg.text());
});
await page.goto(viewerUrl);
await page.waitForSelector("#file-input", { state: "attached" });
console.log("viewer.html loaded.");
await page.screenshot({ path: join(artifacts, "01-empty-viewer.png") });

// --- upload the sample PDF ---
await page.setInputFiles("#file-input", samplePath);
console.log("PDF fed to file input; waiting for render…");

// Wait for the first page canvas to appear.
await page.waitForSelector('.pdf-page[data-page="1"] canvas', { timeout: 20_000 });
await page.waitForFunction(
  () => document.getElementById("page-count").textContent !== "–",
);
const pageCount = await page.textContent("#page-count");
console.log(`pdfjs reports ${pageCount} pages.`);
if (Number(pageCount) !== 12) throw new Error(`expected 12 pages, got ${pageCount}`);
await page.screenshot({ path: join(artifacts, "02-pdf-loaded.png") });

// --- navigate to page 4 and add a bookmark ---
await page.fill("#page-num", "4");
await page.press("#page-num", "Enter");
await page.waitForFunction(() => Number(document.getElementById("page-num").value) === 4);

// Click "+ Bookmark".
await page.click("#add-btn");
await page.waitForSelector("#rename-dialog[open]");
await page.fill("#rename-input", "Chapter 2 begins");
// page number field is prefilled from currentPage — leave it.
await page.screenshot({ path: join(artifacts, "03-add-dialog.png") });
await page.click("#rename-ok");
// The <dialog> hides itself when closed, so waitForSelector's default visible-
// state check never resolves. Poll the `open` attribute instead.
await page.waitForFunction(() => !document.getElementById("rename-dialog").open);

// Confirm the bookmark showed up in the sidebar.
const sidebarTitle = await page.textContent(".outline .title");
console.log(`sidebar shows: ${JSON.stringify(sidebarTitle)}`);
if (sidebarTitle?.trim() !== "Chapter 2 begins") {
  throw new Error(`sidebar mismatch: ${sidebarTitle}`);
}
await page.screenshot({ path: join(artifacts, "04-bookmark-added.png") });

// --- save + capture the download ---
const downloadPath = join(artifacts, "downloaded.pdf");
const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 15_000 }),
  page.click("#save-btn"),
]);
await download.saveAs(downloadPath);
console.log(`downloaded: ${downloadPath} (suggested filename: ${download.suggestedFilename()})`);
await page.screenshot({ path: join(artifacts, "05-after-save.png") });

// --- re-parse and confirm the outline round-tripped ---
const modifiedBytes = await readFile(downloadPath);
const modifiedDoc = await PDFDocument.load(modifiedBytes);
const outline = readOutline(modifiedDoc);
console.log("re-parsed outline:", JSON.stringify(outline, null, 2));
if (outline.length !== 1) throw new Error(`expected 1 top-level bookmark, got ${outline.length}`);
if (outline[0].title !== "Chapter 2 begins") throw new Error(`title wrong: ${outline[0].title}`);
if (outline[0].page !== 4) throw new Error(`page wrong: ${outline[0].page}`);

const text = Buffer.from(modifiedBytes).toString("latin1");
if (!text.includes("/PageMode /UseOutlines")) {
  throw new Error("saved PDF is missing /PageMode /UseOutlines");
}
if (!text.includes("/Type /Outlines")) {
  throw new Error("saved PDF is missing /Type /Outlines");
}

// --- extra: open the popup for a screenshot ---
const popup = await ctx.newPage();
await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);
await popup.setViewportSize({ width: 320, height: 260 });
await popup.waitForSelector("#open");
await popup.screenshot({ path: join(artifacts, "06-popup.png") });

await ctx.close();

console.log("\n✅ End-to-end smoke test passed.");
console.log(`Artifacts: ${artifacts}`);
