import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface ProcessAdapter {
  spawn(id: string, command: string): void;
  sendText(id: string, text: string): void;
  readOutput(id: string): string;
  kill(id: string): void;
  onExit(callback: (id: string, code: number | null) => void): void;
}

interface ManagedProcess {
  proc: ChildProcess;
  outputBuffer: string;
}

export class ProcessAdapterImpl extends EventEmitter implements ProcessAdapter {
  private processes: Map<string, ManagedProcess> = new Map();

  spawn(id: string, command: string): void {
    if (this.processes.has(id)) {
      throw new Error(`Process ${id} already exists`);
    }

    console.log(`[ProcessAdapter] Spawning process for ${id}: ${command}`);
    const proc = spawn(command, {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    const managed: ManagedProcess = { proc, outputBuffer: '' };

    proc.stdout!.on('data', (chunk: Buffer) => {
      managed.outputBuffer += chunk.toString();
    });

    proc.stderr!.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      console.log(`[ProcessAdapter] stderr from ${id}: ${text.slice(0, 200)}`);
      // Merge stderr into the output buffer so protocol lines on stderr are also visible
      managed.outputBuffer += text;
    });

    proc.on('exit', (code) => {
      console.log(`[ProcessAdapter] Process ${id} exited with code ${code}`);
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

  readOutput(id: string): string {
    const managed = this.processes.get(id);
    if (!managed) throw new Error(`Process ${id} not found`);
    return managed.outputBuffer;
  }

  kill(id: string): void {
    const managed = this.processes.get(id);
    if (!managed) return;
    console.log(`[ProcessAdapter] Killing process ${id}`);
    managed.proc.kill();
    this.processes.delete(id);
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
  }
}
