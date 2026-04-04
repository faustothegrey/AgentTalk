import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { callProvider, type ProviderTokenDetails } from './provider-runtime.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const EXECUTION_MODES = ['interactive', 'one_shot', 'auto'] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];

export interface ExecutorRequest {
  id: string;
  prompt: string;
  onStderrChunk?: (chunk: string) => void;
}

export interface ExecutorSink {
  onReplyStart?: (data: { id: string }) => void;
  onReplyChunk?: (data: { id: string; text: string }) => void;
  onReplyDone?: (data: { id: string; response: string; tokens: number; tokenDetails: ProviderTokenDetails }) => void;
  onReplyError?: (data: { id: string; error: string }) => void;
}

export interface ExecutorResponse {
  response: string;
  tokens: number;
  tokenDetails: ProviderTokenDetails;
}

export interface Executor {
  initialize(): Promise<void>;
  executeTurn(request: ExecutorRequest, sink?: ExecutorSink): Promise<ExecutorResponse>;
  getStatus(): string;
  close(): Promise<void>;
}

export function normalizeRequestedExecutionMode(value: string): ExecutionMode {
  return (EXECUTION_MODES as readonly string[]).includes(value) ? (value as ExecutionMode) : 'auto';
}

export function supportsInteractiveExecution(providerName: string): boolean {
  return providerName === 'claude' || providerName === 'codex' || providerName === 'gemini';
}

export function resolveExecutionMode(requestedExecutionMode: string, providerName: string): ExecutionMode {
  const normalizedRequestedMode = normalizeRequestedExecutionMode(requestedExecutionMode);
  if (normalizedRequestedMode === 'one_shot') {
    return 'one_shot';
  }

  if (supportsInteractiveExecution(providerName)) {
    return 'interactive';
  }

  return 'one_shot';
}

interface InteractiveCommand {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

function getInteractiveProviderCommand(providerName: string, selectedModel: string | null): InteractiveCommand {
  if (providerName === 'claude') {
    return {
      command: process.env.AGENTTALK_CLAUDE_INTERACTIVE_COMMAND || 'claude',
      args: [
        '-p',
        '--verbose',
        '--output-format=stream-json',
        '--input-format=stream-json',
        '--permission-mode',
        'bypassPermissions',
        '--model',
        selectedModel || 'sonnet',
        '--add-dir',
        '.git',
      ],
      env: process.env,
    };
  }

  if (providerName === 'codex') {
    return {
      command: 'codex',
      args: ['mcp-server'],
      env: process.env,
    };
  }

  if (providerName === 'gemini') {
    const bridgePath = join(__dirname, 'gemini-bridge.js');
    return {
      command: 'node',
      args: [bridgePath, '--model', selectedModel || 'gemini-2.5-pro'],
      env: process.env,
    };
  }

  throw new Error(`Interactive execution is not implemented for provider: ${providerName}`);
}

function extractAssistantText(event: any): string {
  const content = event?.message?.content;
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .filter((entry) => entry?.type === 'text' && typeof entry.text === 'string')
    .map((entry) => entry.text)
    .join('');
}

class OneShotExecutor implements Executor {
  #providerName: string;
  #selectedModel: string | null;
  #status = 'starting';

  constructor(providerName: string, selectedModel: string | null) {
    this.#providerName = providerName;
    this.#selectedModel = selectedModel;
  }

  async initialize(): Promise<void> {
    this.#status = 'ready';
  }

  async executeTurn(request: ExecutorRequest, sink: ExecutorSink = {}): Promise<ExecutorResponse> {
    this.#status = 'busy';
    sink.onReplyStart?.({ id: request.id });

    try {
      const result = await callProvider(this.#providerName, this.#selectedModel, request.prompt, {
        ...(request.onStderrChunk ? { onStderrChunk: request.onStderrChunk } : {}),
      });

      if (result.response) {
        sink.onReplyChunk?.({ id: request.id, text: result.response });
      }

      sink.onReplyDone?.({
        id: request.id,
        response: result.response,
        tokens: result.tokens,
        tokenDetails: result.tokenDetails,
      });

      return result;
    } catch (err) {
      this.#status = 'error';
      sink.onReplyError?.({
        id: request.id,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      if (this.#status !== 'error') {
        this.#status = 'ready';
      }
    }
  }

  getStatus(): string {
    return this.#status;
  }

  async close(): Promise<void> {}
}

interface InternalExecutorRequest extends ExecutorRequest {
  responseText: string;
  resolve: (value: ExecutorResponse) => void;
  reject: (reason?: any) => void;
  lastTokens?: number;
  lastTokenDetails?: ProviderTokenDetails;
}

abstract class BaseInteractiveExecutor implements Executor {
  protected _providerName: string;
  protected _selectedModel: string | null;
  protected _commandOverride: InteractiveCommand | undefined;
  protected _status = 'starting';
  protected _proc: any = null;
  protected _buffer = '';
  protected _currentRequest: InternalExecutorRequest | null = null;
  protected _currentSink: ExecutorSink | null = null;
  protected _initialized = false;
  protected _closePromise: Promise<void> | null = null;

