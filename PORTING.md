# Porting AgentTalk to another machine (Linux · Claude + Hermes)

> **✅ THE MOVE IS DONE, AND THIS DOCUMENT IS NOW A POST-MORTEM, NOT A PLAN.**
> **Second pass 2026-07-28** by Claude, verified **on the Linux box itself** during a PO-directed deployment
> validation — a full build, both gates, an orchestrator boot, and a **real end-to-end MCP session** (§15).
> The first pass, earlier the same day, was verified against the **macOS** install at `04043a5` and predicted
> this environment. **It got four things wrong**, each corrected in place below and listed in §0b.
>
> **Read §0b, §7, §8 and §15 before anything else.** §0b is what the first pass got wrong; §8 is a real gap
> that is *worse than it says*; §15 is the proof the stack actually runs here, and the one repair it needed.

---

## 0. What changed since the 2026-07-14 version — corrections, verified

| Was written | Ground truth today | § |
|---|---|---|
| *"`AGENTTALK_PERSISTENT_MCP`"* listed as a runtime toggle | **The flag is DELETED** (BL-057, client `3403bdb`, 2026-07-16). **Set nothing.** The live-proven path is the only path. Some `scripts/*.mjs` here still export it — dead leftovers, no-ops. **`AGENTTALK_PERSISTENT_MCP_URL` is a different var and still live.** | §4 |
| *"agy/Gemini hangs on the attach healthcheck (LB-92)"* | **The UNFIT park was LIFTED 2026-07-16** on PO-witnessed live evidence. | §3 |
| *"Codex is PO-ruled-out"* | **The PO declared Codex AND agy UNAVAILABLE on 2026-07-15**, until further notice. **Claude is the sole available agent**, under the resource-scarcity fallback. | §3 |
| *"Hermes is retired"* | **Hermes holds the OPERATOR seat since 2026-07-27.** Its retirement from *workflow participation* stands (no baton, no verdict, no instruction), but it now launches and monitors sessions — and writes to the backlog within a fence. | §9 |

**Also new since that version, and absent from it entirely:** the **mandatory per-task worktree** discipline
(§7), the **infrastructure invariant harness** that gates operator runs (§8), and the `backlog:check` gate (§12).

---

## 0b. What the FIRST Linux pass got wrong — corrected by running, 2026-07-28

The pass earlier today was careful and still wrong in four checkable ways, because it reasoned about Linux from
macOS. Every row below was then observed on the box. **This is the section to trust when it disagrees with
prose elsewhere in this file.**

| First pass said | What actually happens on this box | § |
|---|---|---|
| agent stack is *"Claude + Hermes only"*; codex and agy *"⬜ no"* | **`codex` and `agy` are both installed and on `PATH`.** This does **not** make them available — availability is a PO role call, and they remain PO-declared UNAVAILABLE — but the *inventory* was wrong. **`goose` is genuinely absent.** | §3 |
| the usage meter *"will not exist on the new machine"*, write `telemetry: unavailable` | **It exists and works.** A `python3` service is listening on `:9899` and `node scripts/usage.mjs` returns real figures. Do **not** pre-emptively write `telemetry: unavailable`; poll it. | §11 |
| `--root /tmp` is needed for `wt-setup create` | **`remove` needs it too.** Following §7's example literally kills the tool with an unhandled stack trace. It is a *doc* gap, not a code defect — `remove` accepts `--root` fine. | §7 |
| green baseline *"513 passed"* | **512/513 on Linux.** The single red is a genuine Linux portability defect, [[BL-099]], not flake. | §13 |

**And one thing it could not have known, because nobody had run it here:** §8's harness gap is **confirmed
exactly as predicted** for `infra-invariant.mjs` — *and a second, worse defect sits next to it* in the sibling
script that the escape valve cannot rescue. See §8.

---

## 1. The two repos (keep them siblings!)

| Repo | Path (Linux, current) | Role |
|---|---|---|
| **AgentTalk** | `/home/fausto/Software/AgentTalk` | Orchestrator monorepo (npm workspaces: `apps/orchestrator`, `apps/web`, `packages/*`) |
| **agentalk-mcp-client** | `/home/fausto/Software/agentalk-mcp-client` | MCP attach-mode worker (pty drivers + `llm-agent.mjs` + goose executor) |

