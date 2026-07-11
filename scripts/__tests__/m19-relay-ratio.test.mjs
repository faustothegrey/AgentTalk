import { describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../..');
const wrapperPath = path.join(repoRoot, 'scripts/m19-bridge-recorder.mjs');

describe('m19 bridge recorder', () => {
  it('records CLI-origin JSON-RPC tool calls before forwarding to the bridge', () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'm19-bridge-recorder-'));
    try {
      const fakeBridge = path.join(tempDir, 'fake-bridge.mjs');
      const logPath = path.join(tempDir, 'bridge.ndjson');
      const input = JSON.stringify({
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'send_to_agent',
          arguments: {
            to: 'target',
            baton: { kind: 'workflow_baton', batonId: 'b1' },
            workflowEvent: { kind: 'workflow_gate_event', eventId: 'e1' },
          },
        },
      }) + '\n';
      writeFileSync(fakeBridge, 'process.stdin.resume();\n', 'utf8');
      execFileSync(process.execPath, [
        wrapperPath,
        fakeBridge,
        'ws://localhost:1/mcp?agentId=source',
        logPath,
      ], {
        cwd: repoRoot,
        input,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const events = readFileSync(logPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
      const tx = events.find((event) => event.event === 'tx');
      expect(tx.method).toBe('tools/call');
      expect(tx.toolName).toBe('send_to_agent');
      expect(tx.toolArguments.workflowEvent.eventId).toBe('e1');
      expect(tx.toolArguments.baton.batonId).toBe('b1');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
