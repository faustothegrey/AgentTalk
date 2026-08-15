# BL-136 — the recursion fence scans the brief, not the instruction the worker receives

- **Item:** [[BL-136]] (`todo`, `autonomy: human-only`, tags `[operator, hermes, commission, recursion, containment, gate-b]`)
- **Blocks:** [[BL-134]] (`blocked_by: [BL-136]`) — a dogfood of the mechanism BL-134 proposes
- **Planner:** Claude, 2026-08-15 · **Roles:** resource-scarcity fallback in force; see §8
- **Files:** `scripts/hmp-commission.mjs`, `scripts/__tests__/hmp-commission.test.mjs`, `design/operator-seat/SKILL.md`

## 0. The change in one sentence

`verifyCommission` scans the **committed config's `goal`** — the string the launcher actually delivers to the
worker as its first turn — with the same recursion fence it already applies to the brief, and refuses a config
that omits `goal` or `cap.wallClockMs` rather than passing it downstream to fail.

## 1. The finding, re-verified against the code (not inherited from the item's prose)

| Claim | Evidence | Verdict |
|---|---|---|
| `findsLaunchInstruction` is called exactly once, on the brief | `hmp-commission.mjs:343` — sole call site | ✅ |
| `config.goal` is never scanned | `grep -n goal scripts/hmp-commission.mjs` → **one hit, `:185`, inside a comment** | ✅ |
| `config.goal` is what the worker receives as its first turn | `bite0-launcher.mjs:195` `deliverGoal(agentId, config.goal, …)`, comment `:194` *"deliver the goal as the worker's first turn"* | ✅ |
| the config is already parsed before the point of use | `hmp-commission.mjs:358-366` — parsed and JSON-validated | ✅ |
| `cap.wallClockMs` is enforced, but only downstream | `bite0-launcher.mjs:36` throws `config.cap.wallClockMs must be > 0`; the identifier appears **nowhere** in `hmp-commission.mjs` | ✅ |

**The ordering matters and dictates the fix's shape.** The brief scan at `:343` runs *before* the config is
read at `:358`, so the goal scan cannot join it there — it must come after the parse. **Exactly how far after
is not a free choice**: it decides which reason an operator reads, and gate 1 found that the obvious answer
(immediately after the parse) silently breaks two existing refusal bars. The pinned insertion point is §4's,
and the reasoning is §9 F1.

## 2. What the check turned up that the item did not record — the doc asserts a fence that does not exist

BL-136 says `SKILL.md` "tells Hermes to run that scan **by hand**." That is true but understates it.
`design/operator-seat/SKILL.md:167-170` reads:

> **Scan the goal string inside the config too** — the launcher delivers `config.goal` to the worker, and a
> launch-phrase in it **refuses `recursive-commission` at commission time even if the brief is clean** (hmp7
> pattern: both scans run, both must pass).

**The bolded clause is false.** Nothing refuses it at commission time. An operator reading this believes an
automated fence is standing behind the manual command — which is the exact inversion of a safety instruction:
the doc's confidence is load-bearing for a check that is absent. This is the [[BL-101]] fail-open-in-a-document
shape, and it is why the doc edit is **in scope here, not a follow-up**: this task makes the sentence true, and
until it does the sentence must not stand.

## 3. Three design decisions, with the alternative I rejected

### 3a. An absent or empty `goal` **refuses**; it does not silently pass the scan

A scan of `String(config.goal ?? '')` would be purely additive and would never break a fixture — and it would
be **a silent no-op on exactly the input that most deserves the check**. This project has caught that shape
four times ([[BL-111]], [[BL-113]], [[BL-116]], [[BL-114]]). The launcher already treats a missing goal as
fatal (`bite0-launcher.mjs:34`), so refusing at commission time changes no outcome — it only moves the failure
**before** the sandbox, the orchestrator and the provider process exist, and makes it dry-runnable.

### 3b. Each new refusal gets its own reason string

`hmp-commission.mjs:55-58` states the contract in the file itself: *"Never collapse two causes into one
reason."* So: **`MISSING_GOAL: 'missing-goal'`** and **`MISSING_CAP_WALLCLOCK: 'missing-cap-wallclock'`**.
Reusing `CONFIG_NOT_COMMITTED` was rejected — the config *is* committed, and a reason that lies about which
check tripped is what that comment exists to prevent.

### 3c. The `cap.wallClockMs` bar is included — and it is **legibility, not containment**

The item is explicit and this plan repeats it so it cannot be misread downstream: **`wallClockMs` is already
enforced at `bite0-launcher.mjs:36`. This is NOT a containment hole and must not be reported as one.** What
the lift buys is a refusal that is legible in the operator's reply and reachable by `--dry-run` before
anything is provisioned. The near-miss that nearly filed it as a hole is recorded in BL-136 itself; it stays
recorded.

## 4. Scope

