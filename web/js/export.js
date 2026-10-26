// PDF export: builds a print-only layout of the document (or your notebook) and
// hands it to the browser's own "Save as PDF". No extra software needed, text stays
// selectable, and math / diagrams / code stay sharp (vector).
import { h, toast, fmtMinutes } from './util.js';
import { settings, setSetting } from './settings.js';
import { renderMarkdown, renderMermaid } from './render.js';
import { buildIndex, locate, wrapRange } from './anchor.js';
import { openModal, closeModal, frontHTML, backText, richText } from './study.js';
import { SET_LABEL } from './textbook.js';
import * as practice from './practice.js';
import { linkify, makeResolver, resolveAnchor } from './nav.js';

const SIZES = { s: '10pt', m: '11.5pt', l: '13pt' };
const PAPER = { A4: { css: 'A4', h: 297 }, Letter: { css: 'letter', h: 279.4 } };
const MARGIN = { top: 20, bottom: 22, side: 19 }; // mm

let prevTitle = null;

function defaults() {
  const letter = /^(en-(US|CA|PH)|es-(US|MX|CL|CO|VE)|fr-CA)/i.test(navigator.language || '');
  return {
    kind: 'doc', paper: letter ? 'Letter' : 'A4', size: 'm',
    highlights: true, notes: true, cover: true, breaks: false, glossary: true, answers: 'end',
    nbSummaries: true, nbHighlights: true, nbCards: true, nbConcepts: true, nbPractice: true,
  };
}
export const exportOpts = () => ({ ...defaults(), ...(settings.exportOpts || {}) });

