# Backlog

## Initial Implementation Backlog

1. TASK-0013: Decide AEOS runtime and package manager. Docs only. Effort: High. Verification: `format_check`.
2. TASK-0014: Create runtime scaffold plan. Docs only. Effort: Medium. Verification: `static_check`.
3. TASK-0015: Create minimal repository scaffold. Code. Effort: Medium. Verification: `existence_check`.
4. TASK-0016: Add base static verification command. Code. Effort: Medium. Verification: `static_check`.
5. TASK-0017: Define shared adapter result types. Code. Effort: Medium. Verification: `unit_test`.
6. TASK-0018: Define policy decision types. Code. Effort: Medium. Verification: `unit_test`.
7. TASK-0019: Define verification report types. Code. Effort: Medium. Verification: `unit_test`.
8. TASK-0020: Define task contract parser. Code. Effort: High. Verification: `unit_test`.
9. TASK-0021: Implement project context reader. Code. Effort: Medium. Verification: `unit_test`.
10. TASK-0022: Implement scoped context bundle builder. Code. Effort: High. Verification: `unit_test`.
11. TASK-0023: Implement file scope validator. Code. Effort: Medium. Verification: `unit_test`.
12. TASK-0024: Implement basic policy classifier. Code. Effort: High. Verification: `security_check`.
13. TASK-0025: Implement local audit event writer. Code. Effort: Medium. Verification: `unit_test`.
14. TASK-0026: Implement verification existence checks. Code. Effort: Medium. Verification: `unit_test`.
15. TASK-0027: Implement documentation format checks. Code. Effort: Medium. Verification: `unit_test`.
16. TASK-0028: Implement memory entry validation. Code. Effort: High. Verification: `security_check`.
17. TASK-0029: Implement local memory read and write adapter. Code. Effort: High. Verification: `unit_test`.
18. TASK-0030: Implement CLI status command. Code. Effort: Medium. Verification: `smoke_test`.
19. TASK-0031: Implement CLI context command. Code. Effort: High. Verification: `smoke_test`.
20. TASK-0032: Implement CLI verify command. Code. Effort: High. Verification: `smoke_test`.

## CLI MVP Backlog

1. TASK-0038: Implement minimal CLI entrypoint and version command. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
2. TASK-0039: Add CLI help output. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
3. TASK-0040: Add CLI command dispatcher. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
4. TASK-0041: Add CLI error and exit-code handling. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
5. TASK-0042: Add CLI smoke check script notes. Docs. Effort: Low. Verification: `test -f docs/CLI_MVP_IMPLEMENTATION_PLAN.md`.
6. TASK-0043: Implement status command skeleton. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
7. TASK-0044: Wire status command to project context file. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
8. TASK-0045: Implement context command skeleton. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
9. TASK-0046: Add context task flag parsing. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
10. TASK-0047: Implement task validate command shell. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
11. TASK-0048: Bind task validate to core helpers. Code. Effort: High. Verification: `pnpm --filter @aeos/cli check`.
12. TASK-0049: Review CLI MVP command consistency. Docs. Effort: Medium. Verification: `git status --short`.

## Project MVP Backlog

1. TASK-0077: Implement project package root detector. Code. Effort: Medium. Verification: `pnpm --filter @aeos/projects check`.
2. TASK-0078: Add project root detector edge cases. Code. Effort: Low. Verification: `pnpm --filter @aeos/projects check`.
3. TASK-0079: Add project context field reader. Code. Effort: Medium. Verification: `pnpm --filter @aeos/projects check`.
4. TASK-0080: Add project context validation issues. Code. Effort: Medium. Verification: `pnpm --filter @aeos/projects check`.
5. TASK-0081: Add project AGENTS presence check. Code. Effort: Low. Verification: `pnpm --filter @aeos/projects check`.
6. TASK-0082: Add project .aeos status check. Code. Effort: Low. Verification: `pnpm --filter @aeos/projects check`.
7. TASK-0083: Add project status summary helper. Code. Effort: Medium. Verification: `pnpm --filter @aeos/projects check`.
8. TASK-0084: Add CLI project command dispatcher. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
9. TASK-0085: Implement aeos project root command. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
10. TASK-0086: Implement aeos project context command. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
11. TASK-0087: Implement aeos project validate command. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
12. TASK-0088: Review Project MVP command behavior. Docs. Effort: Medium. Verification: `git status --short`.

