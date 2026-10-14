import type { UnifiedDiff } from '@devdigest/shared';
import { sliceDiff } from '@devdigest/reviewer-core';
import type { Container } from '../../platform/container.js';
import type { RunLogger, PinoLike } from '../../platform/run-logger.js';
import type { PullRow } from '../../db/rows.js';
import { NotFoundError } from '../../platform/errors.js';
import { resolveFeatureModel } from '../settings/feature-models.js';
import { BUDGET } from './constants.js';
import { classifyIntent, type IntentBundle } from './classifier.js';
import {
  addedFileContentFromPatch,
  computeConfidence,
  detectRiskSignals,
  extractReferences,
  inputHash,
  isMeaningfulDescription,
  mergeRiskAreas,
  minConfidence,
  renderIntentForPrompt,
  sanitizeForPrompt,
} from './helpers.js';
import { IntentRepository, type PullContext, type RepoRow, type StoredIntent } from './repository.js';
import type { IntentResponse, IntentSource } from './schemas.js';

/** One in-flight computation per PR: concurrent callers share the same promise. */
const inFlight = new Map<string, Promise<StoredIntent>>();

interface FileInfo {
  path: string;
  additions: number;
  deletions: number;
}

interface Gathered {
  bundle: IntentBundle;
  sources: IntentSource[];
  hasDoc: boolean;
  hasDesc: boolean;
  hasIssue: boolean;
  heuristics: ReturnType<typeof detectRiskSignals>;
}

/**
 * Derives and caches a PR's intent: gather sources (title/description, linked
 * same-repo issues and docs at the PR head, branch/commits/files) → deterministic
 * confidence → one cheap-model classification → persist. `ensureIntent` is the
 * review-run entry point and NEVER throws: intent is context, not a gate.
 */
export class IntentService {
  private repo: IntentRepository;

  constructor(private container: Container) {
    this.repo = new IntentRepository(container.db);
  }

  /** Stored intent + staleness + the model a recompute would use. Never calls an LLM. */
  async get(workspaceId: string, prId: string): Promise<IntentResponse> {
    const ctx = await this.repo.getPullContext(workspaceId, prId);
    if (!ctx) throw new NotFoundError('Pull request not found');
    const model = await resolveFeatureModel(this.container, workspaceId, 'review_intent');
    const stored = await this.repo.getRecord(prId);
    const stale = stored ? stored.inputHash !== this.hashFor(ctx.pull, model) : false;
    return { intent: stored?.record ?? null, stale, model };
  }

  /** Always recompute (the card's button). Errors propagate to the route. */
  async recompute(workspaceId: string, prId: string, log?: RunLogger): Promise<IntentResponse> {
    const ctx = await this.repo.getPullContext(workspaceId, prId);
    if (!ctx) throw new NotFoundError('Pull request not found');
    const model = await resolveFeatureModel(this.container, workspaceId, 'review_intent');
    const stored = await this.computeOnce(workspaceId, ctx.pull, ctx.repo, undefined, log);
    return { intent: stored.record, stale: false, model };
  }

  /**
   * Review-run pre-work: reuse the stored intent when its inputs are unchanged,
   * otherwise recompute. Returns the rendered prompt block, or `undefined` on ANY
   * failure (logged as a non-fatal info line — deliberately not `runLog.step`,
   * whose `error` event would toast in the client).
   */
  async ensureIntent(
    workspaceId: string,
    pull: PullRow,
    repo: RepoRow,
    diff: UnifiedDiff,
    runLog: RunLogger,
    logger?: PinoLike,
  ): Promise<string | undefined> {
    try {
      const model = await resolveFeatureModel(this.container, workspaceId, 'review_intent');
      const stored = await this.repo.getRecord(pull.id);
      if (stored && stored.inputHash === this.hashFor(pull, model)) {
        runLog.info(
          `Intent: cached (computed ${stored.record.computed_at ?? 'earlier'}, confidence=${stored.record.confidence ?? 'low'})`,
        );
        return renderIntentForPrompt(stored.record);
      }
      const fresh = await this.computeOnce(workspaceId, pull, repo, diff, runLog);
      return renderIntentForPrompt(fresh.record);
    } catch (err) {
      const msg = (err as Error).message;
      runLog.info(`Intent unavailable — reviewing without it: ${msg}`);
      logger?.warn({ prId: pull.id, err: msg }, 'intent: unavailable, reviewing without it');
      return undefined;
    }
  }

  // ------------------------------------------------------------------ internals

