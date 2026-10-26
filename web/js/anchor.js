// Text-position anchoring for highlights and search.
//
// The rendered article is flattened into one string of its readable text
// (math, diagrams and UI widgets excluded). Highlights are stored as a quote
// with a little surrounding context, so they re-attach correctly after the
// file is edited, re-rendered or re-flowed.

const SKIP = '.no-anchor, .katex, .mermaid svg, .checkpoint, script, style, eqn, eq';
const BAD_PARENTS = /^(TABLE|THEAD|TBODY|TFOOT|TR|UL|OL|DL|COLGROUP)$/;

export function buildIndex(root) {
  const nodes = [], starts = [];
  let text = '';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p || p.closest(SKIP)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    nodes.push(n);
    starts.push(text.length);
    text += n.data;
  }
  return { root, text, nodes, starts };
}

// Offset in index.text of a DOM boundary point.
export function offsetOf(idx, container, offset) {
  if (container.nodeType === Node.TEXT_NODE) {
    const i = idx.nodes.indexOf(container);
    if (i >= 0) return idx.starts[i] + Math.min(offset, container.data.length);
  }
  // Binary search: first indexed text node that starts at/after the point.
  const r = document.createRange();
  try { r.setStart(container, offset); } catch (e) { return idx.text.length; }
  r.collapse(true);
  let lo = 0, hi = idx.nodes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    let cmp;
    try { cmp = r.comparePoint(idx.nodes[mid], 0); } catch (e) { cmp = 1; }
    if (cmp >= 0) hi = mid; else lo = mid + 1;
  }
  if (lo > 0 && container.nodeType === Node.TEXT_NODE) {
    // point inside an excluded text node: snap to the end of the previous text
    const prev = idx.nodes[lo - 1];
    if (prev && r.comparePoint(prev, prev.data.length) < 0) return idx.starts[lo - 1] + prev.data.length;
  }
  return lo < idx.nodes.length ? idx.starts[lo] : idx.text.length;
}

export function rangeToQuote(idx, range) {
  let s = offsetOf(idx, range.startContainer, range.startOffset);
  let e = offsetOf(idx, range.endContainer, range.endOffset);
  if (e < s) [s, e] = [e, s];
  while (s < e && /\s/.test(idx.text[s])) s++;
  while (e > s && /\s/.test(idx.text[e - 1])) e--;
  if (e - s < 1) return null;
  return {
    exact: idx.text.slice(s, e),
    prefix: idx.text.slice(Math.max(0, s - 48), s),
    suffix: idx.text.slice(e, e + 48),
    pos: s,
  };
}

function commonSuffix(a, b) { let n = 0; while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++; return n; }
function commonPrefix(a, b) { let n = 0; while (n < a.length && n < b.length && a[n] === b[n]) n++; return n; }

// Find where a stored quote lives now. Returns [start, end] or null.
export function locate(idx, q) {
  if (!q?.exact) return null;
  const t = idx.text;
  let best = null, bestScore = -Infinity;
  for (let i = t.indexOf(q.exact); i !== -1; i = t.indexOf(q.exact, i + 1)) {
    const score = commonSuffix(q.prefix || '', t.slice(Math.max(0, i - 48), i)) * 2
      + commonPrefix(q.suffix || '', t.slice(i + q.exact.length, i + q.exact.length + 48)) * 2
      - Math.abs(i - (q.pos || 0)) / 5000;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  if (best != null) return [best, best + q.exact.length];
  // Tolerate whitespace changes (re-wrapped paragraphs).
  const norm = q.exact.replace(/\s+/g, ' ').trim();
  if (norm.length > 8) {
    const re = new RegExp(norm.split(' ').map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'));
    const m = re.exec(t);
    if (m) return [m.index, m.index + m[0].length];
  }
  return null;
}

// Wrap [s, e) in elements created by make(). Returns the created elements.
export function wrapRange(idx, s, e, make) {
  const out = [];
  const jobs = [];
  for (let i = 0; i < idx.nodes.length; i++) {
    const ns = idx.starts[i], node = idx.nodes[i], ne = ns + node.data.length;
    if (ne <= s) continue;
    if (ns >= e) break;
    jobs.push([node, Math.max(s, ns) - ns, Math.min(e, ne) - ns]);
  }
  for (const [node, a, b] of jobs) {
    if (BAD_PARENTS.test(node.parentNode?.nodeName || '')) continue;
    let target = node;
    if (a > 0) target = target.splitText(a);
    if (b - a < target.data.length) target.splitText(b - a);
    if (!target.data.trim() && target.data.length < 3) continue;
    const el = make();
    target.parentNode.insertBefore(el, target);
    el.append(target);
    out.push(el);
  }
  return out;
}

export function unwrap(els) {
  for (const el of els) {
    const p = el.parentNode;
    if (!p) continue;
    while (el.firstChild) p.insertBefore(el.firstChild, el);
    el.remove();
    p.normalize();
  }
}

// The sentence around [s, e) — used to build cloze cards.
export function sentenceAround(text, s, e) {
  const lim = 400;
  let a = s, b = e;
  while (a > 0 && s - a < lim) {
    const c = text[a - 1];
    if (c === '\n' || ((c === ' ') && /[.!?]/.test(text[a - 2] || '') && !/\d/.test(text[a - 3] || ''))) break;
    a--;
  }
  while (b < text.length && b - e < lim) {
    const c = text[b];
    if (c === '\n') break;
    if (/[.!?]/.test(c) && (b + 1 >= text.length || /\s/.test(text[b + 1]))) { b++; break; }
    b++;
  }
  return { text: text.slice(a, b).trim(), start: a, end: b };
}
