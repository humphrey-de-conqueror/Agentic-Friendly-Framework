# Agent Instructions & Vital Architecture Rules

## 1. Domain Boundary Rules
- **No Internal Sharing**: A domain (e.g., `order`) MUST NEVER import from another domain's `entities`, `repositories`, or `infrastructure`.
- **API Only**: Cross-domain communication is strictly limited to the `api/` directory. Domains communicate via Data Transfer Objects (DTOs) or public interfaces.
- **Data Autonomy**: Domains do not share database tables. A domain cannot directly query another domain's database schema.

## 2. Decoupling & Events
- **Snapshotting over Linking**: When bridging boundaries (e.g., Order needing a Product), the dependent domain should store a snapshot of the required data (like Price at the time of order) rather than a direct reference to the external Entity.
- **Prefer Domain Events**: For side-effects across boundaries, use Publish/Subscribe (Domain Events). The publisher must not know about the subscribers.

## 3. Metadata & Dependency
- Each domain's `metadata.json` must explicitly declare which other domains it depends on. Unauthorized dependencies are treated as critical architectural violations.

## 4. Function Evolution & Versioning
- **Append-Only APIs**: If a public function in an `api/` directory needs a breaking change (new required inputs, changed outputs), you MUST create a `v2` of that function. Do not delete `v1` until all local metadata dependencies have been updated.
- **Agent Dependency Checking**: Before modifying an exported function, an Agent must scan the `metadata.json` of all other domains to find consumers.

## 5. Monolith & Microservice Agnosticism
- **Interface Segregation**: Domains interact via Interfaces, not concrete classes.
- **Infrastructure Adapters**: Network calls (HTTP/gRPC) or Local function calls are handled purely in the `infrastructure/` directory. The core business logic remains completely ignorant of how it is deployed.
- **Metadata-Driven Deployment**: The `deployment.mode` inside `metadata.json` dictates which adapter is loaded.

## 6. Discoverability (How to find code)
- **Read Metadata First**: When given a task, an Agent MUST NOT execute global text searches (`grep`) across the codebase as a first step. The Agent must read the `metadata.json` files to map the user's intent to a specific Domain and its exported Capabilities (Commands/Queries/Events).
- **Narrow Context**: Once the target domain is identified, the Agent only reads the files within that specific `domains/<name>/` folder.

## 7. Single Source of Truth (Preventing Blurred Responsibility)
- **Bounded Context Enforcement**: A business concept or capability (e.g., "Cart Items") must be owned by exactly ONE domain. 
- **Handling Ambiguity**: If an Agent detects that multiple domains overlap in responsibility (e.g., both export a way to mutate a Cart), the Agent MUST halt and ask the user to resolve the architectural conflict. DO NOT guess.
- **Ubiquitous Language**: Naming must be 1:1. The command in `metadata.json` must exactly match the function name in `api/` and the intent requested by the user.

## 8. Dependency & Toolchain Strictness
- **Never Reinvent the Wheel**: Do not write raw low-level code (e.g., raw SVG paths, custom cryptographic hashes, complex CSS animations from scratch) if an approved library already exists in the project.
- **The Approved Catalog**: Before solving a UI or utility problem, check the metadata of the `shared` or `ui` domain. Use the standardized tools listed there.
- **No Unauthorized Dependencies**: You MUST NOT introduce new external libraries or frameworks (e.g., adding new npm packages) without explicit authorization from the human. 

## 9. Leveraging External Capabilities
- **Use Agent Tools**: If a task falls outside standard text/code generation (e.g., drawing a literal image, taking a screenshot), use the tools provided by your runtime environment (e.g., `generate_image`, `uiux` skill) rather than attempting to write source code to generate the asset from scratch.

## 10. Frameworks vs. Vanilla Boilerplate
- **Avoid Vanilla Boilerplate**: Agents MUST prioritize using the project's chosen opinionated frameworks over writing custom "vanilla" abstractions from scratch. Context windows are precious; do not waste them generating custom state management or routing logic if the framework provides it.
- **Speak the Dialect**: Check the `metadata.json` (e.g., `"framework": "flutter"`) before writing UI code. Write idiomatic code for that specific framework (e.g., using proper React Hooks, or Flutter Widgets) rather than generic programming patterns.

