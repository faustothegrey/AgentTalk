# BL-024 — Splitting `AgentProvider`: transport × vendor (design)

> **Status:** DESIGN — **GATE PASSED (PO, 2026-07-18):** all four §8 questions decided per the recommendations,
> incl. **explicit authorization for the T2 frozen-engine edit** under the §4 preservation contract. See §8 for the
> recorded decisions. **Author:** Claude (architect hat, resource fallback).
> **Item:** BL-024 (todo — implementation not started). **Evidence:** LB-65 audit; ground-truth re-confirmed
> 2026-07-18 (line refs below are current).
> **Nature:** design-first, epic-scale, cross-repo, and it touches the **frozen engine**. The PO has authorized the
> engine change (§8 Q1); T1/T2/T3 are cleared to be planned+implemented under normal gates.
> **Independence caveat:** sole agent — authored and would be reviewed by the same actor; this design deserves a
> second pair of eyes before it becomes code.

## 1. The problem

`AgentProvider` (`packages/contracts/src/types.ts:31`) fuses two orthogonal axes into one union:

```
NOW
  AgentProvider = 'api' | 'mcp' | 'gemini' | 'claude' | 'codex'
                   └ transport ┘  └──────────── vendor ───────────┘
                   HOW it attaches            WHOSE model it is

  ApiProvider = 'google' | 'openrouter' | 'nous'   (a SECOND vendor axis, only for 'api')
```

"Two shapes and three vendors in one union." It already caused the **M17 G3-2 refute** (`provider:'api'` read as
"the human channel"). The **law** (authority/routing) is genuinely shape-blind and survived the LB-65 audit; the
**plumbing** is not.

## 2. Ground-truth audit — the three leaks (current lines, 2026-07-18)

| # | Location | What it does | Class |
|---|----------|--------------|-------|
| 1 | `contracts/src/types.ts:31` | the conflated union itself | structural |
| 2 | `runtime-core/…/team-coordinator.ts:1004-1017` (`getFactCollectionTimeoutMs`) | `if (team.provider === 'gemini')` / `agent.providerName === 'gemini'` bumps the fact-collection timeout to `DEFAULT_GEMINI_FACT_COLLECTION_TIMEOUT_MS` (720_000) | ⚠️ **behavioural, inside the FROZEN engine** |
| 3 | `runtime-core/…/registry.ts:246, 249, 360, 597` | provider union drives driver/completer selection and turn-mode | structural |

### 2.1 The key finding — the sniff sites collapse to *one transport predicate*

Reading leak #3's four sites, the vendor names are **never** distinguished from `'mcp'` — they are always
lumped together:

```
registry.ts:246  if (provider ∈ {api,mcp,gemini,claude,codex})     → effectively "is a known provider" (always true)
registry.ts:249  if (provider === 'api')  → ApiCompleter ; else McpCompleter     ← the ONE real split: api vs rest
registry.ts:360  (provider ∈ {mcp,gemini,claude,codex}) ? awaitExecTurn() : awaitTurn()   ← "is exec/attached transport"
registry.ts:597  return provider ∈ {mcp,gemini,claude,codex}                               ← "is exec/attached transport"
```

So the engine only ever asks **one** real question: *"in-process (`api`) or attached/exec (everything else)?"* —
i.e. **transport**. The **only** place a vendor name changes behaviour is leak #2 (the gemini timeout). That is
what makes this split unusually clean: remove one behavioural branch and the vendor axis disappears from the engine
entirely.

### 2.2 Where vendor *is* legitimately needed

At the **client/launcher edge**, not the engine: `POST /api/agents {provider}` tells the launcher **which CLI to
spawn** (`agentalk-mcp-client`: `agent-launcher.mjs`, `bite0-launcher.mjs`). A worker's vendor is real information
— it just belongs to the driver/launcher layer and (for one timing knob) to per-agent capability metadata, **not**
to the frozen coordinator. Note SP2's finding: real *attached* CLIs already register `provider: 'mcp'`
(transport-shaped, vendor opaque); vendor values are carried by *launched* agents.

## 3. Target design

```
PROPOSED
  transport : 'in-process' | 'attached'          ← the ONLY axis the engine sees
                 (was 'api')     (was 'mcp' + gemini/claude/codex)

  vendor?   : 'gemini' | 'claude' | 'codex' | …   ← edge/launcher axis; known when WE launched it,
                                                     absent for opaque attach
  apiVendor?: ApiProvider ('google'|'openrouter'|'nous')  ← unchanged; in-process completer selection

  capabilities?: { factCollectionTimeoutMs?: number }     ← per-agent metadata; kills leak #2
```

Principle: **the engine is transport-typed and vendor-blind; vendor lives at the edge (drivers, launcher,
capability metadata).**

### 3.1 Per-leak remediation

- **Leak #1 (union):** replace `AgentProvider` with `transport: 'in-process' | 'attached'` on the `Agent`/`Team`
  records; move `vendor` to its own optional field. Keep `providerName`/`apiVendor` as today for the api path.
- **Leak #3 (registry):** collapse the sniff sites to a single predicate `isAttached(agent)` (was the 4-value
  list) and a **driver factory** `makeDriver(agent)` that switches on `transport` (+ `apiVendor` for the
  in-process completer). No behaviour change — the sites already treat the 4 values identically.
- **Leak #2 (frozen engine — the sensitive one):** the coordinator stops reading vendor. `getFactCollectionTimeoutMs`
  becomes `max(default, agent.capabilities?.factCollectionTimeoutMs ?? 0)` over members — **vendor-blind**. The
  edge sets `capabilities.factCollectionTimeoutMs = 720_000` when launching a gemini agent, preserving today's
  behaviour exactly. See §4.

