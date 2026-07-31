# `hmp2` — pre-flight channel probe: a commission that could only refuse

**2026-07-31, by Claude (planner).** Evidence for bar row **R4**, gathered *before* the run exists. Nothing was
launched, and nothing could have been.

> **What this is.** A real commission, carried over the real channel, to the real receiver — deliberately sent
> while `design/operator/hmp2.authorized` did **not** exist, so the only outcome available to it was a refusal.
> The O-1 instinct applied to a fence: prove it with a message that cannot do harm, and find out whether the
> design's predictions about it were right.

## What happened

| | |
|---|---|
| Sent | `POST /hmp/send` → `peer128`, 250 chars, `from: claude-dev-session` |
| Accepted | `{"accepted": true, "message_id": "hmp_79faa262a2db44ef", "status": "working"}` |
| Hermes ran | exactly the one command it was given, and nothing else |
| Result | `refused: no-po-authorization (no design/operator/hmp2.authorized committed at 54985613)`, `exit_code: 1` |
| Replied | that stdout, verbatim |

**The fence refused a real launch request arriving over the wire.** Until now it had been exercised on an
*authorized* run (`hmp1`) and in unit tests. This is the first time the refusal path ran against a live
commission from the network, and it failed closed exactly as designed.

## Three things worth keeping

**1. The message arrived intact — 250 characters sent, 250 received, identical ignoring whitespace.**
[[BL-112]] did not trigger. That is consistent with the empirical rule in the planner primer (short messages
survive; a 342-char message once arrived as 154) and with BL-112's own finding that the excision targets a
*specific literal* rather than length alone. **This is one more data point, not a clearance** — BL-112 stays open,
and nothing here should be cited as narrowing it further than its own record already does.

**2. Hermes picked up the governance file on its own.** The transcript shows
`[Subdirectory context discovered: Software/AgentTalk/AGENTS.md]` — the courier read the project's rules while
executing in the repo. Benign here, and worth knowing: the operator seat is not a context-free shell.

**3. A defect in my own sending, recorded because it would otherwise look like it worked.** I passed
`message_id` as an argv token instead of an environment variable, so it reached the body as `undefined` and
**Hermes minted its own id**. The POST still succeeded, which is the problem: **idempotency travelled as
nothing, and the response looked healthy.** HMP's replay protection is the `message_id`, so a resend would not
have been recognised as a duplicate. It cost nothing on a refusal probe. It would not be nothing on a launch —
and the run ledger's `already-launched` guard is a *second* line of defence, not a substitute for the first.
**Fix the sender before the authorized attempt.**

## What this does NOT show

- **Nothing about the launch path.** Verification stopped at the authorization gate; the bar hash, config
  binding, workdir and governance checks were exercised separately with only the authorization blob stubbed
  (all pass), which is a check of *my artifacts*, not of a launch.
- **Nothing about authentication.** The probe was safe because it could only refuse, not because the channel is
  secure. [[BL-107]] is open, `0.0.0.0` + `allow_all_peers` confirmed live on this host, and merge
  authorization rides the same port.
- **Nothing about the worker.** No worker existed.
