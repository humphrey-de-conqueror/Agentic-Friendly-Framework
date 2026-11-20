# Agentic-Friendly Framework

A software-development doctrine — and the DeepSeek Harness (DSH) plugin that arms an
agent with it — for building systems that are **agentic-friendly** (an AI agent can
navigate, extend, and verify them) and **human-friendly** (a person can read and
maintain them).

## What's here

| Path | Purpose |
| --- | --- |
| `doctrine.md` | The consolidated rulebook (14 sections) — the single canonical copy. |
| `AGENTS.md` | The 28-rule "constitution"; auto-injected into agent context in this repo. |
| `logbook.md` | Running decision record (Sessions 1–16). |
| `plugin/` | The DSH plugin bundle that ships the doctrine as a skill + tooling. |

## The doctrine in one breath

Domain-driven design **by package, not by layer**; every domain is a self-contained
package that describes itself in a `metadata.json` (name, version, `deployment.mode`,
`exports`, `dependencies`). Cross-domain access is **API-only**; boundaries are hard,
data is autonomous, snapshots over links, domain events over shared tables. APIs
evolve **append-only** (never break a version). Never reinvent the wheel (Approved
Catalog); never guess (HITL escalation); test per change with mandatory contract
tests; persist per-domain (PostgreSQL default, repository pattern, defense-in-depth
validation); retrieve context JIT and keep artifacts human-readable.

Full detail in [`doctrine.md`](doctrine.md).

## The plugin (`plugin/`)

A DSH **bundle** (`@agentic-friendly/framework`) that registers:

| Artifact | Name | Kind | What it does |
| --- | --- | --- | --- |
| Doctrine | `software-dev-expert` | skill | The doctrine, loaded on demand to make an agent the software-dev expert. |
| Diagrams | `render-diagram` | tool | Renders DOT / PlantUML / Mermaid text to SVG or PNG (no image model). |
| Boundaries | `validate-domains` | tool | Validates a project against the doctrine (metadata + directory shape + dependency resolution). |

### Diagram backends

`render-diagram` shells out to deterministic, local renderers:

- **Graphviz** (`dot`) — dependency/architecture graphs.
- **PlantUML** (`plantuml.jar`) — UML class, sequence, use-case, activity, component.
- **Mermaid** (`mmdc`) — sequence, class, flowchart, state, ER.

Install what you need:

```bash
sudo apt install graphviz
curl -L -o ~/.local/share/agentic-friendly/plantuml.jar \
  https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar
npm install -g @mermaid-js/mermaid-cli
```

### Install the bundle

```bash
# from a DSH session (or the Plugins page)
plugin_manager install_bundle /path/to/Agentic-Friendly-Framework/plugin
```

The install **links** the directory, so source edits take effect on re-activation
(toggle the bundle off → on) without a restart.

## Canonical doctrine (single source)

`plugin/index.js` reads the doctrine from the repo root (`../doctrine.md`) — there is
**one** canonical copy, and the plugin points at it. This works because a linked
install realpaths the module URL to the checkout.

> **Packing note:** to publish the bundle as a standalone package, first copy the
> doctrine into the bundle (`cp doctrine.md plugin/`) so it stays self-contained —
> the bundled fallback (`plugin/doctrine.md`) exists for exactly that case.

## License

See `LICENSE` (add one before distributing).
