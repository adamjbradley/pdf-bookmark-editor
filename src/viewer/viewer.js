import * as pdfjsLib from "../../vendor/pdfjs/pdf.mjs";
import { loadPdf, savePdf, readOutline, writeOutline } from "../lib/outline.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
  "vendor/pdfjs/pdf.worker.mjs",
);

// --- state ---
const state = {
  fileName: null,      // original file name for the saved copy
  rawBytes: null,      // Uint8Array of the original PDF
  pdfDoc: null,        // pdfjs PDFDocumentProxy for rendering
  numPages: 0,
  currentPage: 1,
  scale: 1.0,
  outline: [],         // editable outline tree — see src/lib/outline.js model
  selectedPath: null,  // array of indices into outline[] for the selected node
  renderCache: new Map(), // pageNum -> {task, canvas}
  observer: null,
  dirty: false,
};

// --- element refs ---
const $ = (id) => document.getElementById(id);
const app = $("app");
const openBtn = $("open-btn");
const openBtn2 = $("open-btn-2");
const fileInput = $("file-input");
const pagesEl = $("pages");
const viewport = $("viewport");
const dropHint = $("drop-hint");
const prevBtn = $("prev-btn");
const nextBtn = $("next-btn");
const zoomInBtn = $("zoom-in");
const zoomOutBtn = $("zoom-out");
const zoomLabel = $("zoom-label");
const pageNumInput = $("page-num");
const pageCountEl = $("page-count");
const addBtn = $("add-btn");
const saveBtn = $("save-btn");
const outlineEl = $("outline");
const toastEl = $("toast");
const renameDialog = $("rename-dialog");
const renameTitle = $("rename-title");
const renameInput = $("rename-input");
const renamePage = $("rename-page");

// --- helpers ---
function toast(msg, kind = "info") {
  toastEl.textContent = msg;
  toastEl.className = "toast show" + (kind === "error" ? " error" : "");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    toastEl.classList.remove("show");
  }, 2400);
}

function updateToolbar() {
  const has = !!state.pdfDoc;
  prevBtn.disabled = !has || state.currentPage <= 1;
  nextBtn.disabled = !has || state.currentPage >= state.numPages;
  zoomInBtn.disabled = !has || state.scale >= 3;
  zoomOutBtn.disabled = !has || state.scale <= 0.4;
  addBtn.disabled = !has;
  saveBtn.disabled = !has;
  pageNumInput.disabled = !has;
  zoomLabel.textContent = Math.round(state.scale * 100) + "%";
  pageNumInput.value = String(state.currentPage);
  pageCountEl.textContent = has ? String(state.numPages) : "–";
  app.classList.toggle("empty", !has);
}

// --- file open ---
openBtn.addEventListener("click", () => fileInput.click());
openBtn2?.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const f = fileInput.files?.[0];
  if (f) await openFile(f);
  fileInput.value = "";
});

// drag & drop
["dragenter", "dragover"].forEach((evt) => {
  viewport.addEventListener(evt, (e) => {
    if (![...e.dataTransfer.types].includes("Files")) return;
    e.preventDefault();
    dropHint.classList.add("dragover");
  });
});
["dragleave", "drop"].forEach((evt) => {
  viewport.addEventListener(evt, () => dropHint.classList.remove("dragover"));
});
viewport.addEventListener("drop", async (e) => {
  const f = [...(e.dataTransfer?.files ?? [])].find(
    (x) => x.type === "application/pdf" || x.name?.toLowerCase().endsWith(".pdf"),
  );
  if (!f) return;
  e.preventDefault();
  await openFile(f);
});