*(Both were `/Users/fausto/Software/…` on macOS. The slug change matters for Claude's key store — §6.)*

> **⚠️ Keep the client in sync, and check it — this is what actually broke the first Linux run.** The two repos
> are versioned separately and a stale client is **silent** until the MCP handshake rejects it. See §15.

**⚠️ Path coupling.** The client resolves the wire contract at `../AgentTalk/packages/contracts/wire-contract.json`
by default. **Clone both under one parent**, or set `AGENTTALK_CONTRACT_PATH=/abs/path/to/wire-contract.json`.

```bash
mkdir -p ~/Software && cd ~/Software
git clone git@github.com:faustothegrey/AgentTalk.git
git clone <agentalk-mcp-client remote>
```

---

## 2. Runtime + system packages

| Requirement | Was on macOS | **Installed here now** | Notes |
|---|---|---|---|
| **Node.js** | v24.14.1 | **v24.15.0** ✅ | via nvm (`~/.nvm/versions/node/v24.15.0`). README says 18+; dev is on 24 — **use 24** |
| **npm** | 11.11.0 | **11.12.1** ✅ | ships with Node 24 |
| **git** | 2.33.0 | **2.34.1** ✅ | `apt install git` |
| **Native toolchain** | Xcode CLT | ✅ present | the client's `node-pty` compiles native code: `sudo apt install -y build-essential python3 make g++` |
| **`lsof`** | system | **4.93.2** ✅ | `sudo apt install -y lsof`. **Do not skip it** — §8's harness and the runbook pre-flight both shell out to it, *and* its Linux output format is the cause of [[BL-099]] |
| **`ps`** | system | ✅ present | present everywhere |
| shell | zsh | **bash** | env exports go in `~/.bashrc`, not `~/.zshrc` (§4) |

TypeScript and vitest are dev-dependencies — `npm install` covers them, nothing global.
`node_modules` here is a genuine Linux install (`@esbuild/linux-x64`, `@rollup/rollup-linux-x64-gnu`) — **never
copy `node_modules` across platforms**, it carries native binaries.

---

## 3. Agents

**Only two are needed for the declared stack — but four are actually installed. Those are different things.**

> **Installed ≠ available.** Availability is a **PO role call**, recorded in `AGENT.md → 📌 DEFAULT ROLE
> ASSIGNMENTS`, and a binary sitting on `PATH` does not change it. The first Linux pass listed codex and agy as
> *absent*; that was an inventory error, and it is corrected below **without** implying they may be used.

| Agent | Needed | **On PATH here** | Notes |
|---|---|---|---|
| **claude** (Claude Code) | ✅ **yes** | ✅ `2.1.220` | Logs in with its own account — **not** `ANTHROPIC_API_KEY`. The sole **available** agent (PO, 2026-07-15), so it wears every seat under the resource-scarcity fallback. |
| **Hermes** | ✅ **yes** | ✅ `~/.local/bin/hermes` | The OPERATOR seat. Prerequisites in **§9** — it needs a directory contract, not just a binary. ⚠️ `~/.hermes/heartbeat` is **not yet created** here. |
| codex · gemini/agy | ⬜ no | ⚠️ **both installed** | **PO-declared UNAVAILABLE (2026-07-15) — do not route work to them.** Present on `PATH` (`codex` under nvm, `agy` in `~/.local/bin`), so a config naming them will *launch* rather than fail fast. That is a trap, not a capability. |
| goose | ⬜ optional | ❌ absent | Only for the arbiter/consensus path (TL-013) or dev-executor runs. Needs `OPENROUTER_API_KEY`. Skip unless you want it. |

Per-provider command overrides, if binaries land off-PATH: `CLAUDE_CMD`,
`AGENTTALK_CLAUDE_INTERACTIVE_COMMAND`, `AGENTTALK_CLAUDE_PERSISTENT_COMMAND` (and `CODEX_CMD` / `GEMINI_CMD`).

---

## 4. Environment variables & keys

For **Claude + Hermes only, no API key is strictly required.** Claude Code authenticates with its own login. The
block below is the full inventory for completeness — the old macOS box kept these in `~/.zshrc`; **this box runs
bash, so they belong in `~/.bashrc`.** **A new shell (or restart) is required before Claude Code inherits them.**

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
| **3741** | the **auto-started** orchestrator (`AGENTTALK_MCP_PORT=54321`) | the launchd plist → **the systemd unit on Linux (§10; none installed here yet)** |
| **3000** | web app (pinned by the Drive OAuth redirect) | `PORT` |
| **5173** | vite dev server | `npm run dev` |
| **9899** | the usage meter — **external, not in this repo** | ✅ **running here**, see §11 |

The charter's *"its own port 3600, never the orchestrator's 3500"* is a containment rule for the operator seat.
Keep it on the new box.

**Note the orchestrator's own default is neither of these: `PORT` unset ⇒ 3100** (`apps/orchestrator/src/index.ts:36`,
deliberately off 3000 — BL-060). The **MCP WebSocket port is separate and random unless you set
`AGENTTALK_MCP_PORT`** — a boot with `PORT=3500` logged `ws://localhost:32885/`. Verified 2026-07-28: both
3500 and 3600 were free, and 3500 released cleanly after the §15 run.

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

