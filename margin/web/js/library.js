// The library ("bookshelf") view.
import { $, $$, h, esc, icon, fmtMinutes, fmtAgo, hashHue, toast, debounce } from './util.js';
import { api } from './api.js';
import { settings, setSetting, THEMES } from './settings.js';
import { isDue } from './srs.js';
import * as study from './study.js';

export class Library {
  constructor(app) {
    this.app = app;
    this.el = $('#library');
    this.data = { roots: [], books: [] };
    this.states = {};
    this.shelf = 'all';
    this.filter = '';
    this._bind();
  }

  get active() { return !this.el.hidden; }

  async show() {
    this.el.hidden = false;
    document.title = 'Margin';
    await this.load();
    this.es?.close();
    this.es = api.events('', null, () => this.load());
  }

  hide() { this.el.hidden = true; this.es?.close(); this.es = null; }

  async load() {
    try {
      const [lib, states] = await Promise.all([api.library(), api.states()]);
      this.data = lib;
      this.states = states || {};
    } catch (e) {
      $('#lib-books').innerHTML = `<div class="empty">Could not reach the Margin server. Is it still running?<br><small>${esc(e.message)}</small></div>`;
      return;
    }
    this.render();
  }

  render() {
    const { roots, books } = this.data;
    const st = this.states;
    const wpm = settings.wpm || 230;

    // review banner
    let due = 0;
    for (const s of Object.values(st)) for (const c of s.cards || []) if (isDue(c)) due++;
    $('#lib-review').hidden = !due;
    $('#lib-review span').textContent = `Review ${due}`;

    // continue reading
    const cont = books.filter((b) => st[b.id]?.opened && (st[b.id].frac ?? 0) < 0.985).sort((a, b) => st[b.id].opened - st[a.id].opened).slice(0, 3);
    const contEl = $('#lib-continue');
    contEl.replaceChildren();
    if (due) {
      contEl.append(h('div', { class: 'review-banner' },
        h('div', { class: 'big' }, due),
        h('div', { class: 'txt' }, h('b', {}, `card${due > 1 ? 's' : ''} ready for review`), 'A few minutes of spaced review keeps what you read from fading.'),
        h('button', { class: 'btn accent', onclick: () => study.reviewAll(() => this.load()) }, 'Start review')));
    }
    if (cont.length && !this.filter) {
      contEl.append(h('div', { class: 'section-label' }, 'Continue reading'));
      const g = h('div', { class: 'continue' });
      for (const b of cont) {
        const s = st[b.id];
        const left = Math.max(0, (1 - (s.frac || 0)) * b.words / wpm);
        g.append(h('button', { class: 'cont-card', onclick: () => this.open(b) },
          this.cover(b, s),
          h('div', { class: 'meta' }, h('div', { class: 't' }, b.title), h('div', { class: 's' }, `${Math.round((s.frac || 0) * 100)}% · ${fmtMinutes(left)} left · ${fmtAgo(s.opened)}`),
            h('div', { class: 'pbar' }, h('i', { style: { width: `${(s.frac || 0) * 100}%` } })))));
      }
      contEl.append(g);
    }

    // shelves
    const counts = {};
    books.forEach((b) => (counts[b.root] = (counts[b.root] || 0) + 1));
    const shelves = $('#lib-shelves');
    shelves.replaceChildren(h('button', { class: `chip${this.shelf === 'all' ? ' on' : ''}`, onclick: () => { this.shelf = 'all'; this.render(); } }, 'All', h('span', { class: 'n' }, books.length)));
    for (const r of roots) {
      if (!counts[r.id] && (r.kind === 'imported' || r.kind === 'builtin')) continue;
      shelves.append(h('button', { class: `chip${this.shelf === r.id ? ' on' : ''}`, onclick: () => { this.shelf = r.id; this.render(); }, title: r.path }, r.name, h('span', { class: 'n' }, counts[r.id] || 0)));
    }
    if (this.shelf !== 'all' && !roots.some((r) => r.id === this.shelf)) this.shelf = 'all';

    $('#lib-sort').value = settings.libSort;
    $$('.seg [data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === settings.libView));

    // books
    const q = this.filter.toLowerCase();
    const match = (b) => !q || b.title.toLowerCase().includes(q) || b.rel.toLowerCase().includes(q);
    const sorters = {
      recent: (a, b) => (st[b.id]?.opened || 0) - (st[a.id]?.opened || 0) || b.mtime - a.mtime,
      title: (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }),
      modified: (a, b) => b.mtime - a.mtime,
      folder: (a, b) => a.rel.localeCompare(b.rel, undefined, { numeric: true, sensitivity: 'base' }),
      progress: (a, b) => (st[b.id]?.frac || 0) - (st[a.id]?.frac || 0),
    };
    const sorter = sorters[settings.libSort] || sorters.recent;
    const out = $('#lib-books');
    out.replaceChildren();
    const visibleRoots = roots.filter((r) => this.shelf === 'all' || r.id === this.shelf);
    let any = false;
    for (const r of visibleRoots) {
      const list = books.filter((b) => b.root === r.id && match(b)).sort(sorter);
      if (!list.length && (r.kind === 'builtin' || r.kind === 'imported' || q)) continue;
      any = true;
      const label = h('div', { class: 'section-label' }, h('span', {}, r.name), r.kind !== 'builtin' ? h('span', { class: 'path', title: r.path }, r.path) : null,
        r.removable ? h('button', { class: 'btn small ghost', onclick: () => this.removeRoot(r) }, 'Remove') : null);
      out.append(label);
      if (r.missing) { out.append(h('div', { class: 'empty' }, 'This folder is not available right now.')); continue; }
      if (!list.length) { out.append(h('div', { class: 'empty', html: `No Markdown files found in <b>${esc(r.path)}</b>.` })); continue; }
      out.append(settings.libView === 'list' ? this.listView(list) : this.gridView(list));
    }
    if (!any) out.append(h('div', { class: 'empty' }, q ? `Nothing matches “${this.filter}”.` : 'Your library is empty. Add a folder or drop Markdown files here.'));
    if (this.data.truncated) out.append(h('div', { class: 'empty' }, 'Showing the first 5,000 files.'));
  }