const fmtDate = () => new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// ---------------------------------------------------------------- dialog
export function openExportDialog(r, kind) {
  if (!r?.book) return;
  const o = exportOpts();
  if (kind) o.kind = kind;
  const s = r.state;
  const nHl = s.highlights.length;
  const nNotes = s.highlights.filter((x) => x.note?.trim()).length;
  const defs = r.concepts.filter((c) => c.kind === 'definition');
  const nSum = Object.values(s.recall || {}).filter((v) => v.summary?.trim()).length + Object.values(s.reflect || {}).filter((v) => v.text?.trim()).length;
  const hasTextbook = !!r.content.querySelector('.tb, .problem, .answer-key, .worked');
  const pst = practice.stats(r).all;
  const wrap = h('div', { class: 'export-dlg' });

  const seg = (key, opts) => h('div', { class: 'seg full' }, ...opts.map(([v, label]) =>
    h('button', { class: o[key] === v ? 'on' : '', onclick: () => { o[key] = v; draw(); } }, label)));
  const tog = (key, label, hint, disabled = false) => {
    const inp = h('input', { type: 'checkbox', disabled });
    inp.checked = !!o[key] && !disabled;
    inp.addEventListener('change', () => { o[key] = inp.checked; if (key === 'highlights' || o.kind === 'notebook') draw(); });
    return h('label', { class: `toggle${disabled ? ' off' : ''}` }, h('span', {}, label, hint ? h('small', {}, hint) : null), inp);
  };

  const nbEmpty = () => !((o.nbSummaries && nSum) || (o.nbHighlights && nHl) || (o.nbCards && s.cards.length) || (o.nbConcepts && defs.length) || (o.nbPractice && pst.total));

  function draw() {
    const doc = o.kind === 'doc';
    wrap.replaceChildren(...[
      h('h2', {}, 'Export PDF'),
      h('div', { class: 'sub' }, r.book.title),
      seg('kind', [['doc', 'Whole document'], ['notebook', 'My notebook']]),
      h('p', { class: 'ex-desc' }, doc ? 'The full text laid out like a book, with page numbers.' : 'Your summaries, highlights, notes, flashcards and key concepts — ready for revision.'),
      h('div', { class: 'ex-grid' },
        h('div', {}, h('div', { class: 'set-label' }, 'Paper'), seg('paper', [['A4', 'A4'], ['Letter', 'Letter']])),
        h('div', {}, h('div', { class: 'set-label' }, 'Text size'), seg('size', [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']]))),
      doc && hasTextbook ? h('div', { class: 'ex-answers' }, h('div', { class: 'set-label' }, 'Answers & solutions'),
        seg('answers', [['end', 'End of chapter'], ['inline', 'Next to questions'], ['none', 'Leave out']]),
        h('p', { class: 'ex-sub' }, { end: 'Worked-example solutions stay in place; quick-check answers and the answer key go at the end, like a textbook.', inline: 'Every hint, answer and solution is printed right under its question.', none: 'A practice copy: questions and problems without answers (worked examples keep their solutions).' }[o.answers] || '')) : null,
      h('div', { class: 'ex-toggles' }, ...(doc ? [
        tog('highlights', 'My highlights, in colour', nHl ? plural(nHl, 'highlight') : 'None yet', !nHl),
        tog('notes', 'My notes', nNotes ? `${plural(nNotes, 'note')}, printed under their paragraph` : 'None yet', !nNotes || !o.highlights),
        tog('cover', 'Cover page and contents'),
        tog('breaks', 'Start each chapter on a new page', null, r.chapters.filter((c) => !c.intro).length < 2),
        tog('glossary', 'Key-concepts glossary at the end', defs.length ? plural(defs.length, 'term') : 'No defined terms found', !defs.length),
      ] : [
        tog('nbSummaries', 'My summaries and reflections', nSum ? `${nSum} written` : 'None yet', !nSum),
        ...(pst.total ? [tog('nbPractice', 'Practice results', `${pst.right}/${pst.total} correct, ${pst.wrong.length} to review`)] : []),
        tog('nbHighlights', 'Highlights and notes', nHl ? `${plural(nHl, 'highlight')}, ${plural(nNotes, 'note')}` : 'None yet', !nHl),
        tog('nbCards', 'Flashcards', s.cards.length ? plural(s.cards.length, 'card') : 'None yet', !s.cards.length),
        tog('nbConcepts', 'Key concepts', defs.length ? plural(defs.length, 'term') : 'No defined terms found', !defs.length),
      ])),
      !doc && nbEmpty() ? h('p', { class: 'ex-warn' }, 'Nothing to export yet — highlight passages, write checkpoint summaries or make cards first.') : null,
      h('p', { class: 'ex-hint' }, 'Your browser’s print window opens next: choose ', h('b', {}, 'Save as PDF'), ' as the destination.'),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn ghost', onclick: closeModal }, 'Cancel'),
        h('button', { class: 'btn accent', id: 'ex-go', disabled: !doc && nbEmpty(), onclick: go }, 'Export PDF')),
    ].filter(Boolean));
  }
  function go() {
    setSetting({ exportOpts: o }, { silent: true });
    closeModal();
    run(r, o);
  }
  draw();
  openModal(wrap, { onKey: (e) => { if (e.key === 'Enter' && !e.target.closest?.('button')) { e.preventDefault(); if (!$go()?.disabled) go(); } return true; } });
  const $go = () => wrap.querySelector('#ex-go');
  setTimeout(() => $go()?.focus(), 30);
}

export async function run(r, o = exportOpts()) {
  toast('Preparing PDF…', 1500);
  try {
    await prepare(r, o);
  } catch (e) {
    cleanup();
    toast('Could not prepare the PDF: ' + e.message, 4000);
    return;
  }
  await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
  window.print();
  // Chrome/Edge/Firefox fire "afterprint"; this is a fallback for browsers that don't.
  setTimeout(() => { if (!matchMedia('print').matches) cleanup(); }, 60000);
}

// ---------------------------------------------------------------- prepare
// Builds #print-root. The synchronous part is also used when someone prints
// from the browser menu (the "beforeprint" event can't wait for async work).
export function prepareSync(r, o, { cloneDiagrams = true } = {}) {
  cleanup();
  const root = h('div', { id: 'print-root', class: `md wrapcode${o.kind === 'notebook' ? ' p-notebook' : ''}` });
  root.style.setProperty('--read-size', SIZES[o.size] || SIZES.m);
  if (o.kind === 'notebook') buildNotebook(r, o, root);
  else buildDocument(r, o, root);
  prefixIds(root);
  if (cloneDiagrams) cloneMermaid(r, root);

  const st = document.createElement('style');
  st.id = 'print-page-style';
  st.textContent = pageCSS(r, o);
  document.head.append(st);
  document.body.append(root);
  document.body.classList.add('printing');
  prevTitle = document.title;
  document.title = fileName(r, o); // browsers use the title as the suggested file name
  return root;
}

export async function prepare(r, o) {
  const dark = settings.theme === 'dusk' || settings.theme === 'night';
  const root = prepareSync(r, o, { cloneDiagrams: !dark });
  if (dark) await renderMermaid(root, false); // re-draw diagrams in light colours for paper
  const imgs = Array.from(root.querySelectorAll('img')).filter((i) => !i.complete);
  await Promise.race([
    Promise.all(imgs.map((img) => new Promise((res) => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); }))),
    new Promise((res) => setTimeout(res, 4000)),
  ]);
  try { await Promise.race([document.fonts.ready, new Promise((res) => setTimeout(res, 1500))]); } catch (e) { /* ignore */ }
  return root;
}

export function cleanup() {
  document.getElementById('print-root')?.remove();
  document.getElementById('print-page-style')?.remove();
  document.body.classList.remove('printing');
  if (prevTitle != null) { document.title = prevTitle; prevTitle = null; }
}

// Ctrl+P / browser-menu printing while reading also gets the proper layout.
export function initPrinting(reader) {
  window.addEventListener('beforeprint', () => {
    if (document.getElementById('print-root') || !reader.active || !reader.book) return;
    try { prepareSync(reader, { ...exportOpts(), kind: 'doc' }); } catch (e) { cleanup(); }
  });
  window.addEventListener('afterprint', () => cleanup());
}

function fileName(r, o) {
  const t = r.book.title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'document';
  return o.kind === 'notebook' ? `${t} — notebook` : t;
}

const cssStr = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ') + '"';

function pageCSS(r, o) {
  const p = PAPER[o.paper] || PAPER.A4;
  let t = r.book.title;
  if (t.length > 80) t = t.slice(0, 77) + '…';
  const head = o.kind === 'notebook' ? `Notebook · ${t}` : t;
  const box = 'font-family: system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif; font-size: 8pt; color: #8f8a80;';
  return `@page {
  size: ${p.css};
  margin: ${MARGIN.top}mm ${MARGIN.side}mm ${MARGIN.bottom}mm;
  @top-right { content: ${cssStr(head)}; ${box} vertical-align: bottom; padding-bottom: 5mm; }
  @bottom-center { content: counter(page) " / " counter(pages); ${box} vertical-align: top; padding-top: 6mm; }
}
${o.kind === 'doc' && o.cover ? '@page :first { @top-right { content: none; } @bottom-center { content: none; } }' : ''}
#print-root { --page-content-h: ${(p.h - MARGIN.top - MARGIN.bottom - 4).toFixed(1)}mm; }`;
}

// Heading ids also exist in the (hidden) reader, so print copies get a prefix
// to keep contents links and footnotes pointing at the printed text.
function prefixIds(root) {
  root.querySelectorAll('[id]').forEach((el) => { if (!el.closest('svg')) el.id = 'p-' + el.id; });
  root.querySelectorAll('a[href^="#"]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href.startsWith('#/') && !a.closest('svg')) a.setAttribute('href', '#p-' + href.slice(1));
  });
}

