# Software Development Expert Doctrine

> This is the consolidated, load-bearing rulebook for building software the "Agentic-Friendly" way.
> It distills the architecture logbook (`logbook.md`) into an operational methodology.
> When armed with this doctrine, an agent behaves as an expert software architect, not a blind code generator.

---

## 0. Core Philosophy

- **Agentic AND Human Friendly.** Every artifact must be trivially navigable by both an AI agent and a human engineer. Never optimize for one at the expense of the other.
- **Domain-Driven Design (DDD) by package, not by layer.** Group code by business domain (`cart`, `order`, `vendor`), never by technical layer (a global `repositories/` or `controllers/` folder).
- **Metadata is the map.** Every domain carries a `metadata.json` that declares what it *is*, what it *exposes*, and what it *depends on*. The agent reads the map before reading any source code.
- **Self-contained packages.** A domain owns its entities, repositories, API surface, infrastructure, and metadata. You can lift a domain folder into another repo and it stays coherent.

---

## 1. The Domain Package (Directory Shape)

```
domains/<name>/
├── api/            # public contracts: DTOs, interfaces, commands/queries/events (the ONLY cross-boundary surface)
├── entities/       # domain logic and invariants (private)
├── repositories/   # persistence adapters (private; the anti-corruption layer to the database)
├── infrastructure/ # external adapters, SDKs, network transport (private)
├── tests/          # unit + contract + integration tests (co-located)
└── metadata.json   # the domain's self-description (name, version, framework, deployment, exports, dependencies)
```

---

## 2. Boundaries & Communication

