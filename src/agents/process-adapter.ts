import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface ProcessSpawnOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface ProcessAdapter {
  spawn(id: string, command: string, options?: ProcessSpawnOptions): void;
  sendText(id: string, text: string): void;
  onData(id: string, callback: (chunk: string) => void): void;
  kill(id: string): void;
  onExit(callback: (id: string, code: number | null) => void): void;
}

interface ManagedProcess {
  proc: ChildProcess;
}

export class ProcessAdapterImpl extends EventEmitter implements ProcessAdapter {
  private processes: Map<string, ManagedProcess> = new Map();
  private dataCallbacks: Map<string, (chunk: string) => void> = new Map();

  spawn(id: string, command: string, options?: ProcessSpawnOptions): void {
    if (this.processes.has(id)) {
      throw new Error(`Process ${id} already exists`);
    }

    console.log(
      `[ProcessAdapter] Spawning process for ${id}: ${command}${options?.cwd ? ` (cwd: ${options.cwd})` : ''}`,
    );
    const proc = spawn(command, {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: options?.cwd,
      env: options?.env ?? process.env,
    });

    const managed: ManagedProcess = { proc };

    proc.stdout!.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      const cb = this.dataCallbacks.get(id);
      if (cb) cb(text);
    });

    proc.stderr!.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      const cb = this.dataCallbacks.get(id);
      if (cb) cb(text);
    });

    proc.on('exit', (code) => {
      console.log(`[ProcessAdapter] Process ${id} exited with code ${code}`);
      this.processes.delete(id);
      this.dataCallbacks.delete(id);
      this.emit('exit', id, code);
    });

    this.processes.set(id, managed);
  }

  sendText(id: string, text: string): void {
    const managed = this.processes.get(id);
    if (!managed) throw new Error(`Process ${id} not found`);
    if (!managed.proc.stdin || managed.proc.stdin.destroyed) {
      throw new Error(`Process ${id} stdin is not writable`);
    }
    managed.proc.stdin.write(text);
  }

  onData(id: string, callback: (chunk: string) => void): void {
    this.dataCallbacks.set(id, callback);
  }

  kill(id: string): void {
    const managed = this.processes.get(id);
    if (!managed) return;
    console.log(`[ProcessAdapter] Killing process ${id}`);
    managed.proc.kill();
    this.processes.delete(id);
    this.dataCallbacks.delete(id);
  }

  onExit(callback: (id: string, code: number | null) => void): void {
    this.on('exit', callback);
  }

  destroyAll(): void {
    for (const [id, managed] of this.processes) {
      console.log(`[ProcessAdapter] Destroying process ${id}`);
      managed.proc.kill();
    }
    this.processes.clear();
    this.dataCallbacks.clear();
  }
}
