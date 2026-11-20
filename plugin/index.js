/**
 * Host half of the Agentic-Friendly Framework bundle.
 *
 * Registers the consolidated software-development doctrine as a runtime skill,
 * so any agent in the profile can load it on demand via the `skill` tool and
 * act as an expert software architect rather than a blind code generator.
 *
 * The doctrine body lives beside this file (`doctrine.md`) and is read at
 * activation. Local directory installs link the checkout, so the file is always
 * resolvable relative to `import.meta.url`.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const inject = ['skills']

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
}
