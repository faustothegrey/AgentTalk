# Operator brief — BL-122: `apps/web` has zero tests and is excluded from the suite

**Item:** [[BL-122]] in `design/backlog.md`, under `### Todo (next first)` — `status: todo`, filed 2026-08-08 at
the PO's direction, surfaced by [[BL-028]] T3b's bar row **C8**.
**Premises re-verified for this brief:** 2026-08-10, at `c727683`, branch `task-op-hmp8`. Every coordinate below
was re-derived by grepping the symbol. **Assume they are stale by the time you read this and re-derive them
anyway** — this project has put a stale line number into an artifact in three consecutive sessions, and BL-122
itself carried one until 2026-08-09.

**The authoritative statement of the task is the committed backlog item.** Read it. A brief that restates its
source can drift from it and then contradict the thing it was derived from; where this document and the item
disagree, the item wins and the disagreement is a finding worth reporting.

**⚠️ This brief does not decide BL-122's direction, and it must not be read as having leaned.** The item names
two defensible ends and the choice between them is product scope, which belongs to the Product Owner. §4 lays
both out; §5–§8 are written so that they hold under either. If you arrive here without a recorded PO decision
on which end is being built, **that is a show-stopper — see §7.**

---

## 1. The goal, and what would concretely be built

BL-122 is not "write a UI test". It is: **`apps/web` is outside the test suite by a configuration line nobody
chose deliberately, and the project has no recorded position on whether it should be.** The item's own words:
what is not defensible is the current state.

Because the direction is open, the deliverable has two possible shapes. A reader should finish this section
knowing exactly what each one is.

**Under end (A) — bring `apps/web` into the suite.** Add `jsdom` and a React testing library to
`apps/web/package.json`; make the root test configuration actually collect files under `apps/web` (see §3.1 —
this is *not* just deleting the exclusion); add an `environment: 'jsdom'` setting scoped to those files; and
write at least one real assertion — the natural first one being that the `agent_non_reply` arm's notice reaches
something a human can see. Deliverable: a modified test configuration, a modified `apps/web/package.json`, a
lockfile change, and at least one new test file under `apps/web/src`.

**Under end (B) — record the standing position.** Decide the UI is thin enough to stay verified by eye, and
write *that down* as a findable, committed position: what is deliberately not covered, why, and the condition
under which it reopens. Deliverable: a committed artifact stating the position, and the configuration made
self-explaining so the next reader does not re-derive this gap from scratch. **(B) is a real deliverable, not
the null option** — the item's complaint is the absence of a decision, and (B) supplies one.

**The concrete miss that produced the item** (verified, §2 P5): BL-028 T3b added one `case 'agent_non_reply'`
arm to `App.tsx`'s WebSocket switch. Its *input* is proven — a connected client receives the broadcast with
`reason` and `silentForMs` intact — but nothing proves the arm does anything with it. The switch has **no
`default` branch**, so a missing or mistyped `case` drops the message silently: the failure this gap cannot
catch is also the one that produces no error anywhere.

## 2. Premises, verified by symbol — what I actually saw

Re-derived 2026-08-10 at `c727683` by grepping identifiers, not by trusting the item's numbers.

