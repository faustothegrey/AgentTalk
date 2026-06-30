const fs = require('fs');
const crypto = require('crypto');

const file = 'packages/contracts/wire-contract.json';
const data = JSON.parse(fs.readFileSync(file));

data.version = 6;
data.data.mcpTools = [
  "list_agents",
  "send_to_agent",
  "consensus_respond",
  "submit_work_response",
  "submit_work_result",
  "submit_usage_stats",
  "await_turn",
  "submit_exec_result"
];

const hash = crypto.createHash('sha256').update(JSON.stringify(data.data)).digest('hex');
data.hash = hash;

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log('Updated hash:', hash);