function cloneMermaid(r, root) {
  const src = Array.from(r.content.querySelectorAll('figure.mermaid'));
  Array.from(root.querySelectorAll('figure.mermaid')).forEach((fig, i) => {
    const s = src[i];
    if (s && s.querySelector('svg') && !s.classList.contains('pending')) {
      fig.innerHTML = s.innerHTML;
      fig.classList.remove('pending');
    }
  });
}

// ---------------------------------------------------------------- document
function buildDocument(r, o, root) {
  const s = r.state;
  const { frag } = renderMarkdown(r.book.markdown, { bookId: r.book.id, rel: r.book.rel, hideCitations: settings.hideCitations });
  const article = h('article', { class: 'p-doc' });
  article.append(frag);
  article.querySelectorAll('details').forEach((d) => (d.open = true));
  article.querySelectorAll('.code-head button').forEach((b) => b.remove());

  // chapter page breaks (never before the first one)
  if (o.breaks) {
    const ids = new Set(r.chapters.filter((c) => !c.intro).map((c) => c.id));
    let first = true;
    article.querySelectorAll('h1,h2,h3,h4').forEach((hd) => {
      if (!ids.has(hd.id)) return;
      if (!first) hd.classList.add('p-break');
      first = false;
    });
  }

  // highlights + notes
  if (o.highlights && s.highlights.length) {
    const placed = applyHighlights(article, s.highlights);
    if (o.notes) {
      const withNotes = placed.filter(([, hl]) => hl.note?.trim()).sort((a, b) => a[0] - b[0]);
      const lastAside = new Map();
      withNotes.forEach(([, hl, els], i) => {
        const n = i + 1;
        const last = els[els.length - 1];
        last.after(h('sup', { class: 'p-nref' }, n));
        let block = els[0];
        while (block.parentElement && block.parentElement !== article) block = block.parentElement;
        const aside = h('aside', { class: 'p-note' }, h('span', { class: 'p-nnum' }, n), h('span', { class: 'p-ntext' }, hl.note.trim()));
        (lastAside.get(block) || block).after(aside);
        lastAside.set(block, aside);
      });
    }
  }

  applyAnswerMode(article, o.answers || 'end', r.chapterLevel || 2);

  // "Section 3.4" / "Example 3.2" become links inside the PDF; links to other files become plain text
  linkify(article, makeResolver(article, { chapterNo: r.chapterNo || 0 }));
  article.querySelectorAll('a[href^="#/read/"]').forEach((a) => a.replaceWith(...a.childNodes));
  // hand-written links like "#example-1.1" or GitHub-style slugs → the real target, so they work in the PDF
  article.querySelectorAll('a[href^="#"]').forEach((a) => {
    const key = a.getAttribute('href').slice(1);
    let raw = key;
    try { raw = decodeURIComponent(key); } catch (e) { /* keep */ }
    if (!key || article.querySelector(`[id="${CSS.escape(raw)}"]`)) return;
    const el = resolveAnchor(article, key);
    if (!el) return;
    if (!el.id) el.id = 'x-' + Math.random().toString(36).slice(2, 9);
    a.setAttribute('href', '#' + el.id);
  });

  if (o.cover) {
    const wpm = settings.wpm || 230;
    const folder = r.book.rel.includes('/') ? r.book.rel.split('/').slice(-2, -1)[0] : (r.book.rootName || '');
    const nNotes = s.highlights.filter((x) => x.note?.trim()).length;
    const extra = [];
    if (o.highlights && s.highlights.length) extra.push(plural(s.highlights.length, 'highlight'));
    if (o.highlights && o.notes && nNotes) extra.push(plural(nNotes, 'note'));
    root.append(h('section', { class: 'p-cover' },
      h('div', { class: 'p-cover-main' },
        folder ? h('div', { class: 'p-kicker' }, folder) : null,
        h('h1', { class: 'p-cover-title' }, r.book.title),
        h('div', { class: 'p-rule' }),
        h('div', { class: 'p-cover-meta' }, `${r.totalWords.toLocaleString()} words · about ${fmtMinutes(r.totalWords / wpm)} of reading`)),
      h('div', { class: 'p-cover-foot' },
        h('div', {}, r.book.rel),
        h('div', {}, [`Exported from Margin on ${fmtDate()}`, ...extra].join(' · ')))));

    const lvl = r.chapterLevel || 2;
    const entries = r.headings.filter((x) => (x.level === lvl || x.level === lvl + 1) && !x.el.closest('.answer-key'));
    if (entries.filter((x) => x.level === lvl).length >= 2) {
      root.append(h('nav', { class: 'p-toc' },
        h('h2', {}, 'Contents'),
        h('ol', {}, ...entries.map((x) => h('li', { class: x.level === lvl ? 'l1' : 'l2' }, h('a', { href: '#' + x.id }, x.text))))));
    }
  }

  root.append(article);

  const defs = r.concepts.filter((c) => c.kind === 'definition');
  if (o.glossary && defs.length) root.append(glossary(defs, 'p-gloss p-newpage'));
}

