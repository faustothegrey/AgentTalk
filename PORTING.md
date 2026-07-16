# Porting AgentTalk to another machine (Linux)

> Written 2026-07-14 from the live macOS install as ground truth. This covers the **two coupled repos**, the
> runtime, external agent CLIs, all env vars / API keys, the untracked files git will NOT carry, and the
> macOS-specific arrangements (launchd, key-store paths) that must be re-created on Linux.

---

## 1. The two repos (keep them siblings!)

| Repo | Path on this machine | Role |
|------|----------------------|------|
| **AgentTalk** | `/Users/fausto/Software/AgentTalk` | Orchestrator monorepo (Node workspaces: `apps/orchestrator`, `apps/web`, `packages/*`) |
| **agentalk-mcp-client** | `/Users/fausto/Software/agentalk-mcp-client` | MCP attach-mode worker (pty drivers + `llm-agent.mjs` + goose executor) |

**⚠️ Path coupling.** The client resolves the wire contract at `../AgentTalk/packages/contracts/wire-contract.json`
by default. **Clone both under the same parent dir** (e.g. `~/Software/AgentTalk` and `~/Software/agentalk-mcp-client`),
or set `AGENTTALK_CONTRACT_PATH=/abs/path/to/wire-contract.json`.

```bash
mkdir -p ~/Software && cd ~/Software
git clone <AgentTalk remote>            # or copy the working tree
git clone <agentalk-mcp-client remote>
```

---

## 2. Runtime + system packages

| Requirement | This machine | Linux install |
|-------------|--------------|---------------|
| **Node.js** | v24.14.1 | `nvm install 24 && nvm use 24` (README says 18+, but current dev is on 24 — use 24) |
| **npm** | 11.11.0 | ships with Node 24 |
| **git** | — | `apt install git` |
| **Native build toolchain** | Xcode CLT | **required** — the client's `node-pty` compiles native code: `sudo apt install -y build-essential python3 make g++` |

TypeScript 6 and vitest are dev-dependencies (installed by `npm install`, no global install needed).

---

## 3. External agent CLIs (installed separately, must be on `PATH`)

These are **not** npm deps — they're the actual LLM agent binaries the orchestrator/client launch. Current locations here:

| CLI | Location here | Purpose | Linux notes |
|-----|---------------|---------|-------------|
| **goose** | `/usr/local/bin/goose` (v1.41.0, via brew) | vendor-neutral dev executor + arbiter path | `curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh \| bash` |
| **claude** | `~/.local/bin/claude` | Claude Code agent | official installer; logs in with its own account (not `ANTHROPIC_API_KEY`) |
| **codex** | `/usr/local/bin/codex` | OpenAI Codex CLI | npm/installer per OpenAI |
| **gemini** / **agy** | `/usr/local/bin/gemini`, `~/.local/bin/agy` | Gemini / Antigravity CLI | installer per Google |

**Degraded-team reality (per the current primer, 2026-07-13):** Codex is PO-ruled-out, **agy/Gemini hangs on the
attach healthcheck (LB-92)**, so day-to-day work runs on **Claude + goose (OpenRouter-backed)**. For a minimal
working port you need **goose + an `OPENROUTER_API_KEY`**; the arbiter/consensus path (TL-013) runs entirely on
that. Install codex/gemini only if you intend to revisit those seats.

Override the invoked commands per provider (client) with `CLAUDE_CMD`, `CODEX_CMD`, `GEMINI_CMD`,
`AGENTTALK_CLAUDE_INTERACTIVE_COMMAND`, `AGENTTALK_CLAUDE_PERSISTENT_COMMAND` if the binaries land at non-default paths.

---

## 4. Environment variables & API keys

Put the keys in `~/.bashrc` / `~/.zshrc` on the new box (they live in `~/.zshrc` here). **A restart / new shell is
required for Claude Code to inherit them.** Redacted names only — copy the real values from this machine's `~/.zshrc`.