## 11. Strong Typing & Conventions
- **Type Safety is Mandatory**: Agents rely heavily on type definitions to understand the codebase without reading every file. Always generate strongly typed code (TypeScript, Swift, Dart) rather than loosely typed code (plain JS, Python without type hints) whenever the framework supports it.

## 12. Context & Token Management
- **On-Demand Context**: Agents MUST NOT assume or require the entire codebase to be injected into their prompt. Agents must dynamically fetch context using file-read tools. 
- **Read the Map**: To understand the tech stack of a specific area, read the `metadata.json` of that domain. Do not ask the user what framework is being used if the metadata already defines it.
- **State Restoration**: Since sessions are stateless, an Agent starting a new task should always quickly read `AGENTS.md` to restore its architectural constraints before writing any code.

## 13. Third-Party Integrations (Anti-Corruption Layer)
- **Protect the Core**: External vendor SDKs, API responses, and third-party data models MUST NOT cross into `entities/` or public `api/` directories. 
- **Translation**: All third-party data must be mapped/translated into our own internal Data Transfer Objects (DTOs) immediately at the `infrastructure/` boundary.

## 14. Infrastructure vs. Wrapper Domains
- **Local Infrastructure**: If a third-party tool is highly specific to a single domain (e.g., a specific PDF generator for `invoices`), place it in that domain's `infrastructure/` folder.
- **Wrapper Domains**: If a third-party service represents a broad capability (e.g., Payment Processing, AI Text-to-Speech, Global Notification SMS), create a new dedicated domain folder (e.g., `domains/payment/`). Wrap the third-party complexity inside this domain, and expose a clean, stable API to the rest of the application.

## 15. No Guessing (Strict Confidence Requirement)
- **Do Not Hallucinate Paths**: If you need to edit a file but cannot definitively trace its location through `metadata.json` or the existing directory structure, YOU MUST NOT GUESS.
- **Halt on Ambiguity**: If a user request could apply to multiple domains, or if the domain is missing, immediately halt execution. Ask the user to clarify which Bounded Context (Domain) should own the feature.

## 16. Human-in-the-Loop (HITL) Escalation
- **When to Escalate**: Ask the human when: 
  1. A required dependency is missing from the Approved Catalog.
  2. The requested feature violates architectural boundaries (e.g., direct DB access).
  3. The target domain for a new feature is unclear.
- **How to Ask**: Be concise. State the conflict or missing information, list the 2-3 most logical options based on the architecture, and wait for the human's decision.

## 17. Subagent Orchestration & Isolation
- **The Orchestrator Pattern**: The Root Agent manages all subagents. Subagents do not spawn other subagents. 
- **Strict Working Directories**: When delegating work to a subagent via the `subagent` or `subagent_fork` tools, ALWAYS set the `cwd` to the specific domain folder they are assigned to (e.g., `cwd: "domains/vendor"`). Do not give subagents global directory scope unless they are performing global read-only audits.
- **No Concurrent Writes to Shared Resources**: NEVER spawn multiple subagents that will write to the same domain simultaneously. If multiple updates are needed in one domain, they must be done sequentially to avoid silent overwrite conflicts.

## 18. Cross-Domain Features
- When a user requests a feature touching multiple domains, the Root Agent must break it into discrete, non-overlapping tasks.
- If overlapping edits are unavoidable, the Root Agent must gather the generated code from the subagents and apply the final `edit` or `write` commands itself, acting as the conflict-resolution merge layer.

## 19. Just-In-Time (JIT) Context Retrieval
- **Never Assume Pre-loaded Context**: Do not assume the entire codebase or all metadata files are pre-loaded into your prompt. 
- **The Boot Sequence**: When starting a new task, explicitly read `AGENTS.md` to load the current architectural laws. Then, read only the `metadata.json` files for the domains relevant to the immediate task.

