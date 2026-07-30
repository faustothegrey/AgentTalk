# A bidirectional PO↔session channel over Hermes — feasibility and design

**Status: PROPOSAL, not adopted.** Nothing here is in force. **Author:** Claude (Architect seat), 2026-07-30, at
the PO's request. **Sibling of** `design/hmp-commission-plan.md` (which carries *commissions*; this carries
*instructions*).

> **The one-line answer.** Yes, and it is a much better bet than it was on 2026-07-02 — **the transport defects
> that killed it then are structurally solved now.** But transport was never the hard part. The hard part is that
> `[PO]` is this project's **apex authority**, and a channel that can mint it is a channel that can hand the
> project to whoever reaches a port.

---

## 1. This was tried, and it failed. What is different now.

**[[LB-49]], 2026-07-02:** Hermes held the SM function over an Agent Bus + tmux transport and was retired from
the process entirely. That is not a discouraging precedent — it is a **precise** one. All three measured defects
were about the *channel*, and each now has a structural replacement rather than a workaround:

| LB-49 defect | Why it was fatal | What replaces it |
|---|---|---|
| **1 — alternate screen** | Claude Code's TUI never pushes lines into tmux history (`history_size=0`), so `capture-pane` could only ever see the viewport. Long replies were **unrecoverable**. | The **live JSONL transcript** — LB-49 itself named this as the "lossless alternative, verified to exist, not yet adopted". Re-verified today: `~/.claude/projects/<slug>/<session>.jsonl`, written live (this session's file was 440 lines, mtime current). Structured, machine-readable, **zero tmux**. |
| **2 — capture is viewport-only** | `agentctl` ran `capture-pane -p` with no `-S`, discarding history it did have. | Moot — the transcript is not a screen. |
| **3 — Escape-before-send is DESTRUCTIVE** | `cmd_send` fired `send-keys Escape` before every message. In Claude Code, Esc **interrupts the in-flight turn**: a Hermes send racing a generation aborted the reply at its source. | The **`Monitor` primitive**. Its contract: each stdout line (or WebSocket frame) becomes an event delivered into the session's context, and *"events arrive on their own schedule and are not replies from the user, even if one lands while you're waiting for the user to answer a question."* **Nothing is injected into the TUI**, so there is nothing to interrupt. This is the defect that made the old design unfixable, and it is gone by construction. |

**The design-intent note in LB-49 still stands and now cuts the right way:** `agentctl`'s own docstring said tmux
sessions are *the user's workspaces* and screen-scraping replies "was never the designed return channel." Correct
— so stop scraping. Both directions now have designed channels.

## 2. The shape

Three legs. Only the middle one is new work.

```
   PO (phone, away from the desk)
     │  ① whatever Hermes platform the PO already uses
     ▼
   Hermes  ── peer70/84/106 ⇄ peer128 over HMP ──►  Hermes on the dev host (peer128, resident)
     │                                                        │
     │  ③ tails the JSONL transcript; relays back             │  ② writes design/operator/inbox/<ts>.md
     │     PushNotification for attention                     ▼
     └──────────────────────────────────  Claude session  ◄── Monitor (file watch → context event)
```

**② is the whole trick, and it needs no charter amendment.** Hermes's write fence is already
`design/backlog.md` + `design/operator/**` (charter amendment `7948ea4`, mechanised by [[BL-097]]'s
`expect.allowWritePaths`). **An inbox under `design/operator/inbox/` is already inside the allowlist** — so the
relay is a *use* of the existing fence, not an extension of it, and a lawful inbox write already produces `info`
rather than `critical`.

**Why a file and not a socket:** it is auditable by default. Every instruction the PO ever relayed is a committed
artifact with a timestamp, diffable, and readable months later. A socket leaves nothing behind. Given that the
entire authority question below turns on *"can we prove who said this"*, an append-only paper trail is not
overhead — it is the point.

**③ costs nothing new:** the transcript already exists and Hermes already has outbound platform slots
(`telegram`, `whatsapp`, `slack`, `teams`, `google_chat` are all configured in its YAML). `PushNotification` is
the in-harness path for pulling the PO's attention when something needs a decision.

## 3. The hard part — `[PO]` is apex, and this channel must not be able to mint it

**Origin Tag Protocol, Rule 1:** *"`[PO] do X` carries the same weight as if the human typed the instruction
directly. The agent **must** act on it within its role and scope."* Rule 2: *"No tag defaults to `[PO]`."*

**So consider what a forged `[PO]` buys an attacker.** Not a shell on one box — that is [[BL-107]], and it is
already bad. A forged `[PO]` buys **the authority to direct the development process**: set scope, order a merge,
reassign roles, mark a backlog item `autonomy: eligible`, dispose of a `critical`. Every mechanical fence this
project has built — the operator write fence, the selectable-set guard, verified-only mainline — is designed to
route those acts *through the PO*. A channel that impersonates the PO does not defeat one fence; it defeats the
thing all of them defer to.

**Therefore: [[BL-107]] stops being a sequencing preference and becomes a hard precondition.** I filed it earlier
today as "the PO's infrastructure, the PO's call on timing," which was right for a *commissioning* channel where
§4's repo anchor carries the authority. It is **not** right for an *instruction* channel. `allow_all_peers: true`
on `0.0.0.0` with no shared secret means any LAN host can compose an instruction; if instructions are binding, any
LAN host is the Product Owner.

