import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Registry } from '../registry.js';

/**
 * BL-121 — deleting the unreachable `busy` branch, and renaming the helper to say what it does.
 *
 * `setAgentBusyState(agent, busy: boolean)` had exactly ONE call site and it passed `false`, so the
 * `busy === true` branch — and with it `updateAgentSessionStatus(agent, 'busy')` — could never
 * execute. It becomes `markAgentIdle(agent)`: no boolean, no dead branch.
 *
 * **The deciding bar is B1, OBSERVABLE-EVENT PARITY, and it is the reason this file exists.**
 * Deleting unreachable code is unobservable *if* the claim of unreachability is true. That claim is
 * exactly what a reader can get wrong — the previous reading of this same helper produced a false
 * statement that reached a plan, a code comment, two test sites and two backlog items before anyone
 * checked it against a running system. So the check here is not "does the code look equivalent" but
 * "does the running engine emit the same thing".
 *
 * **How the parity is actually proven, which matters more than the assertions themselves.** The
 * sequences in `PARITY` below were CAPTURED by running this file against the PRE-CHANGE tree (commit
 * `f1524aa`, where the helper was still `setAgentBusyState(agent, busy)`) and are frozen here
 * verbatim. They were not written after seeing the post-change result. The same file, unmodified,
 * then runs against the post-change tree. Identical expectations, green on both sides — that is the
 * before/after comparison, not a re-description of the new code.
 *
 * **It is written against the EMITTED EVENTS, never the internal fields.** `agent.status` and
 * `agent.sessionStatus` are implementation; `status` and `session_status` events are what a consumer
 * observes. A mutation that keeps the fields correct while dropping or reordering an emission is a
 * real regression, and only an event-level bar can see it.
 *
 * If any sequence here had differed across the change, the branch would not have been unreachable
 * after all and the whole justification for the deletion would collapse — the item makes reporting
 * that a SUCCESS. It did not differ; the evidence is that this file is green on both trees.
 */

/** `registry.ts` read as text — the source-level bars (B2, B3) are about what the file may contain. */
const REGISTRY_SRC = readFileSync(fileURLToPath(new URL('../registry.ts', import.meta.url)), 'utf8');
const DRIVER_SRC = readFileSync(
  fileURLToPath(new URL('../../agents/in-process-driver.ts', import.meta.url)),
  'utf8',
);

/**
 * A line that WRITES `busy` onto an agent, as opposed to the many that read it. The distinction is
 * the whole point of B3: `agent.status === 'busy'` is a reader and must stay; a producer is a call
 * that puts an agent INTO `busy`, and the item's fence says no new one may appear.
 */
