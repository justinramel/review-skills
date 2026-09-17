#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const skillRoot = path.dirname(scriptDir)
const reviewerSchemaPath = path.join(
  skillRoot,
  'schemas/reviewer-result.schema.json'
)
const reviewerSchema = JSON.parse(readFileSync(reviewerSchemaPath, 'utf8'))

const modes = new Set([
  'locality',
  'standards-only',
  'spec-only',
  'architecture-only'
])
const verdictOrder = new Map([
  ['approve', 0],
  ['approve-with-nits', 1],
  ['request-changes', 2]
])
const standardBasenames = new Set([
  'AGENTS.md',
  'CONTRIBUTING.md',
  'CODE_STYLE.md',
  'CODING_STANDARDS.md'
])

const unique = (values) => [...new Set(values)]
const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

const encodePath = (value) =>
  value
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')

const parseOptions = (args) => {
  const options = { _: [] }

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]

    if (!value.startsWith('--')) {
      options._.push(value)
      continue
    }

    const key = value.slice(2)
    const next = args[index + 1]

    if (next === undefined || next.startsWith('--')) {
      options[key] = true
      continue
    }

    options[key] = next
    index += 1
  }

  return options
}

export const parsePullRequest = (value) => {
  const urlMatch = value.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/.*)?$/
  )
  const shortMatch = value.match(/^([^/]+)\/([^/#]+)(?:#|\/)(\d+)$/)
  const match = urlMatch ?? shortMatch

  if (!match) {
    throw new Error(
      `Invalid pull request ${JSON.stringify(value)}; expected a GitHub PR URL or owner/repo#number`
    )
  }

  return {
    owner: match[1],
    repository: match[2],
    number: Number(match[3]),
    url: `https://github.com/${match[1]}/${match[2]}/pull/${match[3]}`
  }
}

const githubHeaders = (accept) => {
  const headers = {
    Accept: accept,
    'User-Agent': 'review-skills',
    'X-GitHub-Api-Version': '2022-11-28'
  }
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

export const githubRequest = async (
  resource,
  { accept = 'application/vnd.github+json', binary = false } = {}
) => {
  const apiBase = process.env.GITHUB_API_URL ?? 'https://api.github.com'
  const url = resource.startsWith('http') ? resource : `${apiBase}${resource}`
  const response = await fetch(url, { headers: githubHeaders(accept) })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `GitHub request failed (${response.status}) for ${url}: ${body.slice(0, 500)}`
    )
  }

  if (binary) {
    return Buffer.from(await response.arrayBuffer())
  }

  if (accept.includes('diff')) {
    return response.text()
  }

  return response.json()
}

const githubPages = async (resource, request) => {
  const results = []

  for (let page = 1; ; page += 1) {
    const separator = resource.includes('?') ? '&' : '?'
    const batch = await request(`${resource}${separator}per_page=100&page=${page}`)

    if (!Array.isArray(batch)) {
      throw new Error(`Expected a paginated array from ${resource}`)
    }

    results.push(...batch)

    if (batch.length < 100) {
      return results
    }
  }
}
const githubCheckRunPages = async (resource, request) => {
  const results = []

  for (let page = 1; ; page += 1) {
    const response = await request(
      `${resource}?per_page=100&page=${page}`
    )
    const batch = response.check_runs ?? []

    results.push(...batch)

    if (batch.length < 100) {
      return results
    }
  }
}


export const parseDiff = (
  diff,
  { owner, repository, headSha } = {}
) => {
  if (!diff.trim()) {
    return []
  }

  const blocks = diff
    .split(/(?=^diff --git )/m)
    .filter((block) => block.startsWith('diff --git '))

  return blocks.map((block) => {
    const header = block.match(/^diff --git a\/(.+) b\/(.+)$/m)

    if (!header) {
      throw new Error('Could not parse a file header from the unified diff')
    }

    const addedPath = block.match(/^\+\+\+ b\/(.+)$/m)?.[1]
    const deletedPath = block.match(/^--- a\/(.+)$/m)?.[1]
    const filePath = addedPath ?? deletedPath ?? header[2]
    let status = 'modified'

    if (/^new file mode /m.test(block)) status = 'added'
    if (/^deleted file mode /m.test(block)) status = 'deleted'
    if (/^rename from /m.test(block)) status = 'renamed'

    const targetLineRanges = [...block.matchAll(
      /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm
    )].map((match) => {
      const start = Number(match[1])
      const count = match[2] === undefined ? 1 : Number(match[2])

      return {
        start,
        end: count === 0 ? start : start + count - 1,
        count
      }
    })

    const firstRange = targetLineRanges.find((range) => range.count > 0)
    const blobBase =
      owner && repository && headSha && status !== 'deleted'
        ? `https://github.com/${owner}/${repository}/blob/${headSha}/${encodePath(filePath)}`
        : undefined
    const targetBlobUrl =
      blobBase && firstRange
        ? `${blobBase}#L${firstRange.start}-L${firstRange.end}`
        : blobBase

    return {
      path: filePath,
      status,
      targetLineRanges,
      ...(targetBlobUrl ? { targetBlobUrl } : {}),
      diff: block.trimEnd()
    }
  })
}

export const deriveSpecCandidates = ({
  title = '',
  branch = '',
  commitMessages = [],
  body = '',
  owner,
  repository
}) => {
  const searchable = [title, branch, ...commitMessages].join('\n')
  const jiraKeys = unique(searchable.match(/\b[A-Z][A-Z0-9]+-\d+\b/g) ?? [])
  const linkedIssues = []

  for (const match of body.matchAll(
    /https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/g
  )) {
    linkedIssues.push(
      `https://github.com/${match[1]}/${match[2]}/issues/${match[3]}`
    )
  }

  if (owner && repository) {
    for (const match of body.matchAll(/(?:^|\s)#(\d+)\b/g)) {
      linkedIssues.push(
        `https://github.com/${owner}/${repository}/issues/${match[1]}`
      )
    }
  }

  return {
    jiraKeys,
    linkedIssues: unique(linkedIssues)
  }
}

const isStandardPath = (filePath) => {
  const basename = path.posix.basename(filePath)

  if (standardBasenames.has(basename)) return true
  if (filePath === 'README.md') return true

  return (
    /^(?:\.github|docs?)\//.test(filePath) &&
    /(?:standard|style|contribut|convention)/i.test(basename) &&
    basename.endsWith('.md')
  )
}

const decodeBlob = (blob) => {
  if (blob.encoding !== 'base64') {
    throw new Error(`Unsupported GitHub blob encoding ${blob.encoding}`)
  }

  return Buffer.from(blob.content.replace(/\n/g, ''), 'base64').toString('utf8')
}

const collectGithubStandards = async ({
  owner,
  repository,
  headSha,
  request
}) => {
  const tree = await request(
    `/repos/${owner}/${repository}/git/trees/${headSha}?recursive=1`
  )
  const candidates = (tree.tree ?? []).filter(
    (entry) => entry.type === 'blob' && isStandardPath(entry.path)
  )
  const standards = []

  for (const entry of candidates) {
    const blob = await request(
      `/repos/${owner}/${repository}/git/blobs/${entry.sha}`
    )
    standards.push({
      path: entry.path,
      revision: headSha,
      immutableUrl: `https://github.com/${owner}/${repository}/blob/${headSha}/${encodePath(entry.path)}`,
      content: decodeBlob(blob)
    })
  }

  return {
    standards,
    discoveryTruncated: tree.truncated === true
  }
}

export const rollupChecks = (runs) => {
  if (runs.length === 0) {
    return 'missing'
  }

  if (runs.some((run) => run.status !== 'completed')) {
    return 'pending'
  }

  const successful = new Set(['success', 'neutral', 'skipped'])

  return runs.every((run) => successful.has(run.conclusion))
    ? 'success'
    : 'failure'
}

const collectGithubChecks = async ({
  owner,
  repository,
  headSha,
  request
}) => {
  try {
    const checkRuns = await githubCheckRunPages(
      `/repos/${owner}/${repository}/commits/${headSha}/check-runs`,
      request
    )
    const statusResponse = await request(
      `/repos/${owner}/${repository}/commits/${headSha}/status`
    )
    const runs = [
      ...checkRuns.map((run) => ({
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        url: run.html_url
      })),
      ...(statusResponse.statuses ?? []).map((status) => ({
        name: status.context,
        status: status.state === 'pending' ? 'in_progress' : 'completed',
        conclusion:
          status.state === 'pending'
            ? null
            : status.state === 'success'
              ? 'success'
              : 'failure',
        url: status.target_url
      }))
    ]

    return { state: rollupChecks(runs), runs }
  } catch (error) {
    return { state: 'missing', runs: [], error: error.message }
  }
}

export const collectGithubEvidence = async ({
  pullRequest,
  waitForChecksSeconds = 0,
  request = githubRequest,
  pause = sleep
}) => {
  const parsed = parsePullRequest(pullRequest)
  const baseResource = `/repos/${parsed.owner}/${parsed.repository}`
  const pull = await request(`${baseResource}/pulls/${parsed.number}`)
  const commits = await githubPages(
    `${baseResource}/pulls/${parsed.number}/commits`,
    request
  )
  const diff = await request(`${baseResource}/pulls/${parsed.number}`, {
    accept: 'application/vnd.github.v3.diff'
  })
  const headSha = pull.head.sha
  const files = parseDiff(diff, {
    owner: parsed.owner,
    repository: parsed.repository,
    headSha
  })
  if (
    Number.isInteger(pull.changed_files) &&
    files.length !== pull.changed_files
  ) {
    throw new Error(
      `GitHub diff is incomplete: expected ${pull.changed_files} files, received ${files.length}`
    )
  }
  if (Number.isInteger(pull.commits) && commits.length !== pull.commits) {
    throw new Error(
      `GitHub commit list is incomplete: expected ${pull.commits}, received ${commits.length}`
    )
  }
  const standardsResult = await collectGithubStandards({
    owner: parsed.owner,
    repository: parsed.repository,
    headSha,
    request
  })
  const deadline = Date.now() + Number(waitForChecksSeconds) * 1000
  let checks

  do {
    checks = await collectGithubChecks({
      owner: parsed.owner,
      repository: parsed.repository,
      headSha,
      request
    })

    if (checks.state !== 'pending' || Date.now() >= deadline) break
    await pause(Math.min(5000, Math.max(1, deadline - Date.now())))
  } while (true)

  const commitMessages = commits.map((entry) => entry.commit.message)

  return {
    source: 'github-pr',
    pullRequest: {
      url: parsed.url,
      title: pull.title,
      body: pull.body ?? '',
      baseRef: pull.base.ref,
      baseSha: pull.base.sha,
      headRef: pull.head.ref,
      headSha
    },
    commits: commits.map((entry) => ({
      sha: entry.sha,
      message: entry.commit.message
    })),
    diff: { raw: diff, files },
    checks,
    standards: standardsResult.standards,
    standardsDiscoveryTruncated: standardsResult.discoveryTruncated,
    specCandidates: deriveSpecCandidates({
      title: pull.title,
      branch: pull.head.ref,
      commitMessages,
      body: pull.body ?? '',
      owner: parsed.owner,
      repository: parsed.repository
    })
  }
}

const git = (args, cwd) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })

const parseGithubRemote = (remote) => {
  const match = remote
    .trim()
    .match(/(?:github\.com[/:])([^/]+)\/([^/]+?)(?:\.git)?$/)

  return match ? { owner: match[1], repository: match[2] } : undefined
}

const localStandards = ({ cwd, headSha, remote }) => {
  const paths = git(['ls-tree', '-r', '--name-only', headSha], cwd)
    .split('\n')
    .filter(Boolean)
    .filter(isStandardPath)

  return paths.map((filePath) => ({
    path: filePath,
    revision: headSha,
    ...(remote
      ? {
          immutableUrl: `https://github.com/${remote.owner}/${remote.repository}/blob/${headSha}/${encodePath(filePath)}`
        }
      : {}),
    content: git(['show', `${headSha}:${filePath}`], cwd)
  }))
}

export const collectLocalEvidence = ({
  range,
  repositoryPath = process.cwd()
}) => {
  const rangeMatch = range.match(/^(.+?)\.\.\.(.+)$/)

  if (!rangeMatch) {
    throw new Error('Local range must use the form base...target')
  }

  const cwd = path.resolve(repositoryPath)
  const baseRef = rangeMatch[1]
  const headRef = rangeMatch[2]
  const baseSha = git(['rev-parse', baseRef], cwd).trim()
  const headSha = git(['rev-parse', headRef], cwd).trim()
  const diff = git(['diff', `${baseSha}...${headSha}`], cwd)

  if (!diff.trim()) {
    throw new Error(`The range ${range} has no changes`)
  }

  const log = git(
    ['log', `${baseSha}..${headSha}`, '--format=%H%x00%B%x00%x1e'],
    cwd
  )
  const commits = log
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [sha, message] = record.split('\x00')
      return { sha, message: message.trim() }
    })
  let remote

  try {
    remote = parseGithubRemote(git(['remote', 'get-url', 'origin'], cwd))
  } catch {
    remote = undefined
  }

  return {
    source: 'local-range',
    range: { baseRef, baseSha, headRef, headSha, repositoryPath: cwd },
    commits,
    diff: {
      raw: diff,
      files: parseDiff(diff, {
        ...(remote ?? {}),
        headSha
      })
    },
    checks: { state: 'missing', runs: [] },
    standards: localStandards({ cwd, headSha, remote }),
    standardsDiscoveryTruncated: false,
    specCandidates: deriveSpecCandidates({
      branch: headRef,
      commitMessages: commits.map((commit) => commit.message),
      ...(remote ?? {})
    })
  }
}