  status(b) {
    const s = this.states[b.id];
    const wpm = settings.wpm || 230;
    if (!s?.opened) return { text: fmtMinutes(b.words / wpm), frac: 0, isNew: true };
    if ((s.frac || 0) >= 0.985) return { text: 'Finished', frac: 1 };
    return { text: `${Math.round((s.frac || 0) * 100)}% · ${fmtMinutes((1 - (s.frac || 0)) * b.words / wpm)} left`, frac: s.frac || 0 };
  }

  cover(b, s) {
    const folder = b.folder ? b.folder.split('/').pop() : (this.data.roots.find((r) => r.id === b.root)?.name || '');
    return h('div', { class: 'cover', style: `--h:${hashHue(b.title + b.rel)}` },
      h('div', {}, h('div', { class: 'ct' }, b.title), h('div', { class: 'orn' })),
      h('div', { class: 'cf' }, folder),
      !s?.opened ? h('span', { class: 'new' }, 'NEW') : null);
  }

  gridView(list) {
    const g = h('div', { class: 'grid' });
    for (const b of list) {
      const s = this.states[b.id];
      const stt = this.status(b);
      const el = h('button', { class: 'book', onclick: () => this.open(b), title: b.rel },
        this.cover(b, s),
        h('div', { class: 'bt' }, b.title),
        h('div', { class: 'bs' }, stt.text),
        stt.frac > 0 && stt.frac < 1 ? h('div', { class: 'pbar' }, h('i', { style: { width: `${stt.frac * 100}%` } })) : null);
      if (b.root === 'i') el.addEventListener('contextmenu', (e) => { e.preventDefault(); this.removeImported(b); });
      g.append(el);
    }
    return g;
  }

  listView(list) {
    const l = h('div', { class: 'list' });
    for (const b of list) {
      const stt = this.status(b);
      l.append(h('button', { class: 'row', onclick: () => this.open(b) },
        h('div', { style: 'min-width:0' }, h('div', { class: 'rt' }, b.title), h('div', { class: 'rf' }, b.rel)),
        h('div', {}, h('div', { class: 'rs' }, stt.text), h('div', { class: 'pbar' }, h('i', { style: { width: `${stt.frac * 100}%` } }))),
        h('div', { class: 'rs date' }, b.mtime ? fmtAgo(b.mtime) : ''),
        h('div', { class: 'rs', style: 'text-align:right' }, `${b.words.toLocaleString()} words`)));
    }
    return l;
  }

