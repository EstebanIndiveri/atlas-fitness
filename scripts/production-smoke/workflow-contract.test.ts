/**
 * @jest-environment node
 *
 * Workflow-contract regression test for `.github/workflows/production-auth-smoke.yml`.
 *
 * The workflow is the trust boundary for a production authenticated smoke: it is
 * the only place allowed to combine a production credential with a dispatchable
 * run. These assertions pin the security/correctness contract from the
 * architecture (2026-09-30, §5-§7) so a future edit cannot silently weaken it.
 *
 * Structural assertions prefer parsing YAML through `js-yaml` (resolvable in this
 * dependency tree). If the parser is genuinely unavailable the test falls back to
 * robust line/regex assertions on the raw workflow text; a parser that is present
 * but rejects the document fails the test instead of being skipped.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const requireFromHere = createRequire(__filename);

const WORKFLOW_RELATIVE_PATH = '.github/workflows/production-auth-smoke.yml';

const RUNNER_INVOCATION = 'npx tsx scripts/production-smoke/index.ts';

/** Non-secret runner environment variable names the invocation must provide. */
const REQUIRED_RUNNER_ENV_KEYS = [
  'ATLAS_SMOKE_BASE_URL',
  'ATLAS_SMOKE_EMAIL',
  'ATLAS_SMOKE_PASSWORD',
  'ATLAS_SMOKE_EXPECTED_RELEASE_SHA',
  'ATLAS_SMOKE_ACTUAL_RELEASE_SHA',
  'ATLAS_SMOKE_DEPLOYMENT_ID',
  'ATLAS_SMOKE_DEPLOYMENT_ENVIRONMENT',
  'ATLAS_SMOKE_DEPLOYMENT_URL',
  'ATLAS_SMOKE_WORKFLOW_RUN_ID',
  'ATLAS_SMOKE_EVIDENCE_PATH',
] as const;

/** Triggers that must never be present on this workflow. */
const FORBIDDEN_TRIGGERS = ['pull_request', 'push', 'schedule', 'workflow_run', 'repository_dispatch'];

type WorkflowDoc = Record<string, unknown>;

const workflowText = readFileSync(join(process.cwd(), WORKFLOW_RELATIVE_PATH), 'utf8');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asSteps(job: Record<string, unknown>): Record<string, unknown>[] {
  const steps = job.steps;
  return Array.isArray(steps) ? steps.filter(isRecord) : [];
}

interface ParseResult {
  /** Whether `js-yaml` could be resolved at all. */
  available: boolean;
  doc: WorkflowDoc | null;
  error: unknown;
}

/** Parses the workflow with `js-yaml` when that parser is safely resolvable. */
function parseWorkflow(text: string): ParseResult {
  let resolved: string;
  try {
    resolved = requireFromHere.resolve('js-yaml');
  } catch {
    return { available: false, doc: null, error: null };
  }

  try {
    const yaml = requireFromHere(resolved) as { load(input: string): unknown };
    const parsed = yaml.load(text);
    return { available: true, doc: isRecord(parsed) ? parsed : null, error: null };
  } catch (error) {
    return { available: true, doc: null, error };
  }
}

const parsed = parseWorkflow(workflowText);
const workflow = parsed.doc;

const jobs = asRecord(workflow?.jobs);
const job = asRecord(jobs['production-auth-smoke']);
const on = asRecord(workflow?.on);
const dispatchInputs = asRecord(asRecord(on.workflow_dispatch).inputs);
const permissions = asRecord(workflow?.permissions);
const concurrency = asRecord(workflow?.concurrency);
const steps = asSteps(job);

/** `it` that only executes the structural body when a parsed document exists. */
const parsedIt = workflow === null ? it.skip : it;

