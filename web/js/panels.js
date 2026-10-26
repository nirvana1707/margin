// Side panels: Contents, Search, Notebook, Key concepts, Reading settings.
import { $, $$, h, esc, icon, debounce, fmtAgo, fmtMinutes, toast, download } from './util.js';
import { settings, setSetting, FONTS, THEMES } from './settings.js';
import { isDue } from './srs.js';
import * as study from './study.js';
import { openExportDialog } from './export.js';
import * as practice from './practice.js';
import { classifyHeading } from './textbook.js';

export let current = null;
let arg = null;
const panel = () => $('#panel');
const body = () => $('#panel-body');

const TITLES = { toc: 'Contents', search: 'Search', notebook: 'Notebook', concepts: 'Key concepts', settings: 'Reading settings' };

export function open(r, name, a = null) {
  current = name;
  arg = a;
  const p = panel();
  p.hidden = false;
  p.classList.toggle('left', name === 'toc');
  p.style.animation = 'none'; void p.offsetWidth; p.style.animation = '';
  $('#panel-title').textContent = TITLES[name];
  $('#panel-close').onclick = () => close(r);
  $$('.r-tools [data-panel], #r-toc').forEach((b) => b.classList.toggle('on', (b.dataset.panel || 'toc') === name));
  refresh(r);
}

export function close(r) {
  current = null;
  panel().hidden = true;
  $$('.r-tools [data-panel], #r-toc').forEach((b) => b.classList.remove('on'));
  if (r?.content) $$('.search-hit', r.content).forEach((s) => s.replaceWith(...s.childNodes));
}

export function toggle(r, name, focusSearch) {
  if (current === name && !focusSearch) close(r);
  else open(r, name);
}

export function refresh(r) {
  if (!current) return;
  const b = body();
  const st = b.scrollTop;
  ({ toc: renderToc, search: renderSearch, notebook: renderNotebook, concepts: renderConcepts, settings: renderSettings })[current](r, b);
  if (current !== 'search') b.scrollTop = st;
}

// ------------------------------------------------------------------ Contents
function renderToc(r, b) {
  b.replaceChildren();
  const s = r.state;
  const bms = s.bookmarks || [];
  if (bms.length) {
    b.append(h('h3', {}, 'Bookmarks'));
    const ul = h('ul', { class: 'toc' });
    bms.slice().sort((x, y) => x.b - y.b).forEach((bm) => ul.append(h('li', {},
      h('button', { onclick: () => { r.rememberJump(); r.restore(bm); r._backChip(); if (innerWidth < 900) close(r); } },
        h('svg', { class: 'i', style: 'width:15px;height:15px;color:var(--accent)', html: '<use href="#i-bookmark"/>' }),
        h('span', { class: 'tt' }, bm.section ? `${bm.section} — ` : '', h('span', { class: 'muted' }, bm.label.slice(0, 60) + '…'))))));
    b.append(ul);
  }
  renderBook(r, b);
  const heads = r.headings.filter((x) => x.level <= Math.max(3, (r.chapterLevel || 2) + 1) && !x.el.closest('.answer-key'));
  const pstats = practice.stats(r).by;
  if (!heads.length) { b.append(h('div', { class: 'empty' }, 'This document has no headings.')); return; }
  b.append(h('h3', {}, bms.length ? 'Sections' : `${heads.length} sections · ${fmtMinutes(r.totalWords / (settings.wpm || 230))}`));
  const minL = Math.min(...heads.map((x) => x.level));
  const ul = h('ul', { class: 'toc', id: 'toc-list' });
  const hlCount = {};
  for (const hl of s.highlights) { const ch = r.currentChapter(hl.b ?? 0); if (ch) hlCount[ch.id] = (hlCount[ch.id] || 0) + 1; }
  for (const x of heads) {
    const rec = s.recall?.[x.id];
    const isCh = x.level === r.chapterLevel;
    const li = h('li', { class: `l${x.level - minL + 1}`, 'data-id': x.id, 'data-b': x.b },
      h('button', { onclick: () => { r.jumpTo(x.el, false); if (innerWidth < 900) close(r); } },
        h('span', { class: 'tt' }, x.text),
        isCh && hlCount[x.id] ? h('span', { class: 'hc', title: 'Highlights' }, `${hlCount[x.id]} ✎`) : null,
        isCh && pstats.get(x.id)?.total ? h('span', { class: 'hc pc', title: 'Practice: correct / questions' }, `✓ ${pstats.get(x.id).right}/${pstats.get(x.id).total}`) : null,
        isCh && rec?.rating ? h('span', { class: `dot ${rec.rating}`, title: `Recall: ${rec.rating}` }) : null));
    ul.append(li);
  }
  b.append(ul);
  if (settings.checkpoints && r.chapters.length > 1) {
    b.append(h('div', { class: 'legend' },
      h('span', {}, h('i', { class: 'dot solid' }), 'Recalled'), h('span', {}, h('i', { class: 'dot fuzzy' }), 'Fuzzy'), h('span', {}, h('i', { class: 'dot again' }), 'Reread')));
  }
  markCurrent(r);
}