**May touch:**
- `scripts/hmp-commission.mjs` — two entries in `REFUSAL`; three checks inserted **after the governance check
  (`:392-394`) and before `preflight()` (`:399`)**. *(Insertion point corrected at gate 1 — see §9 F1. It was
  "after the config parse (`:366`)", which silently broke two existing refusal bars.)*
- `scripts/__tests__/hmp-commission.test.mjs` — the `CONFIG` fixture, plus new bars.
- `design/operator-seat/SKILL.md:167-170` — the false clause.

**May NOT touch:** `LAUNCH_PATTERNS` or `findsLaunchInstruction` (the heuristic is reused verbatim — changing
the patterns is a different task with a different blast radius); the brief scan at `:343`; the launcher in
`agentalk-mcp-client` (its check stays as the last line of defence); anything in `src/`; any other refusal.

**Refuse-only invariant.** Every check added here can only turn a *pass* into a *refusal*. No path that
previously refused can now pass. This is the property that makes the change safe to land ahead of BL-134.

## 5. Test contracts that change — enumerated, because they are contracts

The shared `CONFIG` fixture (`hmp-commission.test.mjs:69-72`) has **neither `goal` nor `cap.wallClockMs`** — it
predates both checks. Under §3a it would now refuse, so the happy-path bars would go red.

| # | Assertion | Disposition |
|---|---|---|
| 1 | the `verifyCommission` happy path passes with the existing `CONFIG` | **fixture gains `goal` + `cap.wallClockMs`** — the fixture becomes a *valid* config, which every real one already is (`o1`/`o2.config.json`). The assertion itself is unchanged. |
| 2 | `refuses a recursive brief` (`:467`) | **unchanged** — brief-side path untouched. Note its fixture reuses the shared `CONFIG`, so it inherits row 1's fields and stays green |
| 3 | `leaves an ordinary read-only goal alone` (`:213`) | **unchanged** — a unit bar on `findsLaunchInstruction`, which this task does not modify |
| 4 | `refuses a config with no cap.meter` (`:485`) | **unchanged — but only because of §9 F1's ordering.** Its fixture is `{ agents: [{ workdir }] }`: no meter, **and no `goal` and no `wallClockMs` either**. Under the original insertion point it would have refused `missing-goal` and gone red |
| 5 | `refuses when the committed config launches into a different sandbox` (`:507`) | **unchanged — same reason.** Its fixture has a meter but no `goal`/`wallClockMs`, so it too would have flipped to `missing-goal` before reaching the workdir check |

**This is a fixture correction, not a weakened bar** — it adds two required fields to a stub, and no assertion
loses force. Flagged here rather than discovered in a diff, per the M06 rule.

**Mutation discipline is mandatory on the three new bars.** Each must be shown to go red when its own check is
reverted. A refusal bar that passes for the wrong reason — because some *earlier* check refused first — is
this project's documented failure mode, and three checks landing in one neighbourhood is exactly that risk: a
config missing `goal` also refuses on `workdir` if the fixture is careless.

## 6. Definition of Done

| # | Bar |
|---|---|
| D1 | A committed config whose `goal` matches a `LAUNCH_PATTERNS` entry refuses **`recursive-commission`**, with the matched pattern in the detail — brief clean |
| D2 | A config whose `goal` is absent, **non-string**, or blank/whitespace refuses **`missing-goal`**. The predicate mirrors `bite0-launcher.mjs:34` exactly — `typeof !== 'string' \|\| !trim()` — so the two gates cannot disagree about what a valid goal is *(non-string added at gate 1, §9 F2)* |
| D3 | A config with no `cap.wallClockMs`, or `<= 0`, refuses **`missing-cap-wallclock`**; both `cap` and `caps` spellings are read, matching the existing `meter` lookup at `:371` |
| D4 | **Refuse-only proven, not asserted:** the pre-change happy path (fixture + `goal` + `wallClockMs`) still passes, and no existing refusal bar changes its reason |
| D5 | Mutation run recorded for D1, D2, D3 — each check reverted individually turns **its own** bar red and no other |
| D6 | `SKILL.md:167-170`'s "refuses at commission time" clause is **true**, and the manual-scan instruction is rewritten to say the scan is now enforced |
| D7 | `LAUNCH_PATTERNS` is byte-identical to its pre-change form (`git diff` shows no line in `:192-204`) |
| D8 | `tsc -b` exit 0; full suite green at the inherited baseline **plus** the new bars, with the actual counts recorded — not "expected 779" |
| D9 | `git diff --stat` lists exactly the three files in §4 and nothing else |

## 7. Open questions for gate 1

1. **Should the goal scan reuse `LAUNCH_PATTERNS` verbatim?** Plan says yes (§4). The goal is a *shorter,
   more imperative* string than a brief, so a pattern tuned for prose may behave differently on it — but
   diverging the two scans means two fences to keep in step, and the item's whole finding is that a fence
   nobody keeps in step is no fence. **Recommendation: one shared heuristic.**
