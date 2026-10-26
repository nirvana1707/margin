# Installing the Margin skills

Three skills teach an AI assistant (GitHub Copilot, Claude, or any tool that reads Agent Skills) to write Markdown that uses everything Margin offers.

```
margin-markdown/                 ← notes, explainers, deep dives, study guides
  SKILL.md
  references/example.md
  scripts/check_margin.py        ← optional checker (Python 3, standard library only)
margin-textbook/                 ← textbook chapters with questions, problems and an answer key
  SKILL.md
  references/sample-chapter.md   ← a complete chapter (also built into Margin as a sample)
  scripts/check_margin.py        ← same checker; cross-checks problems against the answer key
margin-course/                   ← plans a whole subject: building blocks → chapters → 00-course-map.md
  SKILL.md
  references/course-map-example.md
  scripts/check_margin.py
(each skill also has references/teaching-method.md — the building-block method and its sources)
copilot-instructions.md          ← short always-on version of margin-markdown
copilot-instructions-textbook.md ← short always-on version of margin-textbook
```

## GitHub Copilot in VS Code (agent mode / Copilot Chat)

Copy **all three** folders into one of these places:

| Scope | Windows | Linux |
|---|---|---|
| Just you, every project | `%USERPROFILE%\.copilot\skills\` | `~/.copilot/skills/` |
| One repository / notes folder | `<repo>\.github\skills\` | `<repo>/.github/skills/` |

Keep the folder names (`margin-markdown`, `margin-textbook`, `margin-course`) — each must match the `name` inside its `SKILL.md`.

Copilot picks the right skill from your request, or you can call one directly in Copilot Chat:

```
/margin-markdown  write a deep dive on Kubernetes networking and save it to notes/k8s-networking.md
/margin-textbook  write chapter 4 "Newton's Laws of Motion" as notes/physics/04-newtons-laws.md
/margin-textbook  convert notes/raw/thermo-answer.md into a textbook chapter: notes/physics/07-thermodynamics.md
/margin-course    plan a course on "Mechanics from first principles" for someone who knows basic algebra, in notes/mechanics/
```

Point Margin at the same folder (`margin.exe C:\path\to\notes`) and new chapters appear on your shelf as soon as Copilot saves them.

## Copilot chats without skill support

For **Microsoft 365 Copilot / Copilot on the web**, paste the text of `copilot-instructions.md` or `copilot-instructions-textbook.md` (everything below its heading) into Copilot's custom instructions, or at the start of a chat. Save the answer as a `.md` file in your Margin folder, or drag it into Margin.

For a **repository** where you want the rules always on, append the relevant file to `.github/copilot-instructions.md`.

## Other assistants

`SKILL.md` follows the open Agent Skills format, so the same folders also work with Claude (`~/.claude/skills/`) and other tools that read `.agents/skills/`.

## Checking a file

```
python margin-textbook/scripts/check_margin.py 04-newtons-laws.md
```

It flags terms used before they are defined, very long sentences and filler words, and reports structural problems (missing title or chapters, too few key terms, citation artefacts, unlabelled code, dollar signs that would turn into math) and, for textbook chapters: examples without solutions, quick checks without answers, MCQ options on one line, problems with no answer, answer-key letters that aren't valid options, and answer-key groups that don't match a problem set.
