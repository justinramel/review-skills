import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  aggregateReview,
  collectGithubEvidence,
  collectLocalEvidence,
  compilePanel,
  deriveSpecCandidates,
  materializeSnapshot,
  parseDiff,
  parsePullRequest,
  rollupChecks,
  validateReviewerResult
} from './review-tools.mjs'

const sampleDiff = `diff --git a/src/app.ts b/src/app.ts
index 1111111..2222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -3,2 +3,3 @@ export const run = () => {
-  return false
+  const ready = true
+  return ready
 }
diff --git a/src/new.ts b/src/new.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,2 @@
+export const value = 1
+
`

const approveResult = {
  name: 'Standards',
  files: ['src/app.ts', 'src/new.ts'],
  verdict: 'approve',
  runtime: { model: 'provider/reviewer', effort: 'high' },
  findings: []
}

const evidenceFixture = () => ({
  pullRequest: {
    baseSha: 'base-sha',
    headSha: 'head-sha'
  },
  diff: {
    raw: sampleDiff,
    files: parseDiff(sampleDiff, {
      owner: 'acme',
      repository: 'widget',
      headSha: 'head-sha'
    })
  },
  standards: [
    {
      path: 'README.md',
      revision: 'head-sha',
      content: 'Use boring TypeScript.'
    }
  ]
})

test('parses supported pull request identifiers', () => {
  assert.deepEqual(parsePullRequest('https://github.com/acme/widget/pull/7'), {
    owner: 'acme',
    repository: 'widget',
    number: 7,
    url: 'https://github.com/acme/widget/pull/7'
  })
  assert.equal(parsePullRequest('acme/widget#7').number, 7)
  assert.throws(() => parsePullRequest('not-a-pr'), /Invalid pull request/)
})

test('parses file hunks, target ranges, and immutable links', () => {
  const files = parseDiff(sampleDiff, {
    owner: 'acme',
    repository: 'widget',
    headSha: 'abc123'
  })

  assert.deepEqual(
    files.map(({ path: filePath, status }) => ({ filePath, status })),
    [
      { filePath: 'src/app.ts', status: 'modified' },
      { filePath: 'src/new.ts', status: 'added' }
    ]
  )
  assert.deepEqual(files[0].targetLineRanges, [{ start: 3, end: 5, count: 3 }])
  assert.equal(
    files[0].targetBlobUrl,
    'https://github.com/acme/widget/blob/abc123/src/app.ts#L3-L5'
  )
})

test('extracts Jira keys and linked GitHub issues', () => {
  assert.deepEqual(
    deriveSpecCandidates({
      title: 'Implement FGP-42',
      branch: 'feature/FGP-42',
      commitMessages: ['Finish OPS-9'],
      body: 'Closes #12 and follows https://github.com/other/repo/issues/3',
      owner: 'acme',
      repository: 'widget'
    }),
    {
      jiraKeys: ['FGP-42', 'OPS-9'],
      linkedIssues: [
        'https://github.com/other/repo/issues/3',
        'https://github.com/acme/widget/issues/12'
      ]
    }
  )
})

test('rolls check evidence into deterministic states', () => {
  assert.equal(rollupChecks([]), 'missing')
  assert.equal(
    rollupChecks([{ status: 'in_progress', conclusion: null }]),
    'pending'
  )
  assert.equal(
    rollupChecks([{ status: 'completed', conclusion: 'success' }]),
    'success'
  )
  assert.equal(
    rollupChecks([{ status: 'completed', conclusion: 'failure' }]),
    'failure'
  )
})

