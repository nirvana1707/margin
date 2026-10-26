// Reader-side interactivity for textbook content: reveal buttons for hints,
// answers and solutions, multiple-choice checking, self-marking, food-for-thought
// notes and the folded answer key. Progress is saved per document.
import { h, debounce, toast } from './util.js';
import { texText } from './render.js';
import { SET_LABEL } from './textbook.js';
import * as study from './study.js';
import * as panels from './panels.js';

const SHOW = { hint: 'Show hint', answer: 'Show answer', solution: 'Show solution', discussion: 'Show discussion' };
const HIDE = { hint: 'Hide hint', answer: 'Hide answer', solution: 'Hide solution', discussion: 'Hide discussion' };
const CONTAINERS = '.tb, .problem, .worked';

const own = (el, sel) => Array.from(el.children).filter((c) => c.matches(sel));

// Called after every render of the reader.
export function decorate(r) {
  const root = r.content;
  r.state.practice = r.state.practice || {};
  r.state.reflect = r.state.reflect || {};
  const items = [];

  root.querySelectorAll(CONTAINERS).forEach((box) => {
    const isProblem = box.classList.contains('problem');
    const isThink = box.classList.contains('tb-think');
    const isExample = box.classList.contains('tb-example') || box.classList.contains('worked');
    const mcq = box.classList.contains('mcq');

    // Answers that live in the answer key are copied in, folded.
    if (box.dataset.aref && !own(box, '.reveal-answer, .reveal-solution').length) {
      const src = root.querySelector(`.key-item[data-aid="${box.dataset.aref}"]`);
      if (src) {
        const rv = h('div', { class: 'reveal reveal-answer from-key no-anchor', 'data-kind': 'answer' }, h('div', { class: 'reveal-label' }, 'Answer'));
        Array.from(src.childNodes).forEach((n) => rv.append(n.cloneNode(true)));
        box.append(rv);
      }
    }
    const reveals = own(box, '.reveal');
    reveals.forEach((rv) => rv.classList.add('rv-closed'));
    const qid = box.dataset.qid;
    const hasAnswer = reveals.some((rv) => rv.dataset.kind === 'answer' || rv.dataset.kind === 'solution');
    const markable = !isExample && !isThink && !mcq && hasAnswer && qid;

    const bar = h('div', { class: 'pq-bar no-anchor' });
    if (mcq && box.classList.contains('multi')) own(box, '.mcq-opts')[0]?.before(h('div', { class: 'pq-note no-anchor' }, 'One or more options may be correct — pick all that apply, then Check.'));
    if (mcq && box.dataset.correct) bar.append(h('button', { type: 'button', 'data-act': 'check', class: 'pq-btn pq-check', hidden: !box.classList.contains('multi') }, 'Check'));
    reveals.forEach((rv, i) => bar.append(h('button', { type: 'button', class: 'pq-btn', 'data-rv': i }, SHOW[rv.dataset.kind] || 'Show')));
    if (markable) {
      bar.append(h('span', { class: 'pq-marks' },
        h('button', { type: 'button', class: 'pq-btn pq-right', 'data-mark': 'right', title: 'I got this right' }, '✓ Got it'),
        h('button', { type: 'button', class: 'pq-btn pq-wrong', 'data-mark': 'wrong', title: 'Mark for review' }, '✗ Review')));
    }
    if (mcq) bar.append(h('button', { type: 'button', class: 'pq-btn pq-reset', 'data-act': 'reset', hidden: true }, 'Try again'));
    if ((markable || mcq) && qid) bar.append(h('span', { class: 'pq-status' }));
    if (!isExample && !isThink && (hasAnswer || mcq) ) bar.append(h('button', { type: 'button', class: 'pq-btn pq-card', 'data-act': 'card', title: 'Make a flashcard from this question' }, '+ Card'));

    if (isThink) {
      const ta = h('textarea', { class: 'think-box no-anchor', rows: 2, placeholder: 'Jot down your thinking before reading the discussion… (saved to your notebook)' });
      ta.value = r.state.reflect[qid]?.text || '';
      (reveals[0] || null) ? reveals[0].before(ta) : box.append(ta);
    }
    if (bar.children.length) {
      const opts = own(box, '.mcq-opts')[0];
      if (reveals[0]) reveals[0].before(bar);
      else if (opts) opts.after(bar);
      else box.append(bar);
    }
    if (qid && !isExample) items.push({ qid, el: box, kind: isThink ? 'think' : mcq ? 'mcq' : 'q', set: box.dataset.set || (box.classList.contains('tb-question') ? 'check' : '') });
    paint(r, box);
  });

  // Fold the answer key.
  root.querySelectorAll('.answer-key').forEach((ak) => {
    ak.classList.add('ak-closed');
    ak.before(h('div', { class: 'ak-bar no-anchor' },
      h('span', {}, 'The answers are folded so you can try the problems first.'),
      h('button', { type: 'button', class: 'pq-btn', 'data-act': 'key' }, 'Show answer key')));
  });

  r.practiceItems = items;
}

