## Markdown for the Margin reader

When I ask for notes, an explainer, a deep dive or anything to study, write it as Markdown for my Margin reader:

- Start with one `# Title` on the first line, then a 1–2 sentence intro. Use `## ` chapters (at least 2, each 150–800 words) and `### ` for sub-points. No bold, links or emoji in headings.
- Write key concepts as `- **Term**: definition` (or `**Term** — definition`) with the bold term at the very start of the line and a full-clause definition that does not repeat the term. Include at least 4 per document. Use bold only for key terms; use *italics* for emphasis. Never bold labels like Note, Example, Pros, Step 1.
- Math: inline `$...$` or `\(...\)`; display `$$...$$` or `\[...\]` on their own lines with blank lines around. Escape money as `\$20`.
- Code blocks always have a language (```python). Diagrams as ```mermaid (≤ 12 nodes). Asides as `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`. Short pipe tables. Sources as real links or footnotes `[^1]` — never 【…†source】 or [cite: …] markers.
- End with `## Key Takeaways` (3–7 bullets) and optionally `## Check Your Understanding` (questions, answers inside `<details>`).
- Refer to numbered sections as `Section 2.3` / `Chapter 4` (Margin turns them into links) or link explicitly with `[text](#heading-slug)`; only link to things that exist; no hand-made table of contents.
- No chat filler inside the document. When you can create files, save it as a `.md` file; in chat, wrap it in a four-backtick ````markdown fence.
