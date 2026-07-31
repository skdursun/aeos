import type {
  AuditCorrelationId,
  AuditEvent,
  AuditMetadata,
  AuditRedactionStatus,
  AuditResult,
} from "./audit.js";

export type CreateAuditEventInput = Omit<
  AuditEvent,
  "result" | "metadata" | "redactionsApplied"
> & {
  readonly result: CreateAuditResultInput;
  readonly metadata?: CreateAuditMetadataInput;
  readonly redactionsApplied?: boolean;
};

export type CreateAuditMetadataInput = AuditMetadata;

export type CreateAuditResultInput = AuditResult;

export function createAuditEvent(input: CreateAuditEventInput): AuditEvent {
  const event: AuditEvent = {
    ...input,
    result: createAuditResult(input.result),
    redactionsApplied: input.redactionsApplied ?? isRedacted(input.redactionStatus),
  };

  if (input.metadata === undefined) {
    return event;
  }

  return {
    ...event,
    metadata: createAuditMetadata(input.metadata),
  };
}

export function createAuditCorrelationId(
  prefix = "audit",
): AuditCorrelationId {
  return `${prefix}:correlation`;
}

export function createAuditMetadata(
  input: CreateAuditMetadataInput,
): AuditMetadata {
  return {
    ...input,
    affectedPaths:
      input.affectedPaths === undefined ? undefined : [...input.affectedPaths],
    constraints:
      input.constraints === undefined ? undefined : [...input.constraints],
    tags: input.tags === undefined ? undefined : [...input.tags],
    secretReferences:
      input.secretReferences === undefined
        ? undefined
        : input.secretReferences.map((reference) => ({
            ...reference,
            scope: [...reference.scope],
          })),
  };
}

export function createAuditResult(input: CreateAuditResultInput): AuditResult {
  return {
    ...input,
  };
}

export function isAuditSuccess(result: AuditResult): boolean {
  return result.status === "ok";
}

export function isAuditFailure(result: AuditResult): boolean {
  return result.status === "blocked" || result.status === "denied" || result.status === "failed";
}

export function isRedacted(status: AuditRedactionStatus): boolean {
  return (
    status === "redacted" ||
    status === "partially_redacted" ||
    status === "blocked"
  );
}