2. **Does a false positive here have an escape hatch?** A legitimate goal containing e.g. "launch the app"
   matches `/\blaunch\s+(a|an|another|the)\s+(session|run|operator|worker)\b/i` — it does not, on inspection,
   but a near-miss wording could. The existing brief-side answer is "reword the brief"; the same answer
   applies, and the false-positive cost stays a reworded config. **No escape hatch proposed** — an
   overrideable recursion fence is not a fence.
3. **Is `missing-cap-wallclock` in scope at all, or does it belong to a separate item?** BL-136's text puts it
   in scope as a second bar. It is the one part of this plan that is *not* about recursion, and a reviewer may
   reasonably split it. **Recommendation: keep it** — same file, same neighbourhood, same refuse-only
   property, and splitting it costs a second worktree cycle for four lines.

## 8. Independence — declared, not mitigated

Codex and agy are PO-declared UNAVAILABLE, so under the resource-scarcity fallback the same actor is planner,
plan reviewer, implementer and both review seats on this task. Each gate is exercised separately and under its
own discipline, but **that is a procedure, not independence.** It is recorded in `claude-lessons.md` three
times as the largest unmitigated risk in this work, and this line is not a mitigation either. The merge stays
the PO's.

## 9. Gate 1 findings (plan reviewer, 2026-08-15)

Verdict: **APPROVED after correction.** Two defects, both the planner's, both found by reading the test file
the plan claimed to have surveyed and by running the fence rather than reasoning about it.

**F1 — BLOCK-class: the plan chose an insertion point that silently breaks two existing refusal bars, and its
own contract table asserted they were unchanged.** The original §4 put the new checks "after the config parse
(`:366`)". But `refuses a config with no cap.meter` (`:485`) commits the fixture
`{ agents: [{ workdir: '/tmp/att-op-nometer' }] }` — which has no `goal` and no `wallClockMs` either — and
`refuses … a different sandbox` (`:507`) likewise omits both. At `:366` the goal check fires **first**, so both
bars would refuse `missing-goal` and go red, and §5 row 4 would have been a false claim about a contract.
**This is the "refusal bar passes/fails for the wrong reason" hazard the plan's own §5 named, committed by the
plan itself two paragraphs later.**

**Resolution — pin the insertion point, and justify it on merit rather than on cost.** The checks go **after
the governance check (`:392-394`), immediately before `preflight()` (`:399`)**. Ordering here is *purely
diagnostic*: nothing executes until `pass()` at `:406`, so every refusal is equally safe and the only question
is which reason the operator reads. The coherent grouping is: message-to-config binding first (sandbox,
workdir, governance — the charter's containment parameters), then the config's internal completeness, then
world state (preflight, already-launched). That placement also happens to leave every existing refusal bar's
reason untouched, which is a check on the reasoning, not the reason for it.

**F2 — a non-string `goal` fell through D2.** The bar said "no `goal`, or a blank/whitespace one". A config
with `"goal": ["do", "x"]` satisfies that and would pass the presence check, then be scanned by a regex against
`"do,x"`. The launcher's own predicate is `typeof config.goal !== 'string' || !config.goal.trim()`
(`bite0-launcher.mjs:34`); D2 now mirrors it exactly. **Two gates that disagree about what a valid goal is
would be a new seam, in a task whose entire finding is a seam between two gates.**

**F3 — a check the plan passed, recorded because it is the load-bearing one.** §4's refuse-only invariant was
run against the whole real corpus, not asserted: all **eleven** committed operator configs (`hmp1`-`hmp9`,
`o1`, `o2`) carry a string `goal` that matches **no** launch pattern, and a `cap.wallClockMs > 0`. So the
change refuses **zero** historical runs. §7 q2's claim that `"launch the app"` does not match was also run —
it does not; `"launch the session"` and `"launch a worker"` do. *(Command in §10.)*

## 10. The command that settled F3 — recorded so the next reader re-runs it instead of trusting this file

```
node --input-type=module -e '
import {findsLaunchInstruction} from "./scripts/hmp-commission.mjs";
import fs from "fs";
for (const f of fs.readdirSync("design/operator").filter(f=>f.endsWith(".config.json")).sort()) {
  const c = JSON.parse(fs.readFileSync("design/operator/"+f,"utf-8"));
  console.log(f, "| scan:", String(findsLaunchInstruction(c.goal ?? "") ?? "NONE(pass)"),
              "| wallClockMs:", c?.cap?.wallClockMs ?? c?.caps?.wallClockMs);
}'
```

## 11. What this does NOT fix — stated so it cannot be inferred

- **The fence is still a heuristic.** `hmp-commission.mjs:188-190` says so plainly: a goal could describe a
  launch in words no pattern matches. This task widens *where* the heuristic is applied; it does not make it
  complete, and nothing here may be cited as closing recursion risk.
- **Gate B remains the only real authorization system**, and [[BL-107]] — the unauthenticated HMP port — stays
  **OPEN**. A sender who can reach that port holds a shell either way. Tightening the commission's parsing
  buys integrity, not authentication.
- **The client's own launcher is unchanged.** Its `validateConfig` remains the last line of defence, and this
  task deliberately does not remove the downstream throw it duplicates.
