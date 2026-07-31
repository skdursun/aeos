import type {
  AeosError,
  AeosId,
  AuditEventType,
  ISODateTime,
  JsonObject,
  PermissionLevel,
  PolicyDecisionStatus,
  Result,
  RiskClass,
  VerificationStatus,
} from "./types.js";
import type { ApprovalId, PolicyDecisionId } from "./policy.js";

export type AuditEventId = AeosId;

export type AuditCorrelationId = AeosId;

export type AuditActorType =
  | "human"
  | "agent"
  | "model"
  | "tool"
  | "system";

export type AuditTargetType =
  | "task"
  | "file"
  | "directory"
  | "agent"
  | "model"
  | "tool"
  | "policy"
  | "verification"
  | "memory"
  | "approval"
  | "secret"
  | "repository"
  | "system";

export type AuditResultStatus =
  | "ok"
  | "partial"
  | "blocked"
  | "denied"
  | "failed"
  | "not_run";

export type AuditRedactionStatus =
  | "not_required"
  | "redacted"
  | "partially_redacted"
  | "blocked"
  | "failed";

export type AuditRetentionPolicy =
  | "default"
  | "short_lived"
  | "task_lifetime"
  | "project_lifetime"
  | "legal_hold";

export interface AuditSecretReference {
  readonly id?: AeosId;
  readonly provider?: string;
  readonly scope: readonly string[];
  readonly purpose: string;
  readonly approvedBy?: ApprovalId;
  readonly redactionStatus: AuditRedactionStatus;
}

export interface AuditActor {
  readonly id: AeosId | string;
  readonly type: AuditActorType;
  readonly adapterId?: AeosId;
  readonly displayName?: string;
  readonly metadata?: JsonObject;
}

export interface AuditTarget {
  readonly type: AuditTargetType;
  readonly id?: AeosId | string;
  readonly path?: string;
  readonly name?: string;
  readonly scope?: readonly string[];
  readonly metadata?: JsonObject;
}

export interface AuditMetadata {
  readonly summary?: string;
  readonly intent?: string;
  readonly workingDirectory?: string;
  readonly affectedPaths?: readonly string[];
  readonly outputSummary?: string;
  readonly reason?: string;
  readonly constraints?: readonly string[];
  readonly tags?: readonly string[];
  readonly entryType?: string;
  readonly verificationStatus?: VerificationStatus;
  readonly usage?: JsonObject;
  readonly secretReferences?: readonly AuditSecretReference[];
  readonly data?: JsonObject;
}

export interface AuditResult {
  readonly status: AuditResultStatus;
  readonly decision?: PolicyDecisionStatus;
  readonly verificationStatus?: VerificationStatus;
  readonly exitCode?: number;
  readonly errorCode?: string;
  readonly retryable?: boolean;
  readonly error?: AeosError;
  readonly metadata?: JsonObject;
}

export interface AuditEvent {
  readonly id: AuditEventId;
  readonly timestamp: ISODateTime;
  readonly eventType: AuditEventType;
  readonly taskId: AeosId | "unknown";
  readonly correlationId: AuditCorrelationId;
  readonly parentEventId?: AuditEventId;
  readonly actor: AuditActor;
  readonly action: string;
  readonly target: AuditTarget;
  readonly result: AuditResult;
  readonly adapterId?: AeosId;
  readonly riskClass?: RiskClass;
  readonly permissionLevel?: PermissionLevel;
  readonly approvalId?: ApprovalId;
  readonly approvalState?:
    | "not_required"
    | "required"
    | "approved"
    | "denied";
  readonly policyDecisionId?: PolicyDecisionId;
  readonly durationMs?: number;
  readonly metadata?: AuditMetadata;
  readonly redactionStatus: AuditRedactionStatus;
  readonly redactionsApplied: boolean;
  readonly retentionPolicy?: AuditRetentionPolicy;
}

export interface AuditWriteRequest {
  readonly event: AuditEvent;
  readonly sinkId?: AeosId;
  readonly idempotencyKey?: string;
  readonly requestedAt?: ISODateTime;
  readonly metadata?: JsonObject;
}

export interface AuditWriteSuccess {
  readonly eventId: AuditEventId;
  readonly sinkId?: AeosId;
  readonly writtenAt: ISODateTime;
  readonly redactionStatus: AuditRedactionStatus;
  readonly metadata?: JsonObject;
}

export type AuditWriteResult = Result<AuditWriteSuccess, AeosError>;

export interface AuditQueryFilter {
  readonly eventIds?: readonly AuditEventId[];
  readonly eventTypes?: readonly AuditEventType[];
  readonly taskIds?: readonly (AeosId | "unknown")[];
  readonly correlationIds?: readonly AuditCorrelationId[];
  readonly parentEventIds?: readonly AuditEventId[];
  readonly actorIds?: readonly string[];
  readonly actorTypes?: readonly AuditActorType[];
  readonly targetTypes?: readonly AuditTargetType[];
  readonly targetIds?: readonly string[];
  readonly riskClasses?: readonly RiskClass[];
  readonly permissionLevels?: readonly PermissionLevel[];
  readonly policyDecisionIds?: readonly PolicyDecisionId[];
  readonly approvalIds?: readonly ApprovalId[];
  readonly resultStatuses?: readonly AuditResultStatus[];
  readonly verificationStatuses?: readonly VerificationStatus[];
  readonly redactionStatuses?: readonly AuditRedactionStatus[];
  readonly tags?: readonly string[];
  readonly pathPrefixes?: readonly string[];
  readonly fromTimestamp?: ISODateTime;
  readonly toTimestamp?: ISODateTime;
}

export interface AuditQuery {
  readonly filter?: AuditQueryFilter;
  readonly limit?: number;
  readonly cursor?: string;
  readonly order?: "asc" | "desc";
  readonly includeMetadata?: boolean;
  readonly requestedAt?: ISODateTime;
  readonly metadata?: JsonObject;
}

export interface AuditQueryResult {
  readonly events: readonly AuditEvent[];
  readonly nextCursor?: string;
  readonly totalCount?: number;
  readonly queriedAt: ISODateTime;
  readonly metadata?: JsonObject;
}

export interface AuditSink {
  readonly id: AeosId;
  readonly name: string;
  readonly kind: "jsonl" | "database" | "external" | "memory" | "custom";
  readonly appendOnly: boolean;
  readonly supportsQuery: boolean;
  readonly retentionPolicy?: AuditRetentionPolicy;
  readonly metadata?: JsonObject;
}
