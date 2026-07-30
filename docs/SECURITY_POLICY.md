# Security Policy

## Core Rule

AEOS must prefer explicit approval, narrow scope, and auditable execution for any operation that can destroy data, expose secrets, mutate external systems, or change project dependencies.

## Forbidden Without Approval

- Destructive commands.
- Dependency changes.
- Secret access.
- Environment variable inspection beyond explicit task scope.
- Deployments.
- Database migrations.
- Git push.
- File deletion.
- File renames outside explicit task scope.
- Broad shell commands.
- External network operations with side effects.

## Destructive Commands

Commands such as `rm`, `git reset --hard`, force pushes, recursive deletions, destructive database commands, and cleanup scripts require explicit approval and a clear rollback plan when possible.

## Dependency Changes

Do not install, remove, upgrade, or change dependency managers unless the task explicitly requests it and approval is granted when required.

## Secrets Handling

- Never print secrets.
- Never store secrets in memory.
- Never commit secrets.
- Redact secret-like values in logs and handoffs.
- Treat tokens, keys, cookies, credentials, and private config as sensitive.

## Environment Variables

Environment variables may contain secrets. Inspect only variables explicitly required by the task and redact values unless the user requests otherwise for a safe reason.

## Deployments

Do not deploy without explicit approval. Deployment actions must include target environment, expected change, rollback notes, and audit output.

## Migrations

Database or data migrations require explicit approval, backups or rollback notes when possible, and verification steps.

## Git Push

Do not push to Git unless explicitly requested. Report local changes and verification results instead.

## File Deletion

Do not delete files unless the task explicitly requests deletion or the user approves the operation.

## Shell Command Approval

Shell commands that mutate external state, affect broad filesystem scope, or have destructive potential require approval.

## Audit Logging

AEOS should capture command intent, approval status, affected files/systems, output summaries, and verification results for significant operations.
