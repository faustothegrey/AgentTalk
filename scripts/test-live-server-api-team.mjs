import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

async function run() {
  console.log('Starting live server API team smoke test...');

  // 1. Capture worktrees before run
  const getWorktreePaths = () => execSync('git worktree list --porcelain', { cwd: repoRoot })
    .toString()
    .split('\n\n')
    .map(b => b.split('\n')[0].replace('worktree ', '').trim())
    .filter(Boolean);
    
  const beforeWorktrees = new Set(getWorktreePaths());

  // 2. Start the Orchestrator Server
  const serverPath = path.join(__dirname, '../apps/orchestrator/dist/index.js');
  console.log(`[Server] Spawning orchestrator at ${serverPath}...`);
  
  const server = spawn('node', [serverPath], {
    cwd: repoRoot,
    env: { ...process.env, PORT: '3000' }
  });

  let serverReady = false;
  let mcpUrl = null;

  server.stdout.on('data', (d) => {
    const text = d.toString();
    process.stdout.write(`[Orchestrator] ${text}`);
    if (text.includes('listening on')) {
      serverReady = true;
    }
    const match = text.match(/AgentTalk MCP server URL set to: (ws:\/\/.+)/);
    if (match) {
      mcpUrl = match[1].trim();
    }
  });
  server.stderr.on('data', (d) => process.stderr.write(`[Orchestrator-err] ${d}`));

  // Wait for server to be ready and MCP URL to be captured
  for (let i = 0; i < 20; i++) {
    if (serverReady && mcpUrl) break;
    await new Promise(r => setTimeout(r, 500));
  }
  if (!serverReady || !mcpUrl) {
    console.error('Server failed to start or MCP URL not found');
    server.kill();
    process.exit(1);
  }

  const baseUrl = 'http://localhost:3000';

  // Helper to make API calls
  async function apiCall(endpoint, method, body) {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      throw new Error(`API call failed: ${method} ${endpoint} - ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  let clientProcs = [];
  try {
    
    console.log('[Test] Creating agents via API...');
    await apiCall('/api/agents', 'POST', { id: 'planner-a' });
    await apiCall('/api/agents', 'POST', { id: 'planner-b' });
    await apiCall('/api/agents', 'POST', { id: 'worker-1' });

    const llmAgentPath = path.join(repoRoot, '../agentalk-mcp-client/llm-agent.mjs');
    for (const id of ['planner-a', 'planner-b', 'worker-1']) {
      const proc = spawn('node', [llmAgentPath, '--agentId', id, '--provider', 'gemini', '--execution-mode', 'persistent'], {
        cwd: path.join(repoRoot, '../agentalk-mcp-client'),
        env: { ...process.env, AGENTTALK_PERSISTENT_MCP: 'true', AGENTTALK_PERSISTENT_MCP_URL: mcpUrl },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      proc.stdout.on('data', d => process.stdout.write(`[client-${id}] ${d}`));
      proc.stderr.on('data', d => process.stderr.write(`[client-${id}-err] ${d}`));
      clientProcs.push(proc);
    }
    
    console.log('[Test] Waiting for clients to connect...');
    await new Promise(r => setTimeout(r, 2000));

    console.log('[Test] Starting agents via API...');
    await apiCall('/api/agents/planner-a/start', 'POST', { provider: 'gemini', model: 'gemini-2.5-pro', executionMode: 'auto' });
    await apiCall('/api/agents/planner-b/start', 'POST', { provider: 'gemini', model: 'gemini-2.5-pro', executionMode: 'auto' });
    await apiCall('/api/agents/worker-1/start', 'POST', { provider: 'gemini', model: 'gemini-2.5-pro', executionMode: 'auto' });

    console.log('[Test] Creating team via API...');
    const team = await apiCall('/api/teams', 'POST', {
      name: 'Smoke Test Team',
      members: [
        { agentId: 'planner-a', role: 'planner' },
        { agentId: 'planner-b', role: 'planner' },
        { agentId: 'worker-1', role: 'worker' }
      ]
    });

    console.log(`[Test] Assigning task to team ${team.id}...`);
    await apiCall(`/api/teams/${team.id}/task`, 'POST', {
      description: 'Create a new git worktree. Inside the worktree, output the exact string "SERVER_API_CONSENSUS_REACHED" into a new file called SERVER_PROOF.txt. Discuss this plan briefly, agree on it, and execute.'
    });

    console.log('[Test] Waiting for task completion...');
    let teamState = null;
    let iterations = 0;
    let confirmed = false;
    while (iterations < 120) {
      const teamsRes = await fetch(`${baseUrl}/api/teams`);
      const teams = await teamsRes.json();
      teamState = teams.find((t) => t.id === team.id);
      
      if (teamState && teamState.status === 'completed') {
        break;
      }
      
      if (teamState && teamState.status === 'error') {
        throw new Error('Task ended in error state');
      }

      if (teamState && teamState.status === 'awaiting_confirmation' && !confirmed) {
        console.log(`[Test] Task ${teamState.currentTaskId} awaiting confirmation, confirming now...`);
        confirmed = true;
        await apiCall(`/api/teams/${team.id}/tasks/${teamState.currentTaskId}/confirm`, 'POST', {});
      }
      
      await new Promise(r => setTimeout(r, 5000));
      iterations++;
    }

    if (teamState?.status !== 'completed') {
      throw new Error(`Task did not complete. Status: ${teamState?.status}`);
    }
    
    console.log('[Test] Task completed successfully!');

  } finally {
    // Wait briefly for any delayed cleanup
    await new Promise(r => setTimeout(r, 2000));

    console.log('[Test] Checking worktree cleanup...');
    const afterBlocks = execSync('git worktree list --porcelain', { cwd: repoRoot }).toString().split('\n\n');
    let leaked = 0;
    let branchesToDelete = [];
    
    for (const block of afterBlocks) {
      if (!block.trim()) continue;
      const lines = block.split('\n');
      const pathLine = lines[0].replace('worktree ', '').trim();
      const branchLine = lines.find(l => l.startsWith('branch '));
      const branch = branchLine ? branchLine.replace('branch refs/heads/', '').trim() : null;

      if (!beforeWorktrees.has(pathLine) && pathLine !== repoRoot) {
        console.warn(`[Cleanup] Removing leaked worktree: ${pathLine}`);
        leaked++;
        try { execSync(`git worktree remove --force ${pathLine}`, { cwd: repoRoot, stdio: 'ignore' }); } catch {}
        if (branch) branchesToDelete.push(branch);
      }
    }

    if (leaked > 0) {
      execSync('git worktree prune', { cwd: repoRoot, stdio: 'ignore' });
      for (const b of branchesToDelete) { try { execSync(`git branch -D ${b}`, { cwd: repoRoot, stdio: 'ignore' }); } catch {} }
      console.error(`[Error] Test leaked ${leaked} worktrees. They have been cleaned up.`);
      process.exitCode = 1;
    } else {
      console.log('[Test] Cleanup verified: 0 leaks.');
    }

    console.log('[Server] Shutting down...');
    server.kill();
    for (const proc of clientProcs) {
      proc.kill();
    }
  }
}

run().catch(err => {
  console.error('[Error]', err);
  process.exit(1);
});
