---
name: margin-markdown
description: Write explanations, study notes, guides and long answers as Markdown files formatted for the Margin reader (a Kindle-style reader with highlights, recall checkpoints, key-concept glossary, quizzes and flashcards). Use whenever the user asks for notes, an explainer, a deep dive, a learning guide, a summary to study, or anything "for Margin" or "to read later".
---

# Writing Markdown for Margin

Margin turns a Markdown file into a book: headings become chapters, **bold terms with definitions** become a glossary, quiz and flashcards, and every chapter ends with a recall checkpoint. Follow these rules so all of that works.

## 1. Output a real `.md` file

- When you can create files, save the answer as a `.md` file (for example `notes/transformers-deep-dive.md`) instead of only printing it in chat. Use a short, descriptive, lowercase file name with hyphens.
- If you can only reply in chat, output the raw Markdown. If you must wrap it in a code block, use a **four-backtick** fence (` ````markdown `) so inner ``` code blocks don't break it.
- Never put chat chatter ("Sure! Here's…", "Let me know if…") inside the document.

## 2. Structure: one title, then chapters

```markdown
# Clear Title of the Document

One or two sentences saying what the reader will learn.

## 1. First Big Idea
...
## 2. Second Big Idea
...
## Key Takeaways
...
```

- Exactly **one `#` H1**, on the first line. It becomes the book title in the library.
- Use **`##` H2 for chapters** — at least two of them. Margin uses them for the contents, the progress bar and the "time left in section" estimate.
- Each H2 section should be **150–800 words**. Margin adds a recall checkpoint after every section of 140+ words; very short sections get none, very long ones are tiring. Split long topics into more H2s.
- Use `###` for sub-points inside a chapter. Don't skip levels (no `####` straight under `##`).
- Put a plain-text heading only: no bold, links or emoji in headings. Keep heading texts unique.
- Optional YAML front matter is allowed, but only at the very top: `---` / `title: My Title` / `---`.

## 3. Key terms: bold term, then its definition

This is the most important rule. Margin builds its **Key concepts** glossary, tap-to-define pop-ups, quizzes and flashcards from it.

Write each important concept as a bold term **at the very start** of a list item or paragraph, followed by a colon or dash and a definition of at least one full clause:

```markdown
- **Self-attention**: a mechanism where every token builds its new representation as a weighted average of all other tokens.
- **Residual connection** — a shortcut that adds a layer's input to its output, which keeps gradients healthy in deep networks.

**Learning-rate warmup:** starting training with a tiny learning rate and raising it over the first few thousand steps to avoid early divergence.
```

- The term: 1–8 words, under 70 characters, no trailing punctuation inside the bold.
- The definition: should stand on its own and **not repeat the term** — quizzes hide the term and ask the reader to identify it from the definition.
- Aim for **at least 4 defined terms** per document (the quiz needs 4), ideally 3–6 per chapter.
- Use **bold only for key terms**. For ordinary emphasis use *italics*. Bold in the middle of a sentence is listed as "also emphasised", which dilutes the glossary.
- Don't bold generic labels such as **Note**, **Example**, **Pros**, **Step 1**, **TL;DR** — use callouts or headings instead.
- Define a term once, where it's introduced. Later mentions can bold it again but don't need a definition.

## 4. Formatting that renders well

