# The Building-Block Method

How the Margin skills teach, and why. Each rule comes from a teaching approach with a track record; this file records what was adopted from each, and what was deliberately left out.

## The method in one page

**1. Plan before writing.**
- List the concepts the topic needs, one sentence each.
- Order them so every concept depends only on concepts before it (a *learning progression*).
- Write down what the reader is assumed to know already.

**2. Open each chapter with a problem and its building blocks.**
- `> [!PROBLEM]` — a concrete question the chapter will equip the reader to answer.
- `## Building Blocks` — the prerequisites, each with a one-line refresher and a cross-reference, then the new ideas of the chapter in order.

**3. Teach one concept per block, always in this order:**
1. *Why* — the problem or gap this concept solves (1–2 sentences).
2. *Mechanism before name* — what happens, in plain words, with one concrete case.
3. *Name and definition* — `- **Term**: definition`.
4. *Formal statement* — formula, rule or diagram, with every symbol explained right next to it.
5. *Example and non-example* — one case that fits and one near-miss that does not, and why.
6. *Link back* — how this block extends the previous one (`Section 3.2`).
7. *Check* — one quick question on this block only.

**4. Never use a term before it is defined.** If a later idea must be mentioned early, say where it is explained: *"(defined in Section 3.4)"*.

**5. Derive, don't assert.** Show how each result follows from earlier blocks. If a result is taken as given, say so.

**6. One analogy per idea, with its limit.** Keep the same analogy and extend it; say where it breaks.

**7. Fade the help.**
- Worked example (full solution).
- Partly worked example (reader finishes the last step).
- Independent problem.

**8. Make the reader retrieve, then space and mix.**
- Questions after every block.
- Practice that mixes earlier chapters (interleaving).
- Answers that point back to the block to reread.

**9. Close the loop.**
- Solve the opening problem with the chapter's blocks.
- Summarise.
- Point forward to where the ideas are used next.

**10. Write like a good manual — about 80% of the way.**
- One idea per sentence, usually 25 words or fewer; 20 or fewer in steps.
- Active voice and present tense.
- One word for one concept: no synonym rotation.
- Numbered steps for procedures, one action per step.
- Warnings in `> [!WARNING]`.
- No filler or hype words.
- Keep every fact, number and hedge: clarity never justifies dropping or distorting content.

**11. Accuracy first.**
- Being clear is never an excuse for being wrong.
- Flag approximations and say what is not known.
- Verify every number and every answer.

## Evaluation of the approaches considered

