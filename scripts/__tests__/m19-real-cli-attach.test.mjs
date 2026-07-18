import { describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../..');
const scriptPath = path.join(repoRoot, 'scripts/m19-real-cli-attach.mjs');

function runRunbook() {
  return execFileSync(process.execPath, [
    scriptPath,
    'runbook',
    '--http-port', '3110',
    '--mcp-port', '3111',
    '--agent', 'codex:m19-codex',
    '--agent', 'claude:m19-claude',
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

describe('m19 real CLI attach helper', () => {
  it('prints non-mutating Codex and Claude attach commands with fresh URL hash', () => {
    const output = runRunbook();

    expect(output).toContain('PORT=3110 AGENTTALK_MCP_PORT=3111 npm run start --workspace @agenttalk/orchestrator');
    expect(output).toContain('ws://localhost:3111/mcp?agentId=m19-codex&contractHash=8df959312e33fa6bf53cd17c36a59f230882b1de86b138ae20d2dc8f9eee3a1a');
    expect(output).toContain('mcp_servers.agenttalk-bridge.command="node"');
    expect(output).toContain('--mcp-config');
    expect(output).toContain('--allowedTools');
    expect(output).toContain('mcp__agenttalk-bridge__await_turn');
    expect(output).toContain('mcp__agenttalk-bridge__send_to_agent');
    expect(output).toContain('no global CLI config edits');
    expect(output).toContain('stale hash: MCP server rejects initialize with close code 1008');
  });
});
