// Study tools: card editor, spaced-repetition review, concept quiz, shortcuts.
import { $, $$, h, esc, uid, toast, shuffle, isTyping } from './util.js';
import { api } from './api.js';
import { schedule, preview, newSrs, isDue } from './srs.js';
import * as panels from './panels.js';

// ------------------------------------------------------------------- modal
let modalKey = null, modalClose = null;
export function openModal(content, { onKey, onClose } = {}) {
  const m = $('#modal'), card = $('#modal-card');
  card.replaceChildren(content);
  m.hidden = false;
  modalKey = onKey || null;
  modalClose = onClose || null;
  m.onclick = (e) => { if (e.target === m) closeModal(); };
}
export function closeModal() {
  const m = $('#modal');
  if (m.hidden) return;
  m.hidden = true;
  $('#modal-card').replaceChildren();
  const fn = modalClose;
  modalKey = modalClose = null;
  fn?.();
}
export const modalOpen = () => !$('#modal').hidden;
export function modalKeydown(e) {
  if (e.key === 'Escape') { e.preventDefault(); closeModal(); return true; }
  if (modalKey) return modalKey(e) || true;
  return true;
}

// ------------------------------------------------------------- card text
/* global katex */
// Card text may contain $…$ math (cards made from textbook questions keep their formulas as TeX).
const MATH = /(\$\$[^$]+?\$\$|\$(?=\S)[^$\n]*?\S\$(?!\d)|\$\S\$(?!\d))/g;
export function richText(s) {
  return String(s ?? '').split(MATH).map((p, i) => {
    if (i % 2 === 0) return esc(p);
    const disp = p.startsWith('$$');
    try { return katex.renderToString(p.slice(disp ? 2 : 1, disp ? -2 : -1), { throwOnError: false, displayMode: false }); } catch (e) { return esc(p); }
  }).join('');
}

export function frontHTML(c, inList = false, revealed = false) {
  if (c.type === 'cloze') {
    const i = c.text.indexOf(c.answer);
    if (i < 0) return richText(c.text);
    const mid = revealed ? `<span class="filled">${richText(c.answer)}</span>` : (inList ? '<span class="blank" style="min-width:3em">&nbsp;</span>' : `<span class="blank">${esc(c.answer)}</span>`);
    return richText(c.text.slice(0, i)) + mid + richText(c.text.slice(i + c.answer.length));
  }
  if (c.type === 'concept') return inList ? `<b>${esc(c.front)}</b>` : `What does <b>${esc(c.front)}</b> mean?`;
  return richText(c.front).replace(/\n/g, '<br>');
}
export const frontText = (c) => (c.type === 'cloze' ? c.text.replace(c.answer, '_____') : c.type === 'concept' ? `What does “${c.front}” mean?` : c.front);
export const backText = (c) => (c.type === 'cloze' ? c.answer : c.back || '');

// ------------------------------------------------------------ card editor
export function cardFromHighlight(r, hl) {
  const existing = r.state.cards.find((c) => c.src?.hid === hl.id);
  if (existing) return editCard(r, existing);
  const ctx = hl.context || '';
  const wordsN = hl.exact.split(/\s+/).length;
  if (ctx && ctx.includes(hl.exact) && wordsN <= 12 && hl.exact.length < ctx.length * 0.75) {
    return editCard(r, { type: 'cloze', text: ctx, answer: hl.exact, src: { hid: hl.id, b: hl.b } });
  }
  return editCard(r, { type: 'qa', front: hl.note || '', back: hl.exact, src: { hid: hl.id, b: hl.b } });
}

export function addConceptCard(r, c, silent = false) {
  if (r.state.cards.some((k) => k.src?.term === c.key)) return;
  r.state.cards.push({ id: uid(), type: 'concept', front: c.term, back: c.def, src: { term: c.key, b: c.block }, srs: newSrs(), created: Date.now() });
  r.commit();
  if (!silent) toast(`“${c.term}” added to your deck`);
  if (panels.current) panels.refresh(r);
}

