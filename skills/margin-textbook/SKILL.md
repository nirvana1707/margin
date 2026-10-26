---
name: margin-textbook
description: Write or convert study material into a textbook-style chapter for the Margin reader, in the style of H. C. Verma's Concepts of Physics - numbered sections, worked examples, in-text quick checks and food-for-thought questions, end-of-chapter short-answer questions, objective MCQs, numerical exercises and an answer key. Use when the user asks for a chapter, textbook, practice book, question bank or problem set, or to turn notes or an LLM answer into a chapter with questions.
---

# Textbook chapters for Margin

Margin turns this format into an interactive practice book:

| You write | Margin shows |
|---|---|
| `> [!PROBLEM]` under the title | The chapter's driving question, solved again at the end |
| `## Building Blocks` | What the reader needs first, with links to where each idea was taught |
| `> [!EXAMPLE]` with `**Solution:**` | A worked example; the solution folds away behind **Show solution** so the reader can try first |
| `> [!QUESTION]` with `**Hint:**` / `**Answer:**` | An in-text quick check with **Show hint**, **Show answer**, then *Got it / Review* self-marking |
| `> [!THINK]` with optional `**Discussion:**` | A food-for-thought prompt with a box for the reader's own thinking (saved to their notebook) |
| `## Objective I` + options `- (a) …` | Clickable multiple choice, checked against the answer key |
| `## Objective II` | Multiple choice with one or more correct options (pick all, then **Check**) |
| `## Questions for Short Answer`, `## Exercises` | Numbered problems, each with its answer linked from the key |
| `## Answer Key` with `### Objective I` + `1. (b)` | A folded answer key; every answer is also available under its own question |
| `- **Term**: definition` | The glossary, tap-to-define, concept quiz and flashcards |
| `Section 3.4`, `Example 3.2`, `Chapter 4` in the text | Links to that section, example or chapter (also in other chapter files) |

Progress per section, a list of questions to review, and a PDF export (answers at the end of the chapter, next to each question, or left out) all come from this structure. **The exact headings and labels below are what Margin detects — use them verbatim.**

## 1. Two jobs this skill covers

**A. Write a new chapter on a topic.** Plan the building blocks first (§4.1), then write one block at a time.

**B. Transform existing content** (notes, an LLM answer, an article) into a chapter:
- Keep every fact, formula, number and example from the source. Do not drop content to fit the template — reorganise it.
- Split the material into numbered sections by idea; move existing examples into `[!EXAMPLE]` callouts; turn existing Q&A into quick checks or problems.
- Add what a textbook needs and the source lacks: definitions of key terms, quick checks, food-for-thought questions, end-of-chapter problems and the answer key.
- Re-order the material into building blocks (§4): find every term the source uses before explaining it, and move or add its explanation earlier.
- Do not invent facts beyond standard textbook knowledge. If the source is wrong or unclear, fix it only when you are certain, otherwise keep it and add a `> [!NOTE]` explaining the doubt.
- Long sources: produce one file per chapter (see §9).

Never copy text, examples or problems from a published textbook. Write original material in the same *structure*.

## 2. File and chapter skeleton

One chapter per file, saved as `NN-short-title.md` (for example `03-motion-in-a-straight-line.md`) so chapters sort in order. Use this exact skeleton:

```markdown
# Motion in a Straight Line

Two or three sentences: what this chapter covers and what the reader will be able to do afterwards.

> [!PROBLEM] The question this chapter answers
> A concrete, motivating problem the reader cannot solve yet — and will be able to by the end.

## Building Blocks

What you need before starting, each with a one-line refresher and where it was taught:
- *Units and measurement* — every quantity is a number times a unit (Chapter 1).
- *Vectors* — quantities with size and direction (Section 2.1).

New ideas in this chapter, in order: displacement → velocity → acceleration → equations of motion.

## 3.1 Position, Distance and Displacement
One building block: why → mechanism → **Term**: definition → formula → example and non-example → quick check.

## 3.2 Speed and Velocity
The next block, built only on 3.1 and the prerequisites… a worked example… a food-for-thought question.

## 3.3 …

## Worked Out Examples
Three to six graded examples as [!EXAMPLE] callouts; the last one solves the opening problem.

## Key Takeaways
- 4–7 bullets with the core ideas and formulas.

## Questions for Short Answer
1. …

## Objective I
1. Question stem…
   - (a) …
   - (b) …
   - (c) …
   - (d) …

## Objective II
1. Question stem (one or more options correct)…
   - (a) …

## Exercises
1. Numerical problem with all data and units…

## Answer Key

### Questions for Short Answer
1. Model answer in one to three sentences.

### Objective I
1. (b)

### Objective II
1. (a), (c)

### Exercises
1. Final answer with units — short working.
```

