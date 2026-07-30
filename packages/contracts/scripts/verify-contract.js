import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { execFileSync } from 'child_process';
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

/**
 * BL-101: the primary checkout, resolved correctly even from inside a task worktree.
 *
 * `--git-common-dir` is the worktree-aware pointer to the shared `.git`, i.e. the PRIMARY
 * checkout's — from a linked worktree it still names the primary. `--path-format=absolute`
 * is load-bearing: without it git answers a bare relative `.git` when run in the primary,
 * which would resolve against the wrong cwd and reintroduce a path bug of the same family
 * this function exists to remove.
 *
 * Returns null rather than throwing when git is unavailable or this is not a repository
 * (exported tarball, odd CI). The caller then falls back to the previous behaviour — the
 * original code could not crash here, and neither may this.
 */
function primaryCheckoutRoot() {
  try {
    const gitCommonDir = execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    return gitCommonDir ? path.dirname(gitCommonDir) : null;
  } catch {
    return null;
  }
}

function defaultClientContractPath() {
  // BL-101: this used to resolve the client as a sibling of THIS FILE. That is correct only
  // in the primary checkout. Under the worktree MANDATE all development happens in a task
  // worktree, where it resolved to a path that does not exist — and the caller's fail-open
  // branch then turned "I could not look" into "everything is fine", silently, in exactly the
  // place where anyone is actually working.
  const primary = primaryCheckoutRoot();
  if (primary) {
    return path.resolve(primary, '../agentalk-mcp-client/wire-contract.json');
  }
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
    // BL-101: name the path. Before the resolution fix this warning fired on every worktree
    // run and meant nothing; now it should be rare, so when it does fire it is worth knowing
    // where we looked.
    console.warn(`Client wire contract not found at ${clientContractPath}; skipped sibling contract-alignment check.`);
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
