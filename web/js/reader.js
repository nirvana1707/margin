// The reading view: rendering, pagination, navigation, highlights, checkpoints.
import { $, $$, h, esc, icon, debounce, uid, toast, fmtMinutes, fmtAgo, clamp, isTyping } from './util.js';
import { api } from './api.js';
import { settings, setSetting, onSettings } from './settings.js';
import { renderMarkdown, extractConcepts, renderMermaid, words } from './render.js';
import { buildIndex, rangeToQuote, locate, wrapRange, unwrap, sentenceAround } from './anchor.js';
import { isDue } from './srs.js';
import * as panels from './panels.js';
import * as study from './study.js';
import { openExportDialog } from './export.js';
import { classifyHeading } from './textbook.js';
import * as practice from './practice.js';
import { resolveAnchor, linkify, makeResolver, docChapterNo } from './nav.js';

const COLORS = ['yellow', 'blue', 'pink', 'green'];

export class Reader {
  constructor(app) {
    this.app = app;
    this.el = $('#reader');
    this.viewport = $('#viewport');
    this.clip = $('#clip');
    this.content = $('#content');
    this.selmenu = $('#selmenu');
    this.popover = $('#popover');
    this.book = null;
    this.state = null;
    this.page = 0;
    this.pages = 1;
    this.blocks = [];
    this.blockPage = [];
    this.saveState = debounce(() => this._persist(), 900);
    this.relayout = debounce(() => this.layout(), 120);
    this.lastTurn = 0;
    this.lastInteract = Date.now();
    this._bind();
    onSettings((patch) => this._onSettings(patch));
  }

  get active() { return !this.el.hidden; }
  // `mode` is the layout currently on screen (settings may already say something else mid-switch)
  get paged() { return (this.mode || settings.layout) === 'paged'; }