async function openFile(file) {
  if (state.dirty) {
    if (!confirm("Discard unsaved bookmark changes?")) return;
  }
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    state.rawBytes = buf;
    state.fileName = file.name || "document.pdf";
    // pdfjs mutates the buffer we hand it — pass a fresh copy so state.rawBytes
    // remains an untouched original we can hand to pdf-lib later.
    const pdfjsCopy = new Uint8Array(buf);
    const task = pdfjsLib.getDocument({ data: pdfjsCopy });
    const doc = await task.promise;
    state.pdfDoc = doc;
    state.numPages = doc.numPages;
    state.currentPage = 1;
    await loadScale();
    state.selectedPath = null;
    state.dirty = false;

    // Read outline via pdf-lib (authoritative for editing).
    const editableDoc = await loadPdf(buf);
    state.outline = readOutline(editableDoc);

    renderOutline();
    await renderAllPages();
    updateToolbar();
    document.title = `${state.fileName} — PDF Bookmark Editor`;
  } catch (err) {
    console.error(err);
    toast(`Failed to open PDF: ${err.message ?? err}`, "error");
  }
}

// --- rendering ---
async function renderAllPages() {
  pagesEl.innerHTML = "";
  state.renderCache.clear();
  if (state.observer) state.observer.disconnect();

  const containers = [];
  for (let n = 1; n <= state.numPages; n++) {
    const wrap = document.createElement("div");
    wrap.className = "pdf-page";
    wrap.dataset.page = String(n);
    const badge = document.createElement("div");
    badge.className = "page-num";
    badge.textContent = String(n);
    wrap.append(badge);
    pagesEl.append(wrap);
    containers.push(wrap);
  }
  await sizeAllPages();

  // Render pages lazily as they scroll into view, plus a small look-ahead.
  state.observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const n = Number(entry.target.dataset.page);
        if (entry.isIntersecting) renderPage(n);
        if (entry.intersectionRatio > 0.5) setCurrentPage(n, false);
      }
    },
    { root: viewport, rootMargin: "400px 0px", threshold: [0, 0.5, 1] },
  );
  containers.forEach((c) => state.observer.observe(c));

  // Kick off the first page synchronously so users see content immediately.
  await renderPage(1);
  setCurrentPage(1, true);
}

async function sizeAllPages() {
  // Reserve the correct pixel size for every page container up front so the
  // scroll length is stable regardless of render order.
  for (let n = 1; n <= state.numPages; n++) {
    const wrap = pagesEl.querySelector(`.pdf-page[data-page="${n}"]`);
    const page = await state.pdfDoc.getPage(n);
    const viewportSize = page.getViewport({ scale: state.scale });
    wrap.style.width = viewportSize.width + "px";
    wrap.style.height = viewportSize.height + "px";
  }
}

async function renderPage(n) {
  if (state.renderCache.has(n)) return;
  const wrap = pagesEl.querySelector(`.pdf-page[data-page="${n}"]`);
  if (!wrap) return;
  const page = await state.pdfDoc.getPage(n);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const viewportSize = page.getViewport({ scale: state.scale * dpr });
  const canvas = document.createElement("canvas");
  canvas.width = viewportSize.width;
  canvas.height = viewportSize.height;
  canvas.style.width = viewportSize.width / dpr + "px";
  canvas.style.height = viewportSize.height / dpr + "px";
  wrap.append(canvas);
  const task = page.render({
    canvasContext: canvas.getContext("2d"),
    viewport: viewportSize,
  });
  state.renderCache.set(n, { task, canvas });
  try {
    await task.promise;
  } catch (err) {
    if (err?.name !== "RenderingCancelledException") {
      console.warn("render failed", n, err);
    }
  }
}

function setCurrentPage(n, scrollIntoView) {
  if (n < 1 || n > state.numPages) return;
  state.currentPage = n;
  for (const el of pagesEl.querySelectorAll(".pdf-page")) {
    el.classList.toggle("current", Number(el.dataset.page) === n);
  }
  if (scrollIntoView) {
    const wrap = pagesEl.querySelector(`.pdf-page[data-page="${n}"]`);
    wrap?.scrollIntoView({ block: "start" });
  }
  updateToolbar();
}

// --- toolbar wiring ---
prevBtn.addEventListener("click", () => setCurrentPage(state.currentPage - 1, true));
nextBtn.addEventListener("click", () => setCurrentPage(state.currentPage + 1, true));
pageNumInput.addEventListener("change", () => {
  const n = Number(pageNumInput.value);
  if (Number.isFinite(n)) setCurrentPage(n, true);
});
zoomInBtn.addEventListener("click", () => setZoom(state.scale + 0.15));
zoomOutBtn.addEventListener("click", () => setZoom(state.scale - 0.15));

