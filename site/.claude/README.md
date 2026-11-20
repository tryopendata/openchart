# `.claude/`: Claude Code config

```
settings.json        shared config: hooks wiring, allow rules (read-only git and project commands), destructive-command deny rules
settings.local.json  your machine-only overrides (gitignored, create as needed)
hooks/               hooks, described below
```

Project instructions live in `AGENTS.md` at the repo root, which every coding agent reads. The root `CLAUDE.md` imports it and adds only Claude-specific notes, so edit `AGENTS.md` for anything that isn't Claude-specific.

## Hooks

| Hook | Event | What it does |
| --- | --- | --- |
| `session-start.sh` | SessionStart | Adds branch, dirty-file count, a warning on `main`, a pointer to `.stacks/BRIEF.md` while `AGENTS.md` is still a skeleton, uninstalled dependencies (a `package.json` without `node_modules/` or a `pyproject.toml` without `.venv/`, at the root or one directory down, with the install command), and compose services that aren't running. At most 15 lines. |
| `block-destructive.sh` | PreToolUse `Bash` | Uses `_destructive-patterns.sh` to deny destructive or irreversible work: deleting root, home or the working directory, discarding git changes or history, force pushes and remote branch deletes, dropped tables, disk writes, publishing and cloud deletes, or piping downloads into a shell. A deny asks the agent to consult the user. Inspection failures allow the call with a note. |
| `detect-secrets.sh` | PreToolUse `Edit\|Write` | Denies any write to `.env`, `.env.*` or `.envrc` other than `.env.example` (or `.sample`, `.template`), and writes containing credential-shaped strings (cloud and SaaS keys, private keys, tokens, connection strings with passwords). The reason names the kind of secret, never the matched text. |
| `lint-on-write.sh` | PostToolUse `Edit\|Write` | Runs the project's linter on the file just written (ruff, biome or eslint, golangci-lint or gofmt, shellcheck) and hands diagnostics back to the agent, one line each. Formatting isn't reported, since `format-changed.sh` fixes it. Rust and Java files get no per-write lint, since clippy checks a whole crate and Maven starts a JVM; run the project's lint target. Also records the path for `format-changed.sh`. |
| `format-changed.sh` | Stop | Formats the files this session wrote with the formatters the project has configured (ruff, biome or prettier, gofmt, rustfmt with the edition from the nearest `Cargo.toml`, and Spotless through `./mvnw` for Java), then forgets them. Ruff's safe fixes run too, except removing unused imports (one written this turn may be used next turn). `lint-on-write.sh` records each path written through Edit/Write in a per-session list under `$TMPDIR/stacks-hooks/`, keyed by the session id. Files you or other agents in the same checkout are editing aren't touched; no session id means nothing is formatted. |
| `_destructive-patterns.sh` | (sourced) | The pattern list behind `block-destructive.sh`. Reuse it from any hook that approves or rewrites Bash commands. |
| `smoke.sh` | (not wired) | The project's only hook test, run by `hooks-smoke`: a deny and a near miss per guard, plus config parsing and wiring. Add a case here when you add a guard. |
| `_lib.sh` | (sourced) | Shared helpers: the payload reader, the deny and context responses, project root, `find_up`, a portable `with_timeout`, the per-session file list. |
| <!-- stacks:fill One row per other file in hooks/ (harness, stack, and app hooks such as TypeScript guards): name, event and matcher from settings.json, what it does. Delete this row if there are none. --> | | |

How they behave:

- A block means ask the user. Never rephrase a command, split it up or write a file another way to work around a deny.
- Guards deny destructive or irreversible work, secrets and session hangs. Keep runner choices, generated-file ownership and import boundaries in guidance and lint.
- Guards prevent accidents, not deliberate bypasses. They fail open if inspection is unavailable. The command guard reports this with a note; the secret guard can skip inspection silently.
- Lint and type feedback arrives as context after a write, only when there is a problem. Silence means clean, or that the linter couldn't run (not installed yet, timed out, or the file is outside its includes); run the project's lint command when it matters. Missing tools and advisory timeouts never block work. The TypeScript harness adds typecheck-on-write; list it in the hook table when installed.
- Linters and formatters run from the project's install or PATH. Hooks never download packages to run a check.
- External calls have timeouts so a stuck linter or Docker daemon cannot stall the session.
- Shell scripts run as `bash "${CLAUDE_PROJECT_DIR}/.claude/hooks/<name>.sh"`, so they need no executable bit. They target Bash 3.2 under `set -euo pipefail`.

To try a hook by hand, pipe it a payload:

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"git push --force"}}' | bash .claude/hooks/block-destructive.sh
```

### Turning one off

`/hooks` in Claude Code lists what's wired. To run a session without hooks, set `"disableAllHooks": true` in `settings.local.json` and remove it afterwards; the `permissions.deny` rules still apply. There's no per-hook switch: to drop one hook for good, delete its entry from `settings.json`.

### Changing them

- Add a shell destructive pattern to `_destructive-patterns.sh`, not to `block-destructive.sh`.
- Keep convention checks in guidance and lint. Hooks may deny only destructive work or session hangs; other project checks advise.
- Add a case to `.claude/hooks/smoke.sh` for each new guard: one deny and one near miss that must pass. Run `bash .claude/hooks/smoke.sh` after changes.

## Settings

`settings.json` is shared and committed. Some keys (permission allow rules, plugin marketplaces) only take effect after each person trusts the folder in Claude Code; deny rules apply right away. Put anything personal (extra permissions, env, personal MCP servers) in `settings.local.json`.

The stack and fragments merge their `permissions.allow` rules into `.claude/settings.json`, including read-only git and project commands. Add rules only for non-destructive commands you create beyond those; leave deploy, publish and anything destructive to prompt.

`permissions.deny` repeats the worst destructive shapes (`rm -rf /`, `rm -rf ~`, `rm -rf .`, force push, `git reset --hard`, `--no-verify` on commit and push) so they stay blocked with hooks turned off. They are exact rules on purpose: a wildcard such as `Bash(rm -rf /*)` would match every `rm -rf /some/abs/path`, and a deny rule can't be overridden by an allow rule. It also denies reading `.env`, `.env.local`, `.env.*.local`, `.env.production` and `.envrc`, at the root and in any subdirectory (`.env.example` stays readable), and editing `.stacks/manifest.json`: the manifest records the verify steps the project was generated with, and `stacks verify` fails a changed step, so the agent changes it only by asking you.

Depending on which stacks fragments are installed, `settings.json` may also:

- register the `claude-essentials` marketplace and enable its `ce` plugin (skills for testing, error handling and writing; review and log-reading agents), or
- register the `rr` marketplace and enable the `rr` plugin (the rr skill and `/rr:setup`), pre-approving rr's read-only commands (`rr doctor`, `rr status`, `rr tasks`). `rr run`/`exec` and named tasks still prompt, because they run commands on remote hosts.

Both take effect once each person trusts the folder in Claude Code.
