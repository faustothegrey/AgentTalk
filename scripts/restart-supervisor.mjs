#!/usr/bin/env node

import { readFileSync } from 'fs';
import path from 'path';

const PID_FILE = path.join(process.cwd(), '.agenttalk-supervisor.pid');

try {
  const pid = Number.parseInt(readFileSync(PID_FILE, 'utf8').trim(), 10);
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(`Invalid pid in ${PID_FILE}`);
  }

  process.kill(pid, 'SIGUSR2');
  console.log(`Sent SIGUSR2 to supervisor pid ${pid}`);
} catch (err) {
  console.error(`Failed to restart supervisor: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
