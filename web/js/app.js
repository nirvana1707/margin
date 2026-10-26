// Margin — app shell: routing between the library and the reader, global keys.
import { loadServerSettings, applyGlobal } from './settings.js';
import { Library } from './library.js';
import { Reader } from './reader.js';
import * as study from './study.js';
import { openExportDialog, initPrinting } from './export.js';

const app = {};
app.library = new Library(app);
app.reader = new Reader(app);
window.__reader = app.reader; // handy for debugging from the console

async function route() {
  const hash = location.hash || '#/';
  const m = hash.match(/^#\/read\/([^/]+)(?:\/(.+))?$/);
  study.closeModal();
  if (m) {
    const id = decodeURIComponent(m[1]);
    const anchor = m[2] ? decodeURIComponent(m[2]) : null;
    app.library.hide();
    await app.reader.open(id, anchor);
  } else {
    app.reader.close();
    await app.library.show();
  }
}

document.addEventListener('keydown', (e) => {
  // Ctrl+P / Cmd+P while reading opens the export options instead of printing the screen
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'p' && app.reader.active && !study.modalOpen()) {
    e.preventDefault();
    openExportDialog(app.reader);
    return;
  }
  if (study.modalOpen()) { study.modalKeydown(e); return; }
  if (app.reader.active) app.reader.onKey(e);
  else if (app.library.active) app.library.onKey(e);
});

window.addEventListener('hashchange', route);
initPrinting(app.reader);

applyGlobal();
loadServerSettings().then(route);