describe('production-auth-smoke workflow text contract', () => {
  it('is manually dispatched only', () => {
    expect(workflowText).toMatch(/^on:\s*$/m);
    expect(workflowText).toContain('workflow_dispatch:');
    for (const trigger of FORBIDDEN_TRIGGERS) {
      expect(workflowText).not.toMatch(new RegExp(`^\\s*${trigger}:`, 'm'));
    }
  });

  it('uses least privilege, a serialized single-run lock, and a finite timeout', () => {
    expect(workflowText).toMatch(/^permissions:\s*$/m);
    expect(workflowText).toMatch(/^\s*contents:\s*read\s*$/m);
    expect(workflowText).toMatch(/^\s*group:\s*production-auth-smoke\s*$/m);
    expect(workflowText).toMatch(/^\s*cancel-in-progress:\s*false\s*$/m);
    expect(workflowText).toMatch(/^\s*timeout-minutes:\s*\d+\s*$/m);
  });

  it('binds the job to the production-qa environment', () => {
    expect(workflowText).toMatch(/^\s*environment:\s*production-qa\s*$/m);
  });

  it('runs only from trusted main and checks out the exact trusted SHA', () => {
    expect(workflowText).toMatch(/github\.ref\s*==\s*'refs\/heads\/main'/);
    expect(workflowText).toMatch(/ref:\s*\$\{\{\s*github\.sha\s*\}\}/);
    expect(workflowText).toMatch(/persist-credentials:\s*false/);
  });

  it('constrains the dispatch inputs and never accepts a URL or script path', () => {
    expect(workflowText).toMatch(/release_sha:/);
    // Strict SHA validation: ^[0-9a-f]{40}$
    expect(workflowText).toMatch(/\[0-9a-f\]\{40\}/);
    expect(workflowText).toMatch(/mode:/);
    expect(workflowText).toMatch(/confirmation:/);
    // The base URL is derived from deployment metadata, never from an input.
    expect(workflowText).toMatch(/base_url=\$\{environment_url\}/);
  });

  it('takes the password only from the environment secret and declares no data-store credential', () => {
    expect(workflowText).toContain('secrets.ATLAS_PROD_SMOKE_PASSWORD');
    const secretNames = [...workflowText.matchAll(/secrets\.([A-Za-z0-9_]+)/g)].map((match) => match[1]);
    expect([...new Set(secretNames)]).toEqual(['ATLAS_PROD_SMOKE_PASSWORD']);
    expect(workflowText).not.toMatch(/TURSO|VERCEL|DATABASE/i);
  });

  it('proves the Production target from deployment metadata before running', () => {
    expect(workflowText).toMatch(/gh api/);
    expect(workflowText).toContain('deployments');
    expect(workflowText).toContain('environment_url');
    expect(workflowText).toMatch(/environment.*Production|Production.*environment/);
    expect(workflowText).toMatch(/state[^\n]*success|success[^\n]*state/);
  });

  it('invokes the API-only runner with the exact environment contract', () => {
    expect(workflowText).toContain(RUNNER_INVOCATION);
    for (const key of REQUIRED_RUNNER_ENV_KEYS) {
      expect(workflowText).toContain(key);
    }
    expect(workflowText).toMatch(/ATLAS_SMOKE_RECOVERY_ONLY:\s*'1'/);
    expect(workflowText).toContain('production-smoke-recovery.json');
  });

  it('runs an always() recovery cleanup and enforces results in a final gate', () => {
    expect(workflowText).toMatch(/if:\s*always\(\)/);
    expect(workflowText).toMatch(/continue-on-error:\s*true/);
    expect(workflowText).toContain('steps.smoke.outcome');
    expect(workflowText).toContain('steps.recovery.outcome');
    expect(workflowText).not.toMatch(/\bset\s+-x\b/);
  });

  it('uploads sanitized evidence under always() with a finite retention', () => {
    expect(workflowText).toContain('actions/upload-artifact@v4');
    expect(workflowText).toMatch(/if:\s*always\(\)/);
    expect(workflowText).toMatch(/retention-days:\s*\d+/);
  });
});

