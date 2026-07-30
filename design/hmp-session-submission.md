# Commissioning an AgentTalk operator run over HMP — design proposal

**Status: PROPOSAL, not adopted.** Nothing here is in force. It requires the PO decisions in §8, and two
prerequisites in §1 that may invalidate the whole idea.
**Author:** Claude (Architect seat), 2026-07-30, at the PO's request.
**Subject:** using **HMP** (Hermes Message Protocol — HTTP+JSON on `:18643`) as the channel by which an
AgentTalk operator run is *commissioned*.

> **The one-line shape.** HMP carries the **commission**, never the **result**. A launch-class message is a
> **pointer to a committed brief plus a hash**, ~300 bytes; the run's evidence stays where it already lives —
> the run artifact and the grading doc — and is read from there, not streamed back over the wire.

---

## 1. Two prerequisites that come before any format

**These are not details. If either resolves the wrong way, this design is moot.**

**1a. Where does the operator process run?** Launching a session requires the two repos, Node, and a provider
CLI on `PATH`. `peer138` (RPi3B, Hermes Agent) can carry a message but cannot run a session. **So HMP is a
control channel to a Hermes process resident on the development host** — not a way to offload a run to a Pi.
If the operator is not resident here, a launch-class message reduces to "ask a Pi to ask this machine", and the
hop buys nothing. **Unresolved.**

**1b. Who may commission a run?** Every rung to date (H-L1…H-L3) was commissioned by the **PO**. Deciding what
gets launched is scope, and scope is not the operator's — nor is it the sender's to assume. **A launch-class
message is only valid if it carries PO authorization that the receiver can verify** (§4). **Unresolved: does
the PO authorize per run, or write a standing grant with its own fence?**

## 2. Why the 2048-character limit is a feature

`AGENT.md` already requires that a **baton is a pointer, not a transcript** — a pre-chewed brief invites the
receiver to follow the summary instead of the source of truth, and a baton that drifts from its own source is
worse than none. HMP's text ceiling enforces that mechanically: a real brief *cannot* fit, so it must be
referenced. The protocol's constraint and the project's discipline point the same way, which is why this design
does not fight the limit or reach for Base64 chunking.

Corollary: **do not put the goal text in the message.** The goal lives in the committed brief, where it is
reviewable, diffable, and hashable.

## 3. The launch-class message

A single line in `payload.text`, `key=value` pairs separated by ` | `, opening with a literal discriminator.
Roughly 300 bytes — comfortably inside the 500-byte "fast reply" band.

```
AGENTTALK-RUN
 | run=H-L4
 | brief=/home/fausto/Software/AgentTalk/design/operator/hl4-brief.md
 | repo-sha=<40-hex commit sha the brief is committed at>
 | bar-sha256=<64-hex of the pre-registered bar file>
 | port=3600
 | sandbox=att-op-h4
```

| Field | Why it is present |
|---|---|
| `AGENTTALK-RUN` | Discriminates **launch-class** from ordinary chat. A receiver applies §4 only to these. |
| `run` | The rung id — ties message, brief, bar, artifact and grading together. |
| `brief` | Absolute path. The commission itself, on auditable ground. |
| `repo-sha` | The commit the brief is committed at. **This is the authorization anchor** (§4). |
| `bar-sha256` | Pre-registered bar hash, carried *in the commission* so it cannot be retuned after results. |
| `port` / `sandbox` | The charter's containment parameters, restated so the receiver can refuse a mismatch. |

**Idempotency** is HMP's `message_id`, unchanged — the same id must never launch twice. A re-POST of an
already-seen id returns the existing status, never a second run.

## 4. Authorization — anchored in the repo, not in the message

**HMP is unauthenticated. A `from` field is self-asserted and an `authorized-by: PO` string in the payload
would be a claim, not a control — trivially forgeable by any host on the LAN.** An allowlist of `from` peers is
a speed bump worth having, but it must not be mistaken for the control.

**The control is that authorization lives in a committed artifact.** On a launch-class message the receiver
MUST, before doing anything else:

1. Resolve `brief` and confirm the file exists **and is committed** at `repo-sha`.
2. Confirm the brief contains an explicit **`[PO]` authorization line** for this `run` id.
3. Recompute the bar file's SHA-256 and confirm it equals `bar-sha256`.
4. Confirm `port` and `sandbox` match the charter (`3600`, `att-op-*`).

