# Backlog — relay

Open items owned by the **relay** module. Closed items live in `90-closed.md`.

<!-- Split from design/backlog.md (Wave 1). -->
<!-- @item
id: BL-107
status: deferred
date: 2026-07-30
epic: null
tags: [security, hmp, hermes, operator, infrastructure, po-decision, exposure, parked]
autonomy: po-decision
-->
- [deferred · **PARKED BY PO DECISION 2026-08-02, reopen condition below** · the PO's own infrastructure,
  outside both repos] — **HMP on this host accepts
  unauthenticated commands from any LAN peer, into a shell-capable agent.**

  Found 2026-07-30 while resolving `design/hmp-session-submission.md` §1a. `~/.hermes/config.yaml:597-612` sets
  `host: 0.0.0.0` (every interface, not the plugin's own documented "safe staging default" of localhost),
  `allow_all_peers: true`, and no `HMP_SHARED_SECRET`. `adapter.py:223` returns `None` — authorized — **before any
  check runs** when `allow_all_peers` is true. Inbound text goes straight to `handle_message()` (`adapter.py:208`)
  and Hermes holds `toolsets: [hermes-cli]`, i.e. shell, with `gateway_timeout: 1800` and `max_turns: 90`.

  **This is not hypothetical and not idle.** The gateway DB records **107 messages already executed**, including
  `DEPLOY capability-reuse v2.2.0 now. Download ZIP from http://192.168.1…` — so the channel is already used to
  install software on the development machine. §4 of the proposal predicted exactly this threat model
  (*"trivially forgeable by any host on the LAN"*); it turns out to be the live configuration rather than a risk
  to design against.

  **Why it is filed rather than fixed, and why that is not timidity:** both obvious levers break a **live
  three-peer cluster** that sends here — `peer70` (88 messages), `peer84` (12), `peer106` (7). Binding
  `127.0.0.1` cuts all three off. Setting a shared secret 403s all three until each is updated, and `peer70`
  (coordinator, `192.168.178.70:8643`) was **unreachable** at the time of writing, so it could not be updated.
  The blast radius of the fix therefore lands on the PO's infrastructure, and the sequencing is the PO's call.

  **⚠️ ESCALATED the same day by [[BL-110]] — read this before deciding the timing.** The paragraph above says
  the sequencing is the PO's call, which was right while HMP carried only *commissions* (there, `hmp-commission.mjs`
  §4's repo anchor holds the authority, so an unauthenticated transport cannot forge a launch). It is **not** right
  if HMP is to carry **instructions**. `[PO]` is this project's apex authority and Origin Tag Protocol Rule 1 makes
  it binding; an unauthenticated channel that can mint it hands scope, merges, role assignment and
  `autonomy: eligible` to anyone who can reach the port. **For BL-110 this item is a hard precondition, not a
  preference.**

  **Options:** (a) shared secret, rolled out to all four peers — needs `peer70` reachable; (b) bind `127.0.0.1`
  and accept that this host stops being a cluster worker; (c) narrow `allow_all_peers` to an explicit peer list —
  a speed bump, **not** a control, since `from` is self-asserted; (d) accept the posture and rely on
  `design/hmp-commission-plan.md`'s repo-anchored check for launch-class traffic only. **(d) is what is being
  built and it is deliberately narrow**: it hardens the launch path and does nothing for the other 107 messages'
  worth of capability.

  ---

  **⬛ PARKED BY PO DECISION, 2026-08-02 — the exposure is ACCEPTED, not resolved.** The PO's call, in their own
  words: *"Don't worry about attackers right now, this is all internal (as in only me) development. Should I
  decide to go public one day, I'll have it thoroughly tested."* **Nothing above is retracted** — the
  configuration is exactly as described, `adapter.py:223` still returns authorized before any check runs, and the
  107 executed messages are still on the record. What changed is the **threat model**, deliberately: a
  single-user machine on a private LAN whose peers are the PO's own.

  **Reopen condition — any ONE of these returns this item to `todo` BEFORE the change ships:**
  1. the host becomes reachable beyond this machine/LAN — public IP, port-forward, tunnel, VPS, cloud runner; **or**
  2. a second human gains access to the HMP port, or to a peer that sends to it; **or**
  3. HMP is asked to carry anything apex — scope, role assignment, `autonomy: eligible`, `critical` disposition.
     (Origin Tag Protocol rule 5 already refuses these; this is the trigger to revisit *why*.)

  **What the park does NOT license:** no claim in this repo may now read *"the channel is secure."* It is
  **accepted-open** — the same configuration, a different sentence. `AGENT.md` rule 5's honest limit stands
  verbatim, and anything that cited [[BL-107]] as a future control keeps citing it as an **open** one.

<!-- @item
id: BL-112
status: deferred
date: 2026-07-30
epic: null
tags: [hmp, hermes, relay, fidelity, operator, bl110-followup]
autonomy: human-only
-->
- [deferred · **PARKED by the PO 2026-08-07 — reopen: a datum we need starts depending on surviving the courier** · found grading the first HMP-commissioned run ([[BL-110]]/hmp1)] — **The HMP relay silently excises a
  specific literal string from replies, deterministically.**

  The commission acknowledgement prints `artifact: <recording path>`. It arrived **empty twice**, while the
  adjacent `launch-log:` line arrived intact. `launch()` returns the correct value when called directly, so the
  datum is produced and lost in transit.

  **Characterised by two probes** (my first two hypotheses — "the courier isn't byte-faithful" and "it's my code"
  — were both wrong, and the probes are the only reason that was caught):

  | sent | relayed |
  |---|---|
  | `/tmp/att-op-hmp1-recording.json` | *(empty)* — excised, 3/3 |
  | `/tmp/plain.txt` | unchanged — **not** a `/tmp` rule |
  | `/etc/hosts` | unchanged — **not** an "existing file" rule |
  | `/tmp/att-op-hmp1-recording.json.NOPE` | `.NOPE` — **the substring is cut, the remainder survives** |

  So a specific literal is removed mid-string while every other path passes. **Mechanism unknown and inside the
  PO's Hermes install** (`~/.hermes/**` is read-only to us), so this is filed rather than chased.

  **Why it matters more than a cosmetic bug:** the acknowledgement is the *only* thing an HMP commission returns,
  and a channel that silently drops a value is worse than one that errors — the reply looked complete both times.
  The design already survives it because the artifact path is derivable from the committed config, which is the
  argument for repo-anchoring restated as evidence: **no datum you need may depend on surviving the courier.**

  **Fix direction:** do not "work around" it by renaming the file. Either find the excision rule in the Hermes
  install, or make the acknowledgement carry no data that is not independently derivable — and prefer the second
  regardless, since it holds even if the rule is never found.

  ---

  **⬛ PARKED BY THE PO, 2026-08-07. The characterisation above stands in full** — four probes, deterministic,
  mid-string excision of one specific literal while every other path passes intact. **Parked for two reasons,
  and the second is the stronger one:**

  1. **It is unchaseable from here.** The mechanism is inside the PO's own Hermes install (`~/.hermes/**`,
     read-only to us). There is no experiment left that this side of the wall can run.
  2. **Its own preferred fix is already the practice.** The item says to prefer *"make the acknowledgement carry
     no data that is not independently derivable … regardless, since it holds even if the rule is never
     found"* — and that is how commissions already work: the artifact path is derived from the **committed
     config**, not from anything that has to survive the courier. So the design already tolerates the defect.

  **↩ REOPEN CONDITION: a datum we actually need starts depending on surviving the courier.**

  **What the park does NOT license.** The defect is still live, and the reason it was worth filing is unchanged:
  **a channel that silently drops a value is worse than one that errors** — the reply looked complete both
  times, and only checking the artifact caught it. So: **never build a bar row, a grading step, or a decision on
  a value that only exists in a relayed acknowledgement.** That rule is the mitigation; the park assumes it is
  being followed.
  Worth keeping for whoever reopens this: the first two hypotheses — *"the courier isn't byte-faithful"* and
  *"it's my code"* — were **both wrong**, and the probe table is the only reason that was caught.

