# AEOS Project Template Specification

## Purpose

Define how AEOS project templates are structured, selected, rendered, verified,
and used by the future `aeos init` workflow.

## Core Principle

AEOS templates must create a minimal, auditable project starting point while
remaining model-independent, provider-independent, policy-aware, and
verification-aware.

## Template Goals

- Provide predictable project scaffolds for common AEOS use cases.
- Keep generated files small, explicit, and reviewable.
- Require declared variables instead of guessing important project details.
- Preserve AEOS task, context, policy, verification, and audit discipline.
- Avoid installing dependencies or running external tools by default.

## Template Types

Initial template types:

- `project-default`: Minimal AEOS project operating system scaffold.
- `nextjs`: AEOS-ready scaffold for a future Next.js application project.
- `node-api`: AEOS-ready scaffold for a future Node.js API project.
- `python`: AEOS-ready scaffold for a future Python project.
- `generic`: Minimal provider-neutral scaffold for existing or unknown stacks.

## Template Directory Layout

Future templates should live under `templates/` using one directory per template:

```text
templates/
  project-default/
    template.yaml
    files/
    hooks/
    README.template.md
```

- `template.yaml`: Required metadata and rendering contract.
- `files/`: Template files to render into the target project.
- `hooks/`: Optional future verification or preparation hook definitions.
- `README.template.md`: Optional human-readable template notes.

## Required Template Files

Each template should include:

- `template.yaml` with complete metadata.
- At least one renderable file under `files/`.
- A declared list of files the template may create.
- A declared verification profile.
- A declared risk level.

## Optional Template Files

Templates may later include:

- `README.template.md` for operator guidance.
- `variables.schema.yaml` for richer variable validation.
- `policy.yaml` for template-specific policy annotations.
- `verification.yaml` for expanded verification checks.
- `hooks/post-render.yaml` for future gated post-render actions.

## Template Metadata

Future template metadata fields:

- `id`
- `name`
- `description`
- `version`
- `category`
- `supported_runtime`
- `required_variables`
- `optional_variables`
- `files_created`
- `verification_profile`
- `risk_level`

## Example Metadata

```yaml
id: project-default
name: AEOS Default Project
description: Minimal AEOS project operating system scaffold.
version: 0.1.0
category: project
supported_runtime: none
required_variables:
  - project_name
  - project_slug
optional_variables:
  - project_description
  - owner
files_created:
  - PROJECT_CONTEXT.md
  - AGENTS.md
  - TASKS/task-template.md
  - docs/REPOSITORY_STANDARD.md
verification_profile: documentation_scaffold
risk_level: low
```

## Variable Rules

- Variables must be declared before rendering.
- Required variables must be provided explicitly by the operator or task.
- Optional variables must have clear defaults or be omitted cleanly.
- Variable names should use lowercase snake_case.
- Variables must not contain secrets unless policy explicitly allows it.
- Variables must be validated before any file is written.
- Variables must not encode provider, model, or host-specific assumptions.

## Rendering Rules

- Rendering must be deterministic for the same template version and variables.
- AEOS must summarize files to be created before meaningful risk.
- Existing files must not be overwritten without explicit approval.
- Rendered output must stay within the template's declared `files_created`
  scope.
- Rendering must not install dependencies, run package managers, initialize Git,
  deploy, push, or call external services by default.
- Rendered docs should stay concise and suitable for later task context loading.

## Context Rules

- Templates may create or update `PROJECT_CONTEXT.md` when declared.
- Template-created context must stay short and task-oriented.
- Context must list relevant docs without encouraging broad repository loading.
- Future task instructions should name exact files to load.
- Templates should not create hidden context dependencies.

## Verification Rules

- Each template must declare a `verification_profile`.
- Minimal verification must confirm declared files exist after rendering.
- Format verification should confirm required sections or metadata are present.
- Scope verification should confirm no undeclared files were created.
- Policy verification is required before overwrites, external actions, or risky
  filesystem changes.
- A template render may complete only when required checks pass or are explicitly
  skipped by task scope.

## Policy Rules

- Template actions must be classified before execution.
- Low-risk scaffolding may be allowed when paths are in scope.
- Overwrites require explicit approval unless policy grants a narrow exception.
- Dependency installation, network access, deployment, Git push, destructive
  commands, and secret handling are approval-required or denied by default.
- Templates must not bypass AEOS policy gates through hooks or generated
  commands.

## Audit Rules

- `aeos init` should write an audit event for each template render attempt.
- Audit records should include template ID, template version, selected variables
  names, created paths, verification result, policy decisions, and final status.
- Audit records must not store raw secrets, full prompts, full file contents, or
  excessive tool output.
- Audit records should be compact and suitable for later review.

## Template Selection Flow

1. Read available template metadata.
2. Filter templates by requested type, category, and supported runtime.
3. Prefer explicit operator selection over automatic inference.
4. If no template is selected, offer `project-default` and `generic`.
5. Explain the selected template, files to create, required variables, and risk
   level.
6. Require approval before risky actions or overwrites.

## aeos init Flow

At a high level, `aeos init` should:

1. Select a template.
2. Ask for required and optional variables.
3. Validate variables and target paths.
4. Render declared files.
5. Run the declared verification profile.
6. Write an audit event.
7. Update `PROJECT_CONTEXT.md` when declared by the template.
8. Return a compact handoff report.

The command should default to safe, minimal scaffolding. It should not install
dependencies, create application packages, deploy, or push to Git.

## MVP Template Set

MVP templates:

- `project-default`
- `generic`

The MVP should prove metadata loading, variable prompting, deterministic
rendering, existence checks, scope checks, audit writing, and context updates.

## Later Template Set

Later templates:

- `nextjs`
- `node-api`
- `python`

Later versions may add richer framework-specific files, verification profiles,
policy annotations, dry-run output, and organization-local template registries.

## Non-goals

- Create actual template files in this task.
- Modify `templates/`.
- Implement `aeos init`.
- Create application source code.
- Create `apps/` or `packages/`.
- Create `package.json` or choose a package manager.
- Choose a runtime, framework, model, provider, or hosting platform.
- Define the full AEOS architecture.
- Replace the existing task, policy, audit, or verification documents.
- Store secrets or raw prompts in template metadata, rendered files, or audit
  records.