1. **No internal sharing.** A domain MUST NEVER import another domain's `entities`, `repositories`, or `infrastructure`.
2. **API only.** Cross-domain communication goes exclusively through the `api/` directory, using DTOs or public interfaces.
3. **Data autonomy.** Domains never share database tables and never query another domain's schema.
4. **Snapshot, don't link.** When a domain needs another domain's data (e.g. Order needs Product's price), it stores an immutable *snapshot* of that data, not a live reference to the external entity.
5. **Prefer domain events.** For cross-boundary side effects, publish a domain event (e.g. `OrderPlaced`). The publisher must not know who listens. This severs the dependency chain.
6. **Declared dependencies.** A domain's `metadata.json` explicitly lists which domains it depends on and exactly which commands/queries it consumes. Unauthorized dependencies are critical violations.

---

## 3. Function Evolution & Versioning

1. **Append-only public APIs.** A breaking change to a public function (new required input, changed output) means creating a `v2` — never silently mutating `v1`.
2. **Dependency tracking before refactoring.** Before modifying an exported function, scan every other domain's `metadata.json` to find consumers. Either keep `v1` intact or update the consumers in the same change.
3. **The contract test enforces this.** A test asserts that what `metadata.json` declares actually exists and resolves for every consumer.

---

## 4. Deployment Agnosticism (Monolith ⇄ Microservice)

1. **Interface segregation.** Domains interact via interfaces, never concrete classes.
2. **Adapters live in `infrastructure/`.** Whether a call is a local function or an HTTP/gRPC call is an *infrastructure* concern. Core business logic must be ignorant of how it is deployed.
3. **Metadata-driven deployment.** The `deployment.mode` field (`local` vs `network`) dictates which adapter loads. You can migrate a package from monolith to microservice without rewriting business logic.

---

## 5. Discoverability & Single Source of Truth

1. **Read metadata first.** When given a task, do NOT grep the whole codebase. Read the relevant `metadata.json` to map intent → domain → capability.
2. **Narrow context.** Once the domain is identified, read only files inside `domains/<name>/`.
3. **Bounded context enforcement.** A business capability is owned by exactly ONE domain. If two domains overlap in responsibility, HALT and ask the human to resolve the conflict. Do not guess.
4. **Ubiquitous language.** Naming must be 1:1. The command in `metadata.json`, the function in `api/`, and the user's words must match exactly. No silent translation ("remove" vs "delete" vs "destroy").

---

## 6. Toolchain & Framework Strictness

1. **Never reinvent the wheel.** Do not write raw low-level code (raw SVG paths, custom crypto, hand-rolled state management) when an approved library exists.
2. **The Approved Catalog.** Before solving a UI or utility problem, check the `shared`/`ui` domain's metadata for the sanctioned tooling.
3. **No unauthorized dependencies.** Never install a new library/framework without explicit human approval. Research, propose 2 options, wait.
4. **Prefer opinionated frameworks over vanilla.** An agent works best on "rails" — strict conventions and typing reduce boilerplate and hallucination.
5. **Strong typing is mandatory.** Generate TypeScript/Swift/Dart (not loose JS/Python) whenever the framework supports it. Types are the contract the agent reads to avoid breaking things.

---

## 7. Third-Party Integrations (Anti-Corruption Layer)

1. **Protect the core.** External SDKs, API responses, and vendor data models MUST NOT cross into `entities/` or `api/`.
2. **Translate at the boundary.** Map third-party data into internal DTOs immediately at `infrastructure/`.
3. **Local infrastructure vs. wrapper domain:**
   - Single-domain tool (e.g. a PDF generator for invoices) → put it in that domain's `infrastructure/`.
   - Broad capability used by many domains (payment, TTS, SMS) → create a dedicated wrapper domain (e.g. `domains/payment/`) that hides the vendor's complexity behind a clean internal API.

---

## 8. Uncertainty & Human-in-the-Loop (HITL)

1. **Never guess.** If a file path or domain owner cannot be definitively traced via `metadata.json`, do not invent one.
2. **Halt on ambiguity.** Zero matching domains or two matching domains → stop and ask which Bounded Context owns the feature.
3. **Escalate when:** a dependency is missing from the Approved Catalog; the request violates a boundary; the target domain is unclear.
4. **How to ask:** state the conflict, list the 2–3 most logical options, and wait. Be concise.

---

## 9. Subagent Orchestration & Isolation

1. **Orchestrator pattern.** The root agent manages subagents; subagents do not spawn subagents.
2. **Strict working directories.** Always scope a subagent's `cwd` to its assigned domain folder. No global scope except for read-only audits.
3. **No concurrent writes to shared resources.** Never spawn two subagents that write to the same domain at once. Sequence those writes.
4. **Stateless, short-lived by default.** One bounded task, one domain, then terminate. Return a structured report (files changed, tests run, decisions, open questions) — not intermediate reasoning.
5. **Minimal payload.** Give a subagent only: task, `cwd`, its domain `metadata.json`, a pointer to the doctrine, acceptance criteria, and the return format. Never dump the whole repo/chat.
6. **Cross-domain features** → break into non-overlapping tasks; if overlap is unavoidable, the root agent applies the final merge itself.

---

## 10. Research & Knowledge Cutoffs

1. **Assume outdated pretraining** for volatile external APIs (OS kernels, cloud SDKs, new framework versions). Fetch the latest official docs/signatures before integrating.
2. **No blind tool discovery.** Never search-and-install random packages. Research standards, propose, wait for approval.
3. **Build vs. buy.** Write custom code for business logic; use established, approved dependencies for generic plumbing (crypto, DB drivers). Never hand-roll security primitives.

---

## 11. Testing Discipline

1. **Test-first, per-change.** A command/query is incomplete until its test passes. Prefer TDD: failing test → minimal implementation → green → refactor.
2. **Co-locate tests** in `domains/<name>/tests/`, never a global `/tests`.
3. **Contract tests are mandatory.** Every export in `metadata.json` must have a test asserting the real `api/` code matches the declared version and that consumer dependencies resolve.
4. **Three layers of testing:** unit (domain logic) → contract (metadata ↔ code) → integration (cross-boundary via `api/`).
5. **Escalation:** the subagent runs local tests after each change; the orchestrator re-runs before integrating; CI is the final gatekeeper (suite + types + lint + boundary checks).

---

## 12. Persistence & State

1. **Files vs. database.** Config/static data → files. Mutable business state → database. Never mix.
2. **Per-domain storage.** A domain owns its schema/DB. Monolith → schema-per-domain; microservice → DB-per-service. No shared tables.
3. **Default engine: PostgreSQL** (ACID, strong constraints). Redis for cache/counters. Justify anything else per-domain.
4. **Atomic updates.** For counters use `quantity = quantity + 1` (atomic SQL), never read-modify-write.
5. **Event-driven propagation.** Real-time cross-domain updates use domain events + read-model projections (Outbox/CDC), never polling or direct table writes.
6. **Validation = defense in depth (three layers):** frontend (UX only) → backend domain (authoritative rules) → database (final constraints: NOT NULL/CHECK/UNIQUE/FK/trigger). Never rely on frontend alone.
7. **Repository pattern.** All SQL is contained in `repositories/`. Complex/security-sensitive logic may be exposed as DB functions/views the backend *calls* (DB-as-API), mirroring the domain `api/` concept.
8. **Engine-agnostic domain.** Business logic never depends on a specific DB's behavior; the repository adapter is the anti-corruption layer.

---

## 13. Context & Readability

1. **Just-in-time context.** Never assume the whole codebase is pre-loaded. Boot sequence: read the doctrine (this file), then read only the relevant domain's `metadata.json`.
2. **Keep artifacts human-readable.** Never write docs/metadata/code in "AI-only" shorthand. Standard Markdown and JSON only.
3. **Trust runtime compression.** Let the harness compress *conversation memory*; keep the actual repository files clean.

---

## 14. Failure Handling & Escalation

When a solution "doesn't work out", respond with an **escalation ladder keyed on diagnosis, never on stubbornness.** Never repeat the same attempt without new information.

1. **Localize the failure first.** Classify before acting: (a) correctness bug (specific, fixable), (b) design mismatch (the approach fights the problem), (c) performance/scale ceiling, or (d) requirements gap (solving the wrong thing). Blind retry without this classification is the #1 waste.
2. **Escalate by the cost of new information, cheapest first:**
   - **Research prior art** — the highest-leverage, most-skipped move. If something "doesn't work", someone has almost certainly hit it: search the exact error, the pattern, the library issue. (Example: "generate diagrams" → text-DSL renderers, not image-gen.)
   - **Re-examine assumptions** — stop coding, restate the problem. Often the boundary or requirement was wrong, not the code.
   - **Time-boxed retry** — for a small, well-understood bug, fix it. But cap 2–3 focused attempts on the SAME hypothesis; beyond that, persistence is superstition.
   - **Change solution class** — switch the paradigm (polling→events, image-gen→text-DSL, big-bang→incremental).
   - **Human-in-the-loop** — when it is a tradeoff decision or a requirements ambiguity, ask (Section 8). Never burn effort guessing.
3. **Refuse these anti-patterns:** (a) "try harder with the same thing", (b) rewrite from scratch without knowing the root cause, (c) jump to a shiny alternative without understanding WHY the old one failed.
4. **Log every dead-end and the lesson** — that is what `logbook.md` is for — so we do not fail the same way twice.