const sourceText = (source) => {
  if (typeof source === 'string') return source
  if (!source || typeof source !== 'object') return ''

  const label = source.path ?? source.url ?? source.name ?? 'source'
  const content = source.content ?? source.description ?? ''

  return `Source: ${label}\n${content}`
}

const sameMembers = (left, right) =>
  left.length === right.length &&
  [...left].sort().every((value, index) => value === [...right].sort()[index])

export const compilePanel = async ({ evidence, plan }) => {
  if (!Array.isArray(plan.reviewers) || plan.reviewers.length === 0) {
    throw new Error('Panel plan must contain at least one reviewer')
  }
  if (typeof plan.fullDiffUri !== 'string' || !plan.fullDiffUri) {
    throw new Error('Panel plan must provide fullDiffUri')
  }
  const reviewDepth = plan.reviewDepth ?? 'fast'
  if (!['fast', 'thorough'].includes(reviewDepth)) {
    throw new Error(`Unsupported review depth ${reviewDepth}`)
  }
  const maximumReviewers = reviewDepth === 'fast' ? 3 : 6
  if (plan.reviewers.length > maximumReviewers) {
    throw new Error(
      `${reviewDepth} review supports at most ${maximumReviewers} verdict-bearing reviewers`
    )
  }

  const changedFiles = evidence.diff.files.map((file) => file.path)
  const changedFileSet = new Set(changedFiles)
  const localityOwners = new Map()
  const schema = reviewerSchema

  for (const reviewer of plan.reviewers) {
    if (!modes.has(reviewer.mode)) {
      throw new Error(`${reviewer.name} has unsupported mode ${reviewer.mode}`)
    }
    if (!reviewer.name || !Array.isArray(reviewer.files) || reviewer.files.length === 0) {
      throw new Error('Every reviewer needs a name and at least one owned file')
    }
    for (const file of reviewer.files) {
      if (!changedFileSet.has(file)) {
        throw new Error(`${reviewer.name} owns unchanged or unknown file ${file}`)
      }
      if (reviewer.mode === 'locality') {
        if (localityOwners.has(file)) {
          throw new Error(
            `${file} is owned by both ${localityOwners.get(file)} and ${reviewer.name}`
          )
        }
        localityOwners.set(file, reviewer.name)
      }
    }
    if (
      ['standards-only', 'spec-only'].includes(reviewer.mode) &&
      !sameMembers(reviewer.files, changedFiles)
    ) {
      throw new Error(`${reviewer.mode} reviewer ${reviewer.name} must own the whole diff`)
    }
    if (reviewer.mode === 'spec-only' && !plan.specification) {
      throw new Error(`Spec reviewer ${reviewer.name} has no specification`)
    }
    if (
      reviewer.mode === 'architecture-only' &&
      !(plan.architectureContext?.length > 0)
    ) {
      throw new Error(
        `Architecture reviewer ${reviewer.name} has no architecture context`
      )
    }
  }

  if (
    plan.reviewers.some((reviewer) => reviewer.mode === 'locality') &&
    !sameMembers([...localityOwners.keys()], changedFiles)
  ) {
    throw new Error('Locality reviewers must own every changed file exactly once')
  }

  const pinned = evidence.pullRequest
    ? `${evidence.pullRequest.baseSha}...${evidence.pullRequest.headSha}`
    : `${evidence.range.baseSha}...${evidence.range.headSha}`
  const standards = (plan.standards ?? evidence.standards ?? [])
    .map(sourceText)
    .join('\n\n')
  const specification = sourceText(plan.specification)
  const architectureContext = (plan.architectureContext ?? [])
    .map(sourceText)
    .join('\n\n')

  const reviewers = plan.reviewers.map((reviewer) => {
    const ownedDiff = evidence.diff.files
      .filter((file) => reviewer.files.includes(file.path))
      .map((file) => file.diff)
      .join('\n')
    const applicable = []

    if (['locality', 'standards-only'].includes(reviewer.mode)) {
      applicable.push(
        `Repository standards at the target revision:\n${standards || 'No documented repository standards were found.'}`
      )
    }
    if (['locality', 'spec-only'].includes(reviewer.mode) && specification) {
      applicable.push(`Specification:\n${specification}`)
    }
    if (reviewer.mode === 'architecture-only') {
      applicable.push(`Architecture and domain context:\n${architectureContext}`)
    }

    const files = reviewer.files.map((file) => `- ${file}`).join('\n')
    const task = `# Target
Review mode: ${reviewer.mode}.
Pinned change: ${pinned}.
Own exactly these files:
${files}

Exact assigned diff hunks:
\`\`\`diff
${ownedDiff}
\`\`\`

${applicable.join('\n\n')}

# Change
Follow skill://pr-review/references/reviewer-role.md and skill://pr-review/references/review-contract.md.
Read the full diff only from ${plan.fullDiffUri} and only for necessary cross-file context.
Do not read the target local working tree, edit files, run formatters, run builds, run linters, run tests, or write to git.
Apply only the assigned review mode.

# Acceptance
Return exactly the reviewer result contract. Use name ${JSON.stringify(reviewer.name)} and list the owned files exactly.`

    return {
      name: reviewer.name,
      mode: reviewer.mode,
      profile:
        reviewer.mode === 'architecture-only' ? 'deep-review' : 'review',
      files: reviewer.files,
      task,
      outputSchema: schema,
      schemaMode: 'strict'
    }
  })

  return { pinned, reviewDepth, reviewers }
}

