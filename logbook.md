# Architecture Logbook

## Session 1: Initial Architecture Design
**Date:** 2026-11-20

### Core Concept
- **Agentic & Human Friendly Framework**: Designing an architecture that makes it easy for both AI agents and human developers to understand, navigate, and modify.
- **Domain-Driven Design (DDD) by Package**: Grouping codebase by domain (e.g., Client, Vendor, Cart, Order) rather than by technical layers (Controllers, Repositories, Services).
- **Self-Contained Packages**: Each domain contains its own Entities, Repositories, API surface, Infrastructure, and Metadata. 
- **Metadata-Driven**: Each domain has metadata detailing its boundaries, capabilities, and dependencies.

### Scenario: E-Commerce Ordering
- **Flow**: Client adds product to Cart -> Client places Order -> Vendor receives Order.
- **Domains Identified**: 
  1. `client`: Manages customer profiles and actions.
  2. `product`: Manages items available for sale.
  3. `cart`: Manages the pre-checkout collection of products.
  4. `order`: Manages the checkout and final transaction lifecycle.
  5. `vendor`: Manages the seller profiles and fulfillment operations.

### Decisions Made
- Avoid monolithic folders (e.g., no global `/repositories` or `/entities`).
- Created a `domains/` directory where each sub-folder is an independent, cohesive domain package.
- Injected a `metadata.json` placeholder in each domain to fulfill the "DDD + metadata" requirement.

## Session 2: Cross-Boundary Communication & Decoupling
**Date:** 2026-11-20

### Problem 1: Cross-Boundary Communication (Order needing Product)
- **Scenario**: Order needs product details (price, stock) to process checkout.
- **Risk**: If Order directly queries Product's database or internal entities, the boundaries are violated (tight coupling).
- **Solution**: 
  - **Strict Public API**: The `product/api` directory exposes stable, versioned interfaces or Data Transfer Objects (DTOs). The `order` domain only ever imports from `product/api`, never from `product/entities` or `product/repositories`.
  - **Anti-Corruption Layer**: `Order` translates the `ProductDTO` into its own `OrderLineItem` entity. Order doesn't hold a reference to the `Product` entity, just its ID and snapshotted data (like price at the time of order).

### Problem 2: Cascading Changes (Modifying Order breaks other domains)
- **Scenario**: A change in Order's internal logic accidentally breaks Vendor or Client.
- **Risk**: "Spaghetti code" where domains are deeply intertwined.
- **Solution**:
  - **Stable Contracts (Interfaces)**: Internal refactoring within `Order` must not change the function signatures exposed in `order/api`. If the API must change, it is versioned.
  - **Event-Driven Architecture (EDA)**: Instead of `Order` calling `Vendor.notifyOrder()`, `Order` publishes a domain event (`OrderPlaced`). The `Vendor` domain listens for this event. `Order` has zero knowledge of who is listening, meaning changes to `Order` won't break `Vendor`.
  - **Agent/Linter Enforcement**: Use `metadata.json` to declare dependencies. An architecture test (or Agent rule) will strictly forbid `import vendor/entities/...` from the `order` domain.

## Session 3: Function Signatures, Microservices & Metadata Strategy
**Date:** 2026-11-20

### Problem 3: Modifying Function Signatures (Inputs/Outputs)
- **Scenario**: A function in `product/api` changes its parameters or return type. How do we prevent breaking `order`?
- **Solution**:
  - **Never break existing contracts, extend them**: Use API Versioning (`v1/getProduct`, `v2/getProduct`).
  - **Dependency Tracking in Metadata**: A package's metadata explicitly lists the exact functions and versions it consumes from other packages. 
  - **Agentic Refactoring**: When a human asks an Agent to modify a function, the Agent checks the metadata of *all* other domains. If it sees `order` depends on `product.getPrice(id)`, the Agent knows it must either create a `v2` or safely update the `order` domain simultaneously.

### Problem 4: Monolith vs. Microservices 
- **Scenario**: A package might be compiled as a local library in a Monolith, or deployed as a standalone Microservice over the network.
- **Solution**:
  - **Transport-Agnostic API**: The `api/` directory defines *Interfaces* (Contracts). The `infrastructure/` directory contains the actual *Adapters* (e.g., `LocalProductAdapter` vs `HttpProductAdapter`).
  - **Deployment Metadata**: The metadata file dictates the current deployment mode (`"mode": "local"` vs `"mode": "network"`). The framework reads this metadata and automatically injects the correct adapter. This allows switching a monolithic package to a microservice without changing business logic!

