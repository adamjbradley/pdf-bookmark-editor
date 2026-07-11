#!/usr/bin/env node
// End-to-end sanity check for the outline writer.
// 1. Build a fresh multi-page PDF with pdf-lib.
// 2. Feed it through src/lib/outline.js's writeOutline().
// 3. Re-parse with readOutline() and confirm the tree round-trips.

// Import pdf-lib from the *vendored* build so we share module instances with
// src/lib/outline.js. Importing from "pdf-lib" (node_modules) would give us a
// second copy of the module where PDFName.of("Outlines") is a different class,
// which breaks catalog.get() lookups.
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "../vendor/pdf-lib/pdf-lib.esm.js";
import { readOutline, writeOutline, savePdf } from "../src/lib/outline.js";

async function makeSamplePdf(pageCount = 8) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pageCount; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Page ${i}`, { x: 72, y: 720, size: 32, font, color: rgb(0, 0, 0) });
  }
  return await doc.save();
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok  ${msg}`);
}

function compareTree(a, b, path = "") {
  assert(a.length === b.length, `${path || "top"} length ${a.length} === ${b.length}`);
  for (let i = 0; i < a.length; i++) {
    const p = `${path}[${i}]`;
    assert(a[i].title === b[i].title, `${p} title === ${JSON.stringify(a[i].title)}`);
    assert(a[i].page === b[i].page, `${p} page === ${a[i].page}`);
    compareTree(a[i].children ?? [], b[i].children ?? [], p);
  }
}

async function main() {
  const bytes = await makeSamplePdf(8);
  const doc = await PDFDocument.load(bytes);

  const tree = [
    {
      title: "Front matter",
      page: 1,
      children: [
        { title: "Preface", page: 2, children: [] },
        { title: "Acknowledgements — “thanks”", page: 3, children: [] },
      ],
    },
    {
      title: "Part I",
      page: 4,
      children: [
        { title: "Chapter 1", page: 5, children: [] },
        { title: "Chapter 2", page: 7, children: [] },
      ],
    },
    { title: "Index", page: 8, children: [] },
  ];

  writeOutline(doc, tree);
  const out = await savePdf(doc);

  const roundTrip = await PDFDocument.load(out);
  const parsed = readOutline(roundTrip);
  compareTree(tree, parsed);

  // Peek at the serialized bytes — savePdf() disables object streams so the
  // catalog + outline dicts appear in plain text.
  const text = Buffer.from(out).toString("latin1");
  assert(text.includes("/PageMode /UseOutlines"), "catalog has /PageMode /UseOutlines");
  assert(text.includes("/Type /Outlines"), "PDF has /Outlines dict");
  assert(/\/Title <FEFF/i.test(text) || text.includes("(Front matter)"), "titles are encoded");
  assert(text.includes("/Fit"), "destinations use /Fit");

  // And: writing an empty tree should strip /Outlines.
  const empty = await PDFDocument.load(bytes);
  writeOutline(empty, []);
  const emptyOut = Buffer.from(await savePdf(empty)).toString("latin1");
  assert(!emptyOut.includes("/Outlines"), "empty tree drops /Outlines");

  console.log("\nAll outline round-trip checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
