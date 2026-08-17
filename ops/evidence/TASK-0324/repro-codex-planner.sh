#!/bin/sh
# Out-of-band reproduction of the TASK-0324 Codex planner invocation.
# NOT an AEOS command. Does not touch .aeos, does not consume any invocation
# or one-shot authority. Run manually with the codex-cli 0.146.0 binary that
# AEOS points at (trustedCodexExecutablePath in task-execution-two-model-canary.ts).
#
# Requires: ops/evidence/TASK-0324/repro-stdin.json (byte-identical
# reconstruction of the AEOS planner stdin payload for the burned
# "evidencefix" identity -- 1187 bytes, matching the persisted diagnostic).
#
# Usage:
#   sh ops/evidence/TASK-0324/repro-codex-planner.sh bounded   # AEOS's exact bounded env
#   sh ops/evidence/TASK-0324/repro-codex-planner.sh inherited # full inherited shell env (control)
#
# The codex binary is located via `command -v codex` (i.e. whatever is first
# in PATH). Override by setting CODEX_BIN=/path/to/codex before running.

set -eu
cd "$(dirname "$0")/../../.."
SCHEMA="$(pwd)/packages/core/schemas/codex-planner-routing-proposal-v1.schema.json"
STDIN_FILE="$(pwd)/ops/evidence/TASK-0324/repro-stdin.json"
MODE="${1:-bounded}"

# Resolve codex binary — prefer CODEX_BIN env override, then PATH lookup.
CODEX_BIN="${CODEX_BIN:-$(command -v codex 2>/dev/null || true)}"
if [ -z "$CODEX_BIN" ]; then
  echo "ERROR: codex binary not found in PATH; set CODEX_BIN=/path/to/codex to override" >&2
  exit 1
fi

if [ "$MODE" = "bounded" ]; then
  # Exactly the 6 vars AEOS's approvedCodexEnvironmentRefs()/environmentFromPolicy()
  # would copy from the launching process's env for
  # inheritance="system_codex_read_only_planner_canary"
  # (task-execution-local-worker-process.ts:353-362, 382-388, 1168-1212).
  # LC_ALL / LC_CTYPE / CODEX_HOME are omitted here because they are unset
  # (undefined) in the actual launching shell, so safeEnvValue() would drop
  # them too (task-execution-local-worker-process.ts:390-400).
  #
  # Values are derived from this shell's environment at run time rather than
  # hardcoded literals — the fidelity is preserved: the same six variable
  # NAMES are forwarded, and their VALUES come from the identical source
  # (the parent process env) that AEOS's environmentFromPolicy() reads from.
  set +e
  env -i \
    HOME="$HOME" \
    USER="${USER:-$(id -un)}" \
    LOGNAME="${LOGNAME:-${USER:-$(id -un)}}" \
    TMPDIR="${TMPDIR:-/tmp}" \
    PATH="$PATH" \
    LANG="${LANG:-en_US.UTF-8}" \
    "$CODEX_BIN" exec --model gpt-5.5 -c 'model_reasoning_effort="high"' --sandbox read-only --output-schema "$SCHEMA" \
    < "$STDIN_FILE" \
    > ops/evidence/TASK-0324/repro-bounded-stdout.txt \
    2> ops/evidence/TASK-0324/repro-bounded-stderr.txt
  BOUNDED_EXIT=$?
  set -e
  echo "BOUNDED_EXIT=$BOUNDED_EXIT"
else
  set +e
  "$CODEX_BIN" exec --model gpt-5.5 -c 'model_reasoning_effort="high"' --sandbox read-only --output-schema "$SCHEMA" \
    < "$STDIN_FILE" \
    > ops/evidence/TASK-0324/repro-inherited-stdout.txt \
    2> ops/evidence/TASK-0324/repro-inherited-stderr.txt
  INHERITED_EXIT=$?
  set -e
  echo "INHERITED_EXIT=$INHERITED_EXIT"
fi
