import type {
  AeosError,
  AeosId,
  AgentRole,
  AuditEventType,
  Capability,
  FileChangeSummary,
  ISODateTime,
  JsonObject,
  JsonValue,
  PermissionLevel,
  PolicyDecisionStatus,
  RiskClass,
  TaskStatus,
  VerificationStatus,
  VerificationSummary,
} from "./types.js";

export type AdapterKind =
  | "model"
  | "agent"
  | "tool"
  | "mcp_tool"
  | "memory"
  | "project"
  | "template"
  | "verifier"
  | "policy"
  | "audit";

export type AdapterCapability = Capability;

export type AdapterHealthStatus =
  | "healthy"
  | "degraded"
  | "unavailable"
  | "unknown";

export type AdapterResultStatus =
  | "ok"
  | "partial"
  | "blocked"
  | "unsupported"
  | "failed";

export interface AdapterMetadata {
  readonly name: string;
  readonly version: string;
  readonly contractVersion: string;
  readonly description?: string;
  readonly owner?: string;
  readonly labels?: readonly string[];
}

export interface AdapterContext {
  readonly taskId: AeosId;
  readonly workspacePath?: string;
  readonly actor?: AuditActor;
  readonly policy?: PolicyContext;
  readonly audit?: AuditContext;
  readonly timeoutMs?: number;
  readonly metadata?: JsonObject;
}

export interface AdapterHealth {
  readonly status: AdapterHealthStatus;
  readonly checkedAt: ISODateTime;
  readonly summary?: string;
  readonly details?: JsonObject;
}

export interface AdapterResult<T> {
  readonly status: AdapterResultStatus;
  readonly data?: T;
  readonly warnings?: readonly string[];
  readonly error?: AeosError;
  readonly audit?: AuditEvent;
}

export interface AuditActor {
  readonly id: string;
  readonly type: "human" | "agent" | "model" | "tool" | "system";
  readonly adapterId?: AeosId;
}

export interface AuditTarget {
  readonly type:
    | "task"
    | "file"
    | "tool"
    | "policy"
    | "verification"
    | "memory"
    | "model"
    | "template"
    | "project"
    | "system";
  readonly id?: string;
  readonly path?: string;
  readonly scope?: readonly string[];
}

export interface AuditResult {
  readonly status:
    | "ok"
    | "partial"
    | "blocked"
    | "denied"
    | "failed"
    | "not_run";
  readonly decision?: PolicyDecisionStatus;
  readonly exitCode?: number;
  readonly errorCode?: string;
  readonly retryable?: boolean;
}

export interface AuditEvent {
  readonly id: AeosId;
  readonly timestamp: ISODateTime;
  readonly eventType: AuditEventType;
  readonly taskId: AeosId;
  readonly correlationId: AeosId;
  readonly parentEventId?: AeosId;
  readonly actor: AuditActor;
  readonly action: string;
  readonly target: AuditTarget;
  readonly result: AuditResult;
  readonly adapterId?: AeosId;
  readonly riskClass?: RiskClass;
  readonly permissionLevel?: PermissionLevel;
  readonly approvalState?: ApprovalState;
  readonly policyDecisionId?: AeosId;
  readonly durationMs?: number;
  readonly metadata?: JsonObject;
  readonly redactionsApplied: boolean;
}

export interface AuditContext {
  readonly actor: AuditActor;
  readonly reason: string;
  readonly correlationId: AeosId;
  readonly parentEventId?: AeosId;
}

export type ApprovalState =
  | "not_required"
  | "required"
  | "approved"
  | "denied";

export interface PolicyContext {
  readonly subject: string;
  readonly action: string;
  readonly scope: readonly string[];
  readonly approvalState: ApprovalState;
  readonly riskClass?: RiskClass;
  readonly permissionLevel?: PermissionLevel;
}

export interface BaseAdapter<K extends AdapterKind> {
  readonly id: AeosId;
  readonly kind: K;
  readonly metadata: AdapterMetadata;
  readonly capabilities: readonly AdapterCapability[];
  checkHealth(context: AdapterContext): Promise<AdapterResult<AdapterHealth>>;
}

export interface ModelMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: JsonValue;
  readonly name?: string;
  readonly metadata?: JsonObject;
}

export interface ModelRequest {
  readonly messages: readonly ModelMessage[];
  readonly responseFormat?: ModelResponseFormat;
  readonly routing?: ModelRoutingConstraints;
  readonly parameters?: JsonObject;
  readonly metadata?: JsonObject;
}

export interface ModelResponseFormat {
  readonly type: "text" | "json" | "structured";
  readonly schema?: JsonObject;
}