// The other files in this folder — the chapters of the book — with their sections.
const expanded = new Set();
function renderBook(r, b) {
  const list = r.siblings || [];
  if (list.length < 2) return;
  const numbered = list.some((x) => x.chapter);
  b.append(h('h3', {}, `${r.folderName || 'This folder'} · ${list.length} ${numbered ? 'chapters' : 'documents'}`));
  const ul = h('ul', { class: 'toc book-toc' });
  for (const sb of list) {
    const cur = sb.id === r.book.id;
    // sections, minus the sub-headings of an answer key
    let inKey = 0;
    const secs = (sb.headings || []).filter((x) => {
      if (inKey && x.level > inKey) return false;
      inKey = classifyHeading(x.text) === 'key' ? x.level : 0;
      return x.level === 2 || x.level === 3;
    });
    const top = secs.some((x) => x.level === 2) ? secs : (sb.headings || []).filter((x) => x.level >= 2);
    const open = expanded.has(sb.id);
    const li = h('li', { class: cur ? 'cur-book' : '' },
      h('div', { class: 'bk-row' },
        !cur && top.length ? h('button', { class: `bk-exp${open ? ' open' : ''}`, title: open ? 'Hide sections' : 'Show sections', onclick: () => { open ? expanded.delete(sb.id) : expanded.add(sb.id); refresh(r); } }, '▸') : h('span', { style: 'width:28px;flex:none' }),
        h('button', { class: 'bk-open', onclick: () => { if (cur) { r.jumpTo(r.blocks[0], false); } else { r.openChapter(sb); } if (innerWidth < 900) close(r); } },
          sb.chapter ? h('span', { class: 'bk-num' }, sb.chapter) : null,
          h('span', { class: 'tt' }, sb.title),
          cur ? h('span', { class: 'bk-here' }, 'reading') : null)));
    if (open && !cur) {
      li.append(h('ul', { class: 'bk-secs' }, ...top.slice(0, 60).map((x) => h('li', { class: `l${x.level}` },
        h('button', { onclick: () => { r.openChapter(sb, x.text); if (innerWidth < 900) close(r); } }, h('span', { class: 'tt' }, x.text))))));
    }
    ul.append(li);
  }
  b.append(ul);
}

export function markCurrent(r) {
  const ul = $('#toc-list');
  if (!ul) return;
  const a = r.anchor();
  let cur = null;
  $$('li', ul).forEach((li) => {
    const bb = +li.dataset.b;
    li.classList.toggle('read', bb < a.b);
    if (bb <= a.b) cur = li;
    li.classList.remove('cur');
  });
  if (cur) { cur.classList.add('cur'); if (!isVisible(cur, body())) cur.scrollIntoView({ block: 'center' }); }
}
const isVisible = (el, box) => { const a = el.getBoundingClientRect(), b = box.getBoundingClientRect(); return a.top >= b.top && a.bottom <= b.bottom; };

// -------------------------------------------------------------------- Search
function renderSearch(r, b) {
  if (!$('.search-box input', b)) {
    b.replaceChildren(
      h('div', { class: 'search-box' }, h('input', { type: 'search', placeholder: 'Search this document', autocomplete: 'off' })),
      h('div', { id: 'search-results' }));
    const input = $('input', b);
    input.addEventListener('input', debounce(() => runSearch(r, input.value), 160));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#search-results .hit')?.click(); if (e.key === 'Escape') { e.stopPropagation(); close(r); } });
  }
  const input = $('input', b);
  if (arg != null) { input.value = arg; arg = null; }
  setTimeout(() => input.focus(), 30);
  runSearch(r, input.value);
}

