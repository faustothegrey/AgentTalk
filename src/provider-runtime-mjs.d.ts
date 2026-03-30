declare module '../../scripts/lib/provider-runtime.mjs' {
  export function getProviderCommand(
    providerName: string,
    selectedModel: string | null,
    userMessage: string,
  ): {
    command: string;
    args: string[];
    stdin: string | null;
  };
}
