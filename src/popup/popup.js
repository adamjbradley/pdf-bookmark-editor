const openBtn = document.getElementById("open");
const versionEl = document.getElementById("version");

openBtn.addEventListener("click", async () => {
  await chrome.tabs.create({
    url: chrome.runtime.getURL("src/viewer/viewer.html"),
  });
  window.close();
});

// Show the extension version so users can report issues.
try {
  const m = chrome.runtime.getManifest();
  versionEl.textContent = `v${m.version}`;
} catch {
  /* ignore — running outside the extension context */
}
