#!/usr/bin/env node

import { spawn } from 'child_process';
import { setTimeout as delay } from 'timers/promises';

const DEFAULT_PORT = 3012;
const READY_TIMEOUT_MS = 15_000;

function parseArgs(argv) {
  const fileId = argv[2] ?? process.env.AGENTTALK_DRIVE_FILE_ID;
  const agentId = argv[3] ?? 'e2e-drive-probe';
  const port = Number(process.env.PORT ?? DEFAULT_PORT);

  if (!fileId) {
    throw new Error(
      'Usage: node scripts/e2e-google-drive-noninteractive.mjs <drive-file-id> [agent-id]',
    );
  }

  return { fileId, agentId, port };
}

async function waitForServer(baseUrl) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < READY_TIMEOUT_MS) {
    try {
      const response = await fetch(`${baseUrl}/api/agents`);
      if (response.ok) {
        return;
      }
    } catch {
      // Backend is still starting.
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for backend on ${baseUrl}`);
}

async function expectJson(response, label) {
  const text = await response.text();
  let body;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { status: response.status, body, label };
}

async function main() {
  const { fileId, agentId, port } = parseArgs(process.argv);
  const baseUrl = `http://127.0.0.1:${port}`;

  const backend = spawn('node', ['apps/orchestrator/dist/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backend.stdout.on('data', (chunk) => process.stdout.write(`[backend] ${chunk}`));
  backend.stderr.on('data', (chunk) => process.stderr.write(`[backend] ${chunk}`));

  try {
    await waitForServer(baseUrl);

    const createAgent = await expectJson(
      await fetch(`${baseUrl}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: agentId, executionMode: 'one_shot' }),
      }),
      'createAgent',
    );
    if (createAgent.status !== 200) {
      throw new Error(`Agent creation failed: ${JSON.stringify(createAgent)}`);
    }

    const createResource = await expectJson(
      await fetch(`${baseUrl}/api/integrations/google-drive/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Drive probe ${fileId}`,
          type: 'file',
          driveId: fileId,
        }),
      }),
      'createResource',
    );
    if (createResource.status !== 200 || !createResource.body?.id) {
      throw new Error(`Drive resource registration failed: ${JSON.stringify(createResource)}`);
    }

    const resourceId = createResource.body.id;

    const grant = await expectJson(
      await fetch(`${baseUrl}/api/integrations/google-drive/resources/${resourceId}/grants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      }),
      'grant',
    );
    if (grant.status !== 200) {
      throw new Error(`Grant failed: ${JSON.stringify(grant)}`);
    }

    const files = await expectJson(
      await fetch(
        `${baseUrl}/api/integrations/google-drive/resources/${resourceId}/files?agentId=${encodeURIComponent(agentId)}`,
      ),
      'files',
    );
    if (files.status !== 200 || !Array.isArray(files.body) || files.body.length !== 1) {
      throw new Error(`File listing failed: ${JSON.stringify(files)}`);
    }

    const [file] = files.body;
    if (file.id !== fileId) {
      throw new Error(`Unexpected Drive file metadata: ${JSON.stringify(file)}`);
    }

    const read = await expectJson(
      await fetch(
        `${baseUrl}/api/integrations/google-drive/resources/${resourceId}/read?agentId=${encodeURIComponent(agentId)}`,
      ),
      'read',
    );

    if (read.status !== 500) {
      throw new Error(
        `Expected current PDF read limitation to fail with 500, got ${JSON.stringify(read)}`,
      );
    }

    const error = typeof read.body?.error === 'string' ? read.body.error : '';
    if (!error.includes('Unsupported Drive file type for text read')) {
      throw new Error(`Unexpected read failure: ${JSON.stringify(read)}`);
    }

    console.log('\nResult: current limitation reproduced.');
    console.log(`Resource registration and grant worked for agent "${agentId}".`);
    console.log(`Metadata lookup worked for Drive file "${file.name}" (${file.id}).`);
    console.log(`Content read failed as expected: ${error}`);
    console.log(
      'Conclusion: non-interactive agents do not currently get usable app-level access to this PDF resource.',
    );
  } finally {
    backend.kill('SIGINT');
    await new Promise((resolve) => backend.once('close', resolve));
  }
}

main().catch((err) => {
  console.error(`E2E failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