| File | Was (macOS) | **Now (Linux)** |
|---|---|---|
| Claude primer key store | `~/.claude/projects/-Users-fausto-Software-AgentTalk/session-primer-key.json` | `~/.claude/projects/`**`-home-fausto-Software-AgentTalk`**`/…` ✅ present |
| Claude memory | `~/.claude/projects/-Users-fausto-Software-AgentTalk/memory/` | same slug change ✅ present |

The slug is derived from the path, so **the new machine starts with an empty store** unless you copy them.
If you skip this: the memory is lost, and every role-primer reads as *fresh* on first contact — harmless (the
agent reports and stops) but it re-triggers cold-start gates you already spent.

**✅ Done here — and it changed the advice the first pass gave.** Both were carried across with `consumed`
intact, so the predicted "empty store ⇒ several primers read fresh at once" artefact **did not occur**: exactly
one primer (planner) read fresh, which is a real hand-off rather than an artefact. The implementer primer's key
had been pre-emptively retired to `none` in anticipation of the empty store; with the store carried over that
retirement was unnecessary, though harmless. **If you do copy the store, you do not need to retire keys.**

---

## 7. ⚠️ Worktree discipline — mandatory, and it has a macOS path baked in

**Since 2026-07-16 all code development happens in a per-task git worktree — never in the primary checkout.**
This is a PO MANDATE and it is also the safety sandbox for autonomous agents. Docs and governance may still be
edited on master; **code may not.**

**`scripts/wt-setup.mjs:22` hardcodes `DEFAULT_ROOT = '/private/tmp'` — a macOS path that does not exist on
Linux.** There is an override, and **every invocation needs it — `remove` as much as `create`:**

```bash
node scripts/wt-setup.mjs create <id> --base master --root /tmp   # → /tmp/att-<id>, branch task-<id>
node scripts/wt-setup.mjs remove <id> --root /tmp [--delete-branch]
```

> **⚠️ The `remove` line is the one that bites, and the first Linux pass got it wrong.** It documented
> `remove <id>` with no `--root`. Run that here and the tool resolves `/private/tmp/att-<id>`, git says
> `fatal: '…' is not a working tree`, and `execFileSync` throws an **unhandled stack trace** —
> which reads like a code defect and is not one. `remove` accepts `--root` perfectly well
> (`wt-setup.mjs:139`); only the doc was short. **Verified: with `--root /tmp` it removes cleanly.**
>
> The rough edge that *is* real: the failure surfaces as a raw Node stack rather than a one-line error.

Making `DEFAULT_ROOT` platform-derived (`os.tmpdir()`) would delete the flag from the workflow entirely instead
of documenting it in two places. That is a **code** change — worktree and gate like any other. Filed as part of
[[BL-100]]; do not smuggle it into a doc edit.

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

### ✅ Confirmed live, 2026-07-28 — and the escape valve is narrower than the paragraph above admits

All of the above **was run on this box** and is exactly right for `infra-invariant.mjs`. Against a real
orchestrator (`PORT=3500 node apps/orchestrator/dist/index.js`, pid 90205):

```
$ node scripts/infra-invariant.mjs check --before before.json ; echo $?
WARNING: could not read the service registry (launchctl list).
[CRITICAL] 1
  · process-appeared: UNKNOWN: pid 90205 | ports 3500 | no positive evidence …
1
```

Predicted warning, predicted `UNKNOWN`, predicted `critical`, exit 1. **The operator gate works here.**

**But its sibling does not, and that is [[BL-099]] — read this before you trust a clean sweep.** Run standalone
**at the same moment against the same pid**, `check-orchestrator-ports.mjs` printed *"No orchestrator-ish node
processes are listening"* and exited **0**. Cause: it keeps only `lsof` rows whose line `startsWith('node')`
(`:135`), and **on Linux `lsof`'s COMMAND column is the *thread* name** — for Node that is `MainThread`,
truncated to `MainThrea`. Every Node process is dropped.

|  | sees the orchestrator? | exit |
|---|---|---|
| `infra-invariant.mjs check` | ✅ yes — 1 CRITICAL | `1` |
| `check-orchestrator-ports.mjs` | ❌ **no — reports clean** | `0` |