## 20. Codebase Readability (Human vs. AI)
- **Maintain Human Readability**: Do not write documentation, metadata, or code in "AI-only" shorthand (e.g., highly compressed non-standard acronyms or stripped syntax). The codebase must remain perfectly readable to human engineers.
- **Rely on Runtime Compression**: Trust the DSH runtime to compress your conversational memory. Keep the actual file artifacts clean, standard, and human-readable.

## 21. Knowledge Cutoffs & Targeted Research
- **Assume Outdated Pre-training**: For highly volatile, external, or newly released APIs (e.g., OS Kernel APIs, Cloud Provider SDKs, new framework versions), do not rely on your internal pre-trained weights.
- **Mandatory Doc Fetching**: Use your web search and fetch tools to pull the latest official documentation or source code signatures BEFORE writing the integration code. 

## 22. Tool Discovery & Supply Chain Security
- **No Blind Installations**: You are forbidden from searching the web to find a random third-party package and installing it autonomously. 
- **The Proposal Process**: If the project lacks a necessary framework/tool (e.g., missing a WebSocket framework), research the standard industry options, present the top 2 choices to the human, and wait for authorization.
- **Build vs. Buy**: Write custom code for Business Logic. Use established, approved dependencies for generic technical plumbing.

## 23. Testing Discipline (When/Where/Who)
- **Test-First, Per-Change**: A command/query is incomplete until its test passes. Prefer TDD: write the failing test, watch it fail, implement the minimal change, then refactor.
- **Co-locate Tests**: Tests live inside the owning domain (e.g., `domains/cart/tests/`), not in a global `/tests` folder.
- **Contract Tests are Mandatory**: For every export listed in a domain's `metadata.json`, add a contract test asserting the real `api/` function exists, matches the declared version, and that declared consumer dependencies still resolve.
- **Escalation**: Run the domain's local tests after every change. The Orchestrator re-runs tests before integrating. CI is the final gatekeeper (full suite + types + lint + boundary checks).

## 24. Subagent Lifecycle & Handoff
- **Stateless Default**: Spawn a subagent for ONE bounded task in ONE domain with a scoped `cwd`, then let it terminate. Do not reuse it across unrelated tasks.
- **Minimal Prompt Payload**: Give the subagent only: task, `cwd`, its domain `metadata.json`, `AGENTS.md` pointer, acceptance criteria, and the required return format. Never dump the whole repo/chat.
- **Structured Return**: A subagent must report files changed, tests run and results, decisions, and open questions. Its raw intermediate reasoning is not returned.
- **Long-Lived Only When Needed**: Use a persistent subagent only for genuinely iterative work; keep its memory scoped to its own domain.

## 25. Persistence & Data Autonomy
- **Files vs DB**: Config/static data -> files. Mutable business state -> database. Do not mix them.
- **Per-Domain Storage**: A domain owns its schema/DB. Domains MUST NOT share tables or write to another domain's storage. In a monolith use schema-per-domain; in microservices, DB-per-service.
- **Default Engine**: Use PostgreSQL as the default relational store (declared in metadata). Add Redis only for cache/counters. Justify any other engine per-domain.

## 26. Atomicity & Reactivity
- **Atomic Updates**: For counters/quantities use atomic SQL (`quantity = quantity + 1`), never read-modify-write.
- **Event-Driven Propagation**: For real-time cross-domain updates use domain events + read-model projections (Outbox/CDC), never polling or direct cross-domain table writes.

## 27. Validation (Defense in Depth)
- **Three Layers**: Frontend = UX only. Backend domain = authoritative business rules. Database = final integrity constraints (NOT NULL/CHECK/UNIQUE/FK/trigger).
- **Never rely on frontend validation alone.**

## 28. Query Ownership & DB Abstraction
- **Repository Pattern**: All SQL is contained in the domain's `repositories/` adapter. Raw SQL must not scatter across business logic.
- **DB-as-API Option**: Complex or security-sensitive logic may be exposed as DB functions/views that the backend calls (documented in metadata), mirroring the domain `api/` concept.
- **Engine-Agnostic Domain**: Domain entities/logic must never depend on a specific DB's behaviour; the repository adapter is the anti-corruption layer.
