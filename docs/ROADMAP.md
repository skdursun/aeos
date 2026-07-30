# Roadmap

## Phase 0: Project Operating System

Goals:
- Create the initial repository scaffold.
- Define task rules, documentation structure, and operating principles.
- Establish micro-task execution discipline.

Deliverables:
- `AGENTS.md`
- `PROJECT_CONTEXT.md`
- Core `docs/`
- `TASKS/`
- `brain/`
- `templates/`

## Phase 1: Repo Standard and Templates

Goals:
- Define reusable repository conventions.
- Create project templates for future AEOS-managed repos.
- Standardize task contracts and handoff reports.

Deliverables:
- Repository standard.
- Template metadata format.
- Starter project template.
- Expanded task template library.

## Phase 2: Memory System

Goals:
- Design structured memory entries.
- Define retrieval and update rules.
- Prevent raw conversation dumps.

Deliverables:
- Memory schema.
- Markdown/YAML memory examples.
- Retrieval rules.
- Memory write verification checklist.

## Phase 3: Model/Agent/Tool Adapters

Goals:
- Define adapter interfaces.
- Separate orchestration from provider-specific behavior.
- Support ChatGPT, Codex, Claude Code, MCP tools, and future agents.

Deliverables:
- Adapter contracts.
- Routing rules.
- Initial agent capability matrix.
- Tool adapter design.

## Phase 4: CLI

Goals:
- Provide an operator-facing command interface.
- Support task creation, context preparation, verification, and handoff.

Deliverables:
- CLI command specification.
- Task runner flow.
- Configuration format.
- Local-only MVP CLI prototype plan.

## Phase 5: MCP Integration

Goals:
- Integrate MCP servers as controlled tools.
- Add audit logging and approval gates.
- Connect retrieval, Git/GitHub, shell, Docker, and filesystem capabilities.

Deliverables:
- MCP server registry.
- Tool permission model.
- Audit log format.
- Risk classification rules.

## Phase 6: Verification and Policy Engine

Goals:
- Make verification mandatory for task completion.
- Enforce safety rules before risky operations.
- Add confidence gates before memory writes.

Deliverables:
- Verification contract.
- Policy rules.
- Approval workflow.
- Memory write gate.

## Phase 7: Full Orchestration

Goals:
- Coordinate multi-step engineering workflows.
- Route tasks across agents and tools.
- Preserve traceability from task to output.

Deliverables:
- End-to-end orchestration flow.
- Multi-agent task plan support.
- Cross-agent review workflow.
- Production-ready AEOS operating model.