### Decision: Where does Metadata live?
- **Storage Location**: Every package gets its own `metadata.json` located strictly inside its boundary (e.g., `domains/product/metadata.json`). 
- **Why?**: Decentralization. If you drag-and-drop the `product` folder into a new repository, it takes its metadata with it. 
- **Role of AGENTS.md**: `AGENTS.md` does *not* store the data. It stores the **Laws** of the framework (how an AI should read/write the `metadata.json`, and how to respect the boundaries).

## Session 4: Agent Discoverability & Single Source of Truth
**Date:** 2026-11-20

### Problem 5: How does an Agent find where to code? (Avoiding Full-Codebase Scans)
- **Scenario**: User says "in the cart, the user must be able to remove an item." How does the AI know where to look without reading thousands of files?
- **Solution**: 
  - **Metadata as the Map**: The AI does *not* scan source code first. It scans the `metadata.json` of each domain. The metadata acts as an index of capabilities. 
  - **Process**: The AI sees the keyword "cart", reads `domains/cart/metadata.json`, looks at the exported `commands` array, and checks if a `removeItem` command exists. If not, it knows exactly where it needs to be added (`domains/cart/api`).

### Problem 6: Blurred Responsibilities & Ambiguity
- **Scenario**: What if "remove item" is ambiguously handled by both `Order` and `Cart`? How does the agent ensure it edits the right one?
- **Solution**:
  - **Strict Bounded Contexts (DDD)**: In this architecture, overlapping responsibilities are illegal. A specific business capability must be owned by exactly *one* domain. 
  - **Agentic Verification**: If an Agent scans the metadata and finds that two domains claim to manage "items in a pre-checkout state", the Agent's instructions (`AGENTS.md`) dictate it must **stop and alert the human** of an architectural violation, rather than guessing.
  - **Ubiquitous Language**: The naming in code must exactly match the naming in the metadata, which matches the human's language. "Cart" = `cart` domain. "Remove Item" = `RemoveItemCommand`.

## Session 5: Asset Creation & Dependency Management
**Date:** 2026-11-20

### Problem 7: Reinventing the Wheel vs. Dependency Bloat
- **Scenario**: The user asks to "draw an icon for the cart." Does the AI write raw SVG/assembly, guess a framework to download, or use something else?
- **Risk**: If the AI writes raw code (assembly/raw SVGs), the codebase becomes unmaintainable. If the AI searches the web and installs random frameworks (e.g., FontAwesome today, MaterialIcons tomorrow), the project suffers from severe dependency bloat and inconsistency.
- **Solution**: 
  - **The Approved Catalog (Shared Core)**: The framework must have a designated `shared/` or `infrastructure/ui/` domain that acts as the single source of truth for approved third-party libraries and design systems.
  - **Constrained Tooling**: The Agent is instructed *never* to invent a low-level implementation if a high-level abstraction exists in the Approved Catalog. 
  - **No Unauthorized Installs**: The Agent cannot run `npm install <random-package>` without explicit human approval. It must first search the `metadata.json` of the Shared UI domain to see if an icon library (e.g., Lucide, HeroIcons) is already installed.
  - **Delegation to specialized tools**: If the task requires actual graphic generation (not just a code library), an Agent-Friendly environment provides specific tools (like a `generate_image` API) rather than expecting the code-generation LLM to output pixel data.

## Session 6: Framework Selection vs. "Vanilla" Code
**Date:** 2026-11-20

### Problem 8: "Zero Framework" vs. Heavy Frameworks (Electron, Flutter, Swift)
- **Scenario**: Should the AI build everything from scratch (Vanilla JS, raw C++) or use established frameworks? Which is easier for an AI?
- **Analysis**:
  - **Zero Framework (Vanilla)**: While it has no "hidden magic", it requires writing massive amounts of boilerplate (DOM manipulation, state management, routing). For an AI, massive boilerplate = context window exhaustion and a high probability of introducing subtle bugs.
  - **Established Frameworks**: LLMs are trained on billions of lines of React, Flutter, and Swift code. They deeply understand the conventions of these frameworks.