  constructor(providerName: string, selectedModel: string | null, commandOverride?: InteractiveCommand) {
    this._providerName = providerName;
    this._selectedModel = selectedModel;
    this._commandOverride = commandOverride;
  }

  async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    const { command, args, env } = this._commandOverride || getInteractiveProviderCommand(this._providerName, this._selectedModel);
    this._proc = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this._proc.stdout?.on('data', (chunk: Buffer) => {
      this._buffer += chunk.toString();
      this._drainStdout();
    });

    this._proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      if (this._currentRequest?.onStderrChunk) {
        this._currentRequest.onStderrChunk(text);
      } else {
        process.stderr.write(text);
      }
    });

    this._proc.on('error', (err: Error) => {
      this._status = 'error';
      this._rejectCurrentRequest(err);
    });

    this._proc.on('close', (code: number) => {
      if (this._status === 'terminated') return;
      const err = new Error(`Interactive ${this._providerName} session exited with code ${code}`);
      this._status = 'error';
      this._rejectCurrentRequest(err);
    });

    await this._onSpawned();

    this._initialized = true;
    this._status = 'ready';
  }

  protected async _onSpawned(): Promise<void> {
    // Hooks for sub-classes
  }

  getStatus(): string {
    return this._status;
  }

  async close(): Promise<void> {
    if (this._closePromise) {
      return this._closePromise;
    }

    if (!this._proc) {
      return;
    }

    this._status = 'terminated';
    this._closePromise = new Promise((resolve) => {
      const proc = this._proc;
      this._proc = null;

      proc.once('close', () => resolve());
      proc.stdin?.end();
      setTimeout(() => proc.kill(), 1000);
    });

    await this._closePromise;
  }

  private _drainStdout(): void {
    let newlineIndex;
    while ((newlineIndex = this._buffer.indexOf('\n')) !== -1) {
      const rawLine = this._buffer.slice(0, newlineIndex);
      this._buffer = this._buffer.slice(newlineIndex + 1);
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      try {
        this._handleEvent(JSON.parse(line));
      } catch {
        // Protocol streams should remain machine-readable. Ignore malformed noise.
      }
    }
  }

  protected abstract _handleEvent(event: any): void;

  abstract executeTurn(request: ExecutorRequest, sink?: ExecutorSink): Promise<ExecutorResponse>;

  protected _rejectCurrentRequest(err: Error): void {
    if (!this._currentRequest) {
      return;
    }

    const currentRequest = this._currentRequest;
    const sink = this._currentSink;
    this._clearCurrentRequest();
    sink?.onReplyError?.({
      id: currentRequest.id,
      error: err instanceof Error ? err.message : String(err),
    });
    currentRequest.reject(err);
  }

  protected _clearCurrentRequest(): void {
    this._currentRequest = null;
    this._currentSink = null;
  }

  protected _sendToStdin(payload: any): void {
    if (!this._proc?.stdin || this._proc.stdin.destroyed) {
      throw new Error(`Interactive ${this._providerName} session is not available`);
    }
    this._proc.stdin.write(JSON.stringify(payload) + '\n');
  }
}

class ClaudeInteractiveExecutor extends BaseInteractiveExecutor {
  async executeTurn(request: ExecutorRequest, sink: ExecutorSink = {}): Promise<ExecutorResponse> {
    if (this._currentRequest) {
      throw new Error(`Interactive ${this._providerName} session is already processing a request`);
    }

    this._status = 'busy';
    this._currentSink = sink;
    sink.onReplyStart?.({ id: request.id });

    const payload = {
      type: 'user',
      model: this._selectedModel,
      message: {
        role: 'user',
        content: [
          {
            type: 'text',
            text: request.prompt,
          },
        ],
      },
    };

    return new Promise((resolve, reject) => {
      this._currentRequest = {
        ...request,
        responseText: '',
        resolve,
        reject,
      };

      try {
        this._sendToStdin(payload);
      } catch (err) {
        this._status = 'error';
        this._clearCurrentRequest();
        reject(err);
      }
    });
  }