// Reflect saved progress on a question.
function paint(r, box) {
  const qid = box.dataset.qid;
  const st = qid ? r.state.practice[qid] : null;
  const status = box.querySelector(':scope > .pq-bar .pq-status');
  box.classList.toggle('pq-done-right', st?.s === 'right');
  box.classList.toggle('pq-done-wrong', st?.s === 'wrong');
  if (status) status.textContent = st ? (st.s === 'right' ? '✓ Correct' : '✗ To review') : '';
  box.querySelectorAll(':scope > .pq-bar [data-mark]').forEach((b) => b.classList.toggle('on', st?.s === b.dataset.mark));
  if (!box.classList.contains('mcq')) return;
  const correct = (box.dataset.correct || '').split(',').filter(Boolean);
  const picked = st?.picked || [];
  const checked = !!st?.s;
  own(box, '.mcq-opts').forEach((list) => Array.from(list.children).forEach((o) => {
    const k = o.dataset.opt;
    o.classList.toggle('picked', picked.includes(k));
    o.classList.toggle('is-right', checked && correct.includes(k));
    o.classList.toggle('is-wrong', checked && picked.includes(k) && !correct.includes(k));
  }));
  box.classList.toggle('mcq-checked', checked);
  const reset = box.querySelector(':scope > .pq-bar [data-act="reset"]');
  if (reset) reset.hidden = !checked;
  const check = box.querySelector(':scope > .pq-bar [data-act="check"]');
  if (check) check.hidden = checked || !box.classList.contains('multi');
}

function save(r, box, data) {
  const qid = box.dataset.qid;
  if (!qid) return;
  if (data) r.state.practice[qid] = { ...data, ts: Date.now(), set: box.dataset.set || 'check', label: label(box) };
  else delete r.state.practice[qid];
  paint(r, box);
  r.commit();
  if (panels.current === 'toc' || panels.current === 'notebook') panels.refresh(r);
}

// "Objective I · 3" or the callout title.
export function label(box) {
  if (box.classList.contains('problem')) return `${SET_LABEL[box.dataset.set] || cap(box.dataset.set || 'Problem')} · ${box.dataset.num}`;
  return box.querySelector(':scope > .callout-title')?.textContent || 'Question';
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);


// The question without its answers, buttons and notes.
export function promptText(box, withOptions = true) {
  const c = box.cloneNode(true);
  c.querySelectorAll('.reveal, .pq-bar, .pq-note, .think-box, .callout-title, .checkpoint' + (withOptions ? '' : ', .mcq-opts')).forEach((x) => x.remove());
  c.querySelectorAll('.mcq-opts > li').forEach((li) => li.append('\n'));
  return texText(c).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}
function answerText(box) {
  if (box.classList.contains('mcq') && box.dataset.correct) {
    const opts = box.dataset.correct.split(',').map((k) => texText(box.querySelector(`.mcq-opts > li[data-opt="${k}"]`) || document.createElement('i')).trim()).filter(Boolean);
    if (opts.length) return opts.join('; ');
  }
  const rv = own(box, '.reveal-answer, .reveal-solution')[0];
  if (rv) { const c = rv.cloneNode(true); c.querySelector('.reveal-label')?.remove(); return texText(c).replace(/\s+/g, ' ').trim(); }
  const correct = (box.dataset.correct || '').split(',').filter(Boolean);
  if (correct.length) return correct.map((k) => texText(box.querySelector(`.mcq-opts > li[data-opt="${k}"]`)).trim()).join('; ');
  return '';
}

