# AEOS Specification

## Mission

AEOS is an AI Engineering Operating System for coordinating models, agents, tools, memory, verification, and repository workflows through a modular, extensible, model-independent architecture.

## Non-goals

- AEOS is not a single-model assistant.
- AEOS is not tied to one IDE, CLI, vendor, or model provider.
- AEOS is not a replacement for Git, CI, testing, or human review.
- AEOS will not execute risky operations without policy checks and approval.
- AEOS will not store raw conversations as long-term memory by default.

## Core Principles

- Model independence through adapters.
- Small, isolated tasks over long uncontrolled sessions.
- Lazy context loading.
- Markdown and Git as the initial source of truth.
- Verification before memory writes.
- Policy gates before risky tool execution.
- Human approval for destructive or external side effects.
- Clear audit trails for agent and tool actions.

## High-Level Architecture

AEOS is organized around an orchestration core that routes work to models, agents, tools, memory, and verification systems.

```text
User / Task
   |
   v
AEOS CLI
   |
   v
Orchestration Core
   |        |        |        |
   v        v        v        v
Models   Agents   Tools    Memory
   \        |        |        /
    v       v        v       v
      Verification + Policy
              |
              v
        Repository Output
```

## Main Modules

- CLI: task intake, command interface, session setup, handoff reporting.
- Orchestrator: routes tasks, builds context, selects agents, coordinates execution.
- Model Router: selects model/provider based on task type, cost, latency, and reasoning needs.
- Agent Runtime: manages Codex, ChatGPT, Claude Code, future agents, and specialized workflows.
- Adapter Layer: normalizes model, tool, memory, and repository integrations.
- MCP/Tool Layer: exposes controlled local and remote capabilities.
- Memory Layer: stores and retrieves structured engineering knowledge.
- Verification Layer: runs checks before accepting outputs or writing memory.
- Policy Layer: enforces approval, safety, secrets, and audit rules.
- Repository Layer: manages standards, templates, tasks, and project conventions.

## Agent Roles

- ChatGPT: planning, architecture, synthesis, task decomposition, high-level review.
- Codex: scoped repository edits, implementation, verification, handoff reporting.
- Claude Code: alternate coding, debugging, review, and cross-checking.
- MCP tools: local execution, retrieval, Git/GitHub interaction, shell, filesystem, Docker, and external services.
- Future agents: specialized roles added through the same adapter contracts.

## Model Independence

AEOS must not assume any single model provider or model capability. Model-specific behavior is isolated behind adapters. Routing rules decide which model or agent receives a task, while task contracts define expected inputs, outputs, verification, and stop conditions.

## Adapter Strategy

Adapters translate AEOS task contracts into provider-specific calls and normalize responses back into AEOS formats.

Initial adapter families:

- Model adapters.
- Agent adapters.
- MCP/tool adapters.
- Memory adapters.
- Git/GitHub adapters.
- Verification adapters.
- Template adapters.

## MCP/Tool Layer

MCP servers are tools, not decision makers. AEOS calls them through policy-controlled adapters. Tool execution must include intent, scope, approval state, output capture, and audit metadata.

## Memory Layer

Memory is structured engineering knowledge, not conversation storage. The initial memory system uses Markdown files with YAML frontmatter. Later versions may add vector indexes and retrieval ranking.

## Verification Layer

Verification confirms that work matches the task before acceptance. It may include file existence checks, linting, tests, type checks, build checks, screenshots, diff review, security review, and manual approval.

## Policy Layer

The policy layer blocks or escalates risky actions, including destructive commands, dependency changes, deployments, migrations, Git pushes, secret access, and broad filesystem operations.

## CLI Layer

The CLI is the main operator interface for creating tasks, preparing context, invoking agents, checking status, running verification, and producing compact handoff reports.

## MVP Boundary

The MVP should include:

- Repository operating standard.
- Micro-task template.
- Markdown memory format.
- Basic task runner contract.
- Model and agent routing rules.
- Policy checklist for risky operations.
- Verification checklist before completion.

The MVP should not include:

- Full autonomous multi-agent execution.
- Production deployments.
- Broad filesystem control.
- Automatic dependency changes.
- Unverified memory ingestion.
