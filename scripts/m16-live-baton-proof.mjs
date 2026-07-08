import { spawn } from 'child_process';
import { setTimeout as delay } from 'timers/promises';
import { WebSocket } from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const wireContract = require('../packages/contracts/wire-contract.json');
const CONTRACT_HASH = wireContract.hash;

const PORT = 3019;
const BASE_URL = `http://localhost:${PORT}`;
const RECORDING_PATH = path.join(__dirname, '..', 'design', 'm16-one-real-baton.ndjson');

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    try {
      const res = await fetch(`${BASE_URL}/api/agents`);
      if (res.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error('Server timeout');
}

class RawMcpClient {
  constructor(agentId, mcpPort) {
    this.agentId = agentId;
    this.ws = new WebSocket(`ws://localhost:${mcpPort}/?agentId=${agentId}`);
    this.msgId = 1;
    this.pending = new Map();
    this.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        this.pending.get(msg.id)(msg.result || msg.error);
        this.pending.delete(msg.id);
      }
    });
  }

  async connect() {
    return new Promise((resolve) => {
      this.ws.on('open', async () => {
        await this.send('initialize', { 
          protocolVersion: '2024-11-05', 
          capabilities: {}, 
          clientInfo: { name: 'c', version: '1.0', contractHash: CONTRACT_HASH } 
        });
        this.ws.send(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }));
        resolve();
      });
    });
  }

  async send(method, params) {
    return new Promise((resolve) => {
      const id = this.msgId++;
      this.pending.set(id, resolve);
      this.ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }

  callTool(name, args) {
    return this.send('tools/call', { name, arguments: args });
  }
}

async function runClient(agentId, mcpPort, isSender) {
  const client = new RawMcpClient(agentId, mcpPort);
  await client.connect();
  console.log(`[${agentId}] Connected to MCP.`);

  console.log(`[${agentId}] Calling await_turn...`);
  const turn1 = await client.callTool('await_turn', {});
  const turn1Data = JSON.parse(turn1.content[0].text);
  console.log(`[${agentId}] Woke up with: ${turn1Data.prompt.substring(0, 50)}...`);

  if (turn1Data.prompt.includes("confirming you are responsive")) {
    console.log(`[${agentId}] Replying to healthcheck with healthcheck_ack tool...`);
    await client.callTool('submit_exec_result', { text: JSON.stringify({ message_type: 'healthcheck_ack', message_payload: { text: 'ready' } }), usage: { prompt_tokens: 0, completion_tokens: 0 } });
  }

  console.log(`[${agentId}] Calling await_turn (conversation_start)...`);
  const turn2 = await client.callTool('await_turn', {});
  const turn2Data = JSON.parse(turn2.content[0].text);
  console.log(`[${agentId}] Received turn2: ${turn2Data.prompt.substring(0, 50)}...`);

  if (isSender) {
    console.log(`[${agentId}] Sending baton via send_to_agent...`);
    await client.callTool('send_to_agent', {
      to: 'receiver',
      payload: '[SM] This is the baton payload',
      baton: { originTag: '[SM]', fromRole: 'planner', toRole: 'worker', batonId: 'baton-123' }
    });
    console.log(`[${agentId}] Baton sent.`);
    client.callTool('await_turn', {}); // Keep listening
  } else {
    console.log(`[${agentId}] Calling await_turn to receive baton...`);
    const turn3 = await client.callTool('await_turn', {});
    const turn3Data = JSON.parse(turn3.content[0].text);
    console.log(`[${agentId}] Received baton turn: ${turn3Data.prompt.substring(0, 100)}...`);
  }
}

async function run() {
  if (fs.existsSync(RECORDING_PATH)) fs.unlinkSync(RECORDING_PATH);

  // Clear existing database to ensure fresh agents
  const dbPath = path.join(__dirname, '..', 'apps', 'orchestrator', 'data', 'orchestrator.db');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('[Test] Cleared orchestrator database.');
  }

  const server = spawn('node', ['apps/orchestrator/dist/index.js'], {
    env: { ...process.env, PORT: String(PORT), AGENTTALK_RECORDING_PATH: RECORDING_PATH },
    stdio: 'pipe',
  });

  let mcpPort = null;
  server.stdout.on('data', d => {
    const s = d.toString();
    const match = s.match(/AgentTalk WebSocket MCP server listening on ws:\/\/localhost:(\d+)\//);
    if (match) mcpPort = match[1];
  });
  server.stderr.on('data', d => process.stderr.write(`[Server-err] ${d}`));

  try {
    await waitForServer();
    while (!mcpPort) await delay(250);
    console.log('[Test] Server ready. MCP Port:', mcpPort);

    // Using gemini provider to properly test the LLM protocol translation layer
    const req1 = await fetch(`${BASE_URL}/api/agents`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id:'sender', provider:'gemini', model:'test', executionMode:'auto'}) });
    console.log('[Test] Create sender response:', await req1.text());
    await fetch(`${BASE_URL}/api/agents/sender/start`, { method: 'POST' });
    
    const req2 = await fetch(`${BASE_URL}/api/agents`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id:'receiver', provider:'gemini', model:'test', executionMode:'auto'}) });
    console.log('[Test] Create receiver response:', await req2.text());
    await fetch(`${BASE_URL}/api/agents/receiver/start`, { method: 'POST' });

    console.log('[Test] Connecting external client processes...');
    const senderP = runClient('sender', mcpPort, true);
    const receiverP = runClient('receiver', mcpPort, false);

    await delay(1000); 

    console.log('[Test] Connecting UI WS to start conversation...');
    const uiWs = new WebSocket(`ws://localhost:${PORT}/ws`);
    uiWs.on('open', () => {
      uiWs.send(JSON.stringify({
        type: 'start_pair_chat',
        agentIds: ['sender', 'receiver'],
        topic: 'Live Baton Test',
        maxReplies: 10
      }));
      console.log('[Test] Sent start_pair_chat WS message.');
    });

    await senderP;
    await receiverP;
    await delay(1000); 
    
  } finally {
    server.kill();
  }

  const recording = fs.readFileSync(RECORDING_PATH, 'utf8');
  console.log('\n--- Recording output ---');
  console.log(recording);
  
  if (recording.includes('"baton":{"originTag":"[SM]"') && recording.includes('"payload":"[SM] This is the baton payload"')) {
    console.log('\n✅ TEST PASSED: Baton recorded in NDJSON.');
  } else {
    console.error('\n❌ TEST FAILED: Baton missing from recording.');
    process.exit(1);
  }
}

run().catch(console.error);
