#!/usr/bin/env bash
# PreToolUse (Bash): deny commands that destroy work or data without a way back
# (rm of /, ~ or ., git reset --hard, force push, DROP TABLE, publishing...).
# The patterns live in _destructive-patterns.sh.
#
# A deny is returned as JSON with exit 0, which the hooks contract honors, and
# the reason is shown to the agent so it can ask the user instead. Commands that
# don't match produce no output, and the normal permission flow applies.
#
# The worst of these are also listed under permissions.deny in settings.json, a
# second layer that holds even when hooks are turned off.
set -euo pipefail

check_guard() {
  hook_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd) || return $?
  # shellcheck source=_lib.sh
  source "$hook_dir/_lib.sh" || return $?
  # shellcheck source=_destructive-patterns.sh
  source "$hook_dir/_destructive-patterns.sh" || return $?
  local input command found status reason suggestion
  input=$(cat) || return $?
  command=$(hook_get "$input" tool_input.command) || return $?
  [ -n "$command" ] || return 0
  if found=$(is_destructive "$command" 2>&1); then
    # The matcher emits one reason/suggestion row. Diagnostics are an unavailable
    # guard, even if a later pattern happened to match after an earlier failure.
    case "$found" in *$'\n'* | *$'\r'*) return 2 ;; esac
    case "$found" in *$'\t'*) ;; *) return 2 ;; esac
    reason=${found%%$'\t'*}
    suggestion=${found#*$'\t'}
    hook_deny "BLOCKED: $reason $suggestion Never work around this block."
  else
    status=$?
    [ -z "$found" ] || return 2
    [ "$status" -eq 1 ] || return "$status"
  fi
}
if output=$(check_guard 2>/dev/null); then
  [ -z "$output" ] || printf '%s\n' "$output"
else
  cat >/dev/null 2>&1 || while IFS= read -r _; do :; done
  echo "agent-ops: command guard unavailable or unreadable payload; allowing call." >&2
fi
exit 0
