import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  appendTaskExecutionAuditEvent,
  createInitialTaskState,
  createTaskExecutionInvocationDispatchIntentAuditEvent,
  createTaskExecutionPolicyApprovalRecord,
  deriveTaskExecutionPolicyGateId,
  invokeStartedTaskExecutionAttempt,
  prepareTaskExecutionAttempt,
  reserveTaskExecutionInvocation,
  saveTaskState,
  saveTaskExecutionAttempt,
  saveTaskExecutionPolicyApproval,
  transitionTaskExecutionAttempt,
  updateTaskExecutionInvocation,
} from "../../../packages/core/dist/index.js";

const cliPath = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const projectRoot = fileURLToPath(new URL("../../..", import.meta.url));
const commandsSourcePath = fileURLToPath(new URL("../src/commands.ts", import.meta.url));

function runCli(args) {
  return runCliFrom(projectRoot, args);
}

function runCliFrom(cwd, args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
  });
}

function fail(message, result) {
  console.error(`Smoke failed: ${message}`);

  if (result) {
    console.error(`exit: ${result.status}`);
    console.error(`stdout: ${result.stdout.trim()}`);
    console.error(`stderr: ${result.stderr.trim()}`);
  }

  process.exit(1);
}

function outputOf(result) {
  return `${result.stdout}${result.stderr}`;
}

function expectExitCode(message, result, expectedStatus) {
  if (result.status !== expectedStatus) {
    fail(message, result);
  }
}

function expectNonzero(message, result) {
  if (result.status === 0) {
    fail(message, result);
  }
}

function expectOutputIncludes(message, result, expectedText) {
  if (!outputOf(result).includes(expectedText)) {
    fail(message, result);
  }
}

function expectOutputExcludes(message, result, unexpectedText) {
  if (outputOf(result).includes(unexpectedText)) {
    fail(message, result);
  }
}

function expectBooleanProperty(message, value, propertyName) {
  if (typeof value[propertyName] !== "boolean") {
    fail(message);
  }
}

function parseJsonStdout(message, result) {
  if (result.stderr.trim().length > 0) {
    fail(`${message}: stderr was not empty`, result);
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    fail(message, result);
  }
}

function parseJsonOnlyStdout(message, result) {
  const trimmedStdout = result.stdout.trim();

  if (trimmedStdout.length === 0 || trimmedStdout.split("\n").length !== 1) {
    fail(`${message}: stdout was not exactly one JSON line`, result);
  }

  return parseJsonStdout(message, result);
}

function expectEmptyArray(message, value) {
  if (!Array.isArray(value) || value.length !== 0) {
    fail(message);
  }
}

function expectIssueCode(message, issues, code, result) {
  if (
    !Array.isArray(issues) ||
    !issues.some((issue) => issue.code === code)
  ) {
    fail(message, result);
  }
}

function expectInitJsonShape(message, value) {
  if (
    typeof value !== "object" ||
    value === null ||
    typeof value.ok !== "boolean" ||
    !["dry_run", "write"].includes(value.mode) ||
    typeof value.writeEnabled !== "boolean" ||
    !["success", "blocked", "failure"].includes(value.status) ||
    typeof value.targetRoot !== "string" ||
    value.targetRoot.length === 0 ||
    !Array.isArray(value.generatedFiles) ||
    !Array.isArray(value.conflicts) ||
    !Array.isArray(value.errors)
  ) {
    fail(message);
  }

  if (value.ok) {
    if (
      value.status !== "success" ||
      !Array.isArray(value.stages) ||
      !Array.isArray(value.artifacts)
    ) {
      fail(message);
    }
    return;
  }

  if (!["blocked", "failure"].includes(value.status)) {
    fail(message);
  }
}

function expectInitWriteJsonShape(message, value) {
  expectInitJsonShape(message, value);

  if (value.mode !== "write" || value.writeEnabled !== true) {
    fail(message);
  }
}

function listMemoryFiles() {
  const memoryRoot = join(projectRoot, ".aeos", "memory");

  if (!existsSync(memoryRoot)) {
    return [];
  }

  const files = [];
  const pending = [memoryRoot];

  while (pending.length > 0) {
    const currentPath = pending.pop();

    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        pending.push(entryPath);
      } else if (entry.isFile()) {
        files.push(entryPath);
      }
    }
  }

  return files.sort();
}

function listRelativeFiles(rootPath) {
  if (!existsSync(rootPath)) {
    return [];
  }

  const files = [];
  const pending = [rootPath];

  while (pending.length > 0) {
    const currentPath = pending.pop();

    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        pending.push(entryPath);
      } else if (entry.isFile()) {
        files.push(entryPath.slice(rootPath.length + 1));
      }
    }
  }

  return files.sort();
}

function expectSameFiles(message, before, after) {
  if (
    before.length !== after.length ||
    after.some((path, index) => path !== before[index])
  ) {
    fail(message);
  }
}

function extractRememberPath(result) {
  const pathLine = result.stdout
    .split("\n")
    .find((line) => line.startsWith("Path: "));

  if (pathLine === undefined) {
    fail('remember output did not include "Path: "', result);
  }

  return pathLine.slice("Path: ".length);
}

function rememberPathToAbsolute(memoryPath) {
  const absolutePath = resolve(projectRoot, memoryPath);
  const memoryRoot = resolve(projectRoot, ".aeos", "memory");

  if (!absolutePath.startsWith(`${memoryRoot}/`)) {
    fail(`remember path was outside .aeos/memory: ${memoryPath}`);
  }

  return absolutePath;
}

function expectProjectValidationCheckShape(message, check) {
  if (
    typeof check.name !== "string" ||
    check.name.length === 0 ||
    !["pass", "warn", "fail"].includes(check.status) ||
    typeof check.message !== "string" ||
    check.message.length === 0
  ) {
    fail(message);
  }
}

function expectProjectProfileJsonShape(message, value) {
  const expectedKeys = [
    "issues",
    "ok",
    "profile",
    "projectRoot",
    "scannedEntries",
    "summary",
  ];

  if (
    typeof value !== "object" ||
    value === null
  ) {
    fail(message);
  }

  const keys = Object.keys(value).sort();

  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index]) ||
    value.ok !== true ||
    typeof value.projectRoot !== "string" ||
    value.projectRoot.length === 0 ||
    typeof value.profile !== "object" ||
    value.profile === null ||
    !Array.isArray(value.scannedEntries) ||
    !Array.isArray(value.issues) ||
    typeof value.summary !== "object" ||
    value.summary === null
  ) {
    fail(message);
  }

  if (
    !Array.isArray(value.profile.languages) ||
    !Array.isArray(value.profile.frameworks) ||
    !Array.isArray(value.profile.packageManagers) ||
    !Array.isArray(value.profile.runtimes) ||
    !Array.isArray(value.profile.infrastructure) ||
    typeof value.profile.monorepo !== "object" ||
    value.profile.monorepo === null ||
    !Array.isArray(value.profile.evidence) ||
    !Array.isArray(value.profile.issues) ||
    typeof value.profile.summary !== "object" ||
    value.profile.summary === null ||
    typeof value.summary.scannedEntryCount !== "number" ||
    typeof value.summary.evidenceCount !== "number" ||
    typeof value.summary.issueCount !== "number" ||
    typeof value.summary.truncated !== "boolean" ||
    typeof value.summary.timedOut !== "boolean"
  ) {
    fail(message);
  }
}

function expectProjectProfileHumanShape(message, result) {
  for (const expectedText of [
    "Project Profile",
    "Root:",
    "Languages:",
    "Frameworks:",
    "Package managers:",
    "Runtimes:",
    "Infrastructure:",
    "Monorepo:",
    "Evidence count:",
    "Issue count:",
  ]) {
    expectOutputIncludes(
      `${message} did not include ${expectedText}`,
      result,
      expectedText,
    );
  }
}

function expectTemplateRecommendJsonShape(message, value) {
  const expectedKeys = [
    "candidates",
    "fallbackUsed",
    "issues",
    "mode",
    "ok",
    "projectRoot",
    "recommendation",
    "summary",
  ];

  if (
    typeof value !== "object" ||
    value === null
  ) {
    fail(message);
  }

  const keys = Object.keys(value).sort();

  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index]) ||
    value.ok !== true ||
    typeof value.projectRoot !== "string" ||
    value.projectRoot.length === 0 ||
    value.mode !== "recommend" ||
    typeof value.recommendation !== "object" ||
    value.recommendation === null ||
    !Array.isArray(value.candidates) ||
    typeof value.fallbackUsed !== "boolean" ||
    !Array.isArray(value.issues) ||
    typeof value.summary !== "object" ||
    value.summary === null ||
    typeof value.summary.candidateCount !== "number" ||
    typeof value.summary.evidenceCount !== "number" ||
    typeof value.summary.issueCount !== "number" ||
    typeof value.summary.fallbackUsed !== "boolean" ||
    typeof value.summary.confidence !== "string"
  ) {
    fail(message);
  }

  const expectedSummaryKeys = [
    "candidateCount",
    "confidence",
    "evidenceCount",
    "fallback",
    "fallbackUsed",
    "issueCount",
    "selectedTemplateId",
  ];
  const summaryKeys = Object.keys(value.summary).sort();

  if (
    summaryKeys.length !== expectedSummaryKeys.length ||
    summaryKeys.some((key, index) => key !== expectedSummaryKeys[index])
  ) {
    fail(message);
  }
}

function expectTemplateRecommendFailureJsonShape(message, value) {
  const expectedKeys = [
    "candidates",
    "fallbackUsed",
    "issues",
    "mode",
    "ok",
    "projectRoot",
    "reason",
    "recommendation",
    "summary",
  ];

  if (
    typeof value !== "object" ||
    value === null
  ) {
    fail(message);
  }

  const keys = Object.keys(value).sort();

  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index]) ||
    value.ok !== false ||
    typeof value.projectRoot !== "string" ||
    value.projectRoot.length === 0 ||
    value.mode !== "recommend" ||
    value.recommendation !== null ||
    !Array.isArray(value.candidates) ||
    value.candidates.length !== 0 ||
    value.fallbackUsed !== true ||
    !Array.isArray(value.issues) ||
    value.issues.length !== 0 ||
    value.summary !== null ||
    value.reason !== "template_recommend_failed"
  ) {
    fail(message);
  }
}

function expectKnownTemplateRecommendCandidateIds(message, value, result) {
  const knownCandidateIds = new Set([
    "aeos-generic-minimal",
    "aeos-nextjs-typescript",
    "aeos-wordpress-php",
    "aeos-php-composer",
  ]);

  if (
    !Array.isArray(value.candidates) ||
    value.candidates.length !== knownCandidateIds.size
  ) {
    fail(message, result);
  }

  for (const candidate of value.candidates) {
    if (
      typeof candidate.templateId !== "string" ||
      !knownCandidateIds.has(candidate.templateId)
    ) {
      fail(message, result);
    }
  }
}

function expectTemplateRecommendNoWrites(message, rootPath, before, result) {
  expectSameFiles(message, before, listRelativeFiles(rootPath));

  if (existsSync(join(rootPath, "AGENTS.md"))) {
    fail(`${message}: created AGENTS.md`, result);
  }
}

function selectedTemplateId(value) {
  return value.recommendation.selectedCandidate?.templateId ??
    value.summary.selectedTemplateId;
}

function expectTemplateRecommendNoOverpromises(message, result) {
  for (const unexpectedText of [
    "init integration",
    "write files",
    "remote templates",
    "marketplace",
    "AI selection",
    "AI guessing",
    "dependency parsing",
    "package content parsing",
    "production template catalog",
  ]) {
    expectOutputExcludes(
      `${message} overpromised unsupported behavior: ${unexpectedText}`,
      result,
      unexpectedText,
    );
  }
}

function expectProjectProfileNoOverpromises(message, result) {
  for (const unexpectedText of [
    "package content parsing",
    "dependency parsing exists",
    "AI guessing",
    "--root",
    "--target-root",
  ]) {
    expectOutputExcludes(
      `${message} overpromised unsupported behavior: ${unexpectedText}`,
      result,
      unexpectedText,
    );
  }
}

function expectTaskPlanSkeletonJsonShape(message, value, result) {
  const expectedKeys = [
    "adapterCalls",
    "auditWrites",
    "executionEnabled",
    "issues",
    "mode",
    "ok",
    "persistence",
    "status",
    "verifierRun",
  ];

  if (
    typeof value !== "object" ||
    value === null
  ) {
    fail(message, result);
  }

  const keys = Object.keys(value).sort();

  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index]) ||
    value.ok !== false ||
    value.status !== "skeleton" ||
    value.mode !== "plan" ||
    value.executionEnabled !== false ||
    value.adapterCalls !== false ||
    value.auditWrites !== false ||
    value.verifierRun !== false ||
    value.persistence !== false ||
    !Array.isArray(value.issues) ||
    value.issues.length !== 0
  ) {
    fail(message, result);
  }
}

function expectTaskPlanErrorJsonShape(message, value, result) {
  const expectedKeys = ["error", "issues", "ok"];

  if (
    typeof value !== "object" ||
    value === null
  ) {
    fail(message, result);
  }

  const keys = Object.keys(value).sort();

  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index]) ||
    value.ok !== false ||
    typeof value.error !== "object" ||
    value.error === null ||
    value.error.code !== "task_plan_unknown_option" ||
    typeof value.error.message !== "string" ||
    value.error.message.length === 0 ||
    !Array.isArray(value.issues) ||
    value.issues.length !== 0
  ) {
    fail(message, result);
  }
}

function expectTaskPlanParsedJsonShape(message, value, result) {
  expectTaskPlanInputErrorJsonShape(message, value, result);

  if (
    value.parse.ok !== true ||
    value.parse.validationStatus !== "pass" ||
    value.mapping.attempted !== true
  ) {
    fail(message, result);
  }
}

function expectTaskPlanInputErrorJsonShape(message, value, result) {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    fail(message, result);
  }

  if (
    typeof value.ok !== "boolean" ||
    typeof value.status !== "string" ||
    typeof value.exitCode !== "string" ||
    value.mode !== "plan" ||
    typeof value.parse !== "object" ||
    value.parse === null ||
    typeof value.mapping !== "object" ||
    value.mapping === null ||
    typeof value.wiring !== "object" ||
    value.wiring === null ||
    typeof value.plan !== "object" ||
    value.plan === null ||
    typeof value.safety !== "object" ||
    value.safety === null ||
    !Array.isArray(value.issues) ||
    typeof value.summary !== "object" ||
    value.summary === null ||
    value.safety.executionEnabled !== false ||
    value.safety.adapterCalls !== false ||
    value.safety.auditWrites !== false ||
    value.safety.verifierRun !== false ||
    value.safety.persistence !== false ||
    value.safety.filesystemMutation !== false ||
    value.safety.completedStateCreated !== false ||
    value.safety.dependencyInjectedPlannerOnly !== true ||
    value.safety.topLevelPlannerInputBypassAllowed !== false ||
    value.summary.noExecution !== true ||
    value.summary.noWrites !== true ||
    value.summary.executionEnabled !== false ||
    value.summary.adapterCalls !== false ||
    value.summary.auditWrites !== false ||
    value.summary.verifierRun !== false ||
    value.summary.persistence !== false ||
    value.summary.filesystemMutation !== false ||
    value.summary.completedStateCreated !== false
  ) {
    fail(message, result);
  }
}

function expectTaskPlanHelpNoOverpromises(message, result) {
  for (const unexpectedText of [
    "real planning",
    "real execution",
    "task file parsing",
    "runner execution",
    "autonomous agent run",
    "adapter calls",
    "audit runtime",
    "verifier execution",
    "task persistence",
    "persistence",
    "production orchestration",
  ]) {
    expectOutputExcludes(
      `${message} overpromised unsupported task plan behavior: ${unexpectedText}`,
      result,
      unexpectedText,
    );
  }
}

function expectTaskPlanNoWrites(message, rootPath, before, result) {
  expectSameFiles(message, before, listRelativeFiles(rootPath));

  for (const unexpectedPath of [
    "AGENTS.md",
    "task-output.json",
    "task-plan.json",
    "task-state.json",
    "task-plan-state.json",
    ".aeos/task-output.json",
    ".aeos/task-plan.json",
    ".aeos/task-state.json",
    ".aeos/tasks",
    ".aeos/state",
    ".aeos/state/tasks",
    ".aeos/audit",
  ]) {
    if (existsSync(join(rootPath, unexpectedPath))) {
      fail(`${message}: created ${unexpectedPath}`, result);
    }
  }
}

function taskStateSnapshot(rootPath) {
  const stateRoot = join(rootPath, ".aeos", "state", "tasks");

  return {
    exists: existsSync(stateRoot),
    files: listRelativeFiles(stateRoot),
  };
}

function expectTaskStateSnapshotSame(message, rootPath, before, result) {
  const after = taskStateSnapshot(rootPath);

  if (before.exists !== after.exists) {
    fail(`${message}: task state root existence changed`, result);
  }

  expectSameFiles(`${message}: task state files changed`, before.files, after.files);
}

function executionSnapshot(rootPath) {
  const executionRoot = join(rootPath, ".aeos", "state", "executions");

  return {
    exists: existsSync(executionRoot),
    files: listRelativeFiles(executionRoot),
  };
}

function expectExecutionSnapshotSame(message, rootPath, before, result) {
  const after = executionSnapshot(rootPath);

  if (before.exists !== after.exists) {
    fail(`${message}: execution root existence changed`, result);
  }

  expectSameFiles(
    `${message}: execution files changed`,
    before.files,
    after.files,
  );
}

function expectTaskPlanParserOnlySafety(message, outputText, result) {
  for (const expectedText of [
    "executionEnabled\":false",
    "adapterCalls\":false",
    "auditWrites\":false",
    "verifierRun\":false",
    "persistence\":false",
    "filesystemMutation\":false",
    "completedStateCreated\":false",
    "dependencyInjectedPlannerOnly\":true",
    "topLevelPlannerInputBypassAllowed\":false",
  ]) {
    if (!outputText.includes(expectedText)) {
      fail(`${message}: missing task-plan safety marker ${expectedText}`, result);
    }
  }

  for (const unexpectedText of [
    "runAgenticRunner",
    "runner execution invoked",
    "adapter call executed",
    "audit event written",
    "verifier executed",
    "persisted task state",
  ]) {
    if (outputText.includes(unexpectedText)) {
      fail(`${message}: implied runtime side effect ${unexpectedText}`, result);
    }
  }
}

function expectTaskDryRunJsonShape(message, value, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    typeof value.ok !== "boolean" ||
    typeof value.status !== "string" ||
    value.mode !== "dry_run" ||
    typeof value.parse !== "object" ||
    value.parse === null ||
    typeof value.mapping !== "object" ||
    value.mapping === null ||
    typeof value.plan !== "object" ||
    value.plan === null ||
    typeof value.safety !== "object" ||
    value.safety === null ||
    !Array.isArray(value.issues) ||
    typeof value.summary !== "object" ||
    value.summary === null ||
    value.safety.executionEnabled !== false ||
    value.safety.adapterCalls !== false ||
    value.safety.auditWrites !== false ||
    value.safety.verifierRun !== false ||
    value.safety.persistence !== false ||
    value.safety.filesystemMutation !== false ||
    value.safety.completedStateCreated !== false ||
    value.summary.noExecution !== true ||
    value.summary.noWrites !== true ||
    value.summary.executionEnabled !== false ||
    value.summary.adapterCalls !== false ||
    value.summary.auditWrites !== false ||
    value.summary.verifierRun !== false ||
    value.summary.persistence !== false ||
    value.summary.filesystemMutation !== false ||
    value.summary.completedStateCreated !== false
  ) {
    fail(message, result);
  }
}

function expectTaskDryRunSuccessJsonShape(message, value, result) {
  expectTaskDryRunJsonShape(message, value, result);

  if (
    value.ok !== true ||
    value.status !== "dry_run_ready" ||
    value.parse.ok !== true ||
    value.mapping.ok !== true ||
    value.mapping.status !== "mapped" ||
    value.mapping.runnerPlanningInputAvailable !== true ||
    value.mapping.noExecution !== true ||
    value.mapping.noWrites !== true ||
    value.mapping.verifierRequired !== true ||
    value.mapping.completionGatedByVerifier !== true ||
    value.plan.ok !== true ||
    value.plan.status !== "planned" ||
    typeof value.dryRun !== "object" ||
    value.dryRun === null ||
    value.dryRun.ok !== true ||
    value.dryRun.state === "completed" ||
    !Array.isArray(value.dryRun.steps) ||
    !Array.isArray(value.dryRun.batches) ||
    !Array.isArray(value.dryRun.workItems) ||
    !Array.isArray(value.dryRun.adapterCalls) ||
    value.dryRun.summary.wouldCallAdapters !== 0 ||
    value.dryRun.summary.wouldWriteAudit !== false ||
    value.dryRun.summary.wouldRunVerifier !== false ||
    value.dryRun.verifier.verifierRequired !== true ||
    value.dryRun.verifier.wouldRunVerifier !== false ||
    value.dryRun.verifier.completionGatedByVerifier !== true ||
    value.dryRun.verifier.completionGateSatisfied !== false ||
    value.summary.dryRunPreviewed !== true ||
    value.summary.planned !== true ||
    value.summary.verifierRequired !== true ||
    value.summary.completionGatedByVerifier !== true ||
    value.issues.length !== 0
  ) {
    fail(message, result);
  }

  for (const adapterCall of value.dryRun.adapterCalls) {
    if (
      adapterCall.wouldCall !== false ||
      adapterCall.observationOnly !== true ||
      adapterCall.completionAuthority !== false
    ) {
      fail(`${message}: adapter preview was authoritative or executable`, result);
    }
  }
}

function expectTaskDryRunNoRuntimeClaims(message, result) {
  for (const unexpectedText of [
    "adapter call executed",
    "audit event written",
    "verifier executed",
    "persisted task state",
    "completed: true",
    "\"executionEnabled\":true",
    "\"adapterCalls\":true",
    "\"auditWrites\":true",
    "\"verifierRun\":true",
    "\"persistence\":true",
    "\"filesystemMutation\":true",
    "\"completedStateCreated\":true",
    "\"wouldCall\":true",
    "\"wouldWriteAudit\":true",
    "\"wouldRunVerifier\":true",
    "\"completionGateSatisfied\":true",
  ]) {
    expectOutputExcludes(
      `${message}: dry-run output claimed runtime side effect ${unexpectedText}`,
      result,
      unexpectedText,
    );
  }
}

function expectTaskPlanSourceSafety() {
  const commandsSource = readFileSync(commandsSourcePath, "utf8");

  if (/planAgenticRunner\s*\(/.test(commandsSource)) {
    fail("task plan source called planAgenticRunner directly");
  }

  if (!commandsSource.includes("planner: planAgenticRunner")) {
    fail("task plan source did not inject planAgenticRunner as a planner dependency");
  }

  const canaryPrepareIndex = commandsSource.indexOf(
    "const prepared = prepareTaskExecutionClaudeCodeWorkerInvocation",
  );
  const canaryAuthIndex = commandsSource.indexOf(
    "const hostRuntimeAuth = await runTaskExecutionClaudeCodeAuthPreflight",
  );
  const canaryAuditIndex = commandsSource.indexOf(
    "const auditAppend = await appendTaskExecutionAuditEvent",
    canaryAuthIndex,
  );
  const canaryConsumptionIndex = commandsSource.indexOf(
    "const entered = await updateTaskExecutionInvocation",
    canaryAuthIndex,
  );

  if (
    canaryPrepareIndex < 0 ||
    canaryAuthIndex < 0 ||
    canaryAuditIndex < 0 ||
    canaryConsumptionIndex < 0 ||
    canaryPrepareIndex > canaryAuthIndex ||
    canaryAuthIndex > canaryConsumptionIndex ||
    canaryAuditIndex > canaryConsumptionIndex
  ) {
    fail(
      "task execution claude canary source did not place static prepare, host auth, and audit before one-shot consumption",
    );
  }

  if (
    commandsSource.includes(
      'allowedPathRefs: ["packages/core/src/task-execution-claude-code-worker.ts"]',
    )
  ) {
    fail(
      "task execution claude canary source used a filesystem path as workspace authority",
    );
  }
}

function expectProjectProfileFailureJsonShape(message, value) {
  const expectedKeys = [
    "issues",
    "ok",
    "profile",
    "projectRoot",
    "reason",
    "scannedEntries",
    "summary",
  ];

  if (
    typeof value !== "object" ||
    value === null
  ) {
    fail(message);
  }

  const keys = Object.keys(value).sort();

  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index]) ||
    value.ok !== false ||
    typeof value.projectRoot !== "string" ||
    value.projectRoot.length === 0 ||
    value.profile !== null ||
    !Array.isArray(value.scannedEntries) ||
    value.scannedEntries.length !== 0 ||
    !Array.isArray(value.issues) ||
    value.issues.length !== 0 ||
    value.summary !== null ||
    value.reason !== "project_profile_failed"
  ) {
    fail(message);
  }
}

function expectProfileEvidenceSignal(message, profile, signal, result) {
  if (
    typeof profile !== "object" ||
    profile === null ||
    !Array.isArray(profile.evidence) ||
    !profile.evidence.some((item) => item.signal === signal)
  ) {
    fail(message, result);
  }
}

function expectProfileNoEvidenceSignal(message, profile, signal, result) {
  if (
    typeof profile !== "object" ||
    profile === null ||
    !Array.isArray(profile.evidence) ||
    profile.evidence.some((item) => item.signal === signal)
  ) {
    fail(message, result);
  }
}

function expectProfileSignalValue(message, signals, propertyName, expectedValue, result) {
  if (
    !Array.isArray(signals) ||
    !signals.some((signal) => signal[propertyName] === expectedValue)
  ) {
    fail(message, result);
  }
}

function createNextStyleProject(rootPath) {
  mkdirSync(join(rootPath, "app"), { recursive: true });
  writeFileSync(join(rootPath, "package.json"), '{"name":"smoke-next"}\n');
  writeFileSync(join(rootPath, "tsconfig.json"), "{}\n");
  writeFileSync(join(rootPath, "next.config.js"), "module.exports = {};\n");
  writeFileSync(join(rootPath, "app", "page.tsx"), "export default function Page() { return null; }\n");
  writeFileSync(join(rootPath, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
}

function createWordPressStyleProject(rootPath) {
  mkdirSync(join(rootPath, "wp-content"), { recursive: true });
  writeFileSync(join(rootPath, "composer.json"), '{"name":"smoke/wordpress"}\n');
  writeFileSync(join(rootPath, "composer.lock"), "{}\n");
  writeFileSync(join(rootPath, "wp-config.php"), "<?php\n");
  writeFileSync(join(rootPath, "index.php"), "<?php\n");
}

function createInfrastructureStyleProject(rootPath) {
  mkdirSync(join(rootPath, ".github", "workflows"), { recursive: true });
  writeFileSync(join(rootPath, "Dockerfile"), "FROM node:22-alpine\n");
  writeFileSync(join(rootPath, "docker-compose.yml"), "services: {}\n");
  writeFileSync(join(rootPath, "main.tf"), "terraform {}\n");
  writeFileSync(join(rootPath, ".github", "workflows", "ci.yml"), "name: CI\n");
  writeFileSync(join(rootPath, ".nvmrc"), "22\n");
}

function createValidTaskPlanContract(id) {
  return {
    id,
    title: "Smoke valid task plan input",
    purpose: "Verify task plan CLI integration.",
    status: "draft",
    executionMode: "planning",
    context: {
      load: [
        {
          path: "PROJECT_CONTEXT.md",
          required: true,
          reason: "Smoke task context.",
        },
      ],
      doNotLoad: [],
    },
    fileBoundary: {
      filesToModify: ["apps/cli/src/commands.ts"],
      filesNotToTouch: ["package.json"],
      allowGeneratedFiles: false,
      requireStopOnBoundaryConflict: true,
    },
    allowedOperations: [],
    forbiddenOperations: [],
    steps: [
      {
        order: 1,
        instruction: "Plan only.",
        required: true,
        expectedOutcome: "A deterministic plan result or fail-closed output.",
      },
    ],
    verification: [
      {
        command: "pnpm --filter @aeos/cli smoke",
        level: "smoke_test",
        required: true,
        scope: ["apps/cli"],
        expectedEvidence: ["smoke passes"],
      },
    ],
    stopCondition: {
      description: "Stop after task plan smoke validation.",
      stopAfterCompletion: true,
    },
  };
}

function createPersistedTaskState(id, overrides = {}) {
  const createdAt = "2026-08-08T00:00:00.000Z";

  return {
    ...createInitialTaskState({
      taskId: id,
      sourceTaskId: id,
      sourceTaskPath: `tasks/${id}.json`,
      verifierRequired: true,
      createdAt,
    }),
    lifecycleState: "planned",
    workItems: [
      {
        id: "work-pending",
        state: "pending",
        batchId: "batch-main",
      },
      {
        id: "work-retryable",
        state: "retryable",
        batchId: "batch-main",
      },
    ],
    batches: [
      {
        id: "batch-main",
        workItemIds: ["work-pending", "work-retryable"],
        expectedItemCount: 2,
        completedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        retryableCount: 1,
      },
    ],
    pendingWorkItemIds: ["work-pending"],
    retryableWorkItemIds: ["work-retryable"],
    currentBatchId: "batch-main",
    nextBatchId: "batch-main",
    plan: {
      status: "planned",
      summary: {
        workItemCount: 2,
        batchCount: 1,
        stepCount: 2,
        verifierRequired: true,
        approvalRequired: false,
        issueCount: 0,
      },
    },
    ...overrides,
  };
}

async function savePersistedTaskState(projectRootPath, state) {
  const saveResult = await saveTaskState({
    projectRoot: projectRootPath,
    state,
  });

  if (!saveResult.ok) {
    fail(`could not create persisted task state fixture: ${saveResult.error.code}`);
  }

  return saveResult.value.path;
}

function taskStatePath(rootPath, taskId) {
  return join(rootPath, ".aeos", "state", "tasks", `${taskId}.json`);
}

function trustedProductionProviderProfilesPath(rootPath) {
  return join(rootPath, ".aeos", "system", "production-provider-profiles.json");
}

function createTrustedDispatchProfile({
  providerProfileId = "trusted-cli-fixture",
  kind = "controlled_http_test_fixture",
  adapterId = "trusted-cli-production-adapter",
  policyRequired = true,
  credentialRequired = true,
  auditRequired = true,
  realCallReady = false,
  recoveryEvidenceAuthority = "test_authoritative",
  endpoint,
  timeoutMs = 50,
  outcomeStatus = "returned",
} = {}) {
  return {
    providerProfileId,
    authority: "system",
    kind,
    adapterId,
    providerRef: `${providerProfileId}:provider`,
    providerFamilyRef: "trusted-cli-fixture-family",
    configurationVersion: "trusted-cli-profile-v1",
    implementationVersion: "trusted-cli-profile-v1",
    capabilityVersion: "trusted-cli-profile-v1",
    credentialRequired,
    policyRequired,
    auditRequired,
    realCallReady,
    recoveryEvidenceAuthority,
    ...(endpoint === undefined ? {} : { endpoint, timeoutMs }),
    capabilities: {
      supportsIdempotencyKey: true,
      supportsLookupByIdempotencyKey: true,
      supportsInvocationStatusQuery: true,
      supportsResultReplay: true,
      providesDeterministicProviderInvocationReference: true,
      supportsBoundedErrors: true,
      supportsCancellation: false,
      supportsStreaming: false,
      supportsToolCalls: false,
      supportsNetworkAccess: true,
      supportsExternalSideEffects: true,
      supportsFailureNormalization: true,
    },
    recovery: {
      idempotencyProven: true,
      duplicateSuppressionProven: true,
      providerReferenceProven: true,
      lookupProven: true,
      statusQueryProven: true,
      resultReplayProven: true,
      crashRecoveryProven: true,
      blindRetryPrevented: true,
    },
    credential: {
      credentialRef: "provider.production.primary",
      secretProviderRef: "trusted-cli-env-provider",
      environmentVariableName: "AEOS_CLI_SMOKE_PROVIDER_SECRET",
      credentialKind: "bearer_token",
      credentialScope: ["production_execution"],
      resolutionReference:
        "credential-resolution:trusted-cli-env-provider:provider.production.primary",
    },
    testFixtureOutcome: {
      status: outcomeStatus,
      providerInvocationRef: `provider-ref:${providerProfileId}`,
      output: {
        completed: true,
        verified: true,
        allDone: true,
        safeToRetry: true,
        taskCompleted: true,
        result: "fixture-result",
      },
      code: "trusted_cli_fixture_outcome_unknown",
      diagnostic: "Fixture outcome requires reconciliation.",
    },
  };
}

function writeTrustedDispatchProfiles(rootPath, profiles) {
  const profilePath = trustedProductionProviderProfilesPath(rootPath);
  mkdirSync(join(rootPath, ".aeos", "system"), { recursive: true });
  writeFileSync(
    profilePath,
    `${JSON.stringify({ schemaVersion: 1, profiles }, null, 2)}\n`,
  );
  return profilePath;
}

async function createDispatchCliFixture({
  rootPrefix,
  taskId,
  attemptNumber = 1,
  profile = createTrustedDispatchProfile(),
  writeProfile = true,
  writeApproval = true,
  writeAudit = true,
  stateOverrides = {},
} = {}) {
  const rootPath = mkdtempSync(join(tmpdir(), rootPrefix));
  const state = createPersistedTaskState(taskId, stateOverrides);
  const statePath = await savePersistedTaskState(rootPath, state);
  const prepared = prepareTaskExecutionAttempt({
    state,
    expectedRevision: state.revision,
    batchId: state.currentBatchId,
    attemptNumber,
    createdAt: "2026-08-10T02:00:00.000Z",
  });
  if (!prepared.ok) {
    fail(`could not prepare dispatch CLI fixture: ${prepared.error.code}`);
  }
  const started = transitionTaskExecutionAttempt({
    attempt: prepared.value.attempt,
    intent: {
      kind: "start",
    },
    occurredAt: "2026-08-10T02:00:01.000Z",
  });
  if (!started.ok) {
    fail(`could not start dispatch CLI fixture: ${started.error.code}`);
  }
  const attemptSave = await saveTaskExecutionAttempt({
    projectRoot: rootPath,
    attempt: started.value.attempt,
  });
  if (!attemptSave.ok) {
    fail(`could not save dispatch CLI fixture attempt: ${attemptSave.error.code}`);
  }
  const reservation = await reserveTaskExecutionInvocation({
    projectRoot: rootPath,
    state,
    attempt: started.value.attempt,
    dependencyKind: "test_noop",
    expectedRevision: state.revision,
    latestAttemptNumberForContext: attemptNumber,
    claimedAt: "2026-08-10T02:00:02.000Z",
    ownerId: `owner-${taskId}`,
    ownershipToken: `ownership-token-${taskId}`,
  });
  if (!reservation.ok) {
    fail(`could not reserve dispatch CLI fixture invocation: ${reservation.error.code}`);
  }

  if (writeProfile) {
    writeTrustedDispatchProfiles(rootPath, [profile]);
  }

  const gate = deriveTaskExecutionPolicyGateId({
    taskId,
    taskStateRevision: state.revision,
    attemptId: started.value.attempt.attemptId,
    invocationId: reservation.value.record.invocationId,
  });
  if (!gate.ok) {
    fail(`could not derive dispatch CLI policy gate: ${gate.error.code}`);
  }
  const approvalBinding = {
    policyGateId: gate.value,
    taskId,
    taskStateRevision: state.revision,
    attemptId: started.value.attempt.attemptId,
    invocationId: reservation.value.record.invocationId,
    adapterId: profile.adapterId,
    operation: "execute_task_attempt",
    requiredPermissions: ["network", "external_side_effect"],
  };
  let approval = null;
  if (writeApproval) {
    const approvalRecord = createTaskExecutionPolicyApprovalRecord({
      ...approvalBinding,
      decision: "approved",
      createdAt: "2026-08-10T02:00:03.000Z",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    if (!approvalRecord.ok) {
      fail(`could not create dispatch CLI approval: ${approvalRecord.error.code}`);
    }
    const approvalSave = await saveTaskExecutionPolicyApproval({
      projectRoot: rootPath,
      approval: approvalRecord.value,
    });
    if (!approvalSave.ok) {
      fail(`could not save dispatch CLI approval: ${approvalSave.error.code}`);
    }
    approval = approvalRecord.value;
  }

  if (writeAudit) {
    const auditEvent = createTaskExecutionInvocationDispatchIntentAuditEvent({
      record: reservation.value.record,
      adapterId: profile.adapterId,
      operation: "execute_task_attempt",
      policyGateId: gate.value,
      policyDecisionReference: approval?.approvalId ?? null,
      policyAuthorized: approval !== null,
      auditRequired: profile.auditRequired !== false,
      credentialRef: "provider.production.primary",
      secretProviderRef: "trusted-cli-env-provider",
      credentialResolutionReference:
        "credential-resolution:trusted-cli-env-provider:provider.production.primary",
      occurredAt: "2026-08-10T02:00:04.000Z",
    });
    if (!auditEvent.ok) {
      fail(`could not create dispatch CLI audit: ${auditEvent.error.code}`);
    }
    const auditAppend = await appendTaskExecutionAuditEvent({
      projectRoot: rootPath,
      taskId,
      event: auditEvent.value,
      forbiddenValues: ["cli-smoke-secret"],
    });
    if (!auditAppend.ok) {
      fail(`could not append dispatch CLI audit: ${auditAppend.error.code}`);
    }
  }

  return {
    rootPath,
    taskId,
    statePath,
    revision: state.revision,
    profile,
    attempt: started.value.attempt,
    invocation: reservation.value.record,
    invocationPath: reservation.value.path,
    secretEnv: {
      AEOS_CLI_SMOKE_PROVIDER_SECRET: "cli-smoke-secret",
    },
  };
}

function writePersistedTaskStateFixture(rootPath, taskId, state) {
  const stateRoot = join(rootPath, ".aeos", "state", "tasks");
  mkdirSync(stateRoot, { recursive: true });
  writeFileSync(taskStatePath(rootPath, taskId), `${JSON.stringify(state, null, 2)}\n`);
}

function stateFileSnapshot(path) {
  return {
    content: readFileSync(path, "utf8"),
    mtimeMs: statSync(path).mtimeMs,
    revision: JSON.parse(readFileSync(path, "utf8")).revision,
  };
}

function expectStateFileSnapshotSame(message, path, before, result) {
  const after = stateFileSnapshot(path);

  if (
    after.content !== before.content ||
    after.revision !== before.revision ||
    after.mtimeMs !== before.mtimeMs
  ) {
    fail(message, result);
  }
}

function expectTaskStatusJsonShape(message, value, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== true ||
    value.status !== "loaded" ||
    typeof value.taskId !== "string" ||
    typeof value.revision !== "number" ||
    typeof value.lifecycle !== "string" ||
    typeof value.state !== "object" ||
    value.state === null ||
    typeof value.summary !== "object" ||
    value.summary === null ||
    value.safety?.readOnly !== true ||
    value.safety?.authoritativePersistedState !== true ||
    value.safety?.executionPerformed !== false ||
    value.safety?.stateModified !== false ||
    !Array.isArray(value.issues)
  ) {
    fail(message, result);
  }
}

function expectTaskStateErrorJsonShape(message, value, expectedCode, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== false ||
    typeof value.error !== "object" ||
    value.error === null ||
    value.error.code !== expectedCode ||
    typeof value.error.message !== "string" ||
    value.error.message.length === 0 ||
    !Array.isArray(value.issues) ||
    !value.issues.some((issue) => issue.code === expectedCode)
  ) {
    fail(message, result);
  }
}

function expectTaskResumePreviewJsonShape(message, value, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== true ||
    value.status !== "resume_preview_ready" ||
    typeof value.taskId !== "string" ||
    typeof value.sourceRevision !== "number" ||
    typeof value.lifecycle !== "string" ||
    typeof value.resume !== "object" ||
    value.resume === null ||
    typeof value.resume.allowed !== "boolean" ||
    !Array.isArray(value.resume.pendingWorkItemIds) ||
    !Array.isArray(value.resume.retryableWorkItemIds) ||
    typeof value.resume.remainingWorkCount !== "number" ||
    value.safety?.noExecution !== true ||
    value.safety?.noWrites !== true ||
    value.safety?.stateModified !== false ||
    !Array.isArray(value.issues)
  ) {
    fail(message, result);
  }
}

function expectTaskStateTransitionPreviewJsonShape(message, value, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== true ||
    value.status !== "transition_preview_ready" ||
    typeof value.taskId !== "string" ||
    typeof value.sourceRevision !== "number" ||
    typeof value.expectedRevision !== "number" ||
    typeof value.currentLifecycle !== "string" ||
    typeof value.intent !== "string" ||
    typeof value.transitionAllowed !== "boolean" ||
    typeof value.evidence !== "object" ||
    value.evidence === null ||
    !Array.isArray(value.evidence.required) ||
    !Array.isArray(value.evidence.accepted) ||
    typeof value.evidence.authorizable !== "boolean" ||
    value.safety?.readOnly !== true ||
    value.safety?.writePerformed !== false ||
    value.safety?.revisionChanged !== false ||
    value.safety?.executionPerformed !== false ||
    value.safety?.stateModified !== false ||
    value.safety?.completedStateCreated !== false ||
    value.safety?.verifiedStateCreated !== false ||
    !Array.isArray(value.issues)
  ) {
    fail(message, result);
  }
}

function expectTaskStateTransitionPreviewErrorJsonShape(message, value, expectedCode, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== false ||
    value.transitionAllowed !== false ||
    value.transition !== null ||
    typeof value.error !== "object" ||
    value.error === null ||
    value.error.code !== expectedCode ||
    typeof value.error.message !== "string" ||
    value.error.message.length === 0 ||
    value.safety?.readOnly !== true ||
    value.safety?.writePerformed !== false ||
    value.safety?.revisionChanged !== false ||
    value.safety?.executionPerformed !== false ||
    value.safety?.stateModified !== false ||
    value.safety?.completedStateCreated !== false ||
    value.safety?.verifiedStateCreated !== false ||
    !Array.isArray(value.issues) ||
    !value.issues.some((issue) => issue.code === expectedCode)
  ) {
    fail(message, result);
  }
}

function expectTaskStateTransitionApplyJsonShape(message, value, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== true ||
    value.status !== "task_state_transition_applied" ||
    typeof value.taskId !== "string" ||
    typeof value.intent !== "string" ||
    typeof value.previousRevision !== "number" ||
    typeof value.revision !== "number" ||
    typeof value.previousLifecycle !== "string" ||
    typeof value.lifecycle !== "string" ||
    value.transitionApplied !== true ||
    value.safety?.executionPerformed !== false ||
    value.safety?.adapterCalls !== false ||
    value.safety?.auditWrites !== false ||
    value.safety?.verifierRun !== false ||
    value.safety?.completedStateCreated !== false ||
    value.safety?.verifiedStateCreated !== false ||
    !Array.isArray(value.issues) ||
    value.issues.length !== 0
  ) {
    fail(message, result);
  }
}

function expectTaskStateTransitionApplyErrorJsonShape(message, value, expectedCode, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== false ||
    value.transitionApplied !== false ||
    typeof value.error !== "object" ||
    value.error === null ||
    value.error.code !== expectedCode ||
    typeof value.error.message !== "string" ||
    value.error.message.length === 0 ||
    value.safety?.executionPerformed !== false ||
    value.safety?.adapterCalls !== false ||
    value.safety?.auditWrites !== false ||
    value.safety?.verifierRun !== false ||
    value.safety?.completedStateCreated !== false ||
    value.safety?.verifiedStateCreated !== false ||
    !Array.isArray(value.issues) ||
    !value.issues.some((issue) => issue.code === expectedCode)
  ) {
    fail(message, result);
  }
}

function expectTaskExecutionPreparationPreviewJsonShape(message, value, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== true ||
    value.status !== "execution_preparation_preview_ready" ||
    typeof value.taskId !== "string" ||
    typeof value.sourceRevision !== "number" ||
    typeof value.expectedRevision !== "number" ||
    typeof value.attempt !== "object" ||
    value.attempt === null ||
    typeof value.attempt.attemptId !== "string" ||
    typeof value.attempt.attemptNumber !== "number" ||
    value.attempt.lifecycle !== "prepared" ||
    typeof value.retryable !== "boolean" ||
    typeof value.verifierRequired !== "boolean" ||
    typeof value.policyRequired !== "boolean" ||
    value.preparationAllowed !== true ||
    value.collision !== null ||
    value.safety?.readOnly !== true ||
    value.safety?.attemptPersisted !== false ||
    value.safety?.executionPerformed !== false ||
    value.safety?.adapterCalls !== false ||
    value.safety?.auditWrites !== false ||
    value.safety?.verifierRun !== false ||
    value.safety?.policyRun !== false ||
    value.safety?.taskStateModified !== false ||
    value.safety?.workCompleted !== false ||
    value.safety?.taskCompleted !== false ||
    !Array.isArray(value.issues)
  ) {
    fail(message, result);
  }
}

function expectTaskExecutionPreparationErrorJsonShape(message, value, expectedCode, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== false ||
    value.preparationAllowed !== false ||
    typeof value.error !== "object" ||
    value.error === null ||
    value.error.code !== expectedCode ||
    typeof value.error.message !== "string" ||
    value.error.message.length === 0 ||
    value.safety?.readOnly !== true ||
    value.safety?.attemptPersisted !== false ||
    value.safety?.executionPerformed !== false ||
    value.safety?.adapterCalls !== false ||
    value.safety?.auditWrites !== false ||
    value.safety?.verifierRun !== false ||
    value.safety?.policyRun !== false ||
    value.safety?.taskStateModified !== false ||
    value.safety?.workCompleted !== false ||
    value.safety?.taskCompleted !== false ||
    !Array.isArray(value.issues) ||
    !value.issues.some((issue) => issue.code === expectedCode)
  ) {
    fail(message, result);
  }
}

function expectTaskExecutionPreparationApplyJsonShape(message, value, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== true ||
    value.status !== "execution_preparation_persisted" ||
    typeof value.taskId !== "string" ||
    typeof value.sourceRevision !== "number" ||
    typeof value.attempt !== "object" ||
    value.attempt === null ||
    typeof value.attempt.attemptId !== "string" ||
    typeof value.attempt.attemptNumber !== "number" ||
    value.attempt.lifecycle !== "prepared" ||
    value.safety?.attemptPersisted !== true ||
    value.safety?.executionPerformed !== false ||
    value.safety?.adapterCalls !== false ||
    value.safety?.auditWrites !== false ||
    value.safety?.verifierRun !== false ||
    value.safety?.taskStateModified !== false ||
    value.safety?.workCompleted !== false ||
    value.safety?.taskCompleted !== false ||
    !Array.isArray(value.issues) ||
    value.issues.length !== 0
  ) {
    fail(message, result);
  }
}

function expectTaskExecutionPreparationApplyErrorJsonShape(message, value, expectedCode, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== false ||
    value.preparationAllowed !== false ||
    typeof value.error !== "object" ||
    value.error === null ||
    value.error.code !== expectedCode ||
    typeof value.error.message !== "string" ||
    value.error.message.length === 0 ||
    value.safety?.attemptPersisted !== false ||
    value.safety?.executionPerformed !== false ||
    value.safety?.adapterCalls !== false ||
    value.safety?.auditWrites !== false ||
    value.safety?.verifierRun !== false ||
    value.safety?.taskStateModified !== false ||
    value.safety?.workCompleted !== false ||
    value.safety?.taskCompleted !== false ||
    !Array.isArray(value.issues) ||
    !value.issues.some((issue) => issue.code === expectedCode)
  ) {
    fail(message, result);
  }
}

function expectTaskExecutionStartPreviewJsonShape(message, value, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== true ||
    value.status !== "execution_start_preview_ready" ||
    typeof value.taskId !== "string" ||
    typeof value.attemptId !== "string" ||
    typeof value.startAllowed !== "boolean" ||
    typeof value.authorization !== "object" ||
    value.authorization === null ||
    value.authorization.taskId !== value.taskId ||
    value.authorization.attemptId !== value.attemptId ||
    typeof value.authorization.sourceRevision !== "number" ||
    typeof value.authorization.currentTaskRevision !== "number" ||
    typeof value.authorization.attemptNumber !== "number" ||
    value.authorization.lifecycle !== "prepared" ||
    typeof value.authorization.policyRequired !== "boolean" ||
    typeof value.authorization.policyAuthorized !== "boolean" ||
    typeof value.authorization.verifierRequired !== "boolean" ||
    value.authorization.completionGatedByVerifier !== true ||
    value.safety?.readOnly !== true ||
    value.safety?.attemptStarted !== false ||
    value.safety?.executionPerformed !== false ||
    value.safety?.adapterCalls !== false ||
    value.safety?.auditWrites !== false ||
    value.safety?.verifierRun !== false ||
    value.safety?.taskStateModified !== false ||
    value.safety?.attemptModified !== false ||
    value.safety?.workCompleted !== false ||
    value.safety?.taskCompleted !== false ||
    !Array.isArray(value.issues)
  ) {
    fail(message, result);
  }
}

function expectTaskExecutionStartPreviewErrorJsonShape(message, value, expectedCode, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== false ||
    value.startAllowed !== false ||
    typeof value.error !== "object" ||
    value.error === null ||
    value.error.code !== expectedCode ||
    typeof value.error.message !== "string" ||
    value.error.message.length === 0 ||
    value.safety?.readOnly !== true ||
    value.safety?.attemptStarted !== false ||
    value.safety?.executionPerformed !== false ||
    value.safety?.adapterCalls !== false ||
    value.safety?.auditWrites !== false ||
    value.safety?.verifierRun !== false ||
    value.safety?.taskStateModified !== false ||
    value.safety?.attemptModified !== false ||
    value.safety?.workCompleted !== false ||
    value.safety?.taskCompleted !== false ||
    !Array.isArray(value.issues) ||
    !value.issues.some((issue) => issue.code === expectedCode)
  ) {
    fail(message, result);
  }
}

function expectTaskExecutionStartApplyJsonShape(message, value, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== true ||
    value.status !== "execution_attempt_started" ||
    typeof value.taskId !== "string" ||
    typeof value.attemptId !== "string" ||
    typeof value.sourceRevision !== "number" ||
    typeof value.attemptNumber !== "number" ||
    value.startApplied !== true ||
    typeof value.attempt !== "object" ||
    value.attempt === null ||
    value.attempt.lifecycle !== "started" ||
    !Array.isArray(value.attempt.events) ||
    value.attempt.events.length !== 2 ||
    value.attempt.events[0]?.kind !== "attempt_prepared" ||
    value.attempt.events[1]?.kind !== "attempt_started" ||
    value.safety?.attemptStarted !== true ||
    value.safety?.executionWorkPerformed !== false ||
    value.safety?.adapterCalls !== false ||
    value.safety?.auditWrites !== false ||
    value.safety?.verifierRun !== false ||
    value.safety?.taskStateModified !== false ||
    value.safety?.workCompleted !== false ||
    value.safety?.taskCompleted !== false ||
    typeof value.authorization !== "object" ||
    value.authorization === null ||
    value.authorization.startAllowed !== true ||
    !Array.isArray(value.issues) ||
    value.issues.length !== 0
  ) {
    fail(message, result);
  }
}

function expectTaskExecutionStartApplyErrorJsonShape(message, value, expectedCode, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== false ||
    value.startApplied !== false ||
    typeof value.error !== "object" ||
    value.error === null ||
    value.error.code !== expectedCode ||
    typeof value.error.message !== "string" ||
    value.error.message.length === 0 ||
    value.safety?.attemptStarted !== false ||
    value.safety?.executionWorkPerformed !== false ||
    value.safety?.adapterCalls !== false ||
    value.safety?.auditWrites !== false ||
    value.safety?.verifierRun !== false ||
    value.safety?.taskStateModified !== false ||
    value.safety?.workCompleted !== false ||
    value.safety?.taskCompleted !== false ||
    !Array.isArray(value.issues) ||
    !value.issues.some((issue) => issue.code === expectedCode)
  ) {
    fail(message, result);
  }
}

function expectTaskExecutionInvocationStatusJsonShape(message, value, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== true ||
    value.status !== "invocation_status_loaded" ||
    typeof value.taskId !== "string" ||
    typeof value.invocationId !== "string" ||
    typeof value.invocation !== "object" ||
    value.invocation === null ||
    typeof value.invocation.lifecycle !== "string" ||
    typeof value.invocation.attemptId !== "string" ||
    typeof value.invocation.attemptNumber !== "number" ||
    typeof value.invocation.taskStateRevision !== "number" ||
    typeof value.invocation.outcomeKnown !== "boolean" ||
    typeof value.invocation.reconciliationRequired !== "boolean" ||
    value.invocation.safeToBlindRetry !== false ||
    typeof value.safety !== "object" ||
    value.safety === null ||
    value.safety.readOnly !== true ||
    value.safety.dependencyInvokedByStatus !== false ||
    value.safety.stateModified !== false ||
    value.safety.attemptModified !== false ||
    value.safety.taskModified !== false ||
    value.safety.workCompleted !== false ||
    value.safety.taskCompleted !== false ||
    value.safety.verifierRun !== false ||
    value.safety.auditWritten !== false ||
    value.safety.ownershipSecretRendered !== false ||
    !Array.isArray(value.issues)
  ) {
    fail(message, result);
  }
}

function expectTaskExecutionInvocationStatusErrorJsonShape(
  message,
  value,
  expectedCode,
  result,
) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== false ||
    typeof value.error !== "object" ||
    value.error === null ||
    value.error.code !== expectedCode ||
    typeof value.error.message !== "string" ||
    value.error.message.length === 0 ||
    value.safety?.readOnly !== true ||
    value.safety?.dependencyInvokedByStatus !== false ||
    value.safety?.stateModified !== false ||
    value.safety?.attemptModified !== false ||
    value.safety?.taskModified !== false ||
    value.safety?.workCompleted !== false ||
    value.safety?.taskCompleted !== false ||
    !Array.isArray(value.issues) ||
    !value.issues.some((issue) => issue.code === expectedCode)
  ) {
    fail(message, result);
  }
}

function expectTaskExecutionInvocationReconcilePreviewJsonShape(message, value, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== true ||
    value.status !== "invocation_reconciliation_preview_ready" ||
    typeof value.taskId !== "string" ||
    typeof value.invocationId !== "string" ||
    typeof value.reconciliation !== "object" ||
    value.reconciliation === null ||
    typeof value.reconciliation.status !== "string" ||
    typeof value.reconciliation.action !== "string" ||
    typeof value.reconciliation.reconciliationRequired !== "boolean" ||
    value.reconciliation.safeToBlindRetry !== false ||
    typeof value.reconciliation.retryRequiresNewAuthority !== "boolean" ||
    typeof value.reconciliation.currentAuthorityEligible !== "boolean" ||
    typeof value.reconciliation.outcomeKnown !== "boolean" ||
    typeof value.reconciliation.persistedResultAvailable !== "boolean" ||
    typeof value.providerRequirements !== "object" ||
    value.providerRequirements === null ||
    typeof value.providerRequirements.idempotencyLookupUseful !== "boolean" ||
    typeof value.providerRequirements.statusQueryUseful !== "boolean" ||
    typeof value.providerRequirements.resultReplayUseful !== "boolean" ||
    typeof value.safety !== "object" ||
    value.safety === null ||
    value.safety.readOnly !== true ||
    value.safety.providerCalled !== false ||
    value.safety.retryPerformed !== false ||
    value.safety.invocationModified !== false ||
    value.safety.taskModified !== false ||
    value.safety.attemptModified !== false ||
    value.safety.workCompleted !== false ||
    value.safety.taskCompleted !== false ||
    value.safety.verifierPassed !== false ||
    value.safety.policyApproved !== false ||
    value.safety.ownershipSecretRendered !== false ||
    !Array.isArray(value.issues)
  ) {
    fail(message, result);
  }
}

function expectTaskExecutionInvocationReconcilePreviewErrorJsonShape(
  message,
  value,
  expectedCode,
  result,
) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== false ||
    value.reconciliation !== null ||
    typeof value.error !== "object" ||
    value.error === null ||
    value.error.code !== expectedCode ||
    value.safety?.readOnly !== true ||
    value.safety?.providerCalled !== false ||
    value.safety?.retryPerformed !== false ||
    value.safety?.invocationModified !== false ||
    value.safety?.taskModified !== false ||
    value.safety?.attemptModified !== false ||
    value.safety?.workCompleted !== false ||
    value.safety?.taskCompleted !== false ||
    !Array.isArray(value.issues) ||
    !value.issues.some((issue) => issue.code === expectedCode)
  ) {
    fail(message, result);
  }
}

function expectTaskExecutionPolicyApprovalJsonShape(message, value, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== true ||
    ![
      "policy_approval_persisted",
      "policy_denial_persisted",
      "policy_approval_status_loaded",
    ].includes(value.status) ||
    typeof value.taskId !== "string" ||
    typeof value.invocationId !== "string" ||
    typeof value.expectedRevision !== "number" ||
    typeof value.approval !== "object" ||
    value.approval === null ||
    typeof value.approval.approvalId !== "string" ||
    typeof value.approval.policyGateId !== "string" ||
    typeof value.approval.taskStateRevision !== "number" ||
    !["approved", "denied"].includes(value.approval.decision) ||
    value.approval.authority !== "system" ||
    !Array.isArray(value.approval.requiredPermissions) ||
    typeof value.proofUsableForGate !== "boolean" ||
    typeof value.safety !== "object" ||
    value.safety === null ||
    typeof value.safety.approvalPersisted !== "boolean" ||
    value.safety.adapterInvoked !== false ||
    value.safety.providerCalled !== false ||
    value.safety.credentialResolved !== false ||
    value.safety.taskModified !== false ||
    value.safety.attemptModified !== false ||
    value.safety.invocationModified !== false ||
    value.safety.workCompleted !== false ||
    value.safety.taskCompleted !== false ||
    value.safety.verifierRun !== false ||
    value.safety.productionExecutionEnabled !== false ||
    value.safety.ownershipSecretRendered !== false ||
    !Array.isArray(value.issues)
  ) {
    fail(message, result);
  }
}

function expectTaskExecutionPolicyApprovalErrorJsonShape(
  message,
  value,
  expectedCode,
  result,
) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== false ||
    value.approval !== null ||
    value.proofUsableForGate !== false ||
    typeof value.error !== "object" ||
    value.error === null ||
    value.error.code !== expectedCode ||
    value.safety?.adapterInvoked !== false ||
    value.safety?.providerCalled !== false ||
    value.safety?.credentialResolved !== false ||
    value.safety?.taskModified !== false ||
    value.safety?.attemptModified !== false ||
    value.safety?.invocationModified !== false ||
    value.safety?.workCompleted !== false ||
    value.safety?.taskCompleted !== false ||
    !Array.isArray(value.issues) ||
    !value.issues.some((issue) => issue.code === expectedCode)
  ) {
    fail(message, result);
  }
}

function expectTaskExecutionDispatchErrorJsonShape(
  message,
  value,
  expectedCode,
  result,
) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== false ||
    typeof value.error !== "object" ||
    value.error === null ||
    value.error.code !== expectedCode ||
    value.providerOutcomeKnown !== false ||
    value.productionCompletionReady !== false ||
    value.safety?.providerCalled !== false ||
    value.safety?.oneShotAuthorityConsumed !== false ||
    value.safety?.workCompleted !== false ||
    value.safety?.taskCompleted !== false ||
    value.safety?.verifierRun !== false ||
    value.safety?.rawSecretRendered !== false ||
    value.safety?.ownershipSecretRendered !== false ||
    value.safety?.blindRetry !== false ||
    value.safety?.automatedRealProviderCall !== false ||
    !Array.isArray(value.issues) ||
    !value.issues.some((issue) => issue.code === expectedCode)
  ) {
    fail(message, result);
  }
}

function expectTaskExecutionClaudeCanaryErrorJsonShape(
  message,
  value,
  expectedCode,
  result,
) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== false ||
    typeof value.error !== "object" ||
    value.error === null ||
    value.error.code !== expectedCode ||
    value.processOutcomeKnown !== false ||
    value.productionCompletionReady !== false ||
    value.safety?.realClaudeModelCall !== false ||
    value.safety?.oneShotAuthorityConsumed !== false ||
    value.safety?.repositoryWriteAllowed !== false ||
    value.safety?.repositoryWritten !== false ||
    value.safety?.shellExecuted !== false ||
    value.safety?.arbitraryClaudeArgsAccepted !== false ||
    value.safety?.arbitraryExecutableAccepted !== false ||
    value.safety?.arbitraryCwdAccepted !== false ||
    value.safety?.automatedRealClaudeCall !== false ||
    value.safety?.realCodexModelCall !== false ||
    value.safety?.workCompleted !== false ||
    value.safety?.taskCompleted !== false ||
    value.safety?.verifierRun !== false ||
    !Array.isArray(value.issues) ||
    !value.issues.some((issue) => issue.code === expectedCode)
  ) {
    fail(message, result);
  }
}

function expectTaskExecutionDispatchSuccessJsonShape(message, value, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== true ||
    ![
      "production_dispatch_returned",
      "production_dispatch_failed",
      "production_dispatch_outcome_unknown",
    ].includes(value.status) ||
    typeof value.taskId !== "string" ||
    typeof value.invocationId !== "string" ||
    typeof value.providerProfileId !== "string" ||
    typeof value.providerProfileKind !== "string" ||
    typeof value.realCallReady !== "boolean" ||
    typeof value.providerOutcomeKnown !== "boolean" ||
    typeof value.reconciliationRequired !== "boolean" ||
    typeof value.postDispatchAuditWritten !== "boolean" ||
    value.productionCompletionReady !== false ||
    value.safety?.providerCalled !== true ||
    value.safety?.oneShotAuthorityConsumed !== true ||
    value.safety?.invocationModified !== true ||
    value.safety?.taskModified !== false ||
    value.safety?.attemptModified !== false ||
    value.safety?.workCompleted !== false ||
    value.safety?.taskCompleted !== false ||
    value.safety?.verifierRun !== false ||
    value.safety?.completionAuthority !== false ||
    value.safety?.rawSecretRendered !== false ||
    value.safety?.ownershipSecretRendered !== false ||
    value.safety?.blindRetry !== false ||
    value.safety?.automatedRealProviderCall !== false ||
    !Array.isArray(value.issues)
  ) {
    fail(message, result);
  }
}

function expectTaskStateInitSuccessJsonShape(message, value, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== true ||
    value.status !== "task_state_initialized" ||
    typeof value.taskId !== "string" ||
    typeof value.revision !== "number" ||
    value.lifecycle !== "planned" ||
    typeof value.statePath !== "string" ||
    typeof value.pending !== "number" ||
    typeof value.retryable !== "number" ||
    value.verifierRequired !== true ||
    value.completionGatedByVerifier !== true ||
    value.completionGateSatisfied !== false ||
    value.safety?.taskExecution !== false ||
    value.safety?.adapterCalls !== false ||
    value.safety?.auditWrites !== false ||
    value.safety?.verifierRun !== false ||
    value.safety?.completedStateCreated !== false ||
    !Array.isArray(value.issues) ||
    value.issues.length !== 0
  ) {
    fail(message, result);
  }
}

function expectTaskStateInitFailureJsonShape(message, value, expectedCode, result) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.ok !== false ||
    value.status !== "task_state_initialization_failed" ||
    typeof value.taskId !== "string" ||
    value.statePath !== null ||
    typeof value.error !== "object" ||
    value.error === null ||
    value.error.code !== expectedCode ||
    typeof value.error.message !== "string" ||
    value.error.message.length === 0 ||
    value.safety?.taskExecution !== false ||
    value.safety?.adapterCalls !== false ||
    value.safety?.auditWrites !== false ||
    value.safety?.verifierRun !== false ||
    value.safety?.completedStateCreated !== false ||
    !Array.isArray(value.issues) ||
    !value.issues.some((issue) => issue.code === expectedCode)
  ) {
    fail(message, result);
  }
}

function expectNoTaskStateCreated(message, rootPath, taskId, result) {
  if (existsSync(taskStatePath(rootPath, taskId))) {
    fail(message, result);
  }
}

const smokeRunId = String(Date.now());
const createdMemoryPaths = new Set();

process.once("exit", () => {
  for (const path of createdMemoryPaths) {
    if (existsSync(path)) {
      unlinkSync(path);
    }
  }
});

const version = runCli(["--version"]);
expectExitCode("--version exited nonzero", version, 0);
expectOutputIncludes('--version output did not include "aeos"', version, "aeos");

const versionCommand = runCli(["version"]);
expectExitCode("version exited nonzero", versionCommand, 0);
expectOutputIncludes('version output did not include "aeos"', versionCommand, "aeos");

const help = runCli(["--help"]);
expectExitCode("--help exited nonzero", help, 0);
expectOutputIncludes('--help output did not include "AEOS CLI"', help, "AEOS CLI");

const helpCommand = runCli(["help"]);
expectExitCode("help exited nonzero", helpCommand, 0);
expectOutputIncludes('help output did not include "AEOS CLI"', helpCommand, "AEOS CLI");
expectOutputIncludes('help output did not include "search <query>"', helpCommand, "search <query>");
expectOutputIncludes(
  'help output did not include "search <query> [--json]"',
  helpCommand,
  "search <query> [--json]",
);
expectOutputIncludes(
  'help output did not include "project status --json"',
  helpCommand,
  "project status --json",
);
expectOutputIncludes(
  'help output did not include "project context"',
  helpCommand,
  "project context",
);
expectOutputIncludes(
  'help output did not include "project context --json"',
  helpCommand,
  "project context --json",
);
expectOutputIncludes(
  'help output did not include "project validate"',
  helpCommand,
  "project validate",
);
expectOutputIncludes(
  'help output did not include "project validate --json"',
  helpCommand,
  "project validate --json",
);
expectOutputIncludes(
  'help output did not include "project profile"',
  helpCommand,
  "project profile",
);
expectOutputIncludes(
  'help output did not include "project profile --json"',
  helpCommand,
  "project profile --json",
);
expectOutputIncludes(
  'help output did not include "template recommend"',
  helpCommand,
  "template recommend",
);
expectOutputIncludes(
  'help output did not include "template recommend --json"',
  helpCommand,
  "template recommend --json",
);
expectOutputIncludes(
  'help output did not include "task plan"',
  helpCommand,
  "task plan",
);
expectOutputIncludes(
  'help output did not include "task plan --json"',
  helpCommand,
  "task plan --json",
);
expectOutputIncludes(
  'help output did not include "task plan <task-file>"',
  helpCommand,
  "task plan <task-file>",
);
expectOutputIncludes(
  'help output did not include "task plan <task-file> --json"',
  helpCommand,
  "task plan <task-file> --json",
);
expectOutputIncludes(
  'help output did not include "task run --dry-run <task-file>"',
  helpCommand,
  "task run --dry-run <task-file>",
);
expectOutputIncludes(
  'help output did not include "task run --dry-run <task-file> --json"',
  helpCommand,
  "task run --dry-run <task-file> --json",
);
expectOutputIncludes(
  'help output did not include "task state init <task-file>"',
  helpCommand,
  "task state init <task-file>",
);
expectOutputIncludes(
  'help output did not include "task state init <task-file> --json"',
  helpCommand,
  "task state init <task-file> --json",
);
expectOutputIncludes(
  'help output did not include "task state transition --preview <task-id> --intent <intent> --expected-revision <number>"',
  helpCommand,
  "task state transition --preview <task-id> --intent <intent> --expected-revision <number>",
);
expectOutputIncludes(
  'help output did not include "task state transition --preview <task-id> --intent <intent> --expected-revision <number> --json"',
  helpCommand,
  "task state transition --preview <task-id> --intent <intent> --expected-revision <number> --json",
);
expectOutputIncludes(
  'help output did not include "task state transition <task-id> --intent <intent> --expected-revision <number>"',
  helpCommand,
  "task state transition <task-id> --intent <intent> --expected-revision <number>",
);
expectOutputIncludes(
  'help output did not include "task state transition <task-id> --intent <intent> --expected-revision <number> --json"',
  helpCommand,
  "task state transition <task-id> --intent <intent> --expected-revision <number> --json",
);
expectOutputIncludes(
  'help output did not include "task execution prepare --preview <task-id> --expected-revision <number>"',
  helpCommand,
  "task execution prepare --preview <task-id> --expected-revision <number>",
);
expectOutputIncludes(
  'help output did not include "task execution prepare --preview <task-id> --expected-revision <number> --json"',
  helpCommand,
  "task execution prepare --preview <task-id> --expected-revision <number> --json",
);
expectOutputIncludes(
  'help output did not include "task execution prepare <task-id> --expected-revision <number>"',
  helpCommand,
  "task execution prepare <task-id> --expected-revision <number>",
);
expectOutputIncludes(
  'help output did not include "task execution prepare <task-id> --expected-revision <number> --json"',
  helpCommand,
  "task execution prepare <task-id> --expected-revision <number> --json",
);
expectOutputIncludes(
  'help output did not include "task execution start --preview <task-id> --attempt-id <attempt-id> --expected-revision <number>"',
  helpCommand,
  "task execution start --preview <task-id> --attempt-id <attempt-id> --expected-revision <number>",
);
expectOutputIncludes(
  'help output did not include "task execution start --preview <task-id> --attempt-id <attempt-id> --expected-revision <number> --json"',
  helpCommand,
  "task execution start --preview <task-id> --attempt-id <attempt-id> --expected-revision <number> --json",
);
expectOutputIncludes(
  'help output did not include "task execution invocation reconcile --preview <task-id> --invocation-id <invocation-id>"',
  helpCommand,
  "task execution invocation reconcile --preview <task-id> --invocation-id <invocation-id>",
);
expectOutputIncludes(
  'help output did not include "task execution invocation reconcile --preview <task-id> --invocation-id <invocation-id> --json"',
  helpCommand,
  "task execution invocation reconcile --preview <task-id> --invocation-id <invocation-id> --json",
);
expectOutputIncludes(
  'help output did not include "task execution policy approve <task-id> --invocation-id <invocation-id> --expected-revision <number>"',
  helpCommand,
  "task execution policy approve <task-id> --invocation-id <invocation-id> --expected-revision <number>",
);
expectOutputIncludes(
  'help output did not include "task execution policy deny <task-id> --invocation-id <invocation-id> --expected-revision <number>"',
  helpCommand,
  "task execution policy deny <task-id> --invocation-id <invocation-id> --expected-revision <number>",
);
expectOutputIncludes(
  'help output did not include "task execution policy status <task-id> --invocation-id <invocation-id> --expected-revision <number>"',
  helpCommand,
  "task execution policy status <task-id> --invocation-id <invocation-id> --expected-revision <number>",
);
expectOutputIncludes(
  'help output did not include "task execution dispatch <task-id> --invocation-id <invocation-id> --expected-revision <number>"',
  helpCommand,
  "task execution dispatch <task-id> --invocation-id <invocation-id> --expected-revision <number>",
);
expectOutputIncludes(
  'help output did not include "task status <task-id>"',
  helpCommand,
  "task status <task-id>",
);
expectOutputIncludes(
  'help output did not include "task status <task-id> --json"',
  helpCommand,
  "task status <task-id> --json",
);
expectOutputIncludes(
  'help output did not include "task resume --preview <task-id>"',
  helpCommand,
  "task resume --preview <task-id>",
);
expectOutputIncludes(
  'help output did not include "task resume --preview <task-id> --json"',
  helpCommand,
  "task resume --preview <task-id> --json",
);
expectTaskPlanHelpNoOverpromises("help output", helpCommand);
expectTaskPlanSourceSafety();
for (const unsupportedProjectProfileHelpText of [
  "--root",
  "--target-root",
  "dependency parsing",
  "package content parsing",
  "AI detection",
  "AI guessing",
  "smart inference",
]) {
  expectOutputExcludes(
    `help output overpromised unsupported project profile behavior: ${unsupportedProjectProfileHelpText}`,
    helpCommand,
    unsupportedProjectProfileHelpText,
  );
}
expectOutputIncludes(
  'help output did not include "init"',
  helpCommand,
  "init",
);
expectOutputIncludes(
  'help output did not include "init --json"',
  helpCommand,
  "init --json",
);
expectOutputIncludes(
  'help output did not include "init --write"',
  helpCommand,
  "init --write",
);
expectOutputIncludes(
  'help output did not include "init --write --json"',
  helpCommand,
  "init --write --json",
);
for (const unsupportedInitHelpText of [
  "--force",
  "--target-root",
  "rollback",
  "project intelligence",
]) {
  expectOutputExcludes(
    `help output overpromised unsupported init behavior: ${unsupportedInitHelpText}`,
    helpCommand,
    unsupportedInitHelpText,
  );
}
expectTemplateRecommendNoOverpromises("help output", helpCommand);
for (const unsupportedTemplateRecommendHelpText of [
  "--template-root",
  "--catalog",
  "--remote",
  "--marketplace",
  "init --smart",
  "remote templates",
  "marketplace",
  "production template catalog",
]) {
  expectOutputExcludes(
    `help output overpromised unsupported template recommend behavior: ${unsupportedTemplateRecommendHelpText}`,
    helpCommand,
    unsupportedTemplateRecommendHelpText,
  );
}

const init = runCli(["init"]);
expectExitCode("init exited nonzero", init, 0);
expectOutputIncludes('init output did not include "AEOS Init"', init, "AEOS Init");
expectOutputIncludes('init output did not include dry-run mode', init, "dry_run");
expectOutputIncludes(
  'init output did not include disabled write state',
  init,
  "Write enabled:",
);
expectOutputIncludes(
  'init output did not include "false" write state',
  init,
  "false",
);
expectOutputIncludes('init output did not include target root', init, "Target root:");
expectOutputIncludes('init output did not include "Status:"', init, "Status:");
expectOutputIncludes(
  'init output did not include success status',
  init,
  "success",
);
expectOutputIncludes('init output did not include "Stages:"', init, "Stages:");
for (const stage of [
  "project_detection",
  "template_selection",
  "variable_resolution",
  "rendering",
  "file_writing",
  "validation",
]) {
  expectOutputIncludes(`init output did not include stage ${stage}`, init, `- ${stage}`);
}
expectOutputIncludes('init output did not include "Artifacts:"', init, "Artifacts:");
expectOutputIncludes(
  'init output did not include planned AGENTS.md',
  init,
  "planned AGENTS.md",
);
expectOutputExcludes(
  'init output implied AGENTS.md was written in dry-run mode',
  init,
  "created AGENTS.md",
);

const initJson = runCli(["init", "--json"]);
expectExitCode("init --json exited nonzero", initJson, 0);
const parsedInitJson = parseJsonOnlyStdout(
  "init --json output was not valid JSON",
  initJson,
);
expectInitJsonShape("init --json output shape was invalid", parsedInitJson);
if (
  parsedInitJson.ok !== true ||
  parsedInitJson.mode !== "dry_run" ||
  parsedInitJson.writeEnabled !== false ||
  parsedInitJson.status !== "success" ||
  parsedInitJson.generatedFiles.length !== 1 ||
  parsedInitJson.generatedFiles[0]?.path !== "AGENTS.md" ||
  parsedInitJson.generatedFiles[0]?.status !== "planned"
) {
  fail("init --json output did not match expected dry-run plan", initJson);
}

const initWrite = runCli(["init", "--write"]);
expectNonzero("init --write exited zero despite existing AGENTS.md", initWrite);
expectOutputIncludes(
  'init --write output did not include "write"',
  initWrite,
  "write",
);
expectOutputIncludes(
  'init --write output did not include enabled write state',
  initWrite,
  "Write enabled:",
);
expectOutputIncludes(
  'init --write output did not include "true" write state',
  initWrite,
  "true",
);
expectOutputIncludes(
  'init --write output did not include target root',
  initWrite,
  "Target root:",
);
expectOutputIncludes('init --write output did not include status', initWrite, "Status:");
expectOutputIncludes(
  'init --write output did not include generated files count',
  initWrite,
  "Generated files count:",
);
expectOutputIncludes(
  'init --write output did not include conflicts count',
  initWrite,
  "Conflicts count:",
);
expectOutputIncludes(
  'init --write output did not include errors count',
  initWrite,
  "Errors count:",
);
expectOutputIncludes(
  'init --write output did not report blocked AGENTS.md',
  initWrite,
  "blocked AGENTS.md",
);

const initWriteJson = runCli(["init", "--write", "--json"]);
expectNonzero(
  "init --write --json exited zero despite existing AGENTS.md",
  initWriteJson,
);
const parsedInitWriteJson = parseJsonOnlyStdout(
  "init --write --json output was not valid JSON only",
  initWriteJson,
);
expectInitWriteJsonShape(
  "init --write --json output shape was invalid",
  parsedInitWriteJson,
);
if (
  parsedInitWriteJson.ok !== false ||
  parsedInitWriteJson.status !== "blocked" ||
  !parsedInitWriteJson.generatedFiles.some((file) => file.path === "AGENTS.md") ||
  parsedInitWriteJson.conflicts.length === 0
) {
  fail(
    "init --write --json did not report existing AGENTS.md conflict",
    initWriteJson,
  );
}
expectIssueCode(
  "init --write --json did not report overwrite-disabled conflict",
  parsedInitWriteJson.conflicts,
  "generation_target_exists",
  initWriteJson,
);

const initUnknownJson = runCli(["init", "--unknown", "--json"]);
expectNonzero("init unknown option --json exited zero", initUnknownJson);
const parsedInitUnknownJson = parseJsonStdout(
  "init unknown option --json output was not valid JSON",
  initUnknownJson,
);
if (
  parsedInitUnknownJson.ok !== false ||
  parsedInitUnknownJson.mode !== "dry_run" ||
  parsedInitUnknownJson.writeEnabled !== false ||
  parsedInitUnknownJson.status !== "failure" ||
  !Array.isArray(parsedInitUnknownJson.errors) ||
  parsedInitUnknownJson.errors[0]?.code !== "init_unknown_option"
) {
  fail("init unknown option --json output did not match expected failure", initUnknownJson);
}

const initSafetyRoot = mkdtempSync(join(tmpdir(), "aeos-cli-init-safety-"));
const initSafetyParentRoot = mkdtempSync(
  join(tmpdir(), "aeos-cli-init-safety-parent-"),
);
const initSafetyChildRoot = join(initSafetyParentRoot, "cwd");
const initOutsideRoot = mkdtempSync(join(tmpdir(), "aeos-cli-init-outside-"));

try {
  mkdirSync(initSafetyChildRoot);

  const outsideSentinelPath = join(initOutsideRoot, "sentinel.txt");
  writeFileSync(outsideSentinelPath, "outside sentinel\n");

  const filesBeforeInit = listRelativeFiles(initSafetyRoot);
  const parentFilesBeforeInit = listRelativeFiles(initSafetyParentRoot);
  const isolatedInit = runCliFrom(initSafetyRoot, ["init"]);
  expectExitCode("isolated init exited nonzero", isolatedInit, 0);
  expectOutputIncludes(
    'isolated init output did not include "AEOS Init"',
    isolatedInit,
    "AEOS Init",
  );
  expectSameFiles(
    "isolated init changed files in dry-run mode",
    filesBeforeInit,
    listRelativeFiles(initSafetyRoot),
  );
  expectSameFiles(
    "isolated init changed files in parent directory in dry-run mode",
    parentFilesBeforeInit,
    listRelativeFiles(initSafetyParentRoot),
  );
  if (existsSync(join(initSafetyRoot, "AGENTS.md"))) {
    fail("isolated init created AGENTS.md in dry-run mode", isolatedInit);
  }

  const isolatedInitJson = runCliFrom(initSafetyRoot, ["init", "--json"]);
  expectExitCode("isolated init --json exited nonzero", isolatedInitJson, 0);
  const parsedIsolatedInitJson = parseJsonOnlyStdout(
    "isolated init --json output was not valid JSON",
    isolatedInitJson,
  );
  expectInitJsonShape(
    "isolated init --json output shape was invalid",
    parsedIsolatedInitJson,
  );
  if (
    parsedIsolatedInitJson.mode !== "dry_run" ||
    parsedIsolatedInitJson.writeEnabled !== false ||
    !parsedIsolatedInitJson.generatedFiles.some(
      (file) => file.path === "AGENTS.md" && file.status === "planned",
    )
  ) {
    fail("isolated init --json did not report planned AGENTS.md", isolatedInitJson);
  }
  expectSameFiles(
    "isolated init --json changed files in dry-run mode",
    filesBeforeInit,
    listRelativeFiles(initSafetyRoot),
  );
  if (existsSync(join(initSafetyRoot, "AGENTS.md"))) {
    fail("isolated init --json created AGENTS.md in dry-run mode", isolatedInitJson);
  }

  const isolatedInitWrite = runCliFrom(initSafetyChildRoot, ["init", "--write"]);
  expectExitCode("isolated init --write exited nonzero", isolatedInitWrite, 0);
  expectOutputIncludes(
    'isolated init --write output did not include "Write enabled:"',
    isolatedInitWrite,
    "Write enabled:",
  );
  expectOutputIncludes(
    'isolated init --write output did not include true write state',
    isolatedInitWrite,
    "true",
  );
  expectOutputIncludes(
    "isolated init --write output did not report created AGENTS.md",
    isolatedInitWrite,
    "created AGENTS.md",
  );

  const createdAgentsPath = join(initSafetyChildRoot, "AGENTS.md");
  if (!existsSync(createdAgentsPath)) {
    fail("isolated init --write did not create AGENTS.md", isolatedInitWrite);
  }
  if (!readFileSync(createdAgentsPath, "utf8").includes("AEOS")) {
    fail("isolated init --write AGENTS.md did not include AEOS marker", isolatedInitWrite);
  }

  const isolatedWriteFiles = listRelativeFiles(initSafetyChildRoot);
  if (
    isolatedWriteFiles.length !== 1 ||
    isolatedWriteFiles[0] !== "AGENTS.md"
  ) {
    fail("isolated init --write created unexpected files", isolatedInitWrite);
  }
  for (const path of isolatedWriteFiles) {
    if (path.startsWith("..") || path.length === 0) {
      fail(`isolated init --write reported an unsafe relative path: ${path}`, isolatedInitWrite);
    }
  }
  const isolatedWriteParentFiles = listRelativeFiles(initSafetyParentRoot);
  if (
    isolatedWriteParentFiles.length !== 1 ||
    isolatedWriteParentFiles[0] !== "cwd/AGENTS.md"
  ) {
    fail("isolated init --write created a file outside cwd", isolatedInitWrite);
  }
  if (readFileSync(outsideSentinelPath, "utf8") !== "outside sentinel\n") {
    fail("isolated init --write changed an outside sentinel file", isolatedInitWrite);
  }

  const initWriteJsonParentRoot = mkdtempSync(
    join(tmpdir(), "aeos-cli-init-write-json-parent-"),
  );
  const initWriteJsonRoot = join(initWriteJsonParentRoot, "cwd");
  mkdirSync(initWriteJsonRoot);
  const isolatedInitWriteJson = runCliFrom(initWriteJsonRoot, [
    "init",
    "--write",
    "--json",
  ]);
  expectExitCode("isolated init --write --json exited nonzero", isolatedInitWriteJson, 0);
  const parsedIsolatedInitWriteJson = parseJsonOnlyStdout(
    "isolated init --write --json output was not valid JSON only",
    isolatedInitWriteJson,
  );
  expectInitWriteJsonShape(
    "isolated init --write --json output shape was invalid",
    parsedIsolatedInitWriteJson,
  );
  if (parsedIsolatedInitWriteJson.targetRoot !== realpathSync(initWriteJsonRoot)) {
    fail("isolated init --write --json targetRoot did not match cwd", isolatedInitWriteJson);
  }

  if (
    parsedIsolatedInitWriteJson.ok !== true ||
    parsedIsolatedInitWriteJson.mode !== "write" ||
    parsedIsolatedInitWriteJson.writeEnabled !== true ||
    parsedIsolatedInitWriteJson.generatedFiles.length !== 1 ||
    parsedIsolatedInitWriteJson.generatedFiles[0]?.path !== "AGENTS.md" ||
    parsedIsolatedInitWriteJson.generatedFiles[0]?.status !== "created"
  ) {
    fail(
      "isolated init --write --json did not report created AGENTS.md",
      isolatedInitWriteJson,
    );
  }
  expectEmptyArray(
    "isolated init --write --json conflicts was not empty",
    parsedIsolatedInitWriteJson.conflicts,
  );
  expectEmptyArray(
    "isolated init --write --json errors was not empty",
    parsedIsolatedInitWriteJson.errors,
  );

  const initWriteJsonFiles = listRelativeFiles(initWriteJsonRoot);
  if (
    initWriteJsonFiles.length !== 1 ||
    initWriteJsonFiles[0] !== "AGENTS.md"
  ) {
    fail("isolated init --write --json created unexpected files", isolatedInitWriteJson);
  }
  const initWriteJsonParentFiles = listRelativeFiles(initWriteJsonParentRoot);
  if (
    initWriteJsonParentFiles.length !== 1 ||
    initWriteJsonParentFiles[0] !== "cwd/AGENTS.md"
  ) {
    fail("isolated init --write --json created a file outside cwd", isolatedInitWriteJson);
  }

  const conflictRoot = mkdtempSync(join(tmpdir(), "aeos-cli-init-conflict-"));
  const conflictPath = join(conflictRoot, "AGENTS.md");

  writeFileSync(conflictPath, "existing content\n");
  const conflictResult = runCliFrom(conflictRoot, ["init", "--write"]);
  expectNonzero("isolated init --write conflict exited zero", conflictResult);
  if (readFileSync(conflictPath, "utf8") !== "existing content\n") {
    fail("isolated init --write overwrote an existing file", conflictResult);
  }
  expectOutputIncludes(
    "isolated init --write conflict did not report blocked AGENTS.md",
    conflictResult,
    "blocked AGENTS.md",
  );
  expectOutputIncludes(
    "isolated init --write conflict did not report conflict count",
    conflictResult,
    "Conflicts count:",
  );
  const conflictJsonResult = runCliFrom(conflictRoot, [
    "init",
    "--write",
    "--json",
  ]);
  expectNonzero("isolated init --write --json conflict exited zero", conflictJsonResult);
  const parsedConflictJson = parseJsonOnlyStdout(
    "isolated init --write --json conflict output was not valid JSON only",
    conflictJsonResult,
  );
  expectInitWriteJsonShape(
    "isolated init --write --json conflict output shape was invalid",
    parsedConflictJson,
  );
  if (
    parsedConflictJson.ok !== false ||
    parsedConflictJson.status !== "blocked" ||
    parsedConflictJson.generatedFiles.length !== 1 ||
    parsedConflictJson.generatedFiles[0]?.path !== "AGENTS.md" ||
    parsedConflictJson.generatedFiles[0]?.status !== "blocked" ||
    parsedConflictJson.conflicts.length === 0
  ) {
    fail(
      "isolated init --write --json conflict did not report blocked AGENTS.md",
      conflictJsonResult,
    );
  }
  expectIssueCode(
    "isolated init --write --json conflict did not report overwrite-disabled conflict",
    parsedConflictJson.conflicts,
    "generation_target_exists",
    conflictJsonResult,
  );
  if (readFileSync(conflictPath, "utf8") !== "existing content\n") {
    fail("isolated init --write --json overwrote an existing file", conflictJsonResult);
  }
  const conflictFiles = listRelativeFiles(conflictRoot);
  if (conflictFiles.length !== 1 || conflictFiles[0] !== "AGENTS.md") {
    fail("isolated init --write --json conflict created unexpected files", conflictJsonResult);
  }
  rmSync(conflictRoot, { recursive: true, force: true });

  rmSync(initWriteJsonParentRoot, { recursive: true, force: true });
} finally {
  rmSync(initSafetyRoot, { recursive: true, force: true });
  rmSync(initSafetyParentRoot, { recursive: true, force: true });
  rmSync(initOutsideRoot, { recursive: true, force: true });
}

const status = runCli(["status"]);
expectExitCode("status exited nonzero", status, 0);
expectOutputIncludes('status output did not include "AEOS Status"', status, "AEOS Status");
expectOutputIncludes('status output did not include "Project Root"', status, "Project Root");

const projectStatus = runCli(["project", "status"]);
expectExitCode("project status exited nonzero", projectStatus, 0);
expectOutputIncludes(
  'project status output did not include "Project Status"',
  projectStatus,
  "Project Status",
);
expectOutputIncludes(
  'project status output did not include "Root"',
  projectStatus,
  "Root",
);

const projectStatusJson = runCli(["project", "status", "--json"]);
expectExitCode("project status --json exited nonzero", projectStatusJson, 0);
const parsedProjectStatusJson = parseJsonStdout(
  "project status --json output was not valid JSON",
  projectStatusJson,
);
if (
  parsedProjectStatusJson.ok !== true ||
  typeof parsedProjectStatusJson.root !== "string" ||
  parsedProjectStatusJson.root.length === 0 ||
  !existsSync(parsedProjectStatusJson.root) ||
  typeof parsedProjectStatusJson.packageName !== "string"
) {
  fail(
    "project status --json output did not match expected success",
    projectStatusJson,
  );
}
expectBooleanProperty(
  "project status --json projectContextPresent was not boolean",
  parsedProjectStatusJson,
  "projectContextPresent",
);
expectBooleanProperty(
  "project status --json agentsPresent was not boolean",
  parsedProjectStatusJson,
  "agentsPresent",
);
expectBooleanProperty(
  "project status --json workspacePresent was not boolean",
  parsedProjectStatusJson,
  "workspacePresent",
);

const projectContext = runCli(["project", "context"]);
expectExitCode("project context exited nonzero", projectContext, 0);
expectOutputIncludes(
  'project context output did not include "Project Context"',
  projectContext,
  "Project Context",
);
expectOutputIncludes(
  'project context output did not include "Root"',
  projectContext,
  "Root",
);

const projectContextJson = runCli(["project", "context", "--json"]);
expectExitCode("project context --json exited nonzero", projectContextJson, 0);
const parsedProjectContextJson = parseJsonStdout(
  "project context --json output was not valid JSON",
  projectContextJson,
);
if (
  parsedProjectContextJson.ok !== true ||
  typeof parsedProjectContextJson.root !== "string" ||
  parsedProjectContextJson.root.length === 0 ||
  !existsSync(parsedProjectContextJson.root) ||
  typeof parsedProjectContextJson.context !== "string"
) {
  fail(
    "project context --json output did not match expected success",
    projectContextJson,
  );
}
expectBooleanProperty(
  "project context --json contextPresent was not boolean",
  parsedProjectContextJson,
  "contextPresent",
);
expectBooleanProperty(
  "project context --json agentsPresent was not boolean",
  parsedProjectContextJson,
  "agentsPresent",
);

const missingContextProjectRoot = mkdtempSync(
  join(tmpdir(), "aeos-cli-project-context-"),
);

try {
  writeFileSync(
    join(missingContextProjectRoot, "package.json"),
    '{"name":"smoke-missing-context"}\n',
  );

  const missingProjectContext = runCliFrom(missingContextProjectRoot, [
    "project",
    "context",
  ]);
  expectExitCode(
    "project context with missing PROJECT_CONTEXT.md exited nonzero",
    missingProjectContext,
    0,
  );
  expectOutputIncludes(
    'missing project context output did not include "Project Context"',
    missingProjectContext,
    "Project Context",
  );
  expectOutputIncludes(
    'missing project context output did not include "Context:"',
    missingProjectContext,
    "Context:",
  );
  expectOutputIncludes(
    'missing project context output did not include "missing"',
    missingProjectContext,
    "missing",
  );

  const missingProjectContextJson = runCliFrom(missingContextProjectRoot, [
    "project",
    "context",
    "--json",
  ]);
  expectExitCode(
    "project context --json with missing PROJECT_CONTEXT.md exited nonzero",
    missingProjectContextJson,
    0,
  );
  const parsedMissingProjectContextJson = parseJsonStdout(
    "project context --json with missing PROJECT_CONTEXT.md output was not valid JSON",
    missingProjectContextJson,
  );
  if (
    parsedMissingProjectContextJson.ok !== true ||
    parsedMissingProjectContextJson.contextPresent !== false ||
    typeof parsedMissingProjectContextJson.context !== "string" ||
    parsedMissingProjectContextJson.context !== ""
  ) {
    fail(
      "project context --json with missing PROJECT_CONTEXT.md output did not match expected success",
      missingProjectContextJson,
    );
  }
expectBooleanProperty(
  "project context --json with missing PROJECT_CONTEXT.md agentsPresent was not boolean",
  parsedMissingProjectContextJson,
  "agentsPresent",
);
} finally {
  rmSync(missingContextProjectRoot, { recursive: true, force: true });
}

const projectValidate = runCli(["project", "validate"]);
expectExitCode("project validate exited nonzero", projectValidate, 0);
expectOutputIncludes(
  'project validate output did not include "Project Validation"',
  projectValidate,
  "Project Validation",
);
expectOutputIncludes(
  'project validate output did not include project root validation result',
  projectValidate,
  "PASS project_root",
);

const projectValidateJson = runCli(["project", "validate", "--json"]);
expectExitCode("project validate --json exited nonzero", projectValidateJson, 0);
const parsedProjectValidateJson = parseJsonStdout(
  "project validate --json output was not valid JSON",
  projectValidateJson,
);
if (
  typeof parsedProjectValidateJson.ok !== "boolean" ||
  typeof parsedProjectValidateJson.valid !== "boolean" ||
  parsedProjectValidateJson.ok !== true ||
  parsedProjectValidateJson.valid !== true ||
  !Array.isArray(parsedProjectValidateJson.checks)
) {
  fail(
    "project validate --json output did not match expected success",
    projectValidateJson,
  );
}
const requiredProjectValidationChecks = [
  "project_root",
  "package_metadata",
  "project_context",
  "agents_file",
  "workspace_marker",
];
for (const checkName of requiredProjectValidationChecks) {
  const check = parsedProjectValidateJson.checks.find(
    (value) => value.name === checkName,
  );

  if (check === undefined) {
    fail(`project validate --json missing check: ${checkName}`, projectValidateJson);
  }

  expectProjectValidationCheckShape(
    `project validate --json check was malformed: ${checkName}`,
    check,
  );
}
for (const check of parsedProjectValidateJson.checks) {
  expectProjectValidationCheckShape(
    `project validate --json check was malformed: ${check.name}`,
    check,
  );
}

const missingOptionalMetadataRoot = mkdtempSync(
  join(tmpdir(), "aeos-cli-project-validate-"),
);

try {
  writeFileSync(
    join(missingOptionalMetadataRoot, "PROJECT_CONTEXT.md"),
    "# Project Context\n\nProject: Smoke\n",
  );
  writeFileSync(join(missingOptionalMetadataRoot, "AGENTS.md"), "# Agents\n");
  writeFileSync(join(missingOptionalMetadataRoot, "pnpm-workspace.yaml"), "packages: []\n");

  const missingOptionalMetadata = runCliFrom(missingOptionalMetadataRoot, [
    "project",
    "validate",
  ]);
  expectExitCode(
    "project validate with missing optional metadata exited nonzero",
    missingOptionalMetadata,
    0,
  );
  expectOutputIncludes(
    'project validate with missing optional metadata did not include "Project Validation"',
    missingOptionalMetadata,
    "Project Validation",
  );
  expectOutputIncludes(
    'project validate with missing optional metadata did not include package metadata warning',
    missingOptionalMetadata,
    "WARN package_metadata",
  );

  const missingOptionalMetadataJson = runCliFrom(missingOptionalMetadataRoot, [
    "project",
    "validate",
    "--json",
  ]);
  expectExitCode(
    "project validate --json with missing optional metadata exited nonzero",
    missingOptionalMetadataJson,
    0,
  );
  const parsedMissingOptionalMetadataJson = parseJsonStdout(
    "project validate --json with missing optional metadata output was not valid JSON",
    missingOptionalMetadataJson,
  );
  if (
    parsedMissingOptionalMetadataJson.ok !== true ||
    parsedMissingOptionalMetadataJson.valid !== true ||
    !Array.isArray(parsedMissingOptionalMetadataJson.checks)
  ) {
    fail(
      "project validate --json with missing optional metadata output did not match expected warning success",
      missingOptionalMetadataJson,
    );
  }
  const packageMetadataCheck = parsedMissingOptionalMetadataJson.checks.find(
    (check) => check.name === "package_metadata",
  );
  if (
    packageMetadataCheck === undefined ||
    packageMetadataCheck.status !== "warn"
  ) {
    fail(
      "project validate --json with missing optional metadata did not include package metadata warning",
      missingOptionalMetadataJson,
    );
  }
} finally {
  rmSync(missingOptionalMetadataRoot, { recursive: true, force: true });
}

const missingProjectRoot = mkdtempSync(
  join(tmpdir(), "aeos-cli-project-validate-missing-root-"),
);

try {
  const missingProjectRootJson = runCliFrom(missingProjectRoot, [
    "project",
    "validate",
    "--json",
  ]);
  expectNonzero("project validate --json missing root exited zero", missingProjectRootJson);
  const parsedMissingProjectRootJson = parseJsonStdout(
    "project validate --json missing root output was not valid JSON",
    missingProjectRootJson,
  );
  if (
    parsedMissingProjectRootJson.ok !== false ||
    parsedMissingProjectRootJson.valid !== false ||
    parsedMissingProjectRootJson.reason !== "project_root_not_found" ||
    !Array.isArray(parsedMissingProjectRootJson.checks) ||
    parsedMissingProjectRootJson.checks.length !== 0
  ) {
    fail(
      "project validate --json missing root output did not match expected failure",
      missingProjectRootJson,
    );
  }
} finally {
  rmSync(missingProjectRoot, { recursive: true, force: true });
}

const nextProfileRoot = mkdtempSync(join(tmpdir(), "aeos-cli-project-profile-next-"));
const wordpressProfileRoot = mkdtempSync(
  join(tmpdir(), "aeos-cli-project-profile-wordpress-"),
);
const infrastructureProfileRoot = mkdtempSync(
  join(tmpdir(), "aeos-cli-project-profile-infra-"),
);
const emptyProfileRoot = mkdtempSync(join(tmpdir(), "aeos-cli-project-profile-empty-"));

try {
  createNextStyleProject(nextProfileRoot);

  const nextProfileFilesBefore = listRelativeFiles(nextProfileRoot);
  const nextProfile = runCliFrom(nextProfileRoot, ["project", "profile"]);
  expectExitCode("project profile Next-style fixture exited nonzero", nextProfile, 0);
  expectProjectProfileHumanShape(
    "project profile Next-style fixture human output",
    nextProfile,
  );
  for (const expectedText of [
    "typescript",
    "javascript",
    "nextjs",
    "pnpm",
  ]) {
    expectOutputIncludes(
      `project profile Next-style fixture did not include ${expectedText}`,
      nextProfile,
      expectedText,
    );
  }
  expectProjectProfileNoOverpromises(
    "project profile Next-style fixture",
    nextProfile,
  );
  expectOutputExcludes(
    "project profile Next-style fixture printed confidence claims",
    nextProfile,
    "Confidence:",
  );
  expectSameFiles(
    "project profile Next-style fixture created unexpected files",
    nextProfileFilesBefore,
    listRelativeFiles(nextProfileRoot),
  );

  const nextProfileJsonFilesBefore = listRelativeFiles(nextProfileRoot);
  const nextProfileJson = runCliFrom(nextProfileRoot, [
    "project",
    "profile",
    "--json",
  ]);
  expectExitCode(
    "project profile --json Next-style fixture exited nonzero",
    nextProfileJson,
    0,
  );
  const parsedNextProfileJson = parseJsonOnlyStdout(
    "project profile --json Next-style fixture output was not valid JSON only",
    nextProfileJson,
  );
  expectProjectProfileJsonShape(
    "project profile --json Next-style fixture shape was invalid",
    parsedNextProfileJson,
  );
  expectSameFiles(
    "project profile --json Next-style fixture created unexpected files",
    nextProfileJsonFilesBefore,
    listRelativeFiles(nextProfileRoot),
  );
  if (parsedNextProfileJson.projectRoot !== realpathSync(nextProfileRoot)) {
    fail(
      "project profile --json Next-style fixture projectRoot did not match cwd",
      nextProfileJson,
    );
  }
  expectProfileEvidenceSignal(
    "project profile --json Next-style fixture missed TypeScript evidence",
    parsedNextProfileJson.profile,
    "language.typescript.tsconfig",
    nextProfileJson,
  );
  expectProfileEvidenceSignal(
    "project profile --json Next-style fixture missed Next.js evidence",
    parsedNextProfileJson.profile,
    "framework.nextjs.config_js",
    nextProfileJson,
  );
  expectProfileEvidenceSignal(
    "project profile --json Next-style fixture missed pnpm evidence",
    parsedNextProfileJson.profile,
    "package_manager.pnpm.lockfile",
    nextProfileJson,
  );
  expectIssueCode(
    "project profile --json Next-style fixture did not honestly report unsupported dependency signals",
    parsedNextProfileJson.issues,
    "matcher.signal.dependency_name_unsupported",
    nextProfileJson,
  );

  createWordPressStyleProject(wordpressProfileRoot);

  const wordpressProfileFilesBefore = listRelativeFiles(wordpressProfileRoot);
  const wordpressProfile = runCliFrom(wordpressProfileRoot, ["project", "profile"]);
  expectExitCode(
    "project profile WordPress-style fixture exited nonzero",
    wordpressProfile,
    0,
  );
  expectProjectProfileHumanShape(
    "project profile WordPress-style fixture human output",
    wordpressProfile,
  );
  for (const expectedText of ["php", "wordpress", "composer"]) {
    expectOutputIncludes(
      `project profile WordPress-style fixture did not include ${expectedText}`,
      wordpressProfile,
      expectedText,
    );
  }
  expectProjectProfileNoOverpromises(
    "project profile WordPress-style fixture",
    wordpressProfile,
  );
  expectSameFiles(
    "project profile WordPress-style fixture created unexpected files",
    wordpressProfileFilesBefore,
    listRelativeFiles(wordpressProfileRoot),
  );

  const wordpressProfileJsonFilesBefore = listRelativeFiles(wordpressProfileRoot);
  const wordpressProfileJson = runCliFrom(wordpressProfileRoot, [
    "project",
    "profile",
    "--json",
  ]);
  expectExitCode(
    "project profile --json WordPress-style fixture exited nonzero",
    wordpressProfileJson,
    0,
  );
  const parsedWordPressProfileJson = parseJsonOnlyStdout(
    "project profile --json WordPress-style fixture output was not valid JSON only",
    wordpressProfileJson,
  );
  expectProjectProfileJsonShape(
    "project profile --json WordPress-style fixture shape was invalid",
    parsedWordPressProfileJson,
  );
  expectSameFiles(
    "project profile --json WordPress-style fixture created unexpected files",
    wordpressProfileJsonFilesBefore,
    listRelativeFiles(wordpressProfileRoot),
  );
  for (const signal of [
    "language.php.wp_config",
    "language.php.php",
    "framework.wordpress.wp_config",
    "framework.wordpress.wp_content",
    "package_manager.composer.lockfile",
    "runtime.php.php",
  ]) {
    expectProfileEvidenceSignal(
      `project profile --json WordPress-style fixture missed ${signal}`,
      parsedWordPressProfileJson.profile,
      signal,
      wordpressProfileJson,
    );
  }
  expectIssueCode(
    "project profile --json WordPress-style fixture did not honestly report unsupported dependency signals",
    parsedWordPressProfileJson.issues,
    "matcher.signal.dependency_name_unsupported",
    wordpressProfileJson,
  );

  createInfrastructureStyleProject(infrastructureProfileRoot);

  const infrastructureProfileFilesBefore = listRelativeFiles(infrastructureProfileRoot);
  const infrastructureProfile = runCliFrom(infrastructureProfileRoot, [
    "project",
    "profile",
  ]);
  expectExitCode(
    "project profile infrastructure fixture exited nonzero",
    infrastructureProfile,
    0,
  );
  expectProjectProfileHumanShape(
    "project profile infrastructure fixture human output",
    infrastructureProfile,
  );
  for (const expectedText of ["docker", "terraform"]) {
    expectOutputIncludes(
      `project profile infrastructure fixture did not include ${expectedText}`,
      infrastructureProfile,
      expectedText,
    );
  }
  expectProjectProfileNoOverpromises(
    "project profile infrastructure fixture",
    infrastructureProfile,
  );
  expectOutputExcludes(
    "project profile infrastructure fixture reported hidden GitHub Actions",
    infrastructureProfile,
    "github_actions",
  );
  expectSameFiles(
    "project profile infrastructure fixture created unexpected files",
    infrastructureProfileFilesBefore,
    listRelativeFiles(infrastructureProfileRoot),
  );

  const infrastructureProfileJsonFilesBefore = listRelativeFiles(infrastructureProfileRoot);
  const infrastructureProfileJson = runCliFrom(infrastructureProfileRoot, [
    "project",
    "profile",
    "--json",
  ]);
  expectExitCode(
    "project profile --json infrastructure fixture exited nonzero",
    infrastructureProfileJson,
    0,
  );
  const parsedInfrastructureProfileJson = parseJsonOnlyStdout(
    "project profile --json infrastructure fixture output was not valid JSON only",
    infrastructureProfileJson,
  );
  expectProjectProfileJsonShape(
    "project profile --json infrastructure fixture shape was invalid",
    parsedInfrastructureProfileJson,
  );
  expectSameFiles(
    "project profile --json infrastructure fixture created unexpected files",
    infrastructureProfileJsonFilesBefore,
    listRelativeFiles(infrastructureProfileRoot),
  );
  expectProfileSignalValue(
    "project profile --json infrastructure fixture missed docker infrastructure",
    parsedInfrastructureProfileJson.profile.infrastructure,
    "infrastructure",
    "docker",
    infrastructureProfileJson,
  );
  expectProfileSignalValue(
    "project profile --json infrastructure fixture missed terraform infrastructure",
    parsedInfrastructureProfileJson.profile.infrastructure,
    "infrastructure",
    "terraform",
    infrastructureProfileJson,
  );
  expectProfileNoEvidenceSignal(
    "project profile --json infrastructure fixture scanned hidden GitHub Actions despite hidden files being disabled",
    parsedInfrastructureProfileJson.profile,
    "infrastructure.github_actions.workflows",
    infrastructureProfileJson,
  );
  if (
    parsedInfrastructureProfileJson.scannedEntries.some(
      (entry) => entry.path.startsWith(".github/") || entry.path === ".nvmrc",
    )
  ) {
    fail(
      "project profile --json infrastructure fixture included hidden scan entries",
      infrastructureProfileJson,
    );
  }

  const emptyProfileFilesBefore = listRelativeFiles(emptyProfileRoot);
  const emptyProfile = runCliFrom(emptyProfileRoot, ["project", "profile"]);
  expectExitCode("project profile empty fixture exited nonzero", emptyProfile, 0);
  expectProjectProfileHumanShape(
    "project profile empty fixture human output",
    emptyProfile,
  );
  for (const expectedText of [
    "Languages: unknown",
    "Frameworks: unknown",
    "Package managers: unknown",
    "Runtimes: unknown",
    "Infrastructure: unknown",
    "Monorepo: no",
  ]) {
    expectOutputIncludes(
      `project profile empty fixture did not include ${expectedText}`,
      emptyProfile,
      expectedText,
    );
  }
  expectProjectProfileNoOverpromises(
    "project profile empty fixture",
    emptyProfile,
  );
  expectSameFiles(
    "project profile empty fixture created unexpected files",
    emptyProfileFilesBefore,
    listRelativeFiles(emptyProfileRoot),
  );

  const emptyProfileJsonFilesBefore = listRelativeFiles(emptyProfileRoot);
  const emptyProfileJson = runCliFrom(emptyProfileRoot, [
    "project",
    "profile",
    "--json",
  ]);
  expectExitCode(
    "project profile --json empty fixture exited nonzero",
    emptyProfileJson,
    0,
  );
  const parsedEmptyProfileJson = parseJsonOnlyStdout(
    "project profile --json empty fixture output was not valid JSON only",
    emptyProfileJson,
  );
  expectProjectProfileJsonShape(
    "project profile --json empty fixture shape was invalid",
    parsedEmptyProfileJson,
  );
  expectSameFiles(
    "project profile --json empty fixture created unexpected files",
    emptyProfileJsonFilesBefore,
    listRelativeFiles(emptyProfileRoot),
  );
  if (
    parsedEmptyProfileJson.projectRoot !== realpathSync(emptyProfileRoot) ||
    !Array.isArray(parsedEmptyProfileJson.profile.evidence) ||
    parsedEmptyProfileJson.profile.evidence.length !== 0 ||
    parsedEmptyProfileJson.profile.summary.primaryLanguage !== "unknown" ||
    parsedEmptyProfileJson.profile.summary.primaryFramework !== "unknown"
  ) {
    fail(
      "project profile --json empty fixture did not return stable no-signal shape",
      emptyProfileJson,
    );
  }

  const unknownProfileJson = runCliFrom(emptyProfileRoot, [
    "project",
    "profile",
    "--unknown",
    "--json",
  ]);
  expectNonzero("project profile unknown option --json exited zero", unknownProfileJson);
  const parsedUnknownProfileJson = parseJsonOnlyStdout(
    "project profile unknown option --json output was not valid JSON only",
    unknownProfileJson,
  );
  expectProjectProfileFailureJsonShape(
    "project profile unknown option --json failure shape was invalid",
    parsedUnknownProfileJson,
  );

  const templateRecommendRoot = mkdtempSync(
    join(tmpdir(), "aeos-cli-template-recommend-next-"),
  );
  const templateRecommendJsonRoot = mkdtempSync(
    join(tmpdir(), "aeos-cli-template-recommend-next-json-"),
  );
  const templateRecommendWordPressRoot = mkdtempSync(
    join(tmpdir(), "aeos-cli-template-recommend-wordpress-"),
  );
  const templateRecommendEmptyRoot = mkdtempSync(
    join(tmpdir(), "aeos-cli-template-recommend-empty-"),
  );
  const templateRecommendNoWriteRoot = mkdtempSync(
    join(tmpdir(), "aeos-cli-template-recommend-no-write-"),
  );

  try {
    createNextStyleProject(templateRecommendRoot);
    const templateRecommendFilesBefore = listRelativeFiles(templateRecommendRoot);
    const templateRecommend = runCliFrom(templateRecommendRoot, [
      "template",
      "recommend",
    ]);
    expectExitCode(
      "template recommend Next-style fixture exited nonzero",
      templateRecommend,
      0,
    );
    for (const expectedText of [
      "Template Recommendation",
      "Project root:",
      "Selected template:",
      "Confidence:",
      "Fallback used:",
      "Candidate count:",
      "Evidence count:",
      "Issue count:",
    ]) {
      expectOutputIncludes(
        `template recommend Next-style fixture did not include ${expectedText}`,
        templateRecommend,
        expectedText,
      );
    }
    expectOutputIncludes(
      "template recommend Next-style fixture did not include supported Next.js candidate",
      templateRecommend,
      "aeos-nextjs-typescript",
    );
    expectOutputIncludes(
      "template recommend Next-style fixture did not report non-fallback selection",
      templateRecommend,
      "Fallback used: false",
    );
    expectTemplateRecommendNoOverpromises(
      "template recommend Next-style fixture",
      templateRecommend,
    );
    expectTemplateRecommendNoWrites(
      "template recommend Next-style fixture created unexpected files",
      templateRecommendRoot,
      templateRecommendFilesBefore,
      templateRecommend,
    );

    createNextStyleProject(templateRecommendJsonRoot);
    const templateRecommendJsonFilesBefore = listRelativeFiles(
      templateRecommendJsonRoot,
    );
    const templateRecommendJson = runCliFrom(templateRecommendJsonRoot, [
      "template",
      "recommend",
      "--json",
    ]);
    expectExitCode(
      "template recommend --json Next-style fixture exited nonzero",
      templateRecommendJson,
      0,
    );
    const parsedTemplateRecommendJson = parseJsonOnlyStdout(
      "template recommend --json Next-style fixture output was not valid JSON only",
      templateRecommendJson,
    );
    expectTemplateRecommendJsonShape(
      "template recommend --json Next-style fixture shape was invalid",
      parsedTemplateRecommendJson,
    );
    expectKnownTemplateRecommendCandidateIds(
      "template recommend --json Next-style fixture included an invented candidate id",
      parsedTemplateRecommendJson,
      templateRecommendJson,
    );
    if (
      parsedTemplateRecommendJson.projectRoot !==
        realpathSync(templateRecommendJsonRoot) ||
      selectedTemplateId(parsedTemplateRecommendJson) !==
        "aeos-nextjs-typescript"
    ) {
      fail(
        "template recommend --json Next-style fixture did not select expected template",
        templateRecommendJson,
      );
    }
    if (
      parsedTemplateRecommendJson.fallbackUsed !== false ||
      parsedTemplateRecommendJson.summary.fallbackUsed !== false ||
      parsedTemplateRecommendJson.summary.candidateCount !== 4 ||
      parsedTemplateRecommendJson.summary.selectedTemplateId !==
        "aeos-nextjs-typescript"
    ) {
      fail(
        "template recommend --json Next-style fixture summary was not stable",
        templateRecommendJson,
      );
    }
    expectTemplateRecommendNoWrites(
      "template recommend --json Next-style fixture created unexpected files",
      templateRecommendJsonRoot,
      templateRecommendJsonFilesBefore,
      templateRecommendJson,
    );

    createWordPressStyleProject(templateRecommendWordPressRoot);
    const templateRecommendWordPressFilesBefore = listRelativeFiles(
      templateRecommendWordPressRoot,
    );
    const templateRecommendWordPress = runCliFrom(
      templateRecommendWordPressRoot,
      ["template", "recommend", "--json"],
    );
    expectExitCode(
      "template recommend --json WordPress-style fixture exited nonzero",
      templateRecommendWordPress,
      0,
    );
    const parsedTemplateRecommendWordPress = parseJsonOnlyStdout(
      "template recommend --json WordPress-style fixture output was not valid JSON only",
      templateRecommendWordPress,
    );
    expectTemplateRecommendJsonShape(
      "template recommend --json WordPress-style fixture shape was invalid",
      parsedTemplateRecommendWordPress,
    );
    expectKnownTemplateRecommendCandidateIds(
      "template recommend --json WordPress-style fixture included an invented candidate id",
      parsedTemplateRecommendWordPress,
      templateRecommendWordPress,
    );
    if (
      parsedTemplateRecommendWordPress.projectRoot !==
        realpathSync(templateRecommendWordPressRoot) ||
      parsedTemplateRecommendWordPress.fallbackUsed !== false ||
      parsedTemplateRecommendWordPress.summary.fallbackUsed !== false ||
      parsedTemplateRecommendWordPress.summary.candidateCount !== 4 ||
      selectedTemplateId(parsedTemplateRecommendWordPress) !==
      "aeos-wordpress-php"
    ) {
      fail(
        "template recommend --json WordPress-style fixture did not select expected template",
        templateRecommendWordPress,
      );
    }
    expectTemplateRecommendNoWrites(
      "template recommend --json WordPress-style fixture created unexpected files",
      templateRecommendWordPressRoot,
      templateRecommendWordPressFilesBefore,
      templateRecommendWordPress,
    );

    const templateRecommendEmptyHumanFilesBefore = listRelativeFiles(
      templateRecommendEmptyRoot,
    );
    const templateRecommendEmptyHuman = runCliFrom(templateRecommendEmptyRoot, [
      "template",
      "recommend",
    ]);
    expectExitCode(
      "template recommend empty fixture exited nonzero",
      templateRecommendEmptyHuman,
      0,
    );
    for (const expectedText of [
      "Template Recommendation",
      "Project root:",
      "Selected template: fallback minimal_agents",
      "Confidence: unknown",
      "Fallback used: true",
      "Candidate count: 4",
      "Evidence count:",
      "Issue count:",
      "fallback.minimal-agents",
      "no_confident_match",
    ]) {
      expectOutputIncludes(
        `template recommend empty fixture did not include ${expectedText}`,
        templateRecommendEmptyHuman,
        expectedText,
      );
    }
    expectOutputExcludes(
      "template recommend empty fixture claimed high confidence",
      templateRecommendEmptyHuman,
      "Confidence: high",
    );
    expectTemplateRecommendNoOverpromises(
      "template recommend empty fixture",
      templateRecommendEmptyHuman,
    );
    expectTemplateRecommendNoWrites(
      "template recommend empty fixture created unexpected files",
      templateRecommendEmptyRoot,
      templateRecommendEmptyHumanFilesBefore,
      templateRecommendEmptyHuman,
    );

    const templateRecommendEmptyFilesBefore = listRelativeFiles(
      templateRecommendEmptyRoot,
    );
    const templateRecommendEmpty = runCliFrom(templateRecommendEmptyRoot, [
      "template",
      "recommend",
      "--json",
    ]);
    expectExitCode(
      "template recommend --json empty fixture exited nonzero",
      templateRecommendEmpty,
      0,
    );
    const parsedTemplateRecommendEmpty = parseJsonOnlyStdout(
      "template recommend --json empty fixture output was not valid JSON only",
      templateRecommendEmpty,
    );
    expectTemplateRecommendJsonShape(
      "template recommend --json empty fixture shape was invalid",
      parsedTemplateRecommendEmpty,
    );
    expectKnownTemplateRecommendCandidateIds(
      "template recommend --json empty fixture included an invented candidate id",
      parsedTemplateRecommendEmpty,
      templateRecommendEmpty,
    );
    if (
      parsedTemplateRecommendEmpty.fallbackUsed !== true ||
      parsedTemplateRecommendEmpty.summary.fallbackUsed !== true ||
      parsedTemplateRecommendEmpty.summary.selectedTemplateId !== null ||
      parsedTemplateRecommendEmpty.summary.candidateCount !== 4 ||
      parsedTemplateRecommendEmpty.summary.confidence === "high" ||
      selectedTemplateId(parsedTemplateRecommendEmpty) !== null
    ) {
      fail(
        "template recommend --json empty fixture claimed an unstable high-confidence match",
        templateRecommendEmpty,
      );
    }
    if (
      parsedTemplateRecommendEmpty.recommendation.fallbackUsed !== true ||
      parsedTemplateRecommendEmpty.recommendation.fallback !== "minimal_agents" ||
      parsedTemplateRecommendEmpty.recommendation.confidence !== "unknown" ||
      parsedTemplateRecommendEmpty.summary.fallback !== "minimal_agents" ||
      !parsedTemplateRecommendEmpty.recommendation.evidence.ruleIds.includes(
        "fallback.minimal-agents",
      ) ||
      !parsedTemplateRecommendEmpty.recommendation.evidence.reducedByIssueCodes.includes(
        "no_confident_match",
      )
    ) {
      fail(
        "template recommend --json empty fixture fallback fields were inconsistent",
        templateRecommendEmpty,
      );
    }
    expectTemplateRecommendNoWrites(
      "template recommend --json empty fixture created unexpected files",
      templateRecommendEmptyRoot,
      templateRecommendEmptyFilesBefore,
      templateRecommendEmpty,
    );

    const noWriteFilesBefore = listRelativeFiles(templateRecommendNoWriteRoot);
    const templateRecommendNoWrite = runCliFrom(templateRecommendNoWriteRoot, [
      "template",
      "recommend",
    ]);
    expectExitCode(
      "template recommend no-write fixture exited nonzero",
      templateRecommendNoWrite,
      0,
    );
    expectTemplateRecommendNoWrites(
      "template recommend no-write fixture changed files",
      templateRecommendNoWriteRoot,
      noWriteFilesBefore,
      templateRecommendNoWrite,
    );
    if (
      existsSync(join(templateRecommendNoWriteRoot, "AGENTS.md")) ||
      listRelativeFiles(templateRecommendNoWriteRoot).length !== 0
    ) {
      fail(
        "template recommend no-write fixture created AGENTS.md or template output",
        templateRecommendNoWrite,
      );
    }
    const noWriteJsonFilesBefore = listRelativeFiles(templateRecommendNoWriteRoot);
    const templateRecommendNoWriteJson = runCliFrom(templateRecommendNoWriteRoot, [
      "template",
      "recommend",
      "--json",
    ]);
    expectExitCode(
      "template recommend --json no-write fixture exited nonzero",
      templateRecommendNoWriteJson,
      0,
    );
    parseJsonOnlyStdout(
      "template recommend --json no-write fixture output was not valid JSON only",
      templateRecommendNoWriteJson,
    );
    expectTemplateRecommendNoWrites(
      "template recommend --json no-write fixture changed files",
      templateRecommendNoWriteRoot,
      noWriteJsonFilesBefore,
      templateRecommendNoWriteJson,
    );
    if (
      existsSync(join(templateRecommendNoWriteRoot, "AGENTS.md")) ||
      listRelativeFiles(templateRecommendNoWriteRoot).length !== 0
    ) {
      fail(
        "template recommend --json no-write fixture created AGENTS.md or template output",
        templateRecommendNoWriteJson,
      );
    }

    const templateRecommendUnknownJson = runCliFrom(templateRecommendEmptyRoot, [
      "template",
      "recommend",
      "--unknown",
      "--json",
    ]);
    expectNonzero(
      "template recommend unknown option --json exited zero",
      templateRecommendUnknownJson,
    );
    const parsedTemplateRecommendUnknownJson = parseJsonOnlyStdout(
      "template recommend unknown option --json output was not valid JSON only",
      templateRecommendUnknownJson,
    );
    expectTemplateRecommendFailureJsonShape(
      "template recommend unknown option --json failure shape was invalid",
      parsedTemplateRecommendUnknownJson,
    );
  } finally {
    rmSync(templateRecommendRoot, { recursive: true, force: true });
    rmSync(templateRecommendJsonRoot, { recursive: true, force: true });
    rmSync(templateRecommendWordPressRoot, { recursive: true, force: true });
    rmSync(templateRecommendEmptyRoot, { recursive: true, force: true });
    rmSync(templateRecommendNoWriteRoot, { recursive: true, force: true });
  }
} finally {
  rmSync(nextProfileRoot, { recursive: true, force: true });
  rmSync(wordpressProfileRoot, { recursive: true, force: true });
  rmSync(infrastructureProfileRoot, { recursive: true, force: true });
  rmSync(emptyProfileRoot, { recursive: true, force: true });
}

const statusJson = runCli(["status", "--json"]);
expectExitCode("status --json exited nonzero", statusJson, 0);
const parsedStatus = parseJsonStdout(
  "status --json output was not valid JSON",
  statusJson,
);

if (
  typeof parsedStatus.projectRoot !== "string" ||
  parsedStatus.projectRoot.length === 0 ||
  !existsSync(parsedStatus.projectRoot)
) {
  fail("status --json projectRoot did not exist", statusJson);
}

expectBooleanProperty(
  "status --json workspacePresent was not boolean",
  parsedStatus,
  "workspacePresent",
);
expectBooleanProperty(
  "status --json projectContextPresent was not boolean",
  parsedStatus,
  "projectContextPresent",
);
expectBooleanProperty(
  "status --json agentsFilePresent was not boolean",
  parsedStatus,
  "agentsFilePresent",
);
expectBooleanProperty(
  "status --json gitRepositoryPresent was not boolean",
  parsedStatus,
  "gitRepositoryPresent",
);

const context = runCli(["context"]);
expectExitCode("context exited nonzero", context, 0);
expectOutputIncludes('context output did not include "Project:"', context, "Project:");
if (!outputOf(context).includes("AEOS") && !outputOf(context).includes("Pro Performans")) {
  fail('context output did not include "AEOS" or "Pro Performans"', context);
}

const compactContext = runCli(["context", "--compact"]);
expectExitCode("context --compact exited nonzero", compactContext, 0);
if (
  !outputOf(compactContext).includes("Project") &&
  !outputOf(compactContext).includes("Pro Performans")
) {
  fail(
    'context --compact output did not include "Project" or "Pro Performans"',
    compactContext,
  );
}
expectOutputIncludes(
  'context --compact output did not include "Next Task"',
  compactContext,
  "Next Task",
);
if (outputOf(compactContext).length >= outputOf(context).length) {
  fail("context --compact output was not shorter than full context output", compactContext);
}

const contextJson = runCli(["context", "--json"]);
expectExitCode("context --json exited nonzero", contextJson, 0);
const parsedContext = parseJsonStdout(
  "context --json output was not valid JSON",
  contextJson,
);

if (parsedContext.projectContextPresent !== true) {
  fail("context --json projectContextPresent was not true", contextJson);
}

if (
  typeof parsedContext.content !== "string" ||
  !parsedContext.content.includes("Project")
) {
  fail('context --json content did not include "Project"', contextJson);
}

if (
  typeof parsedContext.compact !== "string" ||
  !parsedContext.compact.includes("Next Task")
) {
  fail('context --json compact did not include "Next Task"', contextJson);
}

if (typeof parsedContext.lineCount !== "number" || parsedContext.lineCount <= 0) {
  fail("context --json lineCount was not a positive number", contextJson);
}

const unknown = runCli(["unknown-command"]);
expectNonzero("unknown command exited zero", unknown);

const searchNoMatches = runCli([
  "search",
  `smoke-no-search-match-${smokeRunId}`,
]);
expectExitCode("search no-match command exited nonzero", searchNoMatches, 0);
if (
  searchNoMatches.stdout !==
  `Search Results\nQuery: smoke-no-search-match-${smokeRunId}\nMatches: 0\n`
) {
  fail("search no-match output was not stable", searchNoMatches);
}

const searchJson = runCli(["search", "decision", "--json"]);
expectExitCode("search --json exited nonzero", searchJson, 0);
const parsedSearchJson = parseJsonStdout(
  "search --json output was not valid JSON",
  searchJson,
);
if (
  parsedSearchJson.ok !== true ||
  parsedSearchJson.query !== "decision" ||
  typeof parsedSearchJson.count !== "number" ||
  !Array.isArray(parsedSearchJson.results)
) {
  fail("search --json output did not match expected success", searchJson);
}

const searchMissingQueryJson = runCli(["search", "--json"]);
expectNonzero("search missing query --json exited zero", searchMissingQueryJson);
const parsedSearchMissingQueryJson = parseJsonStdout(
  "search missing query --json output was not valid JSON",
  searchMissingQueryJson,
);
if (
  parsedSearchMissingQueryJson.ok !== false ||
  parsedSearchMissingQueryJson.reason !== "missing_query"
) {
  fail(
    "search missing query --json output did not match expected failure",
    searchMissingQueryJson,
  );
}

const searchNoMatchesJson = runCli([
  "search",
  `smoke-json-no-search-match-${smokeRunId}`,
  "--json",
]);
expectExitCode("search no-match --json command exited nonzero", searchNoMatchesJson, 0);
const parsedSearchNoMatchesJson = parseJsonStdout(
  "search no-match --json output was not valid JSON",
  searchNoMatchesJson,
);
if (
  parsedSearchNoMatchesJson.ok !== true ||
  parsedSearchNoMatchesJson.query !== `smoke-json-no-search-match-${smokeRunId}` ||
  parsedSearchNoMatchesJson.count !== 0
) {
  fail(
    "search no-match --json output did not match expected success",
    searchNoMatchesJson,
  );
}
expectEmptyArray(
  "search no-match --json results was not empty",
  parsedSearchNoMatchesJson.results,
);

const searchNoMatchesWithFilters = runCli([
  "search",
  `smoke-filtered-no-search-match-${smokeRunId}`,
  "--type",
  "decision",
  "--tag",
  "architecture",
]);
expectExitCode(
  "search no-match command with filters exited nonzero",
  searchNoMatchesWithFilters,
  0,
);
if (
  searchNoMatchesWithFilters.stdout !==
  `Search Results\nQuery: smoke-filtered-no-search-match-${smokeRunId}\nMatches: 0\n`
) {
  fail("search filtered no-match output was not stable", searchNoMatchesWithFilters);
}

const remember = runCli([
  "remember",
  "--type",
  "decision",
  "--title",
  `Smoke human persistence ${smokeRunId}`,
  "--tag",
  "architecture",
]);
expectExitCode("remember exited nonzero", remember, 0);
expectOutputIncludes(
  'remember output did not include "Memory: prepared"',
  remember,
  "Memory: prepared",
);
expectOutputIncludes(
  'remember output did not include "Path: .aeos/memory/decision/"',
  remember,
  "Path: .aeos/memory/decision/",
);
const rememberPath = extractRememberPath(remember);
const rememberAbsolutePath = rememberPathToAbsolute(rememberPath);
createdMemoryPaths.add(rememberAbsolutePath);
if (!existsSync(rememberAbsolutePath)) {
  fail("valid remember did not create memory file", remember);
}

const searchPersisted = runCli([
  "search",
  `Smoke human persistence ${smokeRunId}`,
]);
expectExitCode("search persisted memory exited nonzero", searchPersisted, 0);
expectOutputIncludes(
  "search persisted memory did not include remembered title",
  searchPersisted,
  `Smoke human persistence ${smokeRunId}`,
);
expectOutputIncludes(
  "search persisted memory did not include remembered path",
  searchPersisted,
  rememberPath,
);

const rememberJson = runCli([
  "remember",
  "--type",
  "decision",
  "--title",
  `Smoke JSON persistence ${smokeRunId}`,
  "--json",
]);
expectExitCode("remember --json exited nonzero", rememberJson, 0);
const parsedRemember = parseJsonStdout(
  "remember --json output was not valid JSON",
  rememberJson,
);
if (
  parsedRemember.ok !== true ||
  parsedRemember.type !== "decision" ||
  parsedRemember.title !== `Smoke JSON persistence ${smokeRunId}` ||
  typeof parsedRemember.path !== "string" ||
  parsedRemember.path.length === 0 ||
  parsedRemember.persisted !== true
) {
  fail("remember --json output did not match expected success", rememberJson);
}
const rememberJsonAbsolutePath = rememberPathToAbsolute(parsedRemember.path);
createdMemoryPaths.add(rememberJsonAbsolutePath);
if (!existsSync(rememberJsonAbsolutePath)) {
  fail("remember --json returned path did not exist", rememberJson);
}

const searchPersistedJson = runCli([
  "search",
  `Smoke JSON persistence ${smokeRunId}`,
  "--json",
]);
expectExitCode("search persisted memory --json exited nonzero", searchPersistedJson, 0);
const parsedSearchPersistedJson = parseJsonStdout(
  "search persisted memory --json output was not valid JSON",
  searchPersistedJson,
);
if (
  parsedSearchPersistedJson.ok !== true ||
  parsedSearchPersistedJson.count !== 1 ||
  parsedSearchPersistedJson.results[0]?.title !==
    `Smoke JSON persistence ${smokeRunId}` ||
  parsedSearchPersistedJson.results[0]?.path !== parsedRemember.path
) {
  fail(
    "search persisted memory --json output did not match expected result",
    searchPersistedJson,
  );
}

const duplicateTitle = `Smoke duplicate persistence ${smokeRunId}`;
const rememberDuplicateFirst = runCli([
  "remember",
  "--type",
  "decision",
  "--title",
  duplicateTitle,
  "--tag",
  "duplicate",
  "--json",
]);
expectExitCode("first duplicate remember --json exited nonzero", rememberDuplicateFirst, 0);
const parsedDuplicateFirst = parseJsonStdout(
  "first duplicate remember --json output was not valid JSON",
  rememberDuplicateFirst,
);
if (
  parsedDuplicateFirst.ok !== true ||
  parsedDuplicateFirst.persisted !== true ||
  typeof parsedDuplicateFirst.path !== "string" ||
  parsedDuplicateFirst.path.length === 0
) {
  fail(
    "first duplicate remember --json output did not match expected success",
    rememberDuplicateFirst,
  );
}
const duplicateAbsolutePath = rememberPathToAbsolute(parsedDuplicateFirst.path);
createdMemoryPaths.add(duplicateAbsolutePath);
if (!existsSync(duplicateAbsolutePath)) {
  fail("first duplicate remember --json returned path did not exist", rememberDuplicateFirst);
}

const rememberDuplicateSecond = runCli([
  "remember",
  "--type",
  "decision",
  "--title",
  duplicateTitle,
  "--tag",
  "duplicate",
  "--json",
]);
expectNonzero("second duplicate remember --json exited zero", rememberDuplicateSecond);
const parsedDuplicateSecond = parseJsonStdout(
  "second duplicate remember --json output was not valid JSON",
  rememberDuplicateSecond,
);
if (
  parsedDuplicateSecond.ok !== false ||
  parsedDuplicateSecond.reason !== "filesystem_failed" ||
  parsedDuplicateSecond.persisted !== false
) {
  fail(
    "second duplicate remember --json output did not match expected failure",
    rememberDuplicateSecond,
  );
}
expectEmptyArray(
  "second duplicate remember --json issues was not empty",
  parsedDuplicateSecond.issues,
);
if (!existsSync(duplicateAbsolutePath)) {
  fail("second duplicate remember removed the original memory file", rememberDuplicateSecond);
}

const memoryFilesBeforeInvalidRemember = listMemoryFiles();
const rememberMissingTitle = runCli(["remember", "--type", "decision"]);
expectNonzero("remember without title exited zero", rememberMissingTitle);
expectOutputIncludes(
  'remember without title output did not include "Memory: fail"',
  rememberMissingTitle,
  "Memory: fail",
);
const memoryFilesAfterInvalidRemember = listMemoryFiles();
if (
  memoryFilesAfterInvalidRemember.length !== memoryFilesBeforeInvalidRemember.length ||
  memoryFilesAfterInvalidRemember.some(
    (path, index) => path !== memoryFilesBeforeInvalidRemember[index],
  )
) {
  fail("invalid remember created a memory file", rememberMissingTitle);
}

const rememberInvalidType = runCli([
  "remember",
  "--type",
  "unknown",
  "--title",
  "Invalid type",
]);
expectNonzero("remember with invalid type exited zero", rememberInvalidType);
expectOutputIncludes(
  'remember invalid type output did not include "Memory: fail"',
  rememberInvalidType,
  "Memory: fail",
);

const rememberInvalidTypeJson = runCli([
  "remember",
  "--type",
  "unknown",
  "--title",
  "Invalid type",
  "--json",
]);
expectNonzero("remember invalid type --json exited zero", rememberInvalidTypeJson);
const parsedRememberInvalidType = parseJsonStdout(
  "remember invalid type --json output was not valid JSON",
  rememberInvalidTypeJson,
);
if (
  parsedRememberInvalidType.ok !== false ||
  parsedRememberInvalidType.reason !== "invalid_memory_type"
) {
  fail(
    "remember invalid type --json output did not match expected failure",
    rememberInvalidTypeJson,
  );
}
expectEmptyArray(
  "remember invalid type --json issues was not empty",
  parsedRememberInvalidType.issues,
);

const taskPlan = runCli(["task", "plan"]);
expectNonzero("task plan exited zero", taskPlan);
for (const expectedText of [
  "Task Plan",
  "Status: skeleton",
  "Mode: plan",
  "Real execution: false",
  "Adapter calls: false",
  "Audit writes: false",
  "Verifier run: false",
  "Persistence: false",
  "task contract input support is not implemented yet",
]) {
  expectOutputIncludes(
    `task plan output did not include ${expectedText}`,
    taskPlan,
    expectedText,
  );
}

const taskPlanJson = runCli(["task", "plan", "--json"]);
expectNonzero("task plan --json exited zero", taskPlanJson);
const parsedTaskPlanJson = parseJsonOnlyStdout(
  "task plan --json output was not valid JSON only",
  taskPlanJson,
);
expectTaskPlanSkeletonJsonShape(
  "task plan --json output shape was invalid",
  parsedTaskPlanJson,
  taskPlanJson,
);

const taskPlanUnknown = runCli(["task", "plan", "--unknown"]);
expectNonzero("task plan unknown option exited zero", taskPlanUnknown);
expectOutputIncludes(
  "task plan unknown option did not report unknown task plan option",
  taskPlanUnknown,
  "unknown task plan option",
);
expectOutputIncludes(
  "task plan unknown option did not include task plan usage",
  taskPlanUnknown,
  "Usage: aeos task plan [<task-file>] [--json]",
);

const taskPlanUnknownJson = runCli(["task", "plan", "--unknown", "--json"]);
expectNonzero("task plan unknown option --json exited zero", taskPlanUnknownJson);
const parsedTaskPlanUnknownJson = parseJsonOnlyStdout(
  "task plan unknown option --json output was not valid JSON only",
  taskPlanUnknownJson,
);
expectTaskPlanErrorJsonShape(
  "task plan unknown option --json shape was invalid",
  parsedTaskPlanUnknownJson,
  taskPlanUnknownJson,
);

const taskPlanNoWriteRoot = mkdtempSync(join(tmpdir(), "aeos-cli-task-plan-no-write-"));
const taskPlanTraversalParentRoot = mkdtempSync(
  join(tmpdir(), "aeos-cli-task-plan-parent-"),
);

try {
  const validTaskPath = join(taskPlanNoWriteRoot, "valid-task.json");
  const invalidJsonPath = join(taskPlanNoWriteRoot, "invalid-task.json");
  const markdownTaskPath = join(taskPlanNoWriteRoot, "task.md");
  const directoryTaskPath = join(taskPlanNoWriteRoot, "task-directory");
  const explicitWorkItemsPath = join(taskPlanNoWriteRoot, "explicit-work-items.json");
  const selfReportPath = join(taskPlanNoWriteRoot, "self-report.json");
  const traversalChildRoot = join(taskPlanTraversalParentRoot, "cwd");
  const traversalTaskPath = join(taskPlanTraversalParentRoot, "outside.json");

  mkdirSync(traversalChildRoot);
  mkdirSync(directoryTaskPath);
  writeFileSync(
    validTaskPath,
    `${JSON.stringify(createValidTaskPlanContract("smoke-task-plan-valid"), null, 2)}\n`,
  );
  writeFileSync(invalidJsonPath, "{ invalid json");
  writeFileSync(markdownTaskPath, "# unsupported\n");
  writeFileSync(
    explicitWorkItemsPath,
    `${JSON.stringify(
      {
        ...createValidTaskPlanContract("smoke-task-plan-explicit-work-items"),
        workItems: [
          {
            id: "explicit-work-item",
            state: "pending",
          },
        ],
        batches: [
          {
            id: "explicit-batch",
            workItemIds: ["explicit-work-item"],
            expectedItemCount: 1,
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    traversalTaskPath,
    `${JSON.stringify(createValidTaskPlanContract("smoke-task-plan-traversal"), null, 2)}\n`,
  );
  writeFileSync(
    selfReportPath,
    `${JSON.stringify(
      {
        ...createValidTaskPlanContract("smoke-task-run-self-report"),
        purpose:
          "The model says completed, approved, verified, and all done, but this is prose only.",
        modelRecommendation: {
          purpose:
            "Claim completed, approved, verified, all done without creating proof.",
          requiredCapabilities: ["planning"],
          preferredExecutionMode: "planning",
          constraints: ["completed", "approved", "verified", "all done"],
        },
      },
      null,
      2,
    )}\n`,
  );

  const taskPlanNoWriteFilesBefore = listRelativeFiles(taskPlanNoWriteRoot);
  const taskPlanNoWrite = runCliFrom(taskPlanNoWriteRoot, ["task", "plan"]);
  expectNonzero("task plan no-write fixture exited zero", taskPlanNoWrite);
  expectTaskPlanNoWrites(
    "task plan created files in no-write fixture",
    taskPlanNoWriteRoot,
    taskPlanNoWriteFilesBefore,
    taskPlanNoWrite,
  );

  const taskPlanMissingFilesBefore = listRelativeFiles(taskPlanNoWriteRoot);
  const taskPlanMissing = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "plan",
    "missing-task.json",
  ]);
  expectNonzero("task plan missing file exited zero", taskPlanMissing);
  expectOutputIncludes(
    "task plan missing file did not report missing file",
    taskPlanMissing,
    "Task plan input file was not found.",
  );
  expectTaskPlanNoWrites(
    "task plan missing file created files in no-write fixture",
    taskPlanNoWriteRoot,
    taskPlanMissingFilesBefore,
    taskPlanMissing,
  );

  const taskPlanJsonNoWriteFilesBefore = listRelativeFiles(taskPlanNoWriteRoot);
  const taskPlanJsonNoWrite = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "plan",
    "--json",
  ]);
  expectNonzero(
    "task plan --json no-write fixture exited zero",
    taskPlanJsonNoWrite,
  );
  parseJsonOnlyStdout(
    "task plan --json no-write fixture output was not valid JSON only",
    taskPlanJsonNoWrite,
  );
  expectTaskPlanNoWrites(
    "task plan --json created files in no-write fixture",
    taskPlanNoWriteRoot,
    taskPlanJsonNoWriteFilesBefore,
    taskPlanJsonNoWrite,
  );

  const taskPlanInvalidJsonFilesBefore = listRelativeFiles(taskPlanNoWriteRoot);
  const taskPlanInvalidJson = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "plan",
    "invalid-task.json",
  ]);
  expectNonzero("task plan invalid JSON exited zero", taskPlanInvalidJson);
  expectOutputIncludes(
    "task plan invalid JSON did not report invalid JSON",
    taskPlanInvalidJson,
    "Task plan input file is not valid JSON.",
  );
  expectOutputExcludes(
    "task plan invalid JSON leaked raw JSON parser message",
    taskPlanInvalidJson,
    "Unexpected token",
  );
  expectOutputExcludes(
    "task plan invalid JSON dumped raw invalid task content",
    taskPlanInvalidJson,
    "{ invalid json",
  );
  expectTaskPlanNoWrites(
    "task plan invalid JSON created files in no-write fixture",
    taskPlanNoWriteRoot,
    taskPlanInvalidJsonFilesBefore,
    taskPlanInvalidJson,
  );

  const taskPlanJsonInvalidFilesBefore = listRelativeFiles(taskPlanNoWriteRoot);
  const taskPlanJsonInvalid = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "plan",
    "invalid-task.json",
    "--json",
  ]);
  expectNonzero("task plan invalid JSON --json exited zero", taskPlanJsonInvalid);
  const parsedTaskPlanJsonInvalid = parseJsonOnlyStdout(
    "task plan invalid JSON --json output was not valid JSON only",
    taskPlanJsonInvalid,
  );
  expectTaskPlanInputErrorJsonShape(
    "task plan invalid JSON --json shape was invalid",
    parsedTaskPlanJsonInvalid,
    taskPlanJsonInvalid,
  );
  if (
    parsedTaskPlanJsonInvalid.status !== "parser_failed" ||
    !parsedTaskPlanJsonInvalid.issues.some(
      (issue) => issue.code === "task_plan_input_invalid_json",
    )
  ) {
    fail("task plan invalid JSON --json did not use stable parser issue", taskPlanJsonInvalid);
  }
  if (taskPlanJsonInvalid.stdout.includes("parseErrorMessage")) {
    fail("task plan invalid JSON --json leaked parse internals", taskPlanJsonInvalid);
  }
  expectOutputExcludes(
    "task plan invalid JSON --json leaked raw JSON parser message",
    taskPlanJsonInvalid,
    "Unexpected token",
  );
  expectOutputExcludes(
    "task plan invalid JSON --json dumped raw invalid task content",
    taskPlanJsonInvalid,
    "{ invalid json",
  );
  expectTaskPlanNoWrites(
    "task plan invalid JSON --json created files in no-write fixture",
    taskPlanNoWriteRoot,
    taskPlanJsonInvalidFilesBefore,
    taskPlanJsonInvalid,
  );

  const taskPlanUnsupportedFilesBefore = listRelativeFiles(taskPlanNoWriteRoot);
  const taskPlanUnsupported = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "plan",
    "task.md",
  ]);
  expectNonzero("task plan unsupported extension exited zero", taskPlanUnsupported);
  expectOutputIncludes(
    "task plan unsupported extension did not report extension failure",
    taskPlanUnsupported,
    "Task plan input file must be a .json file.",
  );
  expectTaskPlanNoWrites(
    "task plan unsupported extension created files in no-write fixture",
    taskPlanNoWriteRoot,
    taskPlanUnsupportedFilesBefore,
    taskPlanUnsupported,
  );

  const taskPlanUnsupportedJsonFilesBefore = listRelativeFiles(taskPlanNoWriteRoot);
  const taskPlanUnsupportedJson = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "plan",
    "task.md",
    "--json",
  ]);
  expectNonzero("task plan unsupported extension --json exited zero", taskPlanUnsupportedJson);
  const parsedTaskPlanUnsupportedJson = parseJsonOnlyStdout(
    "task plan unsupported extension --json output was not valid JSON only",
    taskPlanUnsupportedJson,
  );
  expectTaskPlanInputErrorJsonShape(
    "task plan unsupported extension --json shape was invalid",
    parsedTaskPlanUnsupportedJson,
    taskPlanUnsupportedJson,
  );
  if (
    parsedTaskPlanUnsupportedJson.status !== "parser_failed" ||
    !parsedTaskPlanUnsupportedJson.issues.some(
      (issue) => issue.code === "task_plan_input_unsupported_format",
    )
  ) {
    fail(
      "task plan unsupported extension --json did not use stable parser issue",
      taskPlanUnsupportedJson,
    );
  }
  expectTaskPlanNoWrites(
    "task plan unsupported extension --json created files in no-write fixture",
    taskPlanNoWriteRoot,
    taskPlanUnsupportedJsonFilesBefore,
    taskPlanUnsupportedJson,
  );

  const explicitWorkItemsFilesBefore = listRelativeFiles(taskPlanNoWriteRoot);
  const taskPlanExplicitWorkItemsJson = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "plan",
    "explicit-work-items.json",
    "--json",
  ]);
  expectNonzero(
    "task plan explicit workItems/batches --json exited zero",
    taskPlanExplicitWorkItemsJson,
  );
  const parsedTaskPlanExplicitWorkItemsJson = parseJsonOnlyStdout(
    "task plan explicit workItems/batches --json output was not valid JSON only",
    taskPlanExplicitWorkItemsJson,
  );
  expectTaskPlanInputErrorJsonShape(
    "task plan explicit workItems/batches --json shape was invalid",
    parsedTaskPlanExplicitWorkItemsJson,
    taskPlanExplicitWorkItemsJson,
  );
  if (
    parsedTaskPlanExplicitWorkItemsJson.status !== "unsupported_mapping" ||
    parsedTaskPlanExplicitWorkItemsJson.mapping.status !== "unsupported" ||
    !parsedTaskPlanExplicitWorkItemsJson.issues.some(
      (issue) => issue.code === "task_contract_explicit_work_items_unsupported",
    ) ||
    !parsedTaskPlanExplicitWorkItemsJson.issues.some(
      (issue) => issue.code === "task_contract_explicit_batches_unsupported",
    ) ||
    parsedTaskPlanExplicitWorkItemsJson.summary.plannerInvocationAllowed !== false
  ) {
    fail(
      "task plan explicit workItems/batches --json did not fail closed as unsupported mapping",
      taskPlanExplicitWorkItemsJson,
    );
  }
  expectTaskPlanNoWrites(
    "task plan explicit workItems/batches --json created files in no-write fixture",
    taskPlanNoWriteRoot,
    explicitWorkItemsFilesBefore,
    taskPlanExplicitWorkItemsJson,
  );

  const taskPlanDirectoryJsonFilesBefore = listRelativeFiles(taskPlanNoWriteRoot);
  const taskPlanDirectoryJson = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "plan",
    "task-directory",
    "--json",
  ]);
  expectNonzero("task plan directory input --json exited zero", taskPlanDirectoryJson);
  const parsedTaskPlanDirectoryJson = parseJsonOnlyStdout(
    "task plan directory input --json output was not valid JSON only",
    taskPlanDirectoryJson,
  );
  expectTaskPlanInputErrorJsonShape(
    "task plan directory input --json shape was invalid",
    parsedTaskPlanDirectoryJson,
    taskPlanDirectoryJson,
  );
  if (
    parsedTaskPlanDirectoryJson.status !== "parser_failed" ||
    !parsedTaskPlanDirectoryJson.issues.some(
      (issue) => issue.code === "task_plan_input_path_is_directory",
    )
  ) {
    fail(
      "task plan directory input --json did not use stable parser issue",
      taskPlanDirectoryJson,
    );
  }
  expectTaskPlanNoWrites(
    "task plan directory input --json created files in no-write fixture",
    taskPlanNoWriteRoot,
    taskPlanDirectoryJsonFilesBefore,
    taskPlanDirectoryJson,
  );

  const taskPlanAbsoluteJsonFilesBefore = listRelativeFiles(taskPlanNoWriteRoot);
  const taskPlanAbsoluteJson = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "plan",
    validTaskPath,
    "--json",
  ]);
  expectNonzero("task plan absolute path --json exited zero", taskPlanAbsoluteJson);
  const parsedTaskPlanAbsoluteJson = parseJsonOnlyStdout(
    "task plan absolute path --json output was not valid JSON only",
    taskPlanAbsoluteJson,
  );
  expectTaskPlanInputErrorJsonShape(
    "task plan absolute path --json shape was invalid",
    parsedTaskPlanAbsoluteJson,
    taskPlanAbsoluteJson,
  );
  if (
    parsedTaskPlanAbsoluteJson.status !== "parser_failed" ||
    !parsedTaskPlanAbsoluteJson.issues.some(
      (issue) => issue.code === "task_plan_input_absolute_path_disallowed",
    )
  ) {
    fail("task plan absolute path --json was not denied by default", taskPlanAbsoluteJson);
  }
  expectTaskPlanNoWrites(
    "task plan absolute path --json created files in no-write fixture",
    taskPlanNoWriteRoot,
    taskPlanAbsoluteJsonFilesBefore,
    taskPlanAbsoluteJson,
  );

  const traversalFilesBefore = listRelativeFiles(taskPlanTraversalParentRoot);
  const taskPlanTraversalJson = runCliFrom(traversalChildRoot, [
    "task",
    "plan",
    "../outside.json",
    "--json",
  ]);
  expectNonzero("task plan parent traversal --json exited zero", taskPlanTraversalJson);
  const parsedTaskPlanTraversalJson = parseJsonOnlyStdout(
    "task plan parent traversal --json output was not valid JSON only",
    taskPlanTraversalJson,
  );
  expectTaskPlanInputErrorJsonShape(
    "task plan parent traversal --json shape was invalid",
    parsedTaskPlanTraversalJson,
    taskPlanTraversalJson,
  );
  if (
    parsedTaskPlanTraversalJson.status !== "parser_failed" ||
    !parsedTaskPlanTraversalJson.issues.some(
      (issue) => issue.code === "task_plan_input_parent_traversal_disallowed",
    )
  ) {
    fail("task plan parent traversal --json was not denied", taskPlanTraversalJson);
  }
  expectSameFiles(
    "task plan parent traversal changed files",
    traversalFilesBefore,
    listRelativeFiles(taskPlanTraversalParentRoot),
  );
  if (existsSync(join(traversalChildRoot, "AGENTS.md"))) {
    fail("task plan parent traversal created AGENTS.md", taskPlanTraversalJson);
  }

  const taskPlanValidFilesBefore = listRelativeFiles(taskPlanNoWriteRoot);
  const taskPlanValid = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "plan",
    "valid-task.json",
  ]);
  expectExitCode("task plan valid planned integration exited nonzero", taskPlanValid, 0);
  for (const expectedText of [
    "Task Plan",
    "Task id: smoke-task-plan-valid",
    "Mode: plan",
    "Parsed: true",
    "Source file: valid-task.json",
    "Mapping: mapped",
    "Planning: planned",
    "Work items: 1",
    "Batches: 1",
    "Steps:",
    "Policy required: true",
    "Verifier required: true",
    "Completion gated by verifier: true",
    "Real execution: false",
    "Adapter calls: false",
    "Audit writes: false",
    "Verifier run: false",
    "Persistence: false",
    "Filesystem mutation: false",
    "Completed state created: false",
    "Issues: 0",
  ]) {
    expectOutputIncludes(
      `task plan valid planned output did not include ${expectedText}`,
      taskPlanValid,
      expectedText,
    );
  }
  for (const unexpectedIssueText of [
    "cli_task_plan_no_execution_not_proven",
    "cli_task_plan_no_writes_not_proven",
    "cli_task_plan_verifier_not_required",
    "cli_task_plan_completion_not_verifier_gated",
  ]) {
    expectOutputExcludes(
      `task plan valid planned output unexpectedly included ${unexpectedIssueText}`,
      taskPlanValid,
      unexpectedIssueText,
    );
  }
  expectOutputExcludes(
    "task plan valid parse ran task validation command output",
    taskPlanValid,
    "Task validation",
  );
  for (const unexpectedText of [
    "Smoke valid task plan input",
    "Verify task plan CLI integration.",
    "Stop after task plan smoke validation.",
    "filesToModify",
    "filesNotToTouch",
  ]) {
    expectOutputExcludes(
      `task plan valid parse human output dumped parsed task content: ${unexpectedText}`,
      taskPlanValid,
      unexpectedText,
    );
  }
  expectTaskPlanNoWrites(
    "task plan valid parse created files in no-write fixture",
    taskPlanNoWriteRoot,
    taskPlanValidFilesBefore,
    taskPlanValid,
  );

  const taskPlanValidJsonFilesBefore = listRelativeFiles(taskPlanNoWriteRoot);
  const taskPlanValidJson = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "plan",
    "valid-task.json",
    "--json",
  ]);
  expectExitCode(
    "task plan valid planned --json exited nonzero",
    taskPlanValidJson,
    0,
  );
  const parsedTaskPlanValidJson = parseJsonOnlyStdout(
    "task plan valid planned --json output was not valid JSON only",
    taskPlanValidJson,
  );
  expectTaskPlanParsedJsonShape(
    "task plan valid planned --json shape was invalid",
    parsedTaskPlanValidJson,
    taskPlanValidJson,
  );
  if (
    parsedTaskPlanValidJson.sourceFile !== "valid-task.json" ||
    parsedTaskPlanValidJson.ok !== true ||
    parsedTaskPlanValidJson.status !== "planned" ||
    parsedTaskPlanValidJson.exitCode !== "success" ||
    parsedTaskPlanValidJson.plan.attempted !== true ||
    parsedTaskPlanValidJson.plan.ok !== true ||
    parsedTaskPlanValidJson.plan.status !== "planned" ||
    parsedTaskPlanValidJson.mapping.status !== "mapped" ||
    parsedTaskPlanValidJson.mapping.runnerPlanningInputAvailable !== true ||
    parsedTaskPlanValidJson.mapping.noExecution !== true ||
    parsedTaskPlanValidJson.mapping.noWrites !== true ||
    parsedTaskPlanValidJson.wiring.plannerDependencyInjected !== true ||
    parsedTaskPlanValidJson.wiring.plannerInvocationAllowed !== true ||
    parsedTaskPlanValidJson.summary.verifierRequired !== true ||
    parsedTaskPlanValidJson.summary.completionGatedByVerifier !== true ||
    parsedTaskPlanValidJson.summary.plannerInvocationAllowed !== true ||
    parsedTaskPlanValidJson.summary.parsed !== true ||
    parsedTaskPlanValidJson.summary.mapped !== true ||
    parsedTaskPlanValidJson.summary.wired !== true ||
    parsedTaskPlanValidJson.summary.planned !== true ||
    parsedTaskPlanValidJson.summary.executionEnabled !== false ||
    parsedTaskPlanValidJson.summary.adapterCalls !== false ||
    parsedTaskPlanValidJson.summary.auditWrites !== false ||
    parsedTaskPlanValidJson.summary.verifierRun !== false ||
    parsedTaskPlanValidJson.summary.persistence !== false ||
    parsedTaskPlanValidJson.summary.filesystemMutation !== false ||
    parsedTaskPlanValidJson.summary.completedStateCreated !== false ||
    parsedTaskPlanValidJson.issues.length !== 0
  ) {
    fail("task plan valid --json did not report planned safe success", taskPlanValidJson);
  }
  expectTaskPlanParserOnlySafety(
    "task plan valid planned --json",
    taskPlanValidJson.stdout,
    taskPlanValidJson,
  );
  for (const unexpectedText of [
    "Smoke valid task plan input",
    "Verify task plan CLI integration.",
    "Stop after task plan smoke validation.",
    "filesToModify",
    "filesNotToTouch",
    "taskSteps",
    "verificationCommands",
  ]) {
    expectOutputExcludes(
      `task plan valid parse --json dumped parsed task content: ${unexpectedText}`,
      taskPlanValidJson,
      unexpectedText,
    );
  }
  expectTaskPlanNoWrites(
    "task plan valid parse --json created files in no-write fixture",
    taskPlanNoWriteRoot,
    taskPlanValidJsonFilesBefore,
    taskPlanValidJson,
  );

  const taskPlanMissingJson = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "plan",
    "missing-task.json",
    "--json",
  ]);
  expectNonzero("task plan missing file --json exited zero", taskPlanMissingJson);
  const parsedTaskPlanMissingJson = parseJsonOnlyStdout(
    "task plan missing file --json output was not valid JSON only",
    taskPlanMissingJson,
  );
  expectTaskPlanInputErrorJsonShape(
    "task plan missing file --json shape was invalid",
    parsedTaskPlanMissingJson,
    taskPlanMissingJson,
  );
  if (
    parsedTaskPlanMissingJson.status !== "parser_failed" ||
    !parsedTaskPlanMissingJson.issues.some(
      (issue) => issue.code === "task_plan_input_file_missing",
    )
  ) {
    fail("task plan missing file --json did not use stable parser issue", taskPlanMissingJson);
  }

  const taskPlanUnknownWithJson = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "plan",
    "--unknown",
    "--json",
  ]);
  expectNonzero("task plan unknown flag --json fixture exited zero", taskPlanUnknownWithJson);
  parseJsonOnlyStdout(
    "task plan unknown flag --json fixture output was not valid JSON only",
    taskPlanUnknownWithJson,
  );

  const taskRunWithoutDryRun = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "run",
    "valid-task.json",
    "--json",
  ]);
  expectNonzero("task run without --dry-run exited zero", taskRunWithoutDryRun);
  const parsedTaskRunWithoutDryRun = parseJsonOnlyStdout(
    "task run without --dry-run output was not valid JSON only",
    taskRunWithoutDryRun,
  );
  if (
    parsedTaskRunWithoutDryRun.ok !== false ||
    parsedTaskRunWithoutDryRun.error?.code !==
      "task_run_real_execution_not_implemented"
  ) {
    fail(
      "task run without --dry-run did not fail as unavailable real execution",
      taskRunWithoutDryRun,
    );
  }

  const taskDryRunMissingPath = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "run",
    "--dry-run",
    "--json",
  ]);
  expectNonzero("task dry-run missing path exited zero", taskDryRunMissingPath);
  const parsedTaskDryRunMissingPath = parseJsonOnlyStdout(
    "task dry-run missing path output was not valid JSON only",
    taskDryRunMissingPath,
  );
  if (
    parsedTaskDryRunMissingPath.ok !== false ||
    parsedTaskDryRunMissingPath.error?.code !== "task_run_task_file_required"
  ) {
    fail("task dry-run missing path did not use stable error", taskDryRunMissingPath);
  }

  const taskDryRunUnknownJson = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "run",
    "--dry-run",
    "valid-task.json",
    "--unknown",
    "--json",
  ]);
  expectNonzero("task dry-run unknown flag --json exited zero", taskDryRunUnknownJson);
  const parsedTaskDryRunUnknownJson = parseJsonOnlyStdout(
    "task dry-run unknown flag --json output was not valid JSON only",
    taskDryRunUnknownJson,
  );
  if (
    parsedTaskDryRunUnknownJson.ok !== false ||
    parsedTaskDryRunUnknownJson.error?.code !== "task_run_unknown_option"
  ) {
    fail("task dry-run unknown flag --json did not use stable error", taskDryRunUnknownJson);
  }

  const taskDryRunValidFilesBefore = listRelativeFiles(taskPlanNoWriteRoot);
  const taskDryRunValid = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "run",
    "--dry-run",
    "valid-task.json",
  ]);
  expectExitCode("task dry-run valid exited nonzero", taskDryRunValid, 0);
  for (const expectedText of [
    "Task Dry Run",
    "Task id: smoke-task-plan-valid",
    "Source file: valid-task.json",
    "Parsed: true",
    "Mapping: mapped",
    "Planning: planned",
    "Dry run: verification_required",
    "Work items: 1",
    "Batches: 1",
    "Preview steps:",
    "Policy required: true",
    "Approval required: false",
    "Verifier required: true",
    "Completion gated by verifier: true",
    "Real execution: false",
    "Adapter calls: false",
    "Audit writes: false",
    "Verifier run: false",
    "Persistence: false",
    "Filesystem mutation: false",
    "Completed state created: false",
    "Issues: 0",
  ]) {
    expectOutputIncludes(
      `task dry-run valid output did not include ${expectedText}`,
      taskDryRunValid,
      expectedText,
    );
  }
  expectTaskDryRunNoRuntimeClaims(
    "task dry-run valid human output",
    taskDryRunValid,
  );
  expectTaskPlanNoWrites(
    "task dry-run valid created files in no-write fixture",
    taskPlanNoWriteRoot,
    taskDryRunValidFilesBefore,
    taskDryRunValid,
  );

  const taskDryRunValidJsonFilesBefore = listRelativeFiles(taskPlanNoWriteRoot);
  const taskDryRunValidJson = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "run",
    "--dry-run",
    "valid-task.json",
    "--json",
  ]);
  expectExitCode("task dry-run valid --json exited nonzero", taskDryRunValidJson, 0);
  const parsedTaskDryRunValidJson = parseJsonOnlyStdout(
    "task dry-run valid --json output was not valid JSON only",
    taskDryRunValidJson,
  );
  expectTaskDryRunSuccessJsonShape(
    "task dry-run valid --json shape was invalid",
    parsedTaskDryRunValidJson,
    taskDryRunValidJson,
  );
  if (
    parsedTaskDryRunValidJson.sourceFile !== "valid-task.json" ||
    parsedTaskDryRunValidJson.taskId !== "smoke-task-plan-valid" ||
    parsedTaskDryRunValidJson.summary.workItemCount !== 1 ||
    parsedTaskDryRunValidJson.summary.batchCount !== 1 ||
    parsedTaskDryRunValidJson.dryRun.summary.plannedWorkItems !== 1 ||
    parsedTaskDryRunValidJson.dryRun.summary.plannedBatches !== 1 ||
    parsedTaskDryRunValidJson.dryRun.summary.plannedSteps === 0
  ) {
    fail("task dry-run valid --json did not expose canonical counts", taskDryRunValidJson);
  }
  expectTaskDryRunNoRuntimeClaims(
    "task dry-run valid --json output",
    taskDryRunValidJson,
  );
  expectTaskPlanNoWrites(
    "task dry-run valid --json created files in no-write fixture",
    taskPlanNoWriteRoot,
    taskDryRunValidJsonFilesBefore,
    taskDryRunValidJson,
  );

  const taskDryRunMissingJson = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "run",
    "--dry-run",
    "missing-task.json",
    "--json",
  ]);
  expectNonzero("task dry-run missing file --json exited zero", taskDryRunMissingJson);
  const parsedTaskDryRunMissingJson = parseJsonOnlyStdout(
    "task dry-run missing file --json output was not valid JSON only",
    taskDryRunMissingJson,
  );
  expectTaskDryRunJsonShape(
    "task dry-run missing file --json shape was invalid",
    parsedTaskDryRunMissingJson,
    taskDryRunMissingJson,
  );
  if (
    parsedTaskDryRunMissingJson.status !== "parser_failed" ||
    !parsedTaskDryRunMissingJson.issues.some(
      (issue) => issue.code === "task_plan_input_file_missing",
    )
  ) {
    fail("task dry-run missing file --json did not use parser issue", taskDryRunMissingJson);
  }

  const taskDryRunInvalidJson = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "run",
    "--dry-run",
    "invalid-task.json",
    "--json",
  ]);
  expectNonzero("task dry-run invalid JSON --json exited zero", taskDryRunInvalidJson);
  const parsedTaskDryRunInvalidJson = parseJsonOnlyStdout(
    "task dry-run invalid JSON --json output was not valid JSON only",
    taskDryRunInvalidJson,
  );
  expectTaskDryRunJsonShape(
    "task dry-run invalid JSON --json shape was invalid",
    parsedTaskDryRunInvalidJson,
    taskDryRunInvalidJson,
  );
  if (
    parsedTaskDryRunInvalidJson.status !== "parser_failed" ||
    !parsedTaskDryRunInvalidJson.issues.some(
      (issue) => issue.code === "task_plan_input_invalid_json",
    ) ||
    taskDryRunInvalidJson.stdout.includes("parseErrorMessage")
  ) {
    fail("task dry-run invalid JSON --json was not deterministic", taskDryRunInvalidJson);
  }

  const taskDryRunUnsupportedJson = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "run",
    "--dry-run",
    "task.md",
    "--json",
  ]);
  expectNonzero("task dry-run unsupported extension --json exited zero", taskDryRunUnsupportedJson);
  const parsedTaskDryRunUnsupportedJson = parseJsonOnlyStdout(
    "task dry-run unsupported extension --json output was not valid JSON only",
    taskDryRunUnsupportedJson,
  );
  expectTaskDryRunJsonShape(
    "task dry-run unsupported extension --json shape was invalid",
    parsedTaskDryRunUnsupportedJson,
    taskDryRunUnsupportedJson,
  );
  if (
    parsedTaskDryRunUnsupportedJson.status !== "parser_failed" ||
    !parsedTaskDryRunUnsupportedJson.issues.some(
      (issue) => issue.code === "task_plan_input_unsupported_format",
    )
  ) {
    fail(
      "task dry-run unsupported extension --json did not use parser issue",
      taskDryRunUnsupportedJson,
    );
  }

  const taskDryRunExplicitWorkItemsJson = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "run",
    "--dry-run",
    "explicit-work-items.json",
    "--json",
  ]);
  expectNonzero(
    "task dry-run explicit workItems/batches --json exited zero",
    taskDryRunExplicitWorkItemsJson,
  );
  const parsedTaskDryRunExplicitWorkItemsJson = parseJsonOnlyStdout(
    "task dry-run explicit workItems/batches --json output was not valid JSON only",
    taskDryRunExplicitWorkItemsJson,
  );
  expectTaskDryRunJsonShape(
    "task dry-run explicit workItems/batches --json shape was invalid",
    parsedTaskDryRunExplicitWorkItemsJson,
    taskDryRunExplicitWorkItemsJson,
  );
  if (
    parsedTaskDryRunExplicitWorkItemsJson.status !== "unsupported_mapping" ||
    parsedTaskDryRunExplicitWorkItemsJson.mapping.status !== "unsupported" ||
    parsedTaskDryRunExplicitWorkItemsJson.summary.dryRunPreviewed !== false ||
    !parsedTaskDryRunExplicitWorkItemsJson.issues.some(
      (issue) => issue.code === "task_contract_explicit_work_items_unsupported",
    ) ||
    !parsedTaskDryRunExplicitWorkItemsJson.issues.some(
      (issue) => issue.code === "task_contract_explicit_batches_unsupported",
    )
  ) {
    fail(
      "task dry-run explicit workItems/batches --json did not fail closed",
      taskDryRunExplicitWorkItemsJson,
    );
  }

  const taskDryRunSelfReportJson = runCliFrom(taskPlanNoWriteRoot, [
    "task",
    "run",
    "--dry-run",
    "self-report.json",
    "--json",
  ]);
  expectExitCode(
    "task dry-run self-report prose --json exited nonzero",
    taskDryRunSelfReportJson,
    0,
  );
  const parsedTaskDryRunSelfReportJson = parseJsonOnlyStdout(
    "task dry-run self-report prose --json output was not valid JSON only",
    taskDryRunSelfReportJson,
  );
  expectTaskDryRunSuccessJsonShape(
    "task dry-run self-report prose --json shape was invalid",
    parsedTaskDryRunSelfReportJson,
    taskDryRunSelfReportJson,
  );
  if (
    parsedTaskDryRunSelfReportJson.dryRun.verifier.completionGateSatisfied !== false ||
    parsedTaskDryRunSelfReportJson.safety.completedStateCreated !== false ||
    parsedTaskDryRunSelfReportJson.summary.completedStateCreated !== false
  ) {
    fail(
      "task dry-run self-report prose created verifier/completion authority",
      taskDryRunSelfReportJson,
    );
  }

  const taskDryRunTraversalJson = runCliFrom(traversalChildRoot, [
    "task",
    "run",
    "--dry-run",
    "../outside.json",
    "--json",
  ]);
  expectNonzero("task dry-run parent traversal --json exited zero", taskDryRunTraversalJson);
  const parsedTaskDryRunTraversalJson = parseJsonOnlyStdout(
    "task dry-run parent traversal --json output was not valid JSON only",
    taskDryRunTraversalJson,
  );
  expectTaskDryRunJsonShape(
    "task dry-run parent traversal --json shape was invalid",
    parsedTaskDryRunTraversalJson,
    taskDryRunTraversalJson,
  );
  if (
    parsedTaskDryRunTraversalJson.status !== "parser_failed" ||
    !parsedTaskDryRunTraversalJson.issues.some(
      (issue) => issue.code === "task_plan_input_parent_traversal_disallowed",
    )
  ) {
    fail("task dry-run parent traversal --json was not denied", taskDryRunTraversalJson);
  }

  const taskStateInitRoot = mkdtempSync(join(tmpdir(), "aeos-cli-task-state-init-"));
  const taskStateInitTraversalParentRoot = mkdtempSync(
    join(tmpdir(), "aeos-cli-task-state-init-traversal-"),
  );

  try {
    const initValidTaskPath = join(taskStateInitRoot, "valid-task.json");
    const initInvalidTaskPath = join(taskStateInitRoot, "invalid-task.json");
    const initInvalidJsonPath = join(taskStateInitRoot, "invalid-json.json");
    const initUnsafeIdPath = join(taskStateInitRoot, "unsafe-id.json");
    const initSelfReportPath = join(taskStateInitRoot, "self-report.json");
    const initExplicitWorkItemsPath = join(taskStateInitRoot, "explicit-work-items.json");
    const traversalInitChildRoot = join(taskStateInitTraversalParentRoot, "cwd");
    const traversalInitTaskPath = join(taskStateInitTraversalParentRoot, "outside.json");

    mkdirSync(traversalInitChildRoot);
    writeFileSync(
      initValidTaskPath,
      `${JSON.stringify(createValidTaskPlanContract("smoke-task-state-init"), null, 2)}\n`,
    );
    writeFileSync(
      initInvalidTaskPath,
      `${JSON.stringify(
        {
          ...createValidTaskPlanContract("smoke-task-state-invalid"),
          context: {
            load: [],
            doNotLoad: [],
          },
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(initInvalidJsonPath, "{ invalid json");
    writeFileSync(
      initUnsafeIdPath,
      `${JSON.stringify(createValidTaskPlanContract("../escape"), null, 2)}\n`,
    );
    writeFileSync(
      initSelfReportPath,
      `${JSON.stringify(
        {
          ...createValidTaskPlanContract("smoke-task-state-self-report"),
          purpose:
            "completed approved verified all done execution succeeded as task prose only",
          modelRecommendation: {
            purpose: "completed approved verified all done execution succeeded",
            requiredCapabilities: ["planning"],
            preferredExecutionMode: "planning",
            constraints: ["completed", "approved", "verified", "all done"],
          },
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      initExplicitWorkItemsPath,
      `${JSON.stringify(
        {
          ...createValidTaskPlanContract("smoke-task-state-explicit-work-items"),
          workItems: [{ id: "explicit-work-item", state: "pending" }],
          batches: [
            {
              id: "explicit-batch",
              workItemIds: ["explicit-work-item"],
              expectedItemCount: 1,
            },
          ],
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      traversalInitTaskPath,
      `${JSON.stringify(createValidTaskPlanContract("smoke-task-state-traversal"), null, 2)}\n`,
    );

    const initFilesBefore = listRelativeFiles(taskStateInitRoot);
    const initJson = runCliFrom(taskStateInitRoot, [
      "task",
      "state",
      "init",
      "valid-task.json",
      "--json",
    ]);
    expectExitCode("task state init --json exited nonzero", initJson, 0);
    const parsedInit = parseJsonOnlyStdout(
      "task state init --json output was not valid JSON only",
      initJson,
    );
    expectTaskStateInitSuccessJsonShape(
      "task state init --json shape was invalid",
      parsedInit,
      initJson,
    );
    if (
      parsedInit.taskId !== "smoke-task-state-init" ||
      parsedInit.revision !== 1 ||
      parsedInit.pending !== 1 ||
      parsedInit.retryable !== 0 ||
      parsedInit.statePath !== ".aeos/state/tasks/smoke-task-state-init.json"
    ) {
      fail("task state init --json did not expose expected initial state", initJson);
    }

    const expectedInitFiles = [
      ...initFilesBefore,
      ".aeos/state/tasks/smoke-task-state-init.json",
    ].sort();
    expectSameFiles(
      "task state init wrote outside expected state file",
      expectedInitFiles,
      listRelativeFiles(taskStateInitRoot),
    );

    const initializedStatePath = taskStatePath(
      taskStateInitRoot,
      "smoke-task-state-init",
    );
    if (!existsSync(initializedStatePath)) {
      fail("task state init did not create state in safe location", initJson);
    }

    const initializedState = JSON.parse(readFileSync(initializedStatePath, "utf8"));
    if (
      initializedState.lifecycleState !== "planned" ||
      initializedState.revision !== 1 ||
      initializedState.verifier.required !== true ||
      initializedState.verifier.completionGatedByVerifier !== true ||
      initializedState.completionGate.satisfied !== false ||
      initializedState.completionGate.completed !== false ||
      initializedState.completionGate.verified !== false ||
      initializedState.safety.executionPerformed !== false ||
      initializedState.safety.verifierRun !== false ||
      initializedState.safety.completed !== false ||
      initializedState.safety.verified !== false ||
      initializedState.workItems.length !== 1 ||
      initializedState.batches.length !== 1 ||
      initializedState.pendingWorkItemIds.length !== 1
    ) {
      fail("task state init persisted unsafe or incomplete planned state", initJson);
    }

    const initializedSnapshot = stateFileSnapshot(initializedStatePath);
    const initStatusJson = runCliFrom(taskStateInitRoot, [
      "task",
      "status",
      "smoke-task-state-init",
      "--json",
    ]);
    expectExitCode("task status after init --json exited nonzero", initStatusJson, 0);
    const parsedInitStatus = parseJsonOnlyStdout(
      "task status after init --json output was not valid JSON only",
      initStatusJson,
    );
    expectTaskStatusJsonShape(
      "task status after init --json shape was invalid",
      parsedInitStatus,
      initStatusJson,
    );
    if (
      parsedInitStatus.revision !== 1 ||
      parsedInitStatus.lifecycle !== "planned" ||
      parsedInitStatus.summary.pendingCount !== 1 ||
      parsedInitStatus.summary.verifierRequired !== true ||
      parsedInitStatus.summary.completionGatedByVerifier !== true
    ) {
      fail("task status after init did not read initialized state", initStatusJson);
    }
    expectStateFileSnapshotSame(
      "task status after init modified state",
      initializedStatePath,
      initializedSnapshot,
      initStatusJson,
    );

    const initResumePreviewJson = runCliFrom(taskStateInitRoot, [
      "task",
      "resume",
      "--preview",
      "smoke-task-state-init",
      "--json",
    ]);
    expectExitCode(
      "task resume preview after init --json exited nonzero",
      initResumePreviewJson,
      0,
    );
    const parsedInitResumePreview = parseJsonOnlyStdout(
      "task resume preview after init --json output was not valid JSON only",
      initResumePreviewJson,
    );
    expectTaskResumePreviewJsonShape(
      "task resume preview after init --json shape was invalid",
      parsedInitResumePreview,
      initResumePreviewJson,
    );
    if (
      parsedInitResumePreview.sourceRevision !== 1 ||
      parsedInitResumePreview.lifecycle !== "planned" ||
      parsedInitResumePreview.resume.allowed !== true ||
      parsedInitResumePreview.resume.remainingWorkCount !== 1 ||
      parsedInitResumePreview.resume.verifierRequired !== true ||
      parsedInitResumePreview.resume.completionGatedByVerifier !== true
    ) {
      fail(
        "task resume preview after init did not derive from initialized state",
        initResumePreviewJson,
      );
    }
    expectStateFileSnapshotSame(
      "task resume preview after init modified state",
      initializedStatePath,
      initializedSnapshot,
      initResumePreviewJson,
    );

    const repeatInitJson = runCliFrom(taskStateInitRoot, [
      "task",
      "state",
      "init",
      "valid-task.json",
      "--json",
    ]);
    expectNonzero("repeated task state init exited zero", repeatInitJson);
    const parsedRepeatInit = parseJsonOnlyStdout(
      "repeated task state init output was not valid JSON only",
      repeatInitJson,
    );
    expectTaskStateInitFailureJsonShape(
      "repeated task state init shape was invalid",
      parsedRepeatInit,
      "task_state_already_exists",
      repeatInitJson,
    );
    expectStateFileSnapshotSame(
      "repeated task state init overwrote existing state",
      initializedStatePath,
      initializedSnapshot,
      repeatInitJson,
    );

    const invalidTaskFilesBefore = listRelativeFiles(taskStateInitRoot);
    const invalidTaskInitJson = runCliFrom(taskStateInitRoot, [
      "task",
      "state",
      "init",
      "invalid-task.json",
      "--json",
    ]);
    expectNonzero("invalid task state init exited zero", invalidTaskInitJson);
    const parsedInvalidTaskInit = parseJsonOnlyStdout(
      "invalid task state init output was not valid JSON only",
      invalidTaskInitJson,
    );
    expectTaskStateInitFailureJsonShape(
      "invalid task state init shape was invalid",
      parsedInvalidTaskInit,
      "task_context_required",
      invalidTaskInitJson,
    );
    expectNoTaskStateCreated(
      "invalid task state init created state",
      taskStateInitRoot,
      "smoke-task-state-invalid",
      invalidTaskInitJson,
    );
    expectSameFiles(
      "invalid task state init changed files",
      invalidTaskFilesBefore,
      listRelativeFiles(taskStateInitRoot),
    );

    const invalidJsonFilesBefore = listRelativeFiles(taskStateInitRoot);
    const invalidJsonInitJson = runCliFrom(taskStateInitRoot, [
      "task",
      "state",
      "init",
      "invalid-json.json",
      "--json",
    ]);
    expectNonzero("invalid JSON task state init exited zero", invalidJsonInitJson);
    const parsedInvalidJsonInit = parseJsonOnlyStdout(
      "invalid JSON task state init output was not valid JSON only",
      invalidJsonInitJson,
    );
    expectTaskStateInitFailureJsonShape(
      "invalid JSON task state init shape was invalid",
      parsedInvalidJsonInit,
      "task_plan_input_invalid_json",
      invalidJsonInitJson,
    );
    expectSameFiles(
      "invalid JSON task state init changed files",
      invalidJsonFilesBefore,
      listRelativeFiles(taskStateInitRoot),
    );

    const unsafeIdFilesBefore = listRelativeFiles(taskStateInitRoot);
    const unsafeIdInitJson = runCliFrom(taskStateInitRoot, [
      "task",
      "state",
      "init",
      "unsafe-id.json",
      "--json",
    ]);
    expectNonzero("unsafe id task state init exited zero", unsafeIdInitJson);
    const parsedUnsafeIdInit = parseJsonOnlyStdout(
      "unsafe id task state init output was not valid JSON only",
      unsafeIdInitJson,
    );
    expectTaskStateInitFailureJsonShape(
      "unsafe id task state init shape was invalid",
      parsedUnsafeIdInit,
      "task_state_unsafe_task_id",
      unsafeIdInitJson,
    );
    expectSameFiles(
      "unsafe id task state init changed files",
      unsafeIdFilesBefore,
      listRelativeFiles(taskStateInitRoot),
    );

    const explicitInitFilesBefore = listRelativeFiles(taskStateInitRoot);
    const explicitInitJson = runCliFrom(taskStateInitRoot, [
      "task",
      "state",
      "init",
      "explicit-work-items.json",
      "--json",
    ]);
    expectNonzero("explicit workItems task state init exited zero", explicitInitJson);
    const parsedExplicitInit = parseJsonOnlyStdout(
      "explicit workItems task state init output was not valid JSON only",
      explicitInitJson,
    );
    expectTaskStateInitFailureJsonShape(
      "explicit workItems task state init shape was invalid",
      parsedExplicitInit,
      "task_contract_explicit_batches_unsupported",
      explicitInitJson,
    );
    if (
      !parsedExplicitInit.issues.some(
        (issue) => issue.code === "task_contract_explicit_work_items_unsupported",
      )
    ) {
      fail("explicit workItems task state init did not report workItems issue", explicitInitJson);
    }
    expectNoTaskStateCreated(
      "explicit workItems task state init created state",
      taskStateInitRoot,
      "smoke-task-state-explicit-work-items",
      explicitInitJson,
    );
    expectSameFiles(
      "explicit workItems task state init changed files",
      explicitInitFilesBefore,
      listRelativeFiles(taskStateInitRoot),
    );

    const selfReportInitJson = runCliFrom(taskStateInitRoot, [
      "task",
      "state",
      "init",
      "self-report.json",
      "--json",
    ]);
    expectExitCode("self-report task state init exited nonzero", selfReportInitJson, 0);
    const parsedSelfReportInit = parseJsonOnlyStdout(
      "self-report task state init output was not valid JSON only",
      selfReportInitJson,
    );
    expectTaskStateInitSuccessJsonShape(
      "self-report task state init shape was invalid",
      parsedSelfReportInit,
      selfReportInitJson,
    );
    const selfReportState = JSON.parse(
      readFileSync(
        taskStatePath(taskStateInitRoot, "smoke-task-state-self-report"),
        "utf8",
      ),
    );
    if (
      selfReportState.lifecycleState !== "planned" ||
      selfReportState.completionGate.satisfied !== false ||
      selfReportState.completionGate.completed !== false ||
      selfReportState.completionGate.verified !== false ||
      selfReportState.safety.completed !== false ||
      selfReportState.safety.verified !== false ||
      selfReportState.safety.approved !== false
    ) {
      fail("self-report task state init persisted terminal authority", selfReportInitJson);
    }

    const traversalInitFilesBefore = listRelativeFiles(taskStateInitTraversalParentRoot);
    const traversalInitJson = runCliFrom(traversalInitChildRoot, [
      "task",
      "state",
      "init",
      "../outside.json",
      "--json",
    ]);
    expectNonzero("task state init parent traversal exited zero", traversalInitJson);
    const parsedTraversalInit = parseJsonOnlyStdout(
      "task state init parent traversal output was not valid JSON only",
      traversalInitJson,
    );
    expectTaskStateInitFailureJsonShape(
      "task state init parent traversal shape was invalid",
      parsedTraversalInit,
      "task_plan_input_parent_traversal_disallowed",
      traversalInitJson,
    );
    expectSameFiles(
      "task state init parent traversal changed files",
      traversalInitFilesBefore,
      listRelativeFiles(taskStateInitTraversalParentRoot),
    );
  } finally {
    rmSync(taskStateInitRoot, { recursive: true, force: true });
    rmSync(taskStateInitTraversalParentRoot, { recursive: true, force: true });
  }

  const initRootSymlinkRoot = mkdtempSync(join(tmpdir(), "aeos-cli-task-state-init-root-symlink-"));
  const initRootSymlinkEscape = mkdtempSync(join(tmpdir(), "aeos-cli-task-state-init-root-escape-"));
  const initFileSymlinkRoot = mkdtempSync(join(tmpdir(), "aeos-cli-task-state-init-file-symlink-"));
  const initFileSymlinkEscape = mkdtempSync(join(tmpdir(), "aeos-cli-task-state-init-file-escape-"));

  try {
    writeFileSync(
      join(initRootSymlinkRoot, "valid-task.json"),
      `${JSON.stringify(createValidTaskPlanContract("smoke-task-state-root-symlink"), null, 2)}\n`,
    );
    mkdirSync(join(initRootSymlinkRoot, ".aeos", "state"), { recursive: true });
    symlinkSync(initRootSymlinkEscape, join(initRootSymlinkRoot, ".aeos", "state", "tasks"));
    const rootSymlinkBefore = listRelativeFiles(initRootSymlinkEscape);
    const rootSymlinkInitJson = runCliFrom(initRootSymlinkRoot, [
      "task",
      "state",
      "init",
      "valid-task.json",
      "--json",
    ]);
    expectNonzero("task state init state-root symlink exited zero", rootSymlinkInitJson);
    const parsedRootSymlinkInit = parseJsonOnlyStdout(
      "task state init state-root symlink output was not valid JSON only",
      rootSymlinkInitJson,
    );
    expectTaskStateInitFailureJsonShape(
      "task state init state-root symlink shape was invalid",
      parsedRootSymlinkInit,
      "task_state_unsafe_state_root",
      rootSymlinkInitJson,
    );
    expectSameFiles(
      "task state init wrote through state-root symlink",
      rootSymlinkBefore,
      listRelativeFiles(initRootSymlinkEscape),
    );

    writeFileSync(
      join(initFileSymlinkRoot, "valid-task.json"),
      `${JSON.stringify(createValidTaskPlanContract("smoke-task-state-file-symlink"), null, 2)}\n`,
    );
    mkdirSync(join(initFileSymlinkRoot, ".aeos", "state", "tasks"), { recursive: true });
    writeFileSync(join(initFileSymlinkEscape, "escaped.json"), "{}\n");
    symlinkSync(
      join(initFileSymlinkEscape, "escaped.json"),
      taskStatePath(initFileSymlinkRoot, "smoke-task-state-file-symlink"),
    );
    const fileSymlinkBefore = readFileSync(join(initFileSymlinkEscape, "escaped.json"), "utf8");
    const fileSymlinkInitJson = runCliFrom(initFileSymlinkRoot, [
      "task",
      "state",
      "init",
      "valid-task.json",
      "--json",
    ]);
    expectNonzero("task state init state-file symlink exited zero", fileSymlinkInitJson);
    const parsedFileSymlinkInit = parseJsonOnlyStdout(
      "task state init state-file symlink output was not valid JSON only",
      fileSymlinkInitJson,
    );
    expectTaskStateInitFailureJsonShape(
      "task state init state-file symlink shape was invalid",
      parsedFileSymlinkInit,
      "task_state_unsafe_target",
      fileSymlinkInitJson,
    );
    if (readFileSync(join(initFileSymlinkEscape, "escaped.json"), "utf8") !== fileSymlinkBefore) {
      fail("task state init modified state-file symlink target", fileSymlinkInitJson);
    }
  } finally {
    rmSync(initRootSymlinkRoot, { recursive: true, force: true });
    rmSync(initRootSymlinkEscape, { recursive: true, force: true });
    rmSync(initFileSymlinkRoot, { recursive: true, force: true });
    rmSync(initFileSymlinkEscape, { recursive: true, force: true });
  }
} finally {
  rmSync(taskPlanNoWriteRoot, { recursive: true, force: true });
  rmSync(taskPlanTraversalParentRoot, { recursive: true, force: true });
}

const taskStateCliRoot = mkdtempSync(join(tmpdir(), "aeos-cli-task-state-"));

try {
  const statusTaskId = "TASK-STATUS-SMOKE";
  const statusStatePath = await savePersistedTaskState(
    taskStateCliRoot,
    createPersistedTaskState(statusTaskId),
  );
  const statusSnapshotBefore = stateFileSnapshot(statusStatePath);

  const taskStatus = runCliFrom(taskStateCliRoot, [
    "task",
    "status",
    statusTaskId,
  ]);
  expectExitCode("task status exited nonzero", taskStatus, 0);
  for (const expectedText of [
    "Task Status",
    "Task id: TASK-STATUS-SMOKE",
    "Revision: 1",
    "Lifecycle: planned",
    "Work items: 2",
    "Batches: 1",
    "Pending: 1",
    "Retryable: 1",
    "Current batch: batch-main",
    "Next batch: batch-main",
    "Verifier required: true",
    "Completion gated by verifier: true",
    "Resume available: true",
    "Authoritative persisted state: true",
    "Execution performed: false",
    "State modified: false",
  ]) {
    expectOutputIncludes(
      `task status human output missing ${expectedText}`,
      taskStatus,
      expectedText,
    );
  }
  expectStateFileSnapshotSame(
    "task status modified persisted state",
    statusStatePath,
    statusSnapshotBefore,
    taskStatus,
  );

  const taskStatusJson = runCliFrom(taskStateCliRoot, [
    "task",
    "status",
    statusTaskId,
    "--json",
  ]);
  expectExitCode("task status --json exited nonzero", taskStatusJson, 0);
  const parsedTaskStatusJson = parseJsonOnlyStdout(
    "task status --json output was not valid JSON only",
    taskStatusJson,
  );
  expectTaskStatusJsonShape(
    "task status --json shape was invalid",
    parsedTaskStatusJson,
    taskStatusJson,
  );
  if (
    parsedTaskStatusJson.taskId !== statusTaskId ||
    parsedTaskStatusJson.revision !== 1 ||
    parsedTaskStatusJson.lifecycle !== "planned" ||
    parsedTaskStatusJson.summary.workItemCount !== 2 ||
    parsedTaskStatusJson.summary.batchCount !== 1 ||
    parsedTaskStatusJson.summary.pendingCount !== 1 ||
    parsedTaskStatusJson.summary.retryableCount !== 1 ||
    parsedTaskStatusJson.summary.currentBatchId !== "batch-main" ||
    parsedTaskStatusJson.summary.nextBatchId !== "batch-main" ||
    parsedTaskStatusJson.summary.resumeAvailable !== true ||
    parsedTaskStatusJson.issues.length !== 0
  ) {
    fail("task status --json did not expose authoritative state", taskStatusJson);
  }
  expectStateFileSnapshotSame(
    "task status --json modified persisted state",
    statusStatePath,
    statusSnapshotBefore,
    taskStatusJson,
  );

  const taskResumePreview = runCliFrom(taskStateCliRoot, [
    "task",
    "resume",
    "--preview",
    statusTaskId,
  ]);
  expectExitCode("task resume --preview exited nonzero", taskResumePreview, 0);
  for (const expectedText of [
    "Task Resume Preview",
    "Task id: TASK-STATUS-SMOKE",
    "Source revision: 1",
    "Lifecycle: planned",
    "Resume allowed: true",
    "Pending: 1",
    "Retryable: 1",
    "Remaining work: 2",
    "Current batch: batch-main",
    "Next batch: batch-main",
    "Verifier required: true",
    "Completion gated by verifier: true",
    "No execution: true",
    "No writes: true",
  ]) {
    expectOutputIncludes(
      `task resume preview human output missing ${expectedText}`,
      taskResumePreview,
      expectedText,
    );
  }
  expectStateFileSnapshotSame(
    "task resume --preview modified persisted state",
    statusStatePath,
    statusSnapshotBefore,
    taskResumePreview,
  );

  const taskResumePreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "resume",
    "--preview",
    statusTaskId,
    "--json",
  ]);
  expectExitCode(
    "task resume --preview --json exited nonzero",
    taskResumePreviewJson,
    0,
  );
  const parsedTaskResumePreviewJson = parseJsonOnlyStdout(
    "task resume --preview --json output was not valid JSON only",
    taskResumePreviewJson,
  );
  expectTaskResumePreviewJsonShape(
    "task resume --preview --json shape was invalid",
    parsedTaskResumePreviewJson,
    taskResumePreviewJson,
  );
  if (
    parsedTaskResumePreviewJson.taskId !== statusTaskId ||
    parsedTaskResumePreviewJson.sourceRevision !== 1 ||
    parsedTaskResumePreviewJson.resume.allowed !== true ||
    parsedTaskResumePreviewJson.resume.remainingWorkCount !== 2 ||
    parsedTaskResumePreviewJson.resume.currentBatchId !== "batch-main" ||
    parsedTaskResumePreviewJson.resume.nextBatchId !== "batch-main" ||
    parsedTaskResumePreviewJson.resume.pendingWorkItemIds.join(",") !==
      "work-pending" ||
    parsedTaskResumePreviewJson.resume.retryableWorkItemIds.join(",") !==
      "work-retryable" ||
    parsedTaskResumePreviewJson.issues.length !== 0
  ) {
    fail(
      "task resume --preview --json did not expose authoritative handoff",
      taskResumePreviewJson,
    );
  }
  expectStateFileSnapshotSame(
    "task resume --preview --json modified persisted state",
    statusStatePath,
    statusSnapshotBefore,
    taskResumePreviewJson,
  );

  const repeatedTaskResumePreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "resume",
    "--preview",
    statusTaskId,
    "--json",
  ]);
  expectExitCode(
    "repeated task resume --preview --json exited nonzero",
    repeatedTaskResumePreviewJson,
    0,
  );
  if (repeatedTaskResumePreviewJson.stdout !== taskResumePreviewJson.stdout) {
    fail(
      "repeated task resume --preview --json was not equivalent",
      repeatedTaskResumePreviewJson,
    );
  }

  const executionPreviewFilesBefore = listRelativeFiles(taskStateCliRoot);
  const executionPreviewSnapshotBefore = executionSnapshot(taskStateCliRoot);
  const taskExecutionPreparationPreview = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "prepare",
    "--preview",
    statusTaskId,
    "--expected-revision",
    "1",
  ]);
  expectExitCode(
    "task execution preparation preview exited nonzero",
    taskExecutionPreparationPreview,
    0,
  );
  for (const expectedText of [
    "Task Execution Preparation Preview",
    "Task id: TASK-STATUS-SMOKE",
    "Task revision: 1",
    "Attempt id: attempt-TASK-STATUS-SMOKE-r1-n1-",
    "Attempt number: 1",
    "Lifecycle: prepared",
    "Work item: none",
    "Batch: batch-main",
    "Retryable: false",
    "Verifier required: true",
    "Policy required: false",
    "Preparation allowed: true",
    "Persist attempt: false",
    "Execution performed: false",
    "Adapter calls: false",
    "Audit writes: false",
    "Verifier run: false",
    "Policy run: false",
    "Task state modified: false",
    "Work completed: false",
    "Task completed: false",
  ]) {
    expectOutputIncludes(
      `task execution preparation preview human output missing ${expectedText}`,
      taskExecutionPreparationPreview,
      expectedText,
    );
  }
  expectStateFileSnapshotSame(
    "task execution preparation preview modified state",
    statusStatePath,
    statusSnapshotBefore,
    taskExecutionPreparationPreview,
  );
  expectExecutionSnapshotSame(
    "task execution preparation preview created execution files",
    taskStateCliRoot,
    executionPreviewSnapshotBefore,
    taskExecutionPreparationPreview,
  );
  expectSameFiles(
    "task execution preparation preview created unexpected files",
    executionPreviewFilesBefore,
    listRelativeFiles(taskStateCliRoot),
  );

  const taskExecutionPreparationPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "prepare",
    "--preview",
    statusTaskId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode(
    "task execution preparation preview --json exited nonzero",
    taskExecutionPreparationPreviewJson,
    0,
  );
  const parsedTaskExecutionPreparationPreviewJson = parseJsonOnlyStdout(
    "task execution preparation preview --json output was not valid JSON only",
    taskExecutionPreparationPreviewJson,
  );
  expectTaskExecutionPreparationPreviewJsonShape(
    "task execution preparation preview --json shape was invalid",
    parsedTaskExecutionPreparationPreviewJson,
    taskExecutionPreparationPreviewJson,
  );
  if (
    parsedTaskExecutionPreparationPreviewJson.taskId !== statusTaskId ||
    parsedTaskExecutionPreparationPreviewJson.sourceRevision !== 1 ||
    parsedTaskExecutionPreparationPreviewJson.expectedRevision !== 1 ||
    !parsedTaskExecutionPreparationPreviewJson.attempt.attemptId.startsWith(
      "attempt-TASK-STATUS-SMOKE-r1-n1-",
    ) ||
    parsedTaskExecutionPreparationPreviewJson.attempt.attemptNumber !== 1 ||
    parsedTaskExecutionPreparationPreviewJson.attempt.workItemId !== null ||
    parsedTaskExecutionPreparationPreviewJson.attempt.batchId !== "batch-main" ||
    parsedTaskExecutionPreparationPreviewJson.retryable !== false ||
    parsedTaskExecutionPreparationPreviewJson.verifierRequired !== true ||
    parsedTaskExecutionPreparationPreviewJson.policyRequired !== false ||
    parsedTaskExecutionPreparationPreviewJson.issues.length !== 0
  ) {
    fail(
      "task execution preparation preview --json did not expose authoritative attempt",
      taskExecutionPreparationPreviewJson,
    );
  }
  expectStateFileSnapshotSame(
    "task execution preparation preview --json modified state",
    statusStatePath,
    statusSnapshotBefore,
    taskExecutionPreparationPreviewJson,
  );
  expectExecutionSnapshotSame(
    "task execution preparation preview --json created execution files",
    taskStateCliRoot,
    executionPreviewSnapshotBefore,
    taskExecutionPreparationPreviewJson,
  );

  const repeatedTaskExecutionPreparationPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "prepare",
    "--preview",
    statusTaskId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode(
    "repeated task execution preparation preview --json exited nonzero",
    repeatedTaskExecutionPreparationPreviewJson,
    0,
  );
  if (
    repeatedTaskExecutionPreparationPreviewJson.stdout !==
    taskExecutionPreparationPreviewJson.stdout
  ) {
    fail(
      "repeated task execution preparation preview --json was not deterministic",
      repeatedTaskExecutionPreparationPreviewJson,
    );
  }

  const workSelectedExecutionPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "prepare",
    "--preview",
    statusTaskId,
    "--expected-revision",
    "1",
    "--work-item",
    "work-pending",
    "--batch",
    "batch-main",
    "--json",
  ]);
  expectExitCode(
    "task execution preparation work selector --json exited nonzero",
    workSelectedExecutionPreviewJson,
    0,
  );
  const parsedWorkSelectedExecutionPreviewJson = parseJsonOnlyStdout(
    "task execution preparation work selector --json output was not valid JSON only",
    workSelectedExecutionPreviewJson,
  );
  expectTaskExecutionPreparationPreviewJsonShape(
    "task execution preparation work selector shape was invalid",
    parsedWorkSelectedExecutionPreviewJson,
    workSelectedExecutionPreviewJson,
  );
  if (
    parsedWorkSelectedExecutionPreviewJson.attempt.workItemId !== "work-pending" ||
    parsedWorkSelectedExecutionPreviewJson.attempt.batchId !== "batch-main"
  ) {
    fail(
      "task execution preparation work selector did not bind selected work and batch",
      workSelectedExecutionPreviewJson,
    );
  }

  const unknownWorkExecutionPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "prepare",
    "--preview",
    statusTaskId,
    "--expected-revision",
    "1",
    "--work-item",
    "missing-work",
    "--json",
  ]);
  expectNonzero("task execution preparation unknown work exited zero", unknownWorkExecutionPreviewJson);
  const parsedUnknownWorkExecutionPreviewJson = parseJsonOnlyStdout(
    "task execution preparation unknown work output was not valid JSON only",
    unknownWorkExecutionPreviewJson,
  );
  expectTaskExecutionPreparationErrorJsonShape(
    "task execution preparation unknown work did not fail closed",
    parsedUnknownWorkExecutionPreviewJson,
    "task_execution_attempt_unknown_work_item",
    unknownWorkExecutionPreviewJson,
  );

  const mismatchedBatchExecutionPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "prepare",
    "--preview",
    statusTaskId,
    "--expected-revision",
    "1",
    "--work-item",
    "work-pending",
    "--batch",
    "missing-batch",
    "--json",
  ]);
  expectNonzero("task execution preparation mismatched batch exited zero", mismatchedBatchExecutionPreviewJson);
  const parsedMismatchedBatchExecutionPreviewJson = parseJsonOnlyStdout(
    "task execution preparation mismatched batch output was not valid JSON only",
    mismatchedBatchExecutionPreviewJson,
  );
  expectTaskExecutionPreparationErrorJsonShape(
    "task execution preparation mismatched batch did not fail closed",
    parsedMismatchedBatchExecutionPreviewJson,
    "task_execution_attempt_work_batch_mismatch",
    mismatchedBatchExecutionPreviewJson,
  );

  const staleExecutionPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "prepare",
    "--preview",
    statusTaskId,
    "--expected-revision",
    "2",
    "--json",
  ]);
  expectNonzero("task execution preparation stale revision exited zero", staleExecutionPreviewJson);
  const parsedStaleExecutionPreviewJson = parseJsonOnlyStdout(
    "task execution preparation stale revision output was not valid JSON only",
    staleExecutionPreviewJson,
  );
  expectTaskExecutionPreparationErrorJsonShape(
    "task execution preparation stale revision did not fail closed",
    parsedStaleExecutionPreviewJson,
    "task_state_revision_conflict",
    staleExecutionPreviewJson,
  );
  expectStateFileSnapshotSame(
    "task execution preparation stale revision modified state",
    statusStatePath,
    statusSnapshotBefore,
    staleExecutionPreviewJson,
  );

  const missingRevisionExecutionPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "prepare",
    "--preview",
    statusTaskId,
    "--json",
  ]);
  expectNonzero("task execution preparation missing revision exited zero", missingRevisionExecutionPreviewJson);
  const parsedMissingRevisionExecutionPreviewJson = parseJsonOnlyStdout(
    "task execution preparation missing revision output was not valid JSON only",
    missingRevisionExecutionPreviewJson,
  );
  expectTaskExecutionPreparationErrorJsonShape(
    "task execution preparation missing revision did not fail closed",
    parsedMissingRevisionExecutionPreviewJson,
    "task_execution_prepare_expected_revision_required",
    missingRevisionExecutionPreviewJson,
  );
  const missingRevisionExecutionApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "prepare",
    statusTaskId,
    "--json",
  ]);
  expectNonzero("task execution preparation apply missing revision exited zero", missingRevisionExecutionApplyJson);
  const parsedMissingRevisionExecutionApplyJson = parseJsonOnlyStdout(
    "task execution preparation apply missing revision output was not valid JSON only",
    missingRevisionExecutionApplyJson,
  );
  expectTaskExecutionPreparationApplyErrorJsonShape(
    "task execution preparation apply missing revision did not fail closed",
    parsedMissingRevisionExecutionApplyJson,
    "task_execution_prepare_expected_revision_required",
    missingRevisionExecutionApplyJson,
  );

  for (const malformedRevision of ["0", "-1", "1.5", "abc"]) {
    const malformedExecutionPreviewJson = runCliFrom(taskStateCliRoot, [
      "task",
      "execution",
      "prepare",
      "--preview",
      statusTaskId,
      "--expected-revision",
      malformedRevision,
      "--json",
    ]);
    expectNonzero(
      `task execution preparation malformed revision ${malformedRevision} exited zero`,
      malformedExecutionPreviewJson,
    );
    const parsedMalformedExecutionPreviewJson = parseJsonOnlyStdout(
      `task execution preparation malformed revision ${malformedRevision} output was not valid JSON only`,
      malformedExecutionPreviewJson,
    );
    expectTaskExecutionPreparationErrorJsonShape(
      `task execution preparation malformed revision ${malformedRevision} did not fail closed`,
      parsedMalformedExecutionPreviewJson,
      "task_execution_prepare_expected_revision_invalid",
      malformedExecutionPreviewJson,
    );

    const malformedExecutionApplyJson = runCliFrom(taskStateCliRoot, [
      "task",
      "execution",
      "prepare",
      statusTaskId,
      "--expected-revision",
      malformedRevision,
      "--json",
    ]);
    expectNonzero(
      `task execution preparation apply malformed revision ${malformedRevision} exited zero`,
      malformedExecutionApplyJson,
    );
    const parsedMalformedExecutionApplyJson = parseJsonOnlyStdout(
      `task execution preparation apply malformed revision ${malformedRevision} output was not valid JSON only`,
      malformedExecutionApplyJson,
    );
    expectTaskExecutionPreparationApplyErrorJsonShape(
      `task execution preparation apply malformed revision ${malformedRevision} did not fail closed`,
      parsedMalformedExecutionApplyJson,
      "task_execution_prepare_expected_revision_invalid",
      malformedExecutionApplyJson,
    );
  }

  for (const [flag, value, expectedCode] of [
    ["--attempt-id", "operator-attempt", "task_execution_prepare_attempt_id_forbidden"],
    ["--attempt-number", "7", "task_execution_prepare_attempt_number_forbidden"],
    ["--retryable", "true", "task_execution_prepare_failure_authority_forbidden"],
    ["--failure-code", "model-failure", "task_execution_prepare_failure_authority_forbidden"],
    ["--lifecycle", "completed", "task_execution_prepare_lifecycle_authority_forbidden"],
    ["--force", undefined, "task_execution_prepare_force_forbidden"],
  ]) {
    const authorityArgs = [
      "task",
      "execution",
      "prepare",
      "--preview",
      statusTaskId,
      "--expected-revision",
      "1",
      flag,
    ];
    if (value !== undefined) {
      authorityArgs.push(value);
    }
    authorityArgs.push("--json");
    const authorityPreviewJson = runCliFrom(taskStateCliRoot, authorityArgs);
    expectNonzero(`task execution preparation forbidden ${flag} exited zero`, authorityPreviewJson);
    const parsedAuthorityPreviewJson = parseJsonOnlyStdout(
      `task execution preparation forbidden ${flag} output was not valid JSON only`,
      authorityPreviewJson,
    );
    expectTaskExecutionPreparationErrorJsonShape(
      `task execution preparation forbidden ${flag} did not fail closed`,
      parsedAuthorityPreviewJson,
      expectedCode,
      authorityPreviewJson,
    );

    const authorityApplyArgs = [
      "task",
      "execution",
      "prepare",
      statusTaskId,
      "--expected-revision",
      "1",
      flag,
    ];
    if (value !== undefined) {
      authorityApplyArgs.push(value);
    }
    authorityApplyArgs.push("--json");
    const authorityApplyJson = runCliFrom(taskStateCliRoot, authorityApplyArgs);
    expectNonzero(`task execution preparation apply forbidden ${flag} exited zero`, authorityApplyJson);
    const parsedAuthorityApplyJson = parseJsonOnlyStdout(
      `task execution preparation apply forbidden ${flag} output was not valid JSON only`,
      authorityApplyJson,
    );
    expectTaskExecutionPreparationApplyErrorJsonShape(
      `task execution preparation apply forbidden ${flag} did not fail closed`,
      parsedAuthorityApplyJson,
      expectedCode,
      authorityApplyJson,
    );
  }

  const applySnapshotBefore = stateFileSnapshot(statusStatePath);
  const applyExecutionSnapshotBefore = executionSnapshot(taskStateCliRoot);
  const executionPrepareApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "prepare",
    statusTaskId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode("task execution preparation apply exited nonzero", executionPrepareApplyJson, 0);
  const parsedExecutionPrepareApplyJson = parseJsonOnlyStdout(
    "task execution preparation apply output was not valid JSON only",
    executionPrepareApplyJson,
  );
  expectTaskExecutionPreparationApplyJsonShape(
    "task execution preparation apply shape was invalid",
    parsedExecutionPrepareApplyJson,
    executionPrepareApplyJson,
  );
  if (
    parsedExecutionPrepareApplyJson.taskId !== statusTaskId ||
    parsedExecutionPrepareApplyJson.sourceRevision !== 1 ||
    !parsedExecutionPrepareApplyJson.attempt.attemptId.startsWith(
      "attempt-TASK-STATUS-SMOKE-r1-n1-",
    ) ||
    parsedExecutionPrepareApplyJson.attempt.attemptNumber !== 1 ||
    parsedExecutionPrepareApplyJson.attempt.lifecycle !== "prepared" ||
    parsedExecutionPrepareApplyJson.attempt.workItemId !== null ||
    parsedExecutionPrepareApplyJson.attempt.batchId !== "batch-main"
  ) {
    fail(
      "task execution preparation apply did not expose persisted authoritative attempt",
      executionPrepareApplyJson,
    );
  }
  const persistedAttemptPath = join(
    taskStateCliRoot,
    ".aeos",
    "state",
    "executions",
    statusTaskId,
    `${parsedExecutionPrepareApplyJson.attempt.attemptId}.json`,
  );
  if (!existsSync(persistedAttemptPath)) {
    fail("task execution preparation apply did not persist at expected location", executionPrepareApplyJson);
  }
  const persistedAttempt = JSON.parse(readFileSync(persistedAttemptPath, "utf8"));
  if (
    persistedAttempt.attemptId !== parsedExecutionPrepareApplyJson.attempt.attemptId ||
    persistedAttempt.taskId !== statusTaskId ||
    persistedAttempt.taskStateRevision !== 1 ||
    persistedAttempt.attemptNumber !== 1 ||
    persistedAttempt.lifecycle !== "prepared" ||
    persistedAttempt.batchId !== "batch-main" ||
    persistedAttempt.events.length !== 1 ||
    persistedAttempt.events[0]?.kind !== "attempt_prepared" ||
    persistedAttempt.safety.executionPerformed !== false ||
    persistedAttempt.safety.adapterCalls !== false ||
    persistedAttempt.safety.auditWrites !== false ||
    persistedAttempt.safety.verifierRun !== false ||
    persistedAttempt.safety.completedStateCreated !== false ||
    persistedAttempt.safety.verifiedStateCreated !== false
  ) {
    fail("task execution preparation apply persisted unsafe attempt", executionPrepareApplyJson);
  }
  expectStateFileSnapshotSame(
    "task execution preparation apply modified state",
    statusStatePath,
    applySnapshotBefore,
    executionPrepareApplyJson,
  );
  const applyExecutionSnapshotAfter = executionSnapshot(taskStateCliRoot);
  if (
    applyExecutionSnapshotAfter.files.length !==
      applyExecutionSnapshotBefore.files.length + 1 ||
    !applyExecutionSnapshotAfter.files.includes(
      `${statusTaskId}/${parsedExecutionPrepareApplyJson.attempt.attemptId}.json`,
    )
  ) {
    fail("task execution preparation apply did not create exactly one attempt file", executionPrepareApplyJson);
  }

  const previewAfterPersistedAttemptJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "prepare",
    "--preview",
    statusTaskId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode(
    "task execution preparation preview after persisted attempt exited nonzero",
    previewAfterPersistedAttemptJson,
    0,
  );
  const parsedPreviewAfterPersistedAttemptJson = parseJsonOnlyStdout(
    "task execution preparation preview after persisted attempt output was not valid JSON only",
    previewAfterPersistedAttemptJson,
  );
  expectTaskExecutionPreparationPreviewJsonShape(
    "task execution preparation preview after persisted attempt shape was invalid",
    parsedPreviewAfterPersistedAttemptJson,
    previewAfterPersistedAttemptJson,
  );
  if (
    parsedPreviewAfterPersistedAttemptJson.attempt.attemptNumber !== 2 ||
    !parsedPreviewAfterPersistedAttemptJson.attempt.attemptId.startsWith(
      "attempt-TASK-STATUS-SMOKE-r1-n2-",
    )
  ) {
    fail(
      "task execution preparation preview after persisted attempt did not expose next authority",
      previewAfterPersistedAttemptJson,
    );
  }
  expectStateFileSnapshotSame(
    "task execution preparation preview after persisted attempt modified state",
    statusStatePath,
    applySnapshotBefore,
    previewAfterPersistedAttemptJson,
  );
  expectExecutionSnapshotSame(
    "task execution preparation preview after persisted attempt changed execution files",
    taskStateCliRoot,
    applyExecutionSnapshotAfter,
    previewAfterPersistedAttemptJson,
  );

  const startPreviewSnapshotBefore = stateFileSnapshot(statusStatePath);
  const startPreviewExecutionSnapshotBefore = executionSnapshot(taskStateCliRoot);
  const taskExecutionStartPreview = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "start",
    "--preview",
    statusTaskId,
    "--attempt-id",
    parsedExecutionPrepareApplyJson.attempt.attemptId,
    "--expected-revision",
    "1",
  ]);
  expectExitCode("task execution start preview exited nonzero", taskExecutionStartPreview, 0);
  for (const expectedText of [
    "Task Execution Start Preview",
    "Task id: TASK-STATUS-SMOKE",
    `Attempt id: ${parsedExecutionPrepareApplyJson.attempt.attemptId}`,
    "Attempt number: 1",
    "Attempt lifecycle: prepared",
    "Source revision: 1",
    "Current task revision: 1",
    "Work item: none",
    "Batch: batch-main",
    "Start allowed: true",
    "Policy required: false",
    "Policy authorized: true",
    "Verifier required: true",
    "Completion gated by verifier: true",
    "Attempt started: false",
    "Execution performed: false",
    "Adapter calls: false",
    "Audit writes: false",
    "Verifier run: false",
    "Task state modified: false",
    "Attempt modified: false",
    "Work completed: false",
    "Task completed: false",
  ]) {
    expectOutputIncludes(
      `task execution start preview human output missing ${expectedText}`,
      taskExecutionStartPreview,
      expectedText,
    );
  }
  expectStateFileSnapshotSame(
    "task execution start preview modified state",
    statusStatePath,
    startPreviewSnapshotBefore,
    taskExecutionStartPreview,
  );
  expectExecutionSnapshotSame(
    "task execution start preview changed execution files",
    taskStateCliRoot,
    startPreviewExecutionSnapshotBefore,
    taskExecutionStartPreview,
  );

  const taskExecutionStartPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "start",
    "--preview",
    statusTaskId,
    "--attempt-id",
    parsedExecutionPrepareApplyJson.attempt.attemptId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode("task execution start preview --json exited nonzero", taskExecutionStartPreviewJson, 0);
  const parsedTaskExecutionStartPreviewJson = parseJsonOnlyStdout(
    "task execution start preview --json output was not valid JSON only",
    taskExecutionStartPreviewJson,
  );
  expectTaskExecutionStartPreviewJsonShape(
    "task execution start preview --json shape was invalid",
    parsedTaskExecutionStartPreviewJson,
    taskExecutionStartPreviewJson,
  );
  if (
    parsedTaskExecutionStartPreviewJson.taskId !== statusTaskId ||
    parsedTaskExecutionStartPreviewJson.attemptId !==
      parsedExecutionPrepareApplyJson.attempt.attemptId ||
    parsedTaskExecutionStartPreviewJson.startAllowed !== true ||
    parsedTaskExecutionStartPreviewJson.authorization.sourceRevision !== 1 ||
    parsedTaskExecutionStartPreviewJson.authorization.currentTaskRevision !== 1 ||
    parsedTaskExecutionStartPreviewJson.authorization.policyStatus !== "not_required" ||
    parsedTaskExecutionStartPreviewJson.authorization.issues.length !== 0 ||
    parsedTaskExecutionStartPreviewJson.issues.length !== 0
  ) {
    fail(
      "task execution start preview --json did not expose authoritative authorization",
      taskExecutionStartPreviewJson,
    );
  }
  expectStateFileSnapshotSame(
    "task execution start preview --json modified state",
    statusStatePath,
    startPreviewSnapshotBefore,
    taskExecutionStartPreviewJson,
  );
  expectExecutionSnapshotSame(
    "task execution start preview --json changed execution files",
    taskStateCliRoot,
    startPreviewExecutionSnapshotBefore,
    taskExecutionStartPreviewJson,
  );

  const repeatedTaskExecutionStartPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "start",
    "--preview",
    statusTaskId,
    "--attempt-id",
    parsedExecutionPrepareApplyJson.attempt.attemptId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode(
    "repeated task execution start preview --json exited nonzero",
    repeatedTaskExecutionStartPreviewJson,
    0,
  );
  if (repeatedTaskExecutionStartPreviewJson.stdout !== taskExecutionStartPreviewJson.stdout) {
    fail(
      "repeated task execution start preview --json was not deterministic",
      repeatedTaskExecutionStartPreviewJson,
    );
  }

  const missingAttemptStartPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "start",
    "--preview",
    statusTaskId,
    "--attempt-id",
    "attempt-missing",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution start missing attempt exited zero", missingAttemptStartPreviewJson);
  const parsedMissingAttemptStartPreviewJson = parseJsonOnlyStdout(
    "task execution start missing attempt output was not valid JSON only",
    missingAttemptStartPreviewJson,
  );
  expectTaskExecutionStartPreviewErrorJsonShape(
    "task execution start missing attempt did not fail closed",
    parsedMissingAttemptStartPreviewJson,
    "task_execution_attempt_not_found",
    missingAttemptStartPreviewJson,
  );

  const wrongRevisionStartPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "start",
    "--preview",
    statusTaskId,
    "--attempt-id",
    parsedExecutionPrepareApplyJson.attempt.attemptId,
    "--expected-revision",
    "2",
    "--json",
  ]);
  expectNonzero("task execution start wrong revision exited zero", wrongRevisionStartPreviewJson);
  const parsedWrongRevisionStartPreviewJson = parseJsonOnlyStdout(
    "task execution start wrong revision output was not valid JSON only",
    wrongRevisionStartPreviewJson,
  );
  expectTaskExecutionStartPreviewErrorJsonShape(
    "task execution start wrong revision did not fail closed",
    parsedWrongRevisionStartPreviewJson,
    "task_execution_start_expected_revision_mismatch",
    wrongRevisionStartPreviewJson,
  );
  expectStateFileSnapshotSame(
    "task execution start wrong revision modified state",
    statusStatePath,
    startPreviewSnapshotBefore,
    wrongRevisionStartPreviewJson,
  );
  expectExecutionSnapshotSame(
    "task execution start wrong revision changed execution files",
    taskStateCliRoot,
    startPreviewExecutionSnapshotBefore,
    wrongRevisionStartPreviewJson,
  );

  const startApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "start",
    statusTaskId,
    "--attempt-id",
    parsedExecutionPrepareApplyJson.attempt.attemptId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode("task execution start apply exited nonzero", startApplyJson, 0);
  const parsedStartApplyJson = parseJsonOnlyStdout(
    "task execution start apply output was not valid JSON only",
    startApplyJson,
  );
  expectTaskExecutionStartApplyJsonShape(
    "task execution start apply shape was invalid",
    parsedStartApplyJson,
    startApplyJson,
  );
  if (
    parsedStartApplyJson.taskId !== statusTaskId ||
    parsedStartApplyJson.attemptId !== parsedExecutionPrepareApplyJson.attempt.attemptId ||
    parsedStartApplyJson.sourceRevision !== 1 ||
    parsedStartApplyJson.attemptNumber !== 1 ||
    parsedStartApplyJson.workItemId !== null ||
    parsedStartApplyJson.batchId !== "batch-main" ||
    parsedStartApplyJson.authorization.sourceRevision !== 1 ||
    parsedStartApplyJson.authorization.currentTaskRevision !== 1
  ) {
    fail("task execution start apply did not expose authoritative started attempt", startApplyJson);
  }
  expectStateFileSnapshotSame(
    "task execution start apply modified state",
    statusStatePath,
    startPreviewSnapshotBefore,
    startApplyJson,
  );
  const persistedStartedAttempt = JSON.parse(readFileSync(persistedAttemptPath, "utf8"));
  if (
    persistedStartedAttempt.attemptId !== parsedExecutionPrepareApplyJson.attempt.attemptId ||
    persistedStartedAttempt.taskId !== statusTaskId ||
    persistedStartedAttempt.taskStateRevision !== 1 ||
    persistedStartedAttempt.attemptNumber !== 1 ||
    persistedStartedAttempt.lifecycle !== "started" ||
    persistedStartedAttempt.batchId !== "batch-main" ||
    persistedStartedAttempt.events.length !== 2 ||
    persistedStartedAttempt.events[0]?.kind !== "attempt_prepared" ||
    persistedStartedAttempt.events[1]?.kind !== "attempt_started" ||
    persistedStartedAttempt.noExecution !== true ||
    persistedStartedAttempt.safety.executionPerformed !== false ||
    persistedStartedAttempt.safety.adapterCalls !== false ||
    persistedStartedAttempt.safety.auditWrites !== false ||
    persistedStartedAttempt.safety.verifierRun !== false ||
    persistedStartedAttempt.safety.completedStateCreated !== false ||
    persistedStartedAttempt.safety.verifiedStateCreated !== false
  ) {
    fail("task execution start apply persisted unsafe started attempt", startApplyJson);
  }
  const statusStateAfterStartApply = JSON.parse(readFileSync(statusStatePath, "utf8"));
  if (
    statusStateAfterStartApply.revision !== 1 ||
    statusStateAfterStartApply.lifecycleState !== "planned" ||
    statusStateAfterStartApply.pendingWorkItemIds.length !== 1 ||
    statusStateAfterStartApply.retryableWorkItemIds.length !== 1 ||
    statusStateAfterStartApply.workItems.some((workItem) =>
      workItem.state === "completed" || workItem.state === "verified"
    ) ||
    statusStateAfterStartApply.completionGate.completed !== false ||
    statusStateAfterStartApply.completionGate.verified !== false
  ) {
    fail("task execution start apply changed task or work completion state", startApplyJson);
  }

  const cliInvocationNoop = {
    calls: 0,
    dependency: {
      kind: "test_noop",
      invoke() {
        cliInvocationNoop.calls += 1;
        return {
          ok: true,
          output: {
            completed: true,
            verified: true,
            allDone: true,
            executionSucceeded: true,
          },
          diagnosticCode: "cli_status_noop",
          message: "CLI status noop returned.",
        };
      },
    },
  };
  const cliInvocationResult = await invokeStartedTaskExecutionAttempt({
    projectRoot: taskStateCliRoot,
    state: statusStateAfterStartApply,
    attempt: persistedStartedAttempt,
    dependency: cliInvocationNoop.dependency,
    expectedRevision: 1,
    latestAttemptNumberForContext: 1,
  });
  if (
    cliInvocationResult.invocationStatus !== "returned" ||
    cliInvocationResult.dependencyInvoked !== true ||
    cliInvocationNoop.calls !== 1
  ) {
    fail("task execution invocation status fixture did not persist returned invocation");
  }
  const invocationStatusPath = join(
    taskStateCliRoot,
    ".aeos",
    "state",
    "invocations",
    statusTaskId,
    `${cliInvocationResult.invocationId}.json`,
  );
  const persistedInvocationForStatus = JSON.parse(
    readFileSync(invocationStatusPath, "utf8"),
  );
  const invocationStatusBytesBefore = readFileSync(invocationStatusPath, "utf8");
  const invocationStatusMtimeBefore = statSync(invocationStatusPath).mtimeMs;
  const invocationFilesBeforeStatus = listRelativeFiles(
    join(taskStateCliRoot, ".aeos", "state", "invocations"),
  );
  const stateSnapshotBeforeInvocationStatus = stateFileSnapshot(statusStatePath);
  const attemptBytesBeforeInvocationStatus = readFileSync(persistedAttemptPath, "utf8");
  const invocationStatusHuman = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "invocation",
    "status",
    statusTaskId,
    "--invocation-id",
    cliInvocationResult.invocationId,
  ]);
  expectExitCode("task execution invocation status human exited nonzero", invocationStatusHuman, 0);
  for (const expectedText of [
    "Execution Invocation Status",
    `Task id: ${statusTaskId}`,
    `Invocation id: ${cliInvocationResult.invocationId}`,
    "Lifecycle: returned",
    "Outcome known: true",
    "Reconciliation required: false",
    "Retryable: false",
    "Safe to blind retry: false",
    "Read only: true",
    "Dependency invoked by status: false",
    "Work completed: false",
    "Task completed: false",
  ]) {
    expectOutputIncludes(
      `task execution invocation status human missing ${expectedText}`,
      invocationStatusHuman,
      expectedText,
    );
  }
  expectOutputExcludes(
    "task execution invocation status human leaked ownership token",
    invocationStatusHuman,
    persistedInvocationForStatus.ownership.ownershipToken,
  );
  const invocationStatusJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "invocation",
    "status",
    statusTaskId,
    "--invocation-id",
    cliInvocationResult.invocationId,
    "--json",
  ]);
  expectExitCode("task execution invocation status --json exited nonzero", invocationStatusJson, 0);
  const parsedInvocationStatusJson = parseJsonOnlyStdout(
    "task execution invocation status --json output was not valid JSON only",
    invocationStatusJson,
  );
  expectTaskExecutionInvocationStatusJsonShape(
    "task execution invocation status --json shape was invalid",
    parsedInvocationStatusJson,
    invocationStatusJson,
  );
  if (
    parsedInvocationStatusJson.taskId !== statusTaskId ||
    parsedInvocationStatusJson.invocationId !== cliInvocationResult.invocationId ||
    parsedInvocationStatusJson.invocation.lifecycle !== "returned" ||
    parsedInvocationStatusJson.invocation.currentTaskRevision !== 1 ||
    parsedInvocationStatusJson.invocation.staleAgainstCurrentTask !== false ||
    parsedInvocationStatusJson.invocation.result.executorClaims.completed !== true ||
    parsedInvocationStatusJson.safety.workCompleted !== false ||
    parsedInvocationStatusJson.safety.taskCompleted !== false ||
    parsedInvocationStatusJson.safety.verifierRun !== false
  ) {
    fail("task execution invocation status --json lost safety semantics", invocationStatusJson);
  }
  if (
    invocationStatusJson.stdout.includes(
      persistedInvocationForStatus.ownership.ownershipToken,
    ) ||
    invocationStatusJson.stdout.includes("ownershipToken")
  ) {
    fail("task execution invocation status --json leaked ownership authority", invocationStatusJson);
  }
  expectStateFileSnapshotSame(
    "task execution invocation status modified task state",
    statusStatePath,
    stateSnapshotBeforeInvocationStatus,
    invocationStatusJson,
  );
  if (
    readFileSync(invocationStatusPath, "utf8") !== invocationStatusBytesBefore ||
    statSync(invocationStatusPath).mtimeMs !== invocationStatusMtimeBefore ||
    readFileSync(persistedAttemptPath, "utf8") !== attemptBytesBeforeInvocationStatus
  ) {
    fail("task execution invocation status modified persisted authority", invocationStatusJson);
  }
  expectSameFiles(
    "task execution invocation status changed invocation directory contents",
    invocationFilesBeforeStatus,
    listRelativeFiles(join(taskStateCliRoot, ".aeos", "state", "invocations")),
  );
  const repeatedInvocationStatusJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "invocation",
    "status",
    statusTaskId,
    "--invocation-id",
    cliInvocationResult.invocationId,
    "--json",
  ]);
  expectExitCode(
    "repeated task execution invocation status --json exited nonzero",
    repeatedInvocationStatusJson,
    0,
  );
  if (repeatedInvocationStatusJson.stdout !== invocationStatusJson.stdout) {
    fail(
      "repeated task execution invocation status --json was not deterministic",
      repeatedInvocationStatusJson,
    );
  }
  const invocationReconcileFilesBefore = listRelativeFiles(
    join(taskStateCliRoot, ".aeos"),
  );
  const invocationReconcileStateBefore = stateFileSnapshot(statusStatePath);
  const invocationReconcileAttemptBefore = readFileSync(persistedAttemptPath, "utf8");
  const invocationReconcileBytesBefore = readFileSync(invocationStatusPath, "utf8");
  const invocationReconcileMtimeBefore = statSync(invocationStatusPath).mtimeMs;
  const invocationReconcileHuman = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "invocation",
    "reconcile",
    "--preview",
    statusTaskId,
    "--invocation-id",
    cliInvocationResult.invocationId,
  ]);
  expectExitCode(
    "task execution invocation reconcile preview human exited nonzero",
    invocationReconcileHuman,
    0,
  );
  for (const expectedText of [
    "Invocation Reconciliation Preview",
    `Task id: ${statusTaskId}`,
    `Invocation id: ${cliInvocationResult.invocationId}`,
    "Lifecycle: returned",
    "Recovery status: returned",
    "Recommended safe action: use_persisted_result",
    "Reconciliation required: false",
    "Safe to blind retry: false",
    "Retry requires new authority: false",
    "Current authority eligible: false",
    "Provider capability requirements:",
    "Persisted result available: true",
    "Read only: true",
    "Provider called: false",
    "Retry performed: false",
    "Invocation modified: false",
    "Task modified: false",
    "Attempt modified: false",
    "Work completed: false",
    "Task completed: false",
  ]) {
    expectOutputIncludes(
      `task execution invocation reconcile preview human missing ${expectedText}`,
      invocationReconcileHuman,
      expectedText,
    );
  }
  expectOutputExcludes(
    "task execution invocation reconcile preview human leaked ownership token",
    invocationReconcileHuman,
    persistedInvocationForStatus.ownership.ownershipToken,
  );
  const invocationReconcileJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "invocation",
    "reconcile",
    "--preview",
    statusTaskId,
    "--invocation-id",
    cliInvocationResult.invocationId,
    "--json",
  ]);
  expectExitCode(
    "task execution invocation reconcile preview --json exited nonzero",
    invocationReconcileJson,
    0,
  );
  const parsedInvocationReconcileJson = parseJsonOnlyStdout(
    "task execution invocation reconcile preview --json output was not valid JSON only",
    invocationReconcileJson,
  );
  expectTaskExecutionInvocationReconcilePreviewJsonShape(
    "task execution invocation reconcile preview --json shape was invalid",
    parsedInvocationReconcileJson,
    invocationReconcileJson,
  );
  if (
    parsedInvocationReconcileJson.taskId !== statusTaskId ||
    parsedInvocationReconcileJson.invocationId !== cliInvocationResult.invocationId ||
    parsedInvocationReconcileJson.reconciliation.lifecycle !== "returned" ||
    parsedInvocationReconcileJson.reconciliation.status !== "returned" ||
    parsedInvocationReconcileJson.reconciliation.action !== "use_persisted_result" ||
    parsedInvocationReconcileJson.reconciliation.reconciliationRequired !== false ||
    parsedInvocationReconcileJson.reconciliation.safeToBlindRetry !== false ||
    parsedInvocationReconcileJson.reconciliation.retryRequiresNewAuthority !== false ||
    parsedInvocationReconcileJson.reconciliation.staleAgainstCurrentTask !== false ||
    parsedInvocationReconcileJson.reconciliation.currentAuthorityEligible !== false ||
    parsedInvocationReconcileJson.reconciliation.outcomeKnown !== true ||
    parsedInvocationReconcileJson.reconciliation.persistedResultAvailable !== true ||
    parsedInvocationReconcileJson.providerRequirements.idempotencyLookupUseful !== false ||
    parsedInvocationReconcileJson.providerRequirements.statusQueryUseful !== false ||
    parsedInvocationReconcileJson.providerRequirements.resultReplayUseful !== false ||
    parsedInvocationReconcileJson.invocation.result.executorClaims.completed !== true ||
    parsedInvocationReconcileJson.safety.workCompleted !== false ||
    parsedInvocationReconcileJson.safety.taskCompleted !== false ||
    parsedInvocationReconcileJson.safety.verifierPassed !== false ||
    parsedInvocationReconcileJson.safety.policyApproved !== false
  ) {
    fail("task execution invocation reconcile preview --json lost safety semantics", invocationReconcileJson);
  }
  if (
    invocationReconcileJson.stdout.includes(
      persistedInvocationForStatus.ownership.ownershipToken,
    ) ||
    invocationReconcileJson.stdout.includes("ownershipToken")
  ) {
    fail("task execution invocation reconcile preview --json leaked ownership authority", invocationReconcileJson);
  }
  expectStateFileSnapshotSame(
    "task execution invocation reconcile preview modified task state",
    statusStatePath,
    invocationReconcileStateBefore,
    invocationReconcileJson,
  );
  if (
    readFileSync(invocationStatusPath, "utf8") !== invocationReconcileBytesBefore ||
    statSync(invocationStatusPath).mtimeMs !== invocationReconcileMtimeBefore ||
    readFileSync(persistedAttemptPath, "utf8") !== invocationReconcileAttemptBefore
  ) {
    fail("task execution invocation reconcile preview modified persisted authority", invocationReconcileJson);
  }
  expectSameFiles(
    "task execution invocation reconcile preview changed AEOS files",
    invocationReconcileFilesBefore,
    listRelativeFiles(join(taskStateCliRoot, ".aeos")),
  );
  const repeatedInvocationReconcileJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "invocation",
    "reconcile",
    "--preview",
    statusTaskId,
    "--invocation-id",
    cliInvocationResult.invocationId,
    "--json",
  ]);
  expectExitCode(
    "repeated task execution invocation reconcile preview --json exited nonzero",
    repeatedInvocationReconcileJson,
    0,
  );
  if (repeatedInvocationReconcileJson.stdout !== invocationReconcileJson.stdout) {
    fail(
      "repeated task execution invocation reconcile preview --json was not deterministic",
      repeatedInvocationReconcileJson,
    );
  }
  const invocationReconcileApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "invocation",
    "reconcile",
    statusTaskId,
    "--invocation-id",
    cliInvocationResult.invocationId,
    "--json",
  ]);
  expectNonzero("task execution invocation reconcile apply exited zero", invocationReconcileApplyJson);
  const parsedInvocationReconcileApplyJson = parseJsonOnlyStdout(
    "task execution invocation reconcile apply output was not valid JSON only",
    invocationReconcileApplyJson,
  );
  expectTaskExecutionInvocationReconcilePreviewErrorJsonShape(
    "task execution invocation reconcile apply did not fail closed",
    parsedInvocationReconcileApplyJson,
    "task_execution_invocation_reconcile_apply_not_implemented",
    invocationReconcileApplyJson,
  );
  expectSameFiles(
    "task execution invocation reconcile apply gate changed AEOS files",
    invocationReconcileFilesBefore,
    listRelativeFiles(join(taskStateCliRoot, ".aeos")),
  );
  const providerCapabilityFlagJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "invocation",
    "reconcile",
    "--preview",
    statusTaskId,
    "--invocation-id",
    cliInvocationResult.invocationId,
    "--supports-status-query",
    "--json",
  ]);
  expectNonzero("task execution invocation reconcile provider flag exited zero", providerCapabilityFlagJson);
  const parsedProviderCapabilityFlagJson = parseJsonOnlyStdout(
    "task execution invocation reconcile provider flag output was not valid JSON only",
    providerCapabilityFlagJson,
  );
  expectTaskExecutionInvocationReconcilePreviewErrorJsonShape(
    "task execution invocation reconcile provider flag did not fail closed",
    parsedProviderCapabilityFlagJson,
    "task_execution_invocation_reconcile_unknown_option",
    providerCapabilityFlagJson,
  );

  async function createStartedInvocationFixture(attemptNumber) {
    const minute = String(attemptNumber).padStart(2, "0").slice(-2);
    const prepared = prepareTaskExecutionAttempt({
      state: statusStateAfterStartApply,
      expectedRevision: 1,
      batchId: "batch-main",
      attemptNumber,
      createdAt: `2026-08-10T00:${minute}:00.000Z`,
    });

    if (!prepared.ok) {
      fail(`task execution invocation reconcile fixture ${attemptNumber} did not prepare`);
    }

    const started = transitionTaskExecutionAttempt({
      attempt: prepared.value.attempt,
      intent: { kind: "start" },
      occurredAt: `2026-08-10T00:${minute}:01.000Z`,
    });

    if (!started.ok) {
      fail(`task execution invocation reconcile fixture ${attemptNumber} did not start`);
    }

    const saved = await saveTaskExecutionAttempt({
      projectRoot: taskStateCliRoot,
      attempt: started.value.attempt,
    });

    if (!saved.ok) {
      fail(`task execution invocation reconcile fixture ${attemptNumber} did not save`);
    }

    return started.value.attempt;
  }

  async function reserveInvocationFixture(attemptNumber) {
    const minute = String(attemptNumber).padStart(2, "0").slice(-2);
    const attempt = await createStartedInvocationFixture(attemptNumber);
    const reserved = await reserveTaskExecutionInvocation({
      projectRoot: taskStateCliRoot,
      state: statusStateAfterStartApply,
      attempt,
      dependencyKind: "test_noop",
      expectedRevision: 1,
      claimedAt: `2026-08-10T00:${minute}:02.000Z`,
    });

    if (!reserved.ok) {
      fail(`task execution invocation reconcile fixture ${attemptNumber} did not reserve`);
    }

    return reserved.value;
  }

  async function updateInvocationFixture(reservation, expectedLifecycle, intent) {
    const updated = await updateTaskExecutionInvocation({
      projectRoot: taskStateCliRoot,
      taskId: reservation.record.taskId,
      invocationId: reservation.record.invocationId,
      ownershipToken: reservation.record.ownership.ownershipToken,
      expectedLifecycle,
      intent,
    });

    if (!updated.ok) {
      fail(`task execution invocation reconcile fixture ${reservation.record.invocationId} did not update`);
    }

    return updated.value;
  }

  const reservedPreviewFixture = await reserveInvocationFixture(20);
  const invokingPreviewReservation = await reserveInvocationFixture(21);
  const invokingPreviewFixture = await updateInvocationFixture(
    invokingPreviewReservation,
    "reserved",
    {
      kind: "enter_invocation",
      occurredAt: "2026-08-10T00:03:03.000Z",
    },
  );
  const unknownPreviewReservation = await reserveInvocationFixture(22);
  const unknownEnteredFixture = await updateInvocationFixture(
    unknownPreviewReservation,
    "reserved",
    {
      kind: "enter_invocation",
      occurredAt: "2026-08-10T00:04:03.000Z",
    },
  );
  const unknownPreviewFixture = await updateTaskExecutionInvocation({
    projectRoot: taskStateCliRoot,
    taskId: unknownEnteredFixture.record.taskId,
    invocationId: unknownEnteredFixture.record.invocationId,
    ownershipToken: unknownPreviewReservation.record.ownership.ownershipToken,
    expectedLifecycle: "invoking",
    intent: {
      kind: "mark_outcome_unknown",
      occurredAt: "2026-08-10T00:04:04.000Z",
    },
  });
  if (!unknownPreviewFixture.ok) {
    fail("task execution invocation reconcile fixture did not mark outcome unknown");
  }
  const failedPreviewReservation = await reserveInvocationFixture(23);
  const failedEnteredFixture = await updateInvocationFixture(
    failedPreviewReservation,
    "reserved",
    {
      kind: "enter_invocation",
      occurredAt: "2026-08-10T00:05:03.000Z",
    },
  );
  const failedPreviewFixture = await updateTaskExecutionInvocation({
    projectRoot: taskStateCliRoot,
    taskId: failedEnteredFixture.record.taskId,
    invocationId: failedEnteredFixture.record.invocationId,
    ownershipToken: failedPreviewReservation.record.ownership.ownershipToken,
    expectedLifecycle: "invoking",
    intent: {
      kind: "record_failed",
      failure: {
        code: "retryable_preview_failure",
        category: "execution_failure",
        retryable: true,
        diagnostic: "Retryable failure requires new authority.",
        failedAt: "2026-08-10T00:05:04.000Z",
      },
    },
  });
  if (!failedPreviewFixture.ok) {
    fail("task execution invocation reconcile fixture did not record retryable failure");
  }

  for (const lifecycleCase of [
    {
      label: "reserved",
      invocationId: reservedPreviewFixture.record.invocationId,
      lifecycle: "reserved",
      action: "operator_review_required",
      reconciliationRequired: false,
      outcomeKnown: false,
      retryRequiresNewAuthority: false,
      providerUseful: false,
    },
    {
      label: "invoking",
      invocationId: invokingPreviewFixture.record.invocationId,
      lifecycle: "invoking",
      action: "reconciliation_required",
      reconciliationRequired: true,
      outcomeKnown: false,
      retryRequiresNewAuthority: false,
      providerUseful: true,
    },
    {
      label: "outcome_unknown",
      invocationId: unknownPreviewFixture.value.record.invocationId,
      lifecycle: "outcome_unknown",
      action: "reconciliation_required",
      reconciliationRequired: true,
      outcomeKnown: false,
      retryRequiresNewAuthority: false,
      providerUseful: true,
    },
    {
      label: "failed",
      invocationId: failedPreviewFixture.value.record.invocationId,
      lifecycle: "failed",
      action: "explicit_retry_required",
      reconciliationRequired: false,
      outcomeKnown: true,
      retryRequiresNewAuthority: true,
      providerUseful: false,
    },
  ]) {
    const preview = runCliFrom(taskStateCliRoot, [
      "task",
      "execution",
      "invocation",
      "reconcile",
      "--preview",
      statusTaskId,
      "--invocation-id",
      lifecycleCase.invocationId,
      "--json",
    ]);
    expectExitCode(
      `task execution invocation reconcile ${lifecycleCase.label} preview exited nonzero`,
      preview,
      0,
    );
    const parsedPreview = parseJsonOnlyStdout(
      `task execution invocation reconcile ${lifecycleCase.label} preview output was not valid JSON only`,
      preview,
    );
    expectTaskExecutionInvocationReconcilePreviewJsonShape(
      `task execution invocation reconcile ${lifecycleCase.label} preview shape was invalid`,
      parsedPreview,
      preview,
    );
    if (
      parsedPreview.reconciliation.lifecycle !== lifecycleCase.lifecycle ||
      parsedPreview.reconciliation.status !== lifecycleCase.lifecycle ||
      parsedPreview.reconciliation.action !== lifecycleCase.action ||
      parsedPreview.reconciliation.reconciliationRequired !== lifecycleCase.reconciliationRequired ||
      parsedPreview.reconciliation.safeToBlindRetry !== false ||
      parsedPreview.reconciliation.retryRequiresNewAuthority !== lifecycleCase.retryRequiresNewAuthority ||
      parsedPreview.reconciliation.currentAuthorityEligible !== false ||
      parsedPreview.reconciliation.outcomeKnown !== lifecycleCase.outcomeKnown ||
      parsedPreview.providerRequirements.idempotencyLookupUseful !== lifecycleCase.providerUseful ||
      parsedPreview.providerRequirements.statusQueryUseful !== lifecycleCase.providerUseful ||
      parsedPreview.providerRequirements.resultReplayUseful !== lifecycleCase.providerUseful ||
      parsedPreview.safety.providerCalled !== false ||
      parsedPreview.safety.retryPerformed !== false ||
      parsedPreview.safety.invocationModified !== false ||
      parsedPreview.safety.workCompleted !== false ||
      parsedPreview.safety.taskCompleted !== false
    ) {
      fail(`task execution invocation reconcile ${lifecycleCase.label} preview lost lifecycle safety`, preview);
    }
  }

  const stalePreviewRoot = mkdtempSync(join(tmpdir(), "aeos-cli-stale-invocation-preview-"));
  const staleTaskDir = join(stalePreviewRoot, ".aeos", "state", "tasks");
  const staleAttemptDir = join(stalePreviewRoot, ".aeos", "state", "executions", statusTaskId);
  const staleInvocationDir = join(stalePreviewRoot, ".aeos", "state", "invocations", statusTaskId);
  mkdirSync(staleTaskDir, { recursive: true });
  mkdirSync(staleAttemptDir, { recursive: true });
  mkdirSync(staleInvocationDir, { recursive: true });
  writeFileSync(
    join(staleTaskDir, `${statusTaskId}.json`),
    `${JSON.stringify(
      {
        ...statusStateAfterStartApply,
        revision: 2,
        updatedAt: "2026-08-10T00:06:00.000Z",
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(staleAttemptDir, `${persistedStartedAttempt.attemptId}.json`),
    readFileSync(persistedAttemptPath, "utf8"),
  );
  writeFileSync(
    join(staleInvocationDir, `${cliInvocationResult.invocationId}.json`),
    invocationReconcileBytesBefore,
  );
  const stalePreviewJson = runCliFrom(stalePreviewRoot, [
    "task",
    "execution",
    "invocation",
    "reconcile",
    "--preview",
    statusTaskId,
    "--invocation-id",
    cliInvocationResult.invocationId,
    "--json",
  ]);
  expectExitCode("task execution invocation reconcile stale preview exited nonzero", stalePreviewJson, 0);
  const parsedStalePreviewJson = parseJsonOnlyStdout(
    "task execution invocation reconcile stale preview output was not valid JSON only",
    stalePreviewJson,
  );
  expectTaskExecutionInvocationReconcilePreviewJsonShape(
    "task execution invocation reconcile stale preview shape was invalid",
    parsedStalePreviewJson,
    stalePreviewJson,
  );
  if (
    parsedStalePreviewJson.invocation.sourceTaskRevision !== 1 ||
    parsedStalePreviewJson.invocation.currentTaskRevision !== 2 ||
    parsedStalePreviewJson.reconciliation.staleAgainstCurrentTask !== true ||
    parsedStalePreviewJson.reconciliation.currentAuthorityEligible !== false ||
    parsedStalePreviewJson.reconciliation.reconciliationRequired !== true ||
    !parsedStalePreviewJson.issues.some((issue) =>
      issue.code === "task_execution_invocation_reconciliation_stale_task_revision"
    )
  ) {
    fail("task execution invocation reconcile stale preview lost historical safety", stalePreviewJson);
  }
  const missingInvocationStatusRoot = mkdtempSync(
    join(tmpdir(), "aeos-cli-missing-invocation-status-"),
  );
  const missingInvocationStatusJson = runCliFrom(missingInvocationStatusRoot, [
    "task",
    "execution",
    "invocation",
    "status",
    "missing-task",
    "--invocation-id",
    "missing-invocation",
    "--json",
  ]);
  expectNonzero("task execution invocation status missing exited zero", missingInvocationStatusJson);
  const parsedMissingInvocationStatusJson = parseJsonOnlyStdout(
    "task execution invocation status missing output was not valid JSON only",
    missingInvocationStatusJson,
  );
  expectTaskExecutionInvocationStatusErrorJsonShape(
    "task execution invocation status missing did not fail closed",
    parsedMissingInvocationStatusJson,
    "task_execution_invocation_not_found",
    missingInvocationStatusJson,
  );
  if (existsSync(join(missingInvocationStatusRoot, ".aeos"))) {
    fail("task execution invocation status missing created state directories", missingInvocationStatusJson);
  }
  const missingInvocationPreviewJson = runCliFrom(missingInvocationStatusRoot, [
    "task",
    "execution",
    "invocation",
    "reconcile",
    "--preview",
    "missing-task",
    "--invocation-id",
    "missing-invocation",
    "--json",
  ]);
  expectNonzero("task execution invocation reconcile missing preview exited zero", missingInvocationPreviewJson);
  const parsedMissingInvocationPreviewJson = parseJsonOnlyStdout(
    "task execution invocation reconcile missing preview output was not valid JSON only",
    missingInvocationPreviewJson,
  );
  expectTaskExecutionInvocationReconcilePreviewErrorJsonShape(
    "task execution invocation reconcile missing preview did not fail closed",
    parsedMissingInvocationPreviewJson,
    "task_execution_invocation_not_found",
    missingInvocationPreviewJson,
  );
  if (
    missingInvocationPreviewJson.stdout.includes("safeToBlindRetry\":true") ||
    existsSync(join(missingInvocationStatusRoot, ".aeos"))
  ) {
    fail("task execution invocation reconcile missing preview created authority or allowed retry", missingInvocationPreviewJson);
  }
  const corruptInvocationStatusRoot = mkdtempSync(
    join(tmpdir(), "aeos-cli-corrupt-invocation-status-"),
  );
  const corruptInvocationStatusDir = join(
    corruptInvocationStatusRoot,
    ".aeos",
    "state",
    "invocations",
    statusTaskId,
  );
  mkdirSync(corruptInvocationStatusDir, { recursive: true });
  writeFileSync(
    join(corruptInvocationStatusDir, `${cliInvocationResult.invocationId}.json`),
    "{ corrupt invocation",
  );
  const corruptInvocationStatusJson = runCliFrom(corruptInvocationStatusRoot, [
    "task",
    "execution",
    "invocation",
    "status",
    statusTaskId,
    "--invocation-id",
    cliInvocationResult.invocationId,
    "--json",
  ]);
  expectNonzero("task execution invocation status corrupt exited zero", corruptInvocationStatusJson);
  const parsedCorruptInvocationStatusJson = parseJsonOnlyStdout(
    "task execution invocation status corrupt output was not valid JSON only",
    corruptInvocationStatusJson,
  );
  expectTaskExecutionInvocationStatusErrorJsonShape(
    "task execution invocation status corrupt did not fail closed",
    parsedCorruptInvocationStatusJson,
    "task_execution_invocation_corrupt_json",
    corruptInvocationStatusJson,
  );
  const corruptInvocationPreviewBefore = readFileSync(
    join(corruptInvocationStatusDir, `${cliInvocationResult.invocationId}.json`),
    "utf8",
  );
  const corruptInvocationPreviewJson = runCliFrom(corruptInvocationStatusRoot, [
    "task",
    "execution",
    "invocation",
    "reconcile",
    "--preview",
    statusTaskId,
    "--invocation-id",
    cliInvocationResult.invocationId,
    "--json",
  ]);
  expectNonzero("task execution invocation reconcile corrupt preview exited zero", corruptInvocationPreviewJson);
  const parsedCorruptInvocationPreviewJson = parseJsonOnlyStdout(
    "task execution invocation reconcile corrupt preview output was not valid JSON only",
    corruptInvocationPreviewJson,
  );
  expectTaskExecutionInvocationReconcilePreviewErrorJsonShape(
    "task execution invocation reconcile corrupt preview did not fail closed",
    parsedCorruptInvocationPreviewJson,
    "task_execution_invocation_corrupt_json",
    corruptInvocationPreviewJson,
  );
  if (
    corruptInvocationPreviewJson.stdout.includes("safeToBlindRetry\":true") ||
    readFileSync(
      join(corruptInvocationStatusDir, `${cliInvocationResult.invocationId}.json`),
      "utf8",
    ) !== corruptInvocationPreviewBefore
  ) {
    fail("task execution invocation reconcile corrupt preview modified authority or allowed retry", corruptInvocationPreviewJson);
  }
  const unsafeInvocationStatusJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "invocation",
    "status",
    "../TASK-STATUS-SMOKE",
    "--invocation-id",
    cliInvocationResult.invocationId,
    "--json",
  ]);
  expectNonzero("task execution invocation status traversal id exited zero", unsafeInvocationStatusJson);
  const parsedUnsafeInvocationStatusJson = parseJsonOnlyStdout(
    "task execution invocation status traversal output was not valid JSON only",
    unsafeInvocationStatusJson,
  );
  expectTaskExecutionInvocationStatusErrorJsonShape(
    "task execution invocation status traversal did not fail closed",
    parsedUnsafeInvocationStatusJson,
    "task_execution_invocation_unsafe_taskId",
    unsafeInvocationStatusJson,
  );

  const previewAfterStartApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "start",
    "--preview",
    statusTaskId,
    "--attempt-id",
    parsedExecutionPrepareApplyJson.attempt.attemptId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution start preview after apply exited zero", previewAfterStartApplyJson);
  const parsedPreviewAfterStartApplyJson = parseJsonOnlyStdout(
    "task execution start preview after apply output was not valid JSON only",
    previewAfterStartApplyJson,
  );
  expectTaskExecutionStartPreviewErrorJsonShape(
    "task execution start preview after apply did not reject non-prepared attempt",
    parsedPreviewAfterStartApplyJson,
    "task_execution_start_attempt_not_prepared",
    previewAfterStartApplyJson,
  );

  const duplicateStartApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "start",
    statusTaskId,
    "--attempt-id",
    parsedExecutionPrepareApplyJson.attempt.attemptId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution duplicate start apply exited zero", duplicateStartApplyJson);
  const parsedDuplicateStartApplyJson = parseJsonOnlyStdout(
    "task execution duplicate start apply output was not valid JSON only",
    duplicateStartApplyJson,
  );
  expectTaskExecutionStartApplyErrorJsonShape(
    "task execution duplicate start apply did not fail closed",
    parsedDuplicateStartApplyJson,
    "task_execution_start_attempt_not_prepared",
    duplicateStartApplyJson,
  );
  const persistedAttemptAfterDuplicateStart = JSON.parse(readFileSync(persistedAttemptPath, "utf8"));
  if (
    persistedAttemptAfterDuplicateStart.lifecycle !== "started" ||
    persistedAttemptAfterDuplicateStart.events.length !== 2 ||
    persistedAttemptAfterDuplicateStart.events.filter((event) => event.kind === "attempt_started").length !== 1
  ) {
    fail("task execution duplicate start apply appended duplicate started event", duplicateStartApplyJson);
  }

  const policyApprovalPreparedAttempt = prepareTaskExecutionAttempt({
    state: JSON.parse(readFileSync(statusStatePath, "utf8")),
    expectedRevision: 1,
    batchId: "batch-main",
    attemptNumber: 120,
    createdAt: "2026-08-09T00:08:00.000Z",
  });
  if (!policyApprovalPreparedAttempt.ok) {
    fail(`could not prepare policy approval fixture: ${policyApprovalPreparedAttempt.error.code}`);
  }
  const policyApprovalStartedAttempt = transitionTaskExecutionAttempt({
    attempt: policyApprovalPreparedAttempt.value.attempt,
    intent: {
      kind: "start",
    },
    occurredAt: "2026-08-09T00:08:01.000Z",
  });
  if (!policyApprovalStartedAttempt.ok) {
    fail(`could not start policy approval fixture: ${policyApprovalStartedAttempt.error.code}`);
  }
  const policyApprovalAttemptSave = await saveTaskExecutionAttempt({
    projectRoot: taskStateCliRoot,
    attempt: policyApprovalStartedAttempt.value.attempt,
  });
  if (!policyApprovalAttemptSave.ok) {
    fail(`could not save policy approval fixture: ${policyApprovalAttemptSave.error.code}`);
  }
  const policyApprovalReservation = await reserveTaskExecutionInvocation({
    projectRoot: taskStateCliRoot,
    state: JSON.parse(readFileSync(statusStatePath, "utf8")),
    attempt: policyApprovalStartedAttempt.value.attempt,
    dependencyKind: "test_noop",
    expectedRevision: 1,
    claimedAt: "2026-08-09T00:08:02.000Z",
    ownerId: "owner-policy-approval-cli",
    ownershipToken: "ownership-token-policy-approval-cli",
  });
  if (!policyApprovalReservation.ok) {
    fail(`could not reserve policy approval invocation: ${policyApprovalReservation.error.code}`);
  }
  const policyApprovalInvocationId =
    policyApprovalReservation.value.record.invocationId;
  const policyApprovalStateSnapshot = stateFileSnapshot(statusStatePath);
  const policyApprovalAttemptBytesBefore = readFileSync(
    policyApprovalAttemptSave.value.path,
    "utf8",
  );
  const policyApprovalInvocationBytesBefore = readFileSync(
    policyApprovalReservation.value.path,
    "utf8",
  );
  const policyApprovalStatusMissingJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "policy",
    "status",
    statusTaskId,
    "--invocation-id",
    policyApprovalInvocationId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution policy status missing exited zero", policyApprovalStatusMissingJson);
  const parsedPolicyApprovalStatusMissingJson = parseJsonOnlyStdout(
    "task execution policy status missing output was not valid JSON only",
    policyApprovalStatusMissingJson,
  );
  expectTaskExecutionPolicyApprovalErrorJsonShape(
    "task execution policy status missing did not fail closed",
    parsedPolicyApprovalStatusMissingJson,
    "task_execution_policy_approval_not_found",
    policyApprovalStatusMissingJson,
  );
  const policyApprovalForceJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "policy",
    "approve",
    statusTaskId,
    "--invocation-id",
    policyApprovalInvocationId,
    "--expected-revision",
    "1",
    "--force",
    "--json",
  ]);
  expectNonzero("task execution policy approval force exited zero", policyApprovalForceJson);
  const parsedPolicyApprovalForceJson = parseJsonOnlyStdout(
    "task execution policy approval force output was not valid JSON only",
    policyApprovalForceJson,
  );
  expectTaskExecutionPolicyApprovalErrorJsonShape(
    "task execution policy approval force did not fail closed",
    parsedPolicyApprovalForceJson,
    "task_execution_policy_operator_authority_forbidden",
    policyApprovalForceJson,
  );
  const policyApprovalJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "policy",
    "approve",
    statusTaskId,
    "--invocation-id",
    policyApprovalInvocationId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode("task execution policy approve exited nonzero", policyApprovalJson, 0);
  const parsedPolicyApprovalJson = parseJsonOnlyStdout(
    "task execution policy approve output was not valid JSON only",
    policyApprovalJson,
  );
  expectTaskExecutionPolicyApprovalJsonShape(
    "task execution policy approve shape was invalid",
    parsedPolicyApprovalJson,
    policyApprovalJson,
  );
  if (
    parsedPolicyApprovalJson.status !== "policy_approval_persisted" ||
    parsedPolicyApprovalJson.approval.decision !== "approved" ||
    parsedPolicyApprovalJson.proofUsableForGate !== true ||
    !parsedPolicyApprovalJson.approval.requiredPermissions.includes("external_side_effect") ||
    policyApprovalJson.stdout.includes("ownership-token-policy-approval-cli") ||
    policyApprovalJson.stdout.includes("fake-task-0302-secret")
  ) {
    fail("task execution policy approve did not persist sanitized exact approval", policyApprovalJson);
  }
  expectStateFileSnapshotSame(
    "task execution policy approve modified task state",
    statusStatePath,
    policyApprovalStateSnapshot,
    policyApprovalJson,
  );
  if (
    readFileSync(policyApprovalAttemptSave.value.path, "utf8") !==
      policyApprovalAttemptBytesBefore ||
    readFileSync(policyApprovalReservation.value.path, "utf8") !==
      policyApprovalInvocationBytesBefore
  ) {
    fail("task execution policy approve mutated attempt or invocation authority", policyApprovalJson);
  }
  const policyApprovalStatusJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "policy",
    "status",
    statusTaskId,
    "--invocation-id",
    policyApprovalInvocationId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode("task execution policy status exited nonzero", policyApprovalStatusJson, 0);
  const parsedPolicyApprovalStatusJson = parseJsonOnlyStdout(
    "task execution policy status output was not valid JSON only",
    policyApprovalStatusJson,
  );
  expectTaskExecutionPolicyApprovalJsonShape(
    "task execution policy status shape was invalid",
    parsedPolicyApprovalStatusJson,
    policyApprovalStatusJson,
  );
  if (
    parsedPolicyApprovalStatusJson.approval.approvalId !==
      parsedPolicyApprovalJson.approval.approvalId ||
    parsedPolicyApprovalStatusJson.safety.approvalPersisted !== false ||
    policyApprovalStatusJson.stdout.includes("ownership-token-policy-approval-cli")
  ) {
    fail("task execution policy status did not load sanitized approval", policyApprovalStatusJson);
  }
  const policyApprovalDenyConflictJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "policy",
    "deny",
    statusTaskId,
    "--invocation-id",
    policyApprovalInvocationId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution policy deny conflict exited zero", policyApprovalDenyConflictJson);
  const parsedPolicyApprovalDenyConflictJson = parseJsonOnlyStdout(
    "task execution policy deny conflict output was not valid JSON only",
    policyApprovalDenyConflictJson,
  );
  expectTaskExecutionPolicyApprovalErrorJsonShape(
    "task execution policy deny conflict did not fail closed",
    parsedPolicyApprovalDenyConflictJson,
    "task_execution_policy_approval_authority_conflict",
    policyApprovalDenyConflictJson,
  );
  const policyApprovalStaleJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "policy",
    "approve",
    statusTaskId,
    "--invocation-id",
    policyApprovalInvocationId,
    "--expected-revision",
    "2",
    "--json",
  ]);
  expectNonzero("task execution policy stale approval exited zero", policyApprovalStaleJson);
  const parsedPolicyApprovalStaleJson = parseJsonOnlyStdout(
    "task execution policy stale approval output was not valid JSON only",
    policyApprovalStaleJson,
  );
  expectTaskExecutionPolicyApprovalErrorJsonShape(
    "task execution policy stale approval did not fail closed",
    parsedPolicyApprovalStaleJson,
    "task_execution_policy_expected_revision_mismatch",
    policyApprovalStaleJson,
  );

  const dispatchMissingJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "dispatch",
    "missing-task",
    "--invocation-id",
    "missing-invocation",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution dispatch missing task exited zero", dispatchMissingJson);
  const parsedDispatchMissingJson = parseJsonOnlyStdout(
    "task execution dispatch missing task output was not valid JSON only",
    dispatchMissingJson,
  );
  expectTaskExecutionDispatchErrorJsonShape(
    "task execution dispatch missing task did not fail closed",
    parsedDispatchMissingJson,
    "task_state_not_found",
    dispatchMissingJson,
  );

  for (const [flag, code] of [
    ["--endpoint", "task_execution_dispatch_arbitrary_endpoint_forbidden"],
    ["--api-key", "task_execution_dispatch_raw_credential_forbidden"],
    ["--force", "task_execution_dispatch_authority_override_forbidden"],
  ]) {
    const forbiddenDispatchJson = runCliFrom(taskStateCliRoot, [
      "task",
      "execution",
      "dispatch",
      statusTaskId,
      "--invocation-id",
      policyApprovalInvocationId,
      "--expected-revision",
      "1",
      "--json",
      flag,
      "forbidden-value",
    ]);
    expectNonzero(`task execution dispatch forbidden ${flag} exited zero`, forbiddenDispatchJson);
    const parsedForbiddenDispatchJson = parseJsonOnlyStdout(
      `task execution dispatch forbidden ${flag} output was not valid JSON only`,
      forbiddenDispatchJson,
    );
    expectTaskExecutionDispatchErrorJsonShape(
      `task execution dispatch forbidden ${flag} did not fail closed`,
      parsedForbiddenDispatchJson,
      code,
      forbiddenDispatchJson,
    );
  }

  const dispatchMissingConfig = await createDispatchCliFixture({
    rootPrefix: "aeos-cli-dispatch-missing-config-",
    taskId: "TASK-CLI-DISPATCH-MISSING-CONFIG",
    writeProfile: false,
  });
  const missingConfigJson = runCliFrom(dispatchMissingConfig.rootPath, [
    "task",
    "execution",
    "dispatch",
    dispatchMissingConfig.taskId,
    "--invocation-id",
    dispatchMissingConfig.invocation.invocationId,
    "--expected-revision",
    "1",
    "--provider-profile",
    dispatchMissingConfig.profile.providerProfileId,
    "--json",
  ], { env: dispatchMissingConfig.secretEnv });
  expectNonzero("task execution dispatch missing trusted config exited zero", missingConfigJson);
  const parsedMissingConfigJson = parseJsonOnlyStdout(
    "task execution dispatch missing trusted config output was not valid JSON only",
    missingConfigJson,
  );
  expectTaskExecutionDispatchErrorJsonShape(
    "task execution dispatch missing trusted config did not fail closed",
    parsedMissingConfigJson,
    "task_execution_production_provider_profile_missing",
    missingConfigJson,
  );

  const dispatchStale = await createDispatchCliFixture({
    rootPrefix: "aeos-cli-dispatch-stale-",
    taskId: "TASK-CLI-DISPATCH-STALE",
  });
  const staleDispatchJson = runCliFrom(dispatchStale.rootPath, [
    "task",
    "execution",
    "dispatch",
    dispatchStale.taskId,
    "--invocation-id",
    dispatchStale.invocation.invocationId,
    "--expected-revision",
    "2",
    "--provider-profile",
    dispatchStale.profile.providerProfileId,
    "--json",
  ], { env: dispatchStale.secretEnv });
  expectNonzero("task execution dispatch stale revision exited zero", staleDispatchJson);
  const parsedStaleDispatchJson = parseJsonOnlyStdout(
    "task execution dispatch stale revision output was not valid JSON only",
    staleDispatchJson,
  );
  expectTaskExecutionDispatchErrorJsonShape(
    "task execution dispatch stale revision did not fail closed",
    parsedStaleDispatchJson,
    "task_state_revision_conflict",
    staleDispatchJson,
  );

  const dispatchMissingApproval = await createDispatchCliFixture({
    rootPrefix: "aeos-cli-dispatch-missing-approval-",
    taskId: "TASK-CLI-DISPATCH-MISSING-APPROVAL",
    writeApproval: false,
    writeAudit: false,
  });
  const missingApprovalJson = runCliFrom(dispatchMissingApproval.rootPath, [
    "task",
    "execution",
    "dispatch",
    dispatchMissingApproval.taskId,
    "--invocation-id",
    dispatchMissingApproval.invocation.invocationId,
    "--expected-revision",
    "1",
    "--provider-profile",
    dispatchMissingApproval.profile.providerProfileId,
    "--json",
  ], { env: dispatchMissingApproval.secretEnv });
  expectNonzero("task execution dispatch missing approval exited zero", missingApprovalJson);
  const parsedMissingApprovalJson = parseJsonOnlyStdout(
    "task execution dispatch missing approval output was not valid JSON only",
    missingApprovalJson,
  );
  expectTaskExecutionDispatchErrorJsonShape(
    "task execution dispatch missing approval did not fail closed",
    parsedMissingApprovalJson,
    "task_execution_policy_approval_not_found",
    missingApprovalJson,
  );

  const dispatchMissingCredential = await createDispatchCliFixture({
    rootPrefix: "aeos-cli-dispatch-missing-credential-",
    taskId: "TASK-CLI-DISPATCH-MISSING-CREDENTIAL",
  });
  const missingCredentialJson = runCliFrom(dispatchMissingCredential.rootPath, [
    "task",
    "execution",
    "dispatch",
    dispatchMissingCredential.taskId,
    "--invocation-id",
    dispatchMissingCredential.invocation.invocationId,
    "--expected-revision",
    "1",
    "--provider-profile",
    dispatchMissingCredential.profile.providerProfileId,
    "--json",
  ], { env: { AEOS_CLI_SMOKE_PROVIDER_SECRET: "" } });
  expectNonzero("task execution dispatch missing credential exited zero", missingCredentialJson);
  const parsedMissingCredentialJson = parseJsonOnlyStdout(
    "task execution dispatch missing credential output was not valid JSON only",
    missingCredentialJson,
  );
  expectTaskExecutionDispatchErrorJsonShape(
    "task execution dispatch missing credential did not fail closed",
    parsedMissingCredentialJson,
    "task_execution_credential_missing",
    missingCredentialJson,
  );

  const dispatchMissingAudit = await createDispatchCliFixture({
    rootPrefix: "aeos-cli-dispatch-missing-audit-",
    taskId: "TASK-CLI-DISPATCH-MISSING-AUDIT",
    writeAudit: false,
  });
  const missingAuditJson = runCliFrom(dispatchMissingAudit.rootPath, [
    "task",
    "execution",
    "dispatch",
    dispatchMissingAudit.taskId,
    "--invocation-id",
    dispatchMissingAudit.invocation.invocationId,
    "--expected-revision",
    "1",
    "--provider-profile",
    dispatchMissingAudit.profile.providerProfileId,
    "--json",
  ], { env: dispatchMissingAudit.secretEnv });
  expectNonzero("task execution dispatch missing audit exited zero", missingAuditJson);
  const parsedMissingAuditJson = parseJsonOnlyStdout(
    "task execution dispatch missing audit output was not valid JSON only",
    missingAuditJson,
  );
  expectTaskExecutionDispatchErrorJsonShape(
    "task execution dispatch missing audit did not fail closed",
    parsedMissingAuditJson,
    "task_execution_dispatch_pre_dispatch_audit_missing",
    missingAuditJson,
  );

  const recoveryBlockedProfile = createTrustedDispatchProfile({
    providerProfileId: "trusted-cli-http-not-ready",
    kind: "controlled_http",
    adapterId: "trusted-cli-http-not-ready-adapter",
    endpoint: "https://example.invalid/aeos/provider",
    realCallReady: false,
    recoveryEvidenceAuthority: "provider_runtime_evidence",
  });
  const dispatchRecoveryBlocked = await createDispatchCliFixture({
    rootPrefix: "aeos-cli-dispatch-recovery-blocked-",
    taskId: "TASK-CLI-DISPATCH-RECOVERY-BLOCKED",
    profile: recoveryBlockedProfile,
  });
  const recoveryBlockedJson = runCliFrom(dispatchRecoveryBlocked.rootPath, [
    "task",
    "execution",
    "dispatch",
    dispatchRecoveryBlocked.taskId,
    "--invocation-id",
    dispatchRecoveryBlocked.invocation.invocationId,
    "--expected-revision",
    "1",
    "--provider-profile",
    recoveryBlockedProfile.providerProfileId,
    "--json",
  ], { env: dispatchRecoveryBlocked.secretEnv });
  expectNonzero("task execution dispatch recovery-blocked exited zero", recoveryBlockedJson);
  const parsedRecoveryBlockedJson = parseJsonOnlyStdout(
    "task execution dispatch recovery-blocked output was not valid JSON only",
    recoveryBlockedJson,
  );
  expectTaskExecutionDispatchErrorJsonShape(
    "task execution dispatch recovery-blocked did not fail closed",
    parsedRecoveryBlockedJson,
    "task_execution_production_dispatch_provider_recovery_not_ready",
    recoveryBlockedJson,
  );

  const dispatchEligible = await createDispatchCliFixture({
    rootPrefix: "aeos-cli-dispatch-eligible-",
    taskId: "TASK-CLI-DISPATCH-ELIGIBLE",
  });
  const eligibleDispatchJson = runCliFrom(dispatchEligible.rootPath, [
    "task",
    "execution",
    "dispatch",
    dispatchEligible.taskId,
    "--invocation-id",
    dispatchEligible.invocation.invocationId,
    "--expected-revision",
    "1",
    "--provider-profile",
    dispatchEligible.profile.providerProfileId,
    "--json",
  ], { env: dispatchEligible.secretEnv });
  expectExitCode("task execution dispatch eligible exited nonzero", eligibleDispatchJson, 0);
  const parsedEligibleDispatchJson = parseJsonOnlyStdout(
    "task execution dispatch eligible output was not valid JSON only",
    eligibleDispatchJson,
  );
  expectTaskExecutionDispatchSuccessJsonShape(
    "task execution dispatch eligible shape was invalid",
    parsedEligibleDispatchJson,
    eligibleDispatchJson,
  );
  if (
    parsedEligibleDispatchJson.status !== "production_dispatch_returned" ||
    parsedEligibleDispatchJson.realCallReady !== false ||
    parsedEligibleDispatchJson.providerOutcomeKnown !== true ||
    parsedEligibleDispatchJson.reconciliationRequired !== false ||
    parsedEligibleDispatchJson.postDispatchAuditWritten !== true ||
    eligibleDispatchJson.stdout.includes("cli-smoke-secret") ||
    eligibleDispatchJson.stdout.includes("completed") ||
    eligibleDispatchJson.stdout.includes("safeToRetry")
  ) {
    fail("task execution dispatch eligible lost safety semantics", eligibleDispatchJson);
  }
  const eligibleInvocationStatusJson = runCliFrom(dispatchEligible.rootPath, [
    "task",
    "execution",
    "invocation",
    "status",
    dispatchEligible.taskId,
    "--invocation-id",
    dispatchEligible.invocation.invocationId,
    "--json",
  ]);
  expectExitCode("task execution dispatch status after eligible exited nonzero", eligibleInvocationStatusJson, 0);
  const parsedEligibleInvocationStatusJson = parseJsonOnlyStdout(
    "task execution dispatch status after eligible output was not valid JSON only",
    eligibleInvocationStatusJson,
  );
  expectTaskExecutionInvocationStatusJsonShape(
    "task execution dispatch status after eligible shape was invalid",
    parsedEligibleInvocationStatusJson,
    eligibleInvocationStatusJson,
  );
  if (
    parsedEligibleInvocationStatusJson.invocation.lifecycle !== "returned" ||
    eligibleInvocationStatusJson.stdout.includes("cli-smoke-secret") ||
    eligibleInvocationStatusJson.stdout.includes("\"completed\":true") ||
    eligibleInvocationStatusJson.stdout.includes("\"verified\":true") ||
    eligibleInvocationStatusJson.stdout.includes("\"safeToRetry\":true")
  ) {
    fail("task execution dispatch status after eligible trusted provider completion claims", eligibleInvocationStatusJson);
  }
  const eligibleInvocationBytesBeforeRepeat = readFileSync(
    dispatchEligible.invocationPath,
    "utf8",
  );
  const claudeCanaryAuthorityOverrideJson = runCliFrom(dispatchEligible.rootPath, [
    "task",
    "execution",
    "claude-canary",
    dispatchEligible.taskId,
    "--invocation-id",
    dispatchEligible.invocation.invocationId,
    "--expected-revision",
    "1",
    "--expected-invocation-revision",
    "1",
    "--json",
    "--claude-arg",
    "--dangerously-skip-permissions",
  ]);
  expectNonzero(
    "task execution claude canary authority override exited zero",
    claudeCanaryAuthorityOverrideJson,
  );
  const parsedClaudeCanaryAuthorityOverrideJson = parseJsonOnlyStdout(
    "task execution claude canary authority override output was not valid JSON only",
    claudeCanaryAuthorityOverrideJson,
  );
  expectTaskExecutionClaudeCanaryErrorJsonShape(
    "task execution claude canary authority override did not fail closed",
    parsedClaudeCanaryAuthorityOverrideJson,
    "task_execution_claude_canary_authority_override_forbidden",
    claudeCanaryAuthorityOverrideJson,
  );
  const claudeWriteCanaryAuthorityOverrideJson = runCliFrom(dispatchEligible.rootPath, [
    "task",
    "execution",
    "claude-write-canary",
    dispatchEligible.taskId,
    "--invocation-id",
    dispatchEligible.invocation.invocationId,
    "--expected-revision",
    "1",
    "--expected-invocation-revision",
    "1",
    "--json",
    "--workspace",
    "/tmp/task-chosen-workspace",
  ]);
  expectNonzero(
    "task execution claude write canary authority override exited zero",
    claudeWriteCanaryAuthorityOverrideJson,
  );
  const parsedClaudeWriteCanaryAuthorityOverrideJson = parseJsonOnlyStdout(
    "task execution claude write canary authority override output was not valid JSON only",
    claudeWriteCanaryAuthorityOverrideJson,
  );
  if (
    parsedClaudeWriteCanaryAuthorityOverrideJson.ok !== false ||
    parsedClaudeWriteCanaryAuthorityOverrideJson.error?.code !==
      "task_execution_claude_canary_authority_override_forbidden" ||
    parsedClaudeWriteCanaryAuthorityOverrideJson.safety?.automatedRealClaudeCall !== false ||
    parsedClaudeWriteCanaryAuthorityOverrideJson.safety?.realCodexModelCall !== false ||
    parsedClaudeWriteCanaryAuthorityOverrideJson.safety?.shellExecuted !== false ||
    parsedClaudeWriteCanaryAuthorityOverrideJson.safety?.primaryApplyEnabled !== false ||
    parsedClaudeWriteCanaryAuthorityOverrideJson.safety?.automaticPatchApply !== false
  ) {
    fail(
      "task execution claude write canary authority override did not fail closed safely",
      claudeWriteCanaryAuthorityOverrideJson,
    );
  }
  const repeatedEligibleDispatchJson = runCliFrom(dispatchEligible.rootPath, [
    "task",
    "execution",
    "dispatch",
    dispatchEligible.taskId,
    "--invocation-id",
    dispatchEligible.invocation.invocationId,
    "--expected-revision",
    "1",
    "--provider-profile",
    dispatchEligible.profile.providerProfileId,
    "--json",
  ], { env: dispatchEligible.secretEnv });
  expectNonzero("task execution dispatch repeated eligible exited zero", repeatedEligibleDispatchJson);
  const parsedRepeatedEligibleDispatchJson = parseJsonOnlyStdout(
    "task execution dispatch repeated eligible output was not valid JSON only",
    repeatedEligibleDispatchJson,
  );
  expectTaskExecutionDispatchErrorJsonShape(
    "task execution dispatch repeated eligible did not fail closed",
    parsedRepeatedEligibleDispatchJson,
    "task_execution_dispatch_invocation_already_consumed",
    repeatedEligibleDispatchJson,
  );
  const eligiblePersistedInvocationAfterRepeat = JSON.parse(
    readFileSync(dispatchEligible.invocationPath, "utf8"),
  );
  if (
    eligiblePersistedInvocationAfterRepeat.lifecycle !== "returned" ||
    readFileSync(dispatchEligible.invocationPath, "utf8") !==
      eligibleInvocationBytesBeforeRepeat
  ) {
    fail("task execution dispatch repeated eligible mutated persisted provider result", repeatedEligibleDispatchJson);
  }

  const dispatchHuman = await createDispatchCliFixture({
    rootPrefix: "aeos-cli-dispatch-human-",
    taskId: "TASK-CLI-DISPATCH-HUMAN",
  });
  const eligibleDispatchHuman = runCliFrom(dispatchHuman.rootPath, [
    "task",
    "execution",
    "dispatch",
    dispatchHuman.taskId,
    "--invocation-id",
    dispatchHuman.invocation.invocationId,
    "--expected-revision",
    "1",
    "--provider-profile",
    dispatchHuman.profile.providerProfileId,
  ], { env: dispatchHuman.secretEnv });
  expectExitCode("task execution dispatch human eligible exited nonzero", eligibleDispatchHuman, 0);
  for (const forbiddenText of [
    "cli-smoke-secret",
    "completed",
    "safeToRetry",
    "verified",
    "Authorization",
    "Bearer",
  ]) {
    expectOutputExcludes(
      `task execution dispatch human leaked ${forbiddenText}`,
      eligibleDispatchHuman,
      forbiddenText,
    );
  }

  const unknownProfile = createTrustedDispatchProfile({
    providerProfileId: "trusted-cli-unknown",
    outcomeStatus: "outcome_unknown",
  });
  const dispatchUnknown = await createDispatchCliFixture({
    rootPrefix: "aeos-cli-dispatch-unknown-",
    taskId: "TASK-CLI-DISPATCH-UNKNOWN",
    profile: unknownProfile,
  });
  const unknownDispatchJson = runCliFrom(dispatchUnknown.rootPath, [
    "task",
    "execution",
    "dispatch",
    dispatchUnknown.taskId,
    "--invocation-id",
    dispatchUnknown.invocation.invocationId,
    "--expected-revision",
    "1",
    "--provider-profile",
    unknownProfile.providerProfileId,
    "--json",
  ], { env: dispatchUnknown.secretEnv });
  expectExitCode("task execution dispatch unknown outcome exited nonzero", unknownDispatchJson, 0);
  const parsedUnknownDispatchJson = parseJsonOnlyStdout(
    "task execution dispatch unknown outcome output was not valid JSON only",
    unknownDispatchJson,
  );
  expectTaskExecutionDispatchSuccessJsonShape(
    "task execution dispatch unknown outcome shape was invalid",
    parsedUnknownDispatchJson,
    unknownDispatchJson,
  );
  if (
    parsedUnknownDispatchJson.status !== "production_dispatch_outcome_unknown" ||
    parsedUnknownDispatchJson.providerOutcomeKnown !== false ||
    parsedUnknownDispatchJson.reconciliationRequired !== true
  ) {
    fail("task execution dispatch unknown outcome did not require reconciliation", unknownDispatchJson);
  }
  const repeatedUnknownDispatchJson = runCliFrom(dispatchUnknown.rootPath, [
    "task",
    "execution",
    "dispatch",
    dispatchUnknown.taskId,
    "--invocation-id",
    dispatchUnknown.invocation.invocationId,
    "--expected-revision",
    "1",
    "--provider-profile",
    unknownProfile.providerProfileId,
    "--json",
  ], { env: dispatchUnknown.secretEnv });
  expectNonzero("task execution dispatch repeated unknown exited zero", repeatedUnknownDispatchJson);
  const parsedRepeatedUnknownDispatchJson = parseJsonOnlyStdout(
    "task execution dispatch repeated unknown output was not valid JSON only",
    repeatedUnknownDispatchJson,
  );
  expectTaskExecutionDispatchErrorJsonShape(
    "task execution dispatch repeated unknown did not fail closed",
    parsedRepeatedUnknownDispatchJson,
    "task_execution_dispatch_invocation_already_consumed",
    repeatedUnknownDispatchJson,
  );
  const unknownPersistedInvocationAfterRepeat = JSON.parse(
    readFileSync(dispatchUnknown.invocationPath, "utf8"),
  );
  if (unknownPersistedInvocationAfterRepeat.lifecycle !== "outcome_unknown") {
    fail("task execution dispatch repeated unknown redispatched or changed outcome", repeatedUnknownDispatchJson);
  }

  const canonicalDispatchWorkItems = Array.from({ length: 400 }, (_, index) => ({
    id: `dispatch-canonical-work-${index + 1}`,
    state: index < 20 ? "failed" : "pending",
    batchId: "dispatch-canonical-batch",
  }));
  const dispatchCanonical = await createDispatchCliFixture({
    rootPrefix: "aeos-cli-dispatch-canonical-",
    taskId: "TASK-CLI-DISPATCH-CANONICAL-400-20",
    stateOverrides: {
      workItems: canonicalDispatchWorkItems,
      batches: [
        {
          id: "dispatch-canonical-batch",
          workItemIds: canonicalDispatchWorkItems.map((workItem) => workItem.id),
          expectedItemCount: 400,
          completedCount: 0,
          failedCount: 20,
          skippedCount: 0,
          retryableCount: 0,
        },
      ],
      pendingWorkItemIds: canonicalDispatchWorkItems
        .filter((workItem) => workItem.state === "pending")
        .map((workItem) => workItem.id),
      retryableWorkItemIds: [],
      currentBatchId: "dispatch-canonical-batch",
      nextBatchId: "dispatch-canonical-batch",
      plan: {
        status: "planned",
        summary: {
          workItemCount: 400,
          batchCount: 1,
          stepCount: 1,
          verifierRequired: true,
          approvalRequired: false,
          issueCount: 0,
        },
      },
    },
  });
  const canonicalDispatchJson = runCliFrom(dispatchCanonical.rootPath, [
    "task",
    "execution",
    "dispatch",
    dispatchCanonical.taskId,
    "--invocation-id",
    dispatchCanonical.invocation.invocationId,
    "--expected-revision",
    "1",
    "--provider-profile",
    dispatchCanonical.profile.providerProfileId,
    "--json",
  ], { env: dispatchCanonical.secretEnv });
  expectExitCode("400/20 task execution dispatch exited nonzero", canonicalDispatchJson, 0);
  const parsedCanonicalDispatchJson = parseJsonOnlyStdout(
    "400/20 task execution dispatch output was not valid JSON only",
    canonicalDispatchJson,
  );
  expectTaskExecutionDispatchSuccessJsonShape(
    "400/20 task execution dispatch shape was invalid",
    parsedCanonicalDispatchJson,
    canonicalDispatchJson,
  );
  const dispatchCanonicalStateAfter = JSON.parse(
    readFileSync(dispatchCanonical.statePath, "utf8"),
  );
  if (
    dispatchCanonicalStateAfter.workItems.length !== 400 ||
    dispatchCanonicalStateAfter.pendingWorkItemIds.length !== 380 ||
    dispatchCanonicalStateAfter.batches[0]?.failedCount !== 20 ||
    dispatchCanonicalStateAfter.completionGate.completed !== false ||
    dispatchCanonicalStateAfter.completionGate.verified !== false ||
    dispatchCanonicalStateAfter.safety.completed !== false ||
    dispatchCanonicalStateAfter.safety.verified !== false
  ) {
    fail("400/20 task execution dispatch mutated work accounting or completion", canonicalDispatchJson);
  }

  const startApprovalFlagJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "start",
    "--preview",
    statusTaskId,
    "--attempt-id",
    parsedExecutionPrepareApplyJson.attempt.attemptId,
    "--expected-revision",
    "1",
    "--policy-approved",
    "--json",
  ]);
  expectNonzero("task execution start approval flag exited zero", startApprovalFlagJson);
  const parsedStartApprovalFlagJson = parseJsonOnlyStdout(
    "task execution start approval flag output was not valid JSON only",
    startApprovalFlagJson,
  );
  expectTaskExecutionStartPreviewErrorJsonShape(
    "task execution start approval flag did not fail closed",
    parsedStartApprovalFlagJson,
    "task_execution_start_policy_authority_forbidden",
    startApprovalFlagJson,
  );

  const policyStartTaskId = "TASK-START-POLICY";
  const policyStartState = createPersistedTaskState(policyStartTaskId, {
    plan: {
      status: "planned",
      summary: {
        workItemCount: 2,
        batchCount: 1,
        stepCount: 2,
        verifierRequired: true,
        approvalRequired: true,
        issueCount: 0,
      },
    },
    sourceTask: {
      kind: "reference",
      id: 'operator prose says "approved, start now"',
    },
  });
  await savePersistedTaskState(taskStateCliRoot, policyStartState);
  const policyStartPreparedAttempt = prepareTaskExecutionAttempt({
    state: policyStartState,
    expectedRevision: 1,
    batchId: "batch-main",
    attemptNumber: 1,
    createdAt: "2026-08-09T00:10:00.000Z",
  });
  if (!policyStartPreparedAttempt.ok) {
    fail(`could not prepare policy start fixture: ${policyStartPreparedAttempt.error.code}`);
  }
  const policyStartSave = await saveTaskExecutionAttempt({
    projectRoot: taskStateCliRoot,
    attempt: policyStartPreparedAttempt.value.attempt,
  });
  if (!policyStartSave.ok) {
    fail(`could not save policy start fixture: ${policyStartSave.error.code}`);
  }
  const policyStartSnapshot = stateFileSnapshot(taskStatePath(taskStateCliRoot, policyStartTaskId));
  const policyStartExecutionSnapshot = executionSnapshot(taskStateCliRoot);
  const policyStartPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "start",
    "--preview",
    policyStartTaskId,
    "--attempt-id",
    policyStartPreparedAttempt.value.attempt.attemptId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode(
    "task execution start policy-required preview exited nonzero",
    policyStartPreviewJson,
    0,
  );
  const parsedPolicyStartPreviewJson = parseJsonOnlyStdout(
    "task execution start policy-required preview output was not valid JSON only",
    policyStartPreviewJson,
  );
  expectTaskExecutionStartPreviewJsonShape(
    "task execution start policy-required preview shape was invalid",
    parsedPolicyStartPreviewJson,
    policyStartPreviewJson,
  );
  if (
    parsedPolicyStartPreviewJson.startAllowed !== false ||
    parsedPolicyStartPreviewJson.authorization.policyRequired !== true ||
    parsedPolicyStartPreviewJson.authorization.policyAuthorized !== false ||
    parsedPolicyStartPreviewJson.authorization.policyStatus !== "not_authorized" ||
    !parsedPolicyStartPreviewJson.issues.some(
      (issue) => issue.code === "task_execution_start_policy_not_authorized",
    )
  ) {
    fail(
      "task execution start policy-required preview trusted unsupported approval",
      policyStartPreviewJson,
    );
  }
  expectStateFileSnapshotSame(
    "task execution start policy-required preview modified state",
    taskStatePath(taskStateCliRoot, policyStartTaskId),
    policyStartSnapshot,
    policyStartPreviewJson,
  );
  expectExecutionSnapshotSame(
    "task execution start policy-required preview changed execution files",
    taskStateCliRoot,
    policyStartExecutionSnapshot,
    policyStartPreviewJson,
  );
  const policyStartApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "start",
    policyStartTaskId,
    "--attempt-id",
    policyStartPreparedAttempt.value.attempt.attemptId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution start policy-required apply exited zero", policyStartApplyJson);
  const parsedPolicyStartApplyJson = parseJsonOnlyStdout(
    "task execution start policy-required apply output was not valid JSON only",
    policyStartApplyJson,
  );
  expectTaskExecutionStartApplyErrorJsonShape(
    "task execution start policy-required apply did not fail closed",
    parsedPolicyStartApplyJson,
    "task_execution_start_policy_not_authorized",
    policyStartApplyJson,
  );
  expectStateFileSnapshotSame(
    "task execution start policy-required apply modified state",
    taskStatePath(taskStateCliRoot, policyStartTaskId),
    policyStartSnapshot,
    policyStartApplyJson,
  );
  expectExecutionSnapshotSame(
    "task execution start policy-required apply changed execution files",
    taskStateCliRoot,
    policyStartExecutionSnapshot,
    policyStartApplyJson,
  );

  const collisionPreparedAttempt = prepareTaskExecutionAttempt({
    state: JSON.parse(readFileSync(statusStatePath, "utf8")),
    expectedRevision: 1,
    batchId: "batch-main",
    attemptNumber: 2,
    createdAt: "2026-08-09T00:00:00.000Z",
  });
  if (!collisionPreparedAttempt.ok) {
    fail(`could not prepare collision attempt: ${collisionPreparedAttempt.error.code}`);
  }
  const collisionSave = await saveTaskExecutionAttempt({
    projectRoot: taskStateCliRoot,
    attempt: collisionPreparedAttempt.value.attempt,
  });
  if (!collisionSave.ok) {
    fail(`could not save collision attempt: ${collisionSave.error.code}`);
  }
  const collisionStateSnapshot = stateFileSnapshot(statusStatePath);
  const collisionExecutionSnapshot = executionSnapshot(taskStateCliRoot);
  const collisionExecutionPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "prepare",
    "--preview",
    statusTaskId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode("task execution preparation next-authority preview exited nonzero", collisionExecutionPreviewJson, 0);
  const parsedCollisionExecutionPreviewJson = parseJsonOnlyStdout(
    "task execution preparation next-authority preview output was not valid JSON only",
    collisionExecutionPreviewJson,
  );
  expectTaskExecutionPreparationPreviewJsonShape(
    "task execution preparation next-authority preview shape was invalid",
    parsedCollisionExecutionPreviewJson,
    collisionExecutionPreviewJson,
  );
  if (
    parsedCollisionExecutionPreviewJson.attempt.attemptNumber !== 3 ||
    !parsedCollisionExecutionPreviewJson.attempt.attemptId.startsWith(
      "attempt-TASK-STATUS-SMOKE-r1-n3-",
    )
  ) {
    fail(
      "task execution preparation next-authority preview did not skip existing identities",
      collisionExecutionPreviewJson,
    );
  }
  expectStateFileSnapshotSame(
    "task execution preparation collision modified state",
    statusStatePath,
    collisionStateSnapshot,
    collisionExecutionPreviewJson,
  );
  expectExecutionSnapshotSame(
    "task execution preparation collision changed execution files",
    taskStateCliRoot,
    collisionExecutionSnapshot,
    collisionExecutionPreviewJson,
  );
  const supersedingPreparedAttempt = prepareTaskExecutionAttempt({
    state: JSON.parse(readFileSync(statusStatePath, "utf8")),
    expectedRevision: 1,
    batchId: "batch-main",
    attemptNumber: 3,
    createdAt: "2026-08-09T00:00:01.000Z",
  });
  if (!supersedingPreparedAttempt.ok) {
    fail(`could not prepare superseding attempt: ${supersedingPreparedAttempt.error.code}`);
  }
  const supersedingSave = await saveTaskExecutionAttempt({
    projectRoot: taskStateCliRoot,
    attempt: supersedingPreparedAttempt.value.attempt,
  });
  if (!supersedingSave.ok) {
    fail(`could not save superseding attempt: ${supersedingSave.error.code}`);
  }
  const supersededStateSnapshot = stateFileSnapshot(statusStatePath);
  const supersededExecutionSnapshot = executionSnapshot(taskStateCliRoot);
  const obsoleteStartApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "start",
    statusTaskId,
    "--attempt-id",
    collisionPreparedAttempt.value.attempt.attemptId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution obsolete start apply exited zero", obsoleteStartApplyJson);
  const parsedObsoleteStartApplyJson = parseJsonOnlyStdout(
    "task execution obsolete start apply output was not valid JSON only",
    obsoleteStartApplyJson,
  );
  expectTaskExecutionStartApplyErrorJsonShape(
    "task execution obsolete start apply did not fail closed",
    parsedObsoleteStartApplyJson,
    "task_execution_start_attempt_number_obsolete",
    obsoleteStartApplyJson,
  );
  expectStateFileSnapshotSame(
    "task execution obsolete start apply modified state",
    statusStatePath,
    supersededStateSnapshot,
    obsoleteStartApplyJson,
  );
  expectExecutionSnapshotSame(
    "task execution obsolete start apply changed execution files",
    taskStateCliRoot,
    supersededExecutionSnapshot,
    obsoleteStartApplyJson,
  );

  const staleApplyTaskId = "TASK-PREPARE-STALE-APPLY";
  const staleApplyStatePath = await savePersistedTaskState(
    taskStateCliRoot,
    createPersistedTaskState(staleApplyTaskId),
  );
  const staleApplyPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "prepare",
    "--preview",
    staleApplyTaskId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode("stale apply setup preview exited nonzero", staleApplyPreviewJson, 0);
  const staleApplyTransitionJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    staleApplyTaskId,
    "--intent",
    "require_verification",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode("stale apply setup transition exited nonzero", staleApplyTransitionJson, 0);
  const staleApplySnapshotAfterTransition = stateFileSnapshot(staleApplyStatePath);
  const staleApplyExecutionSnapshotBefore = executionSnapshot(taskStateCliRoot);
  const stalePreparationApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "prepare",
    staleApplyTaskId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution preparation stale apply exited zero", stalePreparationApplyJson);
  const parsedStalePreparationApplyJson = parseJsonOnlyStdout(
    "task execution preparation stale apply output was not valid JSON only",
    stalePreparationApplyJson,
  );
  expectTaskExecutionPreparationApplyErrorJsonShape(
    "task execution preparation stale apply did not fail closed",
    parsedStalePreparationApplyJson,
    "task_state_revision_conflict",
    stalePreparationApplyJson,
  );
  expectStateFileSnapshotSame(
    "task execution preparation stale apply modified task state",
    staleApplyStatePath,
    staleApplySnapshotAfterTransition,
    stalePreparationApplyJson,
  );
  expectExecutionSnapshotSame(
    "task execution preparation stale apply persisted attempt",
    taskStateCliRoot,
    staleApplyExecutionSnapshotBefore,
    stalePreparationApplyJson,
  );

  const toctouTaskId = "TASK-START-TOCTOU";
  const toctouStatePath = await savePersistedTaskState(
    taskStateCliRoot,
    createPersistedTaskState(toctouTaskId),
  );
  const toctouPrepareJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "prepare",
    toctouTaskId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode("task execution start TOCTOU prepare exited nonzero", toctouPrepareJson, 0);
  const parsedToctouPrepareJson = parseJsonOnlyStdout(
    "task execution start TOCTOU prepare output was not valid JSON only",
    toctouPrepareJson,
  );
  const toctouStartPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "start",
    "--preview",
    toctouTaskId,
    "--attempt-id",
    parsedToctouPrepareJson.attempt.attemptId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode("task execution start TOCTOU initial preview exited nonzero", toctouStartPreviewJson, 0);
  const parsedToctouStartPreviewJson = parseJsonOnlyStdout(
    "task execution start TOCTOU initial preview output was not valid JSON only",
    toctouStartPreviewJson,
  );
  expectTaskExecutionStartPreviewJsonShape(
    "task execution start TOCTOU initial preview shape was invalid",
    parsedToctouStartPreviewJson,
    toctouStartPreviewJson,
  );
  if (parsedToctouStartPreviewJson.startAllowed !== true) {
    fail("task execution start TOCTOU initial preview was not allowed", toctouStartPreviewJson);
  }
  const toctouTransitionJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    toctouTaskId,
    "--intent",
    "require_verification",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode("task execution start TOCTOU transition exited nonzero", toctouTransitionJson, 0);
  const toctouSnapshotAfterTransition = stateFileSnapshot(toctouStatePath);
  const toctouExecutionSnapshotAfterTransition = executionSnapshot(taskStateCliRoot);
  const staleToctouStartPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "start",
    "--preview",
    toctouTaskId,
    "--attempt-id",
    parsedToctouPrepareJson.attempt.attemptId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution start TOCTOU stale preview exited zero", staleToctouStartPreviewJson);
  const parsedStaleToctouStartPreviewJson = parseJsonOnlyStdout(
    "task execution start TOCTOU stale preview output was not valid JSON only",
    staleToctouStartPreviewJson,
  );
  expectTaskExecutionStartPreviewErrorJsonShape(
    "task execution start TOCTOU stale preview did not fail closed",
    parsedStaleToctouStartPreviewJson,
    "task_execution_start_expected_revision_mismatch",
    staleToctouStartPreviewJson,
  );
  expectStateFileSnapshotSame(
    "task execution start TOCTOU stale preview modified state",
    toctouStatePath,
    toctouSnapshotAfterTransition,
    staleToctouStartPreviewJson,
  );
  expectExecutionSnapshotSame(
    "task execution start TOCTOU stale preview changed execution files",
    taskStateCliRoot,
    toctouExecutionSnapshotAfterTransition,
    staleToctouStartPreviewJson,
  );
  const staleToctouStartApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "start",
    toctouTaskId,
    "--attempt-id",
    parsedToctouPrepareJson.attempt.attemptId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution start TOCTOU stale apply exited zero", staleToctouStartApplyJson);
  const parsedStaleToctouStartApplyJson = parseJsonOnlyStdout(
    "task execution start TOCTOU stale apply output was not valid JSON only",
    staleToctouStartApplyJson,
  );
  expectTaskExecutionStartApplyErrorJsonShape(
    "task execution start TOCTOU stale apply did not fail closed",
    parsedStaleToctouStartApplyJson,
    "task_execution_start_expected_revision_mismatch",
    staleToctouStartApplyJson,
  );
  expectStateFileSnapshotSame(
    "task execution start TOCTOU stale apply modified state",
    toctouStatePath,
    toctouSnapshotAfterTransition,
    staleToctouStartApplyJson,
  );
  expectExecutionSnapshotSame(
    "task execution start TOCTOU stale apply changed execution files",
    taskStateCliRoot,
    toctouExecutionSnapshotAfterTransition,
    staleToctouStartApplyJson,
  );

  const transitionFilesBefore = listRelativeFiles(taskStateCliRoot);
  const taskTransitionPreview = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    "--preview",
    statusTaskId,
    "--intent",
    "require_verification",
    "--expected-revision",
    "1",
  ]);
  expectExitCode("task state transition preview exited nonzero", taskTransitionPreview, 0);
  for (const expectedText of [
    "Task State Transition Preview",
    "Task id: TASK-STATUS-SMOKE",
    "Source revision: 1",
    "Expected revision: 1",
    "Current lifecycle: planned",
    "Intent: require_verification",
    "Target lifecycle: verification_required",
    "Transition allowed: true",
    "Write performed: false",
    "Revision changed: false",
    "Execution performed: false",
    "State modified: false",
    "Completed state created: false",
    "Verified state created: false",
  ]) {
    expectOutputIncludes(
      `task state transition preview human output missing ${expectedText}`,
      taskTransitionPreview,
      expectedText,
    );
  }
  expectStateFileSnapshotSame(
    "task state transition preview modified persisted state",
    statusStatePath,
    statusSnapshotBefore,
    taskTransitionPreview,
  );
  expectSameFiles(
    "task state transition preview created unexpected files",
    transitionFilesBefore,
    listRelativeFiles(taskStateCliRoot),
  );

  const taskTransitionPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    "--preview",
    statusTaskId,
    "--intent",
    "require_verification",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode(
    "task state transition preview --json exited nonzero",
    taskTransitionPreviewJson,
    0,
  );
  const parsedTaskTransitionPreviewJson = parseJsonOnlyStdout(
    "task state transition preview --json output was not valid JSON only",
    taskTransitionPreviewJson,
  );
  expectTaskStateTransitionPreviewJsonShape(
    "task state transition preview --json shape was invalid",
    parsedTaskTransitionPreviewJson,
    taskTransitionPreviewJson,
  );
  if (
    parsedTaskTransitionPreviewJson.taskId !== statusTaskId ||
    parsedTaskTransitionPreviewJson.sourceRevision !== 1 ||
    parsedTaskTransitionPreviewJson.expectedRevision !== 1 ||
    parsedTaskTransitionPreviewJson.currentLifecycle !== "planned" ||
    parsedTaskTransitionPreviewJson.intent !== "require_verification" ||
    parsedTaskTransitionPreviewJson.targetLifecycle !== "verification_required" ||
    parsedTaskTransitionPreviewJson.transitionAllowed !== true ||
    parsedTaskTransitionPreviewJson.transition?.from !== "planned" ||
    parsedTaskTransitionPreviewJson.transition?.to !== "verification_required" ||
    parsedTaskTransitionPreviewJson.transition?.evidenceKind !==
      "verification_requirement" ||
    parsedTaskTransitionPreviewJson.evidence.provided !==
      "verification_requirement" ||
    parsedTaskTransitionPreviewJson.issues.length !== 0
  ) {
    fail(
      "task state transition preview --json did not expose authoritative evaluation",
      taskTransitionPreviewJson,
    );
  }
  expectStateFileSnapshotSame(
    "task state transition preview --json modified persisted state",
    statusStatePath,
    statusSnapshotBefore,
    taskTransitionPreviewJson,
  );

  const repeatedTaskTransitionPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    "--preview",
    statusTaskId,
    "--intent",
    "require_verification",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode(
    "repeated task state transition preview --json exited nonzero",
    repeatedTaskTransitionPreviewJson,
    0,
  );
  if (repeatedTaskTransitionPreviewJson.stdout !== taskTransitionPreviewJson.stdout) {
    fail(
      "repeated task state transition preview --json was not equivalent",
      repeatedTaskTransitionPreviewJson,
    );
  }

  const insufficientEvidencePreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    "--preview",
    statusTaskId,
    "--intent",
    "mark_dry_run_ready",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode(
    "task state transition preview insufficient evidence exited nonzero",
    insufficientEvidencePreviewJson,
    0,
  );
  const parsedInsufficientEvidencePreviewJson = parseJsonOnlyStdout(
    "task state transition preview insufficient evidence output was not valid JSON only",
    insufficientEvidencePreviewJson,
  );
  expectTaskStateTransitionPreviewJsonShape(
    "task state transition preview insufficient evidence shape was invalid",
    parsedInsufficientEvidencePreviewJson,
    insufficientEvidencePreviewJson,
  );
  if (
    parsedInsufficientEvidencePreviewJson.transitionAllowed !== false ||
    parsedInsufficientEvidencePreviewJson.transition !== null ||
    parsedInsufficientEvidencePreviewJson.evidence.provided !== null ||
    !parsedInsufficientEvidencePreviewJson.issues.some(
      (issue) => issue.code === "task_state_transition_dry_run_evidence_invalid",
    )
  ) {
    fail(
      "task state transition preview fabricated dry-run evidence",
      insufficientEvidencePreviewJson,
    );
  }
  expectStateFileSnapshotSame(
    "task state transition preview insufficient evidence modified state",
    statusStatePath,
    statusSnapshotBefore,
    insufficientEvidencePreviewJson,
  );

  const staleRevisionPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    "--preview",
    statusTaskId,
    "--intent",
    "require_verification",
    "--expected-revision",
    "2",
    "--json",
  ]);
  expectNonzero("task state transition stale revision exited zero", staleRevisionPreviewJson);
  const parsedStaleRevisionPreviewJson = parseJsonOnlyStdout(
    "task state transition stale revision output was not valid JSON only",
    staleRevisionPreviewJson,
  );
  expectTaskStateTransitionPreviewErrorJsonShape(
    "task state transition stale revision did not fail closed",
    parsedStaleRevisionPreviewJson,
    "task_state_revision_conflict",
    staleRevisionPreviewJson,
  );
  expectStateFileSnapshotSame(
    "task state transition stale revision modified state",
    statusStatePath,
    statusSnapshotBefore,
    staleRevisionPreviewJson,
  );

  for (const malformedRevision of ["0", "-1", "1.5", "abc"]) {
    const malformedRevisionPreviewJson = runCliFrom(taskStateCliRoot, [
      "task",
      "state",
      "transition",
      "--preview",
      statusTaskId,
      "--intent",
      "require_verification",
      "--expected-revision",
      malformedRevision,
      "--json",
    ]);
    expectNonzero(
      `task state transition malformed revision ${malformedRevision} exited zero`,
      malformedRevisionPreviewJson,
    );
    const parsedMalformedRevisionPreviewJson = parseJsonOnlyStdout(
      `task state transition malformed revision ${malformedRevision} output was not valid JSON only`,
      malformedRevisionPreviewJson,
    );
    expectTaskStateTransitionPreviewErrorJsonShape(
      `task state transition malformed revision ${malformedRevision} did not fail closed`,
      parsedMalformedRevisionPreviewJson,
      "task_state_transition_expected_revision_invalid",
      malformedRevisionPreviewJson,
    );
    expectStateFileSnapshotSame(
      `task state transition malformed revision ${malformedRevision} modified state`,
      statusStatePath,
      statusSnapshotBefore,
      malformedRevisionPreviewJson,
    );
  }

  const unknownIntentPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    "--preview",
    statusTaskId,
    "--intent",
    "unknown_intent",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task state transition unknown intent exited zero", unknownIntentPreviewJson);
  const parsedUnknownIntentPreviewJson = parseJsonOnlyStdout(
    "task state transition unknown intent output was not valid JSON only",
    unknownIntentPreviewJson,
  );
  expectTaskStateTransitionPreviewErrorJsonShape(
    "task state transition unknown intent did not fail closed",
    parsedUnknownIntentPreviewJson,
    "task_state_transition_unknown_intent",
    unknownIntentPreviewJson,
  );

  for (const terminalIntent of [
    "completed",
    "verified",
    "approved",
    "execution_success",
    "mark_completed",
    "mark_verified",
  ]) {
    const terminalPreviewJson = runCliFrom(taskStateCliRoot, [
      "task",
      "state",
      "transition",
      "--preview",
      statusTaskId,
      "--intent",
      terminalIntent,
      "--expected-revision",
      "1",
      "--json",
    ]);
    expectNonzero(
      `task state transition terminal intent ${terminalIntent} exited zero`,
      terminalPreviewJson,
    );
    const parsedTerminalPreviewJson = parseJsonOnlyStdout(
      `task state transition terminal intent ${terminalIntent} output was not valid JSON only`,
      terminalPreviewJson,
    );
    expectTaskStateTransitionPreviewErrorJsonShape(
      `task state transition terminal intent ${terminalIntent} did not fail closed`,
      parsedTerminalPreviewJson,
      "task_state_transition_terminal_forbidden",
      terminalPreviewJson,
    );
    expectStateFileSnapshotSame(
      `task state transition terminal intent ${terminalIntent} modified state`,
      statusStatePath,
      statusSnapshotBefore,
      terminalPreviewJson,
    );
  }

  const arbitraryTargetPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    "--preview",
    statusTaskId,
    "--to",
    "dry_run_ready",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task state transition arbitrary target exited zero", arbitraryTargetPreviewJson);
  const parsedArbitraryTargetPreviewJson = parseJsonOnlyStdout(
    "task state transition arbitrary target output was not valid JSON only",
    arbitraryTargetPreviewJson,
  );
  expectTaskStateTransitionPreviewErrorJsonShape(
    "task state transition arbitrary target did not fail closed",
    parsedArbitraryTargetPreviewJson,
    "task_state_transition_arbitrary_target_forbidden",
    arbitraryTargetPreviewJson,
  );

  const otherTaskStatePath = await savePersistedTaskState(
    taskStateCliRoot,
    createPersistedTaskState("TASK-WRITE-SCOPE-OTHER"),
  );
  const otherTaskSnapshot = stateFileSnapshot(otherTaskStatePath);
  const applyFilesBefore = listRelativeFiles(taskStateCliRoot);
  const transitionApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    statusTaskId,
    "--intent",
    "require_verification",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode("task state transition apply exited nonzero", transitionApplyJson, 0);
  const parsedTransitionApplyJson = parseJsonOnlyStdout(
    "task state transition apply output was not valid JSON only",
    transitionApplyJson,
  );
  expectTaskStateTransitionApplyJsonShape(
    "task state transition apply shape was invalid",
    parsedTransitionApplyJson,
    transitionApplyJson,
  );
  if (
    parsedTransitionApplyJson.taskId !== statusTaskId ||
    parsedTransitionApplyJson.intent !== "require_verification" ||
    parsedTransitionApplyJson.previousRevision !== 1 ||
    parsedTransitionApplyJson.revision !== 2 ||
    parsedTransitionApplyJson.previousLifecycle !== "planned" ||
    parsedTransitionApplyJson.lifecycle !== "verification_required"
  ) {
    fail("task state transition apply did not report persisted transition", transitionApplyJson);
  }
  expectSameFiles(
    "task state transition apply created unexpected files",
    applyFilesBefore,
    listRelativeFiles(taskStateCliRoot),
  );
  expectStateFileSnapshotSame(
    "task state transition apply modified unrelated task state",
    otherTaskStatePath,
    otherTaskSnapshot,
    transitionApplyJson,
  );

  const appliedState = JSON.parse(readFileSync(statusStatePath, "utf8"));
  if (
    appliedState.revision !== 2 ||
    appliedState.lifecycleState !== "verification_required" ||
    appliedState.taskId !== statusTaskId ||
    appliedState.verifier.status !== "required_not_run" ||
    appliedState.completionGate.status !== "verification_required" ||
    appliedState.completionGate.completed !== false ||
    appliedState.completionGate.verified !== false ||
    appliedState.safety.executionPerformed !== false ||
    appliedState.safety.verifierRun !== false ||
    appliedState.safety.completed !== false ||
    appliedState.safety.verified !== false
  ) {
    fail("task state transition apply persisted unsafe or incomplete state", transitionApplyJson);
  }
  const appliedSnapshot = stateFileSnapshot(statusStatePath);

  const staleApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    statusTaskId,
    "--intent",
    "require_verification",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task state transition stale apply exited zero", staleApplyJson);
  const parsedStaleApplyJson = parseJsonOnlyStdout(
    "task state transition stale apply output was not valid JSON only",
    staleApplyJson,
  );
  expectTaskStateTransitionApplyErrorJsonShape(
    "task state transition stale apply did not fail closed",
    parsedStaleApplyJson,
    "task_state_revision_conflict",
    staleApplyJson,
  );
  expectStateFileSnapshotSame(
    "task state transition stale apply modified state",
    statusStatePath,
    appliedSnapshot,
    staleApplyJson,
  );

  const missingRevisionApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    statusTaskId,
    "--intent",
    "mark_blocked",
    "--json",
  ]);
  expectNonzero("task state transition missing revision apply exited zero", missingRevisionApplyJson);
  const parsedMissingRevisionApplyJson = parseJsonOnlyStdout(
    "task state transition missing revision apply output was not valid JSON only",
    missingRevisionApplyJson,
  );
  expectTaskStateTransitionApplyErrorJsonShape(
    "task state transition missing revision apply did not fail closed",
    parsedMissingRevisionApplyJson,
    "task_state_transition_expected_revision_required",
    missingRevisionApplyJson,
  );
  expectStateFileSnapshotSame(
    "task state transition missing revision apply modified state",
    statusStatePath,
    appliedSnapshot,
    missingRevisionApplyJson,
  );

  for (const malformedRevision of ["0", "-1", "1.5", "abc"]) {
    const malformedRevisionApplyJson = runCliFrom(taskStateCliRoot, [
      "task",
      "state",
      "transition",
      statusTaskId,
      "--intent",
      "mark_blocked",
      "--expected-revision",
      malformedRevision,
      "--json",
    ]);
    expectNonzero(
      `task state transition malformed revision apply ${malformedRevision} exited zero`,
      malformedRevisionApplyJson,
    );
    const parsedMalformedRevisionApplyJson = parseJsonOnlyStdout(
      `task state transition malformed revision apply ${malformedRevision} output was not valid JSON only`,
      malformedRevisionApplyJson,
    );
    expectTaskStateTransitionApplyErrorJsonShape(
      `task state transition malformed revision apply ${malformedRevision} did not fail closed`,
      parsedMalformedRevisionApplyJson,
      "task_state_transition_expected_revision_invalid",
      malformedRevisionApplyJson,
    );
    expectStateFileSnapshotSame(
      `task state transition malformed revision apply ${malformedRevision} modified state`,
      statusStatePath,
      appliedSnapshot,
      malformedRevisionApplyJson,
    );
  }

  const unknownIntentApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    statusTaskId,
    "--intent",
    "unknown_intent",
    "--expected-revision",
    "2",
    "--json",
  ]);
  expectNonzero("task state transition unknown intent apply exited zero", unknownIntentApplyJson);
  const parsedUnknownIntentApplyJson = parseJsonOnlyStdout(
    "task state transition unknown intent apply output was not valid JSON only",
    unknownIntentApplyJson,
  );
  expectTaskStateTransitionApplyErrorJsonShape(
    "task state transition unknown intent apply did not fail closed",
    parsedUnknownIntentApplyJson,
    "task_state_transition_unknown_intent",
    unknownIntentApplyJson,
  );
  expectStateFileSnapshotSame(
    "task state transition unknown intent apply modified state",
    statusStatePath,
    appliedSnapshot,
    unknownIntentApplyJson,
  );

  const terminalIntentApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    statusTaskId,
    "--intent",
    "mark_completed",
    "--expected-revision",
    "2",
    "--json",
  ]);
  expectNonzero("task state transition terminal intent apply exited zero", terminalIntentApplyJson);
  const parsedTerminalIntentApplyJson = parseJsonOnlyStdout(
    "task state transition terminal intent apply output was not valid JSON only",
    terminalIntentApplyJson,
  );
  expectTaskStateTransitionApplyErrorJsonShape(
    "task state transition terminal intent apply did not fail closed",
    parsedTerminalIntentApplyJson,
    "task_state_transition_terminal_forbidden",
    terminalIntentApplyJson,
  );
  expectStateFileSnapshotSame(
    "task state transition terminal intent apply modified state",
    statusStatePath,
    appliedSnapshot,
    terminalIntentApplyJson,
  );

  const insufficientEvidenceApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    statusTaskId,
    "--intent",
    "mark_blocked",
    "--expected-revision",
    "2",
    "--json",
  ]);
  expectNonzero("task state transition insufficient evidence apply exited zero", insufficientEvidenceApplyJson);
  const parsedInsufficientEvidenceApplyJson = parseJsonOnlyStdout(
    "task state transition insufficient evidence apply output was not valid JSON only",
    insufficientEvidenceApplyJson,
  );
  expectTaskStateTransitionApplyErrorJsonShape(
    "task state transition insufficient evidence apply did not fail closed",
    parsedInsufficientEvidenceApplyJson,
    "task_state_transition_blocked_evidence_invalid",
    insufficientEvidenceApplyJson,
  );
  expectStateFileSnapshotSame(
    "task state transition insufficient evidence apply modified state",
    statusStatePath,
    appliedSnapshot,
    insufficientEvidenceApplyJson,
  );

  const statusAfterApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "status",
    statusTaskId,
    "--json",
  ]);
  expectExitCode("task status after transition apply exited nonzero", statusAfterApplyJson, 0);
  const parsedStatusAfterApplyJson = parseJsonOnlyStdout(
    "task status after transition apply output was not valid JSON only",
    statusAfterApplyJson,
  );
  expectTaskStatusJsonShape(
    "task status after transition apply shape was invalid",
    parsedStatusAfterApplyJson,
    statusAfterApplyJson,
  );
  if (
    parsedStatusAfterApplyJson.taskId !== statusTaskId ||
    parsedStatusAfterApplyJson.revision !== 2 ||
    parsedStatusAfterApplyJson.lifecycle !== "verification_required" ||
    parsedStatusAfterApplyJson.state.completionGate.completed !== false ||
    parsedStatusAfterApplyJson.state.completionGate.verified !== false
  ) {
    fail("task status after transition apply did not read updated state", statusAfterApplyJson);
  }
  expectStateFileSnapshotSame(
    "task status after transition apply modified state",
    statusStatePath,
    appliedSnapshot,
    statusAfterApplyJson,
  );

  const resumeAfterApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "resume",
    "--preview",
    statusTaskId,
    "--json",
  ]);
  expectExitCode("task resume preview after transition apply exited nonzero", resumeAfterApplyJson, 0);
  const parsedResumeAfterApplyJson = parseJsonOnlyStdout(
    "task resume preview after transition apply output was not valid JSON only",
    resumeAfterApplyJson,
  );
  expectTaskResumePreviewJsonShape(
    "task resume preview after transition apply shape was invalid",
    parsedResumeAfterApplyJson,
    resumeAfterApplyJson,
  );
  if (
    parsedResumeAfterApplyJson.sourceRevision !== 2 ||
    parsedResumeAfterApplyJson.lifecycle !== "verification_required" ||
    parsedResumeAfterApplyJson.resume.remainingWorkCount !== 2
  ) {
    fail("task resume preview after transition apply did not derive from updated state", resumeAfterApplyJson);
  }
  expectStateFileSnapshotSame(
    "task resume preview after transition apply modified state",
    statusStatePath,
    appliedSnapshot,
    resumeAfterApplyJson,
  );

  const oldRevisionPreviewAfterApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    "--preview",
    statusTaskId,
    "--intent",
    "require_verification",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task state transition old preview after apply exited zero", oldRevisionPreviewAfterApplyJson);
  const parsedOldRevisionPreviewAfterApplyJson = parseJsonOnlyStdout(
    "task state transition old preview after apply output was not valid JSON only",
    oldRevisionPreviewAfterApplyJson,
  );
  expectTaskStateTransitionPreviewErrorJsonShape(
    "task state transition old preview after apply did not fail stale",
    parsedOldRevisionPreviewAfterApplyJson,
    "task_state_revision_conflict",
    oldRevisionPreviewAfterApplyJson,
  );

  const newRevisionPreviewAfterApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    "--preview",
    statusTaskId,
    "--intent",
    "require_verification",
    "--expected-revision",
    "2",
    "--json",
  ]);
  expectExitCode("task state transition new preview after apply exited nonzero", newRevisionPreviewAfterApplyJson, 0);
  const parsedNewRevisionPreviewAfterApplyJson = parseJsonOnlyStdout(
    "task state transition new preview after apply output was not valid JSON only",
    newRevisionPreviewAfterApplyJson,
  );
  expectTaskStateTransitionPreviewJsonShape(
    "task state transition new preview after apply shape was invalid",
    parsedNewRevisionPreviewAfterApplyJson,
    newRevisionPreviewAfterApplyJson,
  );
  if (
    parsedNewRevisionPreviewAfterApplyJson.sourceRevision !== 2 ||
    parsedNewRevisionPreviewAfterApplyJson.currentLifecycle !== "verification_required" ||
    parsedNewRevisionPreviewAfterApplyJson.transitionAllowed !== false ||
    !parsedNewRevisionPreviewAfterApplyJson.issues.some(
      (issue) => issue.code === "task_state_transition_same_state_forbidden",
    )
  ) {
    fail("task state transition new preview after apply did not evaluate updated state", newRevisionPreviewAfterApplyJson);
  }
  expectStateFileSnapshotSame(
    "task state transition preview after apply modified state",
    statusStatePath,
    appliedSnapshot,
    newRevisionPreviewAfterApplyJson,
  );

  const taskResumeExecutionJson = runCliFrom(taskStateCliRoot, [
    "task",
    "resume",
    statusTaskId,
    "--json",
  ]);
  expectNonzero("task resume without --preview exited zero", taskResumeExecutionJson);
  const parsedTaskResumeExecutionJson = parseJsonOnlyStdout(
    "task resume without --preview output was not valid JSON only",
    taskResumeExecutionJson,
  );
  expectTaskStateErrorJsonShape(
    "task resume without --preview did not use stable error",
    parsedTaskResumeExecutionJson,
    "task_resume_execution_not_implemented",
    taskResumeExecutionJson,
  );
  expectStateFileSnapshotSame(
    "task resume without --preview modified persisted state",
    statusStatePath,
    appliedSnapshot,
    taskResumeExecutionJson,
  );

  const missingRoot = mkdtempSync(join(tmpdir(), "aeos-cli-task-state-missing-"));
  const missingStatusJson = runCliFrom(missingRoot, [
    "task",
    "status",
    "TASK-MISSING",
    "--json",
  ]);
  expectNonzero("task status missing state exited zero", missingStatusJson);
  const parsedMissingStatusJson = parseJsonOnlyStdout(
    "task status missing state output was not valid JSON only",
    missingStatusJson,
  );
  expectTaskStateErrorJsonShape(
    "task status missing state did not fail closed",
    parsedMissingStatusJson,
    "task_state_not_found",
    missingStatusJson,
  );
  expectNoTaskStateCreated(
    "task status missing state created a state file",
    missingRoot,
    "TASK-MISSING",
    missingStatusJson,
  );
  if (existsSync(join(missingRoot, ".aeos"))) {
    fail("task status missing state created .aeos directory", missingStatusJson);
  }
  const missingTransitionJson = runCliFrom(missingRoot, [
    "task",
    "state",
    "transition",
    "--preview",
    "TASK-MISSING",
    "--intent",
    "require_verification",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task state transition missing state exited zero", missingTransitionJson);
  const parsedMissingTransitionJson = parseJsonOnlyStdout(
    "task state transition missing state output was not valid JSON only",
    missingTransitionJson,
  );
  expectTaskStateTransitionPreviewErrorJsonShape(
    "task state transition missing state did not fail closed",
    parsedMissingTransitionJson,
    "task_state_not_found",
    missingTransitionJson,
  );
  expectNoTaskStateCreated(
    "task state transition missing state created a state file",
    missingRoot,
    "TASK-MISSING",
    missingTransitionJson,
  );
  if (existsSync(join(missingRoot, ".aeos"))) {
    fail("task state transition missing state created .aeos directory", missingTransitionJson);
  }
  const missingExecutionPreviewJson = runCliFrom(missingRoot, [
    "task",
    "execution",
    "prepare",
    "--preview",
    "TASK-MISSING",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution preparation missing state exited zero", missingExecutionPreviewJson);
  const parsedMissingExecutionPreviewJson = parseJsonOnlyStdout(
    "task execution preparation missing state output was not valid JSON only",
    missingExecutionPreviewJson,
  );
  expectTaskExecutionPreparationErrorJsonShape(
    "task execution preparation missing state did not fail closed",
    parsedMissingExecutionPreviewJson,
    "task_state_not_found",
    missingExecutionPreviewJson,
  );
  if (existsSync(join(missingRoot, ".aeos"))) {
    fail("task execution preparation missing state created .aeos directory", missingExecutionPreviewJson);
  }
  const missingTransitionApplyJson = runCliFrom(missingRoot, [
    "task",
    "state",
    "transition",
    "TASK-MISSING",
    "--intent",
    "require_verification",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task state transition missing state apply exited zero", missingTransitionApplyJson);
  const parsedMissingTransitionApplyJson = parseJsonOnlyStdout(
    "task state transition missing state apply output was not valid JSON only",
    missingTransitionApplyJson,
  );
  expectTaskStateTransitionApplyErrorJsonShape(
    "task state transition missing state apply did not fail closed",
    parsedMissingTransitionApplyJson,
    "task_state_not_found",
    missingTransitionApplyJson,
  );
  expectNoTaskStateCreated(
    "task state transition missing state apply created a state file",
    missingRoot,
    "TASK-MISSING",
    missingTransitionApplyJson,
  );
  if (existsSync(join(missingRoot, ".aeos"))) {
    fail("task state transition missing state apply created .aeos directory", missingTransitionApplyJson);
  }
  rmSync(missingRoot, { recursive: true, force: true });

  const corruptTaskId = "TASK-CORRUPT";
  const corruptRoot = mkdtempSync(join(tmpdir(), "aeos-cli-task-state-corrupt-"));
  mkdirSync(join(corruptRoot, ".aeos", "state", "tasks"), { recursive: true });
  writeFileSync(taskStatePath(corruptRoot, corruptTaskId), "{ corrupt json");
  const corruptStateBefore = readFileSync(taskStatePath(corruptRoot, corruptTaskId), "utf8");
  const corruptStateMtimeBefore = statSync(taskStatePath(corruptRoot, corruptTaskId)).mtimeMs;
  const corruptStatusJson = runCliFrom(corruptRoot, [
    "task",
    "status",
    corruptTaskId,
    "--json",
  ]);
  expectNonzero("task status corrupt state exited zero", corruptStatusJson);
  const parsedCorruptStatusJson = parseJsonOnlyStdout(
    "task status corrupt state output was not valid JSON only",
    corruptStatusJson,
  );
  expectTaskStateErrorJsonShape(
    "task status corrupt state did not fail closed",
    parsedCorruptStatusJson,
    "task_state_corrupt_json",
    corruptStatusJson,
  );
  const corruptTransitionJson = runCliFrom(corruptRoot, [
    "task",
    "state",
    "transition",
    "--preview",
    corruptTaskId,
    "--intent",
    "require_verification",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task state transition corrupt state exited zero", corruptTransitionJson);
  const parsedCorruptTransitionJson = parseJsonOnlyStdout(
    "task state transition corrupt state output was not valid JSON only",
    corruptTransitionJson,
  );
  expectTaskStateTransitionPreviewErrorJsonShape(
    "task state transition corrupt state did not fail closed",
    parsedCorruptTransitionJson,
    "task_state_corrupt_json",
    corruptTransitionJson,
  );
  const corruptExecutionPreviewJson = runCliFrom(corruptRoot, [
    "task",
    "execution",
    "prepare",
    "--preview",
    corruptTaskId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution preparation corrupt state exited zero", corruptExecutionPreviewJson);
  const parsedCorruptExecutionPreviewJson = parseJsonOnlyStdout(
    "task execution preparation corrupt state output was not valid JSON only",
    corruptExecutionPreviewJson,
  );
  expectTaskExecutionPreparationErrorJsonShape(
    "task execution preparation corrupt state did not fail closed",
    parsedCorruptExecutionPreviewJson,
    "task_state_corrupt_json",
    corruptExecutionPreviewJson,
  );
  const corruptTransitionApplyJson = runCliFrom(corruptRoot, [
    "task",
    "state",
    "transition",
    corruptTaskId,
    "--intent",
    "require_verification",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task state transition corrupt state apply exited zero", corruptTransitionApplyJson);
  const parsedCorruptTransitionApplyJson = parseJsonOnlyStdout(
    "task state transition corrupt state apply output was not valid JSON only",
    corruptTransitionApplyJson,
  );
  expectTaskStateTransitionApplyErrorJsonShape(
    "task state transition corrupt state apply did not fail closed",
    parsedCorruptTransitionApplyJson,
    "task_state_corrupt_json",
    corruptTransitionApplyJson,
  );
  if (
    readFileSync(taskStatePath(corruptRoot, corruptTaskId), "utf8") !== corruptStateBefore ||
    statSync(taskStatePath(corruptRoot, corruptTaskId)).mtimeMs !== corruptStateMtimeBefore
  ) {
    fail("task state transition corrupt state apply modified state", corruptTransitionApplyJson);
  }
  rmSync(corruptRoot, { recursive: true, force: true });

  for (const [taskId, candidate, expectedCode] of [
    [
      "TASK-INVALID-SCHEMA",
      createPersistedTaskState("TASK-INVALID-SCHEMA", { schemaVersion: 999 }),
      "task_state_schema_version_unsupported",
    ],
    [
      "TASK-INVALID-REVISION",
      createPersistedTaskState("TASK-INVALID-REVISION", { revision: 0 }),
      "task_state_invalid_revision",
    ],
    [
      "TASK-INVALID-PENDING",
      createPersistedTaskState("TASK-INVALID-PENDING", {
        pendingWorkItemIds: ["missing-work"],
        retryableWorkItemIds: [],
      }),
      "task_state_resume_id_unknown",
    ],
    [
      "TASK-INVALID-BATCH",
      createPersistedTaskState("TASK-INVALID-BATCH", {
        nextBatchId: "missing-batch",
      }),
      "task_state_batch_reference_unknown",
    ],
    [
      "TASK-FORGED-COMPLETED",
      createPersistedTaskState("TASK-FORGED-COMPLETED", {
        lifecycleState: "completed",
      }),
      "task_state_forbidden_lifecycle_state",
    ],
  ]) {
    const invalidRoot = mkdtempSync(join(tmpdir(), "aeos-cli-task-state-invalid-"));
    writePersistedTaskStateFixture(invalidRoot, taskId, candidate);
    const invalidStateBefore = readFileSync(taskStatePath(invalidRoot, taskId), "utf8");
    const invalidStateMtimeBefore = statSync(taskStatePath(invalidRoot, taskId)).mtimeMs;
    const invalidPreviewJson = runCliFrom(invalidRoot, [
      "task",
      "resume",
      "--preview",
      taskId,
      "--json",
    ]);
    expectNonzero(`${taskId} resume preview exited zero`, invalidPreviewJson);
    const parsedInvalidPreviewJson = parseJsonOnlyStdout(
      `${taskId} resume preview output was not valid JSON only`,
      invalidPreviewJson,
    );
    expectTaskStateErrorJsonShape(
      `${taskId} resume preview did not fail closed`,
      parsedInvalidPreviewJson,
      expectedCode,
      invalidPreviewJson,
    );
    const invalidTransitionJson = runCliFrom(invalidRoot, [
      "task",
      "state",
      "transition",
      "--preview",
      taskId,
      "--intent",
      "require_verification",
      "--expected-revision",
      "1",
      "--json",
    ]);
    expectNonzero(`${taskId} transition preview exited zero`, invalidTransitionJson);
    const parsedInvalidTransitionJson = parseJsonOnlyStdout(
      `${taskId} transition preview output was not valid JSON only`,
      invalidTransitionJson,
    );
    expectTaskStateTransitionPreviewErrorJsonShape(
      `${taskId} transition preview did not fail closed`,
      parsedInvalidTransitionJson,
      expectedCode,
      invalidTransitionJson,
    );
    const invalidExecutionPreviewJson = runCliFrom(invalidRoot, [
      "task",
      "execution",
      "prepare",
      "--preview",
      taskId,
      "--expected-revision",
      "1",
      "--json",
    ]);
    expectNonzero(`${taskId} execution preparation preview exited zero`, invalidExecutionPreviewJson);
    const parsedInvalidExecutionPreviewJson = parseJsonOnlyStdout(
      `${taskId} execution preparation preview output was not valid JSON only`,
      invalidExecutionPreviewJson,
    );
    expectTaskExecutionPreparationErrorJsonShape(
      `${taskId} execution preparation preview did not fail closed`,
      parsedInvalidExecutionPreviewJson,
      expectedCode,
      invalidExecutionPreviewJson,
    );
    const invalidTransitionApplyJson = runCliFrom(invalidRoot, [
      "task",
      "state",
      "transition",
      taskId,
      "--intent",
      "require_verification",
      "--expected-revision",
      "1",
      "--json",
    ]);
    expectNonzero(`${taskId} transition apply exited zero`, invalidTransitionApplyJson);
    const parsedInvalidTransitionApplyJson = parseJsonOnlyStdout(
      `${taskId} transition apply output was not valid JSON only`,
      invalidTransitionApplyJson,
    );
    expectTaskStateTransitionApplyErrorJsonShape(
      `${taskId} transition apply did not fail closed`,
      parsedInvalidTransitionApplyJson,
      expectedCode,
      invalidTransitionApplyJson,
    );
    if (
      readFileSync(taskStatePath(invalidRoot, taskId), "utf8") !== invalidStateBefore ||
      statSync(taskStatePath(invalidRoot, taskId)).mtimeMs !== invalidStateMtimeBefore
    ) {
      fail(`${taskId} transition apply modified invalid state`, invalidTransitionApplyJson);
    }
    rmSync(invalidRoot, { recursive: true, force: true });
  }

  const symlinkOutsideRoot = mkdtempSync(join(tmpdir(), "aeos-cli-task-state-outside-"));
  const symlinkFileRoot = mkdtempSync(join(tmpdir(), "aeos-cli-task-state-file-link-"));
  const symlinkFileTaskId = "TASK-SYMLINK-FILE";
  mkdirSync(join(symlinkFileRoot, ".aeos", "state", "tasks"), { recursive: true });
  writeFileSync(
    join(symlinkOutsideRoot, `${symlinkFileTaskId}.json`),
    `${JSON.stringify(createPersistedTaskState(symlinkFileTaskId), null, 2)}\n`,
  );
  symlinkSync(
    join(symlinkOutsideRoot, `${symlinkFileTaskId}.json`),
    taskStatePath(symlinkFileRoot, symlinkFileTaskId),
  );
  const symlinkStatusJson = runCliFrom(symlinkFileRoot, [
    "task",
    "status",
    symlinkFileTaskId,
    "--json",
  ]);
  expectNonzero("task status state-file symlink exited zero", symlinkStatusJson);
  const parsedSymlinkStatusJson = parseJsonOnlyStdout(
    "task status state-file symlink output was not valid JSON only",
    symlinkStatusJson,
  );
  expectTaskStateErrorJsonShape(
    "task status state-file symlink did not fail closed",
    parsedSymlinkStatusJson,
    "task_state_unsafe_target",
    symlinkStatusJson,
  );
  const symlinkTransitionJson = runCliFrom(symlinkFileRoot, [
    "task",
    "state",
    "transition",
    "--preview",
    symlinkFileTaskId,
    "--intent",
    "require_verification",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task state transition state-file symlink exited zero", symlinkTransitionJson);
  const parsedSymlinkTransitionJson = parseJsonOnlyStdout(
    "task state transition state-file symlink output was not valid JSON only",
    symlinkTransitionJson,
  );
  expectTaskStateTransitionPreviewErrorJsonShape(
    "task state transition state-file symlink did not fail closed",
    parsedSymlinkTransitionJson,
    "task_state_unsafe_target",
    symlinkTransitionJson,
  );
  const symlinkExecutionPreviewJson = runCliFrom(symlinkFileRoot, [
    "task",
    "execution",
    "prepare",
    "--preview",
    symlinkFileTaskId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution preparation state-file symlink exited zero", symlinkExecutionPreviewJson);
  const parsedSymlinkExecutionPreviewJson = parseJsonOnlyStdout(
    "task execution preparation state-file symlink output was not valid JSON only",
    symlinkExecutionPreviewJson,
  );
  expectTaskExecutionPreparationErrorJsonShape(
    "task execution preparation state-file symlink did not fail closed",
    parsedSymlinkExecutionPreviewJson,
    "task_state_unsafe_target",
    symlinkExecutionPreviewJson,
  );
  const symlinkExecutionApplyJson = runCliFrom(symlinkFileRoot, [
    "task",
    "execution",
    "prepare",
    symlinkFileTaskId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution preparation state-file symlink apply exited zero", symlinkExecutionApplyJson);
  const parsedSymlinkExecutionApplyJson = parseJsonOnlyStdout(
    "task execution preparation state-file symlink apply output was not valid JSON only",
    symlinkExecutionApplyJson,
  );
  expectTaskExecutionPreparationApplyErrorJsonShape(
    "task execution preparation state-file symlink apply did not fail closed",
    parsedSymlinkExecutionApplyJson,
    "task_state_unsafe_target",
    symlinkExecutionApplyJson,
  );
  const symlinkTransitionApplyJson = runCliFrom(symlinkFileRoot, [
    "task",
    "state",
    "transition",
    symlinkFileTaskId,
    "--intent",
    "require_verification",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task state transition state-file symlink apply exited zero", symlinkTransitionApplyJson);
  const parsedSymlinkTransitionApplyJson = parseJsonOnlyStdout(
    "task state transition state-file symlink apply output was not valid JSON only",
    symlinkTransitionApplyJson,
  );
  expectTaskStateTransitionApplyErrorJsonShape(
    "task state transition state-file symlink apply did not fail closed",
    parsedSymlinkTransitionApplyJson,
    "task_state_unsafe_target",
    symlinkTransitionApplyJson,
  );
  if (!lstatSync(taskStatePath(symlinkFileRoot, symlinkFileTaskId)).isSymbolicLink()) {
    fail("task state transition changed state-file symlink", symlinkTransitionApplyJson);
  }
  rmSync(symlinkFileRoot, { recursive: true, force: true });

  const symlinkRootProject = mkdtempSync(join(tmpdir(), "aeos-cli-task-state-root-link-"));
  mkdirSync(join(symlinkRootProject, ".aeos", "state"), { recursive: true });
  symlinkSync(symlinkOutsideRoot, join(symlinkRootProject, ".aeos", "state", "tasks"), "dir");
  const symlinkRootStatusJson = runCliFrom(symlinkRootProject, [
    "task",
    "status",
    "TASK-SYMLINK-ROOT",
    "--json",
  ]);
  expectNonzero("task status state-root symlink exited zero", symlinkRootStatusJson);
  const parsedSymlinkRootStatusJson = parseJsonOnlyStdout(
    "task status state-root symlink output was not valid JSON only",
    symlinkRootStatusJson,
  );
  expectTaskStateErrorJsonShape(
    "task status state-root symlink did not fail closed",
    parsedSymlinkRootStatusJson,
    "task_state_unsafe_state_root",
    symlinkRootStatusJson,
  );
  const symlinkRootTransitionJson = runCliFrom(symlinkRootProject, [
    "task",
    "state",
    "transition",
    "--preview",
    "TASK-SYMLINK-ROOT",
    "--intent",
    "require_verification",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task state transition state-root symlink exited zero", symlinkRootTransitionJson);
  const parsedSymlinkRootTransitionJson = parseJsonOnlyStdout(
    "task state transition state-root symlink output was not valid JSON only",
    symlinkRootTransitionJson,
  );
  expectTaskStateTransitionPreviewErrorJsonShape(
    "task state transition state-root symlink did not fail closed",
    parsedSymlinkRootTransitionJson,
    "task_state_unsafe_state_root",
    symlinkRootTransitionJson,
  );
  const symlinkRootExecutionPreviewJson = runCliFrom(symlinkRootProject, [
    "task",
    "execution",
    "prepare",
    "--preview",
    "TASK-SYMLINK-ROOT",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution preparation state-root symlink exited zero", symlinkRootExecutionPreviewJson);
  const parsedSymlinkRootExecutionPreviewJson = parseJsonOnlyStdout(
    "task execution preparation state-root symlink output was not valid JSON only",
    symlinkRootExecutionPreviewJson,
  );
  expectTaskExecutionPreparationErrorJsonShape(
    "task execution preparation state-root symlink did not fail closed",
    parsedSymlinkRootExecutionPreviewJson,
    "task_state_unsafe_state_root",
    symlinkRootExecutionPreviewJson,
  );
  const symlinkRootExecutionApplyJson = runCliFrom(symlinkRootProject, [
    "task",
    "execution",
    "prepare",
    "TASK-SYMLINK-ROOT",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution preparation state-root symlink apply exited zero", symlinkRootExecutionApplyJson);
  const parsedSymlinkRootExecutionApplyJson = parseJsonOnlyStdout(
    "task execution preparation state-root symlink apply output was not valid JSON only",
    symlinkRootExecutionApplyJson,
  );
  expectTaskExecutionPreparationApplyErrorJsonShape(
    "task execution preparation state-root symlink apply did not fail closed",
    parsedSymlinkRootExecutionApplyJson,
    "task_state_unsafe_state_root",
    symlinkRootExecutionApplyJson,
  );
  const symlinkRootTransitionApplyJson = runCliFrom(symlinkRootProject, [
    "task",
    "state",
    "transition",
    "TASK-SYMLINK-ROOT",
    "--intent",
    "require_verification",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task state transition state-root symlink apply exited zero", symlinkRootTransitionApplyJson);
  const parsedSymlinkRootTransitionApplyJson = parseJsonOnlyStdout(
    "task state transition state-root symlink apply output was not valid JSON only",
    symlinkRootTransitionApplyJson,
  );
  expectTaskStateTransitionApplyErrorJsonShape(
    "task state transition state-root symlink apply did not fail closed",
    parsedSymlinkRootTransitionApplyJson,
    "task_state_unsafe_state_root",
    symlinkRootTransitionApplyJson,
  );
  rmSync(symlinkRootProject, { recursive: true, force: true });
  rmSync(symlinkOutsideRoot, { recursive: true, force: true });

  const executionRootSymlinkProject = mkdtempSync(
    join(tmpdir(), "aeos-cli-execution-root-link-"),
  );
  const executionRootSymlinkOutside = mkdtempSync(
    join(tmpdir(), "aeos-cli-execution-root-outside-"),
  );
  const executionRootSymlinkTaskId = "TASK-EXECUTION-ROOT-SYMLINK";
  const executionRootSymlinkStatePath = await savePersistedTaskState(
    executionRootSymlinkProject,
    createPersistedTaskState(executionRootSymlinkTaskId),
  );
  const executionRootSymlinkStateSnapshot = stateFileSnapshot(
    executionRootSymlinkStatePath,
  );
  mkdirSync(join(executionRootSymlinkProject, ".aeos", "state"), { recursive: true });
  symlinkSync(
    executionRootSymlinkOutside,
    join(executionRootSymlinkProject, ".aeos", "state", "executions"),
    "dir",
  );
  const executionRootSymlinkOutsideBefore = listRelativeFiles(
    executionRootSymlinkOutside,
  );
  const executionRootSymlinkPreviewJson = runCliFrom(executionRootSymlinkProject, [
    "task",
    "execution",
    "prepare",
    "--preview",
    executionRootSymlinkTaskId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution preparation execution-root symlink exited zero", executionRootSymlinkPreviewJson);
  const parsedExecutionRootSymlinkPreviewJson = parseJsonOnlyStdout(
    "task execution preparation execution-root symlink output was not valid JSON only",
    executionRootSymlinkPreviewJson,
  );
  expectTaskExecutionPreparationErrorJsonShape(
    "task execution preparation execution-root symlink did not fail closed",
    parsedExecutionRootSymlinkPreviewJson,
    "task_execution_attempt_unsafe_state_root",
    executionRootSymlinkPreviewJson,
  );
  expectStateFileSnapshotSame(
    "task execution preparation execution-root symlink modified task state",
    executionRootSymlinkStatePath,
    executionRootSymlinkStateSnapshot,
    executionRootSymlinkPreviewJson,
  );
  expectSameFiles(
    "task execution preparation wrote through execution-root symlink",
    executionRootSymlinkOutsideBefore,
    listRelativeFiles(executionRootSymlinkOutside),
  );
  const executionRootSymlinkApplyJson = runCliFrom(executionRootSymlinkProject, [
    "task",
    "execution",
    "prepare",
    executionRootSymlinkTaskId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution preparation execution-root symlink apply exited zero", executionRootSymlinkApplyJson);
  const parsedExecutionRootSymlinkApplyJson = parseJsonOnlyStdout(
    "task execution preparation execution-root symlink apply output was not valid JSON only",
    executionRootSymlinkApplyJson,
  );
  expectTaskExecutionPreparationApplyErrorJsonShape(
    "task execution preparation execution-root symlink apply did not fail closed",
    parsedExecutionRootSymlinkApplyJson,
    "task_execution_attempt_unsafe_state_root",
    executionRootSymlinkApplyJson,
  );
  expectStateFileSnapshotSame(
    "task execution preparation execution-root symlink apply modified task state",
    executionRootSymlinkStatePath,
    executionRootSymlinkStateSnapshot,
    executionRootSymlinkApplyJson,
  );
  expectSameFiles(
    "task execution preparation apply wrote through execution-root symlink",
    executionRootSymlinkOutsideBefore,
    listRelativeFiles(executionRootSymlinkOutside),
  );
  const executionRootSymlinkStartApplyJson = runCliFrom(executionRootSymlinkProject, [
    "task",
    "execution",
    "start",
    executionRootSymlinkTaskId,
    "--attempt-id",
    "attempt-TASK-EXECUTION-ROOT-SYMLINK-r1-n1-placeholder",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution start execution-root symlink apply exited zero", executionRootSymlinkStartApplyJson);
  const parsedExecutionRootSymlinkStartApplyJson = parseJsonOnlyStdout(
    "task execution start execution-root symlink apply output was not valid JSON only",
    executionRootSymlinkStartApplyJson,
  );
  expectTaskExecutionStartApplyErrorJsonShape(
    "task execution start execution-root symlink apply did not fail closed",
    parsedExecutionRootSymlinkStartApplyJson,
    "task_execution_attempt_unsafe_state_root",
    executionRootSymlinkStartApplyJson,
  );
  expectStateFileSnapshotSame(
    "task execution start execution-root symlink apply modified task state",
    executionRootSymlinkStatePath,
    executionRootSymlinkStateSnapshot,
    executionRootSymlinkStartApplyJson,
  );
  expectSameFiles(
    "task execution start apply wrote through execution-root symlink",
    executionRootSymlinkOutsideBefore,
    listRelativeFiles(executionRootSymlinkOutside),
  );
  rmSync(executionRootSymlinkProject, { recursive: true, force: true });
  rmSync(executionRootSymlinkOutside, { recursive: true, force: true });

  for (const [attemptTargetCase, expectedCode] of [
    ["corrupt", "task_execution_attempt_corrupt_json"],
    ["symlink", "task_execution_attempt_unsafe_target"],
  ]) {
    const attemptTargetRoot = mkdtempSync(
      join(tmpdir(), `aeos-cli-attempt-target-${attemptTargetCase}-`),
    );
    const attemptTargetOutside = mkdtempSync(
      join(tmpdir(), `aeos-cli-attempt-target-outside-${attemptTargetCase}-`),
    );
    const attemptTargetTaskId =
      attemptTargetCase === "corrupt"
        ? "TASK-ATTEMPT-CORRUPT-CLI"
        : "TASK-ATTEMPT-SYMLINK-CLI";
    const attemptTargetState = createPersistedTaskState(attemptTargetTaskId);
    const attemptTargetStatePath = await savePersistedTaskState(
      attemptTargetRoot,
      attemptTargetState,
    );
    const attemptTargetStateSnapshot = stateFileSnapshot(attemptTargetStatePath);
    const attemptTargetPrepared = prepareTaskExecutionAttempt({
      state: attemptTargetState,
      expectedRevision: 1,
      batchId: "batch-main",
      attemptNumber: 1,
      createdAt: "2026-08-09T00:00:00.000Z",
    });
    if (!attemptTargetPrepared.ok) {
      fail(
        `could not prepare ${attemptTargetCase} attempt target fixture: ${attemptTargetPrepared.error.code}`,
      );
    }
    const attemptTargetExecutionRoot = join(
      attemptTargetRoot,
      ".aeos",
      "state",
      "executions",
      attemptTargetTaskId,
    );
    mkdirSync(attemptTargetExecutionRoot, { recursive: true });
    const attemptTargetPath = join(
      attemptTargetExecutionRoot,
      `${attemptTargetPrepared.value.attempt.attemptId}.json`,
    );
    if (attemptTargetCase === "corrupt") {
      writeFileSync(attemptTargetPath, "{ corrupt attempt json");
    } else {
      const outsideAttemptTargetPath = join(attemptTargetOutside, "attempt.json");
      writeFileSync(
        outsideAttemptTargetPath,
        `${JSON.stringify(attemptTargetPrepared.value.attempt, null, 2)}\n`,
      );
      symlinkSync(outsideAttemptTargetPath, attemptTargetPath);
    }
    const attemptTargetExecutionSnapshot = executionSnapshot(attemptTargetRoot);
    const attemptTargetPreviewJson = runCliFrom(attemptTargetRoot, [
      "task",
      "execution",
      "prepare",
      "--preview",
      attemptTargetTaskId,
      "--expected-revision",
      "1",
      "--json",
    ]);
    expectNonzero(`task execution preparation ${attemptTargetCase} attempt target exited zero`, attemptTargetPreviewJson);
    const parsedAttemptTargetPreviewJson = parseJsonOnlyStdout(
      `task execution preparation ${attemptTargetCase} attempt target output was not valid JSON only`,
      attemptTargetPreviewJson,
    );
    expectTaskExecutionPreparationErrorJsonShape(
      `task execution preparation ${attemptTargetCase} attempt target did not fail closed`,
      parsedAttemptTargetPreviewJson,
      expectedCode,
      attemptTargetPreviewJson,
    );
    expectStateFileSnapshotSame(
      `task execution preparation ${attemptTargetCase} attempt target modified task state`,
      attemptTargetStatePath,
      attemptTargetStateSnapshot,
      attemptTargetPreviewJson,
    );
    expectExecutionSnapshotSame(
      `task execution preparation ${attemptTargetCase} attempt target changed execution files`,
      attemptTargetRoot,
      attemptTargetExecutionSnapshot,
      attemptTargetPreviewJson,
    );
    const attemptTargetApplyJson = runCliFrom(attemptTargetRoot, [
      "task",
      "execution",
      "prepare",
      attemptTargetTaskId,
      "--expected-revision",
      "1",
      "--json",
    ]);
    expectNonzero(`task execution preparation ${attemptTargetCase} attempt target apply exited zero`, attemptTargetApplyJson);
    const parsedAttemptTargetApplyJson = parseJsonOnlyStdout(
      `task execution preparation ${attemptTargetCase} attempt target apply output was not valid JSON only`,
      attemptTargetApplyJson,
    );
    expectTaskExecutionPreparationApplyErrorJsonShape(
      `task execution preparation ${attemptTargetCase} attempt target apply did not fail closed`,
      parsedAttemptTargetApplyJson,
      expectedCode,
      attemptTargetApplyJson,
    );
    expectStateFileSnapshotSame(
      `task execution preparation ${attemptTargetCase} attempt target apply modified task state`,
      attemptTargetStatePath,
      attemptTargetStateSnapshot,
      attemptTargetApplyJson,
    );
    expectExecutionSnapshotSame(
      `task execution preparation ${attemptTargetCase} attempt target apply changed execution files`,
      attemptTargetRoot,
      attemptTargetExecutionSnapshot,
      attemptTargetApplyJson,
    );
    const attemptTargetStartApplyJson = runCliFrom(attemptTargetRoot, [
      "task",
      "execution",
      "start",
      attemptTargetTaskId,
      "--attempt-id",
      attemptTargetPrepared.value.attempt.attemptId,
      "--expected-revision",
      "1",
      "--json",
    ]);
    expectNonzero(`task execution start ${attemptTargetCase} attempt target apply exited zero`, attemptTargetStartApplyJson);
    const parsedAttemptTargetStartApplyJson = parseJsonOnlyStdout(
      `task execution start ${attemptTargetCase} attempt target apply output was not valid JSON only`,
      attemptTargetStartApplyJson,
    );
    expectTaskExecutionStartApplyErrorJsonShape(
      `task execution start ${attemptTargetCase} attempt target apply did not fail closed`,
      parsedAttemptTargetStartApplyJson,
      expectedCode,
      attemptTargetStartApplyJson,
    );
    expectStateFileSnapshotSame(
      `task execution start ${attemptTargetCase} attempt target apply modified task state`,
      attemptTargetStatePath,
      attemptTargetStateSnapshot,
      attemptTargetStartApplyJson,
    );
    expectExecutionSnapshotSame(
      `task execution start ${attemptTargetCase} attempt target apply changed execution files`,
      attemptTargetRoot,
      attemptTargetExecutionSnapshot,
      attemptTargetStartApplyJson,
    );
    rmSync(attemptTargetRoot, { recursive: true, force: true });
    rmSync(attemptTargetOutside, { recursive: true, force: true });
  }

  const directoryAttemptRoot = mkdtempSync(
    join(tmpdir(), "aeos-cli-attempt-directory-"),
  );
  const directoryAttemptTaskId = "TASK-ATTEMPT-DIRECTORY-CLI";
  const directoryAttemptState = createPersistedTaskState(directoryAttemptTaskId);
  const directoryAttemptStatePath = await savePersistedTaskState(
    directoryAttemptRoot,
    directoryAttemptState,
  );
  const directoryAttemptPrepared = prepareTaskExecutionAttempt({
    state: directoryAttemptState,
    expectedRevision: 1,
    batchId: "batch-main",
    attemptNumber: 1,
    createdAt: "2026-08-09T00:00:00.000Z",
  });
  if (!directoryAttemptPrepared.ok) {
    fail(`could not prepare directory attempt target fixture: ${directoryAttemptPrepared.error.code}`);
  }
  mkdirSync(
    join(
      directoryAttemptRoot,
      ".aeos",
      "state",
      "executions",
      directoryAttemptTaskId,
      `${directoryAttemptPrepared.value.attempt.attemptId}.json`,
    ),
    { recursive: true },
  );
  const directoryAttemptStateSnapshot = stateFileSnapshot(directoryAttemptStatePath);
  const directoryAttemptExecutionSnapshot = executionSnapshot(directoryAttemptRoot);
  const directoryAttemptStartApplyJson = runCliFrom(directoryAttemptRoot, [
    "task",
    "execution",
    "start",
    directoryAttemptTaskId,
    "--attempt-id",
    directoryAttemptPrepared.value.attempt.attemptId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution start directory attempt target apply exited zero", directoryAttemptStartApplyJson);
  const parsedDirectoryAttemptStartApplyJson = parseJsonOnlyStdout(
    "task execution start directory attempt target apply output was not valid JSON only",
    directoryAttemptStartApplyJson,
  );
  expectTaskExecutionStartApplyErrorJsonShape(
    "task execution start directory attempt target apply did not fail closed",
    parsedDirectoryAttemptStartApplyJson,
    "task_execution_attempt_unsafe_target",
    directoryAttemptStartApplyJson,
  );
  expectStateFileSnapshotSame(
    "task execution start directory attempt target apply modified task state",
    directoryAttemptStatePath,
    directoryAttemptStateSnapshot,
    directoryAttemptStartApplyJson,
  );
  expectExecutionSnapshotSame(
    "task execution start directory attempt target apply changed execution files",
    directoryAttemptRoot,
    directoryAttemptExecutionSnapshot,
    directoryAttemptStartApplyJson,
  );
  rmSync(directoryAttemptRoot, { recursive: true, force: true });

  const directoryTargetRoot = mkdtempSync(join(tmpdir(), "aeos-cli-task-state-directory-"));
  mkdirSync(taskStatePath(directoryTargetRoot, "TASK-DIRECTORY-TARGET"), {
    recursive: true,
  });
  const directoryTargetStatusJson = runCliFrom(directoryTargetRoot, [
    "task",
    "status",
    "TASK-DIRECTORY-TARGET",
    "--json",
  ]);
  expectNonzero(
    "task status directory state target exited zero",
    directoryTargetStatusJson,
  );
  const parsedDirectoryTargetStatusJson = parseJsonOnlyStdout(
    "task status directory state target output was not valid JSON only",
    directoryTargetStatusJson,
  );
  expectTaskStateErrorJsonShape(
    "task status directory state target did not fail closed",
    parsedDirectoryTargetStatusJson,
    "task_state_unsafe_target",
    directoryTargetStatusJson,
  );
  const directoryTargetTransitionJson = runCliFrom(directoryTargetRoot, [
    "task",
    "state",
    "transition",
    "--preview",
    "TASK-DIRECTORY-TARGET",
    "--intent",
    "require_verification",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero(
    "task state transition directory state target exited zero",
    directoryTargetTransitionJson,
  );
  const parsedDirectoryTargetTransitionJson = parseJsonOnlyStdout(
    "task state transition directory state target output was not valid JSON only",
    directoryTargetTransitionJson,
  );
  expectTaskStateTransitionPreviewErrorJsonShape(
    "task state transition directory state target did not fail closed",
    parsedDirectoryTargetTransitionJson,
    "task_state_unsafe_target",
    directoryTargetTransitionJson,
  );
  const directoryTargetTransitionApplyJson = runCliFrom(directoryTargetRoot, [
    "task",
    "state",
    "transition",
    "TASK-DIRECTORY-TARGET",
    "--intent",
    "require_verification",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero(
    "task state transition directory state target apply exited zero",
    directoryTargetTransitionApplyJson,
  );
  const parsedDirectoryTargetTransitionApplyJson = parseJsonOnlyStdout(
    "task state transition directory state target apply output was not valid JSON only",
    directoryTargetTransitionApplyJson,
  );
  expectTaskStateTransitionApplyErrorJsonShape(
    "task state transition directory state target apply did not fail closed",
    parsedDirectoryTargetTransitionApplyJson,
    "task_state_unsafe_target",
    directoryTargetTransitionApplyJson,
  );
  rmSync(directoryTargetRoot, { recursive: true, force: true });

  const traversalStatusJson = runCliFrom(taskStateCliRoot, [
    "task",
    "status",
    "../TASK-STATUS-SMOKE",
    "--json",
  ]);
  expectNonzero("task status traversal id exited zero", traversalStatusJson);
  const parsedTraversalStatusJson = parseJsonOnlyStdout(
    "task status traversal id output was not valid JSON only",
    traversalStatusJson,
  );
  expectTaskStateErrorJsonShape(
    "task status traversal id did not fail closed",
    parsedTraversalStatusJson,
    "task_state_unsafe_task_id",
    traversalStatusJson,
  );

  const traversalTransitionJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    "--preview",
    "../TASK-STATUS-SMOKE",
    "--intent",
    "require_verification",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task state transition traversal id exited zero", traversalTransitionJson);
  const parsedTraversalTransitionJson = parseJsonOnlyStdout(
    "task state transition traversal id output was not valid JSON only",
    traversalTransitionJson,
  );
  expectTaskStateTransitionPreviewErrorJsonShape(
    "task state transition traversal id did not fail closed",
    parsedTraversalTransitionJson,
    "task_state_unsafe_task_id",
    traversalTransitionJson,
  );
  const traversalExecutionPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "prepare",
    "--preview",
    "../TASK-STATUS-SMOKE",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution preparation traversal id exited zero", traversalExecutionPreviewJson);
  const parsedTraversalExecutionPreviewJson = parseJsonOnlyStdout(
    "task execution preparation traversal id output was not valid JSON only",
    traversalExecutionPreviewJson,
  );
  expectTaskExecutionPreparationErrorJsonShape(
    "task execution preparation traversal id did not fail closed",
    parsedTraversalExecutionPreviewJson,
    "task_state_unsafe_task_id",
    traversalExecutionPreviewJson,
  );
  const traversalTransitionApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    "../TASK-STATUS-SMOKE",
    "--intent",
    "require_verification",
    "--expected-revision",
    "2",
    "--json",
  ]);
  expectNonzero("task state transition traversal id apply exited zero", traversalTransitionApplyJson);
  const parsedTraversalTransitionApplyJson = parseJsonOnlyStdout(
    "task state transition traversal id apply output was not valid JSON only",
    traversalTransitionApplyJson,
  );
  expectTaskStateTransitionApplyErrorJsonShape(
    "task state transition traversal id apply did not fail closed",
    parsedTraversalTransitionApplyJson,
    "task_state_unsafe_task_id",
    traversalTransitionApplyJson,
  );

  const pathLikePreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "resume",
    "--preview",
    "path/like",
    "--json",
  ]);
  expectNonzero("task resume preview path-like id exited zero", pathLikePreviewJson);
  const parsedPathLikePreviewJson = parseJsonOnlyStdout(
    "task resume preview path-like id output was not valid JSON only",
    pathLikePreviewJson,
  );
  expectTaskStateErrorJsonShape(
    "task resume preview path-like id did not fail closed",
    parsedPathLikePreviewJson,
    "task_state_unsafe_task_id",
    pathLikePreviewJson,
  );

  const pathLikeTransitionJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    "--preview",
    "path/like",
    "--intent",
    "require_verification",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task state transition path-like id exited zero", pathLikeTransitionJson);
  const parsedPathLikeTransitionJson = parseJsonOnlyStdout(
    "task state transition path-like id output was not valid JSON only",
    pathLikeTransitionJson,
  );
  expectTaskStateTransitionPreviewErrorJsonShape(
    "task state transition path-like id did not fail closed",
    parsedPathLikeTransitionJson,
    "task_state_unsafe_task_id",
    pathLikeTransitionJson,
  );
  const pathLikeExecutionPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "prepare",
    "--preview",
    "path/like",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution preparation path-like id exited zero", pathLikeExecutionPreviewJson);
  const parsedPathLikeExecutionPreviewJson = parseJsonOnlyStdout(
    "task execution preparation path-like id output was not valid JSON only",
    pathLikeExecutionPreviewJson,
  );
  expectTaskExecutionPreparationErrorJsonShape(
    "task execution preparation path-like id did not fail closed",
    parsedPathLikeExecutionPreviewJson,
    "task_state_unsafe_task_id",
    pathLikeExecutionPreviewJson,
  );
  const pathLikeStartApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "start",
    "path/like",
    "--attempt-id",
    parsedExecutionPrepareApplyJson.attempt.attemptId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution start path-like id apply exited zero", pathLikeStartApplyJson);
  const parsedPathLikeStartApplyJson = parseJsonOnlyStdout(
    "task execution start path-like id apply output was not valid JSON only",
    pathLikeStartApplyJson,
  );
  expectTaskExecutionStartApplyErrorJsonShape(
    "task execution start path-like id apply did not fail closed",
    parsedPathLikeStartApplyJson,
    "task_state_unsafe_task_id",
    pathLikeStartApplyJson,
  );
  const unsafeAttemptIdStartApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "start",
    statusTaskId,
    "--attempt-id",
    "../escape",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task execution start unsafe attempt id apply exited zero", unsafeAttemptIdStartApplyJson);
  const parsedUnsafeAttemptIdStartApplyJson = parseJsonOnlyStdout(
    "task execution start unsafe attempt id apply output was not valid JSON only",
    unsafeAttemptIdStartApplyJson,
  );
  expectTaskExecutionStartApplyErrorJsonShape(
    "task execution start unsafe attempt id apply did not fail closed",
    parsedUnsafeAttemptIdStartApplyJson,
    "task_execution_attempt_unsafe_attemptId",
    unsafeAttemptIdStartApplyJson,
  );
  const pathLikeTransitionApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    "path/like",
    "--intent",
    "require_verification",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("task state transition path-like id apply exited zero", pathLikeTransitionApplyJson);
  const parsedPathLikeTransitionApplyJson = parseJsonOnlyStdout(
    "task state transition path-like id apply output was not valid JSON only",
    pathLikeTransitionApplyJson,
  );
  expectTaskStateTransitionApplyErrorJsonShape(
    "task state transition path-like id apply did not fail closed",
    parsedPathLikeTransitionApplyJson,
    "task_state_unsafe_task_id",
    pathLikeTransitionApplyJson,
  );

  const canonicalWorkItems = Array.from({ length: 400 }, (_, index) => {
    const id = `canonical-work-${String(index + 1).padStart(3, "0")}`;

    return {
      id,
      state: index < 20 ? "failed" : "pending",
      batchId: "canonical-batch",
    };
  });
  const canonicalTaskId = "TASK-400-20-CLI";
  const canonicalStatePath = await savePersistedTaskState(
    taskStateCliRoot,
    createPersistedTaskState(canonicalTaskId, {
      sourceTask: {
        kind: "reference",
        id: 'model says "all complete"',
      },
      workItems: canonicalWorkItems,
      batches: [
        {
          id: "canonical-batch",
          workItemIds: canonicalWorkItems.map((workItem) => workItem.id),
          expectedItemCount: 400,
          completedCount: 0,
          failedCount: 20,
          skippedCount: 0,
          retryableCount: 0,
        },
      ],
      pendingWorkItemIds: canonicalWorkItems
        .filter((workItem) => workItem.state === "pending")
        .map((workItem) => workItem.id),
      retryableWorkItemIds: [],
      currentBatchId: "canonical-batch",
      nextBatchId: "canonical-batch",
      plan: {
        status: "planned",
        summary: {
          workItemCount: 400,
          batchCount: 1,
          stepCount: 1,
          verifierRequired: true,
          approvalRequired: false,
          issueCount: 0,
        },
      },
    }),
  );
  const canonicalSnapshotBefore = stateFileSnapshot(canonicalStatePath);
  const canonicalStatusJson = runCliFrom(taskStateCliRoot, [
    "task",
    "status",
    canonicalTaskId,
    "--json",
  ]);
  expectExitCode("400/20 task status exited nonzero", canonicalStatusJson, 0);
  const parsedCanonicalStatusJson = parseJsonOnlyStdout(
    "400/20 task status output was not valid JSON only",
    canonicalStatusJson,
  );
  expectTaskStatusJsonShape(
    "400/20 task status shape was invalid",
    parsedCanonicalStatusJson,
    canonicalStatusJson,
  );
  if (
    parsedCanonicalStatusJson.summary.workItemCount !== 400 ||
    parsedCanonicalStatusJson.summary.pendingCount !== 380 ||
    parsedCanonicalStatusJson.state.completionGate.completed !== false ||
    parsedCanonicalStatusJson.state.completionGate.verified !== false ||
    parsedCanonicalStatusJson.state.safety.modelSelfReportTrusted !== false ||
    parsedCanonicalStatusJson.state.safety.completed !== false ||
    parsedCanonicalStatusJson.state.safety.verified !== false
  ) {
    fail("400/20 task status trusted incomplete self-report", canonicalStatusJson);
  }

  const canonicalPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "resume",
    "--preview",
    canonicalTaskId,
    "--json",
  ]);
  expectExitCode("400/20 task resume preview exited nonzero", canonicalPreviewJson, 0);
  const parsedCanonicalPreviewJson = parseJsonOnlyStdout(
    "400/20 task resume preview output was not valid JSON only",
    canonicalPreviewJson,
  );
  expectTaskResumePreviewJsonShape(
    "400/20 task resume preview shape was invalid",
    parsedCanonicalPreviewJson,
    canonicalPreviewJson,
  );
  if (
    parsedCanonicalPreviewJson.resume.allowed !== true ||
    parsedCanonicalPreviewJson.resume.remainingWorkCount !== 380 ||
    parsedCanonicalPreviewJson.resume.pendingWorkItemIds.length !== 380
  ) {
    fail("400/20 task resume preview lost remaining work", canonicalPreviewJson);
  }
  expectOutputExcludes(
    "400/20 task resume preview reported completion",
    canonicalPreviewJson,
    "\"completed\":true",
  );
  expectStateFileSnapshotSame(
    "400/20 status/preview modified persisted state",
    canonicalStatePath,
    canonicalSnapshotBefore,
    canonicalPreviewJson,
  );

  const canonicalExecutionSnapshotBefore = executionSnapshot(taskStateCliRoot);
  const canonicalExecutionPreviewJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "prepare",
    "--preview",
    canonicalTaskId,
    "--expected-revision",
    "1",
    "--batch",
    "canonical-batch",
    "--json",
  ]);
  expectExitCode("400/20 task execution preparation preview exited nonzero", canonicalExecutionPreviewJson, 0);
  const parsedCanonicalExecutionPreviewJson = parseJsonOnlyStdout(
    "400/20 task execution preparation preview output was not valid JSON only",
    canonicalExecutionPreviewJson,
  );
  expectTaskExecutionPreparationPreviewJsonShape(
    "400/20 task execution preparation preview shape was invalid",
    parsedCanonicalExecutionPreviewJson,
    canonicalExecutionPreviewJson,
  );
  if (
    parsedCanonicalExecutionPreviewJson.attempt.lifecycle !== "prepared" ||
    parsedCanonicalExecutionPreviewJson.attempt.batchId !== "canonical-batch" ||
    parsedCanonicalExecutionPreviewJson.safety.taskCompleted !== false ||
    parsedCanonicalExecutionPreviewJson.safety.workCompleted !== false ||
    parsedCanonicalExecutionPreviewJson.verifierRequired !== true
  ) {
    fail(
      "400/20 task execution preparation preview created completion authority",
      canonicalExecutionPreviewJson,
    );
  }
  expectStateFileSnapshotSame(
    "400/20 execution preparation preview modified persisted state",
    canonicalStatePath,
    canonicalSnapshotBefore,
    canonicalExecutionPreviewJson,
  );
  expectExecutionSnapshotSame(
    "400/20 execution preparation preview created execution files",
    taskStateCliRoot,
    canonicalExecutionSnapshotBefore,
    canonicalExecutionPreviewJson,
  );
  const canonicalStateAfterExecutionPreview = JSON.parse(
    readFileSync(canonicalStatePath, "utf8"),
  );
  if (
    canonicalStateAfterExecutionPreview.pendingWorkItemIds.length !== 380 ||
    canonicalStateAfterExecutionPreview.completionGate.completed !== false ||
    canonicalStateAfterExecutionPreview.completionGate.verified !== false ||
    canonicalStateAfterExecutionPreview.safety.modelSelfReportTrusted !== false
  ) {
    fail(
      "400/20 task execution preparation preview changed incomplete state authority",
      canonicalExecutionPreviewJson,
    );
  }

  const canonicalExecutionApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "prepare",
    canonicalTaskId,
    "--expected-revision",
    "1",
    "--batch",
    "canonical-batch",
    "--json",
  ]);
  expectExitCode("400/20 task execution preparation apply exited nonzero", canonicalExecutionApplyJson, 0);
  const parsedCanonicalExecutionApplyJson = parseJsonOnlyStdout(
    "400/20 task execution preparation apply output was not valid JSON only",
    canonicalExecutionApplyJson,
  );
  expectTaskExecutionPreparationApplyJsonShape(
    "400/20 task execution preparation apply shape was invalid",
    parsedCanonicalExecutionApplyJson,
    canonicalExecutionApplyJson,
  );
  if (
    parsedCanonicalExecutionApplyJson.attempt.lifecycle !== "prepared" ||
    parsedCanonicalExecutionApplyJson.attempt.batchId !== "canonical-batch" ||
    parsedCanonicalExecutionApplyJson.safety.taskCompleted !== false ||
    parsedCanonicalExecutionApplyJson.safety.workCompleted !== false ||
    parsedCanonicalExecutionApplyJson.safety.verifierRun !== false
  ) {
    fail(
      "400/20 task execution preparation apply created completion authority",
      canonicalExecutionApplyJson,
    );
  }
  expectStateFileSnapshotSame(
    "400/20 execution preparation apply modified persisted state",
    canonicalStatePath,
    canonicalSnapshotBefore,
    canonicalExecutionApplyJson,
  );
  const canonicalStateAfterExecutionApply = JSON.parse(
    readFileSync(canonicalStatePath, "utf8"),
  );
  if (
    canonicalStateAfterExecutionApply.pendingWorkItemIds.length !== 380 ||
    canonicalStateAfterExecutionApply.completionGate.completed !== false ||
    canonicalStateAfterExecutionApply.completionGate.verified !== false ||
    canonicalStateAfterExecutionApply.verifier.required !== true ||
    canonicalStateAfterExecutionApply.verifier.status === "verified" ||
    canonicalStateAfterExecutionApply.safety.modelSelfReportTrusted !== false
  ) {
    fail(
      "400/20 task execution preparation apply changed incomplete state authority",
      canonicalExecutionApplyJson,
    );
  }

  const canonicalStartApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "start",
    canonicalTaskId,
    "--attempt-id",
    parsedCanonicalExecutionApplyJson.attempt.attemptId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode("400/20 task execution start apply exited nonzero", canonicalStartApplyJson, 0);
  const parsedCanonicalStartApplyJson = parseJsonOnlyStdout(
    "400/20 task execution start apply output was not valid JSON only",
    canonicalStartApplyJson,
  );
  expectTaskExecutionStartApplyJsonShape(
    "400/20 task execution start apply shape was invalid",
    parsedCanonicalStartApplyJson,
    canonicalStartApplyJson,
  );
  if (
    parsedCanonicalStartApplyJson.attempt.lifecycle !== "started" ||
    parsedCanonicalStartApplyJson.batchId !== "canonical-batch" ||
    parsedCanonicalStartApplyJson.safety.executionWorkPerformed !== false ||
    parsedCanonicalStartApplyJson.safety.taskCompleted !== false ||
    parsedCanonicalStartApplyJson.safety.workCompleted !== false ||
    parsedCanonicalStartApplyJson.safety.verifierRun !== false
  ) {
    fail(
      "400/20 task execution start apply created execution or completion authority",
      canonicalStartApplyJson,
    );
  }
  expectStateFileSnapshotSame(
    "400/20 execution start apply modified persisted state",
    canonicalStatePath,
    canonicalSnapshotBefore,
    canonicalStartApplyJson,
  );
  const canonicalStateAfterStartApply = JSON.parse(
    readFileSync(canonicalStatePath, "utf8"),
  );
  if (
    canonicalStateAfterStartApply.pendingWorkItemIds.length !== 380 ||
    canonicalStateAfterStartApply.completionGate.completed !== false ||
    canonicalStateAfterStartApply.completionGate.verified !== false ||
    canonicalStateAfterStartApply.verifier.required !== true ||
    canonicalStateAfterStartApply.verifier.status === "verified" ||
    canonicalStateAfterStartApply.safety.modelSelfReportTrusted !== false ||
    canonicalStateAfterStartApply.safety.completed !== false ||
    canonicalStateAfterStartApply.safety.verified !== false
  ) {
    fail(
      "400/20 task execution start apply changed incomplete state authority",
      canonicalStartApplyJson,
    );
  }

  const canonicalTerminalTransitionJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    "--preview",
    canonicalTaskId,
    "--intent",
    "completed",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("400/20 terminal transition preview exited zero", canonicalTerminalTransitionJson);
  const parsedCanonicalTerminalTransitionJson = parseJsonOnlyStdout(
    "400/20 terminal transition preview output was not valid JSON only",
    canonicalTerminalTransitionJson,
  );
  expectTaskStateTransitionPreviewErrorJsonShape(
    "400/20 terminal transition preview did not fail closed",
    parsedCanonicalTerminalTransitionJson,
    "task_state_transition_terminal_forbidden",
    canonicalTerminalTransitionJson,
  );
  expectOutputExcludes(
    "400/20 terminal transition preview reported completion",
    canonicalTerminalTransitionJson,
    "\"completed\":true",
  );
  expectStateFileSnapshotSame(
    "400/20 terminal transition preview modified persisted state",
    canonicalStatePath,
    canonicalSnapshotBefore,
    canonicalTerminalTransitionJson,
  );
  const canonicalTerminalTransitionApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    canonicalTaskId,
    "--intent",
    "mark_verified",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero("400/20 terminal transition apply exited zero", canonicalTerminalTransitionApplyJson);
  const parsedCanonicalTerminalTransitionApplyJson = parseJsonOnlyStdout(
    "400/20 terminal transition apply output was not valid JSON only",
    canonicalTerminalTransitionApplyJson,
  );
  expectTaskStateTransitionApplyErrorJsonShape(
    "400/20 terminal transition apply did not fail closed",
    parsedCanonicalTerminalTransitionApplyJson,
    "task_state_transition_terminal_forbidden",
    canonicalTerminalTransitionApplyJson,
  );
  expectOutputExcludes(
    "400/20 terminal transition apply reported completion",
    canonicalTerminalTransitionApplyJson,
    "\"completed\":true",
  );
  expectStateFileSnapshotSame(
    "400/20 terminal transition apply modified persisted state",
    canonicalStatePath,
    canonicalSnapshotBefore,
    canonicalTerminalTransitionApplyJson,
  );

  const selfReportTransitionTaskId = "TASK-TRANSITION-SELF-REPORT";
  const selfReportTransitionStatePath = await savePersistedTaskState(
    taskStateCliRoot,
    createPersistedTaskState(selfReportTransitionTaskId, {
      sourceTask: {
        kind: "reference",
        id: "completed approved verified all done",
      },
    }),
  );
  const selfReportTransitionSnapshot = stateFileSnapshot(selfReportTransitionStatePath);
  const selfReportTerminalTransitionJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    "--preview",
    selfReportTransitionTaskId,
    "--intent",
    "verified",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero(
    "self-report terminal transition preview exited zero",
    selfReportTerminalTransitionJson,
  );
  const parsedSelfReportTerminalTransitionJson = parseJsonOnlyStdout(
    "self-report terminal transition preview output was not valid JSON only",
    selfReportTerminalTransitionJson,
  );
  expectTaskStateTransitionPreviewErrorJsonShape(
    "self-report terminal transition preview did not fail closed",
    parsedSelfReportTerminalTransitionJson,
    "task_state_transition_terminal_forbidden",
    selfReportTerminalTransitionJson,
  );
  expectStateFileSnapshotSame(
    "self-report terminal transition preview modified persisted state",
    selfReportTransitionStatePath,
    selfReportTransitionSnapshot,
    selfReportTerminalTransitionJson,
  );
  const selfReportTerminalTransitionApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "state",
    "transition",
    selfReportTransitionTaskId,
    "--intent",
    "execution_success",
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectNonzero(
    "self-report terminal transition apply exited zero",
    selfReportTerminalTransitionApplyJson,
  );
  const parsedSelfReportTerminalTransitionApplyJson = parseJsonOnlyStdout(
    "self-report terminal transition apply output was not valid JSON only",
    selfReportTerminalTransitionApplyJson,
  );
  expectTaskStateTransitionApplyErrorJsonShape(
    "self-report terminal transition apply did not fail closed",
    parsedSelfReportTerminalTransitionApplyJson,
    "task_state_transition_terminal_forbidden",
    selfReportTerminalTransitionApplyJson,
  );
  expectStateFileSnapshotSame(
    "self-report terminal transition apply modified persisted state",
    selfReportTransitionStatePath,
    selfReportTransitionSnapshot,
    selfReportTerminalTransitionApplyJson,
  );
  const selfReportExecutionApplyJson = runCliFrom(taskStateCliRoot, [
    "task",
    "execution",
    "prepare",
    selfReportTransitionTaskId,
    "--expected-revision",
    "1",
    "--json",
  ]);
  expectExitCode(
    "self-report execution preparation apply exited nonzero",
    selfReportExecutionApplyJson,
    0,
  );
  const parsedSelfReportExecutionApplyJson = parseJsonOnlyStdout(
    "self-report execution preparation apply output was not valid JSON only",
    selfReportExecutionApplyJson,
  );
  expectTaskExecutionPreparationApplyJsonShape(
    "self-report execution preparation apply shape was invalid",
    parsedSelfReportExecutionApplyJson,
    selfReportExecutionApplyJson,
  );
  if (
    parsedSelfReportExecutionApplyJson.attempt.lifecycle !== "prepared" ||
    parsedSelfReportExecutionApplyJson.safety.workCompleted !== false ||
    parsedSelfReportExecutionApplyJson.safety.taskCompleted !== false
  ) {
    fail(
      "self-report execution preparation apply created terminal authority",
      selfReportExecutionApplyJson,
    );
  }
  expectStateFileSnapshotSame(
    "self-report execution preparation apply modified persisted state",
    selfReportTransitionStatePath,
    selfReportTransitionSnapshot,
    selfReportExecutionApplyJson,
  );
} finally {
  rmSync(taskStateCliRoot, { recursive: true, force: true });
}

const validTaskPath = fileURLToPath(
  new URL("../fixtures/tasks/valid-task.json", import.meta.url),
);
const invalidTaskPath = fileURLToPath(
  new URL("../fixtures/tasks/invalid-task.json", import.meta.url),
);
const smokeDir = mkdtempSync(join(tmpdir(), "aeos-cli-smoke-"));

try {
  const invalidJsonPath = join(smokeDir, "invalid-json.json");
  const missingTaskPath = join(smokeDir, "missing-task.json");

  writeFileSync(invalidJsonPath, "{ invalid json");

  const missingPath = runCli(["task", "validate"]);
  expectNonzero("missing path validation exited zero", missingPath);
  expectOutputIncludes(
    'missing path output did not include "Task validation: fail"',
    missingPath,
    "Task validation: fail",
  );
  expectOutputIncludes(
    'missing path output did not include "Reason: missing task file path"',
    missingPath,
    "Reason: missing task file path",
  );
  expectOutputIncludes(
    'missing path output did not include task validate usage',
    missingPath,
    "Usage: aeos task validate <path>",
  );

  const missingPathJson = runCli(["task", "validate", "--json"]);
  expectNonzero("missing path --json validation exited zero", missingPathJson);
  const parsedMissingPath = parseJsonStdout(
    "missing path --json output was not valid JSON",
    missingPathJson,
  );
  if (
    parsedMissingPath.ok !== false ||
    parsedMissingPath.path !== "" ||
    parsedMissingPath.status !== "fail" ||
    parsedMissingPath.reason !== "missing_task_file_path"
  ) {
    fail("missing path --json output did not match expected failure", missingPathJson);
  }

  const missingFile = runCli(["task", "validate", missingTaskPath]);
  expectNonzero("missing file validation exited zero", missingFile);
  expectOutputIncludes(
    'missing file output did not include "Task validation: fail"',
    missingFile,
    "Task validation: fail",
  );
  expectOutputIncludes(
    'missing file output did not include "Reason: task file not found"',
    missingFile,
    "Reason: task file not found",
  );
  expectOutputIncludes(
    "missing file output did not include provided path",
    missingFile,
    missingTaskPath,
  );

  const missingFileJson = runCli(["task", "validate", missingTaskPath, "--json"]);
  expectNonzero("missing file --json validation exited zero", missingFileJson);
  const parsedMissingFile = parseJsonStdout(
    "missing file --json output was not valid JSON",
    missingFileJson,
  );
  if (
    parsedMissingFile.ok !== false ||
    parsedMissingFile.path !== missingTaskPath ||
    parsedMissingFile.status !== "fail" ||
    parsedMissingFile.reason !== "task_file_not_found"
  ) {
    fail("missing file --json output did not match expected failure", missingFileJson);
  }

  const invalidJson = runCli(["task", "validate", invalidJsonPath]);
  expectNonzero("invalid JSON validation exited zero", invalidJson);
  expectOutputIncludes(
    'invalid JSON output did not include "Task validation: fail"',
    invalidJson,
    "Task validation: fail",
  );
  expectOutputIncludes(
    'invalid JSON output did not include "Reason: invalid JSON"',
    invalidJson,
    "Reason: invalid JSON",
  );

  const invalidJsonJson = runCli(["task", "validate", invalidJsonPath, "--json"]);
  expectNonzero("invalid JSON --json validation exited zero", invalidJsonJson);
  const parsedInvalidJson = parseJsonStdout(
    "invalid JSON --json output was not valid JSON",
    invalidJsonJson,
  );
  if (
    parsedInvalidJson.ok !== false ||
    parsedInvalidJson.path !== invalidJsonPath ||
    parsedInvalidJson.status !== "fail" ||
    parsedInvalidJson.reason !== "invalid_json"
  ) {
    fail("invalid JSON --json output did not match expected failure", invalidJsonJson);
  }

  const validTask = runCli(["task", "validate", validTaskPath]);
  expectExitCode("valid task validation exited nonzero", validTask, 0);
  expectOutputIncludes(
    'valid task output did not include "Task validation: pass"',
    validTask,
    "Task validation: pass",
  );

  const validTaskJson = runCli(["task", "validate", validTaskPath, "--json"]);
  expectExitCode("valid task --json validation exited nonzero", validTaskJson, 0);
  const parsedValidTask = parseJsonStdout(
    "valid task --json output was not valid JSON",
    validTaskJson,
  );
  if (
    parsedValidTask.ok !== true ||
    parsedValidTask.path !== validTaskPath ||
    parsedValidTask.status !== "pass" ||
    parsedValidTask.reason !== null
  ) {
    fail("valid task --json output did not match expected pass", validTaskJson);
  }
  expectEmptyArray("valid task --json issues was not empty", parsedValidTask.issues);

  const validTaskPlanStateBefore = taskStateSnapshot(projectRoot);
  const validTaskPlanJson = runCli([
    "task",
    "plan",
    "apps/cli/fixtures/tasks/valid-task.json",
    "--json",
  ]);
  expectExitCode(
    "checked-in valid task plan --json exited nonzero",
    validTaskPlanJson,
    0,
  );
  const parsedValidTaskPlan = parseJsonOnlyStdout(
    "checked-in valid task plan --json output was not valid JSON only",
    validTaskPlanJson,
  );
  expectTaskPlanParsedJsonShape(
    "checked-in valid task plan --json shape was invalid",
    parsedValidTaskPlan,
    validTaskPlanJson,
  );
  if (
    parsedValidTaskPlan.ok !== true ||
    parsedValidTaskPlan.status !== "planned" ||
    parsedValidTaskPlan.exitCode !== "success" ||
    parsedValidTaskPlan.summary.parsed !== true ||
    parsedValidTaskPlan.summary.mapped !== true ||
    parsedValidTaskPlan.summary.wired !== true ||
    parsedValidTaskPlan.summary.planned !== true ||
    parsedValidTaskPlan.mapping.runnerPlanningInputAvailable !== true ||
    parsedValidTaskPlan.mapping.noExecution !== true ||
    parsedValidTaskPlan.mapping.noWrites !== true ||
    parsedValidTaskPlan.summary.verifierRequired !== true ||
    parsedValidTaskPlan.summary.completionGatedByVerifier !== true ||
    parsedValidTaskPlan.summary.executionEnabled !== false ||
    parsedValidTaskPlan.summary.adapterCalls !== false ||
    parsedValidTaskPlan.summary.auditWrites !== false ||
    parsedValidTaskPlan.summary.verifierRun !== false ||
    parsedValidTaskPlan.summary.persistence !== false ||
    parsedValidTaskPlan.summary.filesystemMutation !== false ||
    parsedValidTaskPlan.summary.completedStateCreated !== false ||
    parsedValidTaskPlan.issues.length !== 0
  ) {
    fail(
      "checked-in valid task plan --json did not reach planned safe success",
      validTaskPlanJson,
    );
  }
  expectTaskStateSnapshotSame(
    "checked-in valid task plan --json must remain no-write for task state",
    projectRoot,
    validTaskPlanStateBefore,
    validTaskPlanJson,
  );

  const validTaskDryRunStateBefore = taskStateSnapshot(projectRoot);
  const validTaskDryRunJson = runCli([
    "task",
    "run",
    "--dry-run",
    "apps/cli/fixtures/tasks/valid-task.json",
    "--json",
  ]);
  expectExitCode(
    "checked-in valid task dry-run --json exited nonzero",
    validTaskDryRunJson,
    0,
  );
  const parsedValidTaskDryRun = parseJsonOnlyStdout(
    "checked-in valid task dry-run --json output was not valid JSON only",
    validTaskDryRunJson,
  );
  expectTaskDryRunSuccessJsonShape(
    "checked-in valid task dry-run --json shape was invalid",
    parsedValidTaskDryRun,
    validTaskDryRunJson,
  );
  if (
    parsedValidTaskDryRun.taskId !== "TASK-FIXTURE-VALID" ||
    parsedValidTaskDryRun.status !== "dry_run_ready" ||
    parsedValidTaskDryRun.dryRun.state !== "verification_required" ||
    parsedValidTaskDryRun.dryRun.summary.plannedWorkItems !== 1 ||
    parsedValidTaskDryRun.dryRun.summary.wouldCallAdapters !== 0 ||
    parsedValidTaskDryRun.dryRun.audit.emittedAuditEventIds.length !== 0 ||
    parsedValidTaskDryRun.dryRun.audit.wouldWriteAudit !== false ||
    parsedValidTaskDryRun.dryRun.verifier.wouldRunVerifier !== false ||
    parsedValidTaskDryRun.safety.persistence !== false ||
    parsedValidTaskDryRun.safety.completedStateCreated !== false
  ) {
    fail(
      "checked-in valid task dry-run --json did not reach safe preview success",
      validTaskDryRunJson,
    );
  }
  expectTaskDryRunNoRuntimeClaims(
    "checked-in valid task dry-run --json output",
    validTaskDryRunJson,
  );
  expectTaskStateSnapshotSame(
    "checked-in valid task dry-run --json must remain no-write for task state",
    projectRoot,
    validTaskDryRunStateBefore,
    validTaskDryRunJson,
  );

  const invalidTask = runCli(["task", "validate", invalidTaskPath]);
  expectNonzero("invalid task validation exited zero", invalidTask);
  expectOutputIncludes(
    'invalid task output did not include "Task validation: fail"',
    invalidTask,
    "Task validation: fail",
  );
  expectOutputIncludes(
    'invalid task output did not include concise issue summary',
    invalidTask,
    "- id: Task id is required.",
  );

  const invalidTaskJson = runCli(["task", "validate", invalidTaskPath, "--json"]);
  expectNonzero("invalid task --json validation exited zero", invalidTaskJson);
  const parsedInvalidTask = parseJsonStdout(
    "invalid task --json output was not valid JSON",
    invalidTaskJson,
  );
  if (
    parsedInvalidTask.ok !== false ||
    parsedInvalidTask.path !== invalidTaskPath ||
    parsedInvalidTask.status !== "fail" ||
    parsedInvalidTask.reason !== "validation_failed" ||
    !Array.isArray(parsedInvalidTask.issues) ||
    parsedInvalidTask.issues.length === 0
  ) {
    fail("invalid task --json output did not match expected failure", invalidTaskJson);
  }

  const primaryApplyCanaryPathOverride = runCli([
    "task",
    "execution",
    "primary-apply-canary",
    "TASK-0321",
    "--apply-id",
    "apply:test",
    "--expected-revision",
    "321",
    "--path",
    "packages/core/src/forbidden.ts",
    "--json",
  ]);
  expectNonzero(
    "primary apply canary path override exited zero",
    primaryApplyCanaryPathOverride,
  );
  const parsedPrimaryApplyCanaryPathOverride = parseJsonOnlyStdout(
    "primary apply canary path override output was not valid JSON only",
    primaryApplyCanaryPathOverride,
  );
  if (
    parsedPrimaryApplyCanaryPathOverride.ok !== false ||
    parsedPrimaryApplyCanaryPathOverride.status !== "invalid_arguments" ||
    parsedPrimaryApplyCanaryPathOverride.safety.generalPrimaryApplyEnabled !==
      false ||
    parsedPrimaryApplyCanaryPathOverride.safety.automaticPatchApply !== false ||
    parsedPrimaryApplyCanaryPathOverride.safety.realPrimaryApplyCanaryExecuted !==
      false
  ) {
    fail(
      "primary apply canary path override did not fail closed",
      primaryApplyCanaryPathOverride,
    );
  }
  expectIssueCode(
    "primary apply canary path override did not report forbidden authority override",
    parsedPrimaryApplyCanaryPathOverride.issues,
    "task_execution_primary_apply_canary_authority_override_forbidden",
    primaryApplyCanaryPathOverride,
  );

  const orchestrationCanaryRoot = join(smokeDir, "orchestration-canary");
  mkdirSync(orchestrationCanaryRoot, { recursive: true });
  const orchestrationCanaryPrepare = runCliFrom(orchestrationCanaryRoot, [
    "task",
    "execution",
    "orchestration-canary",
    "prepare",
    "--json",
  ]);
  expectExitCode(
    "orchestration canary prepare did not exit zero",
    orchestrationCanaryPrepare,
    0,
  );
  const parsedOrchestrationCanaryPrepare = parseJsonOnlyStdout(
    "orchestration canary prepare output was not valid JSON only",
    orchestrationCanaryPrepare,
  );
  if (
    parsedOrchestrationCanaryPrepare.ok !== true ||
    parsedOrchestrationCanaryPrepare.safety.RealTwoModelCanaryReady !== true ||
    parsedOrchestrationCanaryPrepare.safety.RealTwoModelCanaryExecuted !==
      false ||
    parsedOrchestrationCanaryPrepare.plannerCalls !== 0 ||
    parsedOrchestrationCanaryPrepare.workerCalls !== 0
  ) {
    fail(
      "orchestration canary prepare did not expose ready-not-executed state",
      orchestrationCanaryPrepare,
    );
  }

  const orchestrationCanaryForbidden = runCliFrom(orchestrationCanaryRoot, [
    "task",
    "execution",
    "orchestration-canary",
    "run",
    parsedOrchestrationCanaryPrepare.taskId,
    "--orchestration-id",
    parsedOrchestrationCanaryPrepare.orchestrationId,
    "--expected-revision",
    String(parsedOrchestrationCanaryPrepare.taskRevision),
    "--expected-planner-invocation-revision",
    String(parsedOrchestrationCanaryPrepare.plannerInvocationRevision),
    "--expected-worker-invocation-revision",
    String(parsedOrchestrationCanaryPrepare.workerInvocationRevision),
    "--worker",
    "claude_code",
    "--json",
  ]);
  expectNonzero(
    "orchestration canary forbidden override exited zero",
    orchestrationCanaryForbidden,
  );
  const parsedOrchestrationCanaryForbidden = parseJsonOnlyStdout(
    "orchestration canary forbidden output was not valid JSON only",
    orchestrationCanaryForbidden,
  );
  if (
    parsedOrchestrationCanaryForbidden.ok !== false ||
    parsedOrchestrationCanaryForbidden.status !== "invalid_arguments" ||
    parsedOrchestrationCanaryForbidden.error.code !==
      "task_execution_orchestration_canary_authority_override_forbidden"
  ) {
    fail(
      "orchestration canary forbidden override did not fail closed",
      orchestrationCanaryForbidden,
    );
  }
} finally {
  for (const path of createdMemoryPaths) {
    if (existsSync(path)) {
      unlinkSync(path);
    }
  }

  rmSync(smokeDir, { recursive: true, force: true });
}

console.log("AEOS CLI smoke passed.");
