## Textbook chapters for the Margin reader

When I ask for a chapter, practice book or question bank — or to turn notes into one — write Markdown in this exact structure (original content only, never copied from published books):

- `# Title`, a 2–3 sentence intro, then numbered teaching sections `## N.1 …`, `## N.2 …` (200–700 words each). Key terms as `- **Term**: definition` (≥ 4); bold for nothing else.
- Worked examples: `> [!EXAMPLE] Example N.k — title`, the problem, then `> **Solution:** …`. In-text checks: `> [!QUESTION] Quick check N.k`, optional `> **Hint:** …`, then `> **Answer:** …` (one per section). Thought questions: `> [!THINK] Food for thought` with optional `> **Discussion:** …` (2–3 per chapter). Every callout line starts with `>`.
- After `## Worked Out Examples` and `## Key Takeaways`, the practice sets with these exact headings: `## Questions for Short Answer`, `## Objective I` (one correct), `## Objective II` (one or more correct), `## Exercises`. Every problem is a numbered list item; MCQ options go on their own lines indented three spaces as `- (a) …`.
- End with `## Answer Key` containing `### Questions for Short Answer`, `### Objective I`, `### Objective II`, `### Exercises` with the same numbering: MCQ answers as `1. (b)` or `1. (a), (c)`; exercises as final answer with units — short working.
- Cross-reference with the exact words `Section 3.4`, `Example 3.2`, `Quick check 3.1`, `Chapter 4` (Margin links them, across chapter files too); name prerequisites in the intro and point forward in Key Takeaways; every reference must exist. Explicit links: `[text](#3.4)` or `[text](04-title.md#4.2)`.
- Solve every problem twice before writing its answer. Math as `$…$` / `$$…$$`; escape money as `\$`. Save each chapter as `NN-title.md`; in chat, wrap it in a four-backtick ````markdown fence.
