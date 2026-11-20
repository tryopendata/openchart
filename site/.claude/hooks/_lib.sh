# shellcheck shell=bash
# Shared helpers for the hooks in this directory. Sourced, never executed:
#   source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"
#
# Written for bash 3.2 (the macOS default) under `set -euo pipefail`.

# hook_get <payload-json> <path>: print every string value at <path>, one per
# line (a value may itself hold newlines). <path> names object keys joined by
# dots, with [] for any array element: tool_input.command,
# tool_input.edits.[].new_string. Only string values are read.
#
# jq reads the payload when it is on PATH. Without it a small awk reader walks
# the JSON instead. Foreground inspection needs jq to validate background flags;
# it fails open with a note when jq is absent. The
# reader decodes the standard escapes and \u escapes for printable ASCII; other
# \u escapes stay as written, which no pattern in these hooks depends on.
hook_get() {
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$1" | jq -r --arg want "$2" '
      paths(type == "string") as $p
      | select($p | map(if type == "number" then "[]" else . end) | join(".") == $want)
      | getpath($p)' 2>/dev/null
    return
  fi
  printf '%s' "$1" | LC_ALL=C awk -v want="$2" '
    function hexval(h, i, c, v) {
      v = 0
      for (i = 1; i <= 4; i++) {
        c = index("0123456789abcdef", tolower(substr(h, i, 1)))
        if (c == 0) return -1
        v = v * 16 + c - 1
      }
      return v
    }
    function here(p, j) {
      p = ""
      for (j = 1; j <= d; j++) p = p (j > 1 ? "." : "") k[j]
      return p
    }
    { s = s $0 "\n" }
    END {
      n = length(s); i = 1; d = 0; iskey = 0
      while (i <= n) {
        c = substr(s, i, 1)
        if (c == "{") { d++; t[d] = "o"; k[d] = ""; iskey = 1; i++; continue }
        if (c == "[") { d++; t[d] = "a"; k[d] = "[]"; iskey = 0; i++; continue }
        if (c == "}" || c == "]") { d--; iskey = 0; i++; continue }
        if (c == ",") { iskey = (t[d] == "o"); i++; continue }
        if (c != "\"") { i++; continue }
        key = iskey; emit = !key && here() == want; str = ""; i++
        while (i <= n) {
          c = substr(s, i, 1)
          if (c == "\"") { i++; break }
          if (c == "\\") {
            e = substr(s, i + 1, 1); i += 2
            if (e == "n") c = "\n"; else if (e == "t") c = "\t"; else if (e == "r") c = "\r"
            else if (e == "b") c = "\b"; else if (e == "f") c = "\f"
            else if (e == "u") {
              v = hexval(substr(s, i, 4))
              if (v >= 32 && v < 127) { c = sprintf("%c", v); i += 4 }
              else c = "\\u"
            } else c = e
          } else i++
          if (key) str = str c; else if (emit) printf "%s", c
        }
        if (key) { k[d] = str; iskey = 0 } else if (emit) printf "\n"
      }
    }'
}

# json_quote <text>: <text> as a JSON string, control bytes other than tab and
# newline dropped. Needs no jq, so a block reads the same on every machine.
json_quote() {
  printf '%s' "$1" | tr -d '\000-\010\013\014\016-\037' |
    sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/	/\\t/g' |
    awk 'BEGIN { printf "\"" } NR > 1 { printf "\\n" } { printf "%s", $0 } END { printf "\"" }'
}

# hook_deny <reason>: the PreToolUse response that denies the tool call. The
# agent sees <reason>; keep it free of the text that matched.
hook_deny() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":%s}}\n' \
    "$(json_quote "$1")"
}

# hook_context <event> <text>: hand <text> to the agent as additional context.
hook_context() {
  printf '{"hookSpecificOutput":{"hookEventName":"%s","additionalContext":%s}}\n' \
    "$1" "$(json_quote "$2")"
}

# The invoking adapter supplies CLAUDE_PROJECT_DIR when available. Otherwise
# resolve from this shared library, so tool cwd never selects another project.
project_root() {
  if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -d "${CLAUDE_PROJECT_DIR}" ]; then
    printf '%s\n' "$CLAUDE_PROJECT_DIR"
    return 0
  fi
  (cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)
}