async function setZoom(next) {
  const clamped = Math.max(0.4, Math.min(3, Number(next.toFixed(2))));
  if (clamped === state.scale) return;
  state.scale = clamped;
  saveScale(clamped);
  await renderAllPages();
}

const SCALE_KEY = "pref.viewer.scale";
function saveScale(v) {
  chrome.storage?.local?.set?.({ [SCALE_KEY]: v }).catch?.(() => {});
}
async function loadScale() {
  try {
    const out = await chrome.storage.local.get(SCALE_KEY);
    const v = out?.[SCALE_KEY];
    if (typeof v === "number" && v >= 0.4 && v <= 3) state.scale = v;
  } catch {
    /* first launch or storage unavailable — keep the default */
  }
}

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea") || renameDialog.open) return;
  if (e.key === "ArrowLeft" || e.key === "PageUp") {
    setCurrentPage(state.currentPage - 1, true);
    e.preventDefault();
  } else if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
    setCurrentPage(state.currentPage + 1, true);
    e.preventDefault();
  } else if ((e.key === "+" || e.key === "=") && (e.ctrlKey || e.metaKey)) {
    setZoom(state.scale + 0.15);
    e.preventDefault();
  } else if (e.key === "-" && (e.ctrlKey || e.metaKey)) {
    setZoom(state.scale - 0.15);
    e.preventDefault();
  } else if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    savePdfFile();
  } else if (e.key === "b" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    addBookmark();
  }
});

