/**
 * Host half of the Agentic-Friendly Framework bundle.
 *
 * Registers:
 *   1. `software-dev-expert` — the consolidated doctrine as a runtime skill.
 *   2. `render-diagram` — a deterministic text-to-diagram renderer (Graphviz
 *      DOT, PlantUML, Mermaid) so an agent never burns an image model on a
 *      class / sequence / dependency diagram.
 *
 * The doctrine body lives beside this file (`doctrine.md`). Local directory
 * installs link the checkout, so files resolve relative to `import.meta.url`.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { validateDomains } from './validate-domains.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_PLANTUML_JAR = join(homedir(), '.local', 'share', 'agentic-friendly', 'plantuml.jar')

export const inject = ['skills', 'tools', 'workingDirectory']

export function apply(ctx) {
  const content = readFileSync(join(__dirname, 'doctrine.md'), 'utf8')

  ctx.skills.register({
    name: 'software-dev-expert',
    description:
      'Software-development architecture doctrine: DDD-by-domain, metadata-driven discoverability, boundary and versioning rules, toolchain policy, testing and persistence strategy for agentic + human-friendly systems.',
    whenToUse:
      'Use when designing, building, reviewing, or refactoring software the agentic-friendly way: domain boundaries, function versioning, metadata/discoverability, toolchain selection, third-party integration, testing, persistence, or failure-escalation decisions.',
    source: 'bundled',
    content,
  })

  ctx.tools.register(defineTool({
    name: 'render-diagram',
    description:
      'Render a software diagram from text to an SVG or PNG file in the workspace and return its saved path. '
      + 'Supports Graphviz DOT (dependency/architecture graphs), PlantUML (UML class, sequence, use-case, '
      + 'activity, component), and Mermaid (sequence, class, flowchart, state, ER). Deterministic and cheap — '
      + 'prefer this over generating a diagram image with an image model.',
    parameters: {
      source: {
        type: 'string',
        required: true,
        description:
          'The diagram source text: DOT graph syntax, PlantUML between @startuml and @enduml, or Mermaid syntax.',
      },
      type: {
        type: 'string',
        enum: ['dot', 'plantuml', 'mermaid'],
        description: 'Diagram language. Default dot.',
      },
      format: {
        type: 'string',
        enum: ['svg', 'png'],
        description: 'Output format. Default svg (vector; recommended).',
      },
      filename: {
        type: 'string',
        description: 'Output base name without extension. Default is a timestamped name; the file is written under <workspace>/diagrams/.',
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    async execute(args, exec) {
      const type = args.type ?? 'dot'
      const format = args.format ?? 'svg'
      const cwd = exec.agent === undefined
        ? process.cwd()
        : await ctx.workingDirectory.ensure(exec.agent, exec.signal)
      const base = safeBase(args.filename) ?? `diagram-${Date.now()}`
      const outDir = join(cwd, 'diagrams')
      mkdirSync(outDir, { recursive: true })
      const outFile = renderDiagram(type, format, args.source, base, outDir)
      const bytes = statSync(outFile).size
      return `Rendered ${type} diagram → ${outFile} (${bytes} bytes, ${format}).`
    },
  }))

  ctx.tools.register(defineTool({
    name: 'validate-domains',
    description:
      'Validate a project against the agentic-friendly doctrine. Verifies every domain package has a valid '
      + 'metadata.json (name, version, deployment.mode, exports, dependencies), the standard directory shape '
      + '(api/ required; entities, repositories, infrastructure, tests recommended), and that declared '
      + 'cross-domain dependencies resolve to real domains. Returns a pass/warn/fail report.',
    parameters: {
      path: {
        type: 'string',
        description: 'Project root directory to scan. Default: the workspace working directory.',
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    async execute(args, exec) {
      const cwd = exec.agent === undefined
        ? process.cwd()
        : await ctx.workingDirectory.ensure(exec.agent, exec.signal)
      const root = args.path && String(args.path).trim() ? resolve(args.path) : cwd
      return validateDomains(root)
    },
  }))
}

function renderDiagram(type, format, source, base, outDir) {
  switch (type) {
    case 'dot': return renderDot(format, source, base, outDir)
    case 'plantuml': return renderPlantuml(format, source, base, outDir)
    case 'mermaid': return renderMermaid(format, source, base, outDir)
    default: throw new Error(`unsupported diagram type "${type}"`)
  }
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 120000 })
  if (r.error) throw new Error(`${cmd} not found or failed to start: ${r.error.message}`)
  if (r.status !== 0) throw new Error(`${cmd} failed (exit ${r.status}): ${(r.stderr || r.stdout || '').trim()}`)
  return r
}

function renderDot(format, source, base, outDir) {
  const src = join(outDir, `${base}.dot`)
  const out = join(outDir, `${base}.${format}`)
  writeFileSync(src, source)
  run('dot', [`-T${format}`, '-o', out, src])
  return out
}

function renderPlantuml(format, source, base, outDir) {
  const jar = process.env.PLANTUML_JAR || (existsSync(DEFAULT_PLANTUML_JAR) ? DEFAULT_PLANTUML_JAR : null)
  const src = join(outDir, `${base}.puml`)
  writeFileSync(src, source)
  try {
    if (jar) {
      run('java', ['-Djava.awt.headless=true', '-jar', jar, `-t${format}`, '-o', outDir, src])
    } else {
      run('plantuml', [`-t${format}`, '-o', outDir, src])
    }
  } catch (err) {
    throw new Error(
      `PlantUML render failed (${err.message}). Install PlantUML with: `
      + 'curl -L -o ~/.local/share/agentic-friendly/plantuml.jar https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar',
    )
  }
  const out = join(outDir, `${base}.${format}`)
  if (!existsSync(out)) throw new Error(`plantuml produced no output at ${out}`)
  return out
}

function renderMermaid(format, source, base, outDir) {
  const src = join(outDir, `${base}.mmd`)
  const out = join(outDir, `${base}.${format}`)
  writeFileSync(src, source)
  try {
    run('mmdc', ['-i', src, '-o', out])
  } catch (err) {
    throw new Error(
      `Mermaid render failed (${err.message}). Install Mermaid CLI with: npm install -g @mermaid-js/mermaid-cli`,
    )
  }
  return out
}

function safeBase(value) {
  if (typeof value !== 'string' || value === '') return null
  const cleaned = value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned === '' ? null : cleaned
}
