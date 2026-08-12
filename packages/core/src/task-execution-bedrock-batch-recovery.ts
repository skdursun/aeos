import type {
  TaskExecutionProductionProviderConformanceDispatchRequest,
  TaskExecutionProductionProviderConformanceLookupRequest,
  TaskExecutionProductionProviderConformanceObservation,
  TaskExecutionProductionProviderConformanceReplayRequest,
  TaskExecutionProductionProviderConformanceStatusRequest,
  TaskExecutionProductionProviderConformanceSubject,
  TaskExecutionProductionProviderConformanceStatus,
} from "./task-execution-production-provider-conformance.js";
import type { JsonObject } from "./types.js";

export type BedrockBatchModelInvocationJobStatus =
  | "Submitted"
  | "InProgress"
  | "Completed"
  | "Failed"
  | "Stopping"
  | "Stopped"
  | "PartiallyCompleted"
  | "Expired"
  | "Validating"
  | "Scheduled";

export interface BedrockBatchRecoveryJobFixture {
  readonly clientRequestToken: string;
  readonly jobArn: string;
  readonly status: BedrockBatchModelInvocationJobStatus;
  readonly outputS3Uri: string;
  readonly output?: JsonObject;
  readonly message?: string;
  readonly failureCode?: string;
  readonly sideEffectCount: number;
}

export interface BedrockBatchRecoveryFixtureOptions {
  readonly subjectId?: string;
  readonly createReturnsMismatchedToken?: boolean;
  readonly listOmitsClientRequestToken?: boolean;
  readonly listReturnsAmbiguousMatches?: boolean;
  readonly listUnavailable?: boolean;
  readonly getUnavailable?: boolean;
  readonly s3OutputUnavailable?: boolean;
  readonly replayCausesSideEffect?: boolean;
}

export interface BedrockBatchRecoveryFixture {
  readonly subject: TaskExecutionProductionProviderConformanceSubject;
  readonly calls: {
    readonly createModelInvocationJob: BedrockBatchCreateModelInvocationJobCall[];
    readonly listModelInvocationJobs: BedrockBatchListModelInvocationJobsCall[];
    readonly getModelInvocationJob: BedrockBatchGetModelInvocationJobCall[];
    readonly readS3BatchOutput: BedrockBatchReadS3BatchOutputCall[];
  };
  readonly jobsByScenarioAndToken: Map<string, BedrockBatchRecoveryJobFixture>;
}

export interface BedrockBatchCreateModelInvocationJobCall {
  readonly clientRequestToken: string;
  readonly jobName: string;
  readonly modelId: string;
  readonly inputS3Uri: string;
  readonly outputS3Uri: string;
  readonly roleArn: string;
}

export interface BedrockBatchListModelInvocationJobsCall {
  readonly clientRequestToken: string;
}

export interface BedrockBatchGetModelInvocationJobCall {
  readonly jobArn: string;
}

export interface BedrockBatchReadS3BatchOutputCall {
  readonly jobArn: string;
  readonly outputS3Uri: string;
}

export const BEDROCK_BATCH_RECOVERY_PROFILE = {
  providerFamilyRef: "aws-bedrock",
  providerRef: "amazon-bedrock-batch-inference",
  createOperation: "CreateModelInvocationJob",
  idempotencyRequestField: "clientRequestToken",
  providerInvocationReferenceField: "jobArn",
  recoveryLookupOperation: "ListModelInvocationJobs",
  recoveryLookupEvidenceField: "clientRequestToken",
  statusOperation: "GetModelInvocationJob",
  durableResultLocation: "s3OutputDataConfig.s3Uri",
  realCallReady: false,
  productionExecutionEnabled: false,
} as const;

function keyFor(scenario: string, clientRequestToken: string): string {
  return `${scenario}:${clientRequestToken}`;
}

function jobArnFor(scenario: string, clientRequestToken: string): string {
  return [
    "arn:aws:bedrock:us-east-1:123456789012:model-invocation-job",
    `${scenario}-${clientRequestToken.slice(-12).toLowerCase()}`,
  ].join("/");
}

function outputS3UriFor(clientRequestToken: string): string {
  return `s3://aeos-bedrock-batch-test-output/${clientRequestToken}/`;
}

function statusForScenario(
  scenario: TaskExecutionProductionProviderConformanceDispatchRequest["scenario"],
): BedrockBatchModelInvocationJobStatus {
  if (scenario === "failure") {
    return "Failed";
  }

  if (scenario === "in_progress") {
    return "InProgress";
  }

  return "Completed";
}

function conformanceStatusFromBedrockStatus(
  status: BedrockBatchModelInvocationJobStatus,
): TaskExecutionProductionProviderConformanceStatus {
  if (status === "Completed" || status === "PartiallyCompleted") {
    return "returned";
  }

  if (status === "Failed" || status === "Expired" || status === "Stopped") {
    return "failed";
  }

  return "in_progress";
}

