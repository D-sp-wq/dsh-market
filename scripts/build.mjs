#!/usr/bin/env node
/**
 * Build site/index.json from plugins.json.
 *
 * The output is official plugin-market format 1, and it is validated with
 * @deepseek-ai/dsh-plugin-market-index before it is written — the same parser
 * DSH itself runs. A validation failure prints the offending JSON path and
 * exits non-zero, so CI cannot publish an index DSH would reject.
 *
 *   node scripts/build.mjs            # write site/index.json
 *   node scripts/build.mjs --check    # fail if the committed file is stale
 *   node scripts/build.mjs --offline  # use .cache/ only (no network)
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMarketIndex } from '@deepseek-ai/dsh-plugin-market-index'

const root = fileURLToPath(new URL('..', import.meta.url))
const cacheDir = join(root, '.cache')
const outFile = join(root, 'docs', 'index.json')
const INDEX_URL = 'https://d-sp-wq.github.io/dsh-market/index.json'

const args = new Set(process.argv.slice(2))
const checkOnly = args.has('--check')
const offline = args.has('--offline')

// ── tiny semver precedence (enough for registry versions) ────────────────────

function parseSemver(text) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(text))
  if (match === null) return undefined
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] === undefined ? [] : match[4].split('.'),
  }
}

const compareIdentifiers = (left, right) => {
  const leftNumeric = /^\d+$/.test(left)
  const rightNumeric = /^\d+$/.test(right)
  if (leftNumeric && rightNumeric) return Number(left) - Number(right)
  if (leftNumeric) return -1
  if (rightNumeric) return 1
  return left < right ? -1 : left > right ? 1 : 0
}

/** SemVer precedence: negative when `left` sorts before `right`. */
function compareSemver(left, right) {
  const a = parseSemver(left)
  const b = parseSemver(right)
  if (a === undefined || b === undefined) return String(left) < String(right) ? -1 : 1
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  if (a.patch !== b.patch) return a.patch - b.patch
  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0
  if (a.prerelease.length === 0) return 1
  if (b.prerelease.length === 0) return -1
  const length = Math.max(a.prerelease.length, b.prerelease.length)
  for (let index = 0; index < length; index++) {
    const l = a.prerelease[index]
    const r = b.prerelease[index]
    if (l === undefined) return -1
    if (r === undefined) return 1
    const diff = compareIdentifiers(l, r)
    if (diff !== 0) return diff
  }
  return 0
}

// ── registry access ──────────────────────────────────────────────────────────

const cacheFile = name => join(cacheDir, `${name.replace(/[@/]/g, '_')}.json`)