// ---------------------------------------------------------------- answers
// end:    hints/answers of in-text questions (and inline problem answers) are
//         collected at the end of the chapter, before its answer key
// inline: everything printed under its question; the answer key is folded in
// none:   no answers at all (worked-example solutions stay — they are teaching text)
function applyAnswerMode(article, mode, chapterLevel) {
  const isExample = (rv) => !!rv.parentElement.closest('.tb-example, .worked');
  const reveals = () => Array.from(article.querySelectorAll('.reveal')).filter((rv) => !isExample(rv));

  if (mode === 'none') {
    reveals().forEach((rv) => rv.remove());
    article.querySelectorAll('.tb-h-key').forEach((hd) => {
      const box = hd.nextElementSibling;
      if (box?.classList.contains('answer-key')) box.remove();
      hd.remove();
    });
    return;
  }

  if (mode === 'inline') {
    article.querySelectorAll('.problem[data-aref]').forEach((li) => {
      if (Array.from(li.children).some((c) => c.matches('.reveal-answer, .reveal-solution'))) return;
      const src = article.querySelector(`.key-item[data-aid="${li.dataset.aref}"]`);
      if (!src) return;
      const rv = h('div', { class: 'reveal reveal-answer' }, h('div', { class: 'reveal-label' }, 'Answer'));
      Array.from(src.childNodes).forEach((n) => rv.append(n.cloneNode(true)));
      li.append(rv);
    });
    // every problem now carries its answer, so the separate key is redundant
    const linked = new Set(Array.from(article.querySelectorAll('.problem[data-aref]')).map((li) => li.dataset.aref));
    article.querySelectorAll('.tb-h-key').forEach((hd) => {
      const box = hd.nextElementSibling;
      if (!box?.classList.contains('answer-key')) return;
      const items = Array.from(box.querySelectorAll('.key-item'));
      if (items.length && items.every((k) => linked.has(k.dataset.aid))) { box.remove(); hd.remove(); }
    });
    return;
  }

  // mode === 'end'
  const keyHeading = article.querySelector('.tb-h-key');
  const scopeLevel = keyHeading ? +keyHeading.tagName[1] - 1 : chapterLevel;
  const blocks = Array.from(article.children);
  const parts = [];
  let cur = [];
  for (const b of blocks) {
    if (scopeLevel > 0 && /^H[1-6]$/.test(b.tagName) && +b.tagName[1] <= scopeLevel && cur.length) { parts.push(cur); cur = []; }
    cur.push(b);
  }
  if (cur.length) parts.push(cur);

  for (const part of parts) {
    const entries = [];
    for (const b of part) {
      const found = b.matches('.reveal') ? [b] : Array.from(b.querySelectorAll('.reveal'));
      for (const rv of found) {
        if (isExample(rv) || !article.contains(rv)) continue;
        const owner = rv.parentElement.closest('.tb, .problem');
        if (!owner) continue;
        let entry = entries.find((e) => e.owner === owner);
        if (!entry) { entry = { owner, label: answerLabel(owner), parts: [] }; entries.push(entry); }
        entry.parts.push(rv);
      }
    }
    if (!entries.length) continue;
    const firstLevel = part.find((x) => /^H[1-6]$/.test(x.tagName));
    const hLevel = Math.min(6, Math.max(2, (firstLevel ? +firstLevel.tagName[1] : 1) + 1));
    const sec = h('section', { class: 'p-answers' }, h(`h${hLevel}`, {}, 'Answers to questions in the text'));
    const list = h('div', { class: 'p-ans-list' });
    for (const e of entries) {
      const item = h('div', { class: 'p-ans' }, h('div', { class: 'p-ans-label' }, e.label));
      e.parts.forEach((rv) => item.append(rv));
      list.append(item);
    }
    sec.append(list);
    const key = part.find((x) => x.classList?.contains('tb-h-key'));
    if (key) key.before(sec); else part[part.length - 1].after(sec);
  }
}

