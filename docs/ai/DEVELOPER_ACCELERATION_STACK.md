# AEOS Developer Acceleration Stack

Bu dosya AEOS agentlarının repository üzerinde nasıl çalışacağını belirleyen compact tooling router'dır.

## Authority

AEOS authority'dir. Claude, Codex, Orca, CBM, Superpowers veya başka bir tool task completion, policy, permission, routing veya verifier authority değildir. Tool sonuçları evidence'dır.

## Repository discovery

Sıra:
1. Codebase Memory MCP
2. targeted `rg`
3. `ast-grep` structural search
4. gerekli exact source snippet/read
5. broad scan yalnız kanıtlanmış gerekçe varsa

Full repository dump default yasaktır.

## Tool selection

- Codebase Memory MCP: persistent repository intelligence; repo/domain discovery first; ikinci always-on generic memory MCP ekleme.
- RTK: yüksek hacimli test/git/shell output filtreleme; raw output'u agent context'e basma.
- Repomix: yalnız bounded snapshot/handoff gerektiğinde, on-demand.
- Context7: official package/API documentation, on-demand.
- Scrapling: web research / structured extraction, on-demand / CLI.
- Superpowers: workflow/methodology skill layer; bütün skills startup'ta preload edilmez; progressive disclosure/lazy-load.
- ast-grep: structural search/refactor; search → review matches → isolated branch → rewrite → diff → tests.
- mise: runtime/tool/task standardization; mevcut Node/pnpm architecture kararını değiştirmez.
- Trivy: vulnerability/config/security/SBOM baseline.
- Gitleaks: quick staged secret gate.
- Knip: TS/JS unused files/dependencies/exports; report-only first; automatic delete yasak.
- Turborepo: yalnız benchmark kanıtı varsa.

## Context discipline

Canonical task/issue → `PROJECT_CONTEXT.md` → current handoff/evidence → CBM discovery → targeted code.

MCP/tool schemas just-in-case preload edilmez. Structured, bounded ve JSON çıktılar tercih edilir.

## Critical review

P0 veya kritik architecture, security, policy, audit, permissions, filesystem, runner, CLI ve adapter değişikliklerinde implementer ve reviewer ayrı fresh context kullanır.

## Cloud/provider boundary

Kullanıcı açıkça istemedikçe AWS, Bedrock, S3, IAM, Cloudflare, Azure veya GCP AEOS mainline architecture içine sokulmaz. Provider/model bağlantıları adapter boundary üzerinden yapılır.