export interface ModelRoutingConstraints {
  readonly requiredCapabilities?: readonly string[];
  readonly excludedCapabilities?: readonly string[];
  readonly maxInputTokens?: number;
  readonly maxOutputTokens?: number;
}

export interface ModelUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
  readonly metadata?: JsonObject;
}

export interface ModelResponse {
  readonly output: JsonValue;
  readonly finishReason?: "complete" | "length" | "refusal" | "tool_call" | "other";
  readonly safetyStatus?: "allowed" | "refused" | "filtered" | "unknown";
  readonly usage?: ModelUsage;
  readonly metadata?: JsonObject;
}

export interface ModelAdapter extends BaseAdapter<"model"> {
  invoke(
    request: ModelRequest,
    context: AdapterContext,
  ): Promise<AdapterResult<ModelResponse>>;
}

export interface AgentTaskRequest {
  readonly taskId: AeosId;
  readonly title: string;
  readonly instructions: string;
  readonly role?: AgentRole;
  readonly allowedFiles: readonly string[];
  readonly loadedContext: readonly string[];
  readonly stopCondition: string;
  readonly verificationExpected: readonly string[];
  readonly metadata?: JsonObject;
}

export interface AgentTaskResult {
  readonly taskId: AeosId;
  readonly status: TaskStatus;
  readonly summary: string;
  readonly changedFiles: readonly FileChangeSummary[];
  readonly verification: VerificationSummary;
  readonly followUps?: readonly string[];
  readonly metadata?: JsonObject;
}

export interface AgentAdapter extends BaseAdapter<"agent"> {
  runTask(
    request: AgentTaskRequest,
    context: AdapterContext,
  ): Promise<AdapterResult<AgentTaskResult>>;
}

export interface ToolRequest {
  readonly action: string;
  readonly intent: string;
  readonly scope: readonly string[];
  readonly arguments?: JsonObject;
  readonly expectedSideEffects: readonly string[];
  readonly dryRun?: boolean;
  readonly metadata?: JsonObject;
}

export interface ToolResult {
  readonly status: AdapterResultStatus;
  readonly output?: JsonValue;
  readonly outputSummary?: string;
  readonly logs?: readonly string[];
  readonly sideEffects: readonly string[];
  readonly exitCode?: number;
  readonly metadata?: JsonObject;
}

export interface ToolAdapter extends BaseAdapter<"tool"> {
  execute(
    request: ToolRequest,
    context: AdapterContext,
  ): Promise<AdapterResult<ToolResult>>;
}

export interface McpToolDescriptor {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema?: JsonObject;
  readonly capabilities: readonly AdapterCapability[];
  readonly metadata?: JsonObject;
}

export interface McpToolRequest {
  readonly serverId: AeosId;
  readonly toolName: string;
  readonly intent: string;
  readonly scope: readonly string[];
  readonly arguments?: JsonObject;
  readonly expectedSideEffects: readonly string[];
  readonly metadata?: JsonObject;
}

export interface McpToolAdapter extends BaseAdapter<"mcp_tool"> {
  listTools(context: AdapterContext): Promise<AdapterResult<readonly McpToolDescriptor[]>>;
  callTool(
    request: McpToolRequest,
    context: AdapterContext,
  ): Promise<AdapterResult<ToolResult>>;
}

export interface MemoryQuery {
  readonly scope: readonly string[];
  readonly query?: string;
  readonly tags?: readonly string[];
  readonly entryTypes?: readonly string[];
  readonly limit?: number;
  readonly metadata?: JsonObject;
}

export interface MemoryEntry {
  readonly id: AeosId;
  readonly type: string;
  readonly scope: readonly string[];
  readonly content: JsonObject;
  readonly tags: readonly string[];
  readonly verificationState: VerificationStatus;
  readonly createdAt: ISODateTime;
  readonly updatedAt?: ISODateTime;
  readonly sourceTaskId?: AeosId;
  readonly metadata?: JsonObject;
}

export interface MemoryWriteRequest {
  readonly entry: MemoryEntryDraft;
  readonly mode: "create" | "update" | "upsert";
  readonly metadata?: JsonObject;
}

export interface MemoryEntryDraft {
  readonly type: string;
  readonly scope: readonly string[];
  readonly content: JsonObject;
  readonly tags: readonly string[];
  readonly verificationState: VerificationStatus;
  readonly sourceTaskId?: AeosId;
  readonly metadata?: JsonObject;
}

export interface MemoryWriteResult {
  readonly entryId?: AeosId;
  readonly status: "written" | "unchanged" | "rejected" | "conflict";
  readonly reason?: string;
  readonly backendMetadata?: JsonObject;
}