### 3a. The fence: tier the channel by what it can EXPRESS

The project's own best pattern, from [[BL-093]]: **make it fail closed, and make the dangerous bit the one thing
the channel cannot say.** `autonomy: eligible` is authority in file form; an item that does not say it is eligible
is not eligible. Apply the same shape here.

**Introduce a tag that is not `[PO]`.** A relayed instruction wears **`[PO-RELAY]`** — binding *within a fence*,
never apex. `[PO]` keeps its current meaning exactly: **the human typed it, here, in this terminal.** That
preserves the protocol rather than diluting it, and it means a forged relay message cannot even *claim* apex
authority, because the tag that carries apex authority is not available over the wire.

| `[PO-RELAY]` MAY express | It may NEVER express |
|---|---|
| **status / report** — read-only, always safe | **merge**, **push** — reserved to the PO absolutely |
| **stop / halt / stand down** — fails safe | **scope, direction, epics** |
| **priority & sequencing** ("do BL-104 next") — SM-level operational | **role assign / reassign** |
| **an answer to a question the session already asked** | **`autonomy: eligible`** on any item |
| **a pointer to a committed artifact** (the §4 pattern) | **disposing of a `critical` finding** |

**The fourth row is the strongest primitive here, and it deserves naming.** When the session has already asked a
question with a defined option set, a relayed *answer* is **capability-bounded by construction**: a forger can
only pick among options the session itself offered. No authentication is required for that to be safe, because the
blast radius was fixed before the message existed. Much of remote steering is exactly this shape — *"option b",
"yes, proceed", "skip that one"* — so the safest primitive is also the most useful one.

The right-hand column is, deliberately, **almost exactly the operator write fence's ban list.** That is not a
coincidence to be tidied away: both channels are non-human paths into a human-authority process, so they earn the
same fence for the same reason.

### 3b. For anything consequential: anchor it in the repo, not the message

The mechanism I built today for commissions applies unchanged. A relayed instruction that genuinely needs
authority is **a pointer to a committed artifact**, and the artifact is what authorizes. Forging a message is
trivial; forging a commit requires write access to the governed repo and leaves an author and a diff. And per
today's live refutation: give the token **its own file**, never a line inside a human-authored document — a check
that reads prose for a machine-meaningful token is reading a channel that must also carry discussion of it.

## 4. Honest limits — read these before relying on it

- **It is not a kill switch, and must never be sold as one.** A wedged session reads nothing: `Monitor` events
  land in context, and a session that is not processing context does not see them. The idle timeout is dead code
  ([[BL-028]]), nothing detects a hung agent, and **`cap.wallClockMs` remains the only anti-hang rail**
  ([[BL-096]], still untested). "Stop" over the relay works exactly when the session is healthy enough not to
  need stopping.
- **Latency is one turn boundary.** An instruction arriving mid-tool-call is seen after it completes. Fine for
  steering; useless for interruption — see above.
- **The channel exists only while a session is up and has armed the `Monitor`.** It is session-scoped, not
  infrastructure. An instruction relayed to a closed session sits in the inbox until someone reads it — which the
  file-based design at least makes visible rather than silent.
- **The verb fence is behavioural, not enforced.** Nothing stops the receiving agent acting on a `[PO-RELAY]`
  message that asks for a merge except the agent observing the fence — the same honest limit as the operator write
  fence before [[BL-097]] mechanised it, and the same one the commission fence still carries. Mechanising it
  (a linter over the inbox, refusing banned verbs) is a follow-up, not a precondition — but it should be *named*
  as owed, because "behavioural" has a way of becoming permanent.
- **Hermes is a courier, not an author — and its retirement still stands.** Relaying the PO's instruction is not
  *issuing* one, so this sits inside the 2026-07-27 OPERATOR charter rather than reopening the 2026-07-02
  retirement. But note the sharper reason `[Hermes]` is VOID: *an operator must never instruct.* A courier that
  can be impersonated instructs in effect, which is why §3a puts the fence on the **message's expressible verbs**
  rather than on trusting the courier.

## 5. What it would take

| Step | Work | Blocked on |
|---|---|---|
| 0 | **Decide the authority model** — adopt `[PO-RELAY]` (or reject the whole idea) | **PO** |
| 1 | **[[BL-107]]** — authenticate HMP | **PO** (cluster-wide; `peer70` must be reachable) |
| 2 | Inbox convention + a `Monitor` recipe the session arms at start | small; inside the existing write fence |
| 3 | Hermes-side relay: write inbound to the inbox, tail the JSONL for replies | Hermes config, PO's install |
| 4 | Mechanise the verb fence | follow-up, explicitly owed |

**Cheapest honest first step, if the PO wants to feel it before committing:** steps 2+3 for **read-only verbs
only** — `status` and `report`. No authentication needed, because a forged "report status" costs nothing, and it
exercises every leg of the transport end to end. That is the same laddered instinct as O-1: prove the channel with
a message that cannot do harm, and find out whether the harness's predictions about it were right.
