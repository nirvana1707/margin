# Margin

A Kindle-inspired reader for Markdown — built for the long, dense documents that LLMs produce — that helps you **internalize** what you read, not just skim it.

Margin is one small program. Start it, and it opens a browser tab with your Markdown files laid out like a bookshelf. Everything runs locally; nothing leaves your machine.

---

## Quick start

### Use a prebuilt binary

| OS | Run |
|---|---|
| **Windows** | Double-click `margin.exe` (shows the folder it sits in), or in a terminal: `margin.exe C:\Users\you\Notes` |
| **Linux** | `chmod +x margin && ./margin ~/notes` |

A browser tab opens at `http://127.0.0.1:7878/`. Close the terminal window (or press Ctrl+C) to stop.

> Windows may show a SmartScreen warning for an unsigned download — choose *More info → Run anyway*, or build it yourself (below).

### Build from source

The **only** prerequisite is [Go 1.21 or newer](https://go.dev/dl/) (free, BSD-licensed). No Node.js, no C compiler, no internet access during the build — every JavaScript library and font is already vendored in `web/vendor/`.

```sh
# Linux / macOS
./build.sh            # -> ./margin
./build.sh all        # -> dist/ with Windows, Linux and macOS binaries

# Windows (Command Prompt or PowerShell)
build.bat             # -> margin.exe
build.bat all         # -> dist\ with all platforms
```

Or simply: `go build -o margin .` (add `.exe` on Windows). Any OS can cross-compile for any other, e.g. `GOOS=windows GOARCH=amd64 go build -o margin.exe .`

---

## Using it

```
margin [flags] [folder-or-file ...]

  -port 7878         port (the next free one is used if busy)
  -host 127.0.0.1    use 0.0.0.0 to read on a tablet/phone on your Wi-Fi (trusted networks only!)
  -no-open           don't open a browser automatically
  -data DIR          where progress/highlights/settings are stored
  -version
```

* Pass several folders to get several shelves. Passing a single `.md` file opens it straight away.
* **Add folder** in the library adds a folder by path (remembered between runs).
* **Open files** or **drag-and-drop** `.md` files onto the window copies them to the *Imported* shelf.
* Keep a file open while an LLM or editor rewrites it: Margin reloads it live and keeps your place and highlights.

### Reading

* **Pages or scroll.** Page layout shows one or two columns (two on wide screens), with a comfortable line length at any window size.
* Turn pages with `→`/`←`, `Space`, `PgUp`/`PgDn`, the mouse wheel, swiping, or clicking the right/left margin.
* **Aa** (key `A`): typeface (Literata, Atkinson Hyperlegible, system serif/sans), size, line spacing, margins, justification, and four themes — Paper, Sepia, Dusk, Night.
* Footer: section name, *page x of y* / *time left in section* / *time left in document* (click to cycle; reading speed is learned as you read), and a progress bar with section ticks you can click to jump.
* Your position is restored exactly — even after changing font size or switching devices.

### Navigating topics and chapters

* **Automatic cross-references** — plain text like *Section 3.4*, *Sections 3.1 and 3.2*, *Example 3.2*, *Quick check 3.1* or *Chapter 4* becomes a link to that heading or example.
* **LLM-written links just work** — `[text](#3.4)`, `#example-3.2`, GitHub-style heading slugs from generated tables of contents, and links to other files (`04-forces.md#4.2`).
* **A folder is a book** — files named `01-….md`, `02-….md` are its chapters: references to another chapter open that file at the right section, **Contents** (`T`) lists every chapter with expandable sections, and each chapter ends with *Previous / Next chapter* cards (`[` / `]`, or → twice on the last page).
* **Back to page N** — after any jump (link, Contents, search, notebook) a chip takes you back to where you were (`Alt+←` / `Backspace`), even across chapters.
* Cross-references inside a document are clickable links in exported PDFs too.

### Internalizing

| Tool | What it does |
|---|---|
| **Highlights & notes** | Select text → pick one of four colours, add a note on *why it matters*. |
| **Recall checkpoints** | At the end of each section: try to recall the key ideas, check yourself against the section's key terms, write a 2–3 sentence summary in your own words, and rate your recall (*Solid / Fuzzy / Reread*). Ratings show up as coloured dots in Contents. |
| **Flashcards with spaced repetition** | Turn a selection into a fill-in-the-blank card (or a Q&A card), turn a checkpoint summary into an "explain this" card, or add key concepts. Review due cards per document (`R`) or across your whole library. Scheduling is SM-2 style (*Again / Hard / Good / Easy*). |
| **Key concepts** (`K`) | LLMs put important terms in **bold**, usually as "**Term** — definition". Margin collects them into a glossary; click a bold term in the text for its definition. |
| **Concept quiz** (`Q`) | A quick multiple-choice round built from the document's defined terms. Missed terms can go straight into your deck. |
| **Notebook** (`N`) | All highlights (by section, filter by colour), your summaries, and cards. **Export** downloads everything as a Markdown file. |
| **Export PDF** (`P` or `Ctrl+P`) | Save the **whole document** laid out like a book — cover page and contents, page numbers and running title, your highlights in colour with your notes under their paragraphs, optional chapter-per-page, and a key-concepts glossary — or save **My notebook** (summaries, highlights, notes, flashcards, key concepts) for revision. A4 or Letter, three text sizes. Uses your browser's *Save as PDF*, so text stays selectable and math/diagrams stay sharp; it always prints on white, whatever theme you read in. Page numbers and running titles appear in Chrome and Edge. |
| **Search** (`/`), **Contents** (`T`), **Bookmarks** (`B`) | The usual, Kindle-style. |

Press `?` in the app for all shortcuts.

### Textbook mode (practice books)

Margin understands a textbook structure in plain Markdown — modelled on practice books like H. C. Verma's *Concepts of Physics* — and makes it interactive:

| Write | Get |
|---|---|
| `> [!EXAMPLE] Example 3.2 — title` … `**Solution:** …` | Worked example; the solution folds away behind **Show solution** |
| `> [!QUESTION] Quick check 3.1` … `**Hint:** …` `**Answer:** …` | In-text question with **Show hint / Show answer** and *Got it / Review* self-marking |
| `> [!THINK] Food for thought` … `**Discussion:** …` | Thought-provoking prompt with a box for your own thinking (saved to your notebook) |
| `## Questions for Short Answer`, `## Exercises` + numbered list | Problems, each with its answer from the key one click away |
| `## Objective I` / `## Objective II` + options `   - (a) …` | Clickable multiple choice (single / one-or-more correct), checked against the key |
| `## Answer Key` with `### Objective I` + `1. (b)` … | Folded answer key, linked to every problem |

Progress is tracked per section (shown in **Contents**), missed questions are collected in the Notebook's **Practice** tab, any question can become a flashcard (formulas included), and PDF export can put the answers at the end of the chapter, next to each question, or leave them out for a practice copy. Recall checkpoints appear after the teaching sections, before the problems. Chapters can open with a driving question in `> [!PROBLEM]` and a `## Building Blocks` section listing prerequisites. Open the built-in *Sample chapter — Motion in a Straight Line* to try it. The `margin-textbook` skill teaches Copilot or Claude to write and convert content into this format, building every chapter from basic building blocks; `margin-course` plans a whole subject as a series of chapters.

### Built for LLM output

* Math with `$…$`, `$$…$$`, `\(…\)`, `\[…\]` and `\begin{…}` environments (KaTeX)
* Syntax-highlighted code with a copy button; Mermaid diagrams; GitHub/Obsidian callouts (`> [!NOTE]`, `> [!WARNING]` …); tables; task lists; footnotes; `<details>`
* Unwraps answers pasted inside a ```` ```markdown ```` fence (including truncated ones)
* Hides citation artefacts like `【4:0†source】` and `[cite: 3]` (toggle in settings)
* Relative images and links to other `.md` files work

---

## Where your data lives

Margin never modifies your Markdown files. Its own data is plain JSON:

* Windows: `%AppData%\margin\`
* Linux: `~/.config/margin/`
* macOS: `~/Library/Application Support/margin/`

`state/` holds one file per document (position, highlights, notes, summaries, cards), `settings.json` your reading preferences, `config.json` added folders, `imported/` files you dropped in. Back it up or sync it like any folder; use `-data` to put it elsewhere.

## Privacy & security

* Listens on `127.0.0.1` only by default, so other devices can't connect.
* Serves only Markdown files and the images next to them, inside the folders you chose; path tricks (`..`) are refused, cross-site write requests are rejected, and rendered HTML is sanitised (DOMPurify).
* No telemetry, no external requests — the UI works fully offline.

## How it's built

```
main.go            Go standard library only: HTTP server, library scanning, JSON storage, live-reload (SSE)
web/               the reader UI — plain HTML/CSS/ES modules, no build step; embedded into the binary
  js/render.js     Markdown pipeline + LLM-specific clean-ups, key-concept extraction
  js/reader.js     pagination (CSS columns), position anchoring, highlights, checkpoints
  js/anchor.js     text-quote anchoring so highlights survive edits
  js/study.js      card editor, spaced-repetition review, quiz
  js/export.js     PDF export (print layout for the document and the notebook)
  js/textbook.js   textbook structures: worked examples, quick checks, problem sets, MCQs, answer keys
  js/practice.js   reveal buttons, MCQ checking, self-marking and practice progress
  js/nav.js        cross-reference links, anchor resolution, chapter-to-chapter navigation
  js/panels.js     contents, search, notebook, concepts, settings
  vendor/          markdown-it (+footnote, task-lists, texmath), KaTeX, highlight.js, DOMPurify, Mermaid, fonts
samples/           the built-in "Welcome to Margin" guide and a sample textbook chapter
```

To change the UI, edit files in `web/` and rebuild (`go build`) — the files are embedded at compile time.

## Licenses

Margin's own code is MIT-licensed (see `LICENSE`). Bundled components are all open source — see `licenses/`:
markdown-it, markdown-it-footnote, markdown-it-texmath, KaTeX, Mermaid (MIT) · markdown-it-task-lists (ISC) · highlight.js (BSD-3-Clause) · DOMPurify (Apache-2.0 / MPL-2.0) · Literata, Atkinson Hyperlegible fonts (SIL OFL 1.1) · Go toolchain (BSD-3-Clause).