const validateJsonSchema = (value, schema, location, errors) => {
  const typeMatches =
    schema.type === undefined ||
    (schema.type === 'object' &&
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)) ||
    (schema.type === 'array' && Array.isArray(value)) ||
    (schema.type === 'string' && typeof value === 'string') ||
    (schema.type === 'number' &&
      typeof value === 'number' &&
      Number.isFinite(value))

  if (!typeMatches) {
    errors.push(`${location} must be ${schema.type}`)
    return
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${location} has unsupported value ${JSON.stringify(value)}`)
  }

  if (schema.type === 'string' && value.length < (schema.minLength ?? 0)) {
    errors.push(`${location} must not be empty`)
  }

  if (schema.type === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${location} must be at least ${schema.minimum}`)
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${location} must be at most ${schema.maximum}`)
    }
  }

  if (schema.type === 'array') {
    if (value.length < (schema.minItems ?? 0)) {
      errors.push(`${location} must contain at least ${schema.minItems} item`)
    }
    value.forEach((item, index) =>
      validateJsonSchema(item, schema.items ?? {}, `${location}[${index}]`, errors)
    )
  }

  if (schema.type === 'object') {
    const properties = schema.properties ?? {}

    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(value, required)) {
        errors.push(`${location}.${required} is required`)
      }
    }

    if (schema.additionalProperties === false) {
      const extras = Object.keys(value).filter(
        (key) => !Object.hasOwn(properties, key)
      )
      if (extras.length > 0) {
        errors.push(`${location} has unsupported keys: ${extras.join(', ')}`)
      }
    }

    for (const [key, child] of Object.entries(value)) {
      if (Object.hasOwn(properties, key)) {
        validateJsonSchema(
          child,
          properties[key],
          `${location}.${key}`,
          errors
        )
      }
    }
  }
}

export const validateReviewerResult = (result) => {
  const errors = []

  validateJsonSchema(result, reviewerSchema, '$', errors)

  if (
    result &&
    typeof result === 'object' &&
    Array.isArray(result.findings) &&
    verdictOrder.has(result.verdict)
  ) {
    const findingSeverities = result.findings.map((finding) => finding?.severity)
    const expectedVerdict = findingSeverities.some((value) =>
      ['blocker', 'major'].includes(value)
    )
      ? 'request-changes'
      : findingSeverities.length > 0
        ? 'approve-with-nits'
        : 'approve'

    if (result.verdict !== expectedVerdict) {
      errors.push(
        `$.verdict ${result.verdict} does not match findings; expected ${expectedVerdict}`
      )
    }
  }

  return errors
}

export const aggregateReview = (input) => {
  const reviewerResults = Array.isArray(input.reviewers) ? input.reviewers : []
  const validationErrors = []

  if (reviewerResults.length === 0) {
    validationErrors.push('at least one reviewer result is required')
  }

  reviewerResults.forEach((result, index) => {
    for (const error of validateReviewerResult(result)) {
      validationErrors.push(`reviewers[${index}]: ${error}`)
    }
  })

  const counts = { blocker: 0, major: 0, minor: 0, nit: 0 }

  for (const result of reviewerResults) {
    for (const finding of result.findings ?? []) {
      if (Object.hasOwn(counts, finding.severity)) counts[finding.severity] += 1
    }
  }

  const overallVerdict =
    validationErrors.length > 0
      ? null
      : reviewerResults
          .map((result) => result.verdict)
          .reduce((worst, current) =>
            verdictOrder.get(current) > verdictOrder.get(worst) ? current : worst
          , 'approve')
  const checks = input.checks ?? { state: 'missing', runs: [] }
  const validation = input.validation ?? []
  const failedValidation = validation.some((item) => item.status === 'failed')
  const incompleteValidation = validation.some((item) =>
    ['pending', 'not-run'].includes(item.status)
  )
  const spec = input.spec ?? { status: 'unavailable', behaviorChanging: true }
  const specComplete =
    ['reviewed', 'not-needed'].includes(spec.status) ||
    (spec.status === 'unavailable' && spec.behaviorChanging === false)
  const architecture = input.architecture ?? {
    gate: 'skip',
    reviewed: false
  }
  let mergeStatus
  let decidingRule

  if (
    overallVerdict === 'request-changes' ||
    counts.blocker > 0 ||
    counts.major > 0 ||
    checks.state === 'failure' ||
    failedValidation ||
    input.securityOrDataLossRisk === true
  ) {
    mergeStatus = 'RED'
    if (
      overallVerdict === 'request-changes' ||
      counts.blocker > 0 ||
      counts.major > 0
    ) {
      decidingRule = 'A reviewer requested changes or a blocker or major finding remains.'
    } else if (checks.state === 'failure' || failedValidation) {
      decidingRule = 'Required validation failed.'
    } else {
      decidingRule = 'A security or data-loss risk remains.'
    }
  } else if (
    validationErrors.length > 0 ||
    input.criticalScopeReviewed === false ||
    input.conflictingEvidence === true ||
    (architecture.gate === 'run' && architecture.reviewed !== true)
  ) {
    mergeStatus = 'GRAY'
    if (validationErrors.length > 0) {
      decidingRule = 'A reviewer result was invalid.'
    } else if (input.criticalScopeReviewed === false) {
      decidingRule = 'Critical scope was not reviewed.'
    } else if (input.conflictingEvidence === true) {
      decidingRule = 'Review evidence conflicts.'
    } else {
      decidingRule = 'The required Architecture & DDD review did not run.'
    }
  } else if (
    counts.minor > 0 ||
    counts.nit > 0 ||
    checks.state === 'pending' ||
    incompleteValidation ||
    !specComplete
  ) {
    mergeStatus = 'AMBER'
    if (!specComplete) {
      decidingRule =
        spec.status === 'unavailable' && spec.behaviorChanging === true
          ? 'The Spec axis was unavailable for a behavior-changing change.'
          : 'The Spec axis did not run and was not marked not-needed.'
    } else if (checks.state === 'pending' || incompleteValidation) {
      decidingRule = 'Relevant validation is pending or did not run.'
    } else {
      decidingRule = 'Non-blocking findings remain.'
    }
  } else {
    mergeStatus = 'GREEN'
    decidingRule = 'Every reviewer approved and all applicable review and validation evidence is complete.'
  }

  const mergeReady =
    !['RED', 'GRAY'].includes(mergeStatus) &&
    !['failure', 'pending'].includes(checks.state) &&
    !failedValidation &&
    !incompleteValidation &&
    specComplete &&
    (architecture.gate === 'skip' || architecture.reviewed === true)

  let mergeReadyReason
  if (mergeReady) {
    mergeReadyReason =
      counts.minor > 0 || counts.nit > 0
        ? 'Only non-blocking findings remain; required review and validation evidence is complete.'
        : 'Required review and validation evidence is complete.'
  } else if (mergeStatus === 'RED') {
    mergeReadyReason =
      'Blocking findings, risks, or failed validation must be resolved before merge.'
  } else if (mergeStatus === 'GRAY') {
    mergeReadyReason = 'Review evidence is invalid, incomplete, or conflicting.'
  } else if (checks.state === 'pending' || incompleteValidation) {
    mergeReadyReason = 'Relevant validation is pending or did not run.'
  } else if (!specComplete) {
    mergeReadyReason = 'The Spec axis did not run and was not marked not-needed.'
  } else {
    mergeReadyReason = 'Required review evidence is incomplete.'
  }

  return {
    valid: validationErrors.length === 0,
    validationErrors,
    overallVerdict,
    findings: counts,
    mergeStatus,
    decidingRule,
    mergeReady,
    mergeReadyReason,
    reviewers: reviewerResults
  }
}

const defaultExtractArchive = async ({ archivePath, destination }) => {
  const result = spawnSync(
    'tar',
    ['-xzf', archivePath, '--strip-components=1', '-C', destination],
    { encoding: 'utf8' }
  )

  if (result.status !== 0) {
    throw new Error(`Could not extract GitHub archive: ${result.stderr}`)
  }
}

export const materializeSnapshot = async ({
  pullRequest,
  destination,
  request = githubRequest,
  extractArchive = defaultExtractArchive
}) => {
  const parsed = parsePullRequest(pullRequest)
  const pull = await request(
    `/repos/${parsed.owner}/${parsed.repository}/pulls/${parsed.number}`
  )
  const headSha = pull.head.sha
  const target = destination
    ? path.resolve(destination)
    : await mkdtemp(path.join(tmpdir(), 'pr-review-'))

  await mkdir(target, { recursive: true })
  const existing = await readdir(target)

  if (existing.length > 0) {
    throw new Error(`Snapshot destination is not empty: ${target}`)
  }

  const archivePath = path.join(target, '.source.tar.gz')
  const archive = await request(
    `/repos/${parsed.owner}/${parsed.repository}/tarball/${headSha}`,
    { accept: 'application/vnd.github+json', binary: true }
  )

  await writeFile(archivePath, archive)

  try {
    await extractArchive({ archivePath, destination: target })
  } finally {
    await rm(archivePath, { force: true })
  }

  return {
    path: target,
    headSha,
    source: parsed.url
  }
}

const readJson = async (filePath) =>
  JSON.parse(await readFile(path.resolve(filePath), 'utf8'))

const emit = async (value, outputPath) => {
  const serialized = `${JSON.stringify(value, null, 2)}\n`

  if (outputPath) {
    await writeFile(path.resolve(outputPath), serialized)
    return
  }

  process.stdout.write(serialized)
}

const help = `Usage:
  review-tools.mjs collect --pr <url|owner/repo#n> [--wait-checks <seconds>] [--out <file>]
  review-tools.mjs collect --range <base...target> [--repo <path>] [--out <file>]
  review-tools.mjs compile-panel --evidence <file> --plan <file> [--out <file>]
  review-tools.mjs aggregate --input <file> [--out <file>]
  review-tools.mjs snapshot --pr <url|owner/repo#n> [--destination <path>] [--out <file>]
