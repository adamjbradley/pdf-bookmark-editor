#!/usr/bin/env node
// Capture the four Chrome Web Store / Edge Add-ons screenshots at 1280×800.
//
// Output → store-assets/screenshots/
//   01-viewer-with-outline.png    Hero shot: viewer + nested outline sidebar
//   02-add-bookmark.png            Add-bookmark dialog open
//   03-nested-sidebar.png          Sidebar closeup with nested + expanded tree
//   04-popup.png                   Toolbar popup (300×260 letterboxed to 1280×800)
//
// Run with `npm run screenshots`. Drives the unpacked extension in Chromium
// under xvfb, feeds it a synthetic multi-chapter PDF, populates an outline,
// then screenshots each state.

import { chromium } from "playwright-core";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "../vendor/pdf-lib/pdf-lib.esm.js";
import { writeOutline, savePdf } from "../src/lib/outline.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const outDir = join(root, "store-assets", "screenshots");
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

// --- build a rich sample PDF ---
const chapters = [
  { title: "Cover", page: 1 },
  { title: "Table of Contents", page: 2 },
  { title: "Introduction", page: 3 },
  { title: "Chapter 1 — Methodology", page: 5 },
  { title: "Section 1.1 — Data collection", page: 6, level: 1 },
  { title: "Section 1.2 — Instruments", page: 8, level: 1 },
  { title: "Chapter 2 — Results", page: 10 },
  { title: "Section 2.1 — Cohort A", page: 11, level: 1 },
  { title: "Section 2.2 — Cohort B", page: 13, level: 1 },
  { title: "Chapter 3 — Discussion", page: 15 },
  { title: "References", page: 18 },
  { title: "Appendix A — Raw data", page: 20 },
];

async function buildRichPdf() {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const totalPages = 22;
  for (let i = 1; i <= totalPages; i++) {
    const p = doc.addPage([612, 792]);
    // Header
    p.drawText("Research Report — 2026 Edition", {
      x: 72, y: 740, size: 10, font: regular, color: rgb(0.4, 0.4, 0.45),
    });
    // Big page marker
    p.drawText(String(i), {
      x: 510, y: 740, size: 10, font: regular, color: rgb(0.4, 0.4, 0.45),
    });
    // Section title matching the outline
    const inThisChapter = chapters
      .filter((c) => c.page <= i)
      .slice(-1)[0];
    if (inThisChapter) {
      p.drawText(inThisChapter.title, {
        x: 72, y: 680, size: 24, font: bold, color: rgb(0.12, 0.12, 0.18),
      });
    }
    // Body paragraphs
    const bodyLines = [
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod",
      "tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim",
      "veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea",
      "commodo consequat. Duis aute irure dolor in reprehenderit in voluptate.",
      "",
      "Velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat",
      "cupidatat non proident, sunt in culpa qui officia deserunt mollit anim",
      "id est laborum. Sed ut perspiciatis unde omnis iste natus error sit.",
      "",
      "Voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque",
      "ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae",
      "dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas.",
    ];
    let y = 620;
    for (const line of bodyLines) {
      p.drawText(line, { x: 72, y, size: 12, font: regular, color: rgb(0.15, 0.15, 0.2) });
      y -= 18;
    }
    // Footer
    p.drawText(`Page ${i} of ${totalPages}`, {
      x: 72, y: 60, size: 9, font: regular, color: rgb(0.55, 0.55, 0.6),
    });
  }
  return await doc.save();
}

const samplePath = join(outDir, "_sample.pdf");
// Pre-populate the outline so the sidebar is populated the instant the PDF
// loads — no need to script the "Add bookmark" dialog N times.
const tree = [
  { title: "Cover", page: 1, children: [] },
  { title: "Table of Contents", page: 2, children: [] },
  { title: "Introduction", page: 3, children: [] },
  {
    title: "Chapter 1 — Methodology",
    page: 5,
    children: [
      { title: "Section 1.1 — Data collection", page: 6, children: [] },
      { title: "Section 1.2 — Instruments", page: 8, children: [] },
    ],
  },
  {
    title: "Chapter 2 — Results",
    page: 10,
    children: [
      { title: "Section 2.1 — Cohort A", page: 11, children: [] },
      { title: "Section 2.2 — Cohort B", page: 13, children: [] },
    ],
  },
  { title: "Chapter 3 — Discussion", page: 15, children: [] },
  { title: "References", page: 18, children: [] },
];
{
  const bytes = await buildRichPdf();
  const doc = await PDFDocument.load(bytes);
  writeOutline(doc, tree);
  await writeFile(samplePath, await savePdf(doc));
}

// --- launch chromium ---
const executablePath = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
if (!existsSync(executablePath)) throw new Error(`Chromium not found at ${executablePath}`);
const userDataDir = join(outDir, "_user-data");
await mkdir(userDataDir, { recursive: true });