Any failure ⇒ **refuse**, with the reason in `response_text`. Never "launch anyway and mention it".

**Why this is stronger than a token:** forging a message is trivial; forging a commit in the governed repo
requires write access to that repo, and leaves an audit trail with an author and a diff. The threat model
becomes "who can commit", which is a question the project already answers, rather than "who can reach a port".

## 5. What the receiver must still do — the charter does not relax over the wire

A remote commission changes the *channel*, not the *fences*. Before launching, the operator still:

- prints and satisfies the **pre-flight checklist**;
- takes the **harness snapshot** (`scripts/infra-invariant.mjs snapshot`), and runs `check` after;
- launches into an **`att-op-*` worktree on port 3600**, never 3500;
- ensures **`cap.meter` is configured** — mandatory, because the operator's worker draws on the same provider
  pool as the supervising session;
- and **refuses if an uncleared `critical` finding is outstanding.**

**That last one is the point of failure worth naming loudly.** A `critical` from the harness **gates the next
operator run**, and only the PO may dispose of it. If a launch-class message could bypass that, HMP would become
a path *around* the gate rather than a path *to* it. **The gate must be enforced at the receiving end**, and a
refusal for this reason must say so explicitly: `refused: uncleared critical from run <id>`.

**Recursion fence.** The charter states an operator's goal is never "launch a session." Over a network that stops
being theoretical, so: a brief referenced by a launch-class message MUST NOT itself commission a run, and the
receiver refuses if the goal contains a launch instruction.

## 6. Lifecycle — HMP carries the commission, not the result

```
POST /hmp/send        →  accepted, queued
  status: working     →  receiver is verifying §4 and running pre-flight
  status: completed   →  response_text = ACK + pre-flight result + artifact path
                          NOT the run's outcome
```

A run takes minutes to tens of minutes; HMP's practical timeout is 120–300s. **Do not attempt to hold a
connection open for a run, and do not stream progress over HMP.** The response to a launch-class message is an
**acknowledgement**, and it should carry exactly three things: accepted-or-refused, the pre-flight/snapshot
result, and the absolute path of the run artifact (`instance.recording`).

The **result** is read from the artifact and graded, by a reviewer seat, exactly as today. An optional
completion *notification* is a convenience and nothing more.

## 7. `completed` is not a verdict — and this protocol says so twice

HMP's own guidance already states it: *"Notificato ≠ Allineato — ricevere un messaggio non significa che il peer
abbia eseguito l'azione."* That is the same law this project runs on: **`completed` has never meant the work was
done.**

This is not abstract. **Today, 2026-07-30**, BL-102's baseline run reported `status: completed` while the
worktree it had been assigned sat **empty** — the work was in a different directory entirely. And the twice-made
mistake behind [[BL-053]]/[[BL-059]] was checking the artifact *at the wrong coordinates*, which manufactured
false confidence and a defect that never existed.

So, as a rule of this design: **an HMP `completed` means the message was answered. It is evidence about the
channel, never about the run.** Grade the artifact, at the coordinates where the process actually stood.

## 8. Decisions required before this is adopted

1. **§1a — where the operator process runs.** If not the development host, this design does not apply.
2. **§1b — per-run `[PO]` authorization, or a standing grant?** If standing, it needs its own fence and an
   explicit revocation condition.
3. **Is a `from` allowlist wanted** in addition to §4's repo anchor? (Recommended: yes, as defence in depth,
   documented as a speed bump and not a control.)
4. **Fallback policy.** HMP's general hierarchy allows falling back to the gateway on `:8642`. **Recommendation:
   no fallback for launch-class messages** — a commission should have exactly one auditable channel; if HMP is
   down, the run waits. Falling back multiplies the paths by which a run can be started, which is precisely what
   §4 exists to constrain.
5. **Does the receiver need an HMP endpoint here at all?** Commissioning is one-way (us → operator). A peer on
   this host is only required if the operator must *initiate* toward us.

## 9. Explicitly out of scope

- Implementing an HMP peer on this host (that is the PO's option (b), deliberately deferred until §8 resolves).
- Any change to the launcher, the runbook, or `scripts/infra-invariant.mjs`.
- Authentication for **chat-class** HMP traffic — a separate question with a different threat model.
- Sending anything to any peer. **No message has been sent.**