  open(b) { location.hash = `#/read/${encodeURIComponent(b.id)}`; }

  async removeRoot(r) {
    if (!confirm(`Remove “${r.path}” from your library?\n\nYour files are not touched.`)) return;
    try { await api.removeRoot(r.id); this.shelf = 'all'; await this.load(); } catch (e) { toast(e.message); }
  }

  async removeImported(b) {
    if (!confirm(`Remove “${b.title}” from Imported? This deletes Margin's copy of the file.`)) return;
    try { await api.removeBook(b.id); await this.load(); toast('Removed'); } catch (e) { toast(e.message); }
  }

  addFolder() {
    const os = navigator.userAgent.includes('Windows') ? 'C:\\Users\\you\\Documents\\notes' : '/home/you/notes';
    const input = h('input', { type: 'text', placeholder: os, autocomplete: 'off', spellcheck: 'false' });
    const err = h('div', { style: 'color:#c54444;font-size:13px;margin-top:6px', hidden: true });
    const submit = async () => {
      const p = input.value.trim();
      if (!p) return;
      try {
        await api.addRoot(p);
        study.closeModal();
        await this.load();
        toast('Folder added');
      } catch (e) { err.hidden = false; err.textContent = e.message; }
    };
    study.openModal(h('div', {},
      h('h2', {}, 'Add a folder'),
      h('div', { class: 'sub' }, 'Every Markdown file inside (and in its subfolders) appears in your library. Margin only reads your files; your highlights and progress are stored separately.'),
      h('label', { class: 'fld' }, 'Folder path on this computer'), input, err,
      h('div', { class: 'modal-actions' }, h('button', { class: 'btn ghost', onclick: study.closeModal }, 'Cancel'), h('button', { class: 'btn accent', onclick: submit }, 'Add folder'))),
    { onKey: (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } return true; } });
    setTimeout(() => input.focus(), 30);
  }

  async importFiles(files) {
    const list = Array.from(files).filter((f) => /\.(md|markdown|mdown|mkd|mdx|txt)$/i.test(f.name) || f.type.startsWith('text/'));
    if (!list.length) { toast('Drop Markdown (.md) files'); return; }
    let first = null;
    for (const f of list) {
      try { const r = await api.importFile(f); first = first || r.id; } catch (e) { toast(`${f.name}: ${e.message}`); }
    }
    if (first) {
      if (list.length === 1) location.hash = `#/read/${encodeURIComponent(first)}`;
      else { toast(`${list.length} files added to Imported`); this.shelf = 'i'; await this.load(); }
    }
  }

  onKey(e) {
    if (e.key === '/' && document.activeElement !== $('#lib-filter')) { e.preventDefault(); $('#lib-filter').focus(); return true; }
    if (e.key === 'Escape' && document.activeElement === $('#lib-filter')) { $('#lib-filter').value = ''; this.filter = ''; this.render(); $('#lib-filter').blur(); return true; }
    if (e.key === '?' && document.activeElement?.tagName !== 'INPUT') { study.showKeys(); return true; }
    return false;
  }

  _bind() {
    $('#lib-filter').addEventListener('input', debounce((e) => { this.filter = e.target.value.trim(); this.render(); }, 120));
    $('#lib-sort').addEventListener('change', (e) => { setSetting({ libSort: e.target.value }); this.render(); });
    $$('.seg [data-view]').forEach((b) => b.addEventListener('click', () => { setSetting({ libView: b.dataset.view }); this.render(); }));
    $('#lib-add').addEventListener('click', () => this.addFolder());
    $('#lib-review').addEventListener('click', () => study.reviewAll(() => this.load()));
    $('#lib-files').addEventListener('change', (e) => { this.importFiles(e.target.files); e.target.value = ''; });
    $('#lib-theme').addEventListener('click', () => setSetting({ theme: THEMES[(THEMES.indexOf(settings.theme) + 1) % THEMES.length] }));

    // drag & drop anywhere
    let depth = 0;
    const ov = $('#drop-overlay');
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
    window.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; depth++; ov.hidden = false; e.preventDefault(); });
    window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
    window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) ov.hidden = true; });
    window.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0; ov.hidden = true;
      this.importFiles(e.dataTransfer.files);
    });
  }
}
