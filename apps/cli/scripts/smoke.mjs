import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const projectRoot = fileURLToPath(new URL("../../..", import.meta.url));
const commandsSourcePath = fileURLToPath(new URL("../src/commands.ts", import.meta.url));

function runCli(args) {
  return runCliFrom(projectRoot, args);
}

function runCliFrom(cwd, args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
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
    ".aeos/audit",
  ]) {
    if (existsSync(join(rootPath, unexpectedPath))) {
      fail(`${message}: created ${unexpectedPath}`, result);
    }
  }
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
} finally {
  rmSync(taskPlanNoWriteRoot, { recursive: true, force: true });
  rmSync(taskPlanTraversalParentRoot, { recursive: true, force: true });
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
} finally {
  for (const path of createdMemoryPaths) {
    if (existsSync(path)) {
      unlinkSync(path);
    }
  }

  rmSync(smokeDir, { recursive: true, force: true });
}

console.log("AEOS CLI smoke passed.");