Two consumers of one `lsof` call, opposite verdicts: `infra-invariant` applies **no** command-name filter and
classifies on `ps` output and cwd instead.

**The consequence for this section: `AGENTTALK_SWEEP_DECLARED` cannot rescue the standalone sweep.** Declaring a
port only helps a process that was *enumerated*, and there none ever is — so a process that is never seen is
never classified, can never be `UNKNOWN`, and can never fail. It is also the suite's only Linux red (§13).
**Do not read a clean `check-orchestrator-ports` run on Linux as evidence of anything until BL-099 lands.**

**Treat a wall of findings as a finding about the harness, not a reason to ignore it** — and treat a *suspiciously
quiet* one the same way. That is the O-1 rung's instruction, and this section is now a worked example of both
halves. **Implementing a systemd-backed `managedPids` is the clean fix** for the `LEGITIMATE` gap — [[BL-098]],
whose prediction is confirmed above; §10's unit is the natural source.

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

## 11. The usage meter (`:9899`) — external, and ✅ **it is running here**

`scripts/usage.mjs` polls `http://127.0.0.1:9899/{usage,tokens}`. **That service is not part of this repo** —
but it **was ported, it is up, and it works.** Verified 2026-07-28: a `python3` process listening on `:9899`,
and `node scripts/usage.mjs` returning real figures (claude weekly 37% / session 35%, with reset times).

> **⚠️ Correction to the first Linux pass**, which said the meter *"will not exist on the new machine"* and told
> the next agent to write `telemetry: unavailable`. **That is wrong here — poll it.** Writing `unavailable`
> without looking would put a false reading into a closure telemetry block, which is worse than no reading.

Everything reading it stays **best-effort, never blocking** (LB-11), and the per-provider blocks are still
jittery — `codex` currently returns `ok:false`, and the `claude` block intermittently does too. **A failed read
is not a blocker**: note it in one line and carry on. Only write `telemetry: unavailable` for a field you
actually tried to read and could not.

---

## 12. Build & run, in order

```bash
# --- AgentTalk ---
cd ~/Software/AgentTalk
git fetch && git status          # ⚠️ FIRST. Both repos. See §15 — a stale checkout is silent
npm install
npm run build
npx tsc -b                 # 0 errors. NOTE: since BL-095 this typechecks the TEST files too
npx vitest run             # Linux: 512/513, 76 files — the one red is BL-099 (§8). macOS: 513/513
npm run backlog:check      # expect: ✓ backlog structure OK — 100 item(s), 0 warnings
npm run dev                # backend + web

# --- client ---
cd ~/Software/agentalk-mcp-client
git fetch && git log --oneline HEAD..origin/master   # ⚠️ MUST be empty — see §15
npm install                # compiles node-pty — needs build-essential/python3/g++
npm run sync-contract      # realign wire-contract from ../AgentTalk
npm run build              # lint + verify-contract + vitest  → expect 93/93
```

**The wire-contract SHA-256 must match** — a mismatch rejects the client with `1008 Policy Violation` at the MCP
handshake. **This is not hypothetical: it is exactly what was wrong here.** §15.

---

## 13. Green baseline to reproduce — **Linux**, `0ffd71d`, 2026-07-28

**Platform matters for one row.** Taken on the Linux box during the §15 validation; the macOS figure is kept
alongside because the difference *is* the finding.

| Gate | Expected on **Linux** | macOS was |
|---|---|---|
| `npx tsc -b` | exit 0, no output | same |
| `npx vitest run` | ⚠️ **512 passed, 1 failed (513)**, 76 files | **513/513** |
| ↳ the one red | `check-orchestrator-ports.test.mjs:172` — **[[BL-099]]**, a real portability defect, **not flake** | n/a |
| `npm run build` | clean (tsc + vite, ~1532 modules) | same |
| `npm run backlog:check` | exit 0 · **100 items, 0 warnings** | 97 items |
| client `npm run build` | **93/93**, contract hash matches | same |
| `git status` | clean (the plist is committed and unmodified here) | clean except the local plist |
| `git worktree list` | one entry, master only | same |
| ports 3500 / 3600 | free | same |

**Do not "fix" the red by touching the test.** It is the one e2e bar that reaches the I/O function the pure
tests deliberately avoid, and it is reporting a true defect. It goes green when BL-099 does.

If the suite *count* differs, **read the active epic's ledger, not this file** — the number moves and this line
will rot. The **pass/fail split** above is a different claim, and it holds until BL-099 lands.

---

## 14. Checklist — ✅ = verified done on this box, 2026-07-28

