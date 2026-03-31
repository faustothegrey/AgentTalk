#!/usr/bin/env node

import { spawn } from 'child_process';
import { existsSync, rmSync, writeFileSync } from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const PID_FILE = path.join(ROOT_DIR, '.agenttalk-supervisor.pid');
const RESTART_DELAY_MS = 1000;
const STOP_TIMEOUT_MS = 5000;

const CHILD_CONFIGS = {
  backend: {
    name: 'backend',
    command: 'npm',
    args: ['run', 'backend'],
    cwd: ROOT_DIR,
  },
  frontend: {
    name: 'frontend',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(ROOT_DIR, 'web'),
  },
};

const children = new Map();
let shuttingDown = false;
let restartingAll = false;
let restartQueued = false;

function log(message) {
  console.log(`[supervisor] ${message}`);
}

function writePidFile() {
  writeFileSync(PID_FILE, `${process.pid}\n`, 'utf8');
}

function removePidFile() {
  if (existsSync(PID_FILE)) {
    rmSync(PID_FILE, { force: true });
  }
}

function prefixStream(stream, label, target) {
  if (!stream) {
    return;
  }

  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      target.write(`[${label}] ${line}\n`);
    }
  });

  stream.on('end', () => {
    if (buffer.length > 0) {
      target.write(`[${label}] ${buffer}\n`);
      buffer = '';
    }
  });
}

function startChild(name) {
  const config = CHILD_CONFIGS[name];
  if (!config) {
    throw new Error(`Unknown child process: ${name}`);
  }

  if (children.has(name)) {
    return children.get(name);
  }

  log(`starting ${name}`);
  const child = spawn(config.command, config.args, {
    cwd: config.cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });

  const state = {
    name,
    child,
    stopping: false,
    restartTimer: null,
  };

  children.set(name, state);
  prefixStream(child.stdout, name, process.stdout);
  prefixStream(child.stderr, name, process.stderr);

  child.on('exit', (code, signal) => {
    children.delete(name);
    if (state.restartTimer) {
      clearTimeout(state.restartTimer);
      state.restartTimer = null;
    }

    log(`${name} exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
    if (shuttingDown || state.stopping) {
      return;
    }

    state.restartTimer = setTimeout(() => {
      state.restartTimer = null;
      if (!shuttingDown) {
        startChild(name);
      }
    }, RESTART_DELAY_MS);
  });

  child.on('error', (err) => {
    log(`${name} failed to start: ${err.message}`);
  });

  return state;
}

function startAll() {
  startChild('backend');
  startChild('frontend');
}

function killChildProcess(state, signal) {
  if (!state || !state.child || state.child.killed) {
    return;
  }

  state.stopping = true;
  if (process.platform === 'win32') {
    state.child.kill(signal);
    return;
  }

  try {
    process.kill(-state.child.pid, signal);
  } catch {
    try {
      state.child.kill(signal);
    } catch {
      // ignore
    }
  }
}

async function stopChild(name) {
  const state = children.get(name);
  if (!state) {
    return;
  }

  killChildProcess(state, 'SIGTERM');

  await Promise.race([
    new Promise((resolve) => state.child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, STOP_TIMEOUT_MS)),
  ]);

  if (children.has(name)) {
    log(`${name} did not exit in time, force killing`);
    killChildProcess(state, 'SIGKILL');
    await new Promise((resolve) => state.child.once('exit', resolve));
  }
}

async function stopAll() {
  await Promise.all([
    stopChild('backend'),
    stopChild('frontend'),
  ]);
}

async function restartAll(reason) {
  if (shuttingDown) {
    return;
  }

  if (restartingAll) {
    restartQueued = true;
    log(`restart already in progress, queued another restart (${reason})`);
    return;
  }

  restartingAll = true;
  log(`restarting backend and frontend (${reason})`);

  try {
    await stopAll();
    startAll();
  } finally {
    restartingAll = false;
    if (restartQueued) {
      restartQueued = false;
      void restartAll('queued signal');
    }
  }
}

async function shutdown(reason) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  log(`shutting down (${reason})`);
  removePidFile();
  await stopAll();
  process.exit(0);
}

process.on('SIGHUP', () => {
  void restartAll('SIGHUP');
});

process.on('SIGUSR2', () => {
  void restartAll('SIGUSR2');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

writePidFile();
log(`pid written to ${PID_FILE}`);
startAll();
