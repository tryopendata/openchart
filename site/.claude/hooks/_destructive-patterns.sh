# shellcheck shell=bash
# Shared destructive-only rules for Bash 3.2. Prints reason<TAB>suggestion on a match.
# shell_commands owns splitting, quoting, wrappers and nested shell input.

is_destructive() (
  local decoded seg program sub arg target root resolved i j status args dry snapshot destroy goal suffix ancestor help force staged worktree dot
  local -a argv
  decoded=$(shell_commands 2 "$1") || return 2
  hit() { printf '%s\tAsk the user first.' "$1"; }
  matches() {
    if command grep "$@"; then return 0; else status=$?; fi
    [ "$status" -eq 1 ] && return 1
    exit 2
  }
  sql() { matches -qiE '(^|;)[[:space:]]*(/\*[^*]*\*/[[:space:]]*)*(drop|truncate)[[:space:]]' <<<"${1//$'\036'/$'\n'}"; }
  database() {
    case "$1" in psql|pgcli|mysql|mariadb|mycli|sqlite3|litecli|sqlcmd|duckdb|clickhouse|clickhouse-client|cockroach|snowsql) return 0 ;; esac
    return 1
  }
  root=$(cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null && pwd -P) || root=""
  while IFS= read -r seg; do
    IFS=$'\t' read -r -a argv <<<"$seg"
    [ "${#argv[@]}" -gt 0 ] || continue
    program=${argv[0]##*/}; sub=""; args=""; i=1; dry=0; snapshot=0; destroy=0; goal=0; help=0
    # Also surface a broken matcher on otherwise harmless commands.
    matches -q '^$' <<<"$program" && continue
    case "$program" in
      @redirect)
        case "${argv[1]:-}" in /dev/sd*|/dev/nvme*|/dev/hd*|/dev/disk*|/dev/rdisk*|/dev/mapper*|/dev/vd*|/dev/xvd*)
          hit "This command overwrites a disk."; return 0 ;; esac
        continue ;;
      @function)
        if matches -qE '^([[:alnum:]_:]+)[[:space:]]+\1[[:space:]]*\|[[:space:]]*\1[[:space:]]*&[[:space:]]*$' <<<"${argv[*]:1}"; then
          hit "This command exhausts the machine's processes."; return 0
        fi
        continue ;;
      @pipe)
        case "${argv[1]:-}:${argv[2]:-}" in curl:sh|curl:bash|curl:zsh|curl:dash|curl:ksh|wget:sh|wget:bash|wget:zsh|wget:dash|wget:ksh)
          hit "Piping a download into a shell runs unreviewed code."; return 0 ;; esac
        continue ;;
      @stdin)
        if database "${argv[1]:-}" && sql "${argv[*]:2}"; then
          hit "DROP or TRUNCATE causes irreversible data loss."; return 0
        fi
        continue ;;
      rm)
        for target in "${argv[@]:1}"; do
          case "$target" in -*) continue ;; esac
          # Protected spellings precede the unknown-variable/glob exemption.
          target=${target%/\*}
          while :; do
            case "$target" in */) target=${target%/} ;; */.) target=${target%/.} ;; ./*) target=${target#./} ;; *) break ;; esac
          done
          case "$target" in
            ''|'~'|'$HOME'|'${HOME}'|'$PWD'|'${PWD}'|.|..)
              hit "rm targeting the filesystem root, home, or working directory."; return 0 ;;
          esac
          case "$target" in
            "$HOME"|"$root") hit "rm targeting the home or project directory."; return 0 ;;
          esac
          case "$target" in *'$'*|*'`'*) continue ;; esac
          case "$target" in
            /*)
              [ -n "$root" ] || continue
              target=${target%%\**}; target=${target%%\?*}; target=${target%%\[*}
              ancestor=$target; suffix=""
              while [ ! -e "$ancestor" ] && [ ! -L "$ancestor" ]; do
                suffix="/$(basename "$ancestor")$suffix"; ancestor=$(dirname "$ancestor")
              done
              if [ -d "$ancestor" ]; then
                resolved=$(cd "$ancestor" 2>/dev/null && pwd -P) || continue
              elif [ -f "$ancestor" ] && [ ! -L "$ancestor" ]; then
                resolved=$(cd "$(dirname "$ancestor")" 2>/dev/null && printf '%s/%s' "$(pwd -P)" "$(basename "$ancestor")") || continue
              else continue
              fi
              resolved="${resolved%/}$suffix"
              case "$resolved" in
                "$root") hit "rm targeting the project directory."; return 0 ;;
                "$root"/*) ;;
                /tmp|/tmp/*|/private/tmp|/private/tmp/*|/var/folders|/var/folders/*|/private/var/folders|/private/var/folders/*) ;;
                *)
                  if [ -n "${TMPDIR:-}" ]; then
                    case "$resolved" in "${TMPDIR%/}"|"${TMPDIR%/}"/*) continue ;; esac
                  fi
                  hit "rm targets an absolute path outside the project."; return 0 ;;
              esac ;;
          esac
        done
        continue ;;
      mkfs*)
        if [ "${#argv[@]}" -eq 2 ]; then
          case "${argv[1]}" in -V|--version|--help) continue ;; esac
        fi
        hit "This command overwrites a disk."; return 0 ;;
      dd)
        for arg in "${argv[@]:1}"; do
          case "$arg" in of=/dev/sd*|of=/dev/nvme*|of=/dev/hd*|of=/dev/disk*|of=/dev/rdisk*|of=/dev/mapper*|of=/dev/vd*|of=/dev/xvd*)
            hit "This command overwrites a disk."; return 0 ;; esac
        done
        continue ;;
      git)
        force=0; staged=0; worktree=0; dot=0
        while [ "$i" -lt "${#argv[@]}" ]; do
          arg=${argv[$i]}; i=$((i + 1))
          case "$arg" in -C|-c|--git-dir|--work-tree|--namespace|--config-env) i=$((i + 1)); continue ;; -*) continue ;; esac
          sub=$arg; break
        done
        for ((j=i; j<${#argv[@]}; j++)); do
          arg=${argv[$j]}
          case "$sub:$arg" in commit:--) break ;; esac
          case "$sub:$arg" in push:-o|push:--push-option|push:--repo|push:--receive-pack|push:--exec) j=$((j + 1)); continue ;; esac
          case "$sub:$arg" in commit:--message|commit:--file|commit:--reuse-message|commit:--reedit-message) j=$((j + 1)); continue ;; esac
          if [ "$sub" = commit ] && matches -qE '^-[^-]' <<<"$arg"; then
            # m/F/C/c take the remaining cluster as their value, or the next argv.
            target=${arg#-}
            while [ -n "$target" ]; do
              case "${target:0:1}" in
                n) hit "-n skips the project's git hooks."; return 0 ;;
                m|F|C|c) [ "${#target}" -gt 1 ] || j=$((j + 1)); break ;;
              esac
              target=${target:1}
            done
            continue
          fi
          case "$sub:$arg" in
            reset:--hard|checkout:.|checkout::/|filter-branch:*|filter-repo:*)
              hit "This git command discards work or rewrites history."; return 0 ;;
            commit:--no-verify|push:--no-verify)
              hit "--no-verify skips the project's git hooks."; return 0 ;;
          esac
          case "$sub:$arg" in
            restore:.) dot=1 ;;
            restore:--staged) staged=1 ;;
            restore:--worktree) worktree=1 ;;
            clean:--force) force=1 ;;
            clean:--dry-run) dry=1 ;;
          esac
          case "$sub" in
            restore)
              matches -qE '^-[[:alpha:]]*S[[:alpha:]]*$' <<<"$arg" && staged=1
              matches -qE '^-[[:alpha:]]*W[[:alpha:]]*$' <<<"$arg" && worktree=1 ;;
            clean)
              matches -qE '^-[[:alpha:]]*f[[:alpha:]]*$' <<<"$arg" && force=1
              matches -qE '^-[[:alpha:]]*n[[:alpha:]]*$' <<<"$arg" && dry=1 ;;
            push)
              if matches -qE '^(--force|--mirror|--delete|-[[:alpha:]]*[fd][[:alpha:]]*|\+[^[:space:]]+|:[^[:space:]]+)$' <<<"$arg"; then
                hit "This git command rewrites history or deletes remote branches."; return 0
              fi ;;
          esac
        done
        case "$sub" in
          filter-branch|filter-repo) hit "This git command rewrites history."; return 0 ;;
          restore)
            if [ "$dot" -eq 1 ] && { [ "$staged" -eq 0 ] || [ "$worktree" -eq 1 ]; }; then
              hit "git restore . discards uncommitted work."; return 0
            fi ;;
          clean)
            if [ "$force" -eq 1 ] && [ "$dry" -eq 0 ]; then
              hit "git clean -f deletes untracked files."; return 0
            fi ;;
        esac
        continue ;;
    esac
    if database "$program"; then
      for arg in "${argv[@]:1}"; do
        case "$arg" in -c*|-e*) arg=${arg:2} ;; --command=*|--execute=*) arg=${arg#*=} ;; esac
        if sql "$arg"; then hit "DROP or TRUNCATE causes irreversible data loss."; return 0; fi
      done
      continue
    fi
    [ "$program" != mvnw ] || program=mvn
    while [ "$i" -lt "${#argv[@]}" ]; do
      arg=${argv[$i]}; i=$((i + 1))
      case "$program:$arg" in
        npm:--message|pnpm:--message|yarn:--message|npm:--tag|pnpm:--tag|yarn:--tag|bun:--tag|bun:--cwd|gh:--notes|gh:--title|gh:--notes-file) i=$((i + 1)); continue ;;
      esac
      case "$arg" in --help|-h) help=1; continue ;; esac
      case "$program:$arg" in
        mvn:-f|mvn:--file|mvn:-pl|mvn:--projects|mvn:-s|mvn:--settings|mvn:-gs|mvn:--global-settings|mvn:-t|mvn:--toolchains|mvn:-gt|mvn:--global-toolchains|mvn:-rf|mvn:--resume-from|mvn:-P|mvn:--activate-profiles|mvn:-T|mvn:--threads|mvn:-b|mvn:--builder|mvn:-l|mvn:--log-file)
          i=$((i + 1)); continue ;;
        mvn:deploy|mvn:deploy:deploy|mvn:deploy:deploy-file|mvn:central-publishing:publish|mvn:gpg:sign-and-deploy-file) goal=1 ;;
        cargo:--dry-run|npm:--dry-run|pnpm:--dry-run|yarn:--dry-run|bun:--dry-run) dry=1 ;;
        goreleaser:--snapshot|goreleaser:--snapshot=true) snapshot=1 ;;
        goreleaser:--snapshot=false) snapshot=0 ;;
        terraform:-destroy|terraform:-destroy=true|tofu:-destroy|tofu:-destroy=true) destroy=1 ;;
        terraform:-destroy=false|tofu:-destroy=false) destroy=0 ;;
      esac
      if [ -z "$sub" ]; then
        case "$arg" in
          --registry|--prefix|--workspace|--filter|--cwd|--directory|--project|--config-file|--cache-dir|--python|--config|--color|--log-level|-C|-c|-f|-Z|-n|--namespace|--context|--kubeconfig|--cluster|--user|--region|--profile|--endpoint-url)
            i=$((i + 1)); continue ;;
          -*|+*) continue ;;
        esac
        sub=$arg
      else
        case "$program:$arg" in aws:--region|aws:--profile|aws:--endpoint-url) i=$((i + 1)); continue ;; esac
        args="$args $arg"
      fi
    done
    [ "$help" -eq 0 ] || continue
    case "$program:$sub" in
      npm:publish|pnpm:publish|yarn:publish|bun:publish|cargo:publish) [ "$dry" -eq 0 ] || continue ;;
      npm:unpublish|pnpm:unpublish|yarn:unpublish) ;;
      npm:version|pnpm:version|yarn:version)
        matches -qE ' (v?[0-9]+\.[0-9]+\.[0-9]+[^ ]*|major|minor|patch|pre[^ ]*)($| )' <<<"$args" || continue ;;
      bun:pm) matches -qE '^ version +[^- ]' <<<"$args" || continue ;;
      npm:dist-tag) matches -qE '^ (add|rm)($| )' <<<"$args" || continue ;;
      changeset:publish) ;;
      npx:changeset|bunx:changeset) matches -qE '^ publish($| )' <<<"$args" || continue ;;
      bun:x) matches -qE '^ changeset publish($| )' <<<"$args" || continue ;;
      gh:release) matches -qE '^ (create|delete)($| )' <<<"$args" || continue ;;
      gh:repo) matches -qE '^ delete($| )' <<<"$args" || continue ;;
      kubectl:delete) ;;
      aws:s3)
        if matches -qE '^ rm($| )' <<<"$args"; then matches -qE ' --recursive($| )' <<<"$args" || continue
        elif matches -qE '^ rb($| )' <<<"$args"; then matches -qE ' --force($| )' <<<"$args" || continue
        else continue
        fi ;;
      mvn:*) [ "$goal" -eq 1 ] || continue ;;
      wasm-pack:publish|uv:publish|poetry:publish|twine:upload|gem:push) ;;
      goreleaser:release) [ "$snapshot" -eq 0 ] || continue ;;
      terraform:apply|tofu:apply) [ "$destroy" -eq 1 ] || continue ;;
      terraform:destroy|tofu:destroy|pulumi:destroy) ;;
      *) continue ;;
    esac
    hit "Publishing or destroying data or infrastructure is irreversible."; return 0
  done <<<"$decoded"
  return 1
)
