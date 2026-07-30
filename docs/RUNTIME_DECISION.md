# AEOS Runtime Decision

## Purpose

Record the first AEOS v0 implementation technology decision before code
scaffolding begins.

## Decision

AEOS v0 will use TypeScript on Node.js LTS, targeting Node 24 LTS. Package
management and monorepo workspaces will use pnpm and pnpm workspaces.

## Runtime

- Language: TypeScript.
- Runtime: Node.js LTS.
- Target: Node 24 LTS.

## Package Manager

Use pnpm for dependency management, scripts, and lockfile ownership.

## Monorepo Strategy

Use pnpm workspaces for `apps/` and `packages/` boundaries.

## Why TypeScript

TypeScript gives AEOS explicit contracts for adapters, tasks, policies,
verification reports, and package public APIs while remaining familiar for CLI
and tool-oriented development.

## Why Node.js LTS

Node.js LTS provides a stable local runtime for CLI workflows, filesystem
operations, process execution, JSON handling, and integration with JavaScript
and TypeScript tooling.

## Why pnpm

pnpm supports workspaces, deterministic installs, efficient dependency storage,
and strict package boundaries suitable for a modular AEOS monorepo.

## What This Enables

- A TypeScript monorepo scaffold in the next implementation task.
- Clear package boundaries for `apps/cli` and planned `packages/*`.
- Shared AEOS-owned types across core, adapters, policy, verification, memory,
  project, and template modules.
- A future CLI implemented as a thin entrypoint over package APIs.

## What This Does Not Decide

This decision does not choose a test runner, linter, formatter, framework,
bundler, CLI framework, release tool, hosting platform, model provider, or
provider SDK.

## Risks

- Node 24 LTS may require contributors to upgrade local environments.
- TypeScript configuration choices can create unnecessary complexity if chosen
  too early.
- Workspace package boundaries can erode if imports bypass public entrypoints.
- pnpm may be unfamiliar to some contributors.

## Mitigations

- Declare the Node target clearly before scaffolding.
- Keep the initial TypeScript configuration minimal.
- Enforce public entrypoint imports in later static checks.
- Document only the small pnpm commands needed for local AEOS work.

## Impact on Package Architecture

The planned `apps/` and `packages/` layout will be implemented as pnpm workspace
packages. Runtime-specific files should support the package boundaries already
defined in `docs/PACKAGE_ARCHITECTURE.md` without changing those boundaries.

## Impact on CLI MVP

The CLI MVP will run on Node 24 LTS and call package public APIs. This decision
does not select the CLI framework or command parser.

## Impact on Templates

Future templates may declare TypeScript, Node 24 LTS, and pnpm workspace support
where relevant. Template rendering must still avoid installing dependencies by
default.

## Future Reconsideration Triggers

- Node 24 LTS becomes unsuitable for supported contributor environments.
- AEOS requires runtime capabilities better served by another LTS target.
- pnpm workspaces block required package publishing or local development flows.
- TypeScript becomes a poor fit for adapter, CLI, or verification contracts.
