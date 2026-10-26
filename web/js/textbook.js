// Textbook structures in Markdown (H. C. Verma–style practice books):
//
//   > [!EXAMPLE] Example 3.2 — title      worked example, "**Solution:**" part folds away
//   > [!QUESTION] Quick check 3.1          in-text question with "**Hint:**" / "**Answer:**"
//   > [!THINK] Food for thought            open question, optional "**Discussion:**"
//
//   ## Questions for Short Answer / Objective I / Objective II / Exercises
//   1. Problem …                           numbered problems; MCQ options as "- (a) …" sub-list
//   ## Answer Key                          "### Objective I" + "1. (b)" … linked to the problems
//
// This module only restructures the DOM and tags it; the reader adds the buttons.

const BLOCK = /^(P|UL|OL|DIV|PRE|BLOCKQUOTE|TABLE|FIGURE|SECTION|H[1-6]|DL|DETAILS|HR|IMG)$/;
const MARK = /^(solution|answer|ans|hint|discussion|explanation|working)\s*[:.：]?$/i;
const LABEL = { solution: 'Solution', answer: 'Answer', hint: 'Hint', discussion: 'Discussion' };

export const TB_CALLOUTS = {
  example: 'example', 'worked-example': 'example', solved: 'example',
  question: 'question', check: 'question', quiz: 'question', try: 'question', 'try-it': 'question', exercise: 'question',
  think: 'think', reflect: 'think', ponder: 'think', thought: 'think', 'food-for-thought': 'think',
};
export const TB_TITLES = { example: 'Worked example', question: 'Quick check', think: 'Food for thought' };

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
function textOf(node) {
  if (!node) return '';
  if (node.querySelector?.('.katex-mathml')) {
    const c = node.cloneNode(true);
    c.querySelectorAll('.katex-mathml').forEach((m) => m.remove());
    return c.textContent;
  }
  return node.textContent;
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

// ---------------------------------------------------------------- headings
function bareHeading(text) {
  return clean(text)
    .replace(/^(chapter\s+)?[\dIVXivx]+(\.\d+)*[.):]?\s+(?=\D)/, '')   // "3.6 ", "IV. "
    .replace(/^[A-Z][.)]\s+/, '')                                       // "A. "
    .replace(/\s*[:：]\s*$/, '')
    .replace(/\s*\([^)]*\)\s*$/, '')                                    // "(one or more correct)"
    .replace(/\s*[-–—]\s*(single|one or more|multiple).*$/i, '');
}
const PSET = /^(questions?\s+for\s+short\s+answers?|short[-\s]?answer(\s+questions?)?|very\s+short[-\s]?answer(\s+questions?)?|long[-\s]?answer(\s+questions?)?|objective(\s*[-–—:]?\s*(i{1,2}|[12]|type))?(\s+questions?)?|multiple[-\s]choice(\s+questions?)?|mcqs?|exercises?|problems?|numerical\s+problems?|practice\s+(problems?|questions?|exercises?|set)|review\s+questions?|(end[-\s]of[-\s]chapter\s+)?(questions|problems|exercises)|test\s+yourself|self[-\s]?test|assertion[-\s]reason(\s+questions?)?)$/i;
const KEY = /^(answers?|answer\s+key|answers?\s+(to|for)\s+.+|solutions?\s+(to|for)\s+.+|hints?\s+(and|&)\s+solutions?|answers?\s+(and|&)\s+(solutions?|hints?))$/i;
const EXAMPLES = /^(worked[-\s]*(out\s+)?examples?|solved\s+(examples?|problems?)|illustrative\s+examples?)$/i;

export function classifyHeading(text) {
  const t = bareHeading(text);
  if (KEY.test(t)) return 'key';
  if (EXAMPLES.test(t)) return 'examples';
  if (PSET.test(t)) return 'pset';
  return null;
}

export function setName(text) {
  const t = bareHeading(text).toLowerCase();
  if (/very\s+short/.test(t)) return 'vshort';
  if (/long[-\s]?answer/.test(t)) return 'long';
  if (/short[-\s]?answer/.test(t)) return 'short';
  if (/objective.*\b(ii|2)\b|one or more|multiple correct|more than one/.test(t)) return 'obj2';
  if (/objective|single correct|mcq|multiple[-\s]choice/.test(t)) return 'obj1';
  if (/assertion/.test(t)) return 'ar';
  if (/exercise|numerical|problem/.test(t)) return 'ex';
  return t;
}

