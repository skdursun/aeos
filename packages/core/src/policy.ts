import type {
  AeosError,
  AeosId,
  ISODateTime,
  JsonObject,
  PermissionLevel,
  PolicyDecisionStatus,
  Result,
  RiskClass,
} from "./types.js";

export type PolicyDecisionId = AeosId;

export type PolicyRuleId = AeosId;

export type ApprovalId = AeosId;

export type PolicyRuleEffect = PolicyDecisionStatus;

export type ApprovalStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "denied"
  | "expired"
  | "revoked";

export interface PermissionScope {
  readonly type:
    | "workspace"
    | "path"
    | "command"
    | "tool"
    | "mcp_tool"
    | "git"
    | "dependency"
    | "migration"
    | "deployment"
    | "memory"
    | "secret"
    | "network";
  readonly values: readonly string[];
  readonly excludedValues?: readonly string[];
  readonly constraints?: readonly string[];
  readonly metadata?: JsonObject;
}

export interface PermissionGrant {
  readonly id: AeosId;
  readonly subjectId: string;
  readonly permissionLevel: PermissionLevel;
  readonly scopes: readonly PermissionScope[];
  readonly grantedBy?: string;
  readonly grantedAt?: ISODateTime;
  readonly expiresAt?: ISODateTime;
  readonly reason?: string;
  readonly metadata?: JsonObject;
}

export interface ProposedActionTarget {
  readonly type:
    | "file"
    | "directory"
    | "shell_command"
    | "git_repository"
    | "dependency_manifest"
    | "mcp_tool"
    | "tool"
    | "memory"
    | "migration"
    | "deployment"
    | "secret"
    | "network"
    | "system";
  readonly id?: string;
  readonly path?: string;
  readonly name?: string;
  readonly scope?: readonly string[];
  readonly metadata?: JsonObject;
}

export interface ActionRiskAssessment {
  readonly riskClass: RiskClass;
  readonly permissionLevel: PermissionLevel;
  readonly requiresApproval: boolean;
  readonly reversible: boolean;
  readonly externalSideEffects: boolean;
  readonly touchesSecrets: boolean;
  readonly touchesPersistentState: boolean;
  readonly reasons: readonly string[];
  readonly mitigations?: readonly string[];
  readonly metadata?: JsonObject;
}

export interface ProposedAction {
  readonly id: AeosId;
  readonly taskId: AeosId;
  readonly actorId: string;
  readonly adapterId?: AeosId;
  readonly action: string;
  readonly intent: string;
  readonly target: ProposedActionTarget;
  readonly risk: ActionRiskAssessment;
  readonly requestedPermission: PermissionLevel;
  readonly requestedScope: readonly PermissionScope[];
  readonly expectedSideEffects: readonly string[];
  readonly approvalStatus: ApprovalStatus;
  readonly metadata?: JsonObject;
}

export interface ApprovalRequest {
  readonly id: ApprovalId;
  readonly taskId: AeosId;
  readonly action: ProposedAction;
  readonly requestedBy: string;
  readonly requestedAt: ISODateTime;
  readonly reason: string;
  readonly scope: readonly PermissionScope[];
  readonly riskClass: RiskClass;
  readonly permissionLevel: PermissionLevel;
  readonly expiresAt?: ISODateTime;
  readonly auditReference?: PolicyAuditReference;
  readonly metadata?: JsonObject;
}

export interface ApprovalResponse {
  readonly approvalId: ApprovalId;
  readonly status: ApprovalStatus;
  readonly respondedBy: string;
  readonly respondedAt: ISODateTime;
  readonly reason?: string;
  readonly approvedScope?: readonly PermissionScope[];
  readonly constraints?: readonly string[];
  readonly auditReference?: PolicyAuditReference;
  readonly metadata?: JsonObject;
}

export interface PolicyAuditReference {
  readonly auditRequired: boolean;
  readonly correlationId: AeosId;
  readonly eventId?: AeosId;
  readonly parentEventId?: AeosId;
  readonly decisionEventType?: "policy_checked" | "policy_denied";
  readonly approvalEventId?: AeosId;
  readonly redactionsApplied?: boolean;
  readonly summary?: string;
  readonly metadata?: JsonObject;
}

export interface PolicyDecision {
  readonly id: PolicyDecisionId;
  readonly actionId: AeosId;
  readonly status: PolicyDecisionStatus;
  readonly riskClass: RiskClass;
  readonly permissionLevel: PermissionLevel;
  readonly reason: string;
  readonly matchedRuleIds: readonly PolicyRuleId[];
  readonly approvalRequestId?: ApprovalId;
  readonly approvalScope?: readonly PermissionScope[];
  readonly constraints?: readonly string[];
  readonly violations?: readonly PolicyViolation[];
  readonly auditRequired: boolean;
  readonly auditReference?: PolicyAuditReference;
  readonly decidedAt: ISODateTime;
  readonly metadata?: JsonObject;
}

export interface PolicyRule {
  readonly id: PolicyRuleId;
  readonly name: string;
  readonly description?: string;
  readonly effect: PolicyRuleEffect;
  readonly riskClasses: readonly RiskClass[];
  readonly permissionLevels: readonly PermissionLevel[];
  readonly scopes?: readonly PermissionScope[];
  readonly constraints?: readonly string[];
  readonly priority?: number;
  readonly enabled: boolean;
  readonly metadata?: JsonObject;
}

export interface PolicyViolation {
  readonly code: string;
  readonly message: string;
  readonly severity: "warning" | "error" | "critical";
  readonly ruleId?: PolicyRuleId;
  readonly actionId?: AeosId;
  readonly scope?: readonly PermissionScope[];
  readonly remediation?: string;
  readonly metadata?: JsonObject;
}

export interface PolicyEvaluationContext {
  readonly taskId: AeosId;
  readonly correlationId: AeosId;
  readonly actorId: string;
  readonly workspacePath?: string;
  readonly grants: readonly PermissionGrant[];
  readonly approvals: readonly ApprovalResponse[];
  readonly loadedContext: readonly string[];
  readonly allowedScopes: readonly PermissionScope[];
  readonly deniedScopes: readonly PermissionScope[];
  readonly auditReference?: PolicyAuditReference;
  readonly evaluatedAt?: ISODateTime;
  readonly metadata?: JsonObject;
}

export interface PolicyEvaluationRequest {
  readonly action: ProposedAction;
  readonly context: PolicyEvaluationContext;
  readonly rules?: readonly PolicyRule[];
  readonly metadata?: JsonObject;
}

export interface PolicyEvaluationSuccess {
  readonly decision: PolicyDecision;
  readonly violations: readonly PolicyViolation[];
  readonly auditReference?: PolicyAuditReference;
  readonly metadata?: JsonObject;
}

export type PolicyEvaluationResult = Result<PolicyEvaluationSuccess, AeosError>;
