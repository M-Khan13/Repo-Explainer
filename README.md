# Repo Explainer

**Ask a codebase how it works, and get answers grounded in real files and line numbers — not a hallucination.**

Point it at a public GitHub repo. It clones the code, splits it into function- and class-level chunks using a real parser, embeds them, and answers natural-language questions ("how does authentication work?", "where are orders created?") using only the code it retrieved — citing the exact `file:line` each claim came from, or refusing when the answer isn't in the retrieved code.

Built from scratch — no LangChain, no LlamaIndex — because the point was to understand every piece of the retrieval stack, not wire a library. This is the flagship in a deliberate three-project arc: **Café Ops** (full-stack app) → **RAG Document Q&A** (learn retrieval on documents) → **Repo Explainer** (apply that retrieval stack to code).

> **Status:** Core pipeline complete and evaluated (ingest → chunk → embed → retrieve → grounded generation → eval harness). Web UI is the current work-in-progress; today the pipeline runs via Node scripts. See [Roadmap](#roadmap).

---

## What it doess

Two flows, kept deliberately separate — the same split as any RAG system:

- **Ingest** (once per repo): clone → walk source files → parse → chunk → embed → store.
- **Query** (per question): embed the question → rank all chunks by similarity → hand the top matches to an LLM → return a grounded, cited answer.

The LLM never sees the repo. It only ever sees the handful of chunks retrieval selected, plus a strict instruction to answer from those alone. That constraint is what makes the answers trustworthy: when the retrieved code doesn't contain the answer, the system returns a fixed refusal string instead of inventing one.

---

## How it works

```
GitHub URL
    │
    ▼
 clone (git --depth 1, into an isolated temp dir)
    │
    ▼
 walk  ── keep source files, skip node_modules / dist / .git / lockfiles / binaries
    │
    ▼
 parse (tree-sitter → real syntax tree per file)
    │
    ▼
 extract ── function / class / declaration chunks, each tagged with file path + start/end line
    │        └─ fallback: line-window oversized chunks and declaration-free files
    ▼
 embed (nomic-embed-text via Ollama, 768-dim)
    │
    ▼
 store (MongoDB, one document per chunk: metadata + embedding + repo tag)


 Question ─► embed ─► cosine-rank all chunks ─► top-k ─► LLM (grounded prompt) ─► answer + [n] citations
```

Every citation the model emits is a number keyed to a context block that **the pipeline labeled with the real `file:line` before the model ever saw it**. The model selects which block it used; it never generates the line numbers. That's why the grounding is verifiable rather than trusted — the line numbers come straight from the parser and ride through the metadata untouched.

---

## The eval harness — the part that matters

Anyone can wire an embedding model to an LLM and call it RAG. The question is whether the retrieval actually works, and the only honest way to answer that is to measure it. So the project ships an evaluation harness, and the findings below are real results against my own Café Ops repo — a codebase I know cold, which is exactly why it's the ground-truth target.

**Method.** A fixed set of 10 "how/where" questions, each tagged with the file(s) that genuinely answer it. The harness runs each question through retrieval and scores **hit@k**: did a chunk from the right file land in the top-k results? This scores *retrieval only* — no LLM involved — so it's deterministic, free, and fast. Generation quality is a separate concern; retrieval is the thing that decides whether generation even has a chance.

**Baseline: `hit@6 = 9/10 (90%)`** — with syntax-aware chunks, file-path/symbol-prefixed embeddings, and k=6.

**Tuning experiment 1 — and the reason this project exists.** The retrieved results included some very short chunks (a 40-character `require` import ranking near the top). The intuitive fix: drop chunks under 50 characters as noise. I tested it instead of assuming it.

**Result: it got worse — `9/10 → 8/10`.** A short chunk was load-bearing for one question; removing "noise" deleted a real answer. The intuitive optimization was wrong, and only measurement caught it.

This reproduces the exact finding from the RAG Document Q&A bridge project, where the baseline chunking beat both attempted improvements. Two independent projects, same lesson: **measure, don't assume.**

**Characterized boundary (stated honestly).** Retrieval is strong on *"what/where is X defined"* — single-file, declaration-shaped questions hit 9/9. It's weaker on *"how does this cross-file behavior work"*, where the mechanism is spread across several files (e.g. real-time updates living in both a client socket module and server setup). That's not a bug to hide — it's a real, explainable limit of declaration-based retrieval, and naming it precisely is the point.

---

## Chunking: why syntax-aware

Documents tolerate being split at arbitrary character counts. Code does not — a character split severs a function mid-body, and neither half retrieves meaningfully. So chunks are cut on real syntax boundaries using **tree-sitter**: each function, class, or top-level declaration becomes one chunk, tagged with its file path and exact line range.

Two fallbacks handle the cases pure declaration-extraction misses, both implemented as the same line-windowing operation:

- **Oversized declarations** — a 200-line React component embeds to mush, so it's split into overlapping line windows.
- **Declaration-free files** — entry points like `main.jsx` are top-level expressions with nothing to extract, so the whole file is windowed.

Windows overlap by 10 lines so a concept sitting on a boundary isn't half-present in two chunks and whole in neither. Line offsets are translated back to real file positions, so a window inside a large component still cites the correct absolute lines.

Using a parser here doesn't contradict the "build the RAG loop by hand" rule — that rule is about the retrieval mechanics (embeddings, cosine, grounding), which *are* hand-rolled. A parser is an ingestion primitive, the same category as `pdf-parse` in the document version. Hand-rolling a multi-language function extractor with regex would be a scope trap with nothing to prove.

---

## Tech stack & decisions

Every choice below comes with its tradeoff, because a decision without a tradeoff is just a default.

| Choice | Why | Tradeoff / when I'd change it |
|---|---|---|
| **Node / Express** | Home turf; the whole retrieval loop is I/O-bound HTTP calls | Python has a richer ML ecosystem; would matter if I needed heavy local model work |
| **tree-sitter (WASM build)** | Real syntax trees, one API across ~30 languages via swappable grammars | WASM is slower than native — but native wouldn't compile (see below) |
| **nomic-embed-text via Ollama** | Local, free, no API cost per chunk, 768-dim | Can't be reached by a hosted server; a public deploy needs a cloud embedding swap |
| **Hand-rolled cosine similarity** | 107 chunks is nothing; a brute-force loop is instant and keeps the math visible | Atlas Vector Search is the move at ~100k+ chunks — deferred until scale justifies the infrastructure |
| **MongoDB** | One document per chunk, metadata + vector together, trivial `repo`-tag filtering | A dedicated vector DB (or Atlas Vector Search) once retrieval outgrows brute force |
| **Gemini (grounded prompt)** | Free tier, strong instruction-following for "answer only from context" | Swappable — generation is behind one function |

**The tree-sitter build story** (worth telling because it's the kind of thing that comes up in interviews): the native `tree-sitter` binding won't compile on Node 24 — V8's headers now require C++20 and the package builds against an older standard, with no prebuilt binary for Apple Silicon. Switching to the WASM build (`web-tree-sitter`) removes the compiler from the equation entirely, so Node upgrades stop breaking the build. That introduced a second issue — an ABI mismatch between the newest runtime and the pre-built grammar files — resolved by pinning `web-tree-sitter@0.24.7` to match the grammar package. Pinned deliberately, and commented as such.

**A few smaller decisions that carry real weight:**

- **`execFile`, not `exec`, for cloning** — `exec` runs through a shell, so a malicious repo URL could carry a command-injection payload. `execFile` passes arguments directly to git with no shell to inject into. This matters the moment you accept arbitrary user URLs.
- **`git clone --depth 1`** — the current tree is all that's needed; history is dead weight. Dramatically faster and smaller on large repos.
- **Isolated temp dir per ingest** (`mkdtemp`) with cleanup in a `finally` block — concurrent ingests can't collide, and the directory is removed whether ingestion succeeds or throws.
- **Idempotent ingest** — each run deletes the repo's existing chunks before inserting, so re-ingesting the same repo never stacks duplicates that would quietly poison retrieval.
- **Sequential embedding, not `Promise.all`** — 107 concurrent requests would hammer the local embedding server; one at a time is slower but reliable, with progress logging so the wait is legible.
- **Allowlist extensions, blocklist directories** — supported languages are a closed set I control (allowlist); junk directories are open-ended and unpredictably named (blocklist the usual suspects). Lockfiles, images, and binaries are excluded for free by simply not being on the extension allowlist.

---

## Project structure

```
src/
  ingest/
    clone.js      # shallow clone into a temp dir, + cleanup
    walk.js       # recurse, filter to source files
    ingest.js     # orchestrator: clone → walk → chunk → embed → store
  chunk/
    parse.js      # tree-sitter WASM setup, cached parser
    extract.js    # declaration → chunk, with export unwrapping
    window.js     # line-window fallback for oversized / declaration-free files
  embed/
    embed.js      # nomic-embed-text over Ollama HTTP
  db/
    mongo.js      # cached Mongo client
  query/
    similarity.js # hand-rolled cosine
    retrieve.js   # embed question → rank all chunks → top-k
    generate.js   # grounded prompt → LLM → cited answer
  eval/
    questions.js  # ground-truth eval set
    run.js        # hit@k scorer
```

---

## Running it

**Prerequisites**

- Node 18+ and `git` on PATH
- [Ollama](https://ollama.com) running locally with the embedding model:
  ```bash
  ollama pull nomic-embed-text
  ```
- A MongoDB connection string (local or Atlas)
- A Gemini API key

**Setup**

```bash
git clone https://github.com/M-Khan13/Repo-Explainer.git
cd Repo-Explainer
npm install
cp .env.example .env   # then fill in the values below
```

**Environment variables** (`.env`)

| Variable | What it's for | Example |
|---|---|---|
| `MONGO_URI` | Chunk + embedding storage | `mongodb+srv://...` |
| `OLLAMA_URL` | Local embedding server | `http://localhost:11434` |
| `GEMINI_API_KEY` | Grounded answer generation | `AIza...` |

**Ingest a repo, then query it** (current script-based flow):

```js
import { ingestRepo } from "./src/ingest/ingest.js";
import { retrieve } from "./src/query/retrieve.js";
import { generate } from "./src/query/generate.js";

await ingestRepo("https://github.com/M-Khan13/Cafe-opps", "cafe-ops");

const hits = await retrieve("how does authentication work", "cafe-ops");
console.log(await generate("how does authentication work", hits));
```

**Run the eval harness:**

```bash
node src/eval/run.js
```

---

## Known limitations

Stated plainly, because a project with zero listed limitations is a project nobody thought hard about.

- **Route handlers written as call expressions** (e.g. `router.post('/', handler)`) are not declarations, so declaration-based extraction skips them. This is the single clearest chunker gap and the direct cause of the weaker "how is X created" retrieval.
- **Cross-file "how does this behave" questions are weaker** than single-file "where is X defined" questions — a measured, characterized boundary, not a surprise.
- **Local embeddings only.** Because embedding runs on local Ollama, the pipeline can't currently be deployed to a public server without swapping in a cloud embedding provider.
- **Public repos only.** Private-repo authentication is deferred.
- **JavaScript / JSX today.** The parser supports ~30 languages via swappable grammars; wiring additional languages (e.g. Python) is a one-line path change, not yet done.
- **No web UI yet.** The pipeline runs via Node scripts; the chat interface is the current work.

---

## Roadmap

- **Web UI** — repo-URL input, chat interface, syntax-highlighted retrieved snippets, and clickable `file:line` citations that deep-link to the GitHub blob at that exact line.
- **Deploy** — swap local Ollama for a cloud embedding provider so the demo is a link, not a local run.
- **Chunker fix** — extend extraction to catch route handlers and other call-expression patterns, then *measure* the retrieval delta against the 9/10 baseline rather than assuming it helps.
- **Optional CLI** — `npx repo-explainer <url>` over the same core, since the RAG logic is decoupled from any interface. One core, two front-ends.
- **More languages** — wire additional tree-sitter grammars and expand the eval set to match.

---

## What I learned

The technical takeaway is that retrieval quality, not model choice, is what makes or breaks a code-Q&A system — and the only way to know your retrieval works is to build the thing that measures it. The harder, more useful takeaway was watching an "obvious" optimization make the system *worse*, twice, across two separate projects. Intuition about what improves retrieval is unreliable; a fixed eval set and a baseline number are not. Almost everything I'd change next is written as an experiment to run and measure, not a fix to apply — which is the habit the whole arc was built to develop.

---
