// Markdown → reader DOM, tuned for LLM-generated Markdown.
/* global markdownit, markdownitFootnote, markdownitTaskLists, texmath, katex, hljs, DOMPurify, mermaid */
import { esc, slug, icon } from './util.js';
import { api } from './api.js';
import { TB_CALLOUTS, TB_TITLES, tagCallout, structureTextbook } from './textbook.js';

let md;
function engine() {
  if (md) return md;
  md = markdownit({ html: true, linkify: true, typographer: true, breaks: false });
  // Typographer's (c)/(r)/(tm) → ©/®/™ replacement would break multiple-choice options like "(c)".
  md.disable('replacements');
  md.use(markdownitFootnote);
  md.use(markdownitTaskLists, { enabled: false, label: true });
  md.use(texmath, { engine: katex, delimiters: ['dollars', 'brackets', 'beg_end'], katexOptions: { throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' } });
  md.renderer.rules.hr = () => '<div class="sep" role="separator"></div>\n';
  md.renderer.rules.fence = (tokens, idx) => {
    const t = tokens[idx];
    const lang = (t.info || '').trim().split(/\s+/)[0].toLowerCase();
    const code = t.content.replace(/\n$/, '');
    if (lang === 'mermaid') {
      return `<figure class="mermaid pending"><pre><code>${esc(code)}</code></pre></figure>\n`;
    }
    if (lang === 'math' || lang === 'latex' && /^\s*\\begin|\\frac|\^|_/.test(code) && code.length < 2000 && !/\\documentclass/.test(code)) {
      try { return `<div class="math-block">${katex.renderToString(code, { displayMode: true, throwOnError: false })}</div>\n`; } catch (e) { /* fall through */ }
    }
    let html;
    const known = lang && hljs.getLanguage(lang);
    try {
      if (known) html = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      else if (!lang && code.length < 6000 && code.split('\n').length > 1) html = hljs.highlightAuto(code).value;
    } catch (e) { /* plain */ }
    if (html == null) html = esc(code);
    const label = lang || 'text';
    return `<div class="code"><div class="code-head no-anchor"><span>${esc(label)}</span><button class="copy" type="button" title="Copy code">${icon('copy')}<span>Copy</span></button></div><pre><code class="hljs${lang ? ' language-' + esc(lang) : ''}">${html}</code></pre></div>\n`;
  };
  return md;
}

// ---------------------------------------------------------------------------
// Source clean-up

export function preprocess(src, opts = {}) {
  src = src.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  let frontmatter = null;
  const fm = src.match(/^---\n([\s\S]{0,8000}?)\n---[ \t]*\n/);
  if (fm) { frontmatter = fm[1]; src = src.slice(fm[0].length); }

  // Whole answer wrapped in ```markdown … ``` (very common when copying from chat UIs).
  const wrap = src.match(/^\s*(`{3,}|~{3,})[ \t]*(markdown|md|gfm)[ \t]*\n([\s\S]*?)\n[ \t]*\1[ \t]*\s*$/i);
  if (wrap) src = wrap[3];
  else {
    const open = src.match(/^\s*(`{3,}|~{3,})[ \t]*(markdown|md)[ \t]*\n/i); // truncated answer, never closed
    if (open && !new RegExp('\\n' + open[1] + '\\s*$').test(src) && src.split(open[1]).length === 2) src = src.slice(open[0].length);
  }

  if (opts.hideCitations) {
    src = src
      .replace(/【[^】\n]{0,120}】/g, '')                                  // 【4:0†source】
      .replace(/\[cite(?:_start|_end)?(?::\s*[^\]\n]{0,120})?\]/gi, '')  // [cite: 1, 2]
      .replace(/cite[^]*/g, '')                   // private-use citation runs
      .replace(/[-]/g, '');
  }
  // LLMs often put display math delimiters inside a paragraph on their own lines; give them room.
  src = src.replace(/([^\n])\n(\s*)\\\[\s*\n/g, '$1\n\n$2\\[\n').replace(/\n(\s*)\\\]\s*\n(?=\S)/g, '\n$1\\]\n\n');

  return { src, frontmatter };
}

// ---------------------------------------------------------------------------
// Render

const CALLOUTS = { note: 'Note', tip: 'Tip', important: 'Important', warning: 'Warning', caution: 'Caution', info: 'Note', success: 'Tip', danger: 'Caution', example: 'Example', question: 'Question', quote: 'Quote', abstract: 'Summary', summary: 'Summary', todo: 'To do' };

export function renderMarkdown(source, { bookId, rel, hideCitations = true } = {}) {
  const { src } = preprocess(source, { hideCitations });
  const raw = engine().render(src);
  const clean = DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true, svg: true, mathMl: true },
    ADD_TAGS: ['eq', 'eqn', 'semantics', 'annotation', 'figure'],
    ADD_ATTR: ['data-src', 'target', 'encoding', 'aria-hidden'],
    FORBID_TAGS: ['style', 'form'],
  });
  const tpl = document.createElement('template');
  tpl.innerHTML = clean;
  const frag = tpl.content;

  // Tables scroll horizontally inside their own box.
  frag.querySelectorAll('table').forEach((t) => {
    if (t.parentElement?.classList.contains('table-wrap')) return;
    const w = document.createElement('div');
    w.className = 'table-wrap';
    t.replaceWith(w);
    w.append(t);
  });

  // GitHub / Obsidian style callouts: > [!NOTE] Title
  frag.querySelectorAll('blockquote').forEach((bq) => {
    const p = bq.firstElementChild;
    if (!p || p.tagName !== 'P') return;
    const m = p.innerHTML.match(/^\s*\[!(\w+)\][+-]?[ \t]*([^\n<]*)(?:<br>\n?|\n)?/i);
    if (!m) return;
    const kind = m[1].toLowerCase();
    const tb = TB_CALLOUTS[kind];
    const cls = tb || { info: 'note', success: 'tip', danger: 'caution', example: 'note', question: 'important', quote: 'note', abstract: 'note', summary: 'note', todo: 'note' }[kind] || kind;
    p.innerHTML = p.innerHTML.slice(m[0].length);
    if (!p.textContent.trim() && !p.querySelector('img')) p.remove();
    const div = document.createElement('div');
    div.className = `callout callout-${cls}`;
    const title = document.createElement('div');
    title.className = 'callout-title';
    title.textContent = m[2].trim() || (tb && TB_TITLES[tb]) || CALLOUTS[kind] || kind;
    div.append(title, ...bq.childNodes);
    bq.replaceWith(div);
    if (tb) tagCallout(div, tb);
  });

  // Links & images
  frag.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    } else if (href.startsWith('#')) {
      a.dataset.anchor = decodeURIComponent(href.slice(1));
    } else if (bookId) {
      const [p, hash] = href.split('#');
      if (/\.(md|markdown|mdown|mkd|mdx)$/i.test(p)) {
        const root = bookId.slice(0, bookId.indexOf(':'));
        const target = joinRel(rel, decodeURIComponent(p));
        if (target) a.setAttribute('href', `#/read/${encodeURIComponent(root + ':' + target)}${hash ? '/' + encodeURIComponent(hash) : ''}`);
      }
    }
  });
  frag.querySelectorAll('img[src]').forEach((img) => {
    const s = img.getAttribute('src');
    if (bookId && !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(s)) img.src = api.assetURL(bookId, decodeURIComponent(s));
    img.decoding = 'async';
    if (!img.alt) img.alt = '';
  });

  // Headings get stable ids; collect the outline.
  const used = new Set();
  const headings = [];
  frag.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((hEl) => {
    const text = visibleText(hEl).trim();
    hEl.id = slug(text, used);
    headings.push({ el: hEl, level: +hEl.tagName[1], text, id: hEl.id });
  });

  // Textbook structures: problem sets, multiple choice, answer keys.
  const textbook = structureTextbook(frag);

  // Number top-level blocks — these are our position anchors.
  const blocks = [];
  let bi = 0;
  for (const el of Array.from(frag.children)) {
    el.dataset.b = bi++;
    blocks.push(el);
  }
  return { frag, headings, blocks, textbook };
}

