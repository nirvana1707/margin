// Navigation helpers: resolving link targets and turning plain-text references
// ("Section 3.4", "Example 3.2", "Quick check 3.1", "Chapter 4") into links —
// inside the document, or to another chapter file in the same folder.

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
const NUM_START = (num) => new RegExp(`^(?:(?:chapter|section|sec\\.?|§|unit|part)\\s*)?${num.replace(/\./g, '\\.')}(?![\\d.]\\d)`, 'i');

function headingText(el) {
  const c = el.cloneNode(true);
  c.querySelectorAll('.katex-mathml').forEach((m) => m.remove());
  return c.textContent.replace(/\s+/g, ' ').trim();
}

function headingsOf(root) {
  return Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter((h) => !h.closest('.answer-key'));
}

export function headingByNumber(root, num) {
  const re = NUM_START(num);
  return headingsOf(root).find((h) => re.test(headingText(h))) || null;
}

const KIND_RE = {
  example: /^(worked\s+)?example\s*/i,
  check: /^(quick\s+check|check|question|try\s+it)\s*/i,
  think: /^(food\s+for\s+thought|think)\s*/i,
};
export function calloutByLabel(root, kind, num) {
  const re = new RegExp(`${KIND_RE[kind].source}${num.replace(/\./g, '\\.')}(?![\\d.]\\d)`, 'i');
  for (const t of root.querySelectorAll('.tb > .callout-title')) {
    if (re.test(t.textContent.trim())) return t.parentElement;
  }
  return null;
}

export function chapterHeading(root, n) {
  const re = new RegExp(`^(chapter|ch\\.?|unit|part|lesson|module)\\s+${n}\\b`, 'i');
  return headingsOf(root).find((h) => re.test(headingText(h))) || null;
}

// Find the element an anchor points to. Accepts real ids, GitHub-style slugs
// ("#31-position-distance"), heading text, "#3.4", "#section-3.4",
// "#example-3.2", "#quick-check-3.1" and "#chapter-2".
export function resolveAnchor(root, key) {
  if (!key) return null;
  try { key = decodeURIComponent(key); } catch (e) { /* keep raw */ }
  key = key.replace(/^#/, '').trim();
  if (!key) return null;
  const byId = root.querySelector(`[id="${CSS.escape(key)}"]`) || root.querySelector(`[name="${CSS.escape(key)}"]`);
  if (byId) return byId;
  let m = key.match(/^(?:sec(?:tion)?[-_. ]?|§\s*)?(\d+(?:\.\d+)*)$/i);
  if (m) { const h = headingByNumber(root, m[1]); if (h) return h; }
  m = key.match(/^(example|ex|worked[-_ ]example|quick[-_ ]?check|check|question|think|food[-_ ]for[-_ ]thought)[-_. ]?(\d+(?:\.\d+)*)$/i);
  if (m) {
    const k = /^(ex|example|worked)/i.test(m[1]) ? 'example' : /think|food/i.test(m[1]) ? 'think' : 'check';
    const c = calloutByLabel(root, k, m[2]);
    if (c) return c;
  }
  m = key.match(/^(?:chapter|ch)[-_. ]?(\d+)$/i);
  if (m) { const h = chapterHeading(root, m[1]); if (h) return h; }
  const nk = norm(key);
  if (!nk) return null;
  const hs = headingsOf(root);
  return hs.find((h) => norm(h.id) === nk || norm(headingText(h)) === nk)
    || hs.find((h) => norm(headingText(h)).startsWith(nk) && nk.length >= 4)
    || null;
}

// ---------------------------------------------------------------- auto links
const SKIP = 'a, code, pre, .katex, h1, h2, h3, h4, h5, h6, .callout-title, .pq-bar, .checkpoint, .reveal-label, textarea, .mermaid, .ak-bar, .chapter-nav, .no-link, button';
const REF = /(\bSections?|\bSec\.|§|\bChapters?|\bCh\.|\bExamples?|\bEx\.|\bQuick\s+checks?)\s?(\d+(?:\.\d+)*)((?:(?:\s*,\s*|\s+(?:and|&|or|to)\s+|\s*[–-]\s*)\d+(?:\.\d+)*)*)/g;

function kindOf(word) {
  const w = word.toLowerCase();
  if (w.startsWith('ch')) return 'chapter';
  if (w.startsWith('ex')) return 'example';
  if (w.startsWith('quick')) return 'check';
  return 'section';
}

// resolve(kind, num) -> { href, anchor? } or null. Returns number of links made.
export function linkify(root, resolve) {
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.data || !/\d/.test(n.data)) return NodeFilter.FILTER_REJECT;
      return n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
  let made = 0;
  for (const node of nodes) {
    const text = node.data;
    REF.lastIndex = 0;
    const pieces = [];
    let last = 0, m;
    while ((m = REF.exec(text))) {
      const kind = kindOf(m[1]);
      // "Section 3.4" (whole phrase) + each further number in "Sections 3.1 and 3.2"
      const first = resolve(kind, m[2]);
      const extra = [];
      const phraseEnd = m.index + m[0].length - m[3].length; // end of "Section 3.4"
      if (m[3]) {
        const re = /\d+(?:\.\d+)*/g;
        let k;
        while ((k = re.exec(m[3]))) extra.push({ start: phraseEnd + k.index, num: k[0], target: resolve(kind, k[0]) });
      }
      if (!first && !extra.some((x) => x.target)) continue;
      if (m.index > last) pieces.push(text.slice(last, m.index));
      pieces.push(first ? link(text.slice(m.index, phraseEnd), first, kind) : text.slice(m.index, phraseEnd));
      let pos = phraseEnd;
      for (const x of extra) {
        if (x.start > pos) pieces.push(text.slice(pos, x.start));
        pieces.push(x.target ? link(x.num, x.target, kind) : x.num);
        pos = x.start + x.num.length;
      }
      last = pos;
      made += (first ? 1 : 0) + extra.filter((x) => x.target).length;
    }
    if (!pieces.length) continue;
    if (last < text.length) pieces.push(text.slice(last));
    node.replaceWith(...pieces);
  }
  return made;
}