export function editCard(r, card) {
  const isNew = !card.id;
  let type = card.type === 'concept' ? 'qa' : card.type;
  const draft = { ...card };
  if (card.type === 'concept') { draft.front = card.front; draft.back = card.back; }

  const wrap = h('div');
  const draw = () => {
    wrap.replaceChildren(
      h('h2', {}, isNew ? 'New card' : 'Edit card'),
      h('div', { class: 'sub' }, type === 'cloze' ? 'Fill-in-the-blank: the hidden part is blanked out when you review.' : 'Question and answer. Good questions ask for one idea, in your own words.'),
      h('div', { class: 'seg', style: 'margin-bottom:6px' },
        h('button', { class: type === 'cloze' ? 'on' : '', onclick: () => { sync(); if (type !== 'cloze') { type = 'cloze'; if (!draft.text) { draft.text = draft.back || ''; draft.answer = ''; } draw(); } } }, 'Fill in the blank'),
        h('button', { class: type === 'qa' ? 'on' : '', onclick: () => { sync(); if (type !== 'qa') { type = 'qa'; if (!draft.back) draft.back = draft.answer || draft.text || ''; draw(); } } }, 'Question & answer')),
      ...(type === 'cloze'
        ? [h('label', { class: 'fld' }, 'Sentence'), h('textarea', { id: 'cf-text' }), h('label', { class: 'fld' }, 'Hidden part (must appear in the sentence)'), h('input', { type: 'text', id: 'cf-ans' })]
        : [h('label', { class: 'fld' }, 'Question'), h('textarea', { id: 'cf-front', placeholder: card.src?.hid ? 'Write a question whose answer is the passage below…' : 'Question' }), h('label', { class: 'fld' }, 'Answer'), h('textarea', { id: 'cf-back' })]),
      h('div', { class: 'modal-actions' },
        !isNew ? h('button', { class: 'btn ghost', onclick: () => { r.state.cards = r.state.cards.filter((x) => x.id !== card.id); r.commit(); closeModal(); toast('Card deleted'); if (panels.current) panels.refresh(r); } }, 'Delete') : null,
        h('span', { class: 'sp' }),
        h('span', { class: 'muted', style: 'font-size:12px' }, h('span', { class: 'kbd' }, 'Ctrl'), ' + ', h('span', { class: 'kbd' }, 'Enter')),
        h('button', { class: 'btn ghost', onclick: closeModal }, 'Cancel'),
        h('button', { class: 'btn accent', id: 'cf-save', onclick: save }, 'Save card')));
    if (type === 'cloze') { $('#cf-text', wrap).value = draft.text || ''; $('#cf-ans', wrap).value = draft.answer || ''; }
    else { $('#cf-front', wrap).value = draft.front || ''; $('#cf-back', wrap).value = draft.back || ''; }
    setTimeout(() => { const f = $(type === 'cloze' ? '#cf-ans' : '#cf-front', wrap); f?.focus(); }, 20);
  };
  const sync = () => {
    if (type === 'cloze') { draft.text = $('#cf-text', wrap)?.value ?? draft.text; draft.answer = $('#cf-ans', wrap)?.value ?? draft.answer; }
    else { draft.front = $('#cf-front', wrap)?.value ?? draft.front; draft.back = $('#cf-back', wrap)?.value ?? draft.back; }
  };
  function save() {
    sync();
    let out;
    if (type === 'cloze') {
      const text = (draft.text || '').trim(), answer = (draft.answer || '').trim();
      if (!text || !answer) return toast('Add a sentence and the part to hide');
      if (!text.includes(answer)) return toast('The hidden part must appear exactly in the sentence');
      out = { type: 'cloze', text, answer };
    } else {
      const front = (draft.front || '').trim(), back = (draft.back || '').trim();
      if (!front || !back) return toast('A card needs both a question and an answer');
      out = { type: card.type === 'concept' ? 'concept' : 'qa', front, back };
    }
    if (isNew) r.state.cards.push({ id: uid(), ...out, src: card.src || {}, srs: newSrs(), created: Date.now() });
    else { const c = r.state.cards.find((x) => x.id === card.id); if (c) { delete c.text; delete c.answer; delete c.front; delete c.back; Object.assign(c, out); } }
    r.commit();
    closeModal();
    toast(isNew ? 'Card added — it will come up in Review' : 'Card saved');
    if (panels.current) panels.refresh(r);
  }
  draw();
  openModal(wrap, { onKey: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } return true; } });
}