export const SET_LABEL = { vshort: 'Very short answer', short: 'Short answer', long: 'Long answer', obj1: 'Objective I', obj2: 'Objective II', ar: 'Assertion–reason', ex: 'Exercises' };

// Same rule the reader uses: the top heading level that occurs at least twice.
export function chapterLevelOf(levels) {
  const c = {};
  levels.forEach((l) => (c[l] = (c[l] || 0) + 1));
  return [1, 2, 3, 4].find((l) => c[l] >= 2) || [1, 2, 3].find((l) => c[l]) || 0;
}

// ---------------------------------------------------------------- reveals
function isMarker(n) { return n && n.nodeType === 1 && (n.tagName === 'STRONG' || n.tagName === 'B') && MARK.test(clean(n.textContent)); }
function markKind(t) {
  const k = clean(t).replace(/[:.：]$/, '').toLowerCase();
  if (k.startsWith('sol') || k === 'working') return 'solution';
  if (k.startsWith('ans') || k === 'explanation') return 'answer';
  return k;
}
function atLineStart(n) {
  let p = n.previousSibling;
  while (p && p.nodeType === 3 && !p.data.trim() && !p.data.includes('\n')) p = p.previousSibling;
  return !p || (p.nodeType === 1 && p.tagName === 'BR') || (p.nodeType === 3 && /\n\s*$/.test(p.data));
}

// Wrap loose inline content of a tight list item in <p> so it can be split.
function normalizeItem(li) {
  let run = null;
  for (const n of Array.from(li.childNodes)) {
    const block = n.nodeType === 1 && (BLOCK.test(n.tagName) || n.classList.contains('code') || n.classList.contains('table-wrap'));
    if (block) { run = null; continue; }
    if (!run) {
      if (n.nodeType === 3 && !n.data.trim()) continue;
      run = document.createElement('p');
      run.className = 'tight';
      n.before(run);
    }
    run.append(n);
  }
}

// Split paragraphs so every "**Answer:**"-style label starts its own paragraph.
function splitParagraphs(container) {
  for (const p of Array.from(container.children)) {
    if (p.tagName !== 'P') continue;
    let cur = p;
    for (;;) {
      const kids = Array.from(cur.childNodes);
      const at = kids.findIndex((n, i) => i > 0 && isMarker(n) && atLineStart(n) && kids.slice(0, i).some((x) => x.nodeType === 1 || x.data.trim()));
      if (at < 0) break;
      const np = document.createElement('p');
      if (cur.classList.contains('tight')) np.className = 'tight';
      kids.slice(at).forEach((n) => np.append(n));
      while (cur.lastChild && ((cur.lastChild.nodeType === 3 && !cur.lastChild.data.trim()) || cur.lastChild.tagName === 'BR')) cur.lastChild.remove();
      if (cur.lastChild?.nodeType === 3) cur.lastChild.data = cur.lastChild.data.replace(/\s+$/, '');
      cur.after(np);
      cur = np;
    }
  }
}

function firstMeaningful(p) {
  for (const n of p.childNodes) { if (n.nodeType === 3 && !n.data.trim()) continue; return n; }
  return null;
}

// Group everything after a label paragraph into <div class="reveal reveal-KIND">.
export function makeReveals(container) {
  splitParagraphs(container);
  const reveals = [];
  let cur = null;
  for (const k of Array.from(container.children)) {
    if (k.classList.contains('callout-title')) continue;
    const first = k.tagName === 'P' ? firstMeaningful(k) : null;
    if (first && isMarker(first)) {
      const kind = markKind(first.textContent);
      cur = document.createElement('div');
      cur.className = `reveal reveal-${kind}`;
      cur.dataset.kind = kind;
      const label = document.createElement('div');
      label.className = 'reveal-label no-anchor';
      label.textContent = LABEL[kind] || kind;
      cur.append(label);
      k.before(cur);
      first.remove();
      const t = firstMeaningful(k);
      if (t?.nodeType === 3) t.data = t.data.replace(/^\s*[:：.]?\s*/, '');
      else if (t?.tagName === 'BR') t.remove();
      if (k.textContent.trim() || k.querySelector('img,.katex,eq,svg')) cur.append(k); else k.remove();
      reveals.push(cur);
      continue;
    }
    if (cur) cur.append(k);
  }
  return reveals;
}