  protected _handleEvent(event: any): void {
    if (!this._currentRequest) {
      return;
    }

    if (event.type === 'assistant') {
      const text = extractAssistantText(event);
      if (text) {
        this._currentRequest.responseText += text;
        this._currentSink?.onReplyChunk?.({ id: this._currentRequest.id, text });
      }
      return;
    }

    if (event.type !== 'result') {
      return;
    }

    const currentRequest = this._currentRequest;
    const sink = this._currentSink;
    const response = currentRequest.responseText || (typeof event.result === 'string' ? event.result : '');

    this._clearCurrentRequest();
    this._status = 'ready';

    if (event.is_error) {
      const error = new Error(response || `Interactive ${this._providerName} request failed`);
      sink?.onReplyError?.({ id: currentRequest.id, error: error.message });
      currentRequest.reject(error);
      return;
    }

    const tokenDetails = {
      input: event.usage?.input_tokens || 0,
      output: event.usage?.output_tokens || 0,
    };
    const tokens = tokenDetails.input + tokenDetails.output;

    sink?.onReplyDone?.({
      id: currentRequest.id,
      response,
      tokens,
      tokenDetails,
    });
    currentRequest.resolve({ response, tokens, tokenDetails });
  }
}

class GeminiInteractiveExecutor extends BaseInteractiveExecutor {
  async executeTurn(request: ExecutorRequest, sink: ExecutorSink = {}): Promise<ExecutorResponse> {
    if (this._currentRequest) {
      throw new Error(`Interactive ${this._providerName} session is already processing a request`);
    }

    this._status = 'busy';
    this._currentSink = sink;
    sink.onReplyStart?.({ id: request.id });

    // Speak the same protocol as ClaudeInteractiveExecutor
    const payload = {
      type: 'user',
      model: this._selectedModel,
      message: {
        role: 'user',
        content: [
          {
            type: 'text',
            text: request.prompt,
          },
        ],
      },
    };

    return new Promise((resolve, reject) => {
      this._currentRequest = {
        ...request,
        responseText: '',
        resolve,
        reject,
      };

      try {
        this._sendToStdin(payload);
      } catch (err) {
        this._status = 'error';
        this._clearCurrentRequest();
        reject(err);
      }
    });
  }

  protected _handleEvent(event: any): void {
    if (!this._currentRequest) {
      return;
    }

    if (event.type === 'assistant') {
      const text = extractAssistantText(event);
      if (text) {
        this._currentRequest.responseText += text;
        this._currentSink?.onReplyChunk?.({ id: this._currentRequest.id, text });
      }
      return;
    }

    if (event.type !== 'result') {
      return;
    }

    const currentRequest = this._currentRequest;
    const sink = this._currentSink;
    const response = currentRequest.responseText || (typeof event.result === 'string' ? event.result : '');

    this._clearCurrentRequest();
    this._status = 'ready';

    if (event.is_error) {
      const error = new Error(response || `Interactive ${this._providerName} request failed`);
      sink?.onReplyError?.({ id: currentRequest.id, error: error.message });
      currentRequest.reject(error);
      return;
    }

    const tokenDetails = {
      input: event.usage?.input_tokens || 0,
      output: event.usage?.output_tokens || 0,
    };
    const tokens = tokenDetails.input + tokenDetails.output;

    sink?.onReplyDone?.({
      id: currentRequest.id,
      response,
      tokens,
      tokenDetails,
    });
    currentRequest.resolve({ response, tokens, tokenDetails });
  }
}

class CodexInteractiveExecutor extends BaseInteractiveExecutor {
  #threadId: string | null = null;
  #rpcId = 0;
  #pendingRpc = new Map<number, { resolve: (value: any) => void; reject: (reason?: any) => void }>();