Rules for the skeleton:
- Exactly one `#` title, then the intro, the `[!PROBLEM]` and `## Building Blocks` (exact heading). Number teaching sections `## N.1`, `## N.2` … (the chapter number N in every section, example and quick check).
- Each teaching section: **200–700 words**. Margin adds a recall checkpoint after each one (140+ words); *Building Blocks*, practice sections, *Worked Out Examples*, *Key Takeaways* and the *Answer Key* get none.
- Use `###` for sub-topics inside a section. Headings are plain text: no bold, links or emoji.
- Keep the end-of-chapter headings **exactly**: `Questions for Short Answer`, `Objective I`, `Objective II`, `Exercises`, `Answer Key`. Optional extra sets Margin also recognises: `Very Short Answer Questions`, `Long Answer Questions`, `Assertion–Reason Questions`, `Review Questions`, `Practice Problems`.
- The answer-key sub-headings must repeat the problem-set headings word for word, and the numbering inside each must match.

## 3. Element reference

### Opening problem and building blocks

```markdown
> [!PROBLEM] The question this chapter answers
> A driver moving at 54 km/h sees a red light 30 m ahead and brakes at $4\ \text{m/s}^2$. Does she stop in time?

## Building Blocks

What you need before starting:
- *Speed* — how fast something moves, in metres per second (m/s); 1 m/s = 3.6 km/h.
- *Graphs* — reading a value and a slope from a line graph.

New ideas in this chapter, in order: displacement → velocity → acceleration → equations of motion.
```

- The problem must be real and concrete, solvable with this chapter's blocks and nothing more, and solved in the last worked example (`Example N.k — Back to the opening problem`).
- Prerequisites are written in *italics* (they are defined elsewhere, so not bold), each with a one-line refresher and a `Chapter N` / `Section N.k` reference when it was taught in another chapter.
- The "new ideas" line lists this chapter's blocks in teaching order.

### Key terms (glossary, quiz, flashcards)

Define each important concept once, where it is introduced, as a bold term at the very start of a list item followed by a colon and a full-clause definition that does not repeat the term:

```markdown
- **Displacement**: the change in position, $\Delta x = x_2 - x_1$, which has both a size and a direction.
- **Acceleration**: the rate of change of velocity, $a = \dfrac{dv}{dt}$, measured in $\text{m/s}^2$.
```

At least 4 per chapter, ideally 2–4 per section. Use **bold** only for key terms; use *italics* for emphasis. Never bold labels like *Note*, *Given*, *Step 1* — except the reveal labels below.

### Worked example

```markdown
> [!EXAMPLE] Example 3.2 — Starting from rest
> A car starts from rest and accelerates uniformly at $2\ \text{m/s}^2$ for 10 s. Find its final velocity and the distance covered.
>
> **Solution:** Here $u = 0$, $a = 2\ \text{m/s}^2$, $t = 10$ s. From $v = u + at$, $v = 20$ m/s.
>
> From $s = ut + \tfrac{1}{2}at^2$, $s = 100$ m.
```

- Title: `Example N.k — short descriptive title`.
- Problem statement first, then a paragraph starting with `**Solution:**`. Everything after the label (more paragraphs, equations, tables) belongs to the solution — keep every line prefixed with `>` and separate paragraphs with a `>` line.
- Solutions follow Pólya's steps: *given and find* → the principle or equation, with where it was taught (*"from Section 3.4"*) → substitution with units → the result with units → a quick sense-check (size, sign, units).
- **Fade the help** across a chapter: early examples fully worked; then a partly worked one as a quick check, where the reader finishes the last step:

```markdown
> [!QUESTION] Quick check 3.3 — finish the solution
> A ball rolls from rest with $a = 3\ \text{m/s}^2$. After 4 s, $v = 0 + 3 \times 4 = \;?$ and $s = \tfrac{1}{2} \times 3 \times 4^2 = \;?$
>
> **Answer:** $v = 12$ m/s and $s = 24$ m.
```

then independent problems at the end of the chapter.

### Quick check (in-text question)

```markdown
> [!QUESTION] Quick check 3.1
> A runner completes one lap of a 400 m track. What distance has she covered, and what is her displacement?
>
> **Hint:** Where does she finish compared with where she started?
>
> **Answer:** 400 m of distance; zero displacement, because she ends where she began.
```

- One quick check at the end of most sections, testing *that* section's main idea in under a minute.
- `**Hint:**` is optional; `**Answer:**` is required and must come last.

### Food for thought

```markdown
> [!THINK] Food for thought
> Can a body have zero velocity and still be accelerating at that instant? Think of an everyday example before reading on.
>
> **Discussion:** Yes — a ball thrown upward is momentarily at rest at the top, yet gravity still accelerates it downward.
```

- Open, thought-provoking questions: edge cases, "what if…", connections to everyday life or other topics, common misconceptions, history of the idea. Not a calculation.
- 2–3 per chapter. `**Discussion:**` is optional but recommended.