| Content | Write it as |
|---|---|
| Inline math | `$E = mc^2$` or `\( a^2 + b^2 \)` — no space just inside the `$` |
| Display math | `$$ … $$` or `\[ … \]`, each on its **own lines with a blank line before and after** |
| Money | Escape the dollar sign: `\$20` (otherwise `$20 and $30` may become math) |
| Code | Fenced blocks **with a language**: ```` ```python ````, ```` ```bash ````, ```` ```json ```` |
| Diagrams | ```` ```mermaid ```` blocks (flowchart, sequenceDiagram, classDiagram, stateDiagram, mindmap…). Keep them small: ≤ 12 nodes |
| Asides | GitHub callouts: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`. Optional title: `> [!TIP] Remember this` |
| Comparisons | Pipe tables with a header row. Keep cells short (a phrase, not a paragraph), at most ~5 columns |
| Sources | Real Markdown links `[title](https://…)` or footnotes `text[^1]` … `[^1]: Source` at the end |
| Optional depth | `<details><summary>Deeper dive</summary> … </details>` |
| Checklists | `- [ ] item` / `- [x] item` |
| Worked example | `> [!EXAMPLE] Example 2 — title` … then a paragraph starting `**Solution:**` (folds away until the reader asks) |
| In-text question | `> [!QUESTION] Quick check` … optional `**Hint:**`, then `**Answer:**` (revealed on demand, self-marked) |
| Thought-provoking question | `> [!THINK] Food for thought` … optional `**Discussion:**` (reader can jot their own answer) |
| Driving question | `> [!PROBLEM] The question this guide answers` — answered at the end |
| Section break | A line with `---` (not at the very top of the file) |
| Images | Relative paths next to the file: `![Loss curve](img/loss.png)` |
| Links to other notes | Relative `.md` links: `[see the companion notes](attention-notes.md)` |

Avoid:
- Citation markers such as `【4:0†source】`, `[cite: 3]` or `[1]`-style references without a footnote definition.
- Raw HTML styling (`<style>`, `<font>`, inline `style=`) — it is stripped.
- Walls of text: keep paragraphs to 2–5 sentences.
- Deeply nested lists (more than 2 levels).
- Headings that are only emoji or that end with a colon.

## 5. Link related topics

Margin makes navigation links out of references, so readers can jump around and come back:

- Refer to parts of the document by number when headings are numbered (`## 1. …`, `## 2.3 …`): write `Section 2.3`, `Sections 1 and 2`, `Example 2`, `Chapter 4` — these become links automatically.
- Or link explicitly: `[the caching discussion](#3-caching)` (heading slug), `[step two](#2.2)` (heading number), or another file `[the setup guide](setup.md#installation)`.
- Link back when an idea is reused and forward to where it is applied. Only link to headings and files that exist.
- Don't add a hand-made table of contents — Margin builds one.

## 6. Teach from basic building blocks

Write so that someone who knows only the stated prerequisites can follow every step. Full rationale and sources: `references/teaching-method.md`.

**Plan first.** Before writing, list the concepts the topic needs and order them so each depends only on earlier ones. Note what the reader is assumed to know. If two ideas depend on each other, split one into smaller parts.

**Open well.**
- Under the title, say what the reader will be able to do or understand.
- If the topic has prerequisites, add `## Building Blocks`: each prerequisite in *italics* with a one-line refresher (and a link if it is explained elsewhere), then the new ideas in the order you will teach them.
- Optionally, put a motivating question in `> [!PROBLEM]` and answer it at the end.

**One concept at a time, always in this order:**
1. *Why* it matters — the problem it solves.
2. *Mechanism before name* — what happens, in plain words, with one concrete case.
3. `- **Term**: definition`.
4. The formal version — formula, code, rule or diagram — with every symbol or part explained next to it.
5. An example and a non-example (a near-miss that does not fit, and why).
6. How it connects to the previous idea.

**Rules.**
- **Never use a term before it is defined.** If a later idea must be mentioned early, say where it is explained: *"(see Section 3)"*.
- **Derive, don't assert**: show why a result follows; if something is taken as given, say so.
- **One analogy per idea**, kept and extended, with a sentence on where it breaks.
- Use `> [!IMPORTANT]` for the single most important point of a section, and `> [!WARNING]` for common mistakes or misconceptions.
- For readers who want more, put advanced detail in `<details><summary>Going deeper</summary> … </details>` so the main path stays simple.

**Make the reader think.**
- A `> [!QUESTION]` quick check after the harder sections, and a `> [!THINK]` food-for-thought question where an idea has a surprising edge case.
- End with `## Key Takeaways` (3–7 bullets) and, optionally, `## Check Your Understanding` with 3–5 open questions — questions only, answers in a `<details>` block.

**Write clearly — like a good manual, about 80% of the way.**
- One idea per sentence, usually ≤ 25 words; procedures as numbered steps with one action each.
- Active voice, present tense, "you" for the reader; one word for one concept (no synonym rotation).
- No filler or hype (*basically, obviously, simply, just, delve, leverage, seamless, robust*).
- Never drop a fact, number, condition or hedge to make a sentence shorter. Being clear is never an excuse for being wrong: flag approximations and say what is not known.

## 7. Final check before saving

- [ ] One `#` title on line 1, at least two `##` chapters of 150–800 words
- [ ] Concepts in dependency order; prerequisites stated; every term defined before it is used
- [ ] Each concept: why → mechanism → definition → formal version → example and non-example
- [ ] Short active sentences, one term per concept, no filler — and no fact dropped
- [ ] At least 4 `**Term**: definition` items, bold used only for key terms
- [ ] Every code block has a language; math blocks on their own lines; currency escaped
- [ ] No citation artefacts, no chat filler, not wrapped in a ```` ```markdown ```` fence when saved as a file
- [ ] Links and `Section N` references point at headings and files that exist
- [ ] Saved with a `.md` extension in the folder the user reads in Margin

If a `scripts/check_margin.py` file is next to this skill and Python is available, run `python scripts/check_margin.py <file.md>` and fix what it reports (including terms used before they are defined, very long sentences and filler words).

See `references/example.md` for a complete, correctly formatted example.

To plan a whole subject as a series of chapters, use the **margin-course** skill. For a full practice chapter — numbered sections, worked examples, quick checks, food for thought, end-of-chapter questions, objective MCQs, exercises and an answer key — use the **margin-textbook** skill instead.