| Approach | Core idea | Track record | Adopted | Not adopted / caveats |
|---|---|---|---|---|
| **Learning progressions and scaffolding** — Anthropic *Claude for Teachers*, July 2026 | Teach competencies in the order learners typically acquire them, with support that is removed as skill grows | Anthropic's official teaching skills (lesson planning, differentiation, checks for understanding) were co-developed with Learning Commons and are open source | Concept inventory, dependency order, `Building Blocks` section, misconception-based distractors, "going deeper" boxes for different levels | Classroom-specific parts (state standards, lesson logistics) do not apply to self-study documents |
| **Rosenshine's Principles of Instruction** (2012) | Review prior learning; present new material in small steps; ask many questions; give models; check understanding; guide, then independent practice; review weekly and monthly | Drawn from cognitive science, classroom studies of the most effective teachers, and cognitive supports; widely used in teacher training | Building Blocks recap, one concept per block, a check after each block, worked examples, cumulative review | — |
| **Merrill's First Principles of Instruction** (2002) | Learning is promoted when it is problem-centred and cycles through *activation* (prior knowledge), *demonstration*, *application* and *integration* | A synthesis of the principles shared by many instructional design theories | Opening `[!PROBLEM]` solved at the end; activation (Building Blocks); integration (food for thought, summaries in your own words) | — |
| **Feynman-style explanation** | Mechanism before name; plain words; one honest analogy with its limits; say what nobody knows; check understanding by explaining it back | Feynman's lectures remain a model of physics teaching; several new Feynman agent skills appeared in 2026 | Mechanism before name, one analogy with limits, "explain it back" checkpoints, level ladder (`<details>` for depth) | The four-step "Feynman Technique" was assembled by later popularisers, and "if you can't explain it simply…" is misattributed to him — the skills do not cite either |
| **"Aircraft manual" writing** — ASD-STE100 Simplified Technical English; Karpathy, 2 Oct 2026 | Controlled language: short sentences, one instruction per sentence, active voice, ~900-word approved dictionary | Karpathy finds explanations "a lot more readable" and often asks for "80% of the way" to the standard; the open-source ASD-STE100 agent skill passed 5,500 GitHub stars in October 2026 | Sentence length, one idea per sentence, active voice, consistent terms, numbered one-action steps, warnings, no hype words | Not the full dictionary: in one published test, strict ASD-STE100 kept only 14 of 24 facts (versus 21 with a looser "simple technical English"), and ASD states STE is not meant for general writing. Form does not fix content — an empty paragraph stays empty |
| **Worked examples and cognitive load theory** (Sweller; expertise-reversal effect) | Beginners learn more from studying worked examples than from solving unaided; guidance that helps novices can hinder experts, so fade it | Among the most replicated findings in instructional research | Worked → partly worked → independent problems; explain symbols next to formulas (no split attention); short blocks | — |
| **Retrieval practice and spacing** (Dunlosky et al., 2013) | Of ten common study techniques, *practice testing* and *distributed practice* rated high utility; highlighting and rereading rated low | A major review of the evidence across ages, materials and settings | Questions after every block; recall checkpoints; flashcards with spaced repetition; interleaved review problems | Highlighting stays available in Margin, but the skills never rely on it as a learning method |
| **Mastery learning** (Bloom, 1984 — the "2 sigma" problem) | Students tutored to mastery with corrective feedback outperformed conventional classes by about two standard deviations | Classic result; later work suggests the full effect is hard to reproduce at scale, but mastery and feedback are consistently helpful | Each block checked before moving on; answers say which block to reread | — |
| **Direct Instruction** (Engelmann) — "faultless communication" | Choose examples and non-examples so only one interpretation is possible; juxtapose minimally different cases | Strong results in the large Project Follow Through evaluation; still debated | Example *and* non-example (near-miss) for each concept | Scripted classroom delivery does not apply |
| **Concrete → pictorial → abstract** (Bruner; Singapore mathematics) | Meet an idea as a concrete case, then a picture or diagram, then the symbols | Core of a widely admired mathematics curriculum | Order inside a block: concrete case → diagram (Mermaid or table) → formula | — |
| **Socratic tutoring skills** — the community `/teach` skill (from a "Learn Quiz" prompt credited to an Anthropic employee), Socratic skills, Claude's learning mode | Ask one question at a time; re-ask missed points in a new form until mastered | Popular for interactive study sessions | In a document: questions come before answers (folded reveals), food-for-thought prompts, variant questions in practice | Live dialogue is outside a reader's scope — use those skills alongside Margin, not inside documents |
| **Pólya, *How to Solve It*** (1945) | Understand the problem → make a plan → carry it out → look back | A classic of problem-solving teaching | Template for worked solutions: given/find → principle → working → check | — |

## Sources

- Anthropic, [Introducing Claude for Teachers](https://www.anthropic.com/news/claude-for-teachers) (14 July 2026), and [anthropics/k12-teacher-skills](https://github.com/anthropics/k12-teacher-skills)
- Rosenshine, *Principles of Instruction* — [Learning Difficulties Australia summary](https://ldaustralia.org/research-papers/principles-of-instruction-research-based-strategies-that-all-teachers-should-know/)
- [First Principles of Instruction](https://en.wikipedia.org/wiki/First_Principles_of_Instruction) (Merrill, 2002)
- [guicortei/feynman-technique](https://github.com/guicortei/feynman-technique) — Feynman-style explanation rules and notes on misattribution
- Search Engine Journal, [OpenAI Founding Member: Make LLMs Write Like An Aircraft Manual](https://www.searchenginejournal.com/karpathy-llm-aircraft-manual-writing/591813/) (2 Oct 2026)
- [ASD-STE100 skill review](https://andrew.ooo/posts/asd-ste100-skill-review-simplified-technical-english-for-agents/) — rules, limits, fact-retention test, popularity
- NSW CESE, [Cognitive load theory: research that teachers really need to understand](https://prod65.education.nsw.gov.au/content/dam/main-education/about-us/educational-data/cese/2017-cognitive-load-theory-summary.pdf); [Expertise reversal effect](https://en.wikipedia.org/wiki/Expertise_reversal_effect)
- Association for Psychological Science, [Which Study Strategies Make the Grade?](https://www.psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html) (Dunlosky et al., 2013)
- [Bloom's 2 sigma problem](https://en.wikipedia.org/wiki/Bloom%27s_2_sigma_problem)
- Stein, [The case for Direct Instruction](https://my.chartered.college/impact_article/the-case-for-direct-instruction/)
- [alexknowshtml/claude-skills — teach](https://github.com/alexknowshtml/claude-skills/blob/main/teach/SKILL.md)