// --- outline rendering ---
function renderOutline() {
  outlineEl.innerHTML = "";
  const empty = document.getElementById("outline-empty");
  if (state.outline.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  const frag = document.createDocumentFragment();
  state.outline.forEach((node, i) => {
    frag.append(renderNode(node, [i]));
  });
  outlineEl.append(frag);
  updateSelectedInDom();
}

function renderNode(node, path) {
  const li = document.createElement("li");
  li.dataset.path = path.join(".");
  const hasKids = node.children && node.children.length > 0;
  li.classList.toggle("leaf", !hasKids);

  const row = document.createElement("div");
  row.className = "row";
  row.tabIndex = 0;

  const caret = document.createElement("span");
  caret.className = "caret";
  caret.textContent = "▾";
  caret.addEventListener("click", (e) => {
    e.stopPropagation();
    li.classList.toggle("collapsed");
  });

  const title = document.createElement("span");
  title.className = "title";
  title.textContent = node.title || "(untitled)";
  title.title = node.title || "";

  const page = document.createElement("span");
  page.className = "page";
  page.textContent = `p. ${node.page}`;

  row.append(caret, title, page);
  li.append(row);

  const actions = document.createElement("div");
  actions.className = "actions";
  actions.append(
    linkBtn("Go", () => setCurrentPage(node.page, true)),
    linkBtn("Rename", () => renameNodeAt(path)),
    linkBtn("Add child", () => addChildAt(path)),
    linkBtn("Delete", () => deleteNodeAt(path), true),
  );
  li.append(actions);

  row.addEventListener("click", (e) => {
    if (e.target === caret) return;
    selectPath(path);
    setCurrentPage(node.page, true);
  });
  row.addEventListener("dblclick", (e) => {
    if (e.target === caret) return;
    renameNodeAt(path);
  });

  if (hasKids) {
    const ul = document.createElement("ul");
    node.children.forEach((child, i) => {
      ul.append(renderNode(child, [...path, i]));
    });
    li.append(ul);
  }
  return li;
}

function linkBtn(label, onClick, danger = false) {
  const b = document.createElement("button");
  b.className = "link" + (danger ? " danger" : "");
  b.type = "button";
  b.textContent = label;
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

function selectPath(path) {
  state.selectedPath = path;
  updateSelectedInDom();
}

function updateSelectedInDom() {
  outlineEl.querySelectorAll("li.selected").forEach((el) => el.classList.remove("selected"));
  if (!state.selectedPath) return;
  const key = state.selectedPath.join(".");
  const li = outlineEl.querySelector(`li[data-path="${key}"]`);
  li?.classList.add("selected");
}

function getNodeAt(path) {
  let arr = state.outline;
  let node = null;
  for (const idx of path) {
    node = arr[idx];
    if (!node) return null;
    arr = node.children ?? (node.children = []);
  }
  return node;
}

function getParentArrayAt(path) {
  if (path.length === 1) return state.outline;
  let arr = state.outline;
  for (let i = 0; i < path.length - 1; i++) {
    arr = arr[path[i]].children;
  }
  return arr;
}

// --- outline mutations ---
addBtn.addEventListener("click", addBookmark);

function addBookmark() {
  const suggested = `Page ${state.currentPage}`;
  showRenameDialog({
    heading: "New bookmark",
    title: suggested,
    page: state.currentPage,
    onOk: ({ title, page }) => {
      const node = { title, page, children: [] };
      state.outline.push(node);
      state.selectedPath = [state.outline.length - 1];
      state.dirty = true;
      renderOutline();
      toast(`Added “${title}”`);
    },
  });
}

function renameNodeAt(path) {
  const node = getNodeAt(path);
  if (!node) return;
  showRenameDialog({
    heading: "Rename bookmark",
    title: node.title,
    page: node.page,
    onOk: ({ title, page }) => {
      node.title = title;
      node.page = page;
      state.dirty = true;
      renderOutline();
    },
  });
}

function addChildAt(path) {
  const parent = getNodeAt(path);
  if (!parent) return;
  parent.children ??= [];
  showRenameDialog({
    heading: "New child bookmark",
    title: `Page ${state.currentPage}`,
    page: state.currentPage,
    onOk: ({ title, page }) => {
      const node = { title, page, children: [] };
      parent.children.push(node);
      state.selectedPath = [...path, parent.children.length - 1];
      state.dirty = true;
      renderOutline();
    },
  });
}

function deleteNodeAt(path) {
  const node = getNodeAt(path);
  if (!node) return;
  const label = node.title || "this bookmark";
  const kids = node.children?.length ?? 0;
  const suffix = kids ? ` and its ${kids} child bookmark${kids === 1 ? "" : "s"}` : "";
  if (!confirm(`Delete “${label}”${suffix}?`)) return;
  const parent = getParentArrayAt(path);
  parent.splice(path[path.length - 1], 1);
  if (state.selectedPath?.join(".").startsWith(path.join("."))) {
    state.selectedPath = null;
  }
  state.dirty = true;
  renderOutline();
}

// --- rename dialog ---
function showRenameDialog({ heading, title, page, onOk }) {
  renameTitle.textContent = heading;
  renameInput.value = title ?? "";
  renamePage.value = String(page ?? 1);
  renamePage.min = "1";
  renamePage.max = String(state.numPages);
  renameDialog.returnValue = "";
  renameDialog.showModal();
  renameInput.select();

  const onClose = () => {
    renameDialog.removeEventListener("close", onClose);
    if (renameDialog.returnValue !== "ok") return;
    const t = renameInput.value.trim();
    let p = Math.round(Number(renamePage.value));
    if (!t) {
      toast("Title is required", "error");
      return;
    }
    if (!Number.isFinite(p) || p < 1) p = 1;
    if (p > state.numPages) p = state.numPages;
    onOk({ title: t, page: p });
  };
  renameDialog.addEventListener("close", onClose);
}

// --- save ---
saveBtn.addEventListener("click", savePdfFile);

async function savePdfFile() {
  if (!state.rawBytes) return;
  try {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    const doc = await loadPdf(state.rawBytes);
    writeOutline(doc, state.outline);
    const bytes = await savePdf(doc);
    downloadBytes(bytes, deriveOutputName(state.fileName));
    state.dirty = false;
    toast("Saved.");
  } catch (err) {
    console.error(err);
    toast(`Save failed: ${err.message ?? err}`, "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save PDF…";
    updateToolbar();
  }
}

function deriveOutputName(name) {
  if (!name) return "bookmarked.pdf";
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return `${stem} (bookmarked).pdf`;
}

function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

window.addEventListener("beforeunload", (e) => {
  if (!state.dirty) return;
  e.preventDefault();
  e.returnValue = "";
});

updateToolbar();