describe('production-auth-smoke workflow parsed contract', () => {
  it('parses as a YAML mapping when a parser is available', () => {
    if (!parsed.available) {
      return;
    }
    expect(parsed.error).toBeNull();
    expect(workflow).not.toBeNull();
  });

  parsedIt('exposes workflow_dispatch as the only trigger', () => {
    expect(Object.keys(on)).toEqual(['workflow_dispatch']);
  });

  parsedIt('accepts exactly the constrained inputs', () => {
    expect(Object.keys(dispatchInputs).sort()).toEqual(['confirmation', 'mode', 'release_sha']);
    for (const key of Object.keys(dispatchInputs)) {
      expect(key).not.toMatch(/url|ref|path|script|host/i);
    }
    expect(asRecord(dispatchInputs.confirmation).required).toBe(true);
    expect(asRecord(dispatchInputs.release_sha).required).toBe(true);
    const mode = asRecord(dispatchInputs.mode);
    expect(mode.type).toBe('choice');
    expect(mode.default).toBe('smoke');
    expect(mode.options).toEqual(['smoke', 'recovery']);
  });

  parsedIt('grants only contents:read', () => {
    expect(Object.keys(permissions)).toEqual(['contents']);
    expect(permissions.contents).toBe('read');
  });

  parsedIt('defines the single-run concurrency group', () => {
    expect(concurrency.group).toBe('production-auth-smoke');
    expect(concurrency['cancel-in-progress']).toBe(false);
  });

  parsedIt('targets production-qa with a finite timeout and the main guard', () => {
    expect(job.environment).toBe('production-qa');
    const timeout = job['timeout-minutes'];
    expect(typeof timeout).toBe('number');
    if (typeof timeout === 'number') {
      expect(Number.isFinite(timeout)).toBe(true);
      expect(timeout).toBeGreaterThan(0);
    }
    expect(String(job.if)).toContain("github.ref == 'refs/heads/main'");
  });

  parsedIt('checks out github.sha without persisted credentials', () => {
    const checkout = steps.find((step) => String(step.uses) === 'actions/checkout@v4');
    expect(checkout).toBeDefined();
    const withBlock = asRecord(checkout?.with);
    expect(withBlock.ref).toBe('${{ github.sha }}');
    expect(withBlock['persist-credentials']).toBe(false);
  });

  parsedIt('runs the smoke step with continue-on-error and the recovery safety net', () => {
    const smokeStep = steps.find((step) => String(step.name).includes('Run production authenticated smoke'));
    expect(smokeStep).toBeDefined();
    expect(smokeStep?.['continue-on-error']).toBe(true);
    expect(asRecord(smokeStep?.env).ATLAS_SMOKE_EVIDENCE_PATH).toBe('production-smoke-evidence.json');

    const recoveryStep = steps.find(
      (step) =>
        String(step['continue-on-error']) === 'true' &&
        String(asRecord(step.env).ATLAS_SMOKE_RECOVERY_ONLY) === '1',
    );
    expect(recoveryStep).toBeDefined();
    expect(String(recoveryStep?.if)).toBe('always()');
    expect(asRecord(recoveryStep?.env).ATLAS_SMOKE_EVIDENCE_PATH).toBe('production-smoke-recovery.json');
  });

  parsedIt('uploads evidence from an always() artifact step with finite retention', () => {
    const artifactStep = steps.find((step) => String(step.uses) === 'actions/upload-artifact@v4');
    expect(artifactStep).toBeDefined();
    expect(String(artifactStep?.if)).toBe('always()');
    const withBlock = asRecord(artifactStep?.with);
    expect(typeof withBlock['retention-days']).toBe('number');
    const path = String(withBlock.path);
    expect(path).toContain('production-smoke-evidence.json');
    expect(path).toContain('production-smoke-recovery.json');
    // Evidence only: never raw responses, cookies, headers, or secrets.
    expect(path).not.toMatch(/cookie|header|response|secret|manifest/i);
  });
});
