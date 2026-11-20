/**
 * `validate-domains` — checks a project against the agentic-friendly doctrine.
 *
 * Pure Node (no DSH imports) so it is unit-testable on its own. Validates:
 *   1. Every domain package has a valid `metadata.json`.
 *   2. Required metadata fields: name, version, deployment.mode (local|network),
 *      exports ({ commands, queries, events }), dependencies (optional).
 *   3. Standard directory shape: `api/` required (the only cross-boundary
 *      surface); `entities/`, `repositories/`, `infrastructure/`, `tests/`
 *      recommended.
 *   4. Declared cross-domain dependencies resolve to real domains.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

const DEPLOYMENT_MODES = ['local', 'network']
const SHAPE_DIRS = ['api', 'entities', 'repositories', 'infrastructure', 'tests']
const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist', 'build'])

export function validateDomains(root) {
  const domainDirs = discoverDomains(root)
  const out = []
  out.push('validate-domains report')
  out.push(`root: ${root}`)
  out.push(`domains found: ${domainDirs.length}`)
  out.push('')

  if (domainDirs.length === 0) {
    out.push(
      'No domain packages found. Expected a `domains/<name>/` tree (each with a `metadata.json`), '
      + 'or `metadata.json` files under the project root.',
    )
    return out.join('\n')
  }

  const results = []
  const knownNames = new Set()

  // First pass: parse + validate each domain's metadata and shape.
  for (const dir of domainDirs) {
    const res = { dir, metaName: null, issues: [], deps: [] }
    const metaPath = join(dir, 'metadata.json')
    let meta = null

    if (!existsSync(metaPath)) {
      res.issues.push({ level: 'error', msg: 'missing metadata.json' })
    } else {
      try {
        meta = JSON.parse(readFileSync(metaPath, 'utf8'))
      } catch (err) {
        res.issues.push({ level: 'error', msg: `metadata.json is not valid JSON (${err.message})` })
      }
    }

    if (meta) {
      validateMetadata(meta, res)
      if (res.metaName) knownNames.add(res.metaName)
      if (meta.dependencies !== undefined) res.deps = extractDependencyNames(meta.dependencies)
    }

    validateShape(dir, res)

    results.push(res)
  }

  // Second pass: every declared dependency must resolve to a discovered domain.
  for (const res of results) {
    for (const dep of res.deps) {
      if (!knownNames.has(dep)) {
        res.issues.push({ level: 'error', msg: `dependency "${dep}" is not declared by any discovered domain` })
      }
    }
  }

  let errors = 0
  let warns = 0
  for (const res of results) {
    const label = res.metaName ?? basename(res.dir)
    const errs = res.issues.filter((i) => i.level === 'error')
    const wrns = res.issues.filter((i) => i.level === 'warn')
    errors += errs.length
    warns += wrns.length

    if (errs.length === 0 && wrns.length === 0) {
      out.push(`PASS  ${label}`)
    } else if (errs.length === 0) {
      out.push(`WARN  ${label}  (${wrns.length} warning(s))`)
      for (const i of res.issues) {
        out.push(`  ⚠ [warn] ${i.msg}`)
      }
    } else {
      out.push(`FAIL  ${label}  (${errs.length} error(s), ${wrns.length} warning(s))`)
      for (const i of res.issues) {
        out.push(`  ${i.level === 'error' ? '✖' : '⚠'} [${i.level}] ${i.msg}`)
      }
    }
    out.push('')
  }

  out.push(`summary: ${results.length} domain(s), ${errors} error(s), ${warns} warning(s)`)
  return out.join('\n')
}

function validateMetadata(meta, res) {
  const dirName = basename(res.dir)

  if (typeof meta.name !== 'string' || meta.name === '') {
    res.issues.push({ level: 'error', msg: 'metadata.json: "name" is required and must be a non-empty string' })
  } else {
    res.metaName = meta.name
    if (meta.name !== dirName) {
      res.issues.push({ level: 'warn', msg: `metadata.name "${meta.name}" does not match directory name "${dirName}"` })
    }
  }

  if (typeof meta.version !== 'string' || meta.version === '') {
    res.issues.push({ level: 'error', msg: 'metadata.json: "version" is required and must be a non-empty string' })
  }

  const mode = meta.deployment === undefined || meta.deployment === null ? undefined : meta.deployment.mode
  if (mode === undefined) {
    res.issues.push({ level: 'error', msg: 'metadata.json: "deployment.mode" is required' })
  } else if (!DEPLOYMENT_MODES.includes(mode)) {
    res.issues.push({ level: 'error', msg: `metadata.json: deployment.mode "${mode}" is not one of ${DEPLOYMENT_MODES.join(', ')}` })
  }

  if (meta.exports === undefined) {
    res.issues.push({ level: 'error', msg: 'metadata.json: "exports" is required' })
  } else if (typeof meta.exports !== 'object' || meta.exports === null || Array.isArray(meta.exports)) {
    res.issues.push({ level: 'error', msg: 'metadata.json: "exports" must be an object ({ commands, queries, events })' })
  } else {
    for (const key of ['commands', 'queries', 'events']) {
      const value = meta.exports[key]
      if (value !== undefined && !Array.isArray(value)) {
        res.issues.push({ level: 'error', msg: `metadata.json: exports.${key} must be an array of strings` })
      }
    }
  }
}

function validateShape(dir, res) {
  for (const d of SHAPE_DIRS) {
    const p = join(dir, d)
    if (d === 'api') {
      if (!existsSync(p)) {
        res.issues.push({ level: 'error', msg: 'missing required api/ directory (the only cross-boundary surface)' })
      }
    } else if (!existsSync(p)) {
      res.issues.push({ level: 'warn', msg: `missing recommended ${d}/ directory` })
    }
  }
}

function extractDependencyNames(deps) {
  const names = []
  if (Array.isArray(deps)) {
    for (const d of deps) {
      if (typeof d === 'string') names.push(d)
      else if (d && typeof d === 'object' && typeof d.domain === 'string') names.push(d.domain)
    }
  } else if (deps && typeof deps === 'object') {
    names.push(...Object.keys(deps))
  }
  return names
}

function discoverDomains(root) {
  const domainsDir = join(root, 'domains')
  if (existsSync(domainsDir) && statSync(domainsDir).isDirectory()) {
    return readdirSync(domainsDir)
      .map((name) => join(domainsDir, name))
      .filter((p) => statSync(p).isDirectory())
  }
  const found = []
  walkForMetadata(root, found, 0)
  return found
}

function walkForMetadata(dir, out, depth) {
  if (depth > 4 || !existsSync(dir)) return
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (!e.isDirectory() || EXCLUDED_DIRS.has(e.name)) continue
    const full = join(dir, e.name)
    if (existsSync(join(full, 'metadata.json'))) {
      out.push(full)
    } else {
      walkForMetadata(full, out, depth + 1)
    }
  }
}
