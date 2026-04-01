import type { AgentExecutionMode } from '../shared/types.js';
import type { ProcessSpawnOptions } from '../agents/process-adapter.js';

export function buildAgentCommand(provider: string, model: string): string {
  return `node scripts/llm-agent.mjs ${provider} --model ${model}`;
}

export function isBundledLlmAgentCommand(command: string): boolean {
  return command.trim().startsWith('node scripts/llm-agent.mjs');
}

export function buildProcessOptions(
  command: string,
  workingDirectory?: string,
  requestedExecutionMode?: AgentExecutionMode,
): ProcessSpawnOptions | undefined {
  if (isBundledLlmAgentCommand(command)) {
    return {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...(workingDirectory ? { AGENTTALK_WORKDIR: workingDirectory } : {}),
        ...(requestedExecutionMode ? { AGENTTALK_EXECUTION_MODE: requestedExecutionMode } : {}),
      },
    };
  }

  if (!workingDirectory) {
    return undefined;
  }

  return { cwd: workingDirectory };
}