// Click handling inside the reader. Returns true when the click was ours.
export function onClick(r, e) {
  const t = e.target;
  const keyBtn = t.closest('[data-act="key"]');
  if (keyBtn) {
    const ak = keyBtn.closest('.ak-bar').nextElementSibling;
    const open = ak.classList.toggle('ak-closed') === false;
    keyBtn.textContent = open ? 'Hide answer key' : 'Show answer key';
    r.relayoutKeep();
    return true;
  }
  const box = t.closest(CONTAINERS);
  if (!box) return !!t.closest('.ak-bar');

  const rvBtn = t.closest('[data-rv]');
  if (rvBtn) {
    const rv = own(box, '.reveal')[+rvBtn.dataset.rv];
    if (!rv) return true;
    const opening = rv.classList.contains('rv-closed');
    rv.classList.toggle('rv-closed', !opening);
    rvBtn.textContent = (opening ? HIDE : SHOW)[rv.dataset.kind] || (opening ? 'Hide' : 'Show');
    rvBtn.classList.toggle('on', opening);
    if (opening && (rv.dataset.kind === 'answer' || rv.dataset.kind === 'solution')) box.classList.add('pq-revealed');
    r.relayoutKeep();
    return true;
  }
  const mark = t.closest('[data-mark]');
  if (mark) {
    const cur = r.state.practice[box.dataset.qid]?.s;
    save(r, box, cur === mark.dataset.mark ? null : { s: mark.dataset.mark });
    return true;
  }
  const act = t.closest('[data-act]')?.dataset.act;
  if (act === 'card') {
    study.editCard(r, { type: 'qa', front: promptText(box), back: answerText(box) || '(write the answer here)', src: { qid: box.dataset.qid, b: +(box.closest('[data-b]')?.dataset.b || 0) } });
    return true;
  }
  if (act === 'reset') { save(r, box, null); return true; }
  if (act === 'check') { check(r, box, Array.from(box.querySelectorAll(':scope > .mcq-opts > li.picked')).map((o) => o.dataset.opt)); return true; }

  const opt = t.closest('.mcq-opts > li[data-opt]');
  if (opt && box.classList.contains('mcq')) {
    if (box.classList.contains('mcq-checked')) return true;
    if (box.classList.contains('multi')) { opt.classList.toggle('picked'); return true; }
    check(r, box, [opt.dataset.opt]);
    return true;
  }
  if (t.closest('.pq-bar, .think-box, .mcq-opts')) return true;
  return false;
}

function check(r, box, picked) {
  const correct = (box.dataset.correct || '').split(',').filter(Boolean).sort();
  if (!picked.length) { toast('Pick at least one option'); return; }
  if (!correct.length) { // no answer key: just remember the choice
    own(box, '.mcq-opts').forEach((l) => Array.from(l.children).forEach((o) => o.classList.toggle('picked', picked.includes(o.dataset.opt))));
    toast('No answer key for this question');
    return;
  }
  const ok = picked.slice().sort().join(',') === correct.join(',');
  save(r, box, { s: ok ? 'right' : 'wrong', picked });
}

export const onInput = debounce((r, e) => {
  const ta = e.target;
  if (!ta.classList?.contains('think-box')) return;
  const box = ta.closest('.tb-think');
  const qid = box?.dataset.qid;
  if (!qid) return;
  const text = ta.value;
  if (text.trim()) r.state.reflect[qid] = { text, ts: Date.now(), q: promptText(box).slice(0, 240), title: label(box) };
  else delete r.state.reflect[qid];
  r.commit();
}, 500);

// Progress per chapter: Map(chapterId -> {total, done, right}) plus a total.
export function stats(r) {
  const by = new Map();
  const all = { total: 0, done: 0, right: 0, wrong: [] };
  for (const it of r.practiceItems || []) {
    if (it.kind === 'think') continue;
    const b = +(it.el.closest('[data-b]')?.dataset.b || 0);
    const ch = r.currentChapter(b);
    const key = ch?.id || '_doc';
    if (!by.has(key)) by.set(key, { total: 0, done: 0, right: 0 });
    const s = by.get(key);
    const st = r.state.practice[it.qid];
    s.total++; all.total++;
    if (st) { s.done++; all.done++; }
    if (st?.s === 'right') { s.right++; all.right++; }
    if (st?.s === 'wrong') all.wrong.push({ ...it, chapter: ch });
  }
  return { by, all };
}

// Keep button labels in step after something was opened programmatically.
export function syncButtons(r) {
  r.content.querySelectorAll('.ak-bar').forEach((bar) => {
    const btn = bar.querySelector('[data-act="key"]');
    if (btn) btn.textContent = bar.nextElementSibling?.classList.contains('ak-closed') ? 'Show answer key' : 'Hide answer key';
  });
  r.content.querySelectorAll(CONTAINERS).forEach((box) => {
    const reveals = own(box, '.reveal');
    box.querySelectorAll(':scope > .pq-bar [data-rv]').forEach((b) => {
      const rv = reveals[+b.dataset.rv];
      if (!rv) return;
      const open = !rv.classList.contains('rv-closed');
      b.textContent = (open ? HIDE : SHOW)[rv.dataset.kind] || (open ? 'Hide' : 'Show');
      b.classList.toggle('on', open);
    });
  });
}