test('collects a pinned GitHub evidence pack through an injected client', async () => {
  const calls = []
  const request = async (resource, options = {}) => {
    calls.push([resource, options])

    if (
      resource === '/repos/acme/widget/pulls/7' &&
      options.accept?.includes('diff')
    ) {
      return sampleDiff
    }
    if (resource === '/repos/acme/widget/pulls/7') {
      return {
        title: 'Implement FGP-42',
        body: 'Closes #12',
        base: { ref: 'main', sha: 'base-sha' },
        head: { ref: 'feature/FGP-42', sha: 'head-sha' }
      }
    }
    if (resource.includes('/pulls/7/commits?')) {
      return [
        {
          sha: 'commit-sha',
          commit: { message: 'Implement FGP-42' }
        }
      ]
    }
    if (resource.includes('/git/trees/head-sha')) {
      return {
        truncated: false,
        tree: [{ type: 'blob', path: 'README.md', sha: 'readme-sha' }]
      }
    }
    if (resource.endsWith('/git/blobs/readme-sha')) {
      return {
        encoding: 'base64',
        content: Buffer.from('Repository standards').toString('base64')
      }
    }
    if (resource.includes('/check-runs')) {
      return {
        check_runs: [
          {
            name: 'CI',
            status: 'completed',
            conclusion: 'success',
            html_url: 'https://example.test/ci'
          }
        ]
      }
    }
    if (resource.endsWith('/status')) return { statuses: [] }

    throw new Error(`Unexpected request ${resource}`)
  }

  const evidence = await collectGithubEvidence({
    pullRequest: 'acme/widget#7',
    request
  })

  assert.equal(evidence.pullRequest.headSha, 'head-sha')
  assert.equal(evidence.checks.state, 'success')
  assert.equal(evidence.standards[0].content, 'Repository standards')
  assert.deepEqual(evidence.specCandidates.jiraKeys, ['FGP-42'])
  assert.equal(evidence.diff.files.length, 2)
  assert.ok(calls.some(([resource]) => resource.includes('/commits?')))
})

test('collects a local range from committed revisions', async (t) => {
  const repository = await mkdtemp(path.join(tmpdir(), 'review-tools-git-'))
  t.after(() => rm(repository, { recursive: true, force: true }))
  const runGit = (...args) =>
    execFileSync('git', args, { cwd: repository, stdio: 'ignore' })

  runGit('init')
  runGit('config', 'user.name', 'Review Tools')
  runGit('config', 'user.email', 'review@example.test')
  await writeFile(path.join(repository, 'README.md'), '# Standards\n')
  runGit('add', 'README.md')
  runGit('commit', '-m', 'Base')
  const baseSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repository,
    encoding: 'utf8'
  }).trim()
  await writeFile(path.join(repository, 'app.js'), 'export const value = 1\n')
  runGit('add', 'app.js')
  runGit('commit', '-m', 'Implement FGP-8')

  const evidence = collectLocalEvidence({
    range: `${baseSha}...HEAD`,
    repositoryPath: repository
  })

  assert.equal(evidence.source, 'local-range')
  assert.deepEqual(evidence.diff.files.map((file) => file.path), ['app.js'])
  assert.deepEqual(evidence.specCandidates.jiraKeys, ['FGP-8'])
  assert.equal(evidence.standards[0].path, 'README.md')
})

test('compiles task-ready reviewer briefs with strict schema', async () => {
  const evidence = evidenceFixture()
  const panel = await compilePanel({
    evidence,
    plan: {
      fullDiffUri: 'pr://acme/widget/7/diff/all',
      reviewers: [
        {
          name: 'Standards',
          mode: 'standards-only',
          files: ['src/app.ts', 'src/new.ts']
        }
      ]
    }
  })

  assert.equal(panel.reviewers[0].profile, 'review')
  assert.equal(panel.reviewers[0].schemaMode, 'strict')
  assert.equal(panel.reviewers[0].outputSchema.additionalProperties, false)
  assert.equal(panel.reviewDepth, 'fast')
  assert.equal(
    Object.hasOwn(panel.reviewers[0].outputSchema.properties, 'confidence'),
    false
  )
  assert.match(panel.reviewers[0].task, /Exact assigned diff hunks/)
  assert.match(panel.reviewers[0].task, /Use boring TypeScript/)
  assert.match(panel.reviewers[0].task, /src\/new\.ts/)
})

test('defaults to a three-reviewer fast panel and requires explicit thorough depth', async () => {
  const evidence = evidenceFixture()
  const reviewers = ['First', 'Second', 'Third', 'Fourth'].map((name) => ({
    name,
    mode: 'standards-only',
    files: ['src/app.ts', 'src/new.ts']
  }))

  await assert.rejects(
    compilePanel({
      evidence,
      plan: {
        fullDiffUri: 'pr://acme/widget/7/diff/all',
        reviewers
      }
    }),
    /fast review supports at most 3 verdict-bearing reviewers/
  )

  const panel = await compilePanel({
    evidence,
    plan: {
      reviewDepth: 'thorough',
      fullDiffUri: 'pr://acme/widget/7/diff/all',
      reviewers
    }
  })

  assert.equal(panel.reviewDepth, 'thorough')
  assert.equal(panel.reviewers.length, 4)
})

