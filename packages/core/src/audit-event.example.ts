import type { AuditEvent, AuditMetadata, AuditResult } from "./audit.js";
import {
  createAuditCorrelationId,
  createAuditEvent,
  createAuditMetadata,
  createAuditResult,
  isAuditFailure,
  isAuditSuccess,
  isRedacted,
} from "./audit-event.js";

export const exampleAuditCorrelationId = createAuditCorrelationId("example");

export const exampleRedactedAuditMetadata: AuditMetadata = createAuditMetadata({
  summary: "Typecheck example metadata with redacted sensitive context.",
  outputSummary: "Sensitive values omitted.",
  affectedPaths: ["packages/core/src/audit-event.example.ts"],
  tags: ["typecheck", "audit", "redacted"],
  secretReferences: [
    {
      scope: ["example", "credential"],
      purpose: "Demonstrate redacted audit metadata without storing a secret.",
      redactionStatus: "redacted",
    },
  ],
  data: {
    redacted: true,
    sample: "placeholder",
  },
});

export const exampleSuccessfulAuditEvent: AuditEvent = createAuditEvent({
  id: "audit:event:example:success",
  timestamp: "2026-07-31T00:00:00.000Z",
  eventType: "tool_executed",
  taskId: "TASK-0033",
  correlationId: exampleAuditCorrelationId,
  actor: {
    id: "agent:codex",
    type: "agent",
    displayName: "Codex",
  },
  action: "typecheck_audit_event_example",
  target: {
    type: "file",
    path: "packages/core/src/audit-event.example.ts",
  },
  result: {
    status: "ok",
    metadata: {
      example: true,
    },
  },
  metadata: exampleRedactedAuditMetadata,
  redactionStatus: "redacted",
});

export const exampleFailedAuditResult: AuditResult = createAuditResult({
  status: "failed",
  errorCode: "AEOS_EXAMPLE_FAILURE",
  retryable: false,
  metadata: {
    reason: "Synthetic typecheck example failure.",
  },
});

export const exampleAuditSuccessPredicate = isAuditSuccess(
  exampleSuccessfulAuditEvent.result,
);

export const exampleAuditFailurePredicate = isAuditFailure(
  exampleFailedAuditResult,
);

export const exampleRedactedPredicate = isRedacted("redacted");
