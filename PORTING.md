# Porting AgentTalk to another machine (Linux · Claude + Hermes)

> **Rewritten 2026-07-28** by Claude, verified command-by-command against the live macOS install at `04043a5`.
> Target for this pass: **Linux**, agent stack **Claude + Hermes only** (the PO's declared setup).
> The previous version (2026-07-14) was correct when written and is now stale in four checkable ways — §0.
>
> **Read §0, §7 and §8 before anything else.** They are the parts that will actually stop you: two of them did
> not exist a fortnight ago, and one is a genuine gap on Linux rather than a step to follow.

---

## 0. What changed since the 2026-07-14 version — corrections, verified

| Was written | Ground truth today | § |
|---|---|---|
| *"`AGENTTALK_PERSISTENT_MCP`"* listed as a runtime toggle | **The flag is DELETED** (BL-057, client `3403bdb`, 2026-07-16). **Set nothing.** The live-proven path is the only path. Some `scripts/*.mjs` here still export it — dead leftovers, no-ops. **`AGENTTALK_PERSISTENT_MCP_URL` is a different var and still live.** | §4 |
| *"agy/Gemini hangs on the attach healthcheck (LB-92)"* | **The UNFIT park was LIFTED 2026-07-16** on PO-witnessed live evidence. Irrelevant to this port (agy not installed) but do not carry the claim forward. | §3 |
| *"Codex is PO-ruled-out"* | **The PO declared Codex AND agy UNAVAILABLE on 2026-07-15**, until further notice. **Claude is the sole available agent**, under the resource-scarcity fallback. | §3 |
| *"Hermes is retired"* | **Hermes holds the OPERATOR seat since 2026-07-27.** Its retirement from *workflow participation* stands (no baton, no verdict, no instruction), but it now launches and monitors sessions — and, since this morning, writes to the backlog within a fence. **Directly relevant: it is installed on the target machine.** | §9 |

**Also new since that version, and absent from it entirely:** the **mandatory per-task worktree** discipline
(§7), the **infrastructure invariant harness** that gates operator runs (§8), and the `backlog:check` gate (§12).

---

## 1. The two repos (keep them siblings!)

| Repo | Path here | Role |
|---|---|---|
| **AgentTalk** | `/Users/fausto/Software/AgentTalk` | Orchestrator monorepo (npm workspaces: `apps/orchestrator`, `apps/web`, `packages/*`) |
| **agentalk-mcp-client** | `/Users/fausto/Software/agentalk-mcp-client` | MCP attach-mode worker (pty drivers + `llm-agent.mjs` + goose executor) |

**⚠️ Path coupling.** The client resolves the wire contract at `../AgentTalk/packages/contracts/wire-contract.json`
by default. **Clone both under one parent**, or set `AGENTTALK_CONTRACT_PATH=/abs/path/to/wire-contract.json`.

```bash
mkdir -p ~/Software && cd ~/Software
git clone git@github.com:faustothegrey/AgentTalk.git
git clone <agentalk-mcp-client remote>
```

---

## 2. Runtime + system packages

| Requirement | Here | Linux |
|---|---|---|
| **Node.js** | v24.14.1 | `nvm install 24 && nvm use 24` (README says 18+; dev is on 24 — **use 24**) |
| **npm** | 11.11.0 | ships with Node 24 |
| **git** | 2.33.0 | `apt install git` |
| **Native toolchain** | Xcode CLT | **required** — the client's `node-pty` compiles native code: `sudo apt install -y build-essential python3 make g++` |
| **`lsof`** | system | **`sudo apt install -y lsof`** — not always present on minimal images, and §8's harness plus the runbook's pre-flight both shell out to it |
| **`ps`** | system | present everywhere |

TypeScript and vitest are dev-dependencies — `npm install` covers them, nothing global.

---

## 3. Agents

**Only two are needed for the declared stack.**

| Agent | Needed | Notes |
|---|---|---|
| **claude** (Claude Code) | ✅ **yes** | Logs in with its own account — **not** `ANTHROPIC_API_KEY`. The sole available agent (PO, 2026-07-15), so it wears every seat under the resource-scarcity fallback. |
| **Hermes** | ✅ **yes** | The OPERATOR seat. Prerequisites in **§9** — it needs a directory contract, not just a binary. |
| goose | ⬜ optional | Only for the arbiter/consensus path (TL-013) or dev-executor runs. Needs `OPENROUTER_API_KEY`. Skip unless you want them. |
| codex · gemini/agy | ⬜ no | Both PO-declared UNAVAILABLE. Install only if the PO reverses that. |

Per-provider command overrides, if binaries land off-PATH: `CLAUDE_CMD`,
`AGENTTALK_CLAUDE_INTERACTIVE_COMMAND`, `AGENTTALK_CLAUDE_PERSISTENT_COMMAND` (and `CODEX_CMD` / `GEMINI_CMD`).

---

## 4. Environment variables & keys

For **Claude + Hermes only, no API key is strictly required.** Claude Code authenticates with its own login. The
block below is the full inventory for completeness — copy real values from this machine's `~/.zshrc` into the new
box's `~/.bashrc`/`~/.zshrc`. **A new shell (or restart) is required before Claude Code inherits them.**

```bash
# NONE of these are needed for the Claude + Hermes stack:
export OPENROUTER_API_KEY=...   # goose models + arbiter Judge/Synthesizer — only if you add goose
export OPENAI_API_KEY=...       # codex
export GOOGLE_API_KEY=... GEMINI_API_KEY=...
# ANTHROPIC_API_KEY is deliberately NOT set — Claude Code uses its own login
```

**Runtime toggles** (set per-run, never globally):

```bash
PORT, AGENTTALK_MCP_PORT                 # see the port table, §5
AGENTTALK_ATTACH_MODE
AGENTTALK_PERSISTENT_MCP_URL             # live. NOTE: the bare AGENTTALK_PERSISTENT_MCP is DELETED — set nothing
AGENTALK_MCP_CLIENT_DIR, AGENTTALK_MCP_CLIENT_CONTRACT_PATH
AGENTTALK_WORKDIR, AGENTTALK_EXECUTION_MODE
AGENTTALK_RECORDING_PATH                 # ndjson recording = ground truth for consensus runs
AGENTTALK_METER                          # override the meter base URL (default http://127.0.0.1:9899)
AGENTTALK_SWEEP_DECLARED                 # ⚠️ you WILL need this on Linux — see §8
```

**Google Drive (optional):** `GOOGLE_DRIVE_CREDENTIALS_PATH`, `GOOGLE_DRIVE_TOKEN_PATH`,
`GOOGLE_DRIVE_RESOURCE_STORE_PATH`, `GOOGLE_DRIVE_REDIRECT_BASE_URL` + `credentials.json`. The OAuth redirect is
pinned to `http://localhost:3000/api/integrations/google-drive/oauth/callback` — keep web on **:3000** or
re-register.

---

## 5. Ports — five different numbers, and they are not interchangeable

| Port | What | Set by |
|---|---|---|
| **3500** | the orchestrator an **operator run** launches | the launcher config (`design/launch-and-monitor-runbook.md`) |
| **3600** | the **operator's own** sandbox port — never 3500 | OPERATOR charter; `infra-invariant.mjs` `allowPorts: [3600]` |
| **3741** | the **auto-started** orchestrator (`AGENTTALK_MCP_PORT=54321`) | the launchd plist |
| **3000** | web app (pinned by the Drive OAuth redirect) | `PORT` |
| **5173** | vite dev server | `npm run dev` |
| **9899** | the usage meter — **external, not in this repo** | see §11 |

The charter's *"its own port 3600, never the orchestrator's 3500"* is a containment rule for the operator seat.
Keep it on the new box.

---

## 6. Untracked files git will NOT carry

| Item | Action |
|---|---|
| `node_modules/` (both repos) | regenerate: `npm install` |
| `dist/`, `*.tsbuildinfo` | regenerate: `npm run build` |
| `credentials.json`, `google-*.json` | **copy manually** if using Drive |
| `transcripts/`, `planning_runs/`, `persistence/`, `recordings/` | runtime history — copy only if wanted |
| `.claude/` | project-local Claude Code settings — copy if wanted |

### ⚠️ The subtle one: Claude's key store and memory are keyed by the repo's ABSOLUTE PATH

| File | Here | On Linux |
|---|---|---|
| Claude primer key store | `~/.claude/projects/-Users-fausto-Software-AgentTalk/session-primer-key.json` | `~/.claude/projects/`**`-home-fausto-Software-AgentTalk`**`/…` |
| Claude memory | `~/.claude/projects/-Users-fausto-Software-AgentTalk/memory/` | same slug change |

The slug is derived from the path, so **the new machine starts with an empty store**. Copy both across into the
**new** slug dir after the first Claude Code session creates it. If you skip this: the memory is lost, and every
role-primer reads as *fresh* on first contact — harmless (the agent reports and stops) but it re-triggers
cold-start gates you already spent.

---

## 7. ⚠️ Worktree discipline — mandatory, and it has a macOS path baked in

**Since 2026-07-16 all code development happens in a per-task git worktree — never in the primary checkout.**
This is a PO MANDATE and it is also the safety sandbox for autonomous agents. Docs and governance may still be
edited on master; **code may not.**

```bash
node scripts/wt-setup.mjs create <id> --base master     # → /private/tmp/att-<id>, branch task-<id>
node scripts/wt-setup.mjs remove <id>
```

**`scripts/wt-setup.mjs:22` hardcodes `DEFAULT_ROOT = '/private/tmp'` — a macOS path that does not exist on
Linux.** There is an override, and you must use it:

```bash
node scripts/wt-setup.mjs create <id> --base master --root /tmp
```

Consider making that the Linux default rather than remembering the flag every time; if you do, it is a one-line
code change and therefore needs a worktree and a gate like any other.

---

## 8. ⚠️ The invariant harness on Linux — a real gap, not a step

`scripts/infra-invariant.mjs` (BL-087, extended by BL-097) brackets every operator run: `snapshot` before,
`check` after, and **a `critical` finding GATES the next operator run until the PO clears it.** So its behaviour
on the new box is not cosmetic — it decides whether Hermes may run at all.

**What it shells out to:** `lsof` (install it, §2), `ps`, and **`launchctl`**.

**`launchctl` does not exist on Linux, and no systemd equivalent is implemented.** Trace the consequence, because
it is not obvious:

- `managedPids()` catches the failure and returns empty — it degrades, it does not crash. Good.
- But `classifyProcess()` grants **`LEGITIMATE` only** when the service registry knows the PID
  (`check-orchestrator-ports.mjs:85-87`). With no registry, **nothing can ever be LEGITIMATE on Linux.**
- The only other passing status is **`DECLARED`**, via `AGENTTALK_SWEEP_DECLARED`.
- Everything else is `UNKNOWN`, which **fails the sweep by design** ("an unclassifiable ⇒ report clean branch is
  the fail-open this check exists to remove").

**So on Linux you must declare the orchestrator's PID or port explicitly**, or the first operator run produces a
wall of findings:

```bash
export AGENTTALK_SWEEP_DECLARED="3500,3600"     # ports and/or PIDs, comma-separated
```

**Treat a wall of findings as a finding about the harness, not a reason to ignore it.** That is the O-1 rung's
explicit instruction, and it applies doubly here: the `att-op-*` allowlist and port 3600 were predictions made on
macOS about a seat that had barely run. **Implementing a systemd-backed `managedPids` is the clean fix** and is
worth filing before the operator is used in anger on Linux.

---

## 9. Hermes — the OPERATOR seat's prerequisites

Hermes is installed on the target machine, and the orchestrator already has endpoints wired to it. It needs a
**directory contract**, not just a binary:

| Path | Read by | Contents |
|---|---|---|
| `~/.hermes/heartbeat/last-response` | `GET /api/hermes/status` | unix seconds; `< 300s` old ⇒ `active`, else `idle` |
| `~/.hermes/heartbeat/status.json` | `GET /api/hermes/status` | `{ current_task, mode }` |
| `~/.hermes/heartbeat/tmux-sent-<agent>` · `tmux-recv-<agent>` | `GET /api/hermes/metrics` | integer counters per agent |
| `~/.hermes/heartbeat/tmux-last-send` | `GET /api/hermes/metrics` | JSON |
| `~/.hermes/logs/` | the launchd plist / systemd unit | orchestrator stdout+stderr |

```bash
mkdir -p ~/.hermes/heartbeat ~/.hermes/logs
```

Every read is `try`-wrapped and best-effort — missing files yield `idle`/zeroes, never a crash.

**Governance, unchanged and load-bearing:** Hermes holds **no role**, receives **no baton**, and **issues no
instruction**. `[Hermes]` is VOID as an authority tag. Its reports are **observations, not findings**, unverified
until checked against the artifact. Its write fence — `design/backlog.md` + `design/operator/**`, never
`autonomy: eligible` / `blocked_by` / `status: done` — is now **machine-checked** (BL-097). Full charter:
`AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS → 🔧 The OPERATOR seat`. Runbook:
`design/launch-and-monitor-runbook.md`.

**To actually enforce the fence on an operator run, pass an expect file:**

```bash
cat > /tmp/operator-expect.json <<'EOF'
{ "allowWritePaths": ["design/backlog.md", "design/operator/**"] }
EOF
node scripts/infra-invariant.mjs snapshot --out /tmp/before.json
# … the run …
node scripts/infra-invariant.mjs check --before /tmp/before.json --expect /tmp/operator-expect.json
```

Without `--expect` the fence is not applied and a lawful operator commit reads as two criticals. **Nothing forces
the flag yet** — that gap is recorded in BL-097's closing block.

---

## 10. launchd → systemd (only if you want auto-start)

The plist here (`com.fausto.agenttalk-orchestrator.plist`, in `~/Library/LaunchAgents/`) runs
`/usr/local/bin/node dist/index.js` from `apps/orchestrator` with `PORT=3741`, `AGENTTALK_MCP_PORT=54321`,
`KeepAlive`, logging to `~/.hermes/logs/`. **launchd does not exist on Linux.**

```ini
# ~/.config/systemd/user/agenttalk-orchestrator.service
[Unit]
Description=AgentTalk orchestrator
After=network.target

[Service]
WorkingDirectory=%h/Software/AgentTalk/apps/orchestrator
ExecStart=/usr/bin/env node dist/index.js
Environment=PORT=3741
Environment=AGENTTALK_MCP_PORT=54321
Restart=always
StandardOutput=append:%h/.hermes/logs/agenttalk-orchestrator.log
StandardError=append:%h/.hermes/logs/agenttalk-orchestrator.err.log

[Install]
WantedBy=default.target
```

```bash
mkdir -p ~/.hermes/logs
systemctl --user daemon-reload
systemctl --user enable --now agenttalk-orchestrator
```

**If you don't need auto-start, skip this** and run `npm run dev` by hand. Note this unit would also be the
natural source of a Linux `managedPids` implementation (§8) — `systemctl --user show -p MainPID`.

---

## 11. The usage meter (`:9899`) — external, safe to omit

`scripts/usage.mjs` polls `http://127.0.0.1:9899/{usage,tokens}`. **That service is not part of this repo** and
will not exist on the new machine unless you port it too. Everything reading it is **best-effort, never
blocking** (LB-11): a missing meter prints one line and work continues. The cost of omitting it is that the
standing resource-monitoring rule and the closure telemetry block lose their data source — write
`telemetry: unavailable` and carry on.

---

## 12. Build & run, in order

```bash
# --- AgentTalk ---
cd ~/Software/AgentTalk
npm install
npm run build
npx tsc -b                 # 0 errors. NOTE: since BL-095 this typechecks the TEST files too
npx vitest run             # expect 513 passed (76 files)
npm run backlog:check      # expect: ✓ backlog structure OK — 97 item(s), 0 warnings
npm run dev                # backend + web

# --- client ---
cd ~/Software/agentalk-mcp-client
npm install                # compiles node-pty — needs build-essential/python3/g++
npm run sync-contract      # realign wire-contract from ../AgentTalk
npm run build              # lint + verify-contract + vitest
```

**The wire-contract SHA-256 must match** — a mismatch rejects the client with `1008 Policy Violation` at the MCP
handshake.

---

## 13. Green baseline to reproduce (this machine, `04043a5`, 2026-07-28)

| Gate | Expected |
|---|---|
| `npx tsc -b` | exit 0, no output |
| `npx vitest run` | **513 passed (513)**, 76 files |
| `npm run backlog:check` | exit 0 · **97 items, 0 warnings** |
| `git status` | clean except the local plist |
| `git worktree list` | one entry, master only |
| ports 3500 / 3600 | free |

If the suite count differs, **read the active epic's ledger, not this file** — the number moves and this line
will rot.

---

## 14. Checklist

- [ ] Node 24 + npm via nvm; `git`
- [ ] `build-essential python3 make g++` **and `lsof`**
- [ ] Both repos cloned as **siblings**
- [ ] Claude Code installed and **logged in** (not via `ANTHROPIC_API_KEY`)
- [ ] `mkdir -p ~/.hermes/heartbeat ~/.hermes/logs`
- [ ] Claude key store + `memory/` copied into the **new path-slug** dir (§6)
- [ ] `--root /tmp` on every `wt-setup` invocation (§7)
- [ ] `AGENTTALK_SWEEP_DECLARED` exported before any operator run (§8)
- [ ] `npm install && npm run build && npx vitest run && npm run backlog:check` green in AgentTalk
- [ ] `npm run build` green in the client (contract hash matches)
- [ ] systemd unit only if you want auto-start
- [ ] **To file for Linux:** a systemd-backed `managedPids`, so the sweep can grant `LEGITIMATE` (§8)
