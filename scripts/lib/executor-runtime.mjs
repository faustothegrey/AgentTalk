import { spawn } from 'child_process';
import { callProvider } from './provider-runtime.mjs';

export const EXECUTION_MODES = ['interactive', 'one_shot', 'auto'];

export function normalizeRequestedExecutionMode(value) {
  return EXECUTION_MODES.includes(value) ? value : 'auto';
}

export function supportsInteractiveExecution(providerName) {
  return providerName === 'claude' || providerName === 'codex';
}

export function resolveExecutionMode(requestedExecutionMode, providerName) {
  const normalizedRequestedMode = normalizeRequestedExecutionMode(requestedExecutionMode);
  if (normalizedRequestedMode === 'one_shot') {
    return 'one_shot';
  }

  if (supportsInteractiveExecution(providerName)) {
    return 'interactive';
  }

  return 'one_shot';
}

function getInteractiveProviderCommand(providerName, selectedModel) {
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

  throw new Error(`Interactive execution is not implemented for provider: ${providerName}`);
}

function extractAssistantText(event) {
  const content = event?.message?.content;
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .filter((entry) => entry?.type === 'text' && typeof entry.text === 'string')
    .map((entry) => entry.text)
    .join('');
}

class OneShotExecutor {
  #providerName;
  #selectedModel;
  #status = 'starting';

  constructor(providerName, selectedModel) {
    this.#providerName = providerName;
    this.#selectedModel = selectedModel;
  }

  async initialize() {
    this.#status = 'ready';
  }

  async executeTurn(request, sink = {}) {
    this.#status = 'busy';
    sink.onReplyStart?.({ id: request.id });

    try {
      const result = await callProvider(this.#providerName, this.#selectedModel, request.prompt, {
        onStderrChunk: request.onStderrChunk,
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

  getStatus() {
    return this.#status;
  }

  async close() {}
}

class BaseInteractiveExecutor {
  _providerName;
  _selectedModel;
  _commandOverride;
  _status = 'starting';
  _proc = null;
  _buffer = '';
  _currentRequest = null;
  _currentSink = null;
  _initialized = false;
  _closePromise = null;

  constructor(providerName, selectedModel, commandOverride) {
    this._providerName = providerName;
    this._selectedModel = selectedModel;
    this._commandOverride = commandOverride;
  }

  async initialize() {
    if (this._initialized) {
      return;
    }

    const { command, args, env } = this._commandOverride || getInteractiveProviderCommand(this._providerName, this._selectedModel);
    this._proc = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this._proc.stdout?.on('data', (chunk) => {
      this._buffer += chunk.toString();
      this._drainStdout();
    });

    this._proc.stderr?.on('data', (chunk) => {
      const text = chunk.toString();
      if (this._currentRequest?.onStderrChunk) {
        this._currentRequest.onStderrChunk(text);
      } else {
        process.stderr.write(text);
      }
    });

    this._proc.on('error', (err) => {
      this._status = 'error';
      this._rejectCurrentRequest(err);
    });

    this._proc.on('close', (code) => {
      if (this._status === 'terminated') return;
      const err = new Error(`Interactive ${this._providerName} session exited with code ${code}`);
      this._status = 'error';
      this._rejectCurrentRequest(err);
    });

    await this._onSpawned();

    this._initialized = true;
    this._status = 'ready';
  }

  async _onSpawned() {
    // Hooks for sub-classes
  }

  getStatus() {
    return this._status;
  }

  async close() {
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

  _drainStdout() {
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

  _handleEvent(event) {
    throw new Error('_handleEvent must be implemented by subclass');
  }

  _rejectCurrentRequest(err) {
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

  _clearCurrentRequest() {
    this._currentRequest = null;
    this._currentSink = null;
  }

  _sendToStdin(payload) {
    if (!this._proc?.stdin || this._proc.stdin.destroyed) {
      throw new Error(`Interactive ${this._providerName} session is not available`);
    }
    this._proc.stdin.write(JSON.stringify(payload) + '\n');
  }
}

class ClaudeInteractiveExecutor extends BaseInteractiveExecutor {
  async executeTurn(request, sink = {}) {
    if (this._currentRequest) {
      throw new Error(`Interactive ${this._providerName} session is already processing a request`);
    }

    this._status = 'busy';
    this._currentSink = sink;
    sink.onReplyStart?.({ id: request.id });

    const payload = {
      type: 'user',
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

  _handleEvent(event) {
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
  #threadId = null;
  #rpcId = 0;
  #pendingRpc = new Map();

  async _onSpawned() {
    await this.#callRpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'AgentTalk', version: '1.0' },
    });
  }

  async executeTurn(request, sink = {}) {
    if (this._currentRequest) {
      throw new Error(`Interactive ${this._providerName} session is already processing a request`);
    }

    this._status = 'busy';
    this._currentSink = sink;
    sink.onReplyStart?.({ id: request.id });

    const toolName = this.#threadId ? 'codex-reply' : 'codex';
    const toolArgs = this.#threadId
      ? { threadId: this.#threadId, prompt: request.prompt }
      : { prompt: request.prompt };

    return new Promise((resolve, reject) => {
      this._currentRequest = {
        ...request,
        responseText: '',
        resolve,
        reject,
      };

      this.#callRpc('tools/call', { name: toolName, arguments: toolArgs }).then(
        (result) => {
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
            tokens: currentRequest.lastTokens,
            tokenDetails: currentRequest.lastTokenDetails,
          });
        },
        (err) => {
          this._status = 'error';
          this._rejectCurrentRequest(err);
        }
      );
    });
  }

  #callRpc(method, params) {
    const id = ++this.#rpcId;
    return new Promise((resolve, reject) => {
      this.#pendingRpc.set(id, { resolve, reject });
      this._sendToStdin({ jsonrpc: '2.0', method, params, id });
    });
  }

  _handleEvent(event) {
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

export function createExecutor({
  providerName,
  selectedModel,
  requestedExecutionMode,
  interactiveCommandOverride,
}) {
  const normalizedRequestedExecutionMode = normalizeRequestedExecutionMode(requestedExecutionMode);
  const resolvedExecutionMode = resolveExecutionMode(normalizedRequestedExecutionMode, providerName);

  let executor;
  if (resolvedExecutionMode === 'interactive') {
    if (providerName === 'claude') {
      executor = new ClaudeInteractiveExecutor(providerName, selectedModel, interactiveCommandOverride);
    } else if (providerName === 'codex') {
      executor = new CodexInteractiveExecutor(providerName, selectedModel, interactiveCommandOverride);
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