- **Solution**: 
  - **AI prefers Opinionated Frameworks**: An Agent works best on "rails". Frameworks with strong conventions, strict typing (TypeScript, Swift, Dart), and clear architectural patterns are much easier for an AI to modify safely than a "wild west" vanilla codebase.
  - **Choosing the Tool for the Job**:
    - *Desktop*: Electron (if web-skills overlap is high) or Tauri (for better performance/security).
    - *Mobile*: Flutter or React Native (cross-platform efficiency is great for AI).
    - *Native Apple*: Swift / SwiftUI.
  - **Explicit Declaration**: The chosen framework MUST be explicitly declared in the domain's `metadata.json` so the Agent instantly knows what "dialect" of code to write, without having to guess by reading file extensions.

## Session 7: Context Window Management & Statelessness
**Date:** 2026-11-20

### Problem 9: The Context Window Limit
- **Scenario**: Because LLM API calls are stateless, every new message needs context. If we inject the entire chat history and all files into the prompt, we will quickly hit the token limit, increase costs, and the AI will suffer from "attention degradation" (forgetting things in the middle of massive text).
- **Solution**: 
  - **Do NOT inject everything**: We completely avoid dumping the whole codebase or massive chat histories into the prompt.
  - **The "Brain" vs. The "Map"**:
    - **AGENTS.md (The Brain)**: This file contains the *absolute vital rules*. In an agentic system, the contents of `AGENTS.md` should be passed in the "System Prompt" or injected at the very beginning of the session. It is short, dense, and permanent.
    - **metadata.json (The Map)**: We do not tell the AI about the Cart's framework when it is working on the Vendor. The AI dynamically reads the target domain's `metadata.json` *on-demand* to get the local context (e.g., "Oh, this domain uses Flutter").
  - **Logbook / Summarization**: Past conversations are compressed. Instead of injecting 50 pages of chat history, the chat history is compressed into the dense `logbook.md` findings. 

## Session 8: Third-Party Integrations & Anti-Corruption
**Date:** 2026-11-20