const BUSY_PRODUCER = /(setAgentStatus|notifyAgentStatus|updateAgentSessionStatus)\([^;]*'busy'/;

/** A comment line. Prose that *names* a producer is not a producer — this file's own docblock cites both. */
const COMMENT = /^\s*(\/\/|\*|\/\*)/;

function busyProducerLines(src: string): string[] {
  return src
    .split('\n')
    .filter((line) => !COMMENT.test(line) && BUSY_PRODUCER.test(line))
    .map((l) => l.trim());
}

/**
 * ── THE FROZEN BASELINE ───────────────────────────────────────────────────────────────────────
 * Captured from the pre-change tree. Each entry is the ORDERED sequence of `status` and
 * `session_status` events emitted by one `send_to_agent → user` call, in emission order, tagged by
 * event name so a reordering between the two kinds cannot hide.
 *
 * Note what the order encodes: `session_status` precedes `status`, because the helper updates the
 * session axis first and only then moves `status` off `busy`. That ordering is behaviour a consumer
 * can observe, and it is pinned here deliberately rather than incidentally.
 */
const PARITY = {
  /** A `busy` agent, freshly activated (`sessionStatus === 'starting'`): both axes move. */
  busyAgentFirstCall: ['session_status:ready', 'status:ready'],
  /** A `ready` agent, freshly activated: the session axis moves, `status` is left alone. */
  readyAgentFirstCall: ['session_status:ready'],
  /** Called again with both axes already settled: nothing is emitted at all. */
  settledAgentSecondCall: [] as string[],
  /**
   * `busy` again after the session axis has already settled. The two emissions are independent —
   * `updateAgentSessionStatus` dedupes on its own, and the `status` move does not depend on it.
   */
  busyAgentAfterSessionSettled: ['status:ready'],
} as const;

describe('BL-121 · the idle helper — observable-event parity across the deletion', () => {
  let registry: Registry;
  let events: string[];

  beforeEach(async () => {
    registry = new Registry();
    events = [];
  });

  afterEach(async () => {
    await registry.destroy();
  });

  /**
   * An agent taken through the real activation path, so `sessionStatus` is whatever production
   * leaves behind (`'starting'`) rather than a value the test invented. Listeners are attached AFTER
   * setup so the capture contains only what the call under test emitted.
   */
  async function activatedAgent(id: string, status: 'ready' | 'busy') {
    const agent = await registry.createAgent(id, { provider: 'mcp' });
    await registry.activateAgent(id);
    // Activation already lands the agent on `ready`; the transition table throws on `ready -> ready`,
    // so this steps only where a step is actually needed.
    if (agent.status !== 'ready' && agent.status !== 'busy') agent.setStatus('ready');
    if (status === 'busy' && agent.status !== 'busy') agent.setStatus('busy');
    expect(agent.status, 'setup did not reach the state under test').toBe(status);
    // The session axis is whatever activation left — pinned so the parity cases below start from a
    // production state rather than one the test arranged.
    expect(agent.sessionStatus, 'activation no longer leaves sessionStatus at `starting`').toBe('starting');
    return agent;
  }

  function record() {
    registry.on('status', (e: { id: string; status: string }) => events.push(`status:${e.status}`));
    registry.on('session_status', (e: { id: string; sessionStatus: string }) =>
      events.push(`session_status:${e.sessionStatus}`),
    );
  }

  /** The path under test: an agent reporting back to the user. This is the helper's ONE call site. */
  async function sendToUser(agentId: string) {
    return registry.handleMcpToolCall(agentId, 'send_to_agent', { to: 'user', payload: 'done' });
  }

  // ── B1 — the deciding bar. Mutation: drop the `updateAgentSessionStatus` call, or the
  //    `status === 'busy'` guard, or swap their order. Any of the three turns one of these red.
  it('B1 · a BUSY agent emits the identical ordered sequence (mutation: drop either half of the helper)', async () => {
    const agent = await activatedAgent('busy-1', 'busy');
    record();

    await sendToUser('busy-1');

    expect(events).toEqual(PARITY.busyAgentFirstCall);
    // The fields are checked too — but as a consequence, never as the bar. The events above are.
    expect(agent.status).toBe('ready');
    expect(agent.sessionStatus).toBe('ready');
  });

  it('B1 · a READY agent emits the identical ordered sequence — no `status` event at all', async () => {
    const agent = await activatedAgent('ready-1', 'ready');
    record();

    await sendToUser('ready-1');

    // The `status === 'busy'` guard is what keeps this list at one entry. Remove the guard and a
    // spurious `status:ready` appears for an agent that was already ready — a real consumer-visible
    // difference, and the reason this case is tested and not assumed.
    expect(events).toEqual(PARITY.readyAgentFirstCall);
    expect(agent.status).toBe('ready');
    expect(agent.sessionStatus).toBe('ready');
  });

  it('B1 · a settled agent emits NOTHING on a second call (mutation: emit unconditionally)', async () => {
    await activatedAgent('settled-1', 'busy');
    await sendToUser('settled-1');
    record();

    await sendToUser('settled-1');

    expect(events).toEqual(PARITY.settledAgentSecondCall);
  });

  it('B1 · `status` still moves once the session axis has settled — the two are independent', async () => {
    const agent = await activatedAgent('busy-2', 'ready');
    await sendToUser('busy-2');          // settles sessionStatus to 'ready'
    agent.setStatus('busy');             // as the driver does on the next pulled turn
    record();

    await sendToUser('busy-2');

    expect(events).toEqual(PARITY.busyAgentAfterSessionSettled);
    expect(agent.status).toBe('ready');
  });

  // ── B2 — the helper cannot produce `busy`. RED at the baseline: `markAgentIdle` did not exist.
  it('B2 · the helper is `markAgentIdle`, with no boolean parameter and no `busy` literal', () => {
    const decl = REGISTRY_SRC.indexOf('private markAgentIdle(');
    expect(decl, '`markAgentIdle` is not declared in registry.ts').toBeGreaterThan(-1);

    // No DECLARATION and no CALL of the old name survives — the rename is the point of the item,
    // not decoration. A name asserting a capability the method does not have is what misled the
    // previous reader.
    expect(REGISTRY_SRC).not.toContain('private setAgentBusyState(');
    expect(REGISTRY_SRC).not.toContain('this.setAgentBusyState(');

    const body = REGISTRY_SRC.slice(decl, REGISTRY_SRC.indexOf('\n  }\n', decl));
    expect(body).toMatch(/^private markAgentIdle\(agent: Agent\): void \{/);
    expect(body).not.toContain('boolean');

    // ⚠️ The bar's wording and the item's own behaviour requirement pull apart here, and this is
    // the honest reading rather than a softened one. R3/B2 says the body carries "no `'busy'`
    // literal"; the item ALSO requires it to "move `status` from `busy` to `ready` only if it was
    // `busy`" — which cannot be written without comparing against `'busy'`. Both cannot hold
    // literally. What B2 is *for* is stated in the plan alongside it — "the helper CANNOT produce
    // `busy`", mutation "re-add the branch" — so what is pinned is the absence of a PRODUCER. The
    // one surviving literal is a read guard, and removing it would change behaviour, not preserve it.
    expect(busyProducerLines(body)).toEqual([]);
    expect(body.match(/'busy'/g)).toHaveLength(1);
    expect(body).toContain("if (agent.status === 'busy')");
  });

  /**
   * The deliberate other half of the rename, and the reason the assertion above pins declarations
   * and calls rather than every occurrence of the string. A rename that erases the old name makes
   * the old name unfindable — and this repo has an entire test file about source searchability
   * (`scripts/__tests__/source-searchability.test.mjs`) precisely because a symbol you cannot grep
   * for costs real work. Anyone arriving with the old name in hand must land on the new one.
   */
  it('B2 · the old name survives in prose, so a search for it still lands here', () => {
    const decl = REGISTRY_SRC.indexOf('private markAgentIdle(');
    const docblock = REGISTRY_SRC.slice(REGISTRY_SRC.lastIndexOf('/**', decl), decl);
    expect(docblock).toContain('setAgentBusyState');
    expect(docblock).toContain('markAgentIdle');
  });

  it('B2 · the one call site passes no second argument', () => {
    const calls = REGISTRY_SRC.split('\n').filter((l) => l.includes('this.markAgentIdle('));
    expect(calls.map((l) => l.trim())).toEqual(['this.markAgentIdle(agent);']);
  });

  // ── B3 — the `busy` producers stay pinned. RED at the baseline: registry.ts had three.
  it('B3 · registry.ts has exactly ONE `busy` producer, and it is the reconnect restore', () => {
    expect(busyProducerLines(REGISTRY_SRC)).toEqual([
      "this.setAgentStatus(agent, agent.currentTurnId ? 'busy' : 'ready');",
    ]);
  });

  it('B3 · nothing in registry.ts writes `sessionStatus` to `busy` — the deleted branch was its only site', () => {
    expect(REGISTRY_SRC).not.toMatch(/updateAgentSessionStatus\([^;]*'busy'/);
  });

  it('B3 · the driver is still the other producer — untouched by this change', () => {
    expect(busyProducerLines(DRIVER_SRC)).toEqual([
      "this.registry.notifyAgentStatus(this.agent, 'busy');",
    ]);
  });

  // ── The guard's own guard: a bar that cannot fail is not a bar (IP-15). ──────────────────────
  it('the producer detector actually discriminates — readers are not counted as producers', () => {
    expect(busyProducerLines("if (agent.status === 'busy') {")).toEqual([]);
    expect(busyProducerLines("this.setAgentStatus(agent, 'busy');")).toHaveLength(1);
    // Prose naming a producer is not a producer. Missing this counted this change's own docblock
    // as two new `busy` producers — the detector reported a regression that did not exist.
    expect(busyProducerLines("   * the driver calls notifyAgentStatus(agent, 'busy') on every turn")).toEqual([]);
    expect(busyProducerLines("// this.setAgentStatus(agent, 'busy');")).toEqual([]);
  });
});