`

const main = async () => {
  const [command, ...args] = process.argv.slice(2)
  const options = parseOptions(args)

  if (!command || command === '--help' || command === 'help' || options.help) {
    process.stdout.write(help)
    return
  }

  if (command === 'collect') {
    const evidence = options.pr
      ? await collectGithubEvidence({
          pullRequest: options.pr,
          waitForChecksSeconds: Number(options['wait-checks'] ?? 0)
        })
      : options.range
        ? collectLocalEvidence({
            range: options.range,
            repositoryPath: options.repo ?? process.cwd()
          })
        : undefined

    if (!evidence) throw new Error('collect requires --pr or --range')
    await emit(evidence, options.out)
    return
  }

  if (command === 'compile-panel') {
    if (!options.evidence || !options.plan) {
      throw new Error('compile-panel requires --evidence and --plan')
    }
    await emit(
      await compilePanel({
        evidence: await readJson(options.evidence),
        plan: await readJson(options.plan)
      }),
      options.out
    )
    return
  }

  if (command === 'aggregate') {
    if (!options.input) throw new Error('aggregate requires --input')
    await emit(aggregateReview(await readJson(options.input)), options.out)
    return
  }

  if (command === 'snapshot') {
    if (!options.pr) throw new Error('snapshot requires --pr')
    await emit(
      await materializeSnapshot({
        pullRequest: options.pr,
        destination: options.destination
      }),
      options.out
    )
    return
  }

  throw new Error(`Unknown command ${command}\n${help}`)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