  private hashFor(pull: PullRow, model: { provider: string; model: string }): string {
    return inputHash({
      title: pull.title,
      body: pull.body,
      branch: pull.branch,
      headSha: pull.headSha,
      provider: model.provider,
      model: model.model,
    });
  }

  private computeOnce(
    workspaceId: string,
    pull: PullRow,
    repo: RepoRow,
    diff: UnifiedDiff | undefined,
    log?: RunLogger,
  ): Promise<StoredIntent> {
    const running = inFlight.get(pull.id);
    if (running) return running;
    const p = this.compute(workspaceId, pull, repo, diff, log).finally(() => {
      inFlight.delete(pull.id);
    });
    inFlight.set(pull.id, p);
    return p;
  }

  private async compute(
    workspaceId: string,
    pull: PullRow,
    repo: RepoRow,
    diff: UnifiedDiff | undefined,
    log?: RunLogger,
  ): Promise<StoredIntent> {
    const t0 = Date.now();
    const model = await resolveFeatureModel(this.container, workspaceId, 'review_intent');
    // Resolve the provider first: a missing key fails fast, before any GitHub/git work.
    const llm = await this.container.llm(model.provider);

    log?.tool(`Deriving PR intent (${model.provider}/${model.model})…`);
    const { commits, files: dbFiles } = await this.repo.getCommitsAndFiles(pull.id);
    const files: FileInfo[] = diff
      ? diff.files.map((f) => ({ path: f.path, additions: f.additions, deletions: f.deletions }))
      : dbFiles;
    const patchFor = (path: string): string | null =>
      dbFiles.find((f) => f.path === path)?.patch ?? (diff ? sliceDiff(diff, path) : null);

    const g = await this.gather(pull, repo, commits.map((c) => c.message), files, patchFor);
    log?.info(summarizeSources(g.sources));

    const res = await classifyIntent(llm, model.model, g.bundle);
    const det = computeConfidence({ hasDoc: g.hasDoc, hasDesc: g.hasDesc, hasIssue: g.hasIssue });
    const confidence = minConfidence(det, res.data.confidence);

    await this.repo.upsertRecord(pull.id, {
      intent: res.data.intent,
      inScope: res.data.in_scope,
      outOfScope: res.data.out_of_scope,
      confidence,
      sources: g.sources,
      riskAreas: mergeRiskAreas(g.heuristics, res.data.risk_areas),
      provider: model.provider,
      model: model.model,
      headSha: pull.headSha,
      inputHash: this.hashFor(pull, model),
      tokensIn: res.tokensIn,
      tokensOut: res.tokensOut,
      costUsd: res.costUsd,
    });
    const stored = await this.repo.getRecord(pull.id);
    if (!stored) throw new Error('intent record missing after upsert');

    const ms = Date.now() - t0;
    log?.result(
      `Intent ready — confidence=${confidence}, ${stored.record.in_scope.length} in-scope, ` +
        `${stored.record.out_of_scope.length} out-of-scope, ${stored.record.risk_areas?.length ?? 0} risk area(s)` +
        `${res.costUsd != null ? `, $${res.costUsd.toFixed(4)}` : ''} (${ms}ms)`,
    );
    return stored;
  }

