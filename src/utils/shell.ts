import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

const defaultCmuxPath = '/Applications/cmux.app/Contents/Resources/bin/cmux';

const cmuxPath = process.env['CMUX_PATH'] ?? defaultCmuxPath;

/**
 * Ensures cmux is reachable, launching the app if needed.
 * Call once at startup.
 */
export async function ensureCmux(): Promise<void> {
  // If CMUX_SOCKET_PATH is set, we're inside cmux — skip the ping check
  // since child processes may fail cmux's access control even with env vars present
  if (process.env['CMUX_SOCKET_PATH']) {
    console.log(`[cmux] Running inside cmux (socket: ${process.env['CMUX_SOCKET_PATH']})`);
    return;
  }

  try {
    await execFileAsync(cmuxPath, ['ping'], { timeout: 3000 });
    console.log('[cmux] Already running');
    return;
  } catch {
    // Not running — try to launch
  }

  console.log('[cmux] Not running, launching app...');
  execFileSync('open', ['-a', 'cmux'], { timeout: 5000 });

  // Wait for socket to become available
  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const { stdout } = await execFileAsync(cmuxPath, ['ping'], { timeout: 3000 });
      if (stdout.trim() === 'PONG') {
        console.log('[cmux] Started successfully');
        return;
      }
      console.log(`[cmux] Unexpected ping response: ${stdout.trim()}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[cmux] Waiting... attempt ${i + 1}/${maxAttempts}: ${msg}`);
    }
  }

  throw new Error(`cmux failed to start after ${maxAttempts} seconds`);
}

/**
 * Runs a cmux command with the specified arguments.
 * Uses execFile for predictable argument quoting.
 */
export async function runCmux(args: string[]): Promise<string> {
  const cmd = args[0];
  // Log non-read commands always; read-screen is too noisy
  if (cmd !== 'read-screen') {
    console.log(`[cmux] Running: cmux ${args.join(' ')}`);
  }

  const { stdout, stderr } = await execFileAsync(cmuxPath, args, {
    env: process.env,
    maxBuffer: 1024 * 1024,
  });

  if (stderr) {
    console.warn(`[cmux] stderr for "cmux ${args.join(' ')}": ${stderr.trimEnd()}`);
  }

  if (cmd !== 'read-screen') {
    console.log(`[cmux] Result for "cmux ${cmd}": ${stdout.trimEnd().slice(0, 200)}`);
  }

  // Don't trim read-screen output — trailing newlines are significant content
  if (cmd === 'read-screen') {
    return stdout;
  }
  return stdout.trimEnd();
}
