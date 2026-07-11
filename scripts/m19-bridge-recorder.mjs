#!/usr/bin/env node
import { spawn } from 'child_process';
import { appendFileSync, mkdirSync } from 'fs';
import path from 'path';
import { createInterface } from 'readline';

const [, , bridgePath, wsUrl, logPath] = process.argv;

if (!bridgePath || !wsUrl || !logPath) {
  process.stderr.write('Usage: node scripts/m19-bridge-recorder.mjs <bridgePath> <wsUrl> <logPath>\n');
  process.exit(2);
}

mkdirSync(path.dirname(logPath), { recursive: true });

function record(event, payload = {}) {
  appendFileSync(logPath, JSON.stringify({
    at: new Date().toISOString(),
    event,
    ...payload,
  }) + '\n', 'utf8');
}

record('wrapper_start', { bridgePath, wsUrl });

const bridge = spawn(process.execPath, [bridgePath, wsUrl], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

const stdinLines = createInterface({ input: process.stdin });
stdinLines.on('line', (line) => {
  let parsed = null;
  try {
    parsed = JSON.parse(line);
  } catch {
    // Keep the raw line; bridge owns validation.
  }
  record('tx', {
    raw: line,
    method: parsed?.method,
    id: parsed?.id,
    toolName: parsed?.params?.name,
    toolArguments: parsed?.params?.arguments,
  });
  bridge.stdin.write(line + '\n');
});

stdinLines.on('close', () => {
  record('stdin_close');
  bridge.stdin.end();
});

bridge.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
});

bridge.stderr.on('data', (chunk) => {
  const text = chunk.toString();
  record('bridge_stderr', { text });
  process.stderr.write(text);
});

bridge.on('exit', (code, signal) => {
  record('bridge_exit', { code, signal });
  process.exit(code ?? (signal ? 1 : 0));
});