function answerLabel(owner) {
  if (owner.classList.contains('problem')) return `${SET_LABEL[owner.dataset.set] || owner.dataset.set || 'Problem'} ${owner.dataset.num}`;
  return owner.querySelector(':scope > .callout-title')?.textContent || 'Question';
}

// Returns [[start, highlight, elements], …] for the highlights that were found.
function applyHighlights(container, highlights) {
  let idx = buildIndex(container);
  const found = [];
  for (const hl of highlights) {
    const loc = locate(idx, hl);
    if (loc) found.push([loc, hl]);
  }
  found.sort((a, b) => b[0][0] - a[0][0]); // wrap from the end so earlier offsets stay valid
  const placed = [];
  let minStart = Infinity;
  for (let [loc, hl] of found) {
    if (loc[1] > minStart) { idx = buildIndex(container); loc = locate(idx, hl); if (!loc) continue; }
    const els = wrapRange(idx, loc[0], loc[1], () => { const m = document.createElement('mark'); m.dataset.c = hl.color || 'yellow'; return m; });
    minStart = Math.min(minStart, loc[0]);
    if (els.length) placed.push([loc[0], hl, els]);
  }
  return placed;
}

function glossary(defs, cls) {
  const sorted = defs.slice().sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: 'base' }));
  return h('section', { class: cls },
    h('h2', {}, 'Key concepts'),
    h('dl', { class: 'p-dl' }, ...sorted.flatMap((c) => [h('dt', {}, c.term), h('dd', { html: richText(c.def) })])));
}

