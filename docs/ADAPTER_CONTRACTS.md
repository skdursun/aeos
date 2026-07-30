# AEOS Adapter Contracts
## Purpose
Define future adapter contracts that keep AEOS model-independent, agent-independent, tool-independent, memory-backend-independent, and provider-independent.
Adapters translate external systems into AEOS-owned request, response, error, capability, policy, and audit shapes. Core orchestration depends on these contracts, not on concrete provider SDKs or runtime implementations.
## Adapter Design Principles
- Core packages define contracts; adapters implement them.
- Provider-specific types must not leak into core public APIs.
- Adapters declare capabilities before AEOS routes work to them.
- Risky actions require policy checks before execution.
- External actions should produce audit metadata.
- Adapters normalize success, partial success, blocked, unsupported, timeout, and failure states.
- Adapters expose focused operations, not broad escape hatches.
## Common Contract Rules
- Inputs and outputs must be serializable.
- Requests carry task, workspace, policy, and audit context when relevant.
- Responses include normalized status, data, warnings, errors, and audit metadata.
- Errors use AEOS error shapes instead of provider exceptions.
- Adapters must not load broad context on their own.
- Adapters must not mutate state unless the operation requires it and policy allows it.
- Unsupported behavior returns `unsupported` instead of silently approximating.
## Shared Types
```ts
type AdapterId = string;
type TaskId = string;
type CapabilityName = string;
type PackageOwner = "packages/models" | "packages/agents" | "packages/tools" | "packages/memory" | "packages/projects" | "packages/verifier" | "packages/policies" | "packages/core";

interface AdapterContext {
  taskId: TaskId;
  workspacePath?: string;
  policyContext?: PolicyContext;
  auditContext?: AuditContext;
  timeoutMs?: number;
}

interface AdapterCapability {
  name: CapabilityName;
  version: string;
  riskLevel: "low" | "medium" | "high";
  requiresApproval: boolean;
  limits?: Record<string, unknown>;
}

interface AdapterResult<T> {
  status: "ok" | "partial" | "blocked" | "unsupported" | "failed";
  data?: T;
  warnings?: string[];
  error?: AdapterError;
  audit?: AuditEvent;
}

interface AdapterError {
  code: string;
  message: string;
  category: "validation" | "policy" | "permission" | "timeout" | "provider" | "not_found" | "conflict" | "unknown";
  retryable: boolean;
}

interface PolicyContext {
  subject: string;
  action: string;
  scope: string[];
  approvalState: "not_required" | "required" | "approved" | "denied";
}

interface AuditContext {
  actor: string;
  reason: string;
  traceId?: string;
}

interface AuditEvent {
  adapterId: AdapterId;
  action: string;
  scope: string[];
  outcome: string;
  timestamp: string;
}
```
## Model Adapter Contract
- Responsibility: normalize model requests and responses for generation, reasoning, summarization, classification, and structured output.
- Inputs: model request, messages or structured prompt, response format, routing constraints, policy context, audit context.
- Outputs: normalized model response, usage metadata when available, refusal or safety status, warnings, errors.
- Required capabilities: capability declaration, request validation, structured output support reporting, timeout handling, refusal normalization.
- Forbidden responsibilities: task orchestration, direct tool execution, repository mutation, memory writes, provider-specific core routing.
- Expected package owner: `packages/models`.
```ts
interface ModelAdapter {
  id: AdapterId;
  capabilities(): AdapterCapability[];
  invoke(request: ModelRequest, context: AdapterContext): Promise<AdapterResult<ModelResponse>>;
}
```
## Agent Adapter Contract
- Responsibility: invoke an agent runtime through AEOS task inputs and normalize handoff, changed-scope, and completion signals.
- Inputs: task contract, allowed files, loaded context, verification expectations, policy context, audit context.
- Outputs: handoff report, declared changes, verification claims, follow-up state, normalized errors.
- Required capabilities: task execution support, scoped context handling, stop-condition reporting, handoff reporting.
- Forbidden responsibilities: bypassing policy, expanding file scope without permission, writing memory directly, deciding final acceptance alone.
- Expected package owner: `packages/agents`.
```ts
interface AgentAdapter {
  id: AdapterId;
  capabilities(): AdapterCapability[];
  runTask(request: AgentTaskRequest, context: AdapterContext): Promise<AdapterResult<AgentTaskResult>>;
}
```
## Tool Adapter Contract
- Responsibility: expose local or remote tool actions through typed requests with policy checks, captured output, and audit metadata.
- Inputs: tool action, intent, scope, arguments, expected side effects, policy context, audit context.
- Outputs: normalized output, operation status, side-effect summary, captured logs, errors.
- Required capabilities: dry-run support when possible, risk declaration, output capture, timeout handling, side-effect reporting.
- Forbidden responsibilities: hidden execution, unbounded filesystem access, implicit dependency changes, deployments, Git pushes, secret access without approval.
- Expected package owner: `packages/tools`.
```ts
interface ToolAdapter {
  id: AdapterId;
  capabilities(): AdapterCapability[];
  execute(request: ToolRequest, context: AdapterContext): Promise<AdapterResult<ToolResult>>;
}
```
## MCP Tool Adapter Contract
- Responsibility: wrap MCP-style tool servers as AEOS tool adapters while preserving AEOS policy, audit, and result normalization.
- Inputs: server identifier, tool name, arguments, declared intent, operation scope, policy context, audit context.
- Outputs: normalized tool result, content payloads, tool errors, server capability metadata, audit event.
- Required capabilities: server tool discovery, schema validation, invocation, result normalization, permission mapping.
- Forbidden responsibilities: treating MCP servers as decision makers, exposing raw server permissions to core, bypassing approval checks, hardcoding server behavior into core.
- Expected package owner: `packages/tools`.
```ts
interface McpToolAdapter extends ToolAdapter {
  listTools(context: AdapterContext): Promise<AdapterResult<McpToolDescriptor[]>>;
  callTool(request: McpToolRequest, context: AdapterContext): Promise<AdapterResult<ToolResult>>;
}
```
## Memory Adapter Contract
- Responsibility: retrieve and persist structured engineering memory through backend-independent operations.
- Inputs: memory query, entry draft, tags, scope, verification state, policy context, audit context.
- Outputs: memory entries, write result, rejected-write reason, backend metadata, errors.
- Required capabilities: scoped retrieval, schema validation, verified write handling, conflict detection, backend health reporting.
- Forbidden responsibilities: storing raw conversations by default, writing unverified memory, changing task outputs, reaching outside declared memory scope.
- Expected package owner: `packages/memory`.
```ts
interface MemoryAdapter {
  id: AdapterId;
  capabilities(): AdapterCapability[];
  query(request: MemoryQuery, context: AdapterContext): Promise<AdapterResult<MemoryEntry[]>>;
  write(request: MemoryWriteRequest, context: AdapterContext): Promise<AdapterResult<MemoryWriteResult>>;
}
```
## Project Adapter Contract
- Responsibility: expose repository metadata, task scope, file rules, and workspace conventions to AEOS.
- Inputs: workspace path, task scope, allowed file lists, project standard requests, policy context.
- Outputs: project metadata, file-scope validation, task contract validation, changed-file summaries, convention warnings.
- Required capabilities: workspace discovery, scoped file validation, task metadata extraction, change summary support.
- Forbidden responsibilities: broad repository scanning by default, source edits, dependency changes, Git push, deployment, policy overrides.
- Expected package owner: `packages/projects`.
```ts
interface ProjectAdapter {
  id: AdapterId;
  capabilities(): AdapterCapability[];
  describe(request: ProjectDescribeRequest, context: AdapterContext): Promise<AdapterResult<ProjectInfo>>;
  validateScope(request: ScopeValidationRequest, context: AdapterContext): Promise<AdapterResult<ScopeValidationResult>>;
}
```
## Verifier Adapter Contract
- Responsibility: run or coordinate checks that determine whether task outputs satisfy requested verification and stop conditions.
- Inputs: task contract, changed files, verification commands or checks, expected artifacts, policy context.
- Outputs: verification result, passed and failed checks, skipped checks with reasons, evidence references, errors.
- Required capabilities: check declaration, check execution or delegation, result normalization, skipped-check reporting.
- Forbidden responsibilities: accepting work without evidence, mutating source during verification, broad tool execution without policy, memory writes.
- Expected package owner: `packages/verifier`.
```ts
interface VerifierAdapter {
  id: AdapterId;
  capabilities(): AdapterCapability[];
  verify(request: VerificationRequest, context: AdapterContext): Promise<AdapterResult<VerificationResult>>;
}
```
## Policy Adapter Contract
- Responsibility: classify risk and allow, block, or require approval before adapters perform security-sensitive operations.
- Inputs: actor, action, scope, intent, requested capability, environment constraints, prior approval state.
- Outputs: policy decision, reason, required approval scope, audit metadata.
- Required capabilities: risk classification, approval requirement mapping, scope evaluation, denial reason reporting.
- Forbidden responsibilities: executing evaluated actions, mutating project files, acting as the audit sink, hiding denied decisions.
- Expected package owner: `packages/policies`.
```ts
interface PolicyAdapter {
  id: AdapterId;
  capabilities(): AdapterCapability[];
  evaluate(request: PolicyRequest, context: AdapterContext): Promise<AdapterResult<PolicyDecision>>;
}
```
## Audit Adapter Contract
- Responsibility: record normalized action, decision, and result events for traceability across models, agents, tools, memory, policy, and verification.
- Inputs: audit event, actor, adapter id, action, scope, outcome, timestamps, references.
- Outputs: append result, event id when available, rejected-event reason, sink metadata.
- Required capabilities: event append, event validation, correlation id support, immutable record expectation.
- Forbidden responsibilities: policy decisions, task routing, secret collection, modifying event outcomes after recording.
- Expected package owner: `packages/core` owns the shared event shape; concrete sinks may live beside their adapter family.
```ts
interface AuditAdapter {
  id: AdapterId;
  capabilities(): AdapterCapability[];
  append(event: AuditEvent, context: AdapterContext): Promise<AdapterResult<AuditAppendResult>>;
}
```
## Error Handling Rules
- Adapters return `AdapterResult` instead of throwing provider errors across package boundaries.
- Validation errors identify invalid input fields when possible.
- Policy denials preserve the policy reason.
- Timeouts identify whether an external action may still be running.
- Partial results describe completed and incomplete work.
- Retryable errors are marked explicitly.
## Capability Declaration Rules
- Capabilities are declared before routing or execution.
- Capability names remain stable across adapter versions.
- Risk level and approval requirements are part of capability metadata.
- Unsupported capabilities produce `unsupported`, not generic failure.
- Runtime limits should declare practical boundaries such as size, side effects, or supported formats.
## Security and Permission Rules
- Security-sensitive actions require policy evaluation before execution.
- Destructive commands, external side effects, secret access, dependency changes, deployments, migrations, and Git pushes require explicit approval.
- Adapters receive only the scope needed for the requested action.
- Secrets remain behind provider or environment adapters and do not enter core task contracts.
- Audit events record intent, scope, approval state, and outcome.
## Versioning Rules
- Contract versions change when request or response shapes change.
- Backward-compatible capability additions do not require adapter replacement.
- Breaking changes require migration notes in architecture or decision documentation.
- Adapters report contract version and provider integration version separately.
- Core rejects adapters with incompatible contract versions.
## MVP Adapter Set
- Model adapter for normalized model invocation.
- Agent adapter for scoped task execution.
- Tool adapter for controlled local tool execution.
- MCP tool adapter for policy-gated MCP server tools.
- Memory adapter for structured Markdown memory operations.
- Project adapter for workspace and task-scope validation.
- Verifier adapter for requested checks and stop-condition evidence.
- Policy adapter for risk and approval decisions.
- Audit adapter for compact action records.
## Later Adapter Set
- Additional memory backends and retrieval indexes.
- Hosted repository and issue tracker adapters.
- Template rendering adapters.
- Richer verifier adapters for UI, security, performance, and release checks.
- Multi-agent coordination adapters.
- Remote execution adapters with stricter approval and audit rules.
## Non-goals
- Do not implement TypeScript or runtime code in this document.
- Do not choose provider SDKs, package managers, or frameworks.
- Do not define concrete prompts or model routing policies.
- Do not make MCP, Git, memory, or verification systems mandatory for all deployments.
- Do not allow adapters to bypass policy, verification, audit, or task scope boundaries.
- Do not define full autonomous multi-agent execution.