### Problem 10: Integrating External Services (Stripe, Google Maps, TTS)
- **Scenario**: The system needs to talk to a bank payment gateway or a remote AI TTS model. Do we couple this into existing domains, or create new ones?
- **Risk**: If third-party SDKs (like Stripe's API or Google Maps objects) leak into our core business logic, the entire app becomes tightly coupled to that specific vendor. If the bank changes its API, our `Order` domain breaks. Furthermore, asking an AI to understand a massive third-party API documentation wastes context tokens.
- **Solution: The Anti-Corruption Layer (ACL)**:
  - **Rule of Thumb**: External APIs MUST NEVER leak into the `entities` or `api` folders. We wrap them in adapters.
  - **When to put it in `infrastructure/`**: If a service is *only* used by one domain (e.g., only the `vendor` domain needs Google Maps for routing), we install the Google Maps SDK into `domains/vendor/infrastructure/`. The `vendor/entities` define a clean, generic interface (e.g., `IRouteCalculator`). The infrastructure folder implements that interface using Google Maps.
  - **When to create a new Domain**: If a service is a major business capability used by multiple domains (e.g., a Bank Payment Gateway used by `order`, `subscriptions`, and `refunds`), we create a brand new domain: `domains/payment`. 
    - The `payment` domain encapsulates all the messy bank logic in its `infrastructure/` folder.
    - It exposes a clean, perfectly tailored API in `domains/payment/api/` and documents it in `metadata.json`.
    - Now, the AI agent working on `Order` doesn't need to learn the Bank's API. It just reads `payment/metadata.json` and calls our clean, internal `processPayment` command!

## Session 9: Uncertainty & Human-in-the-Loop (HITL)
**Date:** 2026-11-20

### Problem 11: Guessing vs. Asking
- **Scenario**: The human asks for a feature, but it's not clear which domain owns it, or the file doesn't exist yet. Does the AI guess a file path, or stop and ask?
- **Risk**: "Guessing" leads to hallucinated file paths, duplicated logic, and broken architectures. If the AI guesses wrong, the human has to spend time debugging the AI's mistakes.
- **Solution**: 
  - **"Halt and Catch Fire"**: In an agentic framework, guessing is strictly forbidden. If an AI cannot definitively map an intent to a domain via `metadata.json`, it must halt and explicitly ask the human.
  - **No "Magic Prompts" Required**: The human shouldn't have to say "don't guess" every time. The framework's core rules (`AGENTS.md`) force the AI into a "high confidence or ask" posture.
  - **Effective Phrasing**: Humans can speed up the process by using the Ubiquitous Language defined in the metadata (e.g., "In the Vendor domain...") or explicitly inviting questions (e.g., "I need a discount feature, ask me where it goes if you can't find the domain").

## Session 10: Subagent Concurrency & Orchestration
**Date:** 2026-11-20

### Problem 12: Subagent Race Conditions
- **Scenario**: DSH allows spawning multiple subagents concurrently. If Agent A and Agent B try to modify the same file (e.g., adding different commands to `cart/metadata.json` simultaneously), one will overwrite the other, causing silent code loss.
- **Solution**: 
  - **Physical Isolation via Domains**: The DDD architecture naturally prevents most collisions. If Subagent A is assigned to the `order` domain and Subagent B is assigned to the `product` domain, their file paths (`domains/order/*` vs `domains/product/*`) have zero overlap.
  - **The Orchestrator Pattern**: The Root Agent (Lead) acts as the Orchestrator. It never spawns two subagents to work on the exact same domain at the exact same time.
  - **Sequential Integration**: For features that cross domains, the Root Agent either fans out read-only tasks (e.g., using the `workflow` tool to audit multiple domains) or sequences the writes (e.g., "Agent A, update Product. Once finished, Agent B, update Order").
  - **Scoped Working Directories**: When spawning a subagent in DSH, the Root Agent restricts the child's `cwd` (Current Working Directory) to its assigned domain (e.g., `cwd: "/domains/cart"`). This creates a physical sandbox preventing the subagent from accidentally wandering into another domain and causing a conflict.

## Session 11: Context Delivery & Compression Strategy
**Date:** 2026-11-20

### Problem 13: Passing the Rules to the LLM (Context Management)
- **Scenario**: We now have dozens of rules in `AGENTS.md` and metadata across multiple domains. Do we send all this to the LLM every time? Do we compress it into an "AI-only" unreadable format?
- **Solution**: 
  - **Just-In-Time (JIT) Reading**: We do NOT send all the files to the LLM. The LLM session starts only with the system instructions. The Agent is instructed to actively `read` the `AGENTS.md` file to load the architecture rules into its working memory, and then `read` specific `metadata.json` files ONLY for the domains it is currently modifying.
  - **Active Chat Compression**: The DeepSeek Harness runtime features active conversation compression. Old conversation turns are folded into extremely dense, scannable summary blocks. This keeps the prompt tiny without losing vital context.
  - **Human-Friendly trumps AI-Only formats**: While we *could* compress rules into a highly cryptic AI-shorthand, we explicitly choose standard Markdown (`AGENTS.md`) and JSON (`metadata.json`). Why? Because this framework is "Agentic *AND* Human Friendly". Humans must be able to easily audit, debug, and understand the rules. The compression happens in the LLM's *chat memory*, not in the *codebase files*.

## Session 12: Web Search, Knowledge Cutoffs & Supply Chain
**Date:** 2026-11-20

### Problem 14: When to Search the Web vs. Build vs. Ask
- **Scenario**: The agent needs a tool it doesn't have, or is working on a fast-moving target (like a newly updated Linux Kernel API). Does it search the web? Does it build it from scratch? 
- **Risk**: 
  - *Blind Searching*: Randomly searching and installing tools introduces severe security risks (Supply Chain Attacks) and framework bloat.
  - *Not Searching*: The LLM has a knowledge cutoff date. If it tries to write code for a Kernel API that changed last month, it will confidently write broken, outdated code (Hallucination).
- **Solution**:
  - **Targeted Documentation Search (Overcoming Cutoffs)**: For external systems, APIs, or specific frameworks (e.g., Kernel modules, Stripe APIs), the Agent MUST use its `web_search` or `domain_search` tools to pull the *official, latest documentation* before writing code.
  - **Zero Trust Tool Discovery**: The Agent does NOT search the web for "best npm package for X" and blindly install it. If a new framework or major dependency is needed, the Agent researches options, presents a short brief to the human, and waits for explicit approval.
  - **Build vs. Integrate**: If it is core domain business logic, build it. If it's a generic technical problem (e.g., cryptography, DB drivers), integrate a standard, human-approved library. Never write custom cryptography or custom DB drivers.

## Session 13: Testing Strategy & Subagent Lifecycle
**Date:** 2026-11-20

### Problem 15: When / Where / Who tests?
- **When**: Immediately, per-change, inside the domain. Prefer TDD (write failing test -> implement -> green -> refactor). A command/query is not "done" until its test passes.
- **Where**: Tests co-located with the domain (`domains/cart/tests/`). Three levels:
  1. Unit: entity/domain logic inside the domain.
  2. Contract: verify `metadata.json` exports (signatures/versions) match real `api/` code, AND that a consumer domain's declared dependency still resolves (catches the "modified a function signature" cascade).
  3. Integration: cross-boundary behaviour via the `api/` contract.
- **Who**: (a) the subagent that made the change runs local tests; (b) the Orchestrator (lead) reviews the diff and re-runs tests before integrating; (c) CI is the automated final gatekeeper (full suite + type check + lint + boundary/architecture tests).

### Problem 16: Subagent Lifecycle
- **Stateless & short-lived by default**: A subagent appears to do ONE bounded task in ONE domain, then returns a structured report and ends. It does NOT persist between tasks.
- **What we give a subagent (NOT the whole dataset)**: (1) the task in domain language, (2) `cwd` scoped to its domain, (3) the domain's `metadata.json`, (4) pointer to `AGENTS.md`, (5) acceptance criteria, (6) required return format.
- **What we expect on termination**: a structured report — files changed, tests run + results, decisions made, open questions. We do NOT receive its intermediate thinking.
- **Long-lived subagents**: reserved for iterative work that genuinely builds on its own prior turns (rare). If used, it keeps its own scoped memory; still never receives unrelated domains' data.

## Session 14: Database & Persistence Strategy
**Date:** 2026-11-20

### Problem 17: How & where to persist data
- **Static files vs DB**: Static/config data (metadata.json, Approved Catalog, seed config) -> static files. Mutable business state (cart, orders, users) -> database. Never "everything in files" or "everything in one DB".
- **One DB vs per-domain**: Enforce DB-per-bounded-context. Monolith: one server, separate SCHEMA per domain (`cart`, `order`). Microservice: each service owns its own DB. Domains never share tables (ties to Rule "Data Autonomy").
- **Which DB**: Default = PostgreSQL (ACID, strong typing, CHECK/FK/UNIQUE constraints, triggers, functions, JSONB, extensions). Add Redis for cache/counters/sessions. Use MongoDB only when a domain truly needs schema-flexible documents. Choice is per-domain, declared in metadata.

### Problem 18: Reactivity (does DB "instantly know" increments?)
- **No implicit push**: The DB knows nothing until the backend sends a change. No magic "instantly know".
- **Atomic counters**: For increment/decrement use `UPDATE ... SET quantity = quantity + 1` (atomic), NOT read-modify-write (race condition).
- **Real-time propagation**: For "stock hit zero" alerts, use domain events + read-model projection (Outbox pattern / CDC), not polling.

### Problem 19: What can the backend do, and who validates?
- **Backend role**: CRUD, transactions, migrations, queries — but ONLY through the domain's `repositories/` adapter. Raw SQL must never scatter across code.
- **Validation = defense in depth (3 layers)**:
  1. Frontend: UX feedback only (fast, NOT security).
  2. Backend domain: authoritative business-rule validation (DTO + invariants) — the real gate.
  3. Database: final constraints (NOT NULL, CHECK, UNIQUE, FK, trigger) — protects integrity even if a buggy client writes.
- **Query ownership**: Prefer Repository pattern (SQL contained in `infrastructure/repositories`). For complex/security-sensitive logic, expose DB functions/views as a "DB API surface" and have the backend call them instead of writing raw queries — mirroring the domain `api/` concept.

### Problem 20: Do all DBs behave the same?
- **No.** PostgreSQL (rich triggers/functions/CHECK), MySQL (weaker), SQLite (minimal, no server), NoSQL (no ACID triggers, different consistency). 
- **Solution**: The `repositories/` adapter is the anti-corruption layer that hides DB-specific behaviour behind our clean domain interface. Domain logic never depends on which DB is underneath.

## Session 15: Consolidation & Plugin Direction
**Date:** 2026-11-20

### Decision: Consolidate before packaging
- The 28 rules (AGENTS.md) + 14 logbook sessions were growing unwieldy. Consolidated everything into a single, layered `doctrine.md` — 13 sections organized by concern (philosophy, package shape, boundaries, versioning, deployment, discoverability, toolchain, third-party, HITL, orchestration, research, testing, persistence, context).
- **End goal identified**: package this doctrine as a DSH plugin (a skill) so that when enabled, any agent is "armed" with software-development expertise.

### DSH plugin mapping (from dsh-doc skill)
- The knowledge is fundamentally *instructions/methodology* → the DSH-native artifact is a **skill** (reusable markdown instruction set, loaded on-demand via the `skill` tool).
- A **plugin bundle** can *contain* a skill (plus tools/UI if ever needed), but for pure expertise-transfer the skill alone suffices.
- `create_skill` tool creates a local skill in `DSH_HOME/skills`. NOT yet invoked — user has not explicitly requested the skill be created, only that the session builds toward a plugin.
- Loaded `dsh-doc` skill + read `references/tool-design.md` (minimal-context principle, "say each fact once") and `references/practices.md` (extension points; `ctx.systemPrompt.section()` for prompt text; skills load on-demand).

### Next step (pending user go-ahead)
- Package `doctrine.md` into a DSH skill (or skill-bearing plugin bundle) so the agent auto-loads it when doing software work.

## Session 16: Failure Handling Doctrine + Plugin Build Kickoff
**Date:** 2026-11-20

### Problem 21: How to respond when a solution "doesn't work out"
- User asked: keep trying? stop and ponder? research new solutions? find how others solved it?
- **Answer (escalation ladder keyed on diagnosis, not persistence):** localize the failure → research prior art → re-examine assumptions → time-boxed retry (2–3 attempts per hypothesis max) → change solution class → human-in-the-loop. Never repeat the same attempt without new information. Codified as doctrine Section 14.

### Plugin build: confirmed shape (Step 1)
- DSH is a Node project (pnpm monorepo, Node >= 24.9, ESM). A DSH plugin = a Node package bundle.
- Bundle anatomy (from `dsh-doc` templates): `package.json` with `dsh.bundle.patch` → `cordis.patch.yml` (`- insert: [{id, name, config}]`); host plugin exports `apply(ctx, config)` + optional `inject`.
- Skill registration (from `@deepseek-ai/dsh-skill`): `ctx.skills.register({ name (kebab), description (non-empty), source, content, whenToUse?, invocation? })` — a runtime skill that appears in the session catalog and loads via the `skill` tool.
- Local directory install LINKS the checkout, so bundled files stay available at runtime; the `files` array only filters packed bundles.
- Decision: build incrementally. Step 1 = scaffold bundle + register doctrine as a skill. Later = diagram tool + boundary validator.

## Session 17: Adopting an Existing Project (Brownfield)
**Date:** 2026-11-20

### Problem 22: How to handle being handed an existing, non-DDD project to continue
- User asked: what happens when we're dropped into a real-world project that doesn't follow the doctrine — in two ownership modes (full ownership vs contributor)?
- **Answer (codified as doctrine Section 15):** the doctrine is a *lens + ladder*, not a straightjacket. Reconstruct the missing map from existing artifacts; use a three-case gate; respect ownership mode.

### Key refinement from user
- The doctrine is NOT optional on existing code. Its whole purpose is to make complex software easy to maintain and easy to develop — so even if the original project is "super bad", once we step in and continue developing, we apply the professional philosophy *progressively* (never big-bang). The decision gate therefore sets *pace/intensity*, not *whether*.

### Contributor protocol (ask → branch → review)
- **Ask for latitude** before touching anything (HITL applied to "how much may I reshape?").
- **Work on our own branch/fork**, never their mainline; the PR review is the gate.
- **Let review decide** — fall back to minimal conforming change if the refactor is rejected.
- Also resolves a concern the user raised: "apply invisibly" means *don't preach the doctrine to maintainers*, not *don't load it*. The skill is loaded JIT per task (cheap) and is a durable git file (so it can't be "forgotten" even after context compression).

### Plugin completion status
- Skill `software-dev-expert` + tools `render-diagram` (DOT/PlantUML/Mermaid) + `validate-domains` (metadata + boundary checks) all built, live, and pushed.
- Dedup done (skill reads repo-root `doctrine.md`), icon added, README added.