  /** Collect every source within its budget. Network/git failures degrade per item. */
  private async gather(
    pull: PullRow,
    repo: RepoRow,
    commitMessages: string[],
    files: FileInfo[],
    patchFor: (path: string) => string | null,
  ): Promise<Gathered> {
    const repoRef = { owner: repo.owner, name: repo.name };
    const sources: IntentSource[] = [];
    const refs = extractReferences({
      body: pull.body,
      title: pull.title,
      branch: pull.branch,
      repo: repoRef,
    });

    sources.push({ kind: 'title', ref: 'title', fetched: true, chars: Math.min(pull.title.length, BUDGET.title) });
    const hasDesc = isMeaningfulDescription(pull.body);
    if (pull.body && pull.body.trim() !== '') {
      sources.push({
        kind: 'description',
        ref: 'description',
        fetched: true,
        chars: Math.min(pull.body.length, BUDGET.description),
      });
    }

    // ---- linked same-repo issues (best-effort; cross-repo is only recorded) ----
    const issues: IntentBundle['issues'] = [];
    const wanted = refs.issues.slice(0, BUDGET.issues);
    for (const n of refs.issues.slice(BUDGET.issues)) {
      sources.push({ kind: 'issue', ref: `#${n}`, fetched: false, note: 'skipped (limit)' });
    }
    if (wanted.length > 0) {
      let gh: Awaited<ReturnType<Container['github']>> | undefined;
      try {
        gh = await this.container.github();
      } catch {
        gh = undefined;
      }
      for (const n of wanted) {
        try {
          if (!gh) throw new Error('github unavailable');
          const issue = await gh.getIssue(repoRef, n);
          const body = (issue.body ?? '').slice(0, BUDGET.issueChars);
          issues.push({ number: n, title: issue.title, body });
          sources.push({ kind: 'issue', ref: `#${n}`, fetched: true, chars: issue.title.length + body.length });
        } catch {
          sources.push({ kind: 'issue', ref: `#${n}`, fetched: false, note: 'unavailable' });
        }
      }
    }
    for (const ref of refs.crossRepo) {
      sources.push({ kind: 'issue', ref, fetched: false, note: 'other repository — not fetched' });
    }

    // ---- linked docs at the PR head SHA ---------------------------------------
    const docs: IntentBundle['docs'] = [];
    let remaining = BUDGET.docsTotalChars;
    let headFetched = false;
    for (const path of refs.docs.slice(0, BUDGET.docs)) {
      let text = await this.container.repoDocs.readAtRef(repoRef, pull.headSha, path, BUDGET.docReadBytes);
      if (text === null && !headFetched) {
        // The PR head may not be in the (shallow) clone yet — fetch it once, retry.
        headFetched = true;
        try {
          await this.container.git.fetchPullHead(repoRef, pull.number);
          text = await this.container.repoDocs.readAtRef(repoRef, pull.headSha, path, BUDGET.docReadBytes);
        } catch {
          /* fall through to the added-file fallback */
        }
      }
      text ??= addedFileContentFromPatch(patchFor(path));
      if (text === null || remaining <= 0) {
        sources.push({ kind: 'doc', ref: path, fetched: false, note: text === null ? 'unavailable' : 'skipped (limit)' });
        continue;
      }
      const capped = text.slice(0, Math.min(BUDGET.docChars, remaining));
      remaining -= capped.length;
      docs.push({ path, text: capped });
      sources.push({ kind: 'doc', ref: path, fetched: true, chars: capped.length });
    }
    for (const path of refs.docs.slice(BUDGET.docs)) {
      sources.push({ kind: 'doc', ref: path, fetched: false, note: 'skipped (limit)' });
    }

    // ---- indirect signals -------------------------------------------------------
    sources.push({ kind: 'branch', ref: pull.branch.slice(0, BUDGET.branch), fetched: true });
    const firstLines = commitMessages
      .slice(0, BUDGET.commits)
      .map((m) => m.split('\n')[0] ?? '')
      .filter((l) => l.trim() !== '');
    if (firstLines.length > 0) {
      sources.push({ kind: 'commits', ref: `${firstLines.length} commit(s)`, fetched: true });
    }
    const fileLines = files
      .slice(0, BUDGET.files)
      .map((f) => `${f.path} (+${f.additions}/-${f.deletions})`);
    if (fileLines.length > 0) {
      sources.push({ kind: 'files', ref: `${files.length} file(s)`, fetched: true });
    }

    const heuristics = detectRiskSignals(files.map((f) => ({ path: f.path, patch: patchFor(f.path) })));
    for (const r of heuristics) sources.push({ kind: 'risk_signal', ref: r.label, fetched: true });
    for (const key of refs.ticketKeys) {
      sources.push({ kind: 'ticket_key', ref: key, fetched: false, note: 'not fetched' });
    }
    for (const url of refs.externalLinks) {
      sources.push({ kind: 'external_link', ref: url, fetched: false, note: 'external — not fetched' });
    }

    return {
      bundle: {
        title: pull.title,
        description: pull.body ? sanitizeForPrompt(pull.body, BUDGET.description) : null,
        branch: pull.branch,
        commits: firstLines,
        files: fileLines,
        riskSignals: heuristics.map((r) => r.label),
        issues,
        docs,
      },
      sources,
      hasDoc: docs.length > 0,
      hasDesc,
      hasIssue: issues.some((i) => i.title.trim() !== ''),
      heuristics,
    };
  }
}

/** "Intent sources: description, issue #471, doc docs/plans/x.md (2 not fetched)". */
function summarizeSources(sources: IntentSource[]): string {
  const used = sources
    .filter((s) => s.fetched)
    .map((s) => (s.kind === 'issue' || s.kind === 'doc' ? `${s.kind} ${s.ref}` : s.kind));
  const unique = [...new Set(used)];
  const notFetched = sources.filter((s) => !s.fetched).length;
  return `Intent sources: ${unique.join(', ')}${notFetched > 0 ? ` (${notFetched} not fetched)` : ''}`;
}
