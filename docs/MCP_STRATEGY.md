# MCP Strategy

## Position

MCP servers are tools, not decision makers. AEOS decides when and how to call tools through policy-controlled adapters.

## Tool Categories

- DesktopCommander-style local execution for shell and filesystem tasks.
- codebase-memory-style retrieval for project memory and codebase context.
- Git/GitHub tools for repository state, issues, pull requests, and reviews.
- Docker, shell, and filesystem tools for local development workflows.
- Future MCP servers for search, databases, observability, and deployment systems.

## Execution Rules

- Every MCP call must have an explicit purpose and scope.
- The policy layer must run before execution.
- Risky operations require approval.
- Outputs must be captured for verification and audit.
- MCP tools must not bypass task boundaries.

## Policy Layer Before Execution

The policy layer evaluates:

- Command risk.
- File scope.
- Dependency changes.
- Secret exposure.
- Network or external side effects.
- Git push or deployment intent.
- Migration or data mutation risk.

## Audit Log Requirement

AEOS must record:

- Tool name.
- Inputs or summarized intent.
- Approval status.
- Execution result.
- Files or systems affected.
- Verification status.

## Approval Requirement

Approval is required for:

- Destructive filesystem operations.
- Dependency installation or upgrades.
- Deployments.
- Database migrations.
- Git pushes.
- Secret or environment variable access.
- Broad shell commands outside task scope.