export interface MemoryAdapter extends BaseAdapter<"memory"> {
  query(
    request: MemoryQuery,
    context: AdapterContext,
  ): Promise<AdapterResult<readonly MemoryEntry[]>>;
  write(
    request: MemoryWriteRequest,
    context: AdapterContext,
  ): Promise<AdapterResult<MemoryWriteResult>>;
}

export interface ProjectDescribeRequest {
  readonly workspacePath: string;
  readonly scope?: readonly string[];
  readonly metadata?: JsonObject;
}

export interface ProjectInfo {
  readonly id: AeosId;
  readonly name: string;
  readonly workspacePath: string;
  readonly conventions: readonly string[];
  readonly metadata?: JsonObject;
}

export interface ScopeValidationRequest {
  readonly workspacePath: string;
  readonly allowedFiles: readonly string[];
  readonly requestedFiles: readonly string[];
  readonly changedFiles?: readonly string[];
  readonly metadata?: JsonObject;
}

export interface ScopeValidationResult {
  readonly valid: boolean;
  readonly allowed: readonly string[];
  readonly denied: readonly string[];
  readonly warnings: readonly string[];
}

export interface ProjectAdapter extends BaseAdapter<"project"> {
  describe(
    request: ProjectDescribeRequest,
    context: AdapterContext,
  ): Promise<AdapterResult<ProjectInfo>>;
  validateScope(
    request: ScopeValidationRequest,
    context: AdapterContext,
  ): Promise<AdapterResult<ScopeValidationResult>>;
}

export interface TemplateRenderRequest {
  readonly templateId: AeosId;
  readonly variables: JsonObject;
  readonly targetPath?: string;
  readonly metadata?: JsonObject;
}

export interface TemplateRenderResult {
  readonly content: string;
  readonly format: "text" | "markdown" | "json" | "yaml" | "other";
  readonly targetPath?: string;
  readonly metadata?: JsonObject;
}

export interface TemplateAdapter extends BaseAdapter<"template"> {
  render(
    request: TemplateRenderRequest,
    context: AdapterContext,
  ): Promise<AdapterResult<TemplateRenderResult>>;
}

export interface VerificationRequest {
  readonly taskId: AeosId;
  readonly scope: readonly string[];
  readonly changedFiles: readonly FileChangeSummary[];
  readonly checks: readonly VerificationCheckRequest[];
  readonly metadata?: JsonObject;
}

export interface VerificationCheckRequest {
  readonly id: AeosId;
  readonly name: string;
  readonly level:
    | "none"
    | "existence_check"
    | "format_check"
    | "static_check"
    | "unit_test"
    | "integration_test"
    | "smoke_test"
    | "security_check"
    | "manual_approval_required";
  readonly target: readonly string[];
  readonly required: boolean;
  readonly expectedEvidence: readonly string[];
}

export interface VerificationResult {
  readonly taskId: AeosId;
  readonly status: VerificationStatus;
  readonly checkedScope: readonly string[];
  readonly passed: readonly string[];
  readonly failed: readonly string[];
  readonly blocked: readonly string[];
  readonly skipped: readonly string[];
  readonly evidenceSummary: string;
  readonly evidence?: readonly string[];
  readonly metadata?: JsonObject;
}

export interface VerifierAdapter extends BaseAdapter<"verifier"> {
  verify(
    request: VerificationRequest,
    context: AdapterContext,
  ): Promise<AdapterResult<VerificationResult>>;
}

export interface PolicyRequest {
  readonly actor: AuditActor;
  readonly action: string;
  readonly scope: readonly string[];
  readonly intent: string;
  readonly requestedCapability?: string;
  readonly riskClass: RiskClass;
  readonly permissionLevel: PermissionLevel;
  readonly approvalState: ApprovalState;
  readonly environment?: JsonObject;
  readonly metadata?: JsonObject;
}

export interface PolicyDecision {
  readonly id: AeosId;
  readonly status: PolicyDecisionStatus;
  readonly reason: string;
  readonly riskClass: RiskClass;
  readonly permissionLevel: PermissionLevel;
  readonly requiredApprovalScope?: readonly string[];
  readonly constraints?: readonly string[];
  readonly metadata?: JsonObject;
}

export interface PolicyAdapter extends BaseAdapter<"policy"> {
  evaluate(
    request: PolicyRequest,
    context: AdapterContext,
  ): Promise<AdapterResult<PolicyDecision>>;
}

export interface AuditAppendResult {
  readonly eventId?: AeosId;
  readonly status: "appended" | "rejected";
  readonly reason?: string;
  readonly sinkMetadata?: JsonObject;
}

export interface AuditAdapter extends BaseAdapter<"audit"> {
  append(
    event: AuditEvent,
    context: AdapterContext,
  ): Promise<AdapterResult<AuditAppendResult>>;
}