### Problem sets

- Every problem is an item of a **numbered list** (`1.`, `2.` …) directly under its heading. Never `**Q1.**`, `Q1:` or paragraphs.
- Give all the data a problem needs, with units, and state constants (e.g. "Take $g = 10\ \text{m/s}^2$").
- **Objective I** — exactly one correct option. **Objective II** — one or more correct options. Put each option on its own line, indented three spaces under the question, as `- (a) …`, `- (b) …` in order. Usually four options.
- Write distractors from real misconceptions (sign errors, confusing distance with displacement, forgetting a factor of ½), not random values.
- Inline answers are allowed instead of the key, as an indented `**Answer:**` line under the problem — but prefer the answer key for end-of-chapter sets.

### Answer key

```markdown
## Answer Key

### Objective I
1. (b)
2. (c)

### Objective II
1. (a), (c)

### Exercises
1. 12 km/h — total distance 5 km in 25 min $= \frac{5}{12}$ h.
```

- One sub-heading per problem set, same text as the set's heading; same numbering.
- MCQ answers are option letters only: `(b)` or `(a), (c)`.
- Short-answer questions: a model answer in 1–3 sentences.
- Exercises: final answer with units first, then a dash and the key working in one line or two.

## 4. Teaching method — build from basic building blocks

The chapter must be learnable by someone who knows only the prerequisites. Full rationale and sources: `references/teaching-method.md`.

### 4.1 Plan before writing (do this first, in your head or a scratch file)

1. List every concept the chapter needs — usually 6–15, one sentence each.
2. For each, note what it depends on. Order them so each depends only on earlier ones and on the prerequisites. If two concepts depend on each other, split one into smaller parts.
3. Mark which concepts the reader must already know (→ *Building Blocks*) and which this chapter teaches (→ sections, 1–3 concepts per section).
4. Choose the opening problem: concrete, motivating, solvable with exactly these blocks.

### 4.2 Teach each concept in this order

1. **Why** — the problem or gap it solves (1–2 sentences).
2. **Mechanism before name** — what happens, in plain words, with one concrete case. Then the name.
3. **Definition** — `- **Term**: definition`.
4. **Formal statement** — formula, rule, table or diagram; explain every symbol right next to it.
5. **Example and non-example** — one case that fits, one near-miss that doesn't, and why.
6. **Link back** — how it extends the previous block (*"Velocity is displacement (Section 3.1) per unit time."*).
7. **Check** — the section's quick check tests this block, not memory of wording.

Concrete before abstract: case → picture (diagram, table) → symbols.

### 4.3 Rules that keep the blocks sound

- **Never use a term before it is defined.** If a later idea must be mentioned early, say where it is explained: *"(defined in Section 3.4)"*.
- **Derive, don't assert**: show how each result follows from earlier blocks; if something is taken as given, say so plainly.
- **One analogy per idea**, kept and extended rather than replaced, with a sentence on where it breaks.
- **Name misconceptions** in `> [!WARNING]` callouts and reuse them as MCQ distractors.
- Use `> [!IMPORTANT]` for the key result of a section. For readers who want more, put advanced detail in `<details><summary>Going deeper</summary> … </details>` so the main path stays simple.
- **Close the loop**: the last worked example solves the opening problem; *Key Takeaways* summarise the blocks and point forward to the next chapter.

### 4.4 Practice that builds mastery

- Worked examples graded from direct use of one block to problems combining several; then a partly worked quick check; then independent problems.
- End-of-chapter sets, easy → hard within each set:
  - Questions for Short Answer: 5–10 conceptual "why / explain / can it…" questions.
  - Objective I: 6–10 MCQs. Objective II: 3–6 MCQs.
  - Exercises: 6–15 numerical or derivation problems, the last few combining blocks.
- **Mix in earlier chapters**: 1–3 problems that need ideas from previous chapters (interleaving), and say so in the answer (*"uses vectors from Chapter 2"*).
- In the answer key, point each answer back to the block that teaches it: *"(Section 3.3)"*. A reader who missed it knows exactly what to reread.

## 5. Accuracy — check before you write the answer key

- **Solve every problem yourself** before writing its answer: write the working, then compute the number a second time a different way (or by estimation) to confirm it.
- Keep constants and units consistent between the question, the solution and the key.
- For MCQs, confirm the keyed letter is the option that holds the correct value, that Objective I has exactly one correct option, and that every option listed in an Objective II key is really correct (and no other one is).
- Round sensibly (2–3 significant figures) and always give units.
- If you cannot verify an answer, don't include the problem.

## 6. Write clearly — like a good manual, about 80% of the way

Aircraft-manual English (ASD-STE100) is very readable, but the full standard drops facts. Take the useful 80%:

