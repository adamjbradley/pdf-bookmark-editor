#!/usr/bin/env node
// Copy the runtime files from pdfjs-dist and pdf-lib into vendor/.
// Run after `npm install`. Idempotent.

import { copyFile, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function copy(src, dst) {
  await ensureDir(dirname(dst));
  await copyFile(src, dst);
  console.log(`  ${dst.replace(root + "/", "")}`);
}

async function vendorPdfJs() {
  const pkgPath = require.resolve("pdfjs-dist/package.json");
  const pkgDir = dirname(pkgPath);
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  console.log(`Vendoring pdfjs-dist ${pkg.version}`);

  const outDir = join(root, "vendor", "pdfjs");
  await rm(outDir, { recursive: true, force: true });
  await ensureDir(outDir);

  // Modern (ESM) build works in all Chromium >= 116.
  const candidates = [
    ["build/pdf.mjs", "pdf.mjs"],
    ["build/pdf.mjs.map", "pdf.mjs.map"],
    ["build/pdf.worker.mjs", "pdf.worker.mjs"],
    ["build/pdf.worker.mjs.map", "pdf.worker.mjs.map"],
  ];
  for (const [src, dst] of candidates) {
    const srcPath = join(pkgDir, src);
    if (existsSync(srcPath)) await copy(srcPath, join(outDir, dst));
  }

  // Record version so we can display it in the popup.
  await writeFile(
    join(outDir, "VERSION"),
    `${pkg.version}\n`,
    "utf8",
  );

  for (const l of ["LICENSE", "LICENSE.md"]) {
    const p = join(pkgDir, l);
    if (existsSync(p)) await copy(p, join(outDir, l));
  }
}

async function vendorPdfLib() {
  const pkgPath = require.resolve("pdf-lib/package.json");
  const pkgDir = dirname(pkgPath);
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  console.log(`Vendoring pdf-lib ${pkg.version}`);

  const outDir = join(root, "vendor", "pdf-lib");
  await rm(outDir, { recursive: true, force: true });
  await ensureDir(outDir);

  // Ship the non-minified ESM build — reviewers can read the source.
  const esmCandidates = [
    "dist/pdf-lib.esm.js",
    "dist/pdf-lib.esm.min.js",
  ];
  let picked = null;
  for (const c of esmCandidates) {
    const p = join(pkgDir, c);
    if (existsSync(p)) {
      picked = p;
      break;
    }
  }
  if (!picked) {
    throw new Error(
      `Could not find a pdf-lib ESM build under ${pkgDir}/dist`,
    );
  }
  await copy(picked, join(outDir, "pdf-lib.esm.js"));
  await writeFile(join(outDir, "VERSION"), `${pkg.version}\n`, "utf8");
  for (const l of ["LICENSE", "LICENSE.md"]) {
    const p = join(pkgDir, l);
    if (existsSync(p)) await copy(p, join(outDir, l));
  }
}

async function main() {
  await vendorPdfJs();
  await vendorPdfLib();
  console.log("vendor/ populated. Extension is ready to load unpacked.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