// ----------------------------------------------------------------- review
export function reviewBook(r) {
  const due = r.state.cards.filter((c) => isDue(c));
  if (!r.state.cards.length) { toast('No cards yet — select text and choose “Card”, or add Key concepts'); return; }
  if (!due.length) { toast(`Nothing due — next card ${nextDueText(r.state.cards)}`); return; }
  startReview(due.map((card) => ({ card, title: r.book.title, bookId: r.book.id })), {
    save: () => r.commit(),
    goto: (item) => { closeModal(); if (item.card.src?.hid) r.goToHighlight(item.card.src.hid); else if (item.card.src?.term) { const c = r.concepts.find((x) => x.key === item.card.src.term); r.goToBlock(c ? c.block : item.card.src.b || 0, true); } else r.goToBlock(item.card.src?.b || 0, true); },
  });
}

export async function reviewAll(onDone) {
  let states;
  try { states = await api.states(); } catch (e) { toast('Could not load cards'); return; }
  const items = [];
  for (const [bookId, st] of Object.entries(states)) {
    for (const card of st.cards || []) if (isDue(card)) items.push({ card, title: st.title || bookId, bookId, state: st });
  }
  if (!items.length) { toast('Nothing due right now'); return; }
  startReview(items, {
    save: (item) => api.saveState(item.bookId, item.state).catch(() => {}),
    goto: (item) => { closeModal(); location.hash = `#/read/${encodeURIComponent(item.bookId)}`; },
    onClose: onDone,
  });
}

function nextDueText(cards) {
  const next = Math.min(...cards.filter((c) => !c.suspended).map((c) => c.srs?.due ?? Infinity));
  if (!isFinite(next)) return 'not scheduled';
  const d = (next - Date.now()) / 86400000;
  if (d < 1 / 24) return 'in a few minutes';
  if (d < 1) return `in ${Math.ceil(d * 24)} h`;
  return `in ${Math.ceil(d)} day${Math.ceil(d) > 1 ? 's' : ''}`;
}