<!-- @item
id: BL-139
status: deferred
date: 2026-08-15
epic: null
tags: [governance, security, po, push, fence-in-prose, agent-md]
autonomy: po-decision
-->
- [deferred · **PARKED 2026-08-15 by [[BL-134]]'s migration — this is a PO DECISION, and a question is not a
  task.** `po-decision` retired as an `autonomy` value; items that *are* decisions now say so in `status`,
  which keeps them out of the workable set for a stated reason rather than a field nobody could second-guess.
  **Reopen condition:** the PO picks an option below. · filed 2026-08-15 by the planner during BL-137, after
  TESTING an idea rather than reasoning about it**] —
  **`AGENT.md` asserts in bold, in several places, that push is the PO's "absolutely and without exception".
  Nothing on this machine enforces that.**

  Found while testing whether `CHARTER.authorizedRef` could be re-anchored from local `master` to
  `origin/master` — which would have built [[BL-137]]'s fence out of a credential boundary that already
  existed, at zero maintenance cost. **The idea is dead, and this is why:**

  - `~/.ssh/id_rsa` is an **unencrypted** PEM private key (`-----BEGIN RSA PRIVATE KEY-----`, no `ENCRYPTED`
    header)
  - `ssh-add -l` → *"The agent has no identities"*, so git reads that key file directly
  - Hermes runs as the same user, so it can push with the same key

  **Perspective, so this is not over-read: an unencrypted key on a personal dev box is extremely common and
  this is NOT a crisis.** No remote attacker gains anything; [[BL-107]] remains the real exposure and is
  unaffected. The finding is narrower and structural: **it means no git-based anchor can ever serve as a fence
  against a local process**, so `origin/master` is not available as a containment primitive — and the bold
  claim in `AGENT.md` is a **fence that exists only in prose**, the exact shape [[BL-136]], [[BL-101]] and
  BL-137 were each about.

  **Options (uncosted, PO's call):** (a) passphrase-protect the key and rely on the agent, which makes
  `origin/master` a real anchor and reopens that design; (b) soften `AGENT.md`'s wording to describe a
  convention rather than a control; (c) accept and document, on the grounds that a defecting operator is out
  of scope anyway. **(a) and (b) compose.**


*(add new items above this line)*
