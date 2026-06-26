# Proposal — Re-priming from an older primer (human-gated, soft)

> ⚠️ **SUPERSEDED (2026-06-26, [[LB-29]]).** This doc describes the OLD **agent-keyed**, `{active,consumed}`,
> three-branch handshake (`== active` / `∈ consumed` / mismatch). The primer system is now **role-keyed**: the
> key lives in the *shared* role-primer header, the private store is just `{ consumed: [] }`, and the handshake is
> two-branch (key ∉ consumed = fresh / ∈ consumed = benign). Re-priming still holds (mint a fresh key on the
> recovered body) but reads against the new model — see `AGENT.md → Re-priming` for the canonical version. Kept
> for historical rationale only.

**Status:** PROPOSAL — awaiting Fausto's review. No edits applied to `AGENT.md` or `logbook.md` yet.
**Author:** Claude (architect), 2026-06-22.
**Decision already taken (this session):** gate strength = **soft** (Claude mints the fresh key *after* Fausto's verbal approval; not technically enforced).

---

## 1. The gap this closes

The current handshake (AGENT.md → FIRST ENTRY POINT) resolves a primer key into exactly three outcomes:

| Primer `key` vs private store | Outcome today |
|---|---|
| `== active` | **Fresh** → full cold-start gate (gather context, verify, report, STOP, consume the key) |
| `∈ consumed` | **Benign re-read** → proceed normally, treat body as historical context, **no gate** |
| anything else / none | **Mismatch** → warning banner, STOP, realign with human |

The hole: once a key is **consumed**, that primer can *only* ever be a benign re-read. There is no way to say *"this old primer is spent, but I deliberately want a cold instance to run the full cold-start orientation from it again."* A genuinely cold instance whose only durable brief is an already-consumed primer therefore gets the **weakest** treatment (proceed normally) instead of the **strongest** (gather-verify-report-STOP). Re-priming closes that.

## 2. Core principle — **fresh key + old body, never recycle a consumed key**

The primer *body* is already durable: git history keeps every prior version of `design/session-primers/<agent>-primer.md`. So re-priming needs **no new storage** — it re-arms a capability against a recovered body.

Re-priming **must mint a fresh key**, never flip a `consumed` key back to `active`. Recycling a spent key destroys the invariant that `consumed` = *spent*, after which a benign re-read can no longer be distinguished from a deliberate replay.

## 3. The ritual (soft-gated)

```
  old primer body  ──(recoverable from git history)──┐
                                                      │
  Fausto: "re-prime from <commit>"  (verbal approval) │   ← the gate (soft: trust-based)
                                                      ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ RE-PRIME RITUAL  (Claude performs, only after approval)       │
  │ 1. recover body:  git show <commit>:…<agent>-primer.md        │
  │ 2. mint a FRESH key  (YYYYMMDD-HHMM-<rand>)                   │
  │ 3. overwrite primer.md:  new key + recovered body            │
  │                          + reprimed_from: <commit>  (audit)  │
  │ 4. set the fresh key `active` in the private key store        │
  │    (prior active → consumed, as usual)                        │
  └──────────────────────────────────────────────────────────────┘
                                                      │
                                                      ▼
  next COLD instance:  key == active  →  FULL cold-start gate fires
        (gather context, verify body vs ground truth, report, STOP, consume)
```

Nothing in the three-branch handshake changes. Re-priming simply *produces* a fresh-keyed primer — the existing `== active` branch does the rest.

**New artifact:** an optional `reprimed_from: <commit>` header line, so a reader (and git blame) can see this body was recovered/replayed rather than freshly authored.

## 4. Honesty note on the soft gate

The private key store is writable by Claude, so nothing **technically** stops Claude from re-arming its own key. With the soft gate, the authorization is **Fausto's verbal go-ahead**, honored by minting only after approval — behavioral, not enforced. (The hard-gate alternative — Fausto supplies the fresh key value so possession proves authorization — was considered and **not** chosen this session.)

## 5. Scope of the change

Touches **documentation/protocol only**:
- `AGENT.md` — add the sub-section in §6 below under **Session Primer**.
- `design/logbook.md` — append **LB-13** (§7 below).

No code. No change to the runtime handshake logic (there isn't any — the handshake is a documented behavioral protocol, executed by the agent reading AGENT.md).

---

## 6. Proposed `AGENT.md` insert  (verbatim — for review)

> To be added as a new sub-section of the **Session Primer** section, after **Receiving a Session Primer**.

### Re-priming from an older primer (human-gated)

A **consumed** key can only ever produce a *benign re-read* (proceed normally, no gate). When you instead need a
cold instance to run the **full cold-start orientation** from an *older, already-spent* primer — e.g. a fresh
context window whose only durable brief is a primer you already consumed — use **re-priming**.

**Principle: fresh key + old body — never recycle a consumed key.** The primer *body* is durable (git history
keeps every prior `<agent>-primer.md`), so re-priming re-arms a capability against a recovered body. It MUST mint
a **fresh** key; never move a `consumed` key back to `active` (that would erase the spent/replay distinction).

**Gate: soft (human-approved).** The human decides to re-prime and gives the go-ahead **first**; only then does the
agent perform the ritual. The private key store is the agent's to write, so this gate is **behavioral, not
enforced** — mint the fresh key *only after* the human approves.

**Ritual** (agent performs, after approval):
1. Recover the old body: `git show <commit>:design/session-primers/<agent>-primer.md`.
2. Mint a fresh key (`YYYYMMDD-HHMM-<rand>`).
3. Overwrite `<agent>-primer.md` with: header `audience`, `key: <fresh-key>`, `written: <date> by <agent>
   (re-primed)`, **`reprimed_from: <commit>`** (audit trail), then the recovered body.
4. Set the fresh key `active` in the private key store (prior `active` → `consumed`, as usual).

The next cold instance matches the fresh key on the `== active` branch and runs the normal full cold-start gate
(gather context, **verify the recovered body against current ground truth** — it may be stale by definition —
report, STOP, consume). Re-priming changes nothing in the three-branch handshake; it only *produces* a fresh
primer for it to consume.

---

## 7. Proposed `design/logbook.md` entry  (verbatim — for review)

### LB-13 · 2026-06-22 — [protocol] Re-priming: replay an older primer through the cold-start gate via fresh-key-on-old-body
- **Finding:** a **consumed** primer key has exactly one downstream behaviour — *benign re-read* (proceed
  normally, no cold-start gate). There was no way to deliberately re-run the **full** cold-start orientation from
  an already-spent primer, so a genuinely cold instance whose only durable brief is a consumed primer got the
  *weakest* treatment instead of the *strongest*.
- **Mechanism (added):** **re-priming** = recover the durable body from git history (`git show
  <commit>:…<agent>-primer.md`), mint a **fresh** key, rewrite the primer file with that key + the recovered body
  + a `reprimed_from: <commit>` audit field, and set the fresh key `active`. The next cold instance matches on the
  existing `== active` branch — no change to the three-branch handshake. **Never recycle a consumed key** (flipping
  `consumed`→`active` erases the spent/replay distinction); always fresh-key-on-old-body.
- **Gate:** **soft / human-approved** — the human decides and approves first; the agent mints only after. The
  private key store is agent-writable, so the gate is behavioural, not enforced (hard-gate alt: human supplies the
  key value so possession proves authorisation — considered, not adopted).
- **Source:** Fausto ↔ Claude design exchange, 2026-06-22 (surfaced by a stress-test of the consumed-key re-read
  path). See `design/reprime-mechanism-proposal.md`.