const ctx = await chromium.launchPersistentContext(userDataDir, {
  executablePath,
  headless: false,
  args: [
    `--disable-extensions-except=${root}`,
    `--load-extension=${root}`,
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--hide-crash-restore-bubble",
  ],
  viewport: { width: 1280, height: 800 },
});

async function extensionId() {
  const prefs = join(userDataDir, "Default", "Preferences");
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const data = JSON.parse(await readFile(prefs, "utf8"));
      const settings = data?.extensions?.settings ?? {};
      for (const [id, info] of Object.entries(settings)) {
        if (info?.path === root && /^[a-p]{32}$/.test(id)) return id;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("could not find extension id");
}
const extId = await extensionId();

const viewer = `chrome-extension://${extId}/src/viewer/viewer.html`;
const popup = `chrome-extension://${extId}/src/popup/popup.html`;

async function inViewer(fn) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(viewer);
  await page.waitForSelector("#file-input", { state: "attached" });
  await page.setInputFiles("#file-input", samplePath);
  await page.waitForSelector('.pdf-page[data-page="1"] canvas', { timeout: 20_000 });
  await page.waitForFunction(
    () => document.getElementById("page-count").textContent !== "–",
  );
  return { page };
}

console.log("→ opening viewer with pre-populated outline…");
const { page } = await inViewer();
await page.waitForSelector(".outline li"); // outline sidebar populated from the PDF

// Scroll the pdf to page 5 so a real chapter title is visible.
await page.fill("#page-num", "5");
await page.press("#page-num", "Enter");
await page.waitForTimeout(500);
await page.waitForSelector('.pdf-page[data-page="5"] canvas');
await page.waitForTimeout(400);

// --- Shot 1: hero, viewer + full nested outline sidebar ---
await page.screenshot({ path: join(outDir, "01-viewer-with-outline.png") });
console.log("  01-viewer-with-outline.png");

// --- Shot 2: add bookmark dialog open ---
await page.fill("#page-num", "10");
await page.press("#page-num", "Enter");
await page.waitForTimeout(400);
await page.click("#add-btn");
await page.waitForSelector("#rename-dialog[open]");
await page.fill("#rename-input", "Chapter 2 — Results");
await page.screenshot({ path: join(outDir, "02-add-bookmark.png") });
console.log("  02-add-bookmark.png");
// Cancel that dialog so state stays clean.
await page.press("#rename-input", "Escape");
await page.waitForFunction(() => !document.getElementById("rename-dialog").open);

// --- Shot 3: nested sidebar with one branch collapsed ---
// Collapse "Chapter 2 — Results" to demonstrate the tree UX.
await page.evaluate(() => {
  const el = [...document.querySelectorAll(".outline .title")].find(
    (n) => n.textContent.startsWith("Chapter 2"),
  );
  if (el) el.closest("li").classList.add("collapsed");
});
// Focus the sidebar area more prominently — take a viewport shot.
await page.screenshot({ path: join(outDir, "03-nested-sidebar.png") });
console.log("  03-nested-sidebar.png");

// --- Shot 4: popup, letterboxed to 1280×800 with a neutral background ---
const popupPage = await ctx.newPage();
await popupPage.setViewportSize({ width: 320, height: 260 });
await popupPage.goto(popup);
await popupPage.waitForSelector("#open");
const popupBuf = await popupPage.screenshot();
await popupPage.close();

// Composite into a 1280×800 canvas using an offscreen page.
const compose = await ctx.newPage();
await compose.setViewportSize({ width: 1280, height: 800 });
await compose.setContent(`<!doctype html><html><head><style>
  html,body { margin:0; padding:0; height:100%; }
  body {
    background: linear-gradient(135deg, #2f6feb, #1e52c4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    color: white;
  }
  .stage {
    display: flex;
    align-items: center;
    gap: 48px;
    max-width: 1180px;
  }
  .copy h2 { font-size: 42px; margin: 0 0 12px; letter-spacing: -0.01em; }
  .copy p { font-size: 20px; margin: 0; opacity: 0.9; max-width: 500px; line-height: 1.4; }
  .card {
    padding: 16px;
    background: rgba(255,255,255,0.15);
    backdrop-filter: blur(10px);
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.35);
  }
  .card img { display: block; border-radius: 10px; }
</style></head><body>
  <div class="stage">
    <div class="copy">
      <h2>One click, then bookmarks.</h2>
      <p>Pin the extension to your toolbar and jump into any PDF's outline editor in a single click.</p>
    </div>
    <div class="card">
      <img id="popup" width="320" height="260">
    </div>
  </div>
</body></html>`);
await compose.evaluate(async (dataUrl) => {
  const img = document.getElementById("popup");
  img.src = dataUrl;
  await img.decode?.();
}, `data:image/png;base64,${popupBuf.toString("base64")}`);
await compose.waitForTimeout(200);
await compose.screenshot({ path: join(outDir, "04-popup.png") });
console.log("  04-popup.png");

await ctx.close();

// Clean up work files.
await rm(samplePath, { force: true });
await rm(userDataDir, { recursive: true, force: true });

console.log(`\n✅ Store screenshots ready in ${outDir}`);