// ---------------------------------------------------------------- MCQ helpers
const OPT = /^\s*\(?([a-hA-H])[).:]\s+/;
function optionList(li) {
  for (const l of li.children) {
    if (l.tagName !== 'UL' && l.tagName !== 'OL') continue;
    const items = Array.from(l.children).filter((x) => x.tagName === 'LI');
    if (items.length < 2) continue;
    if (items.every((x) => OPT.test(textOf(x)))) return { list: l, items, task: false };
    if (items.every((x) => x.classList.contains('task-list-item'))) return { list: l, items, task: true };
  }
  return null;
}
export function parseLetters(text) {
  const t = clean(text);
  const paren = [...t.matchAll(/\(([a-h])\)/gi)].map((m) => m[1].toLowerCase());
  if (paren.length) return [...new Set(paren)].sort();
  const m = t.match(/^\s*(?:option[s]?\s+)?([a-h])((?:\s*(?:,|and|&|\/)\s*[a-h])*)\s*[.)]?(\s|$)/i);
  if (m) return [...new Set((m[1] + m[2]).toLowerCase().match(/[a-h]/g))].sort();
  return [];
}

// ---------------------------------------------------------------- main pass
export function structureTextbook(frag) {
  const kids = Array.from(frag.children);
  const headingLevels = kids.filter((k) => /^H[1-6]$/.test(k.tagName)).map((k) => +k.tagName[1]);
  if (!headingLevels.length) return { found: false };
  const stack = []; // [{el, level, cls, text}]
  const keyGroups = new Map(); // scopeId -> Map(groupName -> Map(num -> li))
  const psets = [];            // {scopeId, name, li, num}
  const keyRegions = [];       // {heading, blocks: []}
  let found = false;

  const scopeOf = (entry) => {
    const i = stack.indexOf(entry);
    return i > 0 ? stack[i - 1].el.id : '_doc';
  };

  for (const el of kids) {
    if (/^H[1-6]$/.test(el.tagName)) {
      const level = +el.tagName[1];
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      const entry = { el, level, cls: classifyHeading(textOf(el)), text: clean(textOf(el)) };
      const parentKey = stack.find((s) => s.cls === 'key');
      stack.push(entry);
      if (parentKey) {
        // a sub-heading of the answer key ("### Objective I") names an answer group
        entry.cls = null;
        el.classList.add('tb-h-keysub');
        keyRegions.find((r) => r.entry === parentKey)?.blocks.push(el);
        continue;
      }
      if (entry.cls === 'key') { keyRegions.push({ heading: el, entry, blocks: [] }); found = true; }
      if (entry.cls) { el.classList.add(`tb-h-${entry.cls}`); found = true; }
      continue;
    }
    const classified = stack.filter((s) => s.cls);
    if (!classified.length) continue;
    const top = classified[0];
    const keyEntry = classified.find((s) => s.cls === 'key');

    if (keyEntry) {
      const region = keyRegions.find((r) => r.entry === keyEntry);
      region?.blocks.push(el);
      const below = stack.slice(stack.indexOf(keyEntry) + 1);
      const group = below.length ? setName(below[below.length - 1].text) : '';
      const scope = scopeOf(keyEntry);
      if (el.tagName === 'OL' || el.tagName === 'UL') {
        if (!keyGroups.has(scope)) keyGroups.set(scope, new Map());
        const g = keyGroups.get(scope);
        if (!g.has(group)) g.set(group, new Map());
        const start = +(el.getAttribute('start') || 1);
        Array.from(el.children).filter((x) => x.tagName === 'LI').forEach((li, i) => {
          li.classList.add('key-item');
          g.get(group).set(start + i, li);
        });
      }
      continue;
    }

    if (top.cls === 'examples' && (el.tagName === 'OL' || el.tagName === 'UL')) {
      Array.from(el.children).filter((x) => x.tagName === 'LI').forEach((li) => {
        normalizeItem(li);
        if (makeReveals(li).length) li.classList.add('worked');
      });
      continue;
    }

    if (top.cls === 'pset' && (el.tagName === 'OL' || el.tagName === 'UL')) {
      const psetEntry = classified.filter((s) => s.cls === 'pset').pop();
      const name = setName(psetEntry.text);
      const scope = scopeOf(top);
      el.classList.add('problems');
      el.dataset.set = name;
      const start = +(el.getAttribute('start') || 1);
      Array.from(el.children).filter((x) => x.tagName === 'LI').forEach((li, i) => {
        normalizeItem(li);
        const num = el.tagName === 'OL' ? start + i : i + 1;
        li.classList.add('problem');
        li.dataset.set = name;
        li.dataset.num = num;
        const opts = optionList(li);
        let taskCorrect = null;
        if (opts) {
          li.classList.add('mcq');
          opts.list.classList.add('mcq-opts');
          taskCorrect = [];
          opts.items.forEach((o, k) => {
            const letter = opts.task ? 'abcdefgh'[k] : textOf(o).match(OPT)[1].toLowerCase();
            o.dataset.opt = letter;
            if (opts.task) {
              const box = o.querySelector('input');
              if (box?.checked || box?.hasAttribute('checked')) taskCorrect.push(letter);
              box?.remove();
              o.classList.remove('task-list-item');
              o.prepend(document.createTextNode(`(${letter}) `));
            }
          });
          opts.list.classList.remove('contains-task-list');
          if (name === 'obj2') li.classList.add('multi');
        }
        const reveals = makeReveals(li);
        const inlineAns = reveals.find((r) => r.dataset.kind === 'answer' || r.dataset.kind === 'solution');
        let correct = taskCorrect && taskCorrect.length ? taskCorrect : [];
        if (opts && !correct.length && inlineAns) correct = parseLetters(textOf(inlineAns).replace(/^(answer|solution)/i, ''));
        if (opts && correct.length) li.dataset.correct = correct.join(',');
        if (opts && correct.length > 1) li.classList.add('multi');
        const promptText = clean(Array.from(li.childNodes).filter((n) => !(n.nodeType === 1 && n.classList.contains('reveal'))).map(textOf).join(' '));
        li.dataset.qid = 'p' + hashStr(`${scope}|${name}|${promptText.slice(0, 200)}`);
        psets.push({ scope, name, li, num, hasAnswer: !!inlineAns, mcq: !!opts });
        found = true;
      });
    }
  }

  // Link problems to the answer key of their scope.
  let aid = 0;
  for (const p of psets) {
    const groups = keyGroups.get(p.scope);
    if (!groups) continue;
    const sameScope = psets.filter((x) => x.scope === p.scope);
    const names = new Set(sameScope.map((x) => x.name));
    let ans = groups.get(p.name)?.get(p.num);
    if (!ans && groups.has('') && (names.size === 1 || !groups.has(p.name))) ans = groups.get('').get(p.num);
    if (!ans) continue;
    if (!ans.dataset.aid) ans.dataset.aid = 'a' + (++aid);
    p.li.dataset.aref = ans.dataset.aid;
    if (p.mcq && !p.li.dataset.correct) {
      const letters = parseLetters(textOf(ans));
      if (letters.length) {
        p.li.dataset.correct = letters.join(',');
        if (letters.length > 1) p.li.classList.add('multi');
      }
    }
  }

  // The answer key folds away in the reader (its heading stays in the contents).
  for (const r of keyRegions) {
    if (!r.blocks.length) continue;
    const box = document.createElement('div');
    box.className = 'answer-key';
    r.heading.after(box);
    r.blocks.forEach((b) => box.append(b));
  }

  return { found, problems: psets.length };
}

// Callout questions get stable ids too (used for progress and reflections).
export function tagCallout(div, kind) {
  div.classList.add('tb', `tb-${kind}`);
  const reveals = makeReveals(div);
  if (kind !== 'example') {
    const prompt = clean(Array.from(div.children).filter((c) => !c.classList.contains('reveal') && !c.classList.contains('callout-title')).map(textOf).join(' '));
    div.dataset.qid = (kind === 'think' ? 't' : 'q') + hashStr(prompt.slice(0, 200));
  }
  return reveals;
}
