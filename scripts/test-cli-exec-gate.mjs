import { Registry } from '../packages/runtime-core/dist/registry/registry.js';
import { AGENTTALK_MCP_TOOLS } from '../packages/runtime-core/dist/registry/mcp-tools.js';
import { McpServer } from '../apps/orchestrator/dist/mcp-server.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wireContract = JSON.parse(fs.readFileSync(path.join(__dirname, '../packages/contracts/wire-contract.json'), 'utf8'));

async function run() {
  console.log('Starting live CLI exec-RPC smoke test...');

  const adapter = { spawn() {}, sendText() {}, onData() {}, onExit() {}, kill() {} };
  const registry = new Registry(adapter, { readinessTimeoutMs: 5000 });

  const mcpServer = new McpServer({
    tools: AGENTTALK_MCP_TOOLS,
    expectedContractHash: wireContract.hash,
    handler: (agentId, name, args) => registry.handleMcpToolCall(agentId, name, args),
    onConnect: (agentId) => registry.handleMcpConnect(agentId),
    onDisconnect: (agentId) => registry.handleMcpDisconnect(agentId),
  });
  const port = await mcpServer.start(0);
  console.log(`[Server] MCP server on ws://localhost:${port}/`);

  await registry.createAgent('cli-planner-1', {
    provider: 'cli-exec',
    providerName: 'gemini'
  });

  // For cli-exec, the driver runs immediately
  await registry.activateAgent('cli-planner-1');

  const llmAgentPath = path.join(__dirname, '../../agentalk-mcp-client/llm-agent.mjs');

  const harness = spawn('node', [llmAgentPath, '--agentId', 'cli-planner-1', '--provider', 'gemini', '--execution-mode', 'persistent'],
    { env: { ...process.env, AGENTTALK_PERSISTENT_MCP: 'true', AGENTTALK_PERSISTENT_MCP_URL: `ws://localhost:${port}/` }, stdio: ['ignore', 'pipe', 'pipe'] });
  harness.stdout.on('data', d => process.stdout.write(`[llm-agent] ${d}`));
  harness.stderr.on('data', d => process.stderr.write(`[llm-agent-err] ${d}`));

  await new Promise(r => setTimeout(r, 2000)); // wait for attach

  console.log('[Test] Sending a test planning turn...');

  // We use `message_received` to trigger a specific prompt and output
  await registry.sendProtocol('cli-planner-1', 'EVT', {
    type: 'message_received',
    from: 'user',
    payload: 'Say hello',
  });

  // Monitor events
  let success = false;
  
  registry.on('mcp_tool_call', (call) => {
    if (call.agentId === 'cli-planner-1' && call.name === 'send_to_agent') {
      console.log(`[Test] Received send_to_agent:`, call.args);
      success = true;
    }
  });

  // Wait up to 60s
  for (let i = 0; i < 60 && !success; i++) {
    await new Promise(r => setTimeout(r, 1000));
  }

  try { harness.kill('SIGKILL'); } catch {}
  await mcpServer.close();

  if (success) {
    console.log('TEST PASSED: Live CLI exec-RPC turn successfully completed.');
    process.exit(0);
  } else {
    console.error('TEST FAILED: Did not receive fact_collection_end.');
    process.exit(1);
  }
}

run().catch((e) => { console.error('TEST ERROR', e); process.exit(1); });