## Project Command MVP Backlog

1. TASK-0082: Implement project status command core flow. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
2. TASK-0083: Add project root command. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
3. TASK-0084: Add project context command. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
4. TASK-0085: Add project validate command. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
5. TASK-0086: Add project command help text. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
6. TASK-0087: Extract project command render helpers. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
7. TASK-0088: Add project command smoke notes. Docs. Effort: Low. Verification: `git status --short`.
8. TASK-0089: Add project status JSON plan checkpoint. Docs. Effort: Low. Verification: `git status --short`.
9. TASK-0090: Implement project status JSON output. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
10. TASK-0091: Implement project context JSON output. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.

## Project Context MVP Backlog

1. TASK-0085: Implement project context command. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
2. TASK-0086: Add project context usage errors. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
3. TASK-0087: Add project context smoke notes. Docs. Effort: Low. Verification: `git status --short`.
4. TASK-0088: Review project context human output. Docs. Effort: Low. Verification: `git status --short`.
5. TASK-0089: Define project context JSON contract. Docs. Effort: Low. Verification: `git status --short`.
6. TASK-0090: Implement project context JSON output. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
7. TASK-0091: Add project context JSON error output. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
8. TASK-0092: Add project context metadata field plan. Docs. Effort: Medium. Verification: `git status --short`.
9. TASK-0093: Extend project context metadata reader. Code. Effort: Medium. Verification: `pnpm --filter @aeos/projects check`.
10. TASK-0094: Render expanded project context fields. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.

## Memory MVP Backlog

1. TASK-0057: Implement memory package Markdown entry builder. Code. Effort: Medium. Verification: `pnpm --filter @aeos/memory check`.
2. TASK-0058: Add memory filename and slug helpers. Code. Effort: Low. Verification: `pnpm --filter @aeos/memory check`.
3. TASK-0059: Tighten core memory frontmatter validation. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
4. TASK-0060: Implement memory Markdown parser. Code. Effort: Medium. Verification: `pnpm --filter @aeos/memory check`.
5. TASK-0061: Implement memory file validation. Code. Effort: High. Verification: `pnpm --filter @aeos/memory check`.
6. TASK-0062: Add memory secret-content blocking. Code. Effort: Medium. Verification: `pnpm --filter @aeos/memory check`.
7. TASK-0063: Implement local memory writer. Code. Effort: High. Verification: `pnpm --filter @aeos/memory check`.
8. TASK-0064: Implement file-based memory search. Code. Effort: High. Verification: `pnpm --filter @aeos/memory check`.
9. TASK-0065: Add memory validate CLI command. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
10. TASK-0066: Add memory search CLI command. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
11. TASK-0067: Add remember CLI command. Code. Effort: High. Verification: `pnpm --filter @aeos/cli check`.
12. TASK-0068: Review Memory MVP command behavior. Docs. Effort: Medium. Verification: `git status --short`.

## Remember Command MVP Backlog

1. TASK-0067: Implement remember command core flow. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
2. TASK-0068: Add remember command usage errors. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
3. TASK-0069: Add remember command interactive input. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
4. TASK-0070: Add remember input normalization helper. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
5. TASK-0071: Add remember validation output. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
6. TASK-0072: Add remember prepared artifact output. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
7. TASK-0073: Add remember source task and tag flags. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
8. TASK-0074: Add remember JSON output placeholder. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
9. TASK-0075: Add remember smoke verification. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
10. TASK-0076: Review remember command MVP behavior. Docs. Effort: Medium. Verification: `git status --short`.

## Search Command MVP Backlog

1. TASK-0073: Implement aeos search command core flow. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
2. TASK-0074: Add search command usage errors. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
3. TASK-0075: Add memory file reader for search indexing. Code. Effort: High. Verification: `pnpm --filter @aeos/memory check`.
4. TASK-0076: Add search type filter. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
5. TASK-0077: Add deterministic search result formatting. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
6. TASK-0078: Add search no-results behavior. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
7. TASK-0079: Add search command smoke checks. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
8. TASK-0080: Add search JSON output placeholder. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
9. TASK-0081: Review search command deterministic behavior. Docs. Effort: Medium. Verification: `git status --short`.
10. TASK-0082: Update search command context handoff. Docs. Effort: Low. Verification: `git status --short`.
