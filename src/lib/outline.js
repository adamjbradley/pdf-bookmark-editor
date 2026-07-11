// Read / write the /Outlines dictionary of a PDF using pdf-lib's low-level API.
//
// Outline data model used by the extension:
//   node = { title: string, page: 1-based Int, children: node[] }
//
// The tree is written as a full replacement of the catalog's /Outlines entry —
// any prior outline is discarded. The catalog's /PageMode is set to /UseOutlines
// so the bookmarks pane opens by default in most viewers.

import {
  PDFDocument,
  PDFDict,
  PDFArray,
  PDFName,
  PDFNumber,
  PDFHexString,
  PDFRef,
} from "../../vendor/pdf-lib/pdf-lib.esm.js";

const N = PDFName.of;

export async function loadPdf(bytes) {
  return await PDFDocument.load(bytes, { ignoreEncryption: true });
}

// Serialize a PDF, ignoring encryption (the extension re-writes an unencrypted copy).
export async function savePdf(pdfDoc) {
  return await pdfDoc.save({ useObjectStreams: false });
}

// Build (or replace) the outline tree.
// `tree` is the array of top-level nodes (see model above).
export function writeOutline(pdfDoc, tree) {
  const context = pdfDoc.context;
  const pages = pdfDoc.getPages();
  const pageCount = pages.length;

  // Drop any prior outline, plus /PageMode, before writing (or when tree is
  // empty). We can't remove the orphaned indirect objects from the previous
  // outline — pdf-lib will serialize them since they're still in the object
  // table — but they'll no longer be reachable from the catalog. Common PDF
  // viewers ignore unreferenced objects.
  pdfDoc.catalog.delete(N("Outlines"));
  pdfDoc.catalog.delete(N("PageMode"));

  if (!tree || tree.length === 0) return;

  const pageRefFor = (oneBasedPage) => {
    const idx = Math.max(1, Math.min(pageCount, oneBasedPage)) - 1;
    return pages[idx].ref;
  };

  // Register the /Outlines dict up front so children can point at it as Parent.
  const outlinesDict = context.obj({
    Type: "Outlines",
  });
  const outlinesRef = context.register(outlinesDict);

  let totalDescendants = 0;

  // Recursively create dicts for each node. Returns { firstRef, lastRef, openCount }
  // where openCount is the number of visible descendants contributed to /Count on
  // this node's parent (per PDF spec: sum of open direct children + their open
  // descendants).
  function buildLevel(nodes, parentRef) {
    if (!nodes.length) return { firstRef: null, lastRef: null, openCount: 0 };

    const refs = nodes.map(() => context.nextRef());
    const dicts = [];

    let levelOpenCount = 0;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const dict = context.obj({
        Title: PDFHexString.fromText(node.title ?? ""),
        Parent: parentRef,
        Dest: context.obj([pageRefFor(node.page ?? 1), N("Fit")]),
      });
      if (i > 0) dict.set(N("Prev"), refs[i - 1]);
      if (i < nodes.length - 1) dict.set(N("Next"), refs[i + 1]);

      const children = Array.isArray(node.children) ? node.children : [];
      if (children.length > 0) {
        const child = buildLevel(children, refs[i]);
        if (child.firstRef) dict.set(N("First"), child.firstRef);
        if (child.lastRef) dict.set(N("Last"), child.lastRef);
        // Positive Count => open by default; negative => closed.
        // We default to open so users see their bookmarks immediately.
        const visibleUnder = children.length + child.openCount;
        dict.set(N("Count"), PDFNumber.of(visibleUnder));
        levelOpenCount += visibleUnder;
      }

      context.assign(refs[i], dict);
      dicts.push(dict);
      totalDescendants++;
    }

    return {
      firstRef: refs[0],
      lastRef: refs[refs.length - 1],
      openCount: levelOpenCount,
    };
  }

  const top = buildLevel(tree, outlinesRef);
  if (top.firstRef) outlinesDict.set(N("First"), top.firstRef);
  if (top.lastRef) outlinesDict.set(N("Last"), top.lastRef);
  outlinesDict.set(
    N("Count"),
    PDFNumber.of(tree.length + top.openCount),
  );

  pdfDoc.catalog.set(N("Outlines"), outlinesRef);
  pdfDoc.catalog.set(N("PageMode"), N("UseOutlines"));
}

