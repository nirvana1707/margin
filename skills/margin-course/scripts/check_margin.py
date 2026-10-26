#!/usr/bin/env python3
"""Check that a Markdown file follows the Margin reader conventions.

Usage:  python check_margin.py notes.md [more.md ...]

Covers ordinary notes (title, chapters, key terms, math, code, citations) and,
when it finds them, textbook structures: worked examples, quick checks, food
for thought, problem sets, multiple-choice options and the answer key.

Exit code 0 = no errors (warnings may still be printed), 1 = errors found.
Standard library only.
"""
import os
import re
import sys
import unicodedata

TERM_RE = re.compile(r"^\s*(?:[-*+]\s+|\d+[.)]\s+)?(?:\[[ xX]\]\s+)?\*\*([^*\n]{2,70}?)\*\*(\s*[:：—–-])?")
BOLD_RE = re.compile(r"\*\*([^*\n]+?)\*\*")
GENERIC = re.compile(r"^(note|tip|warning|important|example|summary|tl;?dr|caution|step \d+|q|a|pros?|cons?|yes|no|why|how|what|given|find)[:.]?$", re.I)
MARKER = re.compile(r"^\s*(?:>\s*)?(?:[-*+]\s+|\d+[.)]\s+)?\*\*(solution|answer|ans|hint|discussion|explanation|working)\s*[:.：]?\*\*\s*[:.：]?", re.I)
CITE_RE = re.compile(r"【[^】\n]{0,120}】|\[cite(?:_start|_end)?(?::[^\]\n]*)?\]", re.I)
EMOJI_RE = re.compile("[\U0001F300-\U0001FAFF☀-➿]")
MATH_SPAN = re.compile(r"(?<!\\)\$\$.+?(?<!\\)\$\$|(?<!\\)\$(?=\S)(?:\\.|[^$\\\n])*?(?<=\S)(?<!\\)\$(?!\d)")

CALLOUT_RE = re.compile(r"^\s*>\s*\[!([A-Za-z-]+)\]")
KNOWN_CALLOUTS = {
    "note", "tip", "important", "warning", "caution", "info", "success", "danger", "quote", "abstract", "summary", "todo",
    "example", "worked-example", "solved", "question", "check", "quiz", "try", "try-it", "exercise",
    "think", "reflect", "ponder", "thought", "food-for-thought", "problem", "goal",
}
TB_KIND = {"example": "example", "worked-example": "example", "solved": "example",
           "question": "question", "check": "question", "quiz": "question", "try": "question", "try-it": "question", "exercise": "question",
           "think": "think", "reflect": "think", "ponder": "think", "thought": "think", "food-for-thought": "think"}

# --- heading classification (mirrors Margin's textbook.js) -------------------
PSET = re.compile(r"^(questions?\s+for\s+short\s+answers?|short[-\s]?answer(\s+questions?)?|very\s+short[-\s]?answer(\s+questions?)?|long[-\s]?answer(\s+questions?)?|objective(\s*[-–—:]?\s*(i{1,2}|[12]|type))?(\s+questions?)?|multiple[-\s]choice(\s+questions?)?|mcqs?|exercises?|problems?|numerical\s+problems?|practice\s+(problems?|questions?|exercises?|set)|review\s+questions?|(end[-\s]of[-\s]chapter\s+)?(questions|problems|exercises)|test\s+yourself|self[-\s]?test|assertion[-\s]reason(\s+questions?)?)$", re.I)
KEY = re.compile(r"^(answers?|answer\s+key|answers?\s+(to|for)\s+.+|solutions?\s+(to|for)\s+.+|hints?\s+(and|&)\s+solutions?|answers?\s+(and|&)\s+(solutions?|hints?))$", re.I)
EXAMPLES = re.compile(r"^(worked[-\s]*(out\s+)?examples?|solved\s+(examples?|problems?)|illustrative\s+examples?)$", re.I)
NO_CHECKPOINT = re.compile(r"^(key\s+takeaways?|summary|chapter\s+summary|recap|check\s+your\s+understanding|references|sources|further\s+reading|glossary|contents|building\s+blocks|before\s+you\s+start|prerequisites|what\s+you\s+need\s+to\s+know|who\s+this\s+is\s+for|chapters|reviews|how\s+to\s+study|what\s+this\s+review\s+covers)$", re.I)
BLOCKS_HEADING = re.compile(r"^(building\s+blocks|before\s+you\s+start|prerequisites|what\s+you\s+need\s+to\s+know)$", re.I)
FILLER = re.compile(r"\b(basically|obviously|simply put|needless to say|it goes without saying|delve[sd]?|delving|leverag(?:e|es|ed|ing)|utili[sz](?:e|es|ed|ing)|seamless(?:ly)?|robust|game-changing|cutting-edge|supercharg(?:e|es|ed|ing)|in today's world)\b", re.I)