## 4. The frozen-engine strategy (leak #2) — requires PO authorization

`team-coordinator.ts` is a **DO-NOT-TOUCH guardrail**; changing `getFactCollectionTimeoutMs` is a **behaviour
change under the M06 rule** and needs the PO's explicit go, even though the *net* behaviour is preserved.

- **Behaviour-preservation contract:** for every existing team, the computed timeout must be **identical** before
  and after. Today: gemini members ⇒ 720s, else default. After: the edge injects
  `capabilities.factCollectionTimeoutMs = 720_000` for gemini members ⇒ the `max()` yields the same 720s; all other
  teams keep the default. Net: **byte-identical timeout for every current configuration.**
- **Proof obligation:** a regression test that drives `getFactCollectionTimeoutMs` with (a) a gemini member and
  (b) a non-gemini member, asserting the same numbers as `master` — plus the IP-15 stash-and-rerun (revert the
  edge injection ⇒ gemini team's timeout drops ⇒ the test discriminates).
- **Alternative considered & rejected:** leave the vendor branch in the engine and only split the *type*. Rejected
  — it leaves the behavioural leak (a vendor name steering the frozen engine) in place, which is the item's whole
  point and the SP2 hazard.

## 5. Cross-repo migration & compatibility

`provider` is on the **HTTP API** (`POST /api/agents`) and the **client** sends it; the wire-contract **hash is
unaffected** (`provider` isn't in the hashed set — mcpTools/packetTypes/protocolPrefix), but the **API body shape**
is a coupling point. Compat mapping at the API boundary (accept old, map to new):

```
'api'                     → { transport:'in-process' }
'mcp'                     → { transport:'attached', vendor: undefined }
'gemini'|'claude'|'codex' → { transport:'attached', vendor: <that>, capabilities:{factCollectionTimeoutMs:720_000 if gemini} }
```

Recommended rollout: **accept the legacy `provider` field** (mapped as above) for a deprecation window so the
client/launcher and recordings keep working, while new callers use `{transport, vendor}`. Cut the client over in
the same coordinated change; drop the legacy acceptance in a later cleanup. (No wire-contract bump needed.)

## 6. Blast radius (files touched)

- **contracts:** `types.ts` (the union → transport/vendor; `Agent`, `Team`).
- **runtime-core:** `registry/registry.ts` (factory + `isAttached`), `registry/team-coordinator.ts` (timeout;
  frozen — authorization), `agents/agent.ts`, `registry/mcp-tools.ts` if it echoes provider.
- **orchestrator:** `server.ts` (`POST /api/agents` compat mapping).
- **runtime-scenarios:** `scenarios/types.ts` (mirrors the union).
- **client (`agentalk-mcp-client`):** `agent-launcher.mjs`, `bite0-launcher.mjs`, provider-runtime — send
  `{transport, vendor}` (or keep legacy during the window).
- **tests:** every `provider:` fixture; the new timeout regression + factory tests.

## 7. Phasing (proposed tasks/bites)

1. **T1 — type + edge, engine untouched.** Introduce `transport`/`vendor`/`capabilities` alongside the legacy
   union; API accepts both (compat map); client keeps sending legacy. Registry factory + `isAttached`. **No engine
   change yet.** Fully behaviour-preserving; no frozen-engine authorization needed.
2. **T2 — the frozen-engine slice (authorization-gated).** Move the timeout to capability metadata; edge injects
   720s for gemini; delete the vendor branch from the coordinator. Regression + IP-15 proof (§4).
3. **T3 — client cutover + legacy drop.** Client sends `{transport, vendor}`; remove the legacy acceptance;
   sweep fixtures/recordings-compat.

T1 is safe and unblocks most of the value; T2 is the sensitive one; T3 is cleanup. Each is independently mergeable.

## 8. Risks & open questions — **DECIDED at the gate (PO, 2026-07-18)**

1. **Frozen-engine authorization (T2)** — ✅ **AUTHORIZED.** The PO authorizes the coordinator edit under the §4
   preservation contract (byte-identical timeout for every current team + the IP-15 discriminating test). This is
   the item's core.
2. **`'mcp'` vs launched-vendor as transport** — ✅ **Both are `'attached'`.** No engine path distinguishes "opaque
   attach" from "we launched it" (audit §2.1); `vendor: undefined` encodes the opaque case if one ever emerges.
3. **Legacy window** — ✅ **Deprecate-then-drop** (T1 accepts legacy `provider` → T3 removes it). Avoids a two-repo
   flag-day.
4. **Scope of `capabilities`** — ✅ **Minimal:** one field (`factCollectionTimeoutMs`) — the only current consumer.

*(All four decided per the recommendations; the `[PO]` gate is recorded here as the durable authority.)*

## 9. Out of scope

- BL-014/BL-015-L2 (role briefs / scope fences) — related but separate.
- Any change to the *law* (authority/routing) — it is already shape-blind (LB-65).
- The `ApiProvider` axis (google/openrouter/nous) — stays as-is; it's a genuine vendor axis for the api path.

## 10. Definition of Done (whole item)

- `AgentProvider` no longer conflates transport and vendor; the engine references **no** vendor name.
- `team-coordinator.ts` computes the fact-collection timeout with **no vendor branch**, and a regression proves
  every current team's timeout is unchanged (IP-15 discriminating test).
- Driver selection is behind a factory keyed on `transport`.
- Client + API interoperate across the migration; full suite green in both repos; no wire-contract hash change.

---
*This is a proposal. The PO/architect gate decides §8 before any code is written; T2 additionally needs explicit
frozen-engine authorization.*
