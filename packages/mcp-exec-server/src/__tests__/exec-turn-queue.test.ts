import { describe, it, expect, vi } from 'vitest';
import { ExecTurnQueue } from '../exec-turn-queue.js';
import type { WireExecTurn } from '../exec-turn-queue.js';

const turn: WireExecTurn = { type: 'exec_rpc', prompt: 'hi' };

describe('ExecTurnQueue', () => {
  it('awaitTurn before dispatch: resolves when the turn arrives', async () => {
    const q = new ExecTurnQueue();
    const p = q.awaitTurn();
    q.dispatch(turn);
    await expect(p).resolves.toEqual(turn);
  });

  it('dispatch before awaitTurn: the queued turn is returned on the next poll', async () => {
    const q = new ExecTurnQueue();
    q.dispatch(turn);
    await expect(q.awaitTurn()).resolves.toEqual(turn);
  });

  it('submitResult fans out to result listeners; unsubscribe stops delivery', () => {
    const q = new ExecTurnQueue();
    const cb = vi.fn();
    const off = q.onResult(cb);
    q.submitResult({ text: 'out' });
    expect(cb).toHaveBeenCalledWith({ text: 'out' });
    off();
    q.submitResult({ text: 'again' });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('handleDisconnect fires disconnect listeners and drops turn waiters', async () => {
    const q = new ExecTurnQueue();
    const onDisc = vi.fn();
    q.onDisconnect(onDisc);
    let settled = false;
    void q.awaitTurn().then(() => { settled = true; });
    q.handleDisconnect();
    expect(onDisc).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(settled).toBe(false); // waiter dropped, not resolved
  });
});