  // ------------------------------------------------------------------ open
  async open(id, anchor) {
    // a link to a place in the document that is already open
    if (this.book && this.book.id === id && this.active) {
      if (anchor) { this.rememberJump(); this._goAnchor(anchor); }
      this._cleanHash();
      return;
    }
    if (this.book && this.book.id !== id) this.close(true);
    this.el.hidden = false;
    let book, state, sibs;
    try {
      [book, state, sibs] = await Promise.all([api.book(id), api.state(id), api.siblings(id).catch(() => null)]);
    } catch (e) {
      toast('Could not open this file: ' + e.message, 4000);
      location.hash = '#/';
      return;
    }
    this.book = book;
    this.siblings = sibs?.books || [];
    this.folderName = sibs?.folder || '';
    this.jumps = [];
    this.backDoc = this._pendingBack && this._pendingBack.id !== id ? this._pendingBack : null;
    this._pendingBack = null;
    this.state = Object.assign({ pos: null, highlights: [], cards: [], recall: {}, bookmarks: [], readSecs: 0, practice: {}, reflect: {} }, state || {});
    this.state.title = book.title;
    this.state.words = book.words;
    this.state.opened = Date.now();
    document.title = `${book.title} — Margin`;
    $('#r-title').textContent = book.title;
    this.render();
    // position: explicit anchor > saved position > start
    await this._afterFonts();
    this.layout({ restore: false });
    if (anchor && this._goAnchor(anchor, true)) { /* done */ }
    else if (this.state.pos) this.restore(this.state.pos);
    else this.goPage(0, false);
    this._cleanHash();
    this._backChip();
    this._updateDueBadge();
    this._watch();
    this.saveState();
    clearInterval(this._timer);
    this._timer = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - this.lastInteract < 120000 && this.active) {
        this.state.readSecs = (this.state.readSecs || 0) + 15;
        this.saveState();
      }
    }, 15000);
  }

  close(switching = false) {
    if (!this.book) return;
    this.saveState.cancel();
    this._capturePos();
    api.saveStateBeacon(this.book.id, this.state);
    this.es?.close();
    this.es = null;
    clearInterval(this._timer);
    this.hidePopups();
    panels.close(this);
    if (!switching) {
      this.el.hidden = true;
      this.book = null;
      this.content.replaceChildren();
    }
  }

  async _afterFonts() {
    try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 600))]); } catch (e) { /* ignore */ }
  }

  _watch() {
    this.es?.close();
    this.es = api.events(this.book.id, async () => {
      try {
        const b = await api.book(this.book.id);
        if (b.markdown === this.book.markdown) return;
        const pos = this.savedAnchor();
        this.book = b;
        this.state.title = b.title; this.state.words = b.words;
        $('#r-title').textContent = b.title;
        this.render();
        this.layout({ restore: false });
        this.restore(pos);
        toast('Updated — the file changed on disk');
        if (panels.current) panels.refresh(this);
      } catch (e) { /* file removed? */ }
    });
  }

  // ---------------------------------------------------------------- render
  render() {
    const { frag, headings } = renderMarkdown(this.book.markdown, { bookId: this.book.id, rel: this.book.rel, hideCitations: settings.hideCitations });
    this.content.replaceChildren(frag);
    this.blocks = $$(':scope > [data-b]', this.content);
    this.headings = headings.filter((x) => x.el.isConnected).map((x) => ({ ...x, b: +x.el.closest('[data-b]').dataset.b }));

    // word counts → reading-time estimates
    this.blockWords = this.blocks.map((el) => words(el.textContent));
    this.cumWords = [0];
    for (const w of this.blockWords) this.cumWords.push(this.cumWords[this.cumWords.length - 1] + w);
    this.totalWords = this.cumWords[this.cumWords.length - 1] || 1;

    // chapters = the top heading level that occurs at least twice (skipping a lone H1 title)
    const counts = {};
    this.headings.forEach((x) => (counts[x.level] = (counts[x.level] || 0) + 1));
    let lvl = [1, 2, 3, 4].find((l) => counts[l] >= 2) || [1, 2, 3].find((l) => counts[l]) || 0;
    this.chapterLevel = lvl;
    this.chapters = this.headings.filter((x) => x.level === lvl);
    if (this.chapters.length && this.chapters[0].b > 0 && this.cumWords[this.chapters[0].b] > 60) {
      // text before the first chapter heading (intro) counts as its own section
      const first = this.headings.find((x) => x.level < lvl);
      this.chapters.unshift({ el: first?.el || this.blocks[0], text: first?.text || this.book.title, id: first?.id || '_intro', b: 0, level: lvl, intro: true });
    }

    this.concepts = extractConcepts(this.content);
    this._insertCheckpoints();
    practice.decorate(this);
    this.chapterNo = docChapterNo(this.book, this.headings, this.siblings);
    linkify(this.content, makeResolver(this.content, { chapterNo: this.chapterNo, siblings: this.siblings, selfId: this.book.id }));
    this._chapterNav();
    this.applyClasses();
    this.applyHighlights();
    this.content.append(h('div', { class: 'no-anchor', id: 'end-sentinel', style: { height: '1px' } }));

    // images & diagrams change sizes after load → re-layout
    $$('img', this.content).forEach((img) => { if (!img.complete) img.addEventListener('load', () => this.relayoutKeep(), { once: true }); });
    const dark = settings.theme === 'dusk' || settings.theme === 'night';
    renderMermaid(this.content, dark).then((did) => did && this.relayoutKeep());
  }

  relayoutKeep() {
    clearTimeout(this._rk);
    this._rk = setTimeout(() => { const p = this.savedAnchor(); this.layout({ restore: false }); this.restore(p); }, 80);
  }

  applyClasses() {
    const c = this.content.classList;
    c.toggle('paged', this.paged);
    c.toggle('scroll', !this.paged);
    c.toggle('justify', settings.align === 'justify');
    c.toggle('wrapcode', this.paged && settings.wrapCode);
    this.clip.classList.toggle('scroll', !this.paged);
  }

  // ---------------------------------------------------------------- layout
  layout({ restore = true } = {}) {
    if (!this.book) return;
    const keep = restore ? this.savedAnchor() : null;
    this.mode = settings.layout;
    const W = this.viewport.clientWidth, H = this.viewport.clientHeight;
    const fs = settings.size;
    const measure = { narrow: 40, normal: 34, wide: 28.5 }[settings.margin] || 34;
    const colMax = measure * fs * (settings.font === 'atkinson' || settings.font === 'sans' ? 0.94 : 1);
    const padX = W < 640 ? 18 : W < 1000 ? 36 : 56;
    const padY = H < 600 ? 14 : 26;
    const avail = W - 2 * padX;
    const cs = this.content.style;
    this.applyClasses();

    if (this.paged) {
      const gap = clamp(Math.round(fs * 3), 36, 96);
      let n = 1;
      if (settings.columns === '2' && avail >= 2 * 15 * fs + gap) n = 2;
      if (settings.columns === 'auto' && avail >= 2 * 24 * fs + gap && W > H * 1.12) n = 2;
      const colW = Math.floor(Math.min(colMax, n === 2 ? (avail - gap) / 2 : avail));
      const clipW = n * colW + (n - 1) * gap;
      const clipH = Math.max(120, H - 2 * padY);
      Object.assign(this.clip.style, { left: Math.round((W - clipW) / 2) + 'px', top: padY + 'px', width: clipW + 'px', height: clipH + 'px' });
      Object.assign(cs, { width: clipW + 'px', height: clipH + 'px', columnCount: n, columnGap: gap + 'px', maxWidth: '', margin: '', padding: '' });
      this.content.style.setProperty('--page-h', clipH + 'px');
      this.cols = n;
      this.stride = clipW + gap;
      this.clip.scrollTop = 0;
      // measure
      this.content.classList.remove('anim');
      cs.transform = 'translateX(0px)';
      const end = $('#end-sentinel', this.content);
      // Both rects move with the page-turn transform, so their difference is stable.
      const pageOf = (el) => {
        const base = this.content.getBoundingClientRect().left;
        const r = el.getClientRects ? (el.getClientRects()[0] || el.getBoundingClientRect()) : el; // element or DOMRect
        return Math.max(0, Math.floor((r.left - base + 4) / this.stride));
      };
      this.pages = end ? pageOf(end) + 1 : 1;
      this.blockPage = this.blocks.map(pageOf);
      this.headPage = new Map(this.headings.map((x) => [x.id, pageOf(x.el)]));
      this._pageOf = pageOf;
    } else {
      Object.assign(this.clip.style, { left: '0px', top: '0px', width: W + 'px', height: H + 'px' });
      Object.assign(cs, { width: '', height: '', columnCount: '', columnGap: '', transform: '', maxWidth: Math.round(colMax + 2 * padX) + 'px', margin: '0 auto', padding: `${padY + 8}px ${padX}px` });
      this.content.classList.remove('anim');
      this.pages = 1;
    }
    this._ticks();
    if (keep) this.restore(keep);
  }

  // ------------------------------------------------------------- position
  // An anchor is { b: block index, f: fraction (0–1) of that block above the top of the screen }.
  // It is layout-independent, so font, size and window changes keep your place.
  anchor() {
    if (!this.blocks.length) return { b: 0, f: 0 };
    if (this.paged) {
      const page = this.page;
      let first = this.blockPage.indexOf(page);
      let prev = first > 0 ? first - 1 : -1;
      if (first < 0) { for (let i = 0; i < this.blockPage.length; i++) if (this.blockPage[i] < page) prev = i; }
      if (prev >= 0) {
        // does the previous block continue onto this page?
        const rects = this._rects(this.blocks[prev]);
        if (rects.length && this._pageOf(rects[rects.length - 1]) >= page) {
          let above = 0, total = 0;
          for (const r of rects) { total += r.height; if (this._pageOf(r) < page) above += r.height; }
          return { b: prev, f: total ? clamp(above / total, 0, 0.999) : 0 };
        }
      }
      return { b: first >= 0 ? first : Math.max(0, prev), f: 0 };
    }
    const top = this.clip.getBoundingClientRect().top;
    let lo = 0, hi = this.blocks.length - 1, ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const r = this.blocks[mid].getBoundingClientRect();
      if (r.top - top <= 8) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    const r = this.blocks[ans].getBoundingClientRect();
    return { b: ans, f: r.height ? clamp((top - r.top) / r.height, 0, 0.999) : 0 };
  }

  // The position captured after the last page turn / scroll. Use this (not anchor())
  // whenever the DOM may already have reflowed (settings or window size changed).
  savedAnchor() { return this.state?.pos || this.anchor(); }

  // Fragments of a block in page layout (one rect per column it spans).
  _rects(el) { return Array.from(el.getClientRects()).filter((r) => r.height > 0.5); }

  pageForAnchor(pos) {
    const b = clamp(pos?.b | 0, 0, Math.max(0, this.blocks.length - 1));
    const f = pos?.f || 0;
    if (!f) return this.blockPage[b] ?? 0;
    const rects = this._rects(this.blocks[b]);
    const total = rects.reduce((a, r) => a + r.height, 0);
    let acc = 0;
    for (const r of rects) { acc += r.height; if (acc > f * total + 2) return this._pageOf(r); }
    return this.blockPage[b] ?? 0;
  }

  restore(pos) {
    if (!pos) return this.goPage(0, false);
    const b = clamp(pos.b | 0, 0, Math.max(0, this.blocks.length - 1));
    // Re-paginating must not move the remembered spot, or every reflow would creep backwards.
    this._keepAnchor = { b, f: pos.f || 0 };
    if (this.paged) {
      this.goPage(this.pageForAnchor(pos), false);
    } else {
      const el = this.blocks[b];
      if (!el) return;
      const top = this.clip.getBoundingClientRect().top;
      const r = el.getBoundingClientRect();
      this.clip.scrollTop += r.top - top + (pos.f || 0) * r.height - (pos.f ? 0 : 8);
      this._onMove();
    }
    this._restoreT = Date.now();
  }

  _capturePos() {
    if (!this.book || !this.blocks.length) return;
    this.state.pos = this._keepAnchor || this.anchor();
    this.state.frac = this.fraction();
    if (this.state.frac >= 0.985) this.state.finished = this.state.finished || Date.now();
  }

  fraction() {
    if (this.paged) return this.pages <= 1 ? 1 : (this.page + 1) / this.pages;
    const max = this.clip.scrollHeight - this.clip.clientHeight - this.content.clientHeight * 0.0;
    return max <= 0 ? 1 : clamp(this.clip.scrollTop / (max - window.innerHeight * 0.4 || 1), 0, 1);
  }

  goPage(p, anim = true) {
    if (!this.paged) return;
    p = clamp(p, 0, this.pages - 1);
    const from = this.page;
    this.page = p;
    this.content.classList.toggle('anim', !!(anim && settings.anim));
    this.content.style.transform = `translateX(${-p * this.stride}px)`;
    if (p !== from) this._learnSpeed(p - from);
    // reading on for a while retires the "Back to page N" chip
    if (this.jumps?.length && Math.abs(p - from) === 1 && ++this._turnsSinceJump > 8) { this.jumps = []; this._backChip(); }
    this._onMove();
  }

  next() {
    this._keepAnchor = null;
    if (this.paged) {
      if (this.page >= this.pages - 1) {
        const nx = this.neighbour(1);
        if (nx && this._nextArmed && Date.now() - this._nextArmed < 5000) { this._nextArmed = 0; this.openChapter(nx); return; }
        this._endOfBook();
        return;
      }
      this.goPage(this.page + 1);
    } else this.clip.scrollBy({ top: this.clip.clientHeight * 0.88, behavior: settings.anim ? 'smooth' : 'auto' });
  }
  prev() {
    this._keepAnchor = null;
    if (this.paged) this.goPage(this.page - 1);
    else this.clip.scrollBy({ top: -this.clip.clientHeight * 0.88, behavior: settings.anim ? 'smooth' : 'auto' });
  }
  home() { this._keepAnchor = null; this.paged ? this.goPage(0) : (this.clip.scrollTop = 0); }
  end() { this._keepAnchor = null; this.paged ? this.goPage(this.pages - 1) : (this.clip.scrollTop = this.clip.scrollHeight); }

  _endOfBook() {
    const nx = this.neighbour(1);
    if (nx) {
      this._nextArmed = Date.now();
      toast(`End of chapter · press → again for “${nx.title}”`, 4000);
    }
    if (this.state.finished && Date.now() - this.state.finished < 2000) return;
    const due = this.state.cards.filter((c) => isDue(c)).length;
    if (!nx) toast(due ? `End of document · ${due} card${due > 1 ? 's' : ''} ready to review (R)` : 'End of document', 2800);
    this.state.finished = this.state.finished || Date.now();
    this.saveState();
  }

  goToElement(el, flash = true) {
    if (!el) return;
    // open folded answers / answer key that contain the target
    let opened = false;
    for (let x = el.closest('.rv-closed, .ak-closed'); x; x = x.parentElement?.closest('.rv-closed, .ak-closed')) {
      x.classList.remove('rv-closed', 'ak-closed');
      opened = true;
    }
    if (opened) { practice.syncButtons(this); if (this.paged) this.layout({ restore: false }); }
    this._keepAnchor = null;
    if (this.paged) {
      const p = this._pageOf ? this._pageOf(el) : 0;
      this.goPage(p, Math.abs(p - this.page) <= 1);
    } else {
      const top = this.clip.getBoundingClientRect().top;
      this.clip.scrollTop += el.getBoundingClientRect().top - top - 24;
      this._onMove();
    }
    if (flash) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1700); }
  }

  goToBlock(b, flash = false) { this.goToElement(this.blocks[clamp(b, 0, this.blocks.length - 1)], flash); }

  _goAnchor(id, flash = true) {
    const el = resolveAnchor(this.content, id);
    if (!el) { toast(`Couldn’t find “${decodeURIComponent(String(id))}” in this document`); return false; }
    this.goToElement(el, flash);
    return true;
  }

  // ---------------------------------------------------------- navigation
  // Remember where we are before a jump, so "Back to page N" can return.
  rememberJump() {
    if (!this.book || !this.blocks.length) return;
    const pos = this.anchor();
    const label = this.paged ? `page ${this.page + 1}` : (this.currentChapter(pos.b)?.text || 'previous place');
    const last = this.jumps[this.jumps.length - 1];
    if (!last || last.pos.b !== pos.b || Math.abs((last.pos.f || 0) - (pos.f || 0)) > 0.01) this.jumps.push({ pos, label });
    if (this.jumps.length > 30) this.jumps.shift();
    this._turnsSinceJump = 0;
    setTimeout(() => this._backChip(), 0);
  }

  jumpTo(el, flash = true) { this.rememberJump(); this.goToElement(el, flash); }

  goBack() {
    const j = this.jumps.pop();
    if (j) { this.restore(j.pos); this._backChip(); return true; }
    if (this.backDoc) { const d = this.backDoc; this.backDoc = null; location.hash = `#/read/${encodeURIComponent(d.id)}`; return true; }
    return false;
  }

  _backChip() {
    const chip = $('#back-chip');
    const j = this.jumps?.[this.jumps.length - 1];
    if (!j && !this.backDoc) { chip.hidden = true; return; }
    chip.hidden = false;
    $('.bc-label', chip).textContent = j ? `Back to ${j.label}` : `Back to “${this.backDoc.title}”`;
  }

  // Previous / next file in the same folder (the chapters of a book).
  neighbour(dir) {
    const list = this.siblings || [];
    const i = list.findIndex((s) => s.id === this.book?.id);
    return i < 0 ? null : list[i + dir] || null;
  }

  openChapter(s, anchor) {
    if (!s) return;
    this._pendingBack = { id: this.book.id, title: this.book.title };
    location.hash = `#/read/${encodeURIComponent(s.id)}${anchor ? '/' + encodeURIComponent(anchor) : ''}`;
  }

  _cleanHash() {
    if (this.book && /^#\/read\/[^/]+\//.test(location.hash)) history.replaceState(null, '', `#/read/${encodeURIComponent(this.book.id)}`);
  }

  _chapterNav() {
    const prev = this.neighbour(-1), next = this.neighbour(1);
    if (!prev && !next) return;
    const numbered = this.siblings.some((s) => s.chapter);
    const card = (s, dir) => h('a', { class: `cn cn-${dir}`, href: `#/read/${encodeURIComponent(s.id)}`, 'data-chapter': s.id },
      h('span', { class: 'cn-k' }, dir === 'prev' ? `← Previous${numbered ? ' chapter' : ''}` : `Next${numbered ? ' chapter' : ''} →`),
      h('span', { class: 'cn-t' }, s.title));
    this.content.append(h('nav', { class: 'chapter-nav no-anchor' },
      prev ? card(prev, 'prev') : h('span'),
      next ? card(next, 'next') : h('span')));
  }

  jumpFraction(f) {
    this._keepAnchor = null;
    if (this.paged) this.goPage(Math.round(f * (this.pages - 1)));
    else { this.clip.scrollTop = f * (this.clip.scrollHeight - this.clip.clientHeight); this._onMove(); }
  }

  // Called after every movement.
  _onMove() {
    this.lastInteract = Date.now();
    this._footer();
    this._ribbon();
    this._capturePos();
    this.saveState();
    if (panels.current === 'toc') panels.markCurrent(this);
  }

  // Kindle-style "learns your reading speed".
  _learnSpeed(delta) {
    const now = Date.now();
    const dt = (now - this.lastTurn) / 1000;
    this.lastTurn = now;
    if (delta !== 1 || dt < 4 || dt > 240 || this.pages < 3) return;
    const wordsPerPage = this.totalWords / this.pages;
    if (wordsPerPage < 40) return;
    const sample = clamp((wordsPerPage / dt) * 60, 80, 900);
    const wpm = Math.round(settings.wpm * 0.88 + sample * 0.12);
    setSetting({ wpm }, { silent: true });
  }

  currentChapter(b = this.anchor().b) {
    let cur = null;
    for (const c of this.chapters || []) { if (c.b <= b) cur = c; else break; }
    return cur;
  }

  _footer() {
    const a = this.anchor();
    const ch = this.currentChapter(a.b);
    const wpm = settings.wpm || 230;
    const frac = this.fraction();
    $('#f-chapter').textContent = ch && !ch.intro ? ch.text : '';
    $('#f-pct').textContent = Math.round(frac * 100) + '%';
    $('#f-fill').style.width = (frac * 100).toFixed(2) + '%';
    const readHere = this.cumWords[a.b] + (this.blockWords[a.b] || 0) * (a.f || 0);
    let info;
    if (settings.footer === 'chapter' && this.chapters.length) {
      const idx = this.chapters.indexOf(ch);
      const nxt = this.chapters[idx + 1];
      const endW = nxt ? this.cumWords[nxt.b] : this.totalWords;
      info = `${fmtMinutes(Math.max(0, endW - readHere) / wpm)} left in section`;
    } else if (settings.footer === 'book' || (settings.footer === 'chapter' && !this.chapters.length)) {
      info = `${fmtMinutes(Math.max(0, this.totalWords - readHere) / wpm)} left in document`;
    } else {
      info = this.paged ? `Page ${this.page + 1} of ${this.pages}` : `${fmtMinutes(Math.max(0, this.totalWords - readHere) / wpm)} left`;
    }
    $('#f-info').textContent = info;
  }

  _ticks() {
    const t = $('#f-ticks');
    t.replaceChildren();
    if (!this.chapters || this.chapters.length < 2) return;
    for (const c of this.chapters.slice(1)) {
      const f = this.paged ? (this.blockPage[c.b] || 0) / Math.max(1, this.pages) : this.cumWords[c.b] / this.totalWords;
      t.append(h('i', { style: { left: (f * 100).toFixed(2) + '%' } }));
    }
  }

  _ribbon() {
    const on = this._bookmarkHere() >= 0;
    $('#ribbon').hidden = !on;
    $('#r-bookmark').classList.toggle('on', on);
  }

  _bookmarkHere() {
    const bms = this.state.bookmarks || [];
    if (this.paged) {
      return bms.findIndex((bm) => this.pageForAnchor(bm) === this.page);
    }
    const a = this.anchor();
    return bms.findIndex((bm) => bm.b === a.b);
  }

  toggleBookmark() {
    const i = this._bookmarkHere();
    if (i >= 0) { this.state.bookmarks.splice(i, 1); toast('Bookmark removed'); }
    else {
      const a = this.anchor();
      const el = this.blocks[a.b];
      const ch = this.currentChapter(a.b);
      this.state.bookmarks.push({ id: uid(), b: a.b, f: a.f, label: (el?.textContent || '').trim().slice(0, 90), section: ch?.text || '', created: Date.now() });
      toast('Page bookmarked');
    }
    this._ribbon();
    this.saveState();
    if (panels.current) panels.refresh(this);
  }

  // ---------------------------------------------------------------- persist
  _persist() {
    if (!this.book) return;
    this._capturePos();
    api.saveState(this.book.id, this.state).catch(() => {});
  }
  commit() { this.saveState(); this._updateDueBadge(); }

  _updateDueBadge() {
    const n = (this.state?.cards || []).filter((c) => isDue(c)).length;
    const b = $('#r-due');
    b.hidden = !n;
    b.textContent = n > 99 ? '99+' : n;
  }

  // ------------------------------------------------------------ highlights
  applyHighlights() {
    unwrap($$('mark[data-h]', this.content));
    let idx = buildIndex(this.content);
    const located = [];
    for (const hl of this.state.highlights) {
      const loc = locate(idx, hl);
      hl.orphan = !loc;
      if (loc) located.push([loc, hl]);
    }
    located.sort((a, b) => b[0][0] - a[0][0]);
    let minStart = Infinity;
    for (let [loc, hl] of located) {
      if (loc[1] > minStart) { idx = buildIndex(this.content); loc = locate(idx, hl); if (!loc) { hl.orphan = true; continue; } }
      wrapRange(idx, loc[0], loc[1], () => {
        const m = document.createElement('mark');
        m.dataset.h = hl.id;
        m.dataset.c = hl.color || 'yellow';
        if (hl.note) { m.classList.add('has-note'); m.title = hl.note; }
        return m;
      });
      minStart = Math.min(minStart, loc[0]);
    }
    this.index = null; // rebuilt lazily
  }

  textIndex() { return this.index || (this.index = buildIndex(this.content)); }

  addHighlight(range, color = 'yellow') {
    this.index = null;
    const idx = this.textIndex();
    const q = rangeToQuote(idx, range);
    if (!q) return null;
    // merge with an identical existing highlight
    const dup = this.state.highlights.find((x) => x.exact === q.exact && Math.abs((x.pos || 0) - q.pos) < 5);
    if (dup) { dup.color = color; this.refreshHighlights(); return dup; }
    const blockEl = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement)?.closest('[data-b]');
    const b = blockEl ? +blockEl.dataset.b : 0;
    const ch = this.currentChapter(b);
    const hl = { id: uid(), ...q, color, note: '', b, section: ch && !ch.intro ? ch.text : '', created: Date.now() };
    const sent = sentenceAround(idx.text, q.pos, q.pos + q.exact.length);
    hl.context = sent.text.length > q.exact.length + 3 ? sent.text : '';
    this.state.highlights.push(hl);
    this.refreshHighlights();
    return hl;
  }

  refreshHighlights() {
    // re-render highlight marks while preserving where we are
    const pos = this.savedAnchor();
    this.applyHighlights();
    if (this.paged) { this.blockPage = this.blocks.map(this._pageOf); }
    this.restore(pos);
    this.commit();
    if (panels.current) panels.refresh(this);
  }

  removeHighlight(id) {
    this.state.highlights = this.state.highlights.filter((x) => x.id !== id);
    this.refreshHighlights();
  }

  goToHighlight(id) {
    const m = this.content.querySelector(`mark[data-h="${CSS.escape(id)}"]`);
    if (m) { this.goToElement(m, false); $$(`mark[data-h="${CSS.escape(id)}"]`, this.content).forEach((x) => { x.classList.remove('flash'); void x.offsetWidth; x.classList.add('flash'); }); }
    else {
      const hl = this.state.highlights.find((x) => x.id === id);
      if (hl) { this.goToBlock(hl.b || 0, true); toast('This passage changed in the file — showing its old location'); }
    }
  }

  // ------------------------------------------------------------ checkpoints
  _insertCheckpoints() {
    if (!settings.checkpoints) return;
    const secs = this.chapters.length ? this.chapters : (this.totalWords > 300 ? [{ text: this.book.title, id: '_doc', b: 0, intro: true }] : []);
    const NO_CP = /^(key\s+takeaways?|summary|chapter\s+summary|recap|check\s+your\s+understanding|references|sources|further\s+reading|glossary|contents|building\s+blocks|before\s+you\s+start|prerequisites|what\s+you\s+need\s+to\s+know|who\s+this\s+is\s+for|chapters|reviews|how\s+to\s+study|what\s+this\s+review\s+covers)$/i;
    secs.forEach((sec, i) => {
      // practice, worked-example and answer sections don't get a recall checkpoint
      if (!sec.intro && (classifyHeading(sec.text) || NO_CP.test(sec.text.replace(/^[\d.]+\s*/, '')))) return;
      const next = secs[i + 1];
      let endB = next ? next.b : this.blocks.length;
      // recall comes before practice: stop at the first problem set inside this section
      for (let b = sec.b + 1; b < endB; b++) {
        const el = this.blocks[b];
        if (/^H[1-6]$/.test(el.tagName) && /\btb-h-(pset|key|examples)\b/.test(el.className)) { endB = b; break; }
      }
      const w = this.cumWords[endB] - this.cumWords[sec.b];
      if (w < 140) return;
      const terms = this.concepts.filter((c) => c.kind === 'definition' && c.block >= sec.b && c.block < endB).slice(0, 6);
      const cp = this._checkpointEl(sec, terms);
      const before = this.blocks[endB] || null;
      if (before) before.before(cp); else this.content.append(cp);
    });
  }

  _checkpointEl(sec, terms) {
    const key = sec.id;
    const rec = this.state.recall[key] || {};
    const title = sec.intro && sec.id === '_doc' ? 'this document' : `“${sec.text}”`;
    const el = h('div', { class: 'checkpoint no-anchor', 'data-sec': key },
      h('div', { class: 'cp-k' }, h('span', {}, 'Recall checkpoint'), h('span', { class: 'done' }, rec.rating ? `${{ solid: '✓ Solid', fuzzy: '~ Fuzzy', again: '↺ Reread' }[rec.rating]} · ${fmtAgo(rec.ts)}` : '')),
      h('div', { class: 'cp-q' }, `Before moving on — without looking back, what are the key ideas of ${title}?`),
      terms.length ? h('div', { class: 'cp-terms' }, ...terms.map((t) => h('button', { class: 'cp-term', type: 'button', 'data-term': t.key, title: 'Can you define it? Tap to check' }, t.term))) : null,
      h('textarea', { placeholder: 'Explain it in 2–3 sentences of your own words… (saved to your notebook)', rows: 3 }),
      h('div', { class: 'cp-actions' },
        h('span', { class: 'lbl' }, 'How well did you recall it?'),
        ...['solid', 'fuzzy', 'again'].map((r) => h('button', { type: 'button', 'data-r': r, class: rec.rating === r ? 'on' : '' }, { solid: 'Solid', fuzzy: 'Fuzzy', again: 'Reread ↺' }[r])),
        h('span', { class: 'sp' }),
        h('button', { type: 'button', 'data-act': 'card', title: 'Turn your explanation into a review card' }, '+ Card')));
    $('textarea', el).value = rec.summary || '';
    return el;
  }

  _checkpointEvent(e) {
    const cp = e.target.closest('.checkpoint');
    if (!cp) return false;
    const key = cp.dataset.sec;
    const sec = (this.chapters.find((c) => c.id === key)) || { text: this.book.title, b: 0 };
    const rec = (this.state.recall[key] = this.state.recall[key] || {});
    const term = e.target.closest('.cp-term');
    if (term) {
      const c = this.concepts.find((x) => x.key === term.dataset.term);
      if (!term.classList.contains('open') && c) { term.classList.add('open'); term.append(h('span', { class: 'def', html: study.richText(c.def) })); this.relayoutKeep(); }
      return true;
    }
    const r = e.target.closest('[data-r]')?.dataset.r;
    if (r) {
      rec.rating = r; rec.ts = Date.now(); rec.title = sec.text;
      $$('[data-r]', cp).forEach((b) => b.classList.toggle('on', b.dataset.r === r));
      $('.done', cp).textContent = `${{ solid: '✓ Solid', fuzzy: '~ Fuzzy', again: '↺ Reread' }[r]} · just now`;
      this.commit();
      if (r === 'again') { this.goToBlock(sec.b, true); toast('Back to the start of the section'); }
      else if (r === 'solid') toast('Nice — on to the next section');
      return true;
    }
    if (e.target.closest('[data-act="card"]')) {
      const summary = $('textarea', cp).value.trim();
      study.editCard(this, { type: 'qa', front: `Explain in your own words: ${sec.text}`, back: summary || '(write your explanation here)', src: { sec: key, b: sec.b } });
      return true;
    }
    return true; // clicks inside a checkpoint never turn the page
  }

  // ---------------------------------------------------------------- events
  _bind() {
    const vp = this.viewport;
    let clickTimer = null;

    vp.addEventListener('click', (e) => {
      this.lastInteract = Date.now();
      if (!this.book) return;
      if (practice.onClick(this, e)) return;
      if (this._checkpointEvent(e)) return;
      const t = e.target;
      // copy button in code blocks
      const copy = t.closest('.code-head .copy');
      if (copy) { const code = copy.closest('.code').querySelector('pre').innerText; copyText(code).then(() => { copy.lastChild.textContent = 'Copied'; setTimeout(() => (copy.lastChild.textContent = 'Copy'), 1400); }); return; }
      const a = t.closest('a[href]');
      if (a) {
        if (a.dataset.anchor) { e.preventDefault(); this.rememberJump(); this._goAnchor(a.dataset.anchor); }
        else if (a.getAttribute('href').startsWith('#/read/')) this._pendingBack = { id: this.book.id, title: this.book.title };
        return;
      }
      const mark = t.closest('mark[data-h]');
      if (mark && !hasSelection()) { this.showHighlightMenu(mark); return; }
      const term = t.closest('strong.term');
      if (term && !hasSelection()) { this.showTermPopover(term); return; }
      if (t.closest('button, input, textarea, select, summary, label, details, .table-wrap, pre')) return;
      if (this.hidePopups()) return;
      if (panels.current && window.innerWidth < 900) { panels.close(this); return; }
      if (!this.paged || hasSelection()) return;
      // turn the page: margins act immediately; text area waits a moment so double-click selection still works
      const x = e.clientX, W = window.innerWidth;
      const dir = x < W * 0.3 ? -1 : 1;
      const inText = this.clip.contains(t);
      clearTimeout(clickTimer);
      const go = () => { if (!hasSelection()) dir < 0 ? this.prev() : this.next(); };
      if (!inText) go(); else clickTimer = setTimeout(go, 240);
    });
    vp.addEventListener('dblclick', () => clearTimeout(clickTimer));

    // selection → highlight menu
    const checkSel = () => {
      const sel = window.getSelection();
      if (!sel.rangeCount || sel.isCollapsed) return;
      const r = sel.getRangeAt(0);
      if (!this.content.contains(r.commonAncestorContainer)) return;
      if (r.commonAncestorContainer.nodeType === 1 && r.commonAncestorContainer.closest?.('.checkpoint')) return;
      if ((r.startContainer.parentElement || r.startContainer).closest?.('.checkpoint')) return;
      clearTimeout(clickTimer);
      this.showSelectionMenu(r);
    };
    this.content.addEventListener('pointerup', () => setTimeout(checkSel, 10));
    document.addEventListener('selectionchange', debounce(() => { if (this.active && matchMedia('(pointer: coarse)').matches) checkSel(); }, 450));

    this.content.addEventListener('input', (e) => practice.onInput(this, e));
    // checkpoint summaries autosave
    this.content.addEventListener('input', debounce((e) => {
      const cp = e.target.closest('.checkpoint');
      if (!cp || e.target.tagName !== 'TEXTAREA') return;
      const key = cp.dataset.sec;
      const sec = this.chapters.find((c) => c.id === key);
      const rec = (this.state.recall[key] = this.state.recall[key] || {});
      rec.summary = e.target.value;
      rec.title = sec ? sec.text : this.book.title;
      rec.sumTs = Date.now();
      this.commit();
    }, 500));

    // wheel → page turns
    let acc = 0, accT = 0;
    vp.addEventListener('wheel', (e) => {
      this.lastInteract = Date.now();
      if (!this.paged || e.ctrlKey) return;
      if (e.target.closest('.table-wrap, pre, .math-block, eqn') && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      const now = Date.now();
      if (now - accT > 250) acc = 0;
      accT = now;
      acc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(acc) > 45 && now - this._wheelTurn > 380 || Math.abs(acc) > 45 && !this._wheelTurn) {
        this._wheelTurn = now;
        acc > 0 ? this.next() : this.prev();
        acc = 0;
      }
    }, { passive: false });
    this._wheelTurn = 0;

    // swipe
    let sx = 0, sy = 0, st = 0, sTarget = null;
    vp.addEventListener('touchstart', (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); sTarget = e.target; }, { passive: true });
    vp.addEventListener('touchend', (e) => {
      if (!this.paged) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Date.now() - st > 700 || Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx) * 0.7 || hasSelection()) return;
      const sc = sTarget?.closest?.('.table-wrap, pre');
      if (sc && sc.scrollWidth > sc.clientWidth + 2) return;
      dx < 0 ? this.next() : this.prev();
    }, { passive: true });

    this.clip.addEventListener('scroll', debounce(() => {
      if (this.paged || !this.book) return;
      if (Date.now() - (this._restoreT || 0) > 400) this._keepAnchor = null; // a real scroll by the reader
      this._onMove();
    }, 120), { passive: true });
    // In page layout the clip box must never scroll. Browser "Find", focusing an input or
    // scrollIntoView can still scroll it — translate that into a proper page turn instead.
    this.clip.addEventListener('scroll', () => {
      if (!this.paged || !this.book) return;
      const dx = this.clip.scrollLeft, dy = this.clip.scrollTop;
      if (!dx && !dy) return;
      this.clip.scrollLeft = 0; this.clip.scrollTop = 0;
      this._keepAnchor = null;
      if (dx) this.goPage(Math.floor((this.page * this.stride + dx + this.stride * 0.5) / this.stride), false);
    }, { passive: true });
    window.addEventListener('resize', () => { if (this.active) { this.hidePopups(); this.relayout(); } });

    // footer
    $('#f-chapter').addEventListener('click', () => panels.open(this, 'toc'));
    $('#back-chip').addEventListener('click', (e) => {
      if (e.target.closest('.bc-x')) { this.jumps = []; this.backDoc = null; this._backChip(); return; }
      this.goBack();
    });
    $('#f-info').addEventListener('click', () => {
      const order = ['page', 'chapter', 'book'];
      setSetting({ footer: order[(order.indexOf(settings.footer) + 1) % order.length] }, { silent: true });
      this._footer();
    });
    $('#f-bar').addEventListener('click', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      this.jumpFraction(clamp((e.clientX - r.left) / r.width, 0, 1));
    });

    // top bar
    $('#r-back').addEventListener('click', () => (location.hash = '#/'));
    $('#r-toc').addEventListener('click', () => panels.toggle(this, 'toc'));
    $$('.r-tools [data-panel]').forEach((b) => b.addEventListener('click', () => panels.toggle(this, b.dataset.panel)));
    $('#r-bookmark').addEventListener('click', () => this.toggleBookmark());
    $('#r-review').addEventListener('click', () => study.reviewBook(this));
    $('#r-export').addEventListener('click', () => { this.hidePopups(); openExportDialog(this); });

    window.addEventListener('pagehide', () => { if (this.book) { this._capturePos(); api.saveStateBeacon(this.book.id, this.state); } });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && this.book) this.saveState.flush(); });
  }

  onKey(e) {
    if (e.altKey && e.key === 'ArrowLeft' && !isTyping(e)) { e.preventDefault(); this.goBack(); return true; }
    if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return false;
    const k = e.key;
    const map = {
      ArrowRight: () => this.next(), ArrowDown: () => this.paged ? this.next() : null, PageDown: () => this.next(),
      ArrowLeft: () => this.prev(), ArrowUp: () => this.paged ? this.prev() : null, PageUp: () => this.prev(),
      ' ': () => (e.shiftKey ? this.prev() : this.next()),
      Home: () => this.home(), End: () => this.end(),
      t: () => panels.toggle(this, 'toc'), '/': () => panels.toggle(this, 'search', true), n: () => panels.toggle(this, 'notebook'),
      k: () => panels.toggle(this, 'concepts'), a: () => panels.toggle(this, 'settings'), b: () => this.toggleBookmark(),
      r: () => study.reviewBook(this), q: () => study.quiz(this), p: () => openExportDialog(this),
      f: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()),
      '?': () => study.showKeys(),
      '[': () => { const p = this.neighbour(-1); p ? this.openChapter(p) : toast('This is the first chapter'); },
      ']': () => { const n = this.neighbour(1); n ? this.openChapter(n) : toast('This is the last chapter'); },
      Backspace: () => { if (!this.goBack()) toast('Nothing to go back to'); },
      Escape: () => {
        if (this.hidePopups()) return;
        if (panels.current) return panels.close(this);
        location.hash = '#/';
      },
    };
    const fn = map[k] || map[k.toLowerCase?.()];
    if (!fn) return false;
    // arrow up/down in scroll mode should scroll natively
    if (!this.paged && (k === 'ArrowUp' || k === 'ArrowDown')) return false;
    e.preventDefault();
    fn();
    return true;
  }

  _onSettings(patch) {
    if (!this.active || !this.book) return;
    const keys = Object.keys(patch);
    if (keys.includes('layout') && this.mode !== settings.layout) {
      const pos = this.savedAnchor(); // measured in the layout still on screen
      this.layout({ restore: false }); this.restore(pos);
      requestAnimationFrame(() => { this.layout({ restore: false }); this.restore(pos); });
    } else if (keys.some((k) => ['hideCitations', 'checkpoints'].includes(k))) {
      const pos = this.savedAnchor(); this.render(); this.layout({ restore: false }); this.restore(pos);
    } else if (keys.some((k) => ['size', 'leading', 'font', 'margin', 'align', 'layout', 'columns', 'wrapCode'].includes(k))) {
      const pos = this.savedAnchor();
      requestAnimationFrame(() => { this.layout({ restore: false }); this.restore(pos); });
    } else if (keys.includes('theme')) {
      // diagrams pick colours at render time
      if ($('.mermaid', this.content)) { const pos = this.savedAnchor(); this.render(); this.layout({ restore: false }); this.restore(pos); }
    }
    this._footer();
  }

  // ------------------------------------------------------------- popups
  hidePopups() {
    const was = !this.selmenu.hidden || !this.popover.hidden;
    this.selmenu.hidden = true;
    this.popover.hidden = true;
    return was;
  }

  _place(el, rect, prefer = 'above') {
    el.hidden = false;
    const w = el.offsetWidth, hgt = el.offsetHeight, W = window.innerWidth, H = window.innerHeight;
    let left = clamp(rect.left + rect.width / 2 - w / 2, 10, W - w - 10);
    let top = prefer === 'above' ? rect.top - hgt - 10 : rect.bottom + 10;
    if (top < 56) top = rect.bottom + 10;
    if (top + hgt > H - 10) top = Math.max(10, rect.top - hgt - 10);
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  showSelectionMenu(range) {
    this.popover.hidden = true;
    const m = this.selmenu;
    m.innerHTML = COLORS.map((c) => `<button class="sw" data-c="${c}" title="Highlight ${c}"></button>`).join('')
      + `<span class="div"></span>`
      + `<button class="mb" data-a="note">${icon('pen')}Note</button>`
      + `<button class="mb" data-a="card">${icon('cards')}Card</button>`
      + `<button class="mb" data-a="copy">${icon('copy')}Copy</button>`
      + `<button class="mb" data-a="search">${icon('search')}</button>`;
    const saved = range.cloneRange();
    m.onmousedown = (e) => e.preventDefault(); // keep the selection
    m.onclick = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const text = saved.toString();
      if (btn.dataset.c) { this.addHighlight(saved, btn.dataset.c); clearSel(); this.hidePopups(); return; }
      const a = btn.dataset.a;
      if (a === 'copy') { copyText(text).then(() => toast('Copied')); clearSel(); this.hidePopups(); return; }
      if (a === 'search') { clearSel(); this.hidePopups(); panels.open(this, 'search', text.trim().slice(0, 80)); return; }
      const hl = this.addHighlight(saved, 'yellow');
      clearSel();
      this.hidePopups();
      if (!hl) return;
      if (a === 'note') this.editNote(hl);
      if (a === 'card') study.cardFromHighlight(this, hl);
    };
    this._place(m, range.getBoundingClientRect());
  }

  showHighlightMenu(mark) {
    const hl = this.state.highlights.find((x) => x.id === mark.dataset.h);
    if (!hl) return;
    const m = this.selmenu;
    const hasCard = this.state.cards.some((c) => c.src?.hid === hl.id);
    m.innerHTML = COLORS.map((c) => `<button class="sw${hl.color === c ? ' on' : ''}" data-c="${c}"></button>`).join('')
      + `<span class="div"></span>`
      + `<button class="mb" data-a="note">${icon('pen')}${hl.note ? 'Edit note' : 'Note'}</button>`
      + `<button class="mb" data-a="card">${icon('cards')}${hasCard ? 'Card ✓' : 'Card'}</button>`
      + `<button class="mb" data-a="copy">${icon('copy')}</button>`
      + `<button class="mb" data-a="del" title="Remove highlight">${icon('trash')}</button>`;
    m.onmousedown = (e) => e.preventDefault();
    m.onclick = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      this.hidePopups();
      if (btn.dataset.c) { hl.color = btn.dataset.c; $$(`mark[data-h="${hl.id}"]`, this.content).forEach((x) => (x.dataset.c = hl.color)); this.commit(); if (panels.current) panels.refresh(this); return; }
      const a = btn.dataset.a;
      if (a === 'note') this.editNote(hl);
      if (a === 'card') study.cardFromHighlight(this, hl);
      if (a === 'copy') copyText(hl.exact).then(() => toast('Copied'));
      if (a === 'del') this.removeHighlight(hl.id);
    };
    this._place(m, mark.getBoundingClientRect());
  }

  editNote(hl) {
    const pop = this.popover;
    pop.innerHTML = `<h4>Note</h4><p class="muted" style="font-size:13px;margin-bottom:6px">“${esc(hl.exact.length > 140 ? hl.exact.slice(0, 140) + '…' : hl.exact)}”</p>
      <textarea placeholder="Why does this matter? How does it connect to what you know?">${esc(hl.note || '')}</textarea>
      <div class="row-actions"><button class="btn small ghost" data-a="cancel">Cancel</button><button class="btn small accent" data-a="save">Save</button></div>`;
    const mark = this.content.querySelector(`mark[data-h="${hl.id}"]`);
    const rect = mark ? mark.getBoundingClientRect() : { left: window.innerWidth / 2, width: 0, top: window.innerHeight / 3, bottom: window.innerHeight / 3 };
    this._place(pop, rect, 'below');
    const ta = $('textarea', pop);
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    const save = () => {
      hl.note = ta.value.trim();
      $$(`mark[data-h="${hl.id}"]`, this.content).forEach((x) => { x.classList.toggle('has-note', !!hl.note); x.title = hl.note; });
      this.hidePopups();
      this.commit();
      if (panels.current) panels.refresh(this);
    };
    pop.onclick = (e) => { const a = e.target.closest('[data-a]')?.dataset.a; if (a === 'save') save(); if (a === 'cancel') this.hidePopups(); };
    ta.onkeydown = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); if (e.key === 'Escape') { e.stopPropagation(); this.hidePopups(); } };
  }

  showTermPopover(strong) {
    const c = this.concepts.find((x) => x.key === strong.dataset.term);
    if (!c) return;
    const inDeck = this.state.cards.some((k) => k.src?.term === c.key);
    const pop = this.popover;
    const here = +strong.closest('[data-b]').dataset.b === c.block;
    pop.innerHTML = `<h4>${esc(c.term)}</h4><p>${c.def ? study.richText(c.def) : 'Mentioned without a definition.'}</p>
      <div class="row-actions" style="margin-top:12px">
        ${!here ? '<button class="btn small ghost" data-a="go">Go to definition</button>' : ''}
        <button class="btn small ${inDeck ? 'ghost' : 'accent'}" data-a="card" ${inDeck ? 'disabled' : ''}>${inDeck ? 'In your deck ✓' : '+ Card'}</button>
      </div>`;
    this.selmenu.hidden = true;
    this._place(pop, strong.getBoundingClientRect(), 'below');
    pop.onclick = (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'go') { this.hidePopups(); const el = this.content.querySelector(`[data-b="${c.block}"] strong[data-term="${CSS.escape(c.key)}"]`) || this.blocks[c.block]; this.jumpTo(el, true); }
      if (a === 'card') { study.addConceptCard(this, c); this.hidePopups(); }
    };
  }
}

function hasSelection() { const s = window.getSelection(); return s && !s.isCollapsed && s.toString().trim().length > 0; }
function clearSel() { window.getSelection()?.removeAllRanges(); }

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return; } catch (e) { /* not a secure context (LAN) */ }
  const ta = h('textarea', { style: { position: 'fixed', opacity: 0 } });
  ta.value = text;
  document.body.append(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}
