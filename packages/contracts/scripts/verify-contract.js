import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractPath = path.join(__dirname, '../wire-contract.json');
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

function computeContractHash(contractData) {
  const dataStr = JSON.stringify(contractData, null, 2);
  return crypto.createHash('sha256').update(dataStr).digest('hex');
}

function verifyHash(candidate, label) {
  const computedHash = computeContractHash(candidate.data);

  if (computedHash !== candidate.hash) {
    console.error(`FATAL: ${label} data was modified without updating the hash!`);
    console.error('Expected Hash: ' + candidate.hash);
    console.error('Computed Hash: ' + computedHash);
    console.error('If you intended to modify the contract, you MUST bump the version and recompute the hash.');
    process.exit(1);
  }
}

function defaultClientContractPath() {
  return path.resolve(__dirname, '../../../../agentalk-mcp-client/wire-contract.json');
}

function verifyClientAlignment(sourceContract) {
  const clientContractPath = process.env.AGENTTALK_MCP_CLIENT_CONTRACT_PATH
    ? path.resolve(process.env.AGENTTALK_MCP_CLIENT_CONTRACT_PATH)
    : defaultClientContractPath();

  if (!fs.existsSync(clientContractPath)) {
    if (process.env.AGENTTALK_MCP_CLIENT_CONTRACT_PATH) {
      console.error('FATAL: client wire contract not found at ' + clientContractPath);
      process.exit(1);
    }
    console.warn('Client wire contract not found; skipped sibling contract-alignment check.');
    return;
  }

  const clientContract = JSON.parse(fs.readFileSync(clientContractPath, 'utf8'));
  verifyHash(clientContract, clientContractPath);

  const sourceData = JSON.stringify(sourceContract.data, null, 2);
  const clientData = JSON.stringify(clientContract.data, null, 2);
  if (
    clientContract.version !== sourceContract.version ||
    clientContract.hash !== sourceContract.hash ||
    clientData !== sourceData
  ) {
    console.error('FATAL: AgentTalk and agentalk-mcp-client wire contracts diverged.');
    console.error(`AgentTalk: v${sourceContract.version} ${sourceContract.hash}`);
    console.error(`Client:    v${clientContract.version} ${clientContract.hash}`);
    console.error('Run the client contract sync script from agentalk-mcp-client, then re-run this check.');
    process.exit(1);
  }

  console.log('Client contract alignment verified successfully.');
}

verifyHash(contract, contractPath);
console.log('Contract hash verified successfully (v' + contract.version + ').');
verifyClientAlignment(contract);
