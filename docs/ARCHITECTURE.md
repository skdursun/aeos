# Architecture

## System Overview

AEOS coordinates task intake, context loading, model and agent routing, tool execution, memory retrieval, verification, and policy enforcement. The core system remains model-independent by placing adapters between orchestration logic and external providers.

```text
                 +----------------+
                 | User / Operator|
                 +-------+--------+
                         |
                         v
                    +----+----+
                    | AEOS CLI|
                    +----+----+
                         |
                         v
              +----------+-----------+
              | Orchestration Core   |
              +---+------+-----+-----+
                  |      |     |
                  v      v     v
              Models  Tools  Memory
                  |      |     |
                  +------+-----+
                         |
                         v
              +----------+-----------+
              | Verification + Policy|
              +----------+-----------+
                         |
                         v
                    Repository
```

## Core Modules

- CLI: receives tasks and produces handoff reports.
- Orchestrator: decomposes work and coordinates modules.
- Context Loader: reads only task-approved files.
- Model Router: selects reasoning level, model, and agent.
- Agent Adapter Layer: normalizes ChatGPT, Codex, Claude Code, and future agents.
- Tool Adapter Layer: wraps MCP servers and local tools.
- Memory Layer: retrieves and stores structured knowledge.
- Verification Layer: checks outputs before completion.
- Policy Layer: enforces safety and approval requirements.
- Audit Log: records tool actions, decisions, approvals, and verification.

## Data Flow

```text
Task Contract
   -> Context Loader
   -> Policy Precheck
   -> Model/Agent Router
   -> Tool and Memory Calls
   -> Output Draft
   -> Verification
   -> Repository Write / Handoff
```

## Orchestration Flow

```text
Receive task
  |
  v
Validate scope and allowed files
  |
  v
Load minimal context
  |
  v
Select agent/model/tool route
  |
  v
Execute scoped work
  |
  v
Verify result
  |
  v
Return compact handoff
```

## Memory Retrieval Flow

```text
Task metadata
  |
  v
Build retrieval query
  |
  v
Search active/project/global memory
  |
  v
Rank relevant entries
  |
  v
Load only selected memory files
  |
  v
Attach concise context to task
```

## Tool Execution Flow

```text
Tool request
  |
  v
Policy check
  |
  v
Approval check when risky
  |
  v
Execute through adapter
  |
  v
Capture output and metadata
  |
  v
Write audit log
```

## Verification Flow

```text
Proposed output
  |
  v
Run required checks
  |
  v
Compare against task scope
  |
  v
Confirm no unrelated changes
  |
  v
Approve completion or return for revision
```

## Policy Enforcement Points

- Before context loading for broad scans.
- Before shell, filesystem, Docker, Git, or GitHub actions.
- Before dependency changes.
- Before file deletion or rename.
- Before deployments or migrations.
- Before writing memory.
- Before final handoff.