test('rejects incomplete panel ownership and missing axis context', async () => {
  const evidence = evidenceFixture()

  await assert.rejects(
    compilePanel({
      evidence,
      plan: {
        fullDiffUri: 'pr://acme/widget/7/diff/all',
        reviewers: [
          {
            name: 'Standards',
            mode: 'standards-only',
            files: ['src/app.ts']
          }
        ]
      }
    }),
    /must own the whole diff/
  )
  await assert.rejects(
    compilePanel({
      evidence,
      plan: {
        fullDiffUri: 'pr://acme/widget/7/diff/all',
        reviewers: [
          {
            name: 'Spec',
            mode: 'spec-only',
            files: ['src/app.ts', 'src/new.ts']
          }
        ]
      }
    }),
    /has no specification/
  )
})

test('validates reviewer semantics and rejects agent wrappers', () => {
  assert.deepEqual(validateReviewerResult(approveResult), [])
  assert.deepEqual(
    validateReviewerResult({
      ...approveResult,
      verdict: 'request-changes',
      findings: [
        {
          severity: 'major',
          location: 'src/app.ts:1',
          summary: 'The changed path drops the request',
          evidence: 'The handler returns before forwarding the request.',
          fix: 'Forward the request and assert the observed response.'
        }
      ]
    }),
    []
  )
  assert.match(
    validateReviewerResult({
      overall_correctness: 'correct'
    }).join('\n'),
    /unsupported keys|name is required/
  )
  assert.match(
    validateReviewerResult({
      ...approveResult,
      confidence: 0.9
    }).join('\n'),
    /unsupported keys: confidence/
  )
  assert.match(
    validateReviewerResult({
      ...approveResult,
      verdict: 'request-changes',
      findings: [
        {
          severity: 'major',
          location: 'src/app.ts:1',
          evidence: 'The changed path drops the request.',
          fix: 'Preserve the request and assert its observable result.'
        }
      ]
    }).join('\n'),
    /summary is required/
  )
  assert.match(
    validateReviewerResult({
      ...approveResult,
      runtime: {
        ...approveResult.runtime,
        inferred: true
      }
    }).join('\n'),
    /runtime has unsupported keys: inferred/
  )
  assert.match(
    validateReviewerResult({
      ...approveResult,
      verdict: 'request-changes'
    }).join('\n'),
    /does not match findings/
  )
})

test('aggregates green, amber, red, and gray outcomes', () => {
  const complete = {
    reviewers: [approveResult],
    checks: { state: 'success', runs: [] },
    spec: { status: 'reviewed', behaviorChanging: true },
    architecture: { gate: 'skip', reviewed: false },
    validation: [{ name: 'CI', status: 'passed' }]
  }

  assert.deepEqual(
    {
      status: aggregateReview(complete).mergeStatus,
      ready: aggregateReview(complete).mergeReady
    },
    { status: 'GREEN', ready: true }
  )
  assert.equal(
    aggregateReview({
      ...complete,
      spec: { status: 'unavailable', behaviorChanging: true }
    }).mergeStatus,
    'AMBER'
  )
  assert.equal(
    aggregateReview({
      ...complete,
      checks: { state: 'failure', runs: [] }
    }).mergeStatus,
    'RED'
  )
  assert.equal(
    aggregateReview({
      ...complete,
      reviewers: [{ overall_correctness: 'correct' }]
    }).mergeStatus,
    'GRAY'
  )
})

test('materializes an immutable PR snapshot through injected transport', async (t) => {
  const destination = await mkdtemp(path.join(tmpdir(), 'review-snapshot-'))
  t.after(() => rm(destination, { recursive: true, force: true }))
  const request = async (resource, options = {}) => {
    if (resource.endsWith('/pulls/7')) {
      return { head: { sha: 'head-sha' } }
    }
    if (resource.endsWith('/tarball/head-sha') && options.binary) {
      return Buffer.from('archive')
    }
    throw new Error(`Unexpected request ${resource}`)
  }
  const extractArchive = async ({ destination: target }) => {
    await writeFile(path.join(target, 'README.md'), '# Snapshot\n')
  }

  const snapshot = await materializeSnapshot({
    pullRequest: 'acme/widget#7',
    destination,
    request,
    extractArchive
  })

  assert.equal(snapshot.headSha, 'head-sha')
  assert.equal(await readFile(path.join(destination, 'README.md'), 'utf8'), '# Snapshot\n')
  await assert.rejects(readFile(path.join(destination, '.source.tar.gz')))
})
