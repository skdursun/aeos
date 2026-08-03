# Pro Performans

Pro Performans is the project home for designing and building AEOS, an AI Engineering Operating System.

AEOS is intended to coordinate AI-assisted software engineering across ChatGPT, Codex, Claude Code, MCP servers, local tools, Git/GitHub, vector memory, project templates, verification workflows, and future AI models. The system will use adapter-based architecture so models and tools can change without rewriting the core orchestration layer.

ChatGPT will be used for planning, product thinking, architecture discussion, and high-level review. Codex will be used for isolated repository tasks, file edits, verification, and implementation work. Claude Code may be used as an additional coding and review agent. MCP tools will provide controlled access to local execution, retrieval, Git/GitHub operations, filesystem actions, and other external capabilities.

The operating rule is one Codex CLI session per micro-task. Each session receives only the context it needs, modifies only explicitly listed files, verifies its work, and stops.

Current status: planning and scaffolding.

## Init Write Mode

`aeos init` is dry-run by default. To create the current MVP artifact,
`AGENTS.md`, in the current working directory, pass `--write` explicitly:

```sh
aeos init
aeos init --json
aeos init --write
aeos init --write --json
```

Write mode does not overwrite an existing `AGENTS.md`.

## Project Profile

Inspect the current working directory with deterministic, read-only project
intelligence:

```sh
aeos project profile
aeos project profile --json
```

The MVP reports local evidence for languages, frameworks, package managers,
runtimes, infrastructure, and monorepo/workspace signals. It does not parse
package contents or dependencies, and it does not use AI guessing.