function startReview(items, { save, goto, onClose }) {
  const queue = shuffle(items).sort((a, b) => (a.card.srs?.due ?? 0) - (b.card.srs?.due ?? 0)).slice(0, 150);
  const total = queue.length;
  let done = 0, revealed = false, cur = null;
  const stats = [0, 0, 0, 0];
  const wrap = h('div');

  const draw = () => {
    cur = queue[0];
    if (!cur) return finish();
    revealed = false;
    const c = cur.card;
    wrap.replaceChildren(
      h('div', { class: 'rv-top' }, h('span', {}, `${done} / ${total}`), h('div', { class: 'pbar' }, h('i', { style: { width: (done / total * 100) + '%' } })), h('button', { class: 'icon-btn', title: 'Close (Esc)', onclick: closeModal, html: '<svg class="i"><use href="#i-x"/></svg>' })),
      h('div', { class: 'rv-src' }, h('span', { class: 'pill' }, { cloze: 'Fill in', concept: 'Concept', qa: 'Question' }[c.type] || 'Card'), h('span', {}, cur.title)),
      h('div', { class: 'rv-front', html: frontHTML(c) }),
      h('div', { class: 'rv-back', hidden: true, html: c.type === 'cloze' ? '' : richText(backText(c)) }),
      h('button', { class: 'btn accent show-btn', onclick: reveal, html: 'Show answer &nbsp;<span class="kbd" style="background:transparent;color:inherit;border-color:currentColor;opacity:.7">Space</span>' }),
      h('div', { class: 'grades', hidden: true }, ...['Again', 'Hard', 'Good', 'Easy'].map((g, i) => h('button', { 'data-g': i, onclick: () => grade(i) }, g, h('small', {}, `${preview(c.srs, i)} · ${i + 1}`)))),
      h('div', { class: 'modal-actions', style: 'margin-top:12px' }, h('button', { class: 'btn small ghost', onclick: () => goto(cur) }, 'Open passage'), h('span', { class: 'sp' }), h('span', { class: 'muted', style: 'font-size:12px' }, 'Try to answer before revealing.')));
  };
  function reveal() {
    if (revealed || !cur) return;
    revealed = true;
    const c = cur.card;
    if (c.type === 'cloze') $('.rv-front', wrap).innerHTML = frontHTML(c, false, true);
    else $('.rv-back', wrap).hidden = false;
    $('.show-btn', wrap).hidden = true;
    $('.grades', wrap).hidden = false;
  }
  function grade(g) {
    if (!revealed || !cur) return;
    const item = queue.shift();
    item.card.srs = schedule(item.card.srs, g);
    stats[g]++;
    save(item);
    if (g === 0) queue.splice(Math.min(queue.length, 3), 0, item); // see it again soon
    else done++;
    draw();
  }
  function finish() {
    const n = stats.reduce((a, b) => a + b, 0);
    wrap.replaceChildren(
      h('div', { class: 'done-big' }, h('div', { class: 'n' }, done), h('div', { class: 'muted', style: 'margin-top:6px' }, `card${done === 1 ? '' : 's'} reviewed`)),
      h('p', { style: 'text-align:center;color:var(--fg-2)' }, n ? `Again ${stats[0]} · Hard ${stats[1]} · Good ${stats[2]} · Easy ${stats[3]}` : ''),
      h('p', { class: 'muted', style: 'text-align:center;font-size:13.5px' }, 'Spacing reviews out like this is what moves ideas into long-term memory. See you next time.'),
      h('div', { class: 'modal-actions', style: 'justify-content:center' }, h('button', { class: 'btn accent', onclick: closeModal }, 'Done')));
  }
  draw();
  openModal(wrap, {
    onClose,
    onKey: (e) => {
      if (isTyping(e)) return true;
      if ((e.key === ' ' || e.key === 'Enter') && !revealed && cur) { e.preventDefault(); reveal(); }
      else if (revealed && /^[1-4]$/.test(e.key)) { e.preventDefault(); grade(+e.key - 1); }
      else if (!cur && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); closeModal(); }
      return true;
    },
  });
}

