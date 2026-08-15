# Backlog — agent-runtime

Open items owned by the **agent-runtime** module. Closed items live in `90-closed.md`.

<!-- Split from design/backlog.md (Wave 1). -->
<!-- @item
id: BL-072
status: deferred
date: 2026-07-18
epic: null
tags: [agents, identity, trust, security, launcher, design-first]
-->
- [deferred · **DECISION TAKEN, MECHANISM DEFERRED (PO, 2026-07-18)** · reopen trigger below · sibling of [[BL-071]] (DONE)] — **Agents should be aware whether they are operating WITHIN AgentTalk — but that awareness cannot be independently verified, so decide deliberately what it's allowed to mean.** PO ask (2026-07-18): a team member should know it's running as part of an AgentTalk team (future behaviours may branch on it — e.g. coordinate, commit to a worktree, don't prompt interactively). The PO's own instinct — *"I think this can only be injected by the launcher and cannot be verified independently"* — is correct, with one important sharpening.

  **✅ DECISION (PO, 2026-07-18) — behaviour-tuning, NOT authorization; and defer the mechanism.**
  - **Behaviour-tuning is the meaning** (a self-reported context signal the agent reads), **not authorization.** The
    reframe that settled it: these are **not two versions of one feature** — they live in different places and do
    different jobs. Behaviour-tuning is a signal *to the agent* (agent-side); authorization is a check the
    *orchestrator* makes (server-side, and it already knows which agents it launched/accepted). So choosing the
    light option **costs nothing toward a future authorization**: authorization would never route through the
    agent's flag anyway. No corner is painted.
  - **DEFER the mechanism (chosen: option B).** BL-072 has **no consumer today** — nothing currently branches on
    "am I in a team." Building an `isWithinAgentTalk()` helper now would be infrastructure without a user (the
    mirror of the over-engineering we avoided in BL-071). From the **orchestrator's** side the awareness is already
    total (every agent that arrives via the protocol *is* within AgentTalk, and the registry knows it); the concept
    is only missing *inside the agent's own logic*, where nothing yet consults it. So record the decision, build
    nothing yet.
  - **Two guardrails that make "light" safe (must hold whenever this is eventually built):**
    1. **The flag is context, NEVER an authorization boundary.** The failure mode is always the same: someone later
       hangs a security decision on a spoofable agent-side flag. One doc line prevents it.
    2. **Prefer the OBSERVABLE over a bare env flag.** Ground "within AgentTalk" in the *live MCP connection to an
       orchestrator*, not in an env var — note `llm-agent.mjs:240` reads `AGENTTALK_PERSISTENT_MCP_URL` **with a
       `ws://localhost:3000/mcp` default**, so "the var is set" is NOT a clean signal; the live connection is.
  - **🔓 REOPEN TRIGGER:** the first time a real behaviour needs to branch on within-AgentTalk-ness (e.g. "don't
    prompt interactively when in a team", "always commit to the task worktree"). At that point build the **thin
    agent-side signal** grounded in the live connection (option A) — and if the need is *authorization*, build it
    **orchestrator-side**, never on the agent's word.

  **Two signals hide under one question; keep them apart:**
  1. **A static injected FLAG** (an env var such as `AGENTTALK_WITHIN=true`, or reading the already-injected `AGENTTALK_ORCHESTRATOR_URL` / `AGENTTALK_PERSISTENT_MCP_URL`). **NOT independently verifiable** — a standalone process can export the same var. **The agent takes it for granted.** That is acceptable *only* if it is treated as **self-reported context, never a security boundary.**
  2. **The LIVE PROTOCOL RELATIONSHIP** — "I hold an MCP socket to an orchestrator AND just completed an `await_turn` / `exec_rpc` turn." This **IS observable**: the agent actively participates in it, so the awareness can be **grounded in an observable** rather than merely granted (cf. `ENV=prod` string vs. actually holding a live prod-DB connection). **Prefer deriving awareness from this** where the code allows.

  **The one thing genuinely unverifiable:** whether the peer on the socket is *the real AgentTalk* vs. an impostor speaking the same protocol — an agent cannot authenticate the orchestrator from inside.

  **Load-bearing principle (the actual design constraint):** **never make an agent's self-belief an enforcement point.** If "within AgentTalk" is ever used for **authorization** ("only in-team agents may do X"), it MUST be enforced **server-side by the orchestrator** — which already knows which agents it launched/accepted — not by an agent trusting its own env var. If it's only used for **behaviour tuning**, a spoofable self-reported flag is adequate and "take it for granted" is the correct, cheap answer. **So the deliverable is first a decision — behaviour-tuning (flag OK) vs. authorization (orchestrator-enforced) — then the mechanism.**

  **Grounded facts (verified 2026-07-18):** the launcher already injects a rich `AGENTTALK_*` env set including `AGENTTALK_ORCHESTRATOR_URL` and `AGENTTALK_PERSISTENT_MCP_URL`, so a de-facto "within" signal partly exists as an injected value. **Source:** PO design discussion 2026-07-18; full write-up in that session's report.


*(add new items above this line)*