function runSearch(r, q) {
  const out = $('#search-results');
  if (!out) return;
  out.replaceChildren();
  q = q.trim();
  if (q.length < 2) { out.append(h('div', { class: 'empty' }, 'Type at least two characters.')); return; }
  const idx = r.textIndex();
  const hay = idx.text.toLowerCase();
  const needle = q.toLowerCase();
  const hits = [];
  for (let i = hay.indexOf(needle); i !== -1 && hits.length < 300; i = hay.indexOf(needle, i + needle.length)) hits.push(i);
  out.append(h('h3', {}, hits.length ? `${hits.length}${hits.length >= 300 ? '+' : ''} result${hits.length > 1 ? 's' : ''}` : 'No results'));
  for (const i of hits) {
    const a = Math.max(0, i - 60), z = Math.min(idx.text.length, i + q.length + 80);
    const snippet = `${a > 0 ? '…' : ''}${esc(idx.text.slice(a, i).replace(/\s+/g, ' '))}<b>${esc(idx.text.slice(i, i + q.length))}</b>${esc(idx.text.slice(i + q.length, z).replace(/\s+/g, ' '))}…`;
    const node = nodeAt(idx, i);
    const blockEl = node?.parentElement?.closest('[data-b]');
    const ch = blockEl ? r.currentChapter(+blockEl.dataset.b) : null;
    out.append(h('button', { class: 'hit', onclick: () => goHit(r, i, q.length) },
      ch && !ch.intro ? h('span', { class: 'where' }, ch.text) : null, h('span', { html: snippet })));
  }
}

function nodeAt(idx, off) {
  let lo = 0, hi = idx.starts.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (idx.starts[m] <= off) lo = m; else hi = m - 1; }
  return idx.nodes[lo];
}

async function goHit(r, s, len) {
  $$('.search-hit', r.content).forEach((x) => x.replaceWith(...x.childNodes));
  r.content.normalize();
  r.index = null;
  const idx = r.textIndex();
  const { wrapRange } = await import('./anchor.js');
  const els = wrapRange(idx, s, s + len, () => h('span', { class: 'search-hit' }));
  r.index = null;
  if (els[0]) r.jumpTo(els[0], false);
  if (innerWidth < 900) close(r);
}