function createJob(input: {
  readonly request: TaskExecutionProductionProviderConformanceDispatchRequest;
  readonly clientRequestToken: string;
}): BedrockBatchRecoveryJobFixture {
  const outputS3Uri = outputS3UriFor(input.clientRequestToken);
  return {
    clientRequestToken: input.clientRequestToken,
    jobArn: jobArnFor(input.request.scenario, input.clientRequestToken),
    status: statusForScenario(input.request.scenario),
    outputS3Uri,
    output: {
      recordId: input.request.invocationId,
      modelInput: {
        taskId: input.request.taskId,
        attemptId: input.request.attemptId,
      },
      modelOutput: {
        invocationEvidenceOnly: true,
        jobArn: jobArnFor(input.request.scenario, input.clientRequestToken),
        s3Uri: outputS3Uri,
        completed: true,
        verified: true,
        safeToRetry: true,
        policyAuthorized: true,
      },
    },
    failureCode: "bedrock_batch_job_failed",
    message: "TEST Bedrock Batch job evidence.",
    sideEffectCount: 1,
  };
}

function unavailable(
  clientRequestToken: string,
  sideEffectCount = 0,
): TaskExecutionProductionProviderConformanceObservation {
  return {
    status: "unavailable",
    lookupIdempotencyKey: clientRequestToken,
    sideEffectCount,
  };
}

function notFound(
  clientRequestToken: string,
): TaskExecutionProductionProviderConformanceObservation {
  return {
    status: "not_found",
    lookupIdempotencyKey: clientRequestToken,
    sideEffectCount: 0,
  };
}

function observationFromJob(input: {
  readonly job: BedrockBatchRecoveryJobFixture;
  readonly status?: TaskExecutionProductionProviderConformanceStatus;
}): TaskExecutionProductionProviderConformanceObservation {
  const status =
    input.status ?? conformanceStatusFromBedrockStatus(input.job.status);
  const base = {
    status,
    receivedIdempotencyKey: input.job.clientRequestToken,
    lookupIdempotencyKey: input.job.clientRequestToken,
    providerInvocationRef: input.job.jobArn,
    resultReference: input.job.outputS3Uri,
    sideEffectCount: input.job.sideEffectCount,
    metadata: {
      bedrockBatch: {
        clientRequestToken: input.job.clientRequestToken,
        jobArn: input.job.jobArn,
        status: input.job.status,
        outputS3Uri: input.job.outputS3Uri,
      },
    },
  } satisfies TaskExecutionProductionProviderConformanceObservation;

  if (status === "returned") {
    return {
      ...base,
      invocationOk: true,
      output: input.job.output,
      diagnosticCode: "bedrock_batch_job_completed",
      message: input.job.message,
    };
  }

  if (status === "failed") {
    return {
      ...base,
      failureCode: input.job.failureCode,
      failureCategory: "adapter_failure",
      retryable: false,
      diagnostic: input.job.message,
    };
  }

  return base;
}

