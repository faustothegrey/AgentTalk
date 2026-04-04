#!/usr/bin/env node
import { createInterface } from 'readline';
import { spawn } from 'child_process';

const rl = createInterface({
  input: process.stdin,
  terminal: false
});

function parseArgs(argv: string[]) {
  const modelIndex = argv.indexOf('--model');
  const model = modelIndex !== -1 && argv[modelIndex + 1] ? argv[modelIndex + 1] : null;
  return { defaultModel: model };
}

const { defaultModel } = parseArgs(process.argv);

function emit(payload: any) {
  process.stdout.write(JSON.stringify(payload) + '\n');
}

rl.on('line', async (line) => {
  if (!line.trim()) return;

  let request: any;
  try {
    request = JSON.parse(line);
  } catch (err: any) {
    console.error(`[gemini-bridge] Parse error: ${err.message}`);
    return;
  }

  // Handle the Claude-style internal protocol used by InteractiveExecutor
  const prompt = request.message?.content?.[0]?.text || request.prompt;
  const model = request.model || defaultModel;

  if (!prompt) {
    console.error(`[gemini-bridge] No prompt found in request: ${line}`);
    return;
  }

  // For Gemini CLI, we currently need to spawn a new process per turn to use --output-format stream-json
  // since it doesn't yet have a persistent stream-json input mode.
  // However, we emit events in the persistent session format.
  
  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--approval-mode', 'yolo',
    '--include-directories', '.git'
  ];
  if (model) args.push('--model', model);

  const proc = spawn('gemini', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  
  const turnRl = createInterface({
    input: proc.stdout!,
    terminal: false
  });

  turnRl.on('line', (outputLine) => {
    if (!outputLine.trim()) return;
    try {
      const event = JSON.parse(outputLine);
      // Map Gemini CLI events to the common interactive protocol
      if (event.type === 'message' && event.role === 'assistant') {
        emit({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: event.content }]
          }
        });
      } else if (event.type === 'result') {
        emit({
          type: 'result',
          result: event.status === 'success' ? 'Task completed.' : (event.error || 'Task failed.'),
          is_error: event.status !== 'success',
          usage: {
            input_tokens: event.stats?.input_tokens || 0,
            output_tokens: event.stats?.output_tokens || 0
          }
        });
      }
    } catch (err) {
      // ignore malformed noise
    }
  });

  proc.stderr!.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  proc.on('close', (code) => {
    if (code !== 0) {
      // If result event wasn't already emitted by stream-json parser
      emit({
        type: 'result',
        result: `Gemini process exited with code ${code}`,
        is_error: true
      });
    }
  });
});

console.error(`[gemini-bridge] Started (default model: ${defaultModel || 'none'}), speaking NDJSON on stdio.`);
