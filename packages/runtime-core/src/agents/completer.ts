import { Agent } from './agent.js';
import { callApi, type ApiProvider } from './api-client.js';
import type { Registry } from '../registry/registry.js';

export interface CompleterResult {
  text: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export interface CompleterOptions {
  expectsStructured?: boolean;
}

export interface Completer {
  maintainsSession?: boolean;
  complete(prompt: string, opts?: CompleterOptions): Promise<CompleterResult>;
}

export class ApiCompleter implements Completer {
  maintainsSession = false;
  constructor(private provider: ApiProvider, private model?: string, private fetchFn: typeof fetch = fetch) {}

  async complete(prompt: string, opts?: CompleterOptions): Promise<CompleterResult> {
    const args: any = {
      provider: this.provider,
      messages: [{ role: 'user', content: prompt }],
    };
    if (this.model) args.model = this.model;
    if (opts?.expectsStructured) args.response_format = { type: 'json_object' };

    const result = await callApi(args, this.fetchFn);
    
    const ret: CompleterResult = { text: result.text || '' };
    if (result.usage) ret.usage = result.usage;
    return ret;
  }
}

export class CliExecCompleter implements Completer {
  maintainsSession = true;
  constructor(private agent: Agent, private registry: Registry) {}

  async complete(prompt: string, _opts?: CompleterOptions): Promise<CompleterResult> {
    return new Promise((resolve) => {
      const onResult = (result: { agentId: string; text: string; usage?: any }) => {
        if (result.agentId === this.agent.id) {
          this.registry.off('exec_result', onResult);
          resolve({ text: result.text, usage: result.usage });
        }
      };
      
      this.registry.on('exec_result', onResult);
      
      this.agent.queueExecTurn({
        type: 'exec_rpc',
        prompt,
      });
    });
  }
}