def bare(text):
    t = re.sub(r"\s+", " ", text).strip()
    t = re.sub(r"^(chapter\s+)?[\dIVXivx]+(\.\d+)*[.):]?\s+(?=\D)", "", t)
    t = re.sub(r"^[A-Z][.)]\s+", "", t)
    t = re.sub(r"\s*[:：]\s*$", "", t)
    t = re.sub(r"\s*\([^)]*\)\s*$", "", t)
    t = re.sub(r"\s*[-–—]\s*(single|one or more|multiple).*$", "", t, flags=re.I)
    return t


def classify(text):
    t = bare(text)
    if KEY.match(t):
        return "key"
    if EXAMPLES.match(t):
        return "examples"
    if PSET.match(t):
        return "pset"
    return None


def set_name(text):
    t = bare(text).lower()
    if re.search(r"very\s+short", t): return "vshort"
    if re.search(r"long[-\s]?answer", t): return "long"
    if re.search(r"short[-\s]?answer", t): return "short"
    if re.search(r"objective.*\b(ii|2)\b|one or more|multiple correct|more than one", t): return "obj2"
    if re.search(r"objective|single correct|mcq|multiple[-\s]choice", t): return "obj1"
    if re.search(r"assertion", t): return "ar"
    if re.search(r"exercise|numerical|problem", t): return "ex"
    return t


def letters(text):
    t = text.strip()
    paren = re.findall(r"\(([a-h])\)", t, re.I)
    if paren:
        return sorted(set(x.lower() for x in paren))
    m = re.match(r"^\s*(?:options?\s+)?([a-h])((?:\s*(?:,|and|&|/)\s*[a-h])*)\s*[.)]?(\s|$)", t, re.I)
    if m:
        return sorted(set(re.findall(r"[a-h]", (m.group(1) + m.group(2)).lower())))
    return []


