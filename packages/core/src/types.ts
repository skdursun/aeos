export type AeosId = string;

export type ISODateTime = string;

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonObject
  | readonly JsonValue[];

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type Result<T, E> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly error: E;
    };

export type AeosErrorCategory =
  | "validation"
  | "policy"
  | "permission"
  | "timeout"
  | "provider"
  | "not_found"
  | "conflict"
  | "unknown";

export interface AeosError {
  readonly code: string;
  readonly message: string;
  readonly category: AeosErrorCategory;
  readonly retryable: boolean;
  readonly details?: JsonObject;
}

export type RiskClass =
  | "safe_read"
  | "safe_write"
  | "generated_file_write"
  | "shell_read"
  | "shell_write"
  | "dependency_change"
  | "git_write"
  | "file_delete"
  | "migration"
  | "deployment"
  | "secret_access"
  | "destructive";

export type PermissionLevel =
  | "read_only"
  | "write_safe"
  | "shell_limited"
  | "network_limited"
  | "destructive_requires_approval"
  | "deployment_requires_approval";

export type PolicyDecisionStatus = "allow" | "deny" | "requires_approval";

export type VerificationStatus = "pass" | "fail" | "blocked" | "skipped";

export type AuditEventType =
  | "task_started"
  | "task_completed"
  | "agent_invoked"
  | "model_invoked"
  | "tool_requested"
  | "tool_executed"
  | "policy_checked"
  | "policy_denied"
  | "file_changed"
  | "verification_run"
  | "verification_failed"
  | "memory_written"
  | "approval_requested"
  | "approval_granted"
  | "approval_denied"
  | "error_raised";

export type AgentRole =
  | "orchestrator"
  | "implementer"
  | "reviewer"
  | "verifier"
  | "planner"
  | "documenter";

export interface Capability {
  readonly name: string;
  readonly version: string;
  readonly riskClass: RiskClass;
  readonly requiresApproval: boolean;
  readonly permissionLevel?: PermissionLevel;
  readonly limits?: JsonObject;
}

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "blocked"
  | "cancelled";

export interface FileChangeSummary {
  readonly path: string;
  readonly changeType: "created" | "modified" | "deleted" | "renamed";
  readonly summary: string;
  readonly previousPath?: string;
}

export interface VerificationSummary {
  readonly status: VerificationStatus;
  readonly checksRun: readonly string[];
  readonly passed: readonly string[];
  readonly failed: readonly string[];
  readonly blocked: readonly string[];
  readonly skipped: readonly string[];
  readonly evidence: readonly string[];
}

export interface HandoffSummary {
  readonly taskId: AeosId;
  readonly status: TaskStatus;
  readonly summary: string;
  readonly filesChanged: readonly FileChangeSummary[];
  readonly verification: VerificationSummary;
  readonly problems: readonly string[];
  readonly nextSuggestedTask?: AeosId;
}