// ------------------------------------------------------------------- quiz
export function quiz(r) {
  const pool = r.concepts.filter((c) => c.kind === 'definition' && c.def.length > 10);
  if (pool.length < 4) { toast('A quiz needs at least 4 defined key terms in this document'); return; }
  const qs = shuffle(pool).slice(0, Math.min(10, pool.length));
  let i = 0, score = 0, answered = false;
  const missed = [];
  const wrap = h('div');
  const mask = (def, term) => {
    let d = def;
    for (const w of term.split(/\s+/).filter((x) => x.length > 3)) d = d.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '_____');
    return d;
  };
  const draw = () => {
    if (i >= qs.length) return finish();
    answered = false;
    const q = qs[i];
    const opts = shuffle([q, ...shuffle(pool.filter((x) => x !== q)).slice(0, 3)]);
    wrap.replaceChildren(
      h('div', { class: 'rv-top' }, h('span', {}, `Question ${i + 1} of ${qs.length}`), h('div', { class: 'pbar' }, h('i', { style: { width: (i / qs.length * 100) + '%' } })), h('span', {}, `${score} ✓`), h('button', { class: 'icon-btn', onclick: closeModal, html: '<svg class="i"><use href="#i-x"/></svg>' })),
      h('div', { class: 'sub', style: 'margin:0 0 6px' }, 'Which term matches this description?'),
      h('div', { class: 'quiz-q', html: richText(mask(q.def, q.term)) }),
      h('div', { class: 'quiz-opts' }, ...opts.map((o, k) => h('button', { 'data-k': o.key, onclick: () => pick(o, opts) }, h('span', { class: 'k' }, k + 1), o.term))),
      h('div', { class: 'modal-actions' }, h('span', { class: 'sp' }), h('button', { class: 'btn accent', id: 'qz-next', hidden: true, onclick: () => { i++; draw(); } }, i + 1 < qs.length ? 'Next →' : 'See results')));
    wrap._opts = opts;
  };
  const pick = (o, opts) => {
    if (answered) return;
    answered = true;
    const q = qs[i];
    if (o === q) score++; else missed.push(q);
    $$('.quiz-opts button', wrap).forEach((b) => { b.disabled = true; if (b.dataset.k === q.key) b.classList.add('right'); else if (b.dataset.k === o.key) b.classList.add('wrong'); });
    $('#qz-next', wrap).hidden = false;
    $('#qz-next', wrap).focus();
  };
  const finish = () => {
    const pct = Math.round(score / qs.length * 100);
    wrap.replaceChildren(
      h('div', { class: 'done-big' }, h('div', { class: 'n' }, `${score}/${qs.length}`), h('div', { class: 'muted', style: 'margin-top:6px' }, pct >= 90 ? 'Excellent — you know these well.' : pct >= 60 ? 'Good. Review the ones you missed.' : 'Worth another pass through the text.')),
      missed.length ? h('div', {}, h('h3', { style: 'font:600 12px var(--ui);text-transform:uppercase;letter-spacing:.06em;color:var(--fg-3)' }, 'Missed'), ...missed.map((c) => h('div', { class: 'concept' }, h('div', { class: 'term-name' }, c.term), h('div', { class: 'def', html: richText(c.def) })))) : '',
      h('div', { class: 'modal-actions' },
        missed.length ? h('button', { class: 'btn', onclick: () => { missed.forEach((c) => addConceptCard(r, c, true)); toast(`${missed.length} card${missed.length > 1 ? 's' : ''} added to your deck`); closeModal(); } }, 'Add missed to deck') : null,
        h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => { closeModal(); quiz(r); } }, 'Again'), h('button', { class: 'btn accent', onclick: closeModal }, 'Done')));
  };
  draw();
  openModal(wrap, {
    onKey: (e) => {
      if (/^[1-4]$/.test(e.key) && !answered && wrap._opts && i < qs.length) { e.preventDefault(); pick(wrap._opts[+e.key - 1], wrap._opts); }
      else if (e.key === 'Enter' && answered) { e.preventDefault(); i++; draw(); }
      return true;
    },
  });
}

// ------------------------------------------------------------- shortcuts
export function showKeys() {
  const rows = [
    ['→  Space  PgDn', 'Next page'], ['←  Shift+Space  PgUp', 'Previous page'], ['Home / End', 'Start / end'],
    ['T', 'Contents, chapters & bookmarks'], ['[  ]', 'Previous / next chapter'], ['Alt+←  Backspace', 'Back to where you were'], ['/', 'Search in document'], ['N', 'Notebook'], ['K', 'Key concepts'],
    ['Q', 'Concept quiz'], ['R', 'Review due cards'], ['B', 'Bookmark page'], ['A', 'Reading settings'],
    ['P  Ctrl+P', 'Export PDF'], ['F', 'Full screen'], ['Esc', 'Close / back to library'], ['Ctrl + Enter', 'Save a note or card'],
  ];
  openModal(h('div', {},
    h('h2', {}, 'Keyboard shortcuts'),
    h('div', { class: 'sub' }, 'Select text with the mouse to highlight, add notes and make cards. Click the left or right margin to turn pages.'),
    h('div', { class: 'keys' }, ...rows.flatMap(([k, v]) => [h('div', { class: 'k' }, ...k.split('  ').map((x) => h('span', { class: 'kbd', style: 'margin-left:4px' }, x))), h('div', {}, v)])),
    h('div', { class: 'modal-actions' }, h('button', { class: 'btn accent', onclick: closeModal }, 'Got it'))));
}