- [x] Node 24 + npm via nvm; `git` — v24.15.0 / 11.12.1 / 2.34.1
- [x] `build-essential python3 make g++` **and `lsof`** — lsof 4.93.2
- [x] Both repos cloned as **siblings** under `/home/fausto/Software`
- [x] Claude Code installed and **logged in** (not via `ANTHROPIC_API_KEY`) — 2.1.220
- [x] Claude key store + `memory/` present in the **new path-slug** dir (§6) — carried across, `consumed` intact
- [x] **Both repos fetched and compared against `origin/master`** (§15) — the client was 34 commits behind
- [x] `npm install && npm run build && npm run backlog:check` green in AgentTalk
- [x] `npx vitest run` — **512/513**, the one red being BL-099 (§13)
- [x] `npm run build` green in the client — 93/93, contract **v8**, hash matches
- [x] `--root /tmp` on `wt-setup` **create *and* remove** (§7)
- [x] **End-to-end MCP session proven** — a real claude worker attached, worked, and reported (§15)
- [ ] `mkdir -p ~/.hermes/heartbeat ~/.hermes/logs` — ⚠️ **`logs/` exists, `heartbeat/` does NOT.** Hermes's
      status/metrics endpoints degrade to `idle`/zeroes until this exists (§9)
- [ ] `AGENTTALK_SWEEP_DECLARED` exported before any operator run (§8) — **and note it cannot rescue the
      standalone sweep until [[BL-099]] lands**
- [ ] systemd unit only if you want auto-start — none installed here (§10)
- [ ] **Open for Linux:** [[BL-099]] (the blind sweep — do this first), [[BL-098]] (systemd-backed
      `managedPids`), [[BL-100]] (client lockfile drift + `os.tmpdir()` default)

---

## 15. The validation run — what actually happened, and the one repair it needed

**PO-directed, 2026-07-28.** The point of this section is that the stack is not merely *installed* here; it has
been **run end to end**, and the record of what broke is more useful than the record of what worked.

### The repair: the client was 34 commits behind, and it failed silently

`agentalk-mcp-client` sat at `1800dc4` while `origin/master` was `c7a5991`. Nothing announced this. The
consequence was buried one level down:

| | version | tools |
|---|---|---|
| orchestrator (`packages/contracts/wire-contract.json`) | **v8** | 10, incl. `report_environment` |
| client (stale copy) | **v7** | 9 — no `report_environment` |

**A v7 client is rejected at the MCP handshake with `1008 Policy Violation`.** So the attach path — the core of
AgentTalk — could not have worked at all, and the failure would have surfaced as an opaque socket close rather
than "your checkout is old". Fixed by a clean fast-forward (no local commits), then `npm install` +
`npm run build` → 93/93, contract v8, hash `8df95931…` matching.

**Generalise this, because the next machine will hit it too:** the repos are versioned separately, the contract
is the coupling, and a stale client is **quiet** right up until the handshake. `git fetch` **both** repos and
compare against `origin/master` before concluding anything about a failed attach.

### The run

One `claude` worker, `executionMode: persistent`, workdir a purpose-made worktree (`/tmp/att-dv-01`, created
with `--root /tmp`), governance inheriting correctly (`CLAUDE.md -> AGENT.md` present in the worktree). Goal
was deliberately **read-only** — the O-1 shape — so the loop could be proven with zero write risk:

> *"Report this repository's current HEAD commit hash (short form) and how many test files the vitest suite
> contains. Change no files."*

**Result: `completed` in 37 seconds**, launcher exit 0, and — the part that matters — **the artifact checked
out.** The worker reported HEAD `0ffd71d` on branch `task-dv-01` and 76 test files; both were re-verified
independently, as was its claim that nothing changed. It also volunteered, unprompted, that it had only
*collected* the file list rather than running the suite, so 76 was "a file count, not a pass/fail result".

**Grade the artifact, not the status field.** `completed` has never meant the work was done here — that is the
[[BL-053]]/[[BL-059]] lesson, where a rigorous check at the *wrong path* manufactured a defect that never
existed. For `claude` on the persistent path the worker's cwd is **session-level**, so its work lands in the
assigned `workdir` — **not** the nested `agentalk-task-*` worktree that appears inside it.

### Teardown

Clean, and worth recording because a previous op-note warned it might not be: **no leaked orchestrator.**
`npm run backend`'s child was reaped, port 3500 released, both task worktrees and branches removed, `/tmp` free
of `att-*`. That is BL-081's whole-tree instance teardown doing its job — which arrived in the same 34 commits
the client was missing.