// ---------------------------------------------------------------- notebook
function buildNotebook(r, o, root) {
  const s = r.state;
  const nNotes = s.highlights.filter((x) => x.note?.trim()).length;
  const defs = r.concepts.filter((c) => c.kind === 'definition');
  root.append(h('header', { class: 'p-nb-head' },
    h('div', { class: 'p-kicker' }, 'Notebook'),
    h('h1', {}, r.book.title),
    h('div', { class: 'p-nb-meta' }, [plural(s.highlights.length, 'highlight'), plural(nNotes, 'note'), plural(s.cards.length, 'card'), `exported ${fmtDate()}`].join(' · ')),
    h('div', { class: 'p-nb-src' }, r.book.rel)));

  // Summaries, in chapter order
  const order = new Map(r.chapters.map((c, i) => [c.id, i]));
  const sums = Object.entries(s.recall || {}).filter(([, v]) => v.summary?.trim()).sort((a, b) => (order.get(a[0]) ?? 1e9) - (order.get(b[0]) ?? 1e9));
  if (o.nbSummaries && sums.length) {
    const RATE = { solid: 'Recalled well', fuzzy: 'Fuzzy', again: 'Needed a reread' };
    root.append(h('section', { class: 'p-nb-sec' }, h('h2', {}, 'In my own words'),
      ...sums.map(([, v]) => h('div', { class: 'p-sum' },
        h('h3', {}, v.title || '', v.rating ? h('span', { class: `p-rate ${v.rating}` }, RATE[v.rating]) : null),
        h('p', {}, v.summary.trim())))));
  }

  const refl = Object.values(s.reflect || {}).filter((v) => v.text?.trim());
  if (o.nbSummaries && refl.length) {
    root.append(h('section', { class: 'p-nb-sec' }, h('h2', {}, 'Food for thought'),
      ...refl.map((v) => h('div', { class: 'p-sum' }, h('h3', {}, v.q || v.title || ''), h('p', {}, v.text.trim())))));
  }

  const pst = practice.stats(r);
  if (o.nbPractice && pst.all.total) {
    const sec = h('section', { class: 'p-nb-sec' }, h('h2', {}, 'Practice'),
      h('p', { class: 'p-nb-meta' }, `${pst.all.done} of ${pst.all.total} questions attempted · ${pst.all.right} correct · ${pst.all.wrong.length} to review`));
    const rows = r.chapters.filter((c) => pst.by.get(c.id)?.total).map((c) => { const st = pst.by.get(c.id); return h('tr', {}, h('td', {}, c.text), h('td', {}, `${st.done}/${st.total}`), h('td', {}, `${st.right}`)); });
    if (rows.length) sec.append(h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Section'), h('th', {}, 'Attempted'), h('th', {}, 'Correct'))), h('tbody', {}, ...rows))));
    if (pst.all.wrong.length) {
      sec.append(h('h3', {}, 'To review'));
      sec.append(h('ol', { class: 'p-cards' }, ...pst.all.wrong.map((it) => h('li', {},
        h('div', { class: 'p-q', html: richText(practice.promptText(it.el)).replace(/\n/g, '<br>') }),
        h('div', { class: 'p-a' }, practice.label(it.el) + (it.chapter && !practice.label(it.el).startsWith(it.chapter.text) ? ` — ${it.chapter.text}` : ''))))));
    }
    root.append(sec);
  }

  // Highlights by section
  if (o.nbHighlights && s.highlights.length) {
    const sec = h('section', { class: 'p-nb-sec' }, h('h2', {}, 'Highlights'));
    let last = null;
    for (const hl of s.highlights.slice().sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0))) {
      const name = hl.section || 'Beginning';
      if (name !== last) { sec.append(h('h3', {}, name)); last = name; }
      sec.append(h('div', { class: 'p-hl', 'data-c': hl.color || 'yellow' },
        h('blockquote', {}, hl.exact),
        hl.note?.trim() ? h('div', { class: 'p-hl-note' }, hl.note.trim()) : null));
    }
    root.append(sec);
  }

  // Flashcards
  if (o.nbCards && s.cards.length) {
    root.append(h('section', { class: 'p-nb-sec' }, h('h2', {}, 'Flashcards'),
      h('ol', { class: 'p-cards' }, ...s.cards.map((c) => h('li', {},
        h('div', { class: 'p-q', html: c.type === 'cloze' ? frontHTML(c, false, true) : frontHTML(c) }),
        c.type === 'cloze' ? null : h('div', { class: 'p-a', html: richText(backText(c)) }))))));
  }

  if (o.nbConcepts && defs.length) root.append(glossary(defs, 'p-nb-sec p-gloss'));
}