function joinRel(base, rel) {
  if (rel.startsWith('/')) rel = rel.slice(1);
  const parts = (base || '').split('/');
  parts.pop();
  for (const p of rel.split('/')) {
    if (p === '' || p === '.') continue;
    if (p === '..') { if (!parts.length) return null; parts.pop(); } else parts.push(p);
  }
  return parts.join('/');
}

// ---------------------------------------------------------------------------
// Key concepts: LLMs put the important terms in **bold**, usually as
// "**Term** — definition" / "**Term:** definition" list items.

export function extractConcepts(root) {
  const out = new Map();
  root.querySelectorAll('strong, b').forEach((st) => {
    if (st.closest('h1,h2,h3,h4,h5,h6,th,.checkpoint,.callout-title,.code,a,.tb,.problem,.worked,.answer-key,.reveal')) return;
    let term = visibleText(st).replace(/\s+/g, ' ').trim().replace(/[:：—–\-.,;]+$/, '').trim();
    if (term.length < 2 || term.length > 70 || term.split(' ').length > 8) return;
    if (/^(note|tip|warning|important|example|answer|solution|hint|discussion|given|find|summary|tl;?dr|caution|step \d+|q|a|pros?|cons?|yes|no|why|how|what)$/i.test(term)) return;
    if (/^[\d\W]+$/.test(term)) return;
    const block = st.closest('li, p, td, dd') || st.parentElement;
    const blockEl = st.closest('[data-b]');
    if (!block || !blockEl) return;

    // Text before the bold inside its block (ignoring list markers / emoji / numbering)
    const before = textBefore(block, st).replace(/[\s\d.)(#*•\-–—\p{Extended_Pictographic}️]/gu, '');
    let def = '', kind = 'mention';
    if (!before) {
      def = textAfter(block, st).replace(/^[\s:：—–\-−,.)]+/, '').trim();
      if (block.tagName === 'LI') {
        // drop nested list text from "after" and use it only if nothing else
        const nested = block.querySelector('ul,ol');
        if (nested && def.length > 0) {
          const nestedText = texText(nested).trim();
          if (def.endsWith(nestedText)) def = def.slice(0, def.length - nestedText.length).trim();
        }
        if (!def && nested) def = Array.from(nested.children).slice(0, 3).map((li) => texText(li).trim()).join(' · ');
      }
      if (!def && block.tagName === 'P') {
        const next = block.nextElementSibling;
        if (next && /^(P|UL|OL)$/.test(next.tagName)) def = texText(next).trim();
      }
      if (def.length >= 12) kind = 'definition';
    }
    if (kind === 'mention') def = sentenceAround(block, st);
    def = def.replace(/\s+/g, ' ').trim();
    if (def.length > 420) def = def.slice(0, 400).replace(/\s+\S*$/, '') + '…';

    const key = term.toLowerCase();
    const prev = out.get(key);
    st.classList.add('term');
    st.dataset.term = key;
    if (!prev) out.set(key, { key, term, def, kind, block: +blockEl.dataset.b, count: 1 });
    else {
      prev.count++;
      if (prev.kind === 'mention' && kind === 'definition') Object.assign(prev, { def, kind, block: +blockEl.dataset.b, term });
    }
  });
  return Array.from(out.values());
}

// Text as the reader sees it. KaTeX keeps a hidden MathML copy of every formula,
// which would otherwise show up twice ("R0R_0R0") in definitions and headings.
export function visibleText(node) {
  if (!node) return '';
  if (node.nodeType === 11 || node.querySelector?.('.katex-mathml')) {
    const c = node.cloneNode(true);
    c.querySelectorAll('.katex-mathml').forEach((m) => m.remove());
    return c.textContent;
  }
  return node.textContent;
}

// Text with formulas written back as $TeX$ (KaTeX keeps the source in an
// annotation), so definitions and cards can re-render the math later.
export function texText(node) {
  if (!node) return '';
  if (!node.querySelector?.('.katex')) return node.textContent;
  const c = node.cloneNode(true);
  c.querySelectorAll('.katex').forEach((k) => {
    if (k.parentElement?.closest('.katex')) return;
    const tex = k.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
    k.replaceWith(tex != null ? `$${tex.trim()}$` : visibleText(k));
  });
  return c.textContent;
}

function textBefore(block, node) {
  const r = document.createRange();
  r.setStart(block, 0);
  r.setEndBefore(node);
  return texText(r.cloneContents());
}
function textAfter(block, node) {
  const r = document.createRange();
  r.setStartAfter(node);
  r.setEnd(block, block.childNodes.length);
  return texText(r.cloneContents());
}
function sentenceAround(block, node) {
  const full = texText(block);
  const before = textBefore(block, node);
  const start = Math.max(before.lastIndexOf('. '), before.lastIndexOf('? '), before.lastIndexOf('! '), before.lastIndexOf('\n'));
  const afterIdx = before.length + texText(node).length;
  const rest = full.slice(afterIdx);
  const m = rest.match(/[.!?](\s|$)/);
  const end = m ? afterIdx + m.index + 1 : full.length;
  return full.slice(start >= 0 ? start + 1 : 0, end).trim();
}

// ---------------------------------------------------------------------------
// Mermaid diagrams (loaded lazily — it's a big library)

let mermaidReady;
export async function renderMermaid(root, dark) {
  const figs = Array.from(root.querySelectorAll('figure.mermaid.pending'));
  if (!figs.length) return false;
  if (!mermaidReady) {
    mermaidReady = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'vendor/mermaid/mermaid.min.js';
      s.onload = res;
      s.onerror = rej;
      document.head.append(s);
    });
  }
  try { await mermaidReady; } catch (e) { return false; }
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'neutral', fontFamily: 'inherit' });
  let n = 0;
  for (const fig of figs) {
    try {
      const src = fig.querySelector('code')?.textContent || '';
      const { svg } = await mermaid.render(`mmd-${Date.now().toString(36)}-${n++}`, src);
      fig.innerHTML = svg;
      fig.classList.remove('pending');
    } catch (e) {
      fig.classList.remove('pending');
      fig.title = 'Diagram could not be rendered';
    }
  }
  return true;
}

// Plain text of a block, for word counts and search.
export const words = (s) => (s.match(/\S+/g) || []).length;