- One idea per sentence, usually ≤ 25 words; in numbered steps, ≤ 20 words and one action per step.
- Active voice, present tense, and "you" for the reader.
- One word for one concept: if it is "displacement", don't switch to "shift" or "change of place".
- Paragraphs of 2–5 sentences; procedures as numbered steps; dangers and common mistakes in `> [!WARNING]`.
- No filler or hype: avoid *basically, obviously, simply, just, delve, leverage, utilize, seamless, robust, game-changing*.
- Never drop a fact, number, condition or hedge to make a sentence shorter.

## 7. Formatting rules that matter in Margin

- Inline math `$…$` (no space just inside the dollars); display math `$$…$$` on its own lines with blank lines around it. Escape currency as `\$20`.
- Code blocks always have a language. No `【…†source】` or `[cite: …]` markers — use links or footnotes `[^1]`.
- No chat filler in the file; don't wrap the file in a ```` ```markdown ```` fence. In a chat-only reply, wrap it in a **four-backtick** ```` ````markdown ```` fence.
- Inside callouts every line starts with `>`; blank lines inside a callout are `>` lines.

## 8. Cross-references — link chapters and topics

Margin turns references into links automatically, so readers can jump between topics and chapters (with a *Back to page N* button to return). Write them so they resolve:

- **Refer by number with these exact words**: `Section 3.4`, `Sections 3.1 and 3.2`, `Example 3.2`, `Quick check 3.1`, `Chapter 4`. Every number must match a real heading (`## 3.4 …`) or callout title (`Example 3.2 — …`). References to another chapter's sections (`Section 4.2` from chapter 3) link to that chapter's file.
- **Connect the chapter to the book**: in the intro, name the prerequisites (*"This chapter builds on vectors from Chapter 2, especially Section 2.2."*); in the text, point back when an idea is reused (*"using the equations of Section 3.4"*); in *Key Takeaways*, point forward (*"Chapter 5 uses these ideas for projectiles."*). Aim for at least 3–5 cross-references per chapter, all accurate.
- **Explicit links when the wording differs**: `[the equations of motion](#3.4)` for a section of the same file, `[the first worked example](#example-3.1)` or `#quick-check-3.2` for callouts, and `[Newton's second law](04-newtons-laws.md#4.2)` for a section of another chapter file. Plain heading slugs (`#34-equations-of-motion`) also work.
- In answers and solutions, cite where the method comes from: *"(see Example 3.2)"*, *"by the definition in Section 3.3"*.
- Don't write your own table of contents — Margin builds one, including every chapter in the folder and their sections.
- File names with the chapter number (`04-newtons-laws.md`) are what make `Chapter 4` and `Section 4.2` links work across files. Never reference a chapter or section that doesn't exist.

## 9. Several chapters

- Preferred: one file per chapter in one folder (`01-…md`, `02-…md`). Point Margin at the folder; each chapter is a book on the shelf with its own progress.
- For a whole subject, plan the chapters first with the **margin-course** skill: it maps the building blocks across chapters and writes `00-course-map.md`.
- If one file must hold several chapters: `#` book title, `## Chapter 1 · Title` per chapter, `### 1.1 …` sections, and the end-of-chapter blocks as `###` headings inside each chapter (`### Objective I`, `### Answer Key` with `#### Objective I` sub-headings). Each chapter's answer key then applies only to that chapter.

## 10. Final checklist

- [ ] `#` title, intro, `[!PROBLEM]`, `## Building Blocks`, then numbered `## N.k` sections of 200–700 words
- [ ] Concepts in dependency order; every term defined before it is used; each block: why → mechanism → definition → formula → example and non-example → check
- [ ] The last worked example solves the opening problem
- [ ] ≥ 4 `- **Term**: definition` key terms; bold used for nothing else
- [ ] A `[!QUESTION]` with `**Answer:**` in most sections; 2–3 `[!THINK]`; 3–6 `[!EXAMPLE]` with `**Solution:**`
- [ ] *Key Takeaways*, then the problem sets with the exact headings, every problem a numbered list item
- [ ] MCQ options on their own indented lines `- (a) …`; Objective I has one correct option
- [ ] *Answer Key* with matching sub-headings and numbering; every answer verified and pointing to its section
- [ ] Short active sentences, one term per concept, no filler — and no fact dropped
- [ ] Prerequisites and forward links as `Chapter N` / `Section N.k` / `Example N.k` references, all pointing at things that exist
- [ ] Saved as `NN-title.md` in the folder Margin reads

If `scripts/check_margin.py` is next to this skill and Python is available, run `python scripts/check_margin.py <file.md>` and fix every ERROR and warning it reports (it cross-checks problems against the answer key, verifies every link and Section/Example/Chapter reference, flags terms used before they are defined, and points out very long sentences and filler words).

See `references/sample-chapter.md` for a complete chapter in this format.