# find_up <start-dir> <name>...: print the nearest directory, walking up from
# start-dir, that contains any of the names (a name may be a relative path such
# as node_modules/.bin/biome). Returns 1 when nothing matches.
find_up() {
  local dir=$1
  shift
  local name
  while :; do
    for name in "$@"; do
      if [ -e "$dir/$name" ]; then
        printf '%s\n' "$dir"
        return 0
      fi
    done
    if [ "$dir" = "/" ] || [ -z "$dir" ]; then
      return 1
    fi
    dir=$(dirname "$dir")
  done
}

# with_timeout <seconds> <cmd>...: run cmd, killing it after <seconds>. macOS
# ships no coreutils `timeout`, so race the command against a sleeper.
#
# Output goes through a temp file rather than straight to stdout: if the command
# spawns a grandchild (bunx, npx, uv), killing the child would leave the
# grandchild holding a command-substitution pipe open and the caller would block
# anyway. The sleeper's own output is sent to /dev/null for the same reason.
#
# Prints the captured stdout+stderr. Returns 124 on timeout, else the command's
# exit status.
with_timeout() {
  local secs=$1
  shift
  local tmp
  tmp=$(mktemp "${TMPDIR:-/tmp}/claude-hook.XXXXXX") || return 1

  "$@" >"$tmp" 2>&1 </dev/null &
  local pid=$!
  (sleep "$secs" && kill -9 "$pid") >/dev/null 2>&1 </dev/null &
  local killer=$!

  local rc=0
  wait "$pid" 2>/dev/null || rc=$?
  kill "$killer" 2>/dev/null || true
  wait "$killer" 2>/dev/null || true

  cat "$tmp"
  rm -f "$tmp"
  # 137 = SIGKILL, i.e. the sleeper won the race.
  [ "$rc" -eq 137 ] && return 124
  return "$rc"
}

# session_file_list <payload-json>: print the path of this session's list of
# written files, creating its directory. The list lives outside the repo, keyed
# by the payload's session_id reduced to [A-Za-z0-9_-] so it can't name a path
# elsewhere. Returns 1 when the payload has no usable session_id.
session_file_list() {
  local id dir
  id=$(hook_get "$1" session_id | head -n 1) || return 1
  id=$(printf '%s' "$id" | tr -cd 'A-Za-z0-9_-')
  [ -n "$id" ] || return 1
  dir="${TMPDIR:-/tmp}"
  dir="${dir%/}/stacks-hooks"
  mkdir -p "$dir" 2>/dev/null || return 1
  printf '%s/%s.files\n' "$dir" "$id"
}

# strip_control: drop ANSI escapes and other control bytes that would make a jq
# payload unreadable, keeping tabs and newlines.
strip_control() {
  sed -e $'s/\x1b\\[[0-9;]*[A-Za-z]//g' | tr -d '\000-\010\013\014\016-\037'
}

# check_patch <payload-json> <secret-guard>: translate patch marker paths and
# added text without evaluating shell escapes. Every file uses the same guard.
check_patch() {
  local patch file="" text="" line secret_guard=$2
  patch=$(hook_get "$1" tool_input.command)

  check_patch_file() {
    [ -n "$file" ] || return 0
    local payload decision
    payload=$(printf '{"tool_input":{"file_path":%s,"content":%s}}' \
      "$(json_quote "$file")" "$(json_quote "$text")")
    decision=$(printf '%s' "$payload" | bash "$secret_guard")
    if [ -n "$decision" ]; then
      printf '%s\n' "$decision"
      exit 0
    fi
  }

  while IFS= read -r line; do
    case "$line" in
      '*** Add File: '* | '*** Update File: '* | '*** Move to: '*)
        check_patch_file
        file=${line#*: }
        text=""
        ;;
      '*** Delete File: '* | '*** End Patch')
        check_patch_file
        file=""
        text=""
        ;;
      '+'*) text="$text${line:1}"$'\n' ;;
    esac
  done <<<"$patch"
  check_patch_file
}

# Executable foreground segments for stack anti-hang rules. Quotes are decoded only
# after splitting; background pipelines and positive timeouts are skipped together.
foreground_commands() { shell_commands 1 "$1"; }