// Best-effort parse of an existing outline into the extension's node model.
// PDF outlines can reference destinations via /Dest (direct or named) or /A /GoTo
// with /D. We resolve as many as we can and fall back to page 1 for anything
// exotic. Callers should treat the returned pages as approximate.
export function readOutline(pdfDoc) {
  const catalog = pdfDoc.catalog;
  const outlinesRef = catalog.get(N("Outlines"));
  if (!outlinesRef) return [];
  const outlines =
    outlinesRef instanceof PDFDict
      ? outlinesRef
      : pdfDoc.context.lookup(outlinesRef, PDFDict);
  if (!outlines) return [];

  const pages = pdfDoc.getPages();
  const pageRefToIndex = new Map();
  pages.forEach((p, i) => pageRefToIndex.set(p.ref.toString(), i + 1));

  const names = readNamedDestinations(pdfDoc);

  function pageFromDest(dest) {
    if (!dest) return 1;
    let arr = null;
    if (dest instanceof PDFArray) arr = dest;
    else if (dest instanceof PDFHexString || typeof dest?.decodeText === "function") {
      const key = dest.decodeText?.() ?? dest.asString?.() ?? "";
      arr = names.get(key) ?? null;
    } else if (typeof dest?.value === "function") {
      const key = dest.value();
      arr = names.get(key) ?? null;
    }
    if (!arr) return 1;
    const pageRef = arr.get(0);
    if (pageRef instanceof PDFRef) {
      return pageRefToIndex.get(pageRef.toString()) ?? 1;
    }
    return 1;
  }

  function walk(itemRef) {
    const item = pdfDoc.context.lookup(itemRef, PDFDict);
    if (!item) return null;
    const titleObj = item.get(N("Title"));
    const title =
      titleObj && typeof titleObj.decodeText === "function"
        ? titleObj.decodeText()
        : String(titleObj ?? "");

    let dest = item.get(N("Dest"));
    if (!dest) {
      const action = item.get(N("A"));
      const actionDict =
        action instanceof PDFDict
          ? action
          : action
            ? pdfDoc.context.lookup(action, PDFDict)
            : null;
      if (actionDict) dest = actionDict.get(N("D"));
    }
    const page = pageFromDest(
      dest instanceof PDFRef ? pdfDoc.context.lookup(dest) : dest,
    );

    const children = [];
    let cursor = item.get(N("First"));
    while (cursor) {
      const child = walk(cursor);
      if (child) children.push(child);
      const childDict = pdfDoc.context.lookup(cursor, PDFDict);
      cursor = childDict?.get(N("Next"));
    }
    return { title, page, children };
  }

  const top = [];
  let cursor = outlines.get(N("First"));
  while (cursor) {
    const node = walk(cursor);
    if (node) top.push(node);
    const cd = pdfDoc.context.lookup(cursor, PDFDict);
    cursor = cd?.get(N("Next"));
  }
  return top;
}

// Walk /Catalog/Names/Dests and /Catalog/Dests to build name -> destination-array.
function readNamedDestinations(pdfDoc) {
  const result = new Map();
  const catalog = pdfDoc.catalog;

  // Legacy: /Catalog/Dests is a dict of name -> dest.
  const dests = catalog.get(N("Dests"));
  const destsDict =
    dests instanceof PDFDict ? dests : dests ? pdfDoc.context.lookup(dests, PDFDict) : null;
  if (destsDict) {
    for (const [k, v] of destsDict.entries()) {
      const val =
        v instanceof PDFArray ? v : v ? pdfDoc.context.lookup(v) : null;
      if (val instanceof PDFArray) result.set(k.asString().slice(1), val);
    }
  }

  // Modern: /Catalog/Names/Dests is a name tree.
  const names = catalog.get(N("Names"));
  const namesDict =
    names instanceof PDFDict ? names : names ? pdfDoc.context.lookup(names, PDFDict) : null;
  const destsTree = namesDict?.get(N("Dests"));
  const destsTreeDict =
    destsTree instanceof PDFDict
      ? destsTree
      : destsTree
        ? pdfDoc.context.lookup(destsTree, PDFDict)
        : null;
  if (destsTreeDict) walkNameTree(pdfDoc, destsTreeDict, result);

  return result;
}

function walkNameTree(pdfDoc, node, out) {
  const namesArr = node.get(N("Names"));
  const namesArray =
    namesArr instanceof PDFArray
      ? namesArr
      : namesArr
        ? pdfDoc.context.lookup(namesArr, PDFArray)
        : null;
  if (namesArray) {
    for (let i = 0; i + 1 < namesArray.size(); i += 2) {
      const key = namesArray.get(i);
      const val = namesArray.get(i + 1);
      const keyStr =
        typeof key?.decodeText === "function"
          ? key.decodeText()
          : typeof key?.asString === "function"
            ? key.asString()
            : String(key ?? "");
      let arr = val;
      if (val instanceof PDFRef) arr = pdfDoc.context.lookup(val);
      if (arr instanceof PDFDict) arr = arr.get(N("D"));
      if (arr instanceof PDFRef) arr = pdfDoc.context.lookup(arr);
      if (arr instanceof PDFArray) out.set(keyStr, arr);
    }
  }
  const kids = node.get(N("Kids"));
  const kidsArr =
    kids instanceof PDFArray ? kids : kids ? pdfDoc.context.lookup(kids, PDFArray) : null;
  if (kidsArr) {
    for (let i = 0; i < kidsArr.size(); i++) {
      const kid = kidsArr.get(i);
      const kidDict =
        kid instanceof PDFDict ? kid : pdfDoc.context.lookup(kid, PDFDict);
      if (kidDict) walkNameTree(pdfDoc, kidDict, out);
    }
  }
}