  protected async _onSpawned(): Promise<void> {
    await this.#callRpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'AgentTalk', version: '1.0' },
    });
  }

  async executeTurn(request: ExecutorRequest, sink: ExecutorSink = {}): Promise<ExecutorResponse> {
    if (this._currentRequest) {
      throw new Error(`Interactive ${this._providerName} session is already processing a request`);
    }

    this._status = 'busy';
    this._currentSink = sink;
    sink.onReplyStart?.({ id: request.id });

    const toolName = this.#threadId ? 'codex-reply' : 'codex';
    const toolArgs: any = this.#threadId
      ? { threadId: this.#threadId, prompt: request.prompt }
      : { prompt: request.prompt };
    
    if (!this.#threadId && this._selectedModel) {
      toolArgs.model = this._selectedModel;
    }

    return new Promise((resolve, reject) => {
      this._currentRequest = {
        ...request,
        responseText: '',
        resolve,
        reject,
      };

      this.#callRpc('tools/call', { name: toolName, arguments: toolArgs }).then(
        (result: any) => {
          if (!this._currentRequest) return;
          const currentRequest = this._currentRequest;
          const sink = this._currentSink;
          const response = result.content?.[0]?.text || result.content || '';
          this.#threadId = result.threadId || result.structuredContent?.threadId || this.#threadId;

          this._clearCurrentRequest();
          this._status = 'ready';

          sink?.onReplyDone?.({
            id: currentRequest.id,
            response,
            tokens: currentRequest.lastTokens || 0,
            tokenDetails: currentRequest.lastTokenDetails || { input: 0, output: 0 },
          });
          currentRequest.resolve({
            response,
            tokens: currentRequest.lastTokens || 0,
            tokenDetails: currentRequest.lastTokenDetails || { input: 0, output: 0 },
          });
        },
        (err: any) => {
          this._status = 'error';
          this._rejectCurrentRequest(err);
        }
      );
    });
  }

  #callRpc(method: string, params: any): Promise<any> {
    const id = ++this.#rpcId;
    return new Promise((resolve, reject) => {
      this.#pendingRpc.set(id, { resolve, reject });
      this._sendToStdin({ jsonrpc: '2.0', method, params, id });
    });
  }

  protected _handleEvent(event: any): void {
    if (event.jsonrpc !== '2.0') return;

    // Handle Responses
    if (event.id !== undefined) {
      const pending = this.#pendingRpc.get(event.id);
      if (pending) {
        this.#pendingRpc.delete(event.id);
        if (event.error) {
          pending.reject(new Error(event.error.message || 'RPC Error'));
        } else {
          pending.resolve(event.result);
        }
      }
      return;
    }

    // Handle Notifications (codex/event)
    if (event.method === 'codex/event' && this._currentRequest) {
      const msg = event.params?.msg;
      if (!msg) return;

      if (msg.type === 'agent_message_delta' || msg.type === 'agent_message_content_delta') {
        const delta = msg.delta;
        if (delta) {
          this._currentRequest.responseText += delta;
          this._currentSink?.onReplyChunk?.({ id: this._currentRequest.id, text: delta });
        }
      } else if (msg.type === 'token_count') {
        const usage = msg.info?.last_token_usage || msg.info?.total_token_usage;
        if (usage) {
          this._currentRequest.lastTokenDetails = {
            input: usage.input_tokens || 0,
            output: usage.output_tokens || 0,
          };
          this._currentRequest.lastTokens = (usage.input_tokens || 0) + (usage.output_tokens || 0);
        }
      }
    }
  }
}

export interface CreateExecutorOptions {
  providerName: string;
  selectedModel: string | null;
  requestedExecutionMode: string;
  interactiveCommandOverride?: InteractiveCommand;
}

export interface CreateExecutorResult {
  requestedExecutionMode: ExecutionMode;
  resolvedExecutionMode: ExecutionMode;
  executor: Executor;
}

export function createExecutor({
  providerName,
  selectedModel,
  requestedExecutionMode,
  interactiveCommandOverride,
}: CreateExecutorOptions): CreateExecutorResult {
  const normalizedRequestedExecutionMode = normalizeRequestedExecutionMode(requestedExecutionMode);
  const resolvedExecutionMode = resolveExecutionMode(normalizedRequestedExecutionMode, providerName);

  let executor: Executor;
  if (resolvedExecutionMode === 'interactive') {
    if (providerName === 'claude') {
      executor = new ClaudeInteractiveExecutor(providerName, selectedModel, interactiveCommandOverride);
    } else if (providerName === 'codex') {
      executor = new CodexInteractiveExecutor(providerName, selectedModel, interactiveCommandOverride);
    } else if (providerName === 'gemini') {
      executor = new GeminiInteractiveExecutor(providerName, selectedModel, interactiveCommandOverride);
    } else {
      executor = new OneShotExecutor(providerName, selectedModel);
    }
  } else {
    executor = new OneShotExecutor(providerName, selectedModel);
  }

  return {
    requestedExecutionMode: normalizedRequestedExecutionMode,
    resolvedExecutionMode,
    executor,
  };
}