// ------------------------------------------------------------------ Notebook
let nbTab = 'highlights', nbColor = null;
function renderNotebook(r, b) {
  b.replaceChildren();
  const s = r.state;
  const summaries = Object.entries(s.recall || {}).filter(([, v]) => v.summary?.trim());
  const reflections = Object.entries(s.reflect || {}).filter(([, v]) => v.text?.trim());
  const pst = practice.stats(r);
  const due = s.cards.filter((c) => isDue(c)).length;
  b.append(h('div', { class: 'stats' },
    h('div', { class: 'stat' }, h('b', {}, s.highlights.length), h('span', {}, 'highlights')),
    h('div', { class: 'stat' }, h('b', {}, s.cards.length), h('span', {}, `cards · ${due} due`)),
    h('div', { class: 'stat' }, h('b', {}, fmtMinutes((s.readSecs || 0) / 60) || '0 min'), h('span', {}, 'time reading'))));
  const actions = h('div', { class: 'filter-row' },
    h('button', { class: 'btn small accent', onclick: () => study.reviewBook(r), disabled: !due, html: icon('cards') + esc(`Review ${due || ''}`.trim()) }),
    h('span', { class: 'sp' }),
    h('button', { class: 'btn small', onclick: () => openExportDialog(r, 'notebook'), title: 'Export your notebook as a PDF', html: icon('print') + 'PDF' }),
    h('button', { class: 'btn small', onclick: () => exportNotes(r), title: 'Download highlights, notes and summaries as Markdown', html: icon('download') + 'Markdown' }));
  b.append(actions);

  const tabs = h('div', { class: 'tabs' });
  const tabList = [['highlights', 'Highlights', s.highlights.length], ['summaries', 'My words', summaries.length + reflections.length], ['cards', 'Cards', s.cards.length]];
  if (pst.all.total) tabList.push(['practice', 'Practice', `${pst.all.right}/${pst.all.total}`]);
  else if (nbTab === 'practice') nbTab = 'highlights';
  for (const [k, label, n] of tabList) {
    tabs.append(h('button', { class: nbTab === k ? 'on' : '', onclick: () => { nbTab = k; refresh(r); } }, label, h('span', { class: 'n' }, n)));
  }
  b.append(tabs);

  if (nbTab === 'highlights') {
    if (!s.highlights.length) { b.append(h('div', { class: 'empty', html: 'Select any passage while reading and pick a colour to <b>highlight</b> it.<br><br>Add a note to say why it matters — explaining things to yourself is one of the best ways to remember them.' })); return; }
    const fr = h('div', { class: 'filter-row' }, h('span', { class: 'muted', style: 'font-size:12px;margin-right:4px' }, 'Filter'));
    ['yellow', 'blue', 'pink', 'green'].forEach((c) => fr.append(h('button', { class: `sw${nbColor === c ? ' on' : ''}`, 'data-c': c, title: c, onclick: () => { nbColor = nbColor === c ? null : c; refresh(r); } })));
    b.append(fr);
    let last = null;
    const list = s.highlights.filter((x) => !nbColor || x.color === nbColor).slice().sort((x, y) => (x.pos ?? 0) - (y.pos ?? 0));
    for (const hl of list) {
      if (hl.section !== last) { b.append(h('h3', {}, hl.section || 'Beginning')); last = hl.section; }
      const hasCard = s.cards.some((c) => c.src?.hid === hl.id);
      b.append(h('div', { class: `note-item${hl.orphan ? ' orphan' : ''}` },
        h('div', { class: 'q', 'data-c': hl.color, onclick: () => { r.rememberJump(); r.goToHighlight(hl.id); if (innerWidth < 900) close(r); } }, hl.exact),
        hl.note ? h('div', { class: 'n' }, hl.note) : null,
        h('div', { class: 'meta' },
          h('span', {}, fmtAgo(hl.created)), hl.orphan ? h('span', { class: 'pill' }, 'text changed') : null,
          h('span', { class: 'sp' }),
          h('button', { onclick: () => { r.goToHighlight(hl.id); setTimeout(() => r.editNote(hl), 350); }, html: icon('pen') + (hl.note ? 'Edit' : 'Note') }),
          h('button', { onclick: () => study.cardFromHighlight(r, hl), html: icon('cards') + (hasCard ? 'Card ✓' : 'Card') }),
          h('button', { onclick: () => r.removeHighlight(hl.id), title: 'Delete', html: icon('trash') }))));
    }
  } else if (nbTab === 'summaries') {
    if (!summaries.length && !reflections.length) { b.append(h('div', { class: 'empty', html: 'At the end of each section you\'ll find a <b>recall checkpoint</b>. Write a few sentences from memory — they are collected here, together with your answers to <b>food for thought</b> questions.' })); return; }
    const order = new Map(r.chapters.map((c, i) => [c.id, i]));
    summaries.sort((x, y) => (order.get(x[0]) ?? 1e9) - (order.get(y[0]) ?? 1e9));
    for (const [key, v] of summaries) {
      const ch = r.chapters.find((c) => c.id === key);
      b.append(h('div', { class: 'note-item' },
        h('div', { class: 'q', onclick: () => ch && r.jumpTo(ch.el, false) }, v.title || key),
        h('div', { class: 'n' }, v.summary),
        h('div', { class: 'meta' }, v.rating ? h('span', { class: `dot ${v.rating}`, style: 'width:8px;height:8px;border-radius:50%;display:inline-block' }) : null, h('span', {}, v.rating ? { solid: 'Recalled well', fuzzy: 'Fuzzy', again: 'Needed a reread' }[v.rating] : ''), h('span', { class: 'sp' }), h('span', {}, fmtAgo(v.sumTs || v.ts)))));
    }
    if (reflections.length) {
      b.append(h('h3', {}, 'Food for thought'));
      for (const [qid, v] of reflections) {
        const el = r.content.querySelector(`.tb-think[data-qid="${qid}"]`);
        b.append(h('div', { class: 'note-item' },
          h('div', { class: 'q', onclick: () => el && r.jumpTo(el, true) }, v.q || v.title || 'Question'),
          h('div', { class: 'n' }, v.text),
          h('div', { class: 'meta' }, h('span', {}, v.title || ''), h('span', { class: 'sp' }), h('span', {}, fmtAgo(v.ts)))));
      }
    }
  } else if (nbTab === 'practice') {
    renderPractice(r, b, pst);
  } else {
    if (!s.cards.length) { b.append(h('div', { class: 'empty', html: 'No cards yet. Select a sentence and choose <b>Card</b>, add terms from <b>Key concepts</b>, or turn a checkpoint summary into a card.' })); return; }
    const list = s.cards.slice().sort((x, y) => (x.srs?.due ?? 0) - (y.srs?.due ?? 0));
    for (const c of list) {
      const dueTxt = isDue(c) ? 'due now' : `due ${fmtDue(c.srs.due)}`;
      b.append(h('div', { class: 'note-item' },
        h('div', { class: 'q', html: study.frontHTML(c, true) }),
        h('div', { class: 'n', html: study.richText(study.backText(c)) }),
        h('div', { class: 'meta' }, h('span', { class: `pill${isDue(c) ? ' accent' : ''}` }, dueTxt), h('span', {}, c.srs?.reps ? `${c.srs.reps} review${c.srs.reps > 1 ? 's' : ''}` : 'new'), h('span', { class: 'sp' }),
          h('button', { onclick: () => study.editCard(r, c), html: icon('pen') + 'Edit' }),
          h('button', { onclick: () => { r.state.cards = r.state.cards.filter((x) => x !== c); r.commit(); refresh(r); }, title: 'Delete card', html: icon('trash') }))));
    }
  }
}

