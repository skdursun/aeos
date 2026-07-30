# Model Selection

## Routing Rules

Select the cheapest and smallest capable route first. Escalate when ambiguity, risk, scope, or failure requires deeper reasoning or a different agent.

| Category | Reasoning | Likely Agent | Escalation Rules | Token-Saving Rules |
| --- | --- | --- | --- | --- |
| docs | low | Codex or ChatGPT | Escalate to medium when docs define architecture or policy. | Load only named docs and the task file. |
| small edits | low | Codex | Escalate if edits touch shared contracts or security behavior. | Load only target files and immediate references. |
| tests | medium | Codex | Escalate after repeated failures or unclear test intent. | Run focused tests before broad suites. |
| simple implementation | medium | Codex | Escalate if new abstractions, dependencies, or migrations are needed. | Read nearby code only. |
| complex implementation | high | Codex, Claude Code, or future agent | Escalate to architecture review before large changes. | Break into micro-tasks. |
| architecture | high | ChatGPT with Codex follow-up | Escalate to human review for irreversible standards. | Summarize decisions instead of loading all docs. |
| security | high | ChatGPT, Codex, or future security agent | Require human approval for policy changes or risky operations. | Load relevant policy files only. |
| debugging | medium | Codex | Escalate when root cause is unclear after focused reproduction. | Capture minimal logs and exact failing commands. |
| review | medium/high | ChatGPT, Codex, or Claude Code | Escalate for security, data loss, or production risk. | Review diff and affected files, not the whole repo. |
| memory update | low/medium | Codex or MCP retrieval tool | Escalate if memory conflicts with existing decisions. | Write concise verified entries only. |

## General Escalation

- Escalate reasoning when the task changes architecture, policy, security, data, or shared contracts.
- Escalate agent choice when the current route fails verification twice.
- Ask for approval before destructive, external, or dependency-changing actions.
- Prefer a new micro-task over expanding a session beyond its scope.

## Token-Saving Rules

- Do not read all Markdown files.
- Do not scan the whole repository by default.
- Load `PROJECT_CONTEXT.md` and `AGENTS.md`, then only task-listed files.
- Summarize large outputs before passing them to another agent.
- Store only verified durable knowledge in memory.
