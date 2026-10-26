// Reading settings: kept in localStorage for instant start-up and mirrored to
// the server so they follow you across browsers on the same machine.
import { api } from './api.js';
import { debounce } from './util.js';

export const DEFAULTS = {
  theme: 'paper',        // paper | sepia | dusk | night
  font: 'literata',      // literata | atkinson | serif | sans
  size: 20,              // px
  leading: 1.6,
  margin: 'normal',      // narrow | normal | wide
  align: 'left',         // left | justify
  layout: 'paged',       // paged | scroll
  columns: 'auto',       // auto | 1 | 2
  anim: true,            // page-turn slide
  checkpoints: true,     // recall checkpoints at the end of sections
  hideCitations: true,   // hide 【…†source】 style markers
  wrapCode: true,        // wrap long code lines when paginated
  calm: true,            // fade toolbars while reading
  wpm: 230,              // learned reading speed
  footer: 'page',        // page | chapter | book
  libView: 'grid',
  libSort: 'recent',
  exportOpts: null,     // last choices in the Export PDF dialog
};

export const FONTS = {
  literata: { name: 'Literata', css: '"Literata", var(--serif-sys)' },
  atkinson: { name: 'Atkinson Hyperlegible', css: '"Atkinson Hyperlegible", var(--ui)' },
  serif:    { name: 'System serif', css: 'var(--serif-sys)' },
  sans:     { name: 'System sans', css: 'var(--ui)' },
};

const listeners = new Set();
export const settings = { ...DEFAULTS };

try { Object.assign(settings, JSON.parse(localStorage.getItem('margin.settings') || '{}')); } catch (e) { /* ignore */ }

const pushServer = debounce(() => api.saveSettings(settings).catch(() => {}), 800);

export function setSetting(patch, { silent = false } = {}) {
  Object.assign(settings, patch);
  try { localStorage.setItem('margin.settings', JSON.stringify(settings)); } catch (e) { /* ignore */ }
  pushServer();
  applyGlobal();
  if (!silent) listeners.forEach((fn) => fn(patch));
}

export function onSettings(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export async function loadServerSettings() {
  try {
    const s = await api.settings();
    if (s && Object.keys(s).length) {
      Object.assign(settings, s);
      try { localStorage.setItem('margin.settings', JSON.stringify(settings)); } catch (e) { /* ignore */ }
    }
  } catch (e) { /* offline: keep local */ }
  applyGlobal();
}

export function applyGlobal() {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.style.setProperty('--read-font', (FONTS[settings.font] || FONTS.literata).css);
  root.style.setProperty('--read-size', settings.size + 'px');
  root.style.setProperty('--read-leading', settings.leading);
  document.body.classList.toggle('calm', !!settings.calm);
  const dark = settings.theme === 'dusk' || settings.theme === 'night';
  const link = document.getElementById('hljs-theme');
  const want = `vendor/hljs/${dark ? 'dark' : 'light'}.css`;
  if (link && !link.href.endsWith(want)) link.href = want;
}

export const THEMES = ['paper', 'sepia', 'dusk', 'night'];