function link(text, target, kind) {
  const a = document.createElement('a');
  a.className = `xref xref-${kind}${target.external ? ' xref-ext' : ''}`;
  a.href = target.href;
  if (target.anchor) a.dataset.anchor = target.anchor;
  if (target.title) a.title = target.title;
  a.textContent = text;
  return a;
}

// Default resolver for one document, optionally aware of sibling chapter files.
export function makeResolver(root, { chapterNo = 0, siblings = [], selfId = '' } = {}) {
  const idOf = (el) => {
    if (!el.id) el.id = 'x-' + Math.random().toString(36).slice(2, 9);
    return el.id;
  };
  const sib = (n) => siblings.find((s) => s.chapter === +n && s.id !== selfId);
  const readHref = (s, anchor) => `#/read/${encodeURIComponent(s.id)}${anchor ? '/' + encodeURIComponent(anchor) : ''}`;
  return (kind, num) => {
    const chap = +String(num).split('.')[0];
    if (kind === 'chapter') {
      if (+num === chapterNo) return null; // "this chapter"
      const h = chapterHeading(root, num);
      if (h) return { href: '#' + idOf(h), anchor: h.id, title: headingText(h) };
      const s = sib(num);
      return s ? { href: readHref(s), external: true, title: s.title } : null;
    }
    if (kind === 'section') {
      if (!String(num).includes('.') && !chapterNo) {
        const h = headingByNumber(root, num);
        return h ? { href: '#' + idOf(h), anchor: h.id, title: headingText(h) } : null;
      }
      const inDoc = chap === chapterNo || !chapterNo || !sib(chap) ? headingByNumber(root, num) : null;
      if (inDoc) return { href: '#' + idOf(inDoc), anchor: inDoc.id, title: headingText(inDoc) };
      const s = sib(chap);
      if (s && s.headings?.some((h) => NUM_START(String(num)).test(h.text))) {
        const h = s.headings.find((x) => NUM_START(String(num)).test(x.text));
        return { href: readHref(s, num), external: true, title: `${s.title} › ${h.text}` };
      }
      return null;
    }
    // example / quick check
    const local = chap === chapterNo || !chapterNo || !sib(chap) ? calloutByLabel(root, kind, String(num)) : null;
    if (local) return { href: '#' + idOf(local), anchor: local.id, title: local.querySelector('.callout-title')?.textContent };
    const s = sib(chap);
    if (s) return { href: readHref(s, `${kind === 'example' ? 'example' : 'quick-check'}-${num}`), external: true, title: `${s.title} › ${kind === 'example' ? 'Example' : 'Quick check'} ${num}` };
    return null;
  };
}

// The chapter number of the open document (same rules as the server).
export function docChapterNo(book, headings, siblings) {
  const me = siblings?.find((s) => s.id === book.id);
  if (me?.chapter) return me.chapter;
  const base = (book.rel || '').split('/').pop();
  let m = base.match(/^(\d{1,3})(?:[-_. ]|$)/);
  if (m) return +m[1];
  m = (book.title || '').match(/^(?:chapter|ch\.?|unit|lesson|part|module)\s+(\d{1,3})\b/i) || (book.title || '').match(/^(\d{1,3})\s*[.:·\-–—]\s*\D/);
  if (m) return +m[1];
  const counts = {};
  headings.forEach((h) => { const k = h.text.match(/^(\d{1,3})\.\d/); if (k) counts[k[1]] = (counts[k[1]] || 0) + 1; });
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 2 ? +best[0] : 0;
}