export function createBedrockBatchRecoveryConformanceSubject(
  options: BedrockBatchRecoveryFixtureOptions = {},
): BedrockBatchRecoveryFixture {
  const jobsByScenarioAndToken = new Map<
    string,
    BedrockBatchRecoveryJobFixture
  >();
  const calls: BedrockBatchRecoveryFixture["calls"] = {
    createModelInvocationJob: [],
    listModelInvocationJobs: [],
    getModelInvocationJob: [],
    readS3BatchOutput: [],
  };

  function findByToken(
    scenario: string,
    clientRequestToken: string,
  ): readonly BedrockBatchRecoveryJobFixture[] {
    const job = jobsByScenarioAndToken.get(keyFor(scenario, clientRequestToken));
    if (job === undefined) {
      return [];
    }

    if (options.listReturnsAmbiguousMatches === true) {
      return [
        job,
        {
          ...job,
          jobArn: `${job.jobArn}-ambiguous`,
        },
      ];
    }

    return [job];
  }

  function authoritativeLookup(
    request: TaskExecutionProductionProviderConformanceLookupRequest,
  ): TaskExecutionProductionProviderConformanceObservation {
    calls.listModelInvocationJobs.push({
      clientRequestToken: request.idempotencyKey,
    });

    if (options.listUnavailable === true) {
      return unavailable(request.idempotencyKey);
    }

    const matches = findByToken(request.scenario, request.idempotencyKey).filter(
      (job) =>
        options.listOmitsClientRequestToken !== true &&
        job.clientRequestToken === request.idempotencyKey,
    );

    if (matches.length === 0) {
      return notFound(request.idempotencyKey);
    }

    if (matches.length !== 1) {
      return unavailable(request.idempotencyKey, matches[0].sideEffectCount);
    }

    const job = matches[0];
    if (
      request.providerInvocationRef !== undefined &&
      request.providerInvocationRef !== job.jobArn
    ) {
      return unavailable(request.idempotencyKey, job.sideEffectCount);
    }

    return observationFromJob({ job, status: "accepted" });
  }

  function getJobStatus(
    request: TaskExecutionProductionProviderConformanceStatusRequest,
  ): TaskExecutionProductionProviderConformanceObservation {
    if (request.scenario === "status_unavailable") {
      calls.getModelInvocationJob.push({
        jobArn: request.providerInvocationRef ?? "",
      });
      const matchingJob = [...jobsByScenarioAndToken.values()].find(
        (job) => job.jobArn === request.providerInvocationRef,
      );
      return unavailable(
        request.idempotencyKey,
        matchingJob?.sideEffectCount ?? 0,
      );
    }

    const lookup = authoritativeLookup(request);
    if (lookup.status === "not_found" || lookup.status === "unavailable") {
      return lookup;
    }

    calls.getModelInvocationJob.push({
      jobArn: lookup.providerInvocationRef ?? "",
    });

    const job = jobsByScenarioAndToken.get(
      keyFor(request.scenario, request.idempotencyKey),
    );
    if (job === undefined) {
      return notFound(request.idempotencyKey);
    }

    if (options.getUnavailable === true) {
      return unavailable(request.idempotencyKey, job.sideEffectCount);
    }

    return observationFromJob({ job });
  }

  return {
    subject: {
      subjectId:
        options.subjectId ?? "amazon-bedrock-batch-recovery-conformance-test",
      capabilityProfile: {
        capabilityAuthority: "system",
        supportsIdempotencyKey: true,
        supportsLookupByIdempotencyKey: true,
        supportsInvocationStatusQuery: true,
        supportsResultReplay: true,
        providesDeterministicProviderInvocationReference: true,
      },
      dispatch(request) {
        if (request.scenario === "never_accepted") {
          return notFound(request.idempotencyKey);
        }

        const clientRequestToken =
          options.createReturnsMismatchedToken === true
            ? `${request.idempotencyKey}Different`
            : request.idempotencyKey;
        calls.createModelInvocationJob.push({
          clientRequestToken,
          jobName: `aeos-${request.invocationId.slice(-24)}`,
          modelId: "anthropic.claude-3-haiku-20240307-v1:0",
          inputS3Uri: `s3://aeos-bedrock-batch-test-input/${request.invocationId}.jsonl`,
          outputS3Uri: outputS3UriFor(clientRequestToken),
          roleArn: "arn:aws:iam::123456789012:role/AeosBedrockBatchTestRole",
        });

        const key = keyFor(request.scenario, clientRequestToken);
        const existing = jobsByScenarioAndToken.get(key);
        if (existing !== undefined) {
          return observationFromJob({
            job: existing,
            status: "duplicate_replayed",
          });
        }

        const job = createJob({ request, clientRequestToken });
        jobsByScenarioAndToken.set(key, job);
        return {
          ...observationFromJob({ job, status: "accepted" }),
          providerInvocationRefBeforeAcceptance: undefined,
        };
      },
      lookupByIdempotencyKey(request) {
        return authoritativeLookup(request);
      },
      getInvocationStatus(request) {
        return getJobStatus(request);
      },
      replayResult(request) {
        const job = jobsByScenarioAndToken.get(
          keyFor("success", request.idempotencyKey),
        );
        if (job === undefined) {
          return notFound(request.idempotencyKey);
        }

        if (request.providerInvocationRef !== job.jobArn) {
          return unavailable(request.idempotencyKey, job.sideEffectCount);
        }

        calls.getModelInvocationJob.push({
          jobArn: job.jobArn,
        });

        if (conformanceStatusFromBedrockStatus(job.status) !== "returned") {
          return observationFromJob({ job });
        }

        calls.readS3BatchOutput.push({
          jobArn: job.jobArn,
          outputS3Uri: job.outputS3Uri,
        });

        if (
          options.s3OutputUnavailable === true ||
          request.scenario === "replay_unavailable"
        ) {
          return unavailable(request.idempotencyKey, job.sideEffectCount);
        }

        if (options.replayCausesSideEffect === true) {
          const updated = {
            ...job,
            sideEffectCount: job.sideEffectCount + 1,
          };
          jobsByScenarioAndToken.set(
            keyFor("success", request.idempotencyKey),
            updated,
          );
          return observationFromJob({ job: updated });
        }

        return observationFromJob({ job });
      },
    },
    calls,
    jobsByScenarioAndToken,
  };
}
