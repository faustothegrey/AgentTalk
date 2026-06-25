#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import { setTimeout as delay } from 'timers/promises';

// Snapshot-diff worktree cleanup (LB-9): the worker provisions a real git worktree; remove any that
// appear during the run, regardless of where agy places them, without touching pre-existing ones.
const getWorktreePaths = () => execSync('git worktree list --porcelain')
  .toString().split('\n\n')
  .map(b => b.split('\n').find(l => l.startsWith('worktree ')))
  .filter(Boolean).map(l => l.slice('worktree '.length).trim());

function cleanupNewWorktrees(beforePaths) {
  try {
    const blocks = execSync('git worktree list --porcelain').toString().split('\n\n');
    const branches = [];
    for (const block of blocks) {
      const pathLine = block.split('\n').find(l => l.startsWith('worktree '));
      if (!pathLine) continue;
      const p = pathLine.slice('worktree '.length).trim();
      if (beforePaths.has(p)) continue;
      const branchLine = block.split('\n').find(l => l.startsWith('branch '));
      if (branchLine) branches.push(branchLine.slice('branch refs/heads/'.length).trim());
      try { execSync(`git worktree remove --force ${p}`, { stdio: 'ignore' }); } catch {}
    }
    execSync('git worktree prune', { stdio: 'ignore' });
    for (const b of branches) { try { execSync(`git branch -D ${b}`, { stdio: 'ignore' }); } catch {} }
  } catch {}
}

const PORT = 3019;
const BASE_URL = `http://localhost:${PORT}`;
const READY_TIMEOUT_MS = 15000;

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < READY_TIMEOUT_MS) {
    try {
      const response = await fetch(`${BASE_URL}/api/agents`);
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error(`Timed out waiting for backend on ${BASE_URL}`);
}

async function createAgent(id, provider, model) {
  const res = await fetch(`${BASE_URL}/api/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, provider, model }),
  });
  if (!res.ok) throw new Error(`Failed to create ${id}: ${await res.text()}`);
  return res.json();
}

async function startAgent(id) {
  const res = await fetch(`${BASE_URL}/api/agents/${id}/start`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to start ${id}: ${await res.text()}`);
}

async function createTeam(agents) {
  const res = await fetch(`${BASE_URL}/api/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agents),
  });
  if (!res.ok) throw new Error(`Failed to create team: ${await res.text()}`);
  return res.json();
}

async function startTeamTask(teamId, description) {
  const res = await fetch(`${BASE_URL}/api/teams/${teamId}/task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  });
  if (!res.ok) throw new Error(`Failed to start team task: ${await res.text()}`);
  return res.json();
}