function renderPractice(r, b, pst) {
  const { all, by } = pst;
  b.append(h('div', { class: 'stats' },
    h('div', { class: 'stat' }, h('b', {}, `${all.done}/${all.total}`), h('span', {}, 'attempted')),
    h('div', { class: 'stat' }, h('b', {}, all.right), h('span', {}, 'correct')),
    h('div', { class: 'stat' }, h('b', {}, all.wrong.length), h('span', {}, 'to review'))));
  b.append(h('h3', {}, 'By section'));
  for (const ch of r.chapters) {
    const st = by.get(ch.id);
    if (!st?.total) continue;
    b.append(h('div', { class: 'prac-row', onclick: () => { r.jumpTo(ch.el, false); if (innerWidth < 900) close(r); } },
      h('span', { class: 'pr-t' }, ch.text),
      h('span', { class: 'pr-bar' }, h('i', { style: { width: `${(st.right / st.total) * 100}%` } }), h('i', { class: 'w', style: { width: `${((st.done - st.right) / st.total) * 100}%` } })),
      h('span', { class: 'pr-n' }, `${st.right}/${st.total}`)));
  }
  if (by.get('_doc')?.total) b.append(h('div', { class: 'prac-row' }, h('span', { class: 'pr-t' }, 'Document'), h('span', { class: 'pr-n' }, `${by.get('_doc').right}/${by.get('_doc').total}`)));
  b.append(h('h3', {}, all.wrong.length ? 'To review' : 'Nothing to review'));
  if (!all.wrong.length) b.append(h('div', { class: 'empty' }, all.done ? 'Every attempted question is correct — nice work.' : 'Try the quick checks and the problems at the end of each chapter. Questions you miss are collected here.'));
  for (const it of all.wrong) {
    b.append(h('div', { class: 'note-item' },
      h('div', { class: 'q', onclick: () => { r.jumpTo(it.el, true); if (innerWidth < 900) close(r); } }, practice.promptText(it.el, false).slice(0, 220)),
      h('div', { class: 'meta' }, h('span', { class: 'pill' }, practice.label(it.el)), it.chapter && !practice.label(it.el).startsWith(it.chapter.text) ? h('span', {}, it.chapter.text) : null)));
  }
  if (all.done) {
    b.append(h('div', { class: 'filter-row', style: 'margin-top:14px' }, h('span', { class: 'sp' }),
      h('button', { class: 'btn small ghost', onclick: () => { if (!confirm('Clear all practice answers for this document?')) return; r.state.practice = {}; const pos = r.savedAnchor(); r.render(); r.layout({ restore: false }); r.restore(pos); r.commit(); refresh(r); } }, 'Reset practice')));
  }
}