# --- cross-references (mirrors Margin's nav.js) ------------------------------
REF_RE = re.compile(r"(\bSections?|\bSec\.|§|\bChapters?|\bCh\.|\bExamples?|\bEx\.|\bQuick\s+checks?)\s?(\d+(?:\.\d+)*)((?:(?:\s*,\s*|\s+(?:and|&|or|to)\s+|\s*[–-]\s*)\d+(?:\.\d+)*)*)")
LINK_RE = re.compile(r"(?<!!)\[([^\]\n]*)\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
FILE_NUM = re.compile(r"^(\d{1,3})(?:[-_. ]|$)")


def norm(s):
    s = unicodedata.normalize("NFKD", s.lower())
    return "".join(ch for ch in s if ch.isalnum() and not unicodedata.combining(ch))


def num_start(num, text):
    return re.match(r"^(?:(?:chapter|section|sec\.?|§|unit|part)\s*)?" + re.escape(num) + r"(?![\d.]\d)", text.strip(), re.I) is not None


def ref_kind(word):
    w = word.lower()
    return "chapter" if w.startswith("ch") else "example" if w.startswith("ex") else "check" if w.startswith("quick") else "section"


def outline_of(text):
    """Headings, callout titles and chapter number of a Markdown text."""
    heads, titles, fence = [], [], None
    for line in text.replace("\r\n", "\n").split("\n"):
        s = line.strip()
        fm = re.match(r"^(`{3,}|~{3,})", s)
        if fm:
            fence = None if fence and fm.group(1).startswith(fence) else (fence or fm.group(1))
            continue
        if fence:
            continue
        hm = re.match(r"^(#{1,6})\s+(.*?)\s*#*\s*$", line)
        if hm:
            heads.append((len(hm.group(1)), re.sub(r"[*_`$]", "", re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", hm.group(2))).strip()))
        cm = re.match(r"^\s*>\s*\[!([A-Za-z-]+)\][+-]?\s*(.*)$", line)
        if cm and cm.group(2).strip():
            titles.append(cm.group(2).strip())
    return heads, titles


def chapter_no(fname, heads):
    m = FILE_NUM.match(os.path.basename(fname))
    if m:
        return int(m.group(1))
    title = next((t for l, t in heads if l == 1), "")
    m = re.match(r"(?i)^(?:chapter|ch\.?|unit|lesson|part|module)\s+(\d{1,3})\b", title) or re.match(r"^(\d{1,3})\s*[.:·\-–—]\s*\D", title)
    if m:
        return int(m.group(1))
    counts = {}
    for l, t in heads:
        k = re.match(r"^(\d{1,3})\.\d", t)
        if l >= 2 and k:
            counts[k.group(1)] = counts.get(k.group(1), 0) + 1
    if counts:
        best = max(counts.items(), key=lambda x: x[1])
        if best[1] >= 2:
            return int(best[0])
    return 0


def slugify(t):
    t = unicodedata.normalize("NFKD", t.lower())
    t = "".join(ch for ch in t if not unicodedata.combining(ch))
    t = re.sub(r"[^\w\s-]", "", t).strip()
    return re.sub(r"\s+", "-", t)[:60]


def resolve(anchor, heads, titles):
    """True if Margin can resolve '#anchor' in a document with these headings / callout titles."""
    key = anchor.lstrip("#").strip()
    if not key:
        return False
    texts = [t for _, t in heads]
    m = re.match(r"^(?:sec(?:tion)?[-_. ]?|§\s*)?(\d+(?:\.\d+)*)$", key, re.I)
    if m and any(num_start(m.group(1), t) for t in texts):
        return True
    m = re.match(r"^(example|ex|worked[-_ ]example|quick[-_ ]?check|check|question|think|food[-_ ]for[-_ ]thought)[-_. ]?(\d+(?:\.\d+)*)$", key, re.I)
    if m:
        word = "example" if re.match(r"ex|worked", m.group(1), re.I) else "(quick check|check|question|think|food for thought)"
        if any(re.match(r"(?i)^(worked\s+)?" + word + r"\s*" + re.escape(m.group(2)) + r"(?![\d.]\d)", t) for t in titles):
            return True
    m = re.match(r"^(?:chapter|ch)[-_. ]?(\d+)$", key, re.I)
    if m and any(re.match(r"(?i)^(chapter|ch\.?|unit|part|lesson|module)\s+" + m.group(1) + r"\b", t) for t in texts):
        return True
    nk = norm(key)
    return any(norm(slugify(t)) == nk or norm(t) == nk for t in texts) or (len(nk) >= 4 and any(norm(t).startswith(nk) for t in texts))


def check_links(path, body_lines, offset, warns):
    """Validate [links](#…) / [links](file.md#…) and 'Section 3.4'-style references."""
    text = "\n".join(body_lines)
    heads, titles = outline_of(text)
    folder = os.path.dirname(os.path.abspath(path))
    me = chapter_no(path, heads)
    sibs = {}
    try:
        for f in sorted(os.listdir(folder)):
            fp = os.path.join(folder, f)
            if f.lower().endswith((".md", ".markdown")) and os.path.abspath(fp) != os.path.abspath(path):
                try:
                    h, t = outline_of(open(fp, encoding="utf-8-sig").read())
                except OSError:
                    continue
                n = chapter_no(f, h)
                if n and n not in sibs:
                    sibs[n] = (f, h, t)
    except OSError:
        pass
    seen = set()
    fence = None
    for i, line in enumerate(body_lines, start=offset + 1):
        s = line.strip()
        fm = re.match(r"^(`{3,}|~{3,})", s.lstrip("> ").strip())
        if fm:
            fence = None if fence and fm.group(1).startswith(fence) else (fence or fm.group(1))
            continue
        if fence or re.match(r"^#{1,6}\s", line):
            continue
        clean = re.sub(r"`[^`]*`", " ", line)
        clean = MATH_SPAN.sub(" ", clean)
        for lm in LINK_RE.finditer(clean):
            target = lm.group(2)
            if re.match(r"^[a-z][a-z0-9+.-]*:", target, re.I) or target.startswith("//"):
                continue
            fpart, _, anchor = target.partition("#")
            if not fpart:
                if not resolve(anchor, heads, titles):
                    warns.append(f"line {i}: link '#{anchor}' doesn't match any heading, example or quick check in this file")
                continue
            if not re.search(r"\.(md|markdown|mdown|mkd|mdx)$", fpart, re.I):
                continue
            fp = os.path.normpath(os.path.join(folder, fpart.replace("%20", " ")))
            if not os.path.isfile(fp):
                warns.append(f"line {i}: link to '{fpart}' — no such file next to this one")
                continue
            if anchor:
                h, t = outline_of(open(fp, encoding="utf-8-sig").read())
                if not resolve(anchor, h, t):
                    warns.append(f"line {i}: link '{fpart}#{anchor}' — no matching heading in that file")
        plain = LINK_RE.sub(" ", clean)
        for m in REF_RE.finditer(plain):
            kind = ref_kind(m.group(1))
            nums = [m.group(2)] + re.findall(r"\d+(?:\.\d+)*", m.group(3) or "")
            for num in nums:
                key = (kind, num)
                if key in seen:
                    continue
                seen.add(key)
                chap = int(num.split(".")[0])
                if kind == "chapter":
                    if chap == me or any(re.match(r"(?i)^(chapter|ch\.?|unit|part)\s+%d\b" % chap, t) for _, t in heads):
                        continue
                    if chap not in sibs:
                        warns.append(f"line {i}: 'Chapter {chap}' won't be a link — no chapter {chap} file (e.g. '{chap:02d}-….md') in this folder")
                    continue
                local = chap == me or not me or chap not in sibs
                h, t = (heads, titles) if local else sibs[chap][1:]
                where = "this file" if local else sibs[chap][0]
                if kind == "section":
                    if "." not in num and not me:
                        ok = any(num_start(num, x) for _, x in h)
                    else:
                        ok = any(num_start(num, x) for _, x in h)
                    if not ok:
                        warns.append(f"line {i}: refers to Section {num}, but {where} has no heading starting with '{num}'")
                else:
                    word = "example" if kind == "example" else "(quick check|check|question)"
                    if not any(re.match(r"(?i)^(worked\s+)?" + word + r"\s*" + re.escape(num) + r"(?![\d.]\d)", x) for x in t):
                        warns.append(f"line {i}: refers to {'Example' if kind == 'example' else 'Quick check'} {num}, but {where} has no callout titled that way")


def check_teaching(body_lines, offset, term_defs, warns, is_map=False):
    """Building-block checks: terms used before they are defined; very long sentences; filler words."""
    prose = []                     # (line number, text) of teaching prose
    fence, seen_h2, skip_level = None, False, 0
    for i, line in enumerate(body_lines, start=offset + 1):
        s = line.strip()
        fm = re.match(r"^(`{3,}|~{3,})", s.lstrip("> ").strip())
        if fm:
            fence = None if fence and fm.group(1).startswith(fence) else (fence or fm.group(1))
            continue
        if fence:
            continue
        hm = re.match(r"^(#{1,6})\s+(.*?)\s*#*\s*$", line)
        if hm:
            level = len(hm.group(1))
            if level == 2:
                seen_h2 = True
            if skip_level and level <= skip_level:
                skip_level = 0
            if BLOCKS_HEADING.match(bare(hm.group(2))) or classify(hm.group(2)) == "key":
                skip_level = level          # prerequisite lists and answer keys may name terms early
            continue
        if not seen_h2 or skip_level or not s or re.match(r"^\s*>\s*\[!", line) or s.startswith("|"):
            continue
        prose.append((i, line))

    def clean(text):
        text = re.sub(r"`[^`]*`", " ", text)
        text = MATH_SPAN.sub(" ", text)
        text = re.sub(r"\]\([^)]*\)", "]", text)
        return text

    # 1. terms used before their definition
    found, done = [], set()
    for term, def_line in term_defs:
        key = term.lower()
        if key in done:
            continue
        done.add(key)
        pat = re.compile(r"(?<![\w-])" + re.escape(term) + r"(?:s|es)?(?![\w-])", re.I)
        for ln, text in prose:
            if ln >= def_line:
                break
            t = clean(text)
            if re.search(r"(?i)defined in|see section|see chapter|explained in|introduced in", t):
                continue
            if pat.search(t):
                found.append((ln, term, def_line))
                break
    for ln, term, d in sorted(found)[:8]:
        warns.append(f"line {ln}: '{term}' is used before it is defined (line {d}) — define it first, or add '(defined in Section …)'")
    if len(found) > 8:
        warns.append(f"…and {len(found) - 8} more terms used before their definition")

    if is_map:
        return
    # 2. very long sentences (manual style: aim for 25 words or fewer)
    long_ones = []
    for ln, text in prose:
        t = re.sub(r"^\s*(?:>\s*)?(?:[-*+]\s+|\d+[.)]\s+)?", "", clean(text))
        for sent in re.split(r"(?<=[.!?])\s+(?=[A-Z(\"'*])", t):
            n = len(re.findall(r"[A-Za-z0-9][\w'’-]*", sent))
            if n > 35:
                long_ones.append((ln, n))
    if long_ones:
        eg = ", ".join(f"line {ln} ({n} words)" for ln, n in long_ones[:3])
        warns.append(f"{len(long_ones)} sentence(s) over 35 words, e.g. {eg} — split them; aim for 25 words or fewer")
    # 3. filler and hype words
    hits = {}
    for ln, text in prose:
        for m in FILLER.finditer(clean(text)):
            hits.setdefault(m.group(1).lower(), []).append(ln)
    if hits:
        desc = "; ".join(f"'{w}' (line{'s' if len(l) > 1 else ''} {', '.join(map(str, l[:3]))})" for w, l in list(hits.items())[:5])
        warns.append(f"filler or hype words: {desc} — say it plainly")


def strip_frontmatter(lines):
    if lines and lines[0].strip() == "---":
        for i in range(1, min(len(lines), 200)):
            if lines[i].strip() == "---":
                return lines[i + 1:], i + 1
    return lines, 0


def check(path):
    errors, warns = [], []
    try:
        text = open(path, encoding="utf-8-sig").read()
    except OSError as e:
        return [f"cannot read file: {e}"], [], 0, 0, None
    raw = text.replace("\r\n", "\n").split("\n")

    first = next((l for l in raw if l.strip()), "")
    if re.match(r"^\s*(`{3,}|~{3,})\s*(markdown|md)\s*$", first, re.I):
        errors.append("the whole document is wrapped in a ```markdown fence — save the inner Markdown only")
    if re.match(r"^\s*(sure|certainly|of course|here'?s|here is|great question)\b", first, re.I):
        errors.append(f"document starts with chat filler: {first.strip()[:60]!r}")

    lines, offset = strip_frontmatter(raw)

    in_fence, fence = False, ""
    h1, headings = [], []          # headings: dict(level, title, line, cls, words)
    terms, mid_bold, generic_bold = [], 0, []
    term_defs = []                 # (term, line) where each key term is defined
    stack = []                     # heading stack for textbook regions
    problems = []                  # dict(line, scope, set, num, opts, inline_answer, text)
    key = {}                       # scope -> group -> num -> (line, text)
    key_seen = []                  # (line, scope)
    callouts = []                  # dict(line, kind, raw_type, markers:set)
    cur_callout = None
    cur_problem = None

    def region():
        classified = [s for s in stack if s["cls"]]
        if not classified:
            return None, None, None
        top = classified[0]
        idx = stack.index(top)
        scope = stack[idx - 1]["title"] if idx > 0 else "_doc"
        keyent = next((s for s in classified if s["cls"] == "key"), None)
        if keyent:
            below = stack[stack.index(keyent) + 1:]
            return "key", scope, set_name(below[-1]["title"]) if below else ""
        if top["cls"] == "pset":
            return "pset", scope, set_name([s for s in classified if s["cls"] == "pset"][-1]["title"])
        return top["cls"], scope, None

    for i, line in enumerate(lines, start=offset + 1):
        s = line.strip()
        m = re.match(r"^(`{3,}|~{3,})(.*)$", s.lstrip("> ").strip()) if s.startswith(">") else re.match(r"^(`{3,}|~{3,})(.*)$", s)
        if m:
            if not in_fence:
                in_fence, fence = True, m.group(1)
                if not m.group(2).strip():
                    warns.append(f"line {i}: code block has no language (use ```python, ```bash, ```text …)")
            elif m.group(1).startswith(fence) and not m.group(2).strip():
                in_fence = False
            continue
        if in_fence:
            continue

        # ---- callouts
        cm = CALLOUT_RE.match(line)
        if cm:
            t = cm.group(1).lower()
            if t not in KNOWN_CALLOUTS:
                warns.append(f"line {i}: unknown callout type [!{cm.group(1)}] — use NOTE, TIP, IMPORTANT, WARNING, CAUTION, EXAMPLE, QUESTION or THINK")
            cur_callout = {"line": i, "kind": TB_KIND.get(t), "type": cm.group(1).upper(), "markers": set(), "body": 0}
            callouts.append(cur_callout)
        elif cur_callout and s.startswith(">"):
            mk = MARKER.match(line)
            if mk:
                k = mk.group(1).lower()
                cur_callout["markers"].add("solution" if k.startswith("sol") or k == "working" else "answer" if k.startswith("ans") or k == "explanation" else k)
            elif s.strip("> ").strip():
                if not cur_callout["markers"]:
                    cur_callout["body"] += 1
        elif not s.startswith(">"):
            cur_callout = None

        # ---- headings
        hm = re.match(r"^(#{1,6})\s+(.*?)\s*#*\s*$", line)
        if hm:
            level, title = len(hm.group(1)), hm.group(2)
            cls = classify(title)
            while stack and stack[-1]["level"] >= level:
                stack.pop()
            parent_key = any(x["cls"] == "key" for x in stack)
            entry = {"level": level, "title": title, "line": i, "cls": None if parent_key else cls, "words": 0}
            stack.append(entry)
            headings.append(entry)
            if entry["cls"] == "key":
                key_seen.append((i, stack[-2]["title"] if len(stack) > 1 else "_doc"))
            cur_problem = None
            if level == 1:
                h1.append(i)
            if "**" in title or re.search(r"\[.+\]\(.+\)", title):
                warns.append(f"line {i}: heading contains bold or a link — keep headings plain text")
            if title.endswith(":"):
                warns.append(f"line {i}: heading ends with a colon")
            if EMOJI_RE.search(title) and not re.sub(EMOJI_RE, "", title).strip():
                warns.append(f"line {i}: heading is only emoji")
            continue

        for hd in headings[-1:]:
            hd["words"] += len(s.split())
        # also count words for the enclosing chapter-level heading(s)
        for hd in stack[:-1]:
            hd["words"] += len(s.split())

        # ---- problem sets and answer key
        kind, scope, group = region()
        num_m = re.match(r"^(\s{0,3})(\d+)[.)]\s+(.*)$", line)
        if kind == "pset":
            if num_m:
                cur_problem = {"line": i, "scope": scope, "set": group, "num": int(num_m.group(2)), "opts": [], "inline": False, "text": num_m.group(3)}
                problems.append(cur_problem)
                if re.search(r"\(a\).+\(b\)", num_m.group(3)) and group in ("obj1", "obj2"):
                    warns.append(f"line {i}: options written on one line — put each option on its own indented line: '   - (a) …'")
            elif cur_problem:
                om = re.match(r"^\s{2,}[-*+]\s+(?:\[[ xX]\]\s+)?\(?([a-hA-H])[).:]\s+", line)
                tm2 = re.match(r"^\s{2,}[-*+]\s+\[([ xX])\]\s+", line)
                if om:
                    cur_problem["opts"].append(om.group(1).lower())
                elif tm2:
                    cur_problem["opts"].append("abcdefgh"[len(cur_problem["opts"])])
                if MARKER.match(line) and re.search(r"answer|ans|solution|working|explanation", line, re.I):
                    cur_problem["inline"] = True
                if re.match(r"^\*\*Q?\d+[.)]?\*\*", s) or re.match(r"^Q\d+[.):]", s):
                    warns.append(f"line {i}: problem written as '{s[:6]}…' — use a numbered list ('1. …') so Margin can link it to the answer key")
        elif kind == "key" and num_m:
            key.setdefault(scope, {}).setdefault(group, {})[int(num_m.group(2))] = (i, num_m.group(3))

        # ---- key terms and bold
        if MARKER.match(line):
            continue
        tm = TERM_RE.match(line)
        if tm and not (tm.group(2) or tm.group(1).rstrip().endswith((":", "："))):
            tm = None
        if tm and kind not in ("pset", "key"):
            term = tm.group(1).strip().rstrip(":：").strip()
            rest = line[tm.end():].strip()
            if GENERIC.match(term):
                generic_bold.append((i, term))
            elif len(rest) >= 12:
                terms.append(term)
                term_defs.append((term, i))
            else:
                warns.append(f"line {i}: '**{term}**' has no definition after it (write at least a full clause)")
        for bm in BOLD_RE.finditer(line):
            b = bm.group(1).strip().rstrip(":")
            if GENERIC.match(b):
                if (i, b) not in generic_bold:
                    generic_bold.append((i, b))
            elif not (tm and bm.start() == line.index("**")):
                mid_bold += 1

        if CITE_RE.search(line):
            errors.append(f"line {i}: citation artefact {CITE_RE.search(line).group(0)!r} — use a link or footnote")

        # Unescaped currency like "$5 and $10" (would be read as math).
        rest_line = MATH_SPAN.sub(" ", line)
        if re.search(r"(?<!\\)\$\d", rest_line):
            warns.append(f"line {i}: dollar amount may be read as math — escape it as \\$")

    # ---- document structure
    if len(h1) == 0:
        errors.append("no '# Title' (H1) heading — add one on the first line")
    elif len(h1) > 1:
        warns.append(f"{len(h1)} H1 headings (lines {', '.join(map(str, h1))}) — use one '#' title and '##' for chapters")
    elif h1[0] > offset + 3:
        warns.append(f"the '# Title' is on line {h1[0]} — put it first")

    sections = [h for h in headings if h["level"] == 2]
    title = next((h["title"] for h in headings if h["level"] == 1), "")
    is_map = bool(re.match(r"^00[-_. ]", os.path.basename(path))) or bool(re.search(r"course\s+map", title, re.I))
    is_review = bool(re.match(r"(?i)^review\b", bare(title)))
    if len(sections) < 2:
        warns.append(f"only {len(sections)} '##' chapter(s) — use at least two so Margin can build contents and checkpoints")
    for sec in sections:
        b = bare(sec["title"])
        exempt = classify(sec["title"]) or NO_CHECKPOINT.match(b)
        if sec["words"] < 140 and not exempt and not is_map and not is_review:
            warns.append(f"line {sec['line']}: section '{sec['title']}' has {sec['words']} words — under 140 gets no recall checkpoint")
        if sec["words"] > 1500 and not exempt:
            warns.append(f"line {sec['line']}: section '{sec['title']}' has {sec['words']} words — consider splitting it")

    uniq = sorted(set(t.lower() for t in terms))
    if len(uniq) < 4 and not is_map and not is_review:
        warns.append(f"only {len(uniq)} defined key term(s) — write at least 4 as '- **Term**: definition' (the quiz needs 4)")
    if mid_bold > max(8, len(uniq) * 2):
        warns.append(f"{mid_bold} bold phrases in running text — keep **bold** for key terms, use *italics* for emphasis")
    for i, b in generic_bold[:5]:
        warns.append(f"line {i}: bold label '{b}' — use a callout (> [!NOTE]) or heading instead")

    # ---- textbook checks
    tb = None
    tb_callouts = [c for c in callouts if c["kind"]]
    if tb_callouts or problems or key_seen:
        tb = {"examples": 0, "checks": 0, "think": 0, "problems": len(problems), "answered": 0}
        for c in tb_callouts:
            if c["kind"] == "example":
                tb["examples"] += 1
                if "solution" not in c["markers"] and "answer" not in c["markers"]:
                    warns.append(f"line {c['line']}: [!{c['type']}] has no '**Solution:**' paragraph")
            elif c["kind"] == "question":
                tb["checks"] += 1
                if "answer" not in c["markers"] and "solution" not in c["markers"]:
                    warns.append(f"line {c['line']}: [!{c['type']}] has no '**Answer:**' paragraph")
            elif c["kind"] == "think":
                tb["think"] += 1
            if c["markers"] and c["body"] == 0:
                warns.append(f"line {c['line']}: [!{c['type']}] starts with its answer — put the question first")

        for p in problems:
            k = key.get(p["scope"], {})
            ans = k.get(p["set"], {}).get(p["num"])
            names = {x["set"] for x in problems if x["scope"] == p["scope"]}
            if not ans and "" in k and (len(names) == 1 or p["set"] not in k):
                ans = k[""].get(p["num"])
            if p["inline"] or ans:
                tb["answered"] += 1
            else:
                warns.append(f"line {p['line']}: problem {p['set']} {p['num']} has no answer — add it to the answer key (or an inline '**Answer:**')")
            if p["set"] in ("obj1", "obj2"):
                if len(p["opts"]) < 2:
                    warns.append(f"line {p['line']}: {('Objective I' if p['set'] == 'obj1' else 'Objective II')} question {p['num']} needs options as an indented list: '   - (a) …'")
                elif p["opts"] != list("abcdefgh"[:len(p["opts"])]):
                    warns.append(f"line {p['line']}: options of question {p['num']} should be labelled (a), (b), (c) … in order")
                if ans and p["opts"]:
                    ls = letters(ans[1])
                    if not ls:
                        warns.append(f"line {ans[0]}: answer to {p['set']} {p['num']} should be option letters like '(b)' or '(a), (c)'")
                    elif any(x not in p["opts"] for x in ls):
                        errors.append(f"line {ans[0]}: answer {', '.join('(' + x + ')' for x in ls)} is not one of the options of {p['set']} {p['num']}")
                    elif p["set"] == "obj1" and len(ls) > 1:
                        warns.append(f"line {ans[0]}: Objective I question {p['num']} has several answers — move it to Objective II (one or more correct)")

        for scope, groups in key.items():
            psets = {x["set"] for x in problems if x["scope"] == scope}
            for g, items in groups.items():
                if g and g not in psets:
                    errors.append(f"answer-key group '{g}' (line {min(v[0] for v in items.values())}) has no matching problem set — use the same heading text, e.g. '### Objective I'")
                for n, (ln, _) in items.items():
                    if g and not any(x["set"] == g and x["num"] == n for x in problems):
                        warns.append(f"line {ln}: answer {n} in '{g}' has no matching question")
        if problems and not key_seen and not all(p["inline"] for p in problems):
            warns.append("problem sets found but no '## Answer Key' section")
        if not is_review and not any(BLOCKS_HEADING.match(bare(h["title"])) for h in headings):
            warns.append("no '## Building Blocks' section — list the prerequisites (with refreshers and links) and the new ideas in teaching order")

    n_before = len(warns)
    check_links(path, lines, offset, warns)
    if is_map:   # chapters listed in a course map may simply not be written yet
        warns[n_before:] = [re.sub(r"'Chapter (\d+)' won't be a link — no chapter \d+ file \(e\.g\. '(\d+)-….md'\) in this folder",
                                   r"Chapter \1 is planned but not written yet ('\2-….md')", w) for w in warns[n_before:]]
    check_teaching(lines, offset, term_defs, warns, is_map)
    return errors, warns, len(sections), len(uniq), tb


def main(argv):
    if not argv:
        print(__doc__.strip())
        return 2
    bad = False
    for p in argv:
        errors, warns, nsec, nterms, tb = check(p)
        print(f"\n{p}")
        print(f"  {nsec} chapters, {nterms} defined key terms")
        if tb:
            print(f"  textbook: {tb['examples']} worked examples, {tb['checks']} quick checks, {tb['think']} food-for-thought, "
                  f"{tb['problems']} problems ({tb['answered']} with answers)")
        for e in errors:
            print(f"  ERROR  {e}")
        for w in warns:
            print(f"  warn   {w}")
        if not errors and not warns:
            print("  OK — ready for Margin")
        bad = bad or bool(errors)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