async function run() {
  console.log('Starting production path E2E test on port', PORT);
  const beforeWorktrees = new Set(getWorktreePaths());

  const server = spawn('node', ['apps/orchestrator/dist/index.js'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'pipe',
  });

  try {
    let mcpPort = null;
    let stdoutBuffer = '';
    server.stdout.on('data', d => {
      const str = d.toString();
      process.stdout.write(`[Server] ${str}`);
      stdoutBuffer += str;
      const match = stdoutBuffer.match(/AgentTalk WebSocket MCP server listening on ws:\/\/localhost:(\d+)\//);
      if (match) mcpPort = match[1];
    });
    server.stderr.on('data', d => process.stderr.write(`[Server-err] ${d}`));

    await waitForServer();
    if (!mcpPort) {
      // wait a bit for MCP server to start if it hasn't already
      let maxWait = 10;
      while (!mcpPort && maxWait > 0) {
        await delay(500);
        maxWait--;
      }
      if (!mcpPort) throw new Error('Could not find MCP port in server logs');
    }
    console.log('[Test] Server is ready. MCP Port:', mcpPort);

    await createAgent('planner-a', 'gemini', 'gemini-2.5-flash');
    await startAgent('planner-a');
    await createAgent('planner-b', 'gemini', 'gemini-2.5-flash');
    await startAgent('planner-b');
    await createAgent('worker-1', 'gemini', 'gemini-2.5-flash');
    await startAgent('worker-1');

    console.log('[Test] Launching llm-agent clients...');
    const llmAgentPath = '../agentalk-mcp-client/llm-agent.mjs';
    const clientOpts = { env: { ...process.env, AGENTTALK_PERSISTENT_MCP: 'true', AGENTTALK_PERSISTENT_MCP_URL: `ws://localhost:${mcpPort}/` }, stdio: ['ignore', 'pipe', 'pipe'] };
    
    const harnessA = spawn('node', [llmAgentPath, '--agentId', 'planner-a', '--provider', 'gemini', '--execution-mode', 'persistent'], clientOpts);
    harnessA.stdout.on('data', d => process.stdout.write(`[a] ${d}`));
    harnessA.stderr.on('data', d => process.stderr.write(`[a-err] ${d}`));

    const harnessB = spawn('node', [llmAgentPath, '--agentId', 'planner-b', '--provider', 'gemini', '--execution-mode', 'persistent'], clientOpts);
    harnessB.stdout.on('data', d => process.stdout.write(`[b] ${d}`));
    harnessB.stderr.on('data', d => process.stderr.write(`[b-err] ${d}`));

    const harnessW = spawn('node', [llmAgentPath, '--agentId', 'worker-1', '--provider', 'gemini', '--execution-mode', 'persistent'], clientOpts);
    harnessW.stdout.on('data', d => process.stdout.write(`[w] ${d}`));
    harnessW.stderr.on('data', d => process.stderr.write(`[w-err] ${d}`));

    await delay(2500); // Wait for MCP connection

    const team = await createTeam({ members: [
      { agentId: 'planner-a', role: 'planner' },
      { agentId: 'planner-b', role: 'planner' },
      { agentId: 'worker-1', role: 'worker' }
    ]});
    
    console.log('[Test] Team created:', team.id);

    // Capture THIS task so we target it by id — NOT the global newest planning run
    // (planning_runs/ accumulates stale files across runs, so `runs[0]` is unreliable).
    const task = await startTeamTask(team.id, 'Let us build a plan using git worktree. Please immediately agree on adding a file named plan.md with content "hello" and submit the plan. Make sure your submitted plan contains the exact text "add plan.md", "implement", and "git worktree" to pass validations. IMPORTANT: ONLY planner-a is allowed to call `submit_plan`. planner-b must NEVER call `submit_plan`, it must only use `agreement_acceptance`.');
    console.log('[Test] Task started:', task.id, '— polling for completion...');

    let planSubmitted = false;
    let workCompleted = false;
    // Budget must cover full consensus (several agy turns + possible re-prompts) AND the worker
    // turn (agy + git worktree). 180 × 2s = 6 min.
    let waitLoops = 0;
    while (!workCompleted && waitLoops < 180) {
      await delay(2000);

      // Find THIS task's planning run by id (robust to stale planning_runs files).
      const res = await fetch(`${BASE_URL}/api/planning-runs`);
      const runs = await res.json();
      const run = Array.isArray(runs) ? runs.find(r => r && r.id === task.id) : null;
      if (run) {
        if (run.status === 'awaiting_confirmation') {
          if (!planSubmitted) {
            console.log(`[Test] Plan submitted for ${task.id}. Confirming...`);
            const confirmRes = await fetch(`${BASE_URL}/api/teams/${team.id}/tasks/${task.id}/confirm`, { method: 'POST' });
            if (!confirmRes.ok) {
              throw new Error(`Confirm failed (${confirmRes.status}): ${await confirmRes.text()}`);
            }
            console.log('[Test] Plan confirmed → delegating to worker.');
            planSubmitted = true;
          }
        } else if (run.status === 'error') {
          throw new Error('Task errored out in planning runs');
        }
      }

      // Check team status for execution completion
      const teamsRes = await fetch(`${BASE_URL}/api/teams`);
      const teams = await teamsRes.json();
      const currentTeam = teams.find(t => t.id === team.id);
      if (currentTeam) {
        if (currentTeam.status === 'completed') {
          workCompleted = true;
        } else if (currentTeam.status === 'error') {
          throw new Error('Team errored out');
        }
      }

      waitLoops++;
    }

    if (workCompleted) {
      console.log('TEST PASSED: E2E reached work completion via production path.');
      return 0;
    }
    console.error('TEST FAILED: Timeout waiting for completion.');
    return 1;
  } finally {
    server.kill();
    try { harnessA.kill('SIGKILL'); } catch {}
    try { harnessB.kill('SIGKILL'); } catch {}
    try { harnessW.kill('SIGKILL'); } catch {}
    cleanupNewWorktrees(beforeWorktrees);
  }
}

run().then(code => process.exit(code ?? 1)).catch(e => {
  console.error(e);
  process.exit(1);
});