# Executable checks also inspect detached and time-limited commands, with tab-separated argv.
executable_commands() { shell_commands 0 "$1"; }

# Mode 2 also emits structural input, pipeline, redirect and function records.
# Mode 3 keeps foreground argument boundaries with tab-separated argv.
shell_commands() {
  local foreground=$1
  shift
  printf '%s\n' "$1" | LC_ALL=C awk -v foreground="$foreground" '
    function expand(value, depth, consumer, key, at, size) {
      while (match(value, /@exp[0-9]+@/)) {
        key = substr(value, RSTART, RLENGTH); at = RSTART; size = RLENGTH
        if (key in expansions) scan(expansions[key], depth + 1, consumer)
        value = substr(value, 1, at - 1) "@value@" substr(value, at + size)
      }
      return value
    }
    function emit(raw, depth, previous, consumer, previous_program, n, w, i, base, wrapped, out, limit, input, j, p, count, program, value, first, payload) {
      if (depth > 8) return
      n = words(raw, w); wrapped = 0; out = ""
      for (i = 1; i <= n; i++) {
        if (w[i] == "") continue
        if (w[i] ~ /^[A-Za-z_][A-Za-z0-9_]*=/) continue
        base = w[i]; sub(/.*\//, "", base)
        if (base == "timeout") {
          for (i++; i <= n && w[i] ~ /^-/; i++) {
            if (w[i] ~ /^(-s|--signal|-k|--kill-after)$/) i++
          }
          limit = w[i]
          if (limit !~ /^[0-9]+(\.[0-9]+)?[smhd]?$/) return
          if ((foreground == 1 || foreground == 3) && limit + 0 > 0) return
          wrapped = 1; continue
        }
        if (base == "uv" && w[i + 1] == "run") { i++; wrapped = 1; continue }
        if (base ~ /^(env|command|builtin|exec|nice|nohup|sudo|doas|time|xargs|busybox|stdbuf|uvx|then|do|else|if|elif|while|until|!)$/) {
          wrapped = 1; continue
        }
        if (wrapped && w[i] ~ /^(--with|--project|--directory|--env-file|--unset|-C|-u|-g|-I|-L|-n|-P)$/) { i++; continue }
        if (wrapped && (w[i] ~ /^-/ || w[i] ~ /^[0-9][0-9.]*$/)) continue
        break
      }
      first = i; program = base
      if (w[first] in groups) return scan(groups[w[first]], depth + 1, consumer, previous, previous_program)
      if (foreground == 2 && consumer != "") print "@pipe\t" program "\t" consumer
      if (previous != "") {
        count = words(previous, p); input = ""
        for (j = 1; j <= count; j++) { value = p[j]; sub(/.*\//, "", value); if (value == previous_program) break }
        j++
        if (previous_program == "printf" && p[j] ~ /%/) j++
        for (; j <= count; j++) input = input (input == "" ? "" : " ") (p[j] in feeds ? feeds[p[j]] : p[j])
        if (previous_program ~ /^(echo|printf|cat)$/ && program ~ /^(sh|bash|zsh|dash|ksh)$/) scan(input, depth + 1, "")
        if (foreground == 2) {
          gsub(/\n/, "\036", input); gsub(/\t/, " ", input)
          print "@stdin\t" program "\t" input
          if (program ~ /^(sh|bash|zsh|dash|ksh)$/) print "@pipe\t" previous_program "\t" program
        }
      }
      for (i = 1; i <= n; i++) w[i] = expand(w[i], depth, program ~ /^(sh|bash|zsh|dash|ksh|eval)$/ ? "sh" : consumer)
      if (program == "eval") {
        input = ""
        for (j = first + 1; j <= n; j++) input = input (j == first + 1 ? "" : " ") w[j]
        scan(input, depth + 1, ""); return program
      }
      if (program ~ /^(sh|bash|zsh|dash|ksh)$/) {
        for (j = first + 1; j <= n; j++) {
          if (w[j] ~ /^-[a-z]*c[a-z]*$/) { scan(w[j + 1], depth + 1, ""); break }
        }
      }
      for (i = first; i <= n; i++) {
        if (w[i] in feeds) {
          input = feeds[w[i]]
          if (program ~ /^(sh|bash|zsh|dash|ksh)$/) scan(input, depth + 1, "")
          if (foreground == 2) { gsub(/\n/, "\036", input); gsub(/\t/, " ", input); print "@stdin\t" program "\t" input }
          continue
        }
        value = w[i]; gsub(/\n/, "\036", value); gsub(/[\t\r]/, " ", value)
        out = out (out == "" ? "" : (foreground == 1 ? " " : "\t")) value
      }
      gsub(/\n/, " ", out)
      if (out != "") print out
      return program
    }
    function ansi(raw, start, c, digits, base, max, i, digit, value) {
      c = substr(raw, start, 1); escape_size = 1
      if (c == "n") return "\n"
      if (c == "t") return "\t"
      if (c == "r") return "\r"
      if (c == "a") return sprintf("%c", 7)
      if (c == "b") return "\b"
      if (c == "e" || c == "E") return sprintf("%c", 27)
      if (c == "f") return "\f"
      if (c == "v") return sprintf("%c", 11)
      if (c ~ /[0-7]/) { base = 8; max = 3; i = start }
      else if (c ~ /^[xuU]$/) { base = 16; max = c == "x" ? 2 : (c == "u" ? 4 : 8); i = start + 1 }
      else return c
      value = 0; digits = 0
      for (; digits < max && i <= length(raw); i++) {
        digit = index("0123456789abcdef", tolower(substr(raw, i, 1))) - 1
        if (digit < 0 || digit >= base) break
        value = value * base + digit; digits++
      }
      if (!digits) return c
      escape_size = i - start
      return value > 0 && value < 128 ? sprintf("%c", value) : "@character@"
    }
    function words(raw, w, i, c, q, n, value, started) {
      n = 0; value = ""; q = ""; started = 0
      for (i = 1; i <= length(raw); i++) {
        c = substr(raw, i, 1)
        if (c == "$" && substr(raw, i + 1, 1) == "\047" && q == "") { q = "ansi"; i++; started = 1; continue }
        if (c == "\\" && q != "\047") {
          c = substr(raw, ++i, 1)
          if (q == "ansi") { c = ansi(raw, i); i += escape_size - 1 }
          value = value c; started = 1; continue
        }
        if (q != "") { if (c == q || (q == "ansi" && c == "\047")) q = ""; else value = value c }
        else if (c == "\047" || c == "\"") { q = c; started = 1 }
        else if (c ~ /[ \t\n]/) {
          if (started) w[++n] = value
          value = ""; started = 0
        } else { value = value c; started = 1 }
      }
      if (q != "") return 0
      if (started) w[++n] = value
      return n
    }
    function group(text, depth, consumer, previous, previous_program, at, part, separator, program) {
      if (depth > 8) return
      while (match(text, /[\034\035]/)) {
        at = RSTART; separator = substr(text, at, 1)
        part = substr(text, 1, at - 1); text = substr(text, at + 1)
        program = emit(part, depth, previous, consumer, previous_program)
        if (separator != "\035") { previous = ""; previous_program = "" }
        else if (program != "cat" || previous == "") { previous = part; previous_program = program }
      }
      return emit(text, depth, previous, consumer, previous_program)
    }
    function here_header(text, start, i, raw, names, q, c) {
      i = start + 2; here_trim = substr(text, i, 1) == "-"
      if (here_trim) i++
      while (substr(text, i, 1) ~ /[ \t]/) i++
      raw = ""
      for (; i <= length(text); i++) {
        c = substr(text, i, 1)
        if (c == "\\" && q != "\047") { raw = raw c substr(text, ++i, 1); continue }
        if (q != "") { if (c == q) q = "" }
        else if (c == "\047" || c == "\"") q = c
        else if (c ~ /[ \t\n;&|()]/) break
        raw = raw c
      }
      if (words(raw, names) != 1) return 0
      here_name = names[1]; return i
    }
    function here_body(text, start, delimiter, trim, i, line) {
      here_text = ""; i = start
      while (i < length(text)) {
        i++; line = ""
        while (i <= length(text) && substr(text, i, 1) != "\n") line = line substr(text, i++, 1)
        if (trim) sub(/^\t+/, "", line)
        if (line == delimiter) return i
        here_text = here_text line "\n"
      }
      return 0
    }
    # Heredoc text cannot close a surrounding command substitution or quote.
    function closing(text, start, opener, closer, i, c, q, level, end, count, h, names, trims) {
      level = 1; q = ""
      for (i = start; i <= length(text); i++) {
        c = substr(text, i, 1)
        if (c == "\\" && q != "\047") { i++; continue }
        if (q != "") { if (c == q || (q == "ansi" && c == "\047")) q = ""; continue }
        if (c == "$" && substr(text, i + 1, 1) == "\047") { q = "ansi"; i++; continue }
        if (c == "\047" || c == "\"") { q = c; continue }
        if (c == "<" && substr(text, i + 1, 1) == "<" && substr(text, i + 2, 1) != "<") {
          end = here_header(text, i); if (!end) return 0
          names[++count] = here_name; trims[count] = here_trim; i = end - 1; continue
        }
        if (c == "\n" && count) {
          for (h = 1; h <= count; h++) { i = here_body(text, i, names[h], trims[h]); if (!i) return 0 }
          count = 0; continue
        }
        if (c == opener) level++
        if (c == closer) { level--; if (level == 0) return i }
      }
      return 0
    }
    function scan(text, depth, consumer, previous, previous_program, i, c, q, out, following, pipeline, here, at, raw, names, delimiter, end, key, body, keys, h, program) {
      if (depth > 8) return
      q = ""; out = ""; pipeline = ""; here = ""
      if (previous != "") pipeline = previous "\035"
      for (i = 1; i <= length(text); i++) {
        c = substr(text, i, 1); following = substr(text, i + 1, 1)
        if (c == "\\" && q != "\047" && i < length(text)) {
          out = out c following; i++; continue
        }
        if ((q == "" || q == "\"") && ((c == "$" && following == "(") || (q == "" && c ~ /[<>]/ && following == "("))) {
          end = closing(text, i + 2, "(", ")")
          if (!end) { group(pipeline, depth, consumer); return }
          key = "@exp" ++serial "@"; expansions[key] = substr(text, i + 2, end - i - 2)
          out = out key; i = end; continue
        }
        if ((q == "" || q == "\"") && c == "`") {
          end = i + 1
          while (end <= length(text) && substr(text, end, 1) != "`") { if (substr(text, end, 1) == "\\") end++; end++ }
          if (end > length(text)) { group(pipeline, depth, consumer); return }
          key = "@exp" ++serial "@"; expansions[key] = substr(text, i + 1, end - i - 1)
          out = out key; i = end; continue
        }
        if (q != "") { if (c == q || (q == "ansi" && c == "\047")) q = ""; out = out c; continue }
        if (c == "$" && following == "\047") { q = "ansi"; out = out c following; i++; continue }
        if (c == "\047" || c == "\"") { q = c; out = out c; continue }
        if (c == "(" || (c == "{" && out ~ /^[ \t]*$/)) {
          end = closing(text, i + 1, c, c == "(" ? ")" : "}")
          if (!end) { group(pipeline, depth, consumer); return }
          body = substr(text, i + 1, end - i - 1)
          if (c == "(" && body == "" && substr(text, end + 1) ~ /^[ \t]*\{/) {
            # Function definitions are data until invoked; retain their structure for the fork-bomb rule.
            raw = out; sub(/^[ \t]+/, "", raw); sub(/[ \t]+$/, "", raw)
            i = end + 1; while (substr(text, i, 1) ~ /[ \t]/) i++
            end = closing(text, i + 1, "{", "}"); if (!end) return
            body = substr(text, i + 1, end - i - 1)
            if (foreground == 2) print "@function\t" raw "\t" body
            out = ""; i = end; continue
          }
          key = "@group" ++serial "@"; groups[key] = body
          out = out " " key; i = end; continue
        }
        if (c == "#" && (out == "" || out ~ /[ \t]$/)) {
          while (i <= length(text) && substr(text, i, 1) != "\n") i++
          c = "\n"; following = ""
        }
        if (c == "<" && following == "<" && substr(text, i + 2, 1) == "<") {
          # The remainder is one input word, decoded by the same argv reader.
          i += 3; while (substr(text, i, 1) ~ /[ \t]/) i++
          raw = ""; h = ""
          for (; i <= length(text); i++) {
            c = substr(text, i, 1)
            if (c == "\\" && h != "\047") { raw = raw c substr(text, ++i, 1); continue }
            if (c == "$" && substr(text, i + 1, 1) == "\047" && h == "") { h = "ansi"; raw = raw c "\047"; i++; continue }
            if (h != "") { if (c == h || (h == "ansi" && c == "\047")) h = "" }
            else if (c == "\047" || c == "\"") h = c
            else if (c ~ /[ \t\n;&|]/) break
            raw = raw c
          }
          if (words(raw, names) != 1) return
          key = "@feed" ++serial "@"; feeds[key] = names[1]; out = out " " key; i--; continue
        }
        if (c == "<" && following == "<") {
          end = here_header(text, i); if (!end) return
          key = "@feed" ++serial "@"
          here = here here_name "\034"; keys = keys key "\034"; strips[key] = here_trim
          i = end - 1; out = out " " key; continue
        }
        if (foreground == 2 && c == ">") {
          raw = substr(text, i + 1); sub(/^[> \t]+/, "", raw); sub(/[ \t\n;&|].*$/, "", raw)
          if (words(raw, names) == 1) print "@redirect\t" names[1]
        }
        if (c == "&" && (following == ">" || substr(text, i - 1, 1) ~ /[<>]/)) {
          out = out c; continue
        }
        if ((c == "&" || c == "|") && following == c) {
          pipeline = pipeline out "\034"; out = ""; i++; continue
        }
        if (c == "|" && following != "|") {
          pipeline = pipeline out "\035"; out = ""
          if (following == "&") i++
        } else if (c == ";" || c == "&" || c == "|" || c == "\n") {
          if (c == "\n") {
            while ((at = index(here, "\034")) > 0) {
              delimiter = substr(here, 1, at - 1); here = substr(here, at + 1)
              at = index(keys, "\034"); key = substr(keys, 1, at - 1); keys = substr(keys, at + 1)
              i = here_body(text, i, delimiter, strips[key]); if (!i) return
              feeds[key] = here_text
            }
          }
          if (c != "&" || (foreground != 1 && foreground != 3)) program = group(pipeline out, depth, consumer)
          pipeline = ""; out = ""
        } else out = out c
      }
      if (q == "") return group(pipeline out, depth, consumer)
      return group(pipeline, depth, consumer)
    }
    { text = text (NR == 1 ? "" : "\n") $0 }
    END { scan(text, 0, "") }'
}

# hook_foreground_commands <payload-json>: validate the native Bash input, then split it.
hook_foreground_commands() {
  local command
  if ! command -v jq >/dev/null 2>&1; then
    echo "agent-ops: jq missing; skipping foreground inspection and allowing call." >&2
    return 1
  fi
  command=$(printf '%s' "$1" | jq -r '
    if .tool_input.run_in_background == true then empty
    elif .tool_input.command == null then empty
    elif (.tool_input.command | type) == "string" then .tool_input.command
    else error("invalid command") end' 2>/dev/null) || {
      echo "agent-ops: unreadable payload; skipping foreground inspection and allowing call." >&2
      return 1
    }
  foreground_commands "$command" || {
    echo "agent-ops: splitter unavailable; skipping foreground inspection and allowing call." >&2
    return 1
  }
}

# hook_foreground_argv <payload-json>: foreground commands with tab-separated argv.
# Stack guards need argument boundaries to distinguish script names and option values
# containing spaces. Existing foreground_commands output stays space-separated.
hook_foreground_argv() {
  local command
  if ! command -v jq >/dev/null 2>&1; then
    echo "agent-ops: jq missing; skipping foreground inspection and allowing call." >&2
    return 1
  fi
  command=$(printf '%s' "$1" | jq -rs '
    if length != 1 or (.[0] | type) != "object" then error("invalid payload")
    else .[0] |
      if .tool_input.run_in_background == true then empty
      elif .tool_input.command == null then empty
      elif (.tool_input.command | type) == "string" then .tool_input.command
      else error("invalid command") end
    end' 2>/dev/null) || {
      echo "agent-ops: unreadable payload; skipping foreground inspection and allowing call." >&2
      return 1
    }
  shell_commands 3 "$command" || {
    echo "agent-ops: splitter unavailable; skipping foreground inspection and allowing call." >&2
    return 1
  }
}
