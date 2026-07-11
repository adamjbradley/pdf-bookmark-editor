#!/usr/bin/env node
// Produce a store-ready zip of the extension.
// Output: dist/pdf-bookmark-editor-<version>.zip
//
// Rules for what goes in:
//   - manifest.json + icons/**
//   - src/** (popup, viewer, lib)
//   - vendor/** (pdfjs + pdf-lib runtime files)
//
// Rules for what stays out:
//   - node_modules, scripts/, package*.json (build-only)
//   - README/PRIVACY/STORE_LISTING/CHANGELOG (repo docs, not shipped)
//   - anything under dist/
//   - dot-files, .map files, __MACOSX

import { readFile, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);

const INCLUDE_DIRS = ["icons", "src", "vendor"];
const INCLUDE_FILES = ["manifest.json"];

const REQUIRED_ICONS = ["icon-16.png", "icon-32.png", "icon-48.png", "icon-128.png"];
const REQUIRED_VENDOR = [
  "vendor/pdfjs/pdf.mjs",
  "vendor/pdfjs/pdf.worker.mjs",
  "vendor/pdf-lib/pdf-lib.esm.js",
];

function isKeepable(name) {
  if (name.endsWith(".map")) return false;
  if (name.endsWith(".DS_Store")) return false;
  if (name.startsWith(".")) return false;
  return true;
}

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (!isKeepable(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) results.push(...walk(full));
    else results.push(full);
  }
  return results;
}

async function preflight(manifest) {
  const missing = [];
  for (const name of REQUIRED_ICONS) {
    if (!existsSync(join(root, "icons", name))) missing.push(`icons/${name}`);
  }
  for (const v of REQUIRED_VENDOR) {
    if (!existsSync(join(root, v))) missing.push(v);
  }
  if (!/^\d+\.\d+\.\d+(\.\d+)?$/.test(manifest.version)) {
    missing.push(`manifest.json version "${manifest.version}" is not a valid Chrome extension version (major.minor.patch[.build])`);
  }
  if (missing.length) {
    console.error("Refusing to package. Missing/invalid:");
    for (const m of missing) console.error(`  - ${m}`);
    console.error("Run: npm run vendor && npm run icons");
    process.exit(1);
  }
}

async function main() {
  const manifestPath = join(root, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  await preflight(manifest);

  const outDir = join(root, "dist");
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const zip = new AdmZip();

  for (const file of INCLUDE_FILES) {
    zip.addLocalFile(join(root, file));
  }
  for (const dir of INCLUDE_DIRS) {
    const abs = join(root, dir);
    if (!existsSync(abs)) continue;
    for (const file of walk(abs)) {
      const rel = relative(root, file);
      zip.addLocalFile(file, dirname(rel));
    }
  }

  const zipName = `pdf-bookmark-editor-${manifest.version}.zip`;
  const zipPath = join(outDir, zipName);
  zip.writeZip(zipPath);

  const entries = zip.getEntries().map((e) => e.entryName).sort();
  const list = entries.map((e) => `  ${e}`).join("\n");
  await writeFile(
    join(outDir, "MANIFEST.txt"),
    `Extension: ${manifest.name}\nVersion: ${manifest.version}\nEntries:\n${list}\n`,
    "utf8",
  );

  const bytes = (await readFile(zipPath)).length;
  console.log(`Wrote ${zipPath} (${(bytes / 1024).toFixed(1)} KiB, ${entries.length} entries)`);
  console.log("Upload this zip to the Chrome Web Store or Edge Add-ons dashboard.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
