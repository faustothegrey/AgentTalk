# Re-priming from an older primer — reference & rationale

**Status:** Operative reference (actualized 2026-06-27 to the role-keyed model).
**Canonical operational version:** `AGENT.md → Re-priming from an older primer (human-gated)` — that is the
short, authoritative step list every agent follows. **This doc is the durable *rationale* behind it**: the gap it
closes, why the "fresh key + old body" invariant matters, and the honesty note on the soft gate. If the two ever
disagree, `AGENT.md` wins and this doc is the bug.

> **History.** Originally a 2026-06-22 proposal (Claude, architect) written against the *old* **agent-keyed**
> `{active, consumed}`, three-branch handshake. The primer system was re-keyed by **role** at [[LB-29]]
> (2026-06-26); this doc was rewritten to match. Git history holds the original proposal text.

---

## 1. The gap this closes

The cold-start handshake (`AGENT.md → FIRST ENTRY POINT`) resolves a primer key against your **private
`consumed` set** into these outcomes:

| Primer `key` vs your `consumed` | Outcome |
|---|---|
| **key ∉ `consumed`** | **Fresh for you** → full cold-start gate (gather context, verify, report, **STOP**, then consume the key) |
| **key ∈ `consumed`** | **Benign re-read** → proceed normally; body is historical context; **no gate** |
| **`key: none` / missing / no primer file** | nothing fresh waiting → proceed normally (the human briefs you) |

The hole: once a key is **consumed**, that primer can *only ever* be a benign re-read. There is no way to say
*"this old primer is spent, but I deliberately want a cold instance to run the full cold-start orientation from it
again."* A genuinely cold instance whose only durable brief is an already-consumed primer therefore gets the
**weakest** treatment (proceed normally) instead of the **strongest** (gather-verify-report-STOP). Re-priming
closes that gap.

## 2. Core principle — **fresh key + old body, never recycle a consumed key**

The primer *body* is already durable: git history keeps every prior version of
`design/session-primers/<role>-primer.md`. So re-priming needs **no new storage** — it re-arms a capability
against a recovered body.

Re-priming **must mint a fresh key**. A key that is already in someone's `consumed` can only ever yield a benign
re-read — never a fresh stop — so recycling a spent key would silently fail to re-arm anything and would erase the
invariant that `consumed` = *spent*. Always fresh-key-on-old-body.

## 3. The ritual (soft-gated)

```
  old primer body  ──(recoverable from git history)──┐
                                                      │
  Human: "re-prime from <commit>"  (verbal approval)  │   ← the gate (soft: trust-based)
                                                      ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ RE-PRIME RITUAL  (agent performs, only after approval)         │
  │ 1. recover body:  git show <commit>:…<role>-primer.md         │
  │ 2. mint a FRESH key  (YYYYMMDD-HHMM-<rand>)                   │
  │ 3. overwrite <role>-primer.md:  header role + fresh key +     │
  │    written:… (re-primed) + reprimed_from: <commit> (audit)    │
  │    then the recovered body                                    │
  └──────────────────────────────────────────────────────────────┘
                                                      │
                                                      ▼
  next COLD instance:  key ∉ its consumed  →  FULL cold-start gate fires
        (gather context, verify body vs ground truth, report, STOP, consume)
```

There is **no** private-store write in the ritual — unlike the old agent-keyed model, there is no `active` field
to set. The fresh key is "fresh" simply because it is not yet in any reader's `consumed` set; the next cold
instance consumes it when it reports and stops. Re-priming changes **nothing** in the handshake itself; it only
*produces* a fresh-keyed primer for the existing fresh-branch to pick up.

**Audit artifact:** the `reprimed_from: <commit>` header line, so a reader (and `git blame`) can see this body was
recovered/replayed rather than freshly authored. The cold instance is reminded by it to **verify the recovered
body against current ground truth** — a replayed body is stale by definition.

## 4. Honesty note on the soft gate

The private key store is writable by the agent, so nothing **technically** stops an agent from re-arming its own
key. With the soft gate, the authorization is **the human's verbal go-ahead**, honored by minting the fresh key
*only after* approval — behavioral, not enforced. (The hard-gate alternative — the human supplies the fresh key
value, so possession proves authorization — was considered and **not** adopted; it adds relay friction for a step
that is already rare and human-initiated.)

## 5. Scope

Documentation/protocol only. There is no runtime handshake code — the handshake is a documented behavioral
protocol executed by the agent reading `AGENT.md`. Re-priming is therefore a procedure, not a feature: nothing to
build, only steps to follow.
