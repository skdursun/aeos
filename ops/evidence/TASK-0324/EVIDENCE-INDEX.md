# TASK-0324 evidence index

What each file in this directory is, and one integrity caveat. Read this before citing anything here.

## Provenance of all captures

Every `repro-*` file was produced **outside AEOS machinery** — run directly from a shell, not through any `aeos` command. No AEOS invocation was created, no one-shot launch authority was consumed, and nothing under `.aeos/` was written or read for these runs. They are diagnostic reproductions of the planner launch, not canary executions.

## Files

| File | What it is |
|---|---|
| `preflight-audit.md` | The full 11-section preflight audit: burn-risk ranking, executable-binding verdict, build/freshness facts, identity-minting surface, and the root-cause analysis. **Authoritative narrative record.** |
| `repro-codex-planner.sh` | Portable reproduction script. Rebuilds AEOS's exact planner launch — same argv, same cwd, same six-variable bounded env (`HOME`, `USER`, `LOGNAME`, `TMPDIR`, `PATH`, `LANG`) via `env -i`, same stdin payload. Takes `bounded` or `inherited`. |
| `repro-stdin.json` | Byte-exact reconstruction of the planner stdin payload — **1187 bytes**, matching the `stdinBytes=1187` recorded in the persisted `evidencefix` invocation diagnostic. This equality is what proves the reconstruction is faithful. |
| `repro-fixed-stdout.txt` / `repro-fixed-stderr.txt` | Post-fix run. Exit 0, schema-conformant routing proposal returned. |
| `repro-bounded-stdout.txt` / `repro-bounded-stderr.txt` | **Also a post-fix run** — see the caveat below. Not the pre-fix failure, despite the name. |
| `repro-portable-bounded-stdout.txt` / `-stderr.txt` | Output of the portable script itself (not Codex). Contains `BOUNDED_EXIT=0`, confirming the `set -eu` exit-code-reporting bug is fixed. |

## Integrity caveat — the pre-fix failing capture was overwritten

`repro-bounded-stdout.txt` / `repro-bounded-stderr.txt` originally held the **pre-fix failing run**: stdout 0 bytes, stderr carrying the provider's `400 invalid_json_schema` rejection. That was the root-cause evidence.

A later verification re-run of the same script — after the schema was fixed — wrote to the same filenames and **overwrote those bytes**. The files now contain a successful post-fix run and are near-duplicates of `repro-fixed-*` (differing only in timestamp and token count). This was an accident during evidence hygiene work, not a deliberate edit, and the original bytes are not recoverable from disk.

The root-cause evidence itself is **not** lost. The verbatim provider rejection is preserved in two durable places:

- `preflight-audit.md` §10–11, quoted in full;
- GitHub Issue #1, comment `5307465065`, quoted in full.

Verbatim, for convenience:

```
ERROR: {
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "code": "invalid_json_schema",
    "message": "Invalid schema for response_format 'codex_output_schema': In context=('properties', 'aeosCodexWorkerResultVersion'), schema must have a 'type' key.",
    "param": "text.format.schema"
  },
  "status": 400
}
```

The filenames were deliberately left as-is rather than renamed, so that this note and the audit's own cross-references stay valid. Treat `repro-bounded-*` as post-fix output and cite `preflight-audit.md` §10–11 for the failure.

## Host-layout note

`preflight-audit.md` retains real absolute paths in three places where the exact value **is** the evidence: the two trusted-executable source constants, and the `workdir:` line inside quoted captured stderr. Those are byte-faithful quotes and must not be sanitized. Incidental host paths elsewhere were generalized, and the script now derives `HOME`/`USER`/`TMPDIR`/`PATH` and the `codex` binary from the environment at run time.

## One unrelated line in the captures

Both stderr captures contain an `rmcp::transport::worker ... AuthRequired ... mcp.cloudflare.com` line. That is an ambient MCP server on the host failing its own OAuth handshake — unrelated to AEOS, not a credential, and it does not affect the exit code or the returned proposal.