| # | Premise | How verified | What I saw |
|---|---|---|---|
| P1 | The exclusion exists | `grep -n "apps/web" vitest.config.ts` | **`vitest.config.ts:20`** — `exclude: ['**/dist/**', 'apps/web/**'],` (the item's corrected `:20` still holds at this sha) |
| P2 | `include` is an allowlist | `grep -n "include:" vitest.config.ts` | **`vitest.config.ts:19`** — six globs: `apps/orchestrator/src/**/*.test.ts`, `packages/runtime-core`, `packages/llm-client`, `packages/mcp-transport`, `packages/mcp-exec-server`, `scripts/__tests__/**/*.test.mjs`. **None of them is under `apps/web`.** |
| P3 | No test script, no test dependency | read `apps/web/package.json` | scripts are exactly `dev` / `build` / `preview`. Dependencies: react, react-dom, lucide-react, `@agenttalk/contracts`. devDependencies: `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, typescript, vite. **No vitest, no jsdom, no testing-library.** |
| P4 | Zero test files | `find apps/web -name "*.test.*" -not -path "*/node_modules/*"` | no output — zero |
| P5 | The arm, and the missing `default` | `grep -n "agent_non_reply\|switch\|default:" apps/web/src/App.tsx` | switch at **`App.tsx:202`**, arm at **`App.tsx:251`**, and **`default:` has zero hits in the file** |
| P6 | Nothing else is silently dropped | `npx vitest list --filesOnly` vs `find` over `packages`/`apps`/`scripts` | **89 files on disk, 89 collected, set-identical** (`comm -23` empty); **0 collected from `apps/web`**. `apps/web` is the only gap, and it is a gap because there are no files at all |
| P7 | Vitest version and default excludes | `node -e` on the installed package; `node_modules/vitest/dist/config.js:17-24` | **vitest 2.1.8**. `defaultInclude = ["**/*.{test,spec}.?(c|m)[jt]s?(x)"]`; `defaultExclude` includes `"**/node_modules/**"`. The root config **replaces** these, it does not extend them |
| P8 | An in-repo precedent for app-local tests | read `packages/contracts/package.json` and root `package.json:11` | root `test` is `npm run test --workspace @agenttalk/contracts && vitest run`; contracts' own `test` is `node scripts/verify-contract.js` |

**Do not inherit these.** Re-run the greps at your sha. If any premise is false, see §7 — that is a success.

## 3. Three things the item's own text does not say

These are the findings this brief adds. They bear on both ends of the fork.

### 3.1 The exclusion is not the gate. Removing it changes nothing.

`include` (P2) is an **allowlist of six globs, none of which is under `apps/web`**. Vitest collects
`include` minus `exclude`; a path the include never matches cannot be un-excluded. So **`'apps/web/**'` on line
20 is redundant with line 19**, and deleting it collects exactly zero new files.

This sharpens the item rather than contradicting it: the item says the exclusion is "a config line nobody
chose deliberately", and it turns out the *operative* line is a different one — the include allowlist, which
also records no decision about `apps/web`. The state is doubly undecided.

**Honesty about how this one was established:** it is a reading of the configuration text at `vitest.config.ts:19-20`
plus vitest's documented collection semantics, **not** an executed proof. It cannot be executed today, because
with zero test files under `apps/web` (P4) both configurations collect the same nothing. The next reader can
settle it in one step by adding a throwaway test file under `apps/web/src` and running `npx vitest list
--filesOnly` — **and if that file *is* collected without an include glob, this brief is wrong on its most
load-bearing point and I want to be told.**

### 3.2 The root config drops vitest's `node_modules` exclusion — and `apps/web/node_modules` exists

Because the root config supplies its own `exclude` array, it **replaces** `defaultExclude`, which is where
`**/node_modules/**` lives (P7). Nothing is collected from `node_modules` today only because the six include
globs never reach it. Under end (A), an include glob written as `apps/web/**/*.test.tsx` **would** reach it —
`apps/web/node_modules` is present on disk in this worktree — and would sweep every matching test file shipped
inside installed packages. See §6c: this fails loudly but its tempting fix is to write another unexplained
exclusion line, which is how the current state was arrived at in the first place.

### 3.3 The arm's visible effect is not on screen by default — which bears on *both* ends

The arm does not render. It calls `pushSidebarEvent` (`App.tsx:255`, defined `App.tsx:197`), which appends to
the `sidebarEvents` state rendered by `SidebarEvents`. That component renders the entry list **only when the
panel is expanded** (`SidebarEvents.tsx:41` and `:50`, both gated on `!sidebarEventsCollapsed`), and the state
initialises **collapsed**: `useState(true)` at `App.tsx:167`.

Two consequences, and they cut in opposite directions — which is exactly why this is evidence for the PO and
not an argument for either end:

- **It raises (A)'s floor.** A "the arm renders the reason" assertion must first expand the "Agent Events"
  panel. A test that mounts and immediately queries for the text finds nothing, and the tempting repair is to
  assert on state instead of on rendered output — §6b.
- **It complicates (B).** "Verified by eye" presumes an eye can see it. In the default UI state the notice is
  behind a collapsed panel, so verifying by eye means knowing in advance to expand it. That is a real
  consideration for whoever chooses (B), and it does not by itself defeat (B) — a standing position may
  legitimately say "this class of notice is checked by expanding the events panel during a live session."

**Cost of (A)'s obvious shape, measured rather than guessed:** `App.tsx` is **649 lines**; `useWebSocket`
constructs a real `new WebSocket(...)` from `window.location.host` (`hooks/useWebSocket.ts:31`); and a mount
effect calls `fetchAgents()` and `fetchConversationHistory()` (`App.tsx:352-355`), which go out over `api.*`.
So the smallest honest (A) is a mount with both the socket and `fetch` stubbed — or an extraction of the
handler, **which is a source change to `App.tsx` and therefore fenced (§5) and a show-stopper (§7)**.

**And (A) has two shapes, not one.** P8 shows an in-repo precedent for a workspace owning its own test entry
point: `packages/contracts` runs `node scripts/verify-contract.js` from its own `test` script, chained into the
root `test`. `apps/web` could carry its own config plus a `test` script wired the same way, leaving the root
config untouched. This brief records that the option exists; it does not argue for it.

## 4. The open fork — both ends, argued at their strongest

The item states the fork and deliberately does not resolve it. **Neither does this brief.** Choosing is product
scope and product scope belongs to the Product Owner.

**End (A) — stand up UI testing, at its strongest.** The web UI is the human's only window onto a running team,
and it is the single largest body of code in this repo with no assertion of any kind over it. Every UI change to
date has been verified by a human looking at a screen, which does not scale, does not run in a suite, and leaves
no artifact behind. The `agent_non_reply` arm is a clean demonstration: the switch has no `default`, so its
characteristic failure is silence, and silence is precisely what eyeball verification is worst at noticing. A
harness stood up once is paid for once and is then available to every later UI change — including the ones
nobody has thought of yet, which is where the value actually accrues.

**End (B) — record "verified by eye" as the position, at its strongest.** The item's own closing paragraph makes
this case: one six-line display arm does not justify standing up a test harness, and a harness stood up hastily
to satisfy one bar tends to encode whatever was convenient that afternoon. §3.3 puts numbers on it — the
cheapest real (A) is a 649-line component mounted with a stubbed socket and stubbed `fetch`, which is a
substantial piece of infrastructure whose first and only customer is a six-line arm. Infrastructure with one
customer is fitted to that customer and usually has to be rebuilt for the second. A recorded position costs a
paragraph, removes the "nobody chose this" defect completely, and leaves (A) available the day a second UI
assertion actually wants it.

**What is not defensible, in the item's words:** the current state, "where the exclusion is a config line nobody
chose deliberately." Both ends fix that. Only inaction does not.

**The call is the PO's.** An implementer who arrives here and picks an end has taken a product decision — see
§6b and §7.

## 5. Scope

**In, under end (A):** `vitest.config.ts` *or* a new `apps/web/vitest.config.ts` (per the decision, §3.3);
`apps/web/package.json`; `package-lock.json`; new test files under `apps/web/src/**`; root `package.json`'s
`test` script **only** if the app-local shape is chosen.

**In, under end (B):** the committed artifact recording the position, and comments in the test configuration
making the collection rule self-explaining. Where the standing position is recorded is part of the PO's
decision, not this brief's to assign.

**Out — do not touch, and each is fenced for a reason:**

- **`apps/web/src/App.tsx` and every existing component source.** Adding a `default:` arm to the switch, or
  extracting `handleWsMessage` to make it testable, is a **behaviour change**, not test infrastructure. Fenced
  precisely because it will look like a small convenience — §7.
- **The engine, the registry, `server.ts`, and the BL-028 T3b tests.** The broadcast side is already proven and
  is not in question here.
- **The other five include globs at `vitest.config.ts:19`.** Whatever is done for `apps/web`, no other package's
  collection changes; a diff to those globs is out of scope even if it looks like tidying.
- **`scripts/`** — in particular anything resembling a check on this work. If you believe a check is wrong,
  **say so in your report**; changing a guard so your output passes it is the most serious failure available.
- **`AGENT.md`**, and `design/backlog.md` beyond whatever closing record the decision calls for.

**Stage files explicitly. Never `git add -A`** — `node_modules` is symlinked into the worktree and slips past
`.gitignore`.

## 6. Wrong answers that would look green

All five pass a green suite. The first two are the ones a competent implementer would actually reach for.

**6a. Delete `'apps/web/**'` from `exclude`, watch the suite stay green, call the item done.** This is the most
tempting wrong answer, because it is exactly what the item's fix direction says in words and it produces a
one-line diff with no failures. It enables **nothing** (§3.1): the include allowlist never matched `apps/web`,
so the collected set is byte-identical before and after. Bar row **A2** exists to catch this specific delivery.

**6b. Add jsdom and a testing library, then assert on state rather than on output.** Mock `pushSidebarEvent`, or
reach into the reducer, and assert the arm was entered. Green, fast, stable — and it proves roughly what the
existing wire test already proves (that a message with that `type` arrives and is recognised), while the claim
BL-122 actually wants — *a human can see it* — remains untested. §3.3 is why this trap is baited: the honest
assertion requires expanding a collapsed panel, and the dishonest one does not. Row **A5**.

**6c. Write the include glob as `apps/web/**/*.test.tsx`.** With `**/node_modules/**` no longer in `exclude`
(§3.2), this collects test files out of `apps/web/node_modules`. It fails loudly rather than silently — but the
tempting repair is to add another exclusion line, re-creating the undocumented line the item exists to
complain about. Scope the glob to `apps/web/src/**` instead, or restore `**/node_modules/**` explicitly. Row **A4**.

**6d. Make `App.tsx` testable "while you're in there."** Extract the handler, or add a `default:` arm that logs
unknown messages. Both are defensible engineering and both are **behaviour changes to shared UI code**,
delivered under the cover of test infrastructure. Rule 2: report it, do not make it. Row **A6**.

**6e. Under (B): write one sentence in a commit message and stop.** A position nobody can find later is not a
recorded position; the next reader re-derives the gap from scratch, which is what BL-028 T3b had to do. Row **B1**.

**And the failure mode of this brief itself:** a delivery that satisfies every row above and still leaves nobody
able to say why BL-122 was worth doing. The item says outright it is **not urgent** and says why. The honest
statement of value is narrow: what is missing today is a *decision*, and both ends supply one — nothing in this
brief argues that either end is worth more than the other, and nothing here argues the item must be worked now
rather than when a second UI assertion wants it.

## 7. Show-stoppers, and when refuting this brief is the right outcome

**STOP and report — do not work around — on any of these:**

1. **No recorded PO decision on the fork.** Building either end on your own initiative is taking product scope.
   If you were handed BL-122 without the decision attached, say so and stop. This is the most likely
   show-stopper and the cheapest one to hit.
2. **A premise in §2 is false at your sha.** The line moved, the exclusion is gone, a test dependency appeared,
   `default:` now exists in the switch. **Refuting this brief is a success, not a failure** — report what you
   found, with the grep output, and stop.
3. **End (A) turns out to require changing `App.tsx`** to be testable at all. That is §5's fence and Rule 2's
   fence at the same time. Report the finding — "the arm is not testable without a source change of shape X" is
   valuable information about the UI, and it is itself an argument the PO should weigh on the fork.
4. **A guard or check appears to be wrong.** Report it. Do not change it.

And on the item as a whole: if, having read BL-122, you conclude it should not be worked at all, **write that
with evidence and stop.** An honest refusal costs a paragraph.

## 8. Proposed bar rows — individually falsifiable, and checked against each other

Rows are **labelled by end**. A delivery inherits **R0 plus the rows of the end the PO chose**, and never both
ends' rows. That labelling is not decoration: **B3 and A2 are direct contradictions**, and a bar that handed a
single delivery both would be unsatisfiable by construction. This project has already shipped a bar pinning the
suite at a fixed total while another row demanded a new test file; **A3 is written as a delta rather than a
constant for exactly that reason.** Check any rows you add against the ones already here before writing them down.

**Shared**

- **R0** — `git diff --stat` touches only files declared in §5 for the chosen end. Any other path fails the row.

**End (A)**

- **A1** — the new test is proven **red before the fix**, with the failing output recorded. A test never seen
  failing has not been shown to test anything.
- **A2** — `npx vitest list --filesOnly` afterwards names **at least one file under `apps/web`** that it did not
  name before. *(This is the row 6a fails.)*
- **A3** — comparing the sorted `vitest list --filesOnly` output before and after: the set **grows by exactly the
  new test files added, and loses nothing**. A previously collected file that disappears fails the row. *(A
  delta, deliberately — not a pinned total, which A2 would contradict.)*
- **A4** — **no** collected path contains `node_modules`. *(6c.)*
- **A5** — the assertion is against **rendered output** reachable from a state a human can reach, and it is
  **mutation-checked**: change the `case` string in `App.tsx` to something unmatched, the test goes **red**;
  revert. *(6b. Revert the mutation — it is a probe, not a change.)*
- **A6** — **zero** diff to existing files under `apps/web/src`. New test files only. *(6d.)*

**End (B)**

- **B1** — the standing position is a **committed, findable artifact** that names (i) what is deliberately not
  verified — specifically that the `agent_non_reply` arm's rendering is unproven — and (ii) the condition under
  which the position reopens. *(6e.)*
- **B2** — a reader of `vitest.config.ts:19-20` can tell **from the file alone** why `apps/web` is not collected,
  including that the exclusion is redundant with the include allowlist (§3.1). Falsifiable: show the lines to
  someone and ask.
- **B3** — the collected set is **unchanged**: sorted `vitest list --filesOnly` is identical before and after.

## 9. Containment

Work only in your assigned worktree, on your assigned branch, and commit there. **Do not merge and do not push**
— those are the Product Owner's, without exception.

Report what you did, what you verified and how, and anything you could not check. An honest gap named in your
report is worth more than a confident claim that turns out to be unrun.