### API keys (secrets — copy manually, NOT in git)
```bash
export OPENROUTER_API_KEY=...   # ESSENTIAL — goose models + arbiter Judge/Synthesizer
export OPENAI_API_KEY=...       # codex / gpt models
export GOOGLE_API_KEY=...
export GEMINI_API_KEY=...
# export ANTHROPIC_API_KEY=...  # commented out here — Claude Code uses its own login
# DEEPGRAM_API_KEY / ELEVENLABS_API_KEY / LLM_API_KEY / HERMES_API_KEY — present but not core (Hermes is retired)
```
**OpenRouter models that resolve on this account:** `openai/gpt-4o`, `openai/gpt-4o-mini`,
`deepseek/deepseek-v4-flash`, `deepseek/deepseek-chat`, `deepseek/deepseek-r1`.
`anthropic/claude-3.5-sonnet*` and `google/gemini-2.0-flash-001` **404** on this account — probe with a one-word
`goose run` before relying on a model id.

### App runtime toggles (set per-run, not global)
```bash
# Ports
PORT=3000                     # web/orchestrator (launchd here used 3741; isolated dev runs use 3001)
AGENTTALK_MCP_PORT=3011       # MCP server port for isolated runs

# Attach / MCP mode
AGENTTALK_ATTACH_MODE, AGENTTALK_PERSISTENT_MCP, AGENTTALK_PERSISTENT_MCP_URL
AGENTALK_MCP_CLIENT_DIR, AGENTTALK_MCP_CLIENT_CONTRACT_PATH

# Consensus wiring
PLANNER_A_PROVIDER, PLANNER_B_PROVIDER, WORKER_PROVIDER, MCP_GATE_PROVIDER

# goose executor (client)
AGENTTALK_GOOSE_MAX_TURNS, AGENTTALK_GOOSE_NO_PROFILE, AGENTTALK_GOOSE_SYSTEM
AGENTTALK_EXECUTION_MODE, AGENTTALK_WORKDIR

# Recording / debugging
AGENTTALK_RECORDING_PATH       # ndjson recording = ground truth for consensus runs (read this, not harness summaries)
AGENTTALK_METER                # override the usage meter base URL (default http://127.0.0.1:9899)
```

### Google Drive integration (optional)
`GOOGLE_DRIVE_CREDENTIALS_PATH`, `GOOGLE_DRIVE_TOKEN_PATH`, `GOOGLE_DRIVE_RESOURCE_STORE_PATH`,
`GOOGLE_DRIVE_REDIRECT_BASE_URL`. Needs `credentials.json` (below). OAuth redirect URI is pinned to
`http://localhost:3000/api/integrations/google-drive/oauth/callback` — keep the web app on **:3000** or re-register the URI.

---

## 5. Untracked files git will NOT carry — copy these manually

`.gitignore` excludes the following. Regenerate or copy each:

| Item | Action |
|------|--------|
| `node_modules/` (both repos) | regenerate: `npm install` |
| `dist/`, `*.tsbuildinfo` | regenerate: `npm run build` / `npx tsc -b` |
| **`credentials.json`** (root) | **copy manually** — Google OAuth client secret |
| `google-oauth-client.json`, `google-drive-token.json` | copy if present (Drive integration) |
| `transcripts/`, `planning_runs/`, `persistence/`, `/recordings/` | runtime data — copy only if you want history |
| `.claude/` | project-local Claude Code settings — copy if you want them |

### Per-agent primer key-stores + Claude memory (OUTSIDE the repo — the subtle one)
The primer handshake and Claude's memory live in per-agent private dirs **keyed by the repo's absolute path**:

| File | Path here |
|------|-----------|
| Claude key store | `~/.claude/projects/-Users-fausto-Software-AgentTalk/session-primer-key.json` |
| Claude memory | `~/.claude/projects/-Users-fausto-Software-AgentTalk/memory/` (`MEMORY.md` + fact files) |
| Codex key store | `~/.codex/agenttalk-session-primer-key.json` |
| Gemini key store | `~/.config/AgentTalk_Gemini/session-primer-key.json` |