async function registryMetadata(name) {
  const file = cacheFile(name)
  const fresh = existsSync(file) && Date.now() - statSync(file).mtimeMs < 60 * 60 * 1000
  if (fresh || offline) {
    if (!existsSync(file)) throw new Error(`--offline but no cache for ${name}`)
    return JSON.parse(readFileSync(file, 'utf8'))
  }
  // Full metadata on purpose: the abbreviated install-v1 document drops the
  // non-standard `dsh` field that carries the bundle marker.
  const response = await fetch(`https://registry.npmjs.org/${name.replace('/', '%2f')}`, {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`registry ${name}: HTTP ${response.status}`)
  const meta = await response.json()
  mkdirSync(cacheDir, { recursive: true })
  writeFileSync(file, JSON.stringify(meta))
  return meta
}

/** Repository URL as a browser-facing https link. */
function webUrl(repository) {
  const raw = typeof repository === 'string' ? repository : repository?.url
  if (typeof raw !== 'string' || raw === '') return undefined
  const cleaned = raw.replace(/^git\+/, '').replace(/\.git$/, '').replace(/^ssh:\/\/git@/, 'https://').replace(/^git@([^:]+):/, 'https://$1/')
  return /^https?:\/\//.test(cleaned) ? cleaned : undefined
}

const localized = value => (value === undefined ? undefined : { ...value })

// ── build ───────────────────────────────────────────────────────────────────

const source = JSON.parse(readFileSync(join(root, 'plugins.json'), 'utf8'))
const plugins = []
const problems = []

for (const entry of source.plugins) {
  let meta
  try {
    meta = await registryMetadata(entry.name)
  } catch (error) {
    problems.push(`${entry.name}: ${error.message}`)
    continue
  }
  const latest = meta['dist-tags']?.latest
  const latestVersion = latest === undefined ? undefined : meta.versions?.[latest]
  if (latestVersion === undefined) {
    problems.push(`${entry.name}: no published version`)
    continue
  }
  // Only packages that declare a bundle can be installed by the market.
  const bundlePatch = latestVersion.dsh?.bundle
  if (bundlePatch === undefined) {
    problems.push(`${entry.name}: does not declare dsh.bundle (not installable as a bundle)`)
    continue
  }

  const publishedVersions = Object.keys(meta.versions)
    .filter(version => meta.time?.[version] !== undefined)
    .sort(compareSemver)
    .reverse()
  const wanted = entry.versions === 'all' ? publishedVersions : publishedVersions.slice(0, Math.max(1, Number(entry.versions ?? 8)))
  // DSH prefers the highest non-prerelease version as a plugin's default; keep
  // that version in the list even when the newest releases are all prereleases.
  const highestStable = publishedVersions.find(version => !version.includes('-'))
  if (highestStable !== undefined && !wanted.includes(highestStable)) wanted.push(highestStable)
  wanted.sort(compareSemver).reverse()

  const versions = wanted.map(version => ({
    version,
    publishTimestamp: Math.floor(new Date(meta.time[version]).getTime() / 1000),
    source: entry.registry === undefined ? { type: 'npm' } : { type: 'npm', registry: entry.registry },
    ...(entry.dshRange === undefined ? {} : { engines: { dsh: entry.dshRange } }),
  }))

  const repositoryUrl = entry.repository ?? webUrl(latestVersion.repository) ?? webUrl(meta.repository)
  const homepage = entry.homepage ?? (typeof latestVersion.homepage === 'string' && /^https?:\/\//.test(latestVersion.homepage)
    ? latestVersion.homepage
    : undefined)

  plugins.push({
    name: entry.name,
    ...(localized(entry.title) === undefined ? {} : { title: localized(entry.title) }),
    ...(localized(entry.description) === undefined ? {} : { description: localized(entry.description) }),
    ...(entry.icon === undefined ? {} : { icon: entry.icon }),
    author: entry.author ?? (typeof latestVersion.author === 'string' ? latestVersion.author : latestVersion.author?.name),
    ...(homepage === undefined ? {} : { homepage }),
    ...(repositoryUrl === undefined ? {} : { repository: { url: repositoryUrl } }),
    metadata: {
      ...(entry.category === undefined ? {} : { category: entry.category }),
      keywords: (latestVersion.keywords ?? []).slice(0, 8),
      labels: entry.labels ?? [],
      sortKeys: {},
    },
    versions,
  })
}

if (problems.length !== 0) {
  console.error('skipped entries:')
  for (const problem of problems) console.error(`  - ${problem}`)
}

const index = {
  format: 1,
  title: source.title,
  description: source.description,
  metadata: {
    categories: Object.fromEntries(Object.entries(source.categories).map(([id, value]) => [id, { title: value }])),
    labels: Object.fromEntries(Object.entries(source.labels).map(([id, value]) => [id, { title: value }])),
    sortKeys: {},
  },
  plugins,
}

// The official parser is the gate: it runs the same rules DSH runs when it reads
// an index, and throws with the offending JSON path.
let validated
try {
  // Round-trip through JSON first: a property holding `undefined` counts as
  // present for the parser's Object.hasOwn checks, while it would be absent in
  // the file we actually write. Validate exactly what gets written.
  validated = parseMarketIndex(JSON.parse(JSON.stringify(index)), INDEX_URL)
} catch (error) {
  console.error(`\nindex rejected by @deepseek-ai/dsh-plugin-market-index:`)
  console.error(`  path  : ${error.path ?? '(unknown)'}`)
  console.error(`  reason: ${error.reason ?? error.message}`)
  process.exit(1)
}

const output = `${JSON.stringify(index, null, 2)}\n`
const total = index.plugins.reduce((sum, plugin) => sum + plugin.versions.length, 0)
const summary = `${index.plugins.length} plugins, ${total} versions`

if (checkOnly) {
  const current = existsSync(outFile) ? readFileSync(outFile, 'utf8') : ''
  if (current !== output) {
    console.error(`docs/index.json is stale — run \`npm run build\``)
    process.exit(1)
  }
  console.log(`index up to date (${summary}), validated against the official parser`)
  process.exit(0)
}

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, output)
console.log(`wrote docs/index.json — ${summary}, validated (${validated.title.en ?? 'ok'})`)
if (problems.length !== 0) process.exitCode = 0