function fmtDue(ts) {
  const d = Math.round((ts - Date.now()) / 86400000);
  if (d <= 0) return 'later today';
  if (d === 1) return 'tomorrow';
  if (d < 30) return `in ${d} days`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function exportNotes(r) {
  const s = r.state;
  const L = [`# Notes — ${r.book.title}`, '', `*Exported from Margin on ${new Date().toLocaleDateString()}* · source: \`${r.book.rel}\``, ''];
  const secs = new Map();
  for (const hl of s.highlights.slice().sort((x, y) => (x.pos ?? 0) - (y.pos ?? 0))) {
    const k = hl.section || 'Beginning';
    if (!secs.has(k)) secs.set(k, []);
    secs.get(k).push(hl);
  }
  if (secs.size) L.push('## Highlights', '');
  for (const [sec, list] of secs) {
    L.push(`### ${sec}`, '');
    for (const hl of list) { L.push(`> ${hl.exact.replace(/\n+/g, ' ')}`); if (hl.note) L.push('', hl.note); L.push(''); }
  }
  const sums = Object.values(s.recall || {}).filter((v) => v.summary?.trim());
  if (sums.length) { L.push('## In my own words', ''); for (const v of sums) L.push(`### ${v.title || ''}`, '', v.summary.trim(), ''); }
  if (s.cards.length) { L.push('## Cards', ''); for (const c of s.cards) L.push(`- **Q:** ${study.frontText(c)}`, `  **A:** ${study.backText(c).replace(/\n/g, ' ')}`); L.push(''); }
  const terms = r.concepts.filter((c) => c.kind === 'definition');
  if (terms.length) { L.push('## Key concepts', ''); for (const c of terms) L.push(`- **${c.term}** — ${c.def}`); L.push(''); }
  download(`${r.book.title.replace(/[\\/:*?"<>|]+/g, ' ').trim()} — notes.md`, L.join('\n'));
  toast('Notes exported');
}

// -------------------------------------------------------------- Key concepts
function renderConcepts(r, b) {
  b.replaceChildren();
  const defs = r.concepts.filter((c) => c.kind === 'definition');
  const mentions = r.concepts.filter((c) => c.kind !== 'definition');
  if (!r.concepts.length) { b.append(h('div', { class: 'empty', html: 'No key terms found. Margin collects the phrases written in <b>bold</b> — LLMs usually bold the important concepts.' })); return; }
  const deckKeys = new Set(r.state.cards.map((c) => c.src?.term).filter(Boolean));
  const notIn = defs.filter((c) => !deckKeys.has(c.key));
  b.append(h('div', { class: 'filter-row' },
    h('button', { class: 'btn small accent', disabled: defs.length < 4, title: defs.length < 4 ? 'Needs at least 4 defined terms' : 'Multiple-choice quiz (Q)', onclick: () => study.quiz(r) }, 'Quiz me'),
    h('button', { class: 'btn small', disabled: !notIn.length, onclick: () => { notIn.forEach((c) => study.addConceptCard(r, c, true)); toast(`${notIn.length} card${notIn.length > 1 ? 's' : ''} added`); refresh(r); } }, `Add all to deck${notIn.length ? ` (${notIn.length})` : ''}`)));
  const item = (c) => h('div', { class: `concept ${c.kind}` },
    h('div', { class: 'ch' },
      h('span', { class: 'term-name', onclick: () => { const el = r.content.querySelector(`[data-b="${c.block}"] strong[data-term="${CSS.escape(c.key)}"]`) || r.blocks[c.block]; r.jumpTo(el, true); if (innerWidth < 900) close(r); } }, c.term),
      c.count > 1 ? h('span', { class: 'muted', style: 'font-size:12px' }, `×${c.count}`) : null,
      h('span', { class: 'sp' }),
      c.kind === 'definition' ? h('button', { class: `add${deckKeys.has(c.key) ? ' on' : ''}`, onclick: () => { if (!deckKeys.has(c.key)) { study.addConceptCard(r, c); refresh(r); } } }, deckKeys.has(c.key) ? '✓ In deck' : '+ Card') : null),
    c.def ? h('div', { class: 'def', html: study.richText(c.def) }) : null);
  if (defs.length) { b.append(h('h3', {}, `Defined here · ${defs.length}`)); defs.forEach((c) => b.append(item(c))); }
  if (mentions.length) { b.append(h('h3', {}, `Also emphasised · ${mentions.length}`)); mentions.forEach((c) => b.append(item(c))); }
}

// ------------------------------------------------------------------ Settings
function renderSettings(r, b) {
  b.replaceChildren();
  const seg = (key, opts) => {
    const el = h('div', { class: 'seg full' });
    for (const [v, label] of opts) el.append(h('button', { class: String(settings[key]) === String(v) ? 'on' : '', onclick: () => { setSetting({ [key]: v }); refresh(r); } }, label));
    return el;
  };
  const group = (label, value, ...kids) => h('div', { class: 'set-group' }, h('div', { class: 'set-label' }, h('span', {}, label), value ? h('span', { class: 'v' }, value) : null), ...kids);

  const fonts = h('div', { class: 'fonts' });
  for (const [k, f] of Object.entries(FONTS)) {
    fonts.append(h('button', { class: settings.font === k ? 'on' : '', style: { fontFamily: f.css.replace(/var\(--serif-sys\)/, 'Georgia, serif').replace(/var\(--ui\)/, 'system-ui, sans-serif') }, onclick: () => { setSetting({ font: k }); refresh(r); } },
      h('span', { class: 'sample' }, 'Ag'), h('span', { class: 'nm', style: { fontFamily: 'var(--ui)' } }, f.name)));
  }
  const themes = h('div', { class: 'themes' });
  for (const t of THEMES) themes.append(h('button', { 'data-v': t, class: settings.theme === t ? 'on' : '', onclick: () => { setSetting({ theme: t }); refresh(r); } }, t[0].toUpperCase() + t.slice(1)));

  const size = h('input', { type: 'range', min: 14, max: 32, step: 1, value: settings.size });
  size.addEventListener('input', () => { $('#size-v').textContent = size.value + ' px'; });
  size.addEventListener('change', () => setSetting({ size: +size.value }));
  const step = (d) => { const v = Math.max(14, Math.min(32, settings.size + d)); setSetting({ size: v }); refresh(r); };

  const toggle = (key, label, hint) => {
    const inp = h('input', { type: 'checkbox' });
    inp.checked = !!settings[key];
    inp.addEventListener('change', () => setSetting({ [key]: inp.checked }));
    return h('label', { class: 'toggle' }, h('span', {}, label, hint ? h('small', {}, hint) : null), inp);
  };

  b.append(
    group('Typeface', null, fonts),
    group('Size', `<span id="size-v">${settings.size} px</span>`, h('div', { class: 'stepper' }, h('button', { onclick: () => step(-1), style: 'font-size:13px' }, 'A'), size, h('button', { onclick: () => step(1), style: 'font-size:19px' }, 'A'))),
    group('Line spacing', null, seg('leading', [[1.4, 'Compact'], [1.6, 'Normal'], [1.85, 'Relaxed']])),
    group('Margins', null, seg('margin', [['narrow', 'Narrow'], ['normal', 'Normal'], ['wide', 'Wide']])),
    group('Alignment', null, seg('align', [['left', 'Left'], ['justify', 'Justified']])),
    group('Theme', null, themes),
    group('Layout', null, seg('layout', [['paged', 'Pages'], ['scroll', 'Scroll']])),
    settings.layout === 'paged' ? group('Columns', null, seg('columns', [['auto', 'Auto'], ['1', 'One'], ['2', 'Two']])) : '',
    h('div', { class: 'set-group' },
      toggle('checkpoints', 'Recall checkpoints', 'A short self-test at the end of each section'),
      toggle('anim', 'Page-turn animation'),
      toggle('wrapCode', 'Wrap long code lines', 'In page layout'),
      toggle('hideCitations', 'Hide citation markers', 'Removes 【…†source】 and [cite: …] artefacts'),
      toggle('calm', 'Fade toolbars while reading')),
    h('div', { class: 'muted', style: 'font-size:12px;line-height:1.5' }, `Reading speed: ~${settings.wpm} words/min (learned as you read).`));
  // the label html for size
  $('.set-label .v', b.children[1]).innerHTML = `<span id="size-v">${settings.size} px</span>`;
}