**⚠️ The Claude project-slug `-Users-fausto-Software-AgentTalk` is derived from the absolute repo path.** On Linux
the home path changes (e.g. `/home/fausto/Software/AgentTalk` → slug `-home-fausto-Software-AgentTalk`), so these
files will land under a **different** project dir. To preserve primer-consume history and memory, copy the contents
into the **new** slug's directory after the first Claude Code session creates it (or after you know the new path).
Codex/Gemini stores use stable fixed paths (not path-derived) and copy verbatim.

---

## 6. macOS launchd → Linux systemd

This machine auto-starts the orchestrator via `com.fausto.agenttalk-orchestrator.plist`
(`~/Library/LaunchAgents/`): runs `node dist/index.js` from `apps/orchestrator`, `PORT=3741`, `KeepAlive`, logs to
`~/.hermes/logs/`. **launchd does not exist on Linux.** Replace with a systemd **user** unit:

```ini
# ~/.config/systemd/user/agenttalk-orchestrator.service
[Unit]
Description=AgentTalk orchestrator
After=network.target

[Service]
WorkingDirectory=%h/Software/AgentTalk/apps/orchestrator
ExecStart=/usr/bin/env node dist/index.js
Environment=PORT=3741
Restart=always
StandardOutput=append:%h/.agenttalk/logs/orchestrator.log
StandardError=append:%h/.agenttalk/logs/orchestrator.err.log

[Install]
WantedBy=default.target
```
```bash
mkdir -p ~/.agenttalk/logs
systemctl --user daemon-reload
systemctl --user enable --now agenttalk-orchestrator
```
Note the plist hardcodes `/usr/local/bin/node` and the `/Users/fausto/...` working dir and `~/.hermes/logs/` path —
all macOS-specific; the unit above uses `%h` (home) and `env node`. **If you don't need auto-start, skip this
entirely** and just run `npm run dev` manually.

---

## 7. The usage meter (`:9899`) — not in this repo

`scripts/usage.mjs` polls `http://127.0.0.1:9899/{usage,tokens}` for per-provider budget %. That endpoint is an
**out-of-band external service**, not part of AgentTalk, so it won't exist on the new machine unless you also port
it. Everything that reads it is **best-effort / never-blocking** (LB-11) — a missing meter just prints a one-line
notice. Safe to ignore for a functional port.

---

## 8. Build & run (do this on the new machine, in order)

```bash
# --- Main repo ---
cd ~/Software/AgentTalk
npm install
npm run build          # tsc -b + web build
npm test               # @agenttalk/contracts tests + vitest (confirms a clean baseline)
npm run dev            # backend orchestrator + frontend (web dev server on :5173)

# Isolated / non-clashing run (matches the primer's convention):
npx tsc -b
PORT=3001 AGENTTALK_MCP_PORT=3011 npm run backend

# --- Client repo ---
cd ~/Software/agentalk-mcp-client
npm install            # compiles node-pty (needs build-essential/python3/g++)
npm run sync-contract  # realign wire-contract from ../AgentTalk (or set AGENTTALK_CONTRACT_PATH)
npm run build          # lint + verify-contract + vitest
```

**Verify the port is good:** `npm test` green in AgentTalk, `npm run build` green in the client (the SHA-256
wire-contract hash must match — a mismatch rejects the client with `1008 Policy Violation` at MCP handshake), and a
`goose run` one-liner resolves an OpenRouter model.

---

## 9. Quick checklist

- [ ] Node 24 + npm via nvm
- [ ] `build-essential python3 make g++` (for node-pty)
- [ ] Both repos cloned as **siblings** under one parent
- [ ] `goose` installed + `OPENROUTER_API_KEY` exported (minimum viable set)
- [ ] Other CLIs (claude/codex/gemini) as needed; keys in `~/.bashrc`, **shell restarted**
- [ ] `credentials.json` + any Drive token copied (if using Drive)
- [ ] Per-agent key-stores + Claude `memory/` copied into the **new path-slug** dir
- [ ] `npm install` + `npm run build` + `npm test` green in both repos
- [ ] launchd plist re-created as a systemd user unit (only if you want auto-start)
