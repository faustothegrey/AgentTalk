import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js';
import { WebSocket } from 'ws';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://127.0.0.1:3000';
const WS_URL = 'ws://127.0.0.1:9898';
const UI_WS_URL = 'ws://127.0.0.1:3000/ws';

async function startAgent(agentId, isSender) {
  console.log(`[${agentId}] Registering...`);
  const req1 = await fetch(`${BASE_URL}/api/agents`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id:agentId, provider:'mcp', executionMode:'auto'}) });
  if (!req1.ok) throw new Error(`Registration failed: ${await req1.text()}`);
  console.log(`[${agentId}] Activating...`);
  const req2 = await fetch(`${BASE_URL}/api/agents/${agentId}/start`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id:agentId}) });
  if (!req2.ok) throw new Error(`Activation failed: ${await req2.text()}`);

  console.log(`[${agentId}] Connecting via MCP WebSocket...`);
  const transport = new WebSocketClientTransport(new URL(`/?agentId=${agentId}`, WS_URL));
  const client = new Client({ name: `test-client-${agentId}`, version: '1.0.0', contractHash: 'ffa94e93e3182d44924ed28381870c7bd814c908279942022d5925a4865a9446' }, { capabilities: {} });
  
  await client.connect(transport);
  console.log(`[${agentId}] Attached.`);

  // Handle server tools (simulating the external MCP execution loop)
  const pollTurn = async () => {
    try {
      const turnRes = await client.callTool({ name: 'await_turn', arguments: { contractHash: 'ffa94e93e3182d44924ed28381870c7bd814c908279942022d5925a4865a9446' } });
      const textContent = turnRes.content && turnRes.content[0] ? turnRes.content[0].text : turnRes.text;
      const turnData = typeof textContent === 'string' ? JSON.parse(textContent) : turnRes;
      
      // Safety guard against unexpected payloads
      if (!turnData || !turnData.prompt) {
        return;
      }

      console.log(`[${agentId}] Raw turnData:`, JSON.stringify(turnData));

      if (turnData.prompt.includes("confirming you are responsive")) {
        console.log(`[${agentId}] Replying to healthcheck via submit_exec_result...`);
        const resultText = JSON.stringify({
          message_type: 'healthcheck_ack',
          message_payload: { text: 'ready' }
        });
        await client.callTool({ name: 'submit_exec_result', arguments: { text: resultText, usage: { prompt_tokens: 0, completion_tokens: 0 } } });
        return;
      }

      if (isSender) {
        if (!client.sentBaton) {
          console.log(`[${agentId}] Sending baton via send_to_agent...`);
          await client.callTool({ name: 'send_to_agent', arguments: {
            to: 'receiver-9',
            payload: '[SM] This is the baton payload',
            baton: { kind: 'workflow_baton', originTag: '[SM]', fromRole: 'planner', toRole: 'worker', batonId: 'baton-123' }
          } });
          client.sentBaton = true;
          console.log(`[${agentId}] Baton sent. Resolving the turn...`);
        }
        // End the turn
        await client.callTool({ name: 'submit_exec_result', arguments: { text: JSON.stringify({ message_type: 'ack_planning_protocol', message_payload: { text: 'Baton sent' } }), usage: { prompt_tokens: 0, completion_tokens: 0 } } });
        return;
      }

      // If receiver, just ack
      await client.callTool({ name: 'submit_exec_result', arguments: { text: JSON.stringify({ message_type: 'ack_planning_protocol', message_payload: { text: 'Ack' } }), usage: { prompt_tokens: 0, completion_tokens: 0 } } });

    } catch (e) {
      if (e.message?.includes('No turn available')) {
        // Just poll again later
      } else {
        console.error(`[${agentId}] Error in loop:`, e.message);
      }
    }
  };

  // Poll loop
  const interval = setInterval(pollTurn, 1000);
  return { client, stop: () => clearInterval(interval) };
}

async function runLiveProof() {
  console.log("— Live smoke: Orchestrator Attach Server & Baton metadata —\n");
  
  const recPath = path.join(process.cwd(), 'recordings');

  let receiver, sender;
  let uiWs;
  try {
    // 2) Attach agents
    receiver = await startAgent('receiver-9', false);
    sender = await startAgent('sender-9', true);

    await new Promise(r => setTimeout(r, 2000));

    // 3) Start conversation via WebSocket
    console.log("Starting pair conversation...");
    uiWs = new WebSocket(UI_WS_URL);
    await new Promise((resolve, reject) => {
      uiWs.on('open', resolve);
      uiWs.on('error', reject);
    });
    
    uiWs.send(JSON.stringify({
      type: 'start_pair_chat',
      agentIds: ['sender-9', 'receiver-9'],
      topic: 'Baton Test',
      maxReplies: 10
    }));

    console.log("Waiting 10 seconds for the exchange...");
    await new Promise(r => setTimeout(r, 10000));

    console.log("Shutting down clients...");
    sender.stop();
    receiver.stop();
    uiWs.close();

    if (!fs.existsSync(recPath)) {
      throw new Error('Recordings file not found. Was AGENTTALK_RECORDING_PATH set on the server?');
    }
    
    const contents = fs.readFileSync(recPath, 'utf8');
    
    if (contents.includes('"batonId":"baton-123"')) {
      console.log("\n✅ LIVE SMOKE PASSED: Baton metadata successfully transported through the attach server and recorded.");
    } else {
      console.log("\n❌ LIVE SMOKE FAILED: Baton metadata NOT FOUND in the recording.");
      process.exit(1);
    }
  } catch(e) {
    console.error("❌ Test script failed:", e);
    if(sender) sender.stop();
    if(receiver) receiver.stop();
    if(uiWs) uiWs.close();
    process.exit(1);
  }
}

runLiveProof();
