interface PendingHealthCheck {
  agentId: string;
  resolve: (value: { agentId: string; message: string }) => void;
  reject: (reason?: unknown) => void;
  timeout: NodeJS.Timeout;
}

export class HealthcheckManager {
  private pending = new Map<string, PendingHealthCheck>();

  create(agentId: string, timeoutMs: number): {
    token: string;
    result: Promise<{ agentId: string; message: string }>;
  } {
    const token = `health-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const result = new Promise<{ agentId: string; message: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(token);
        reject(new Error(`Agent ${agentId} did not respond to healthcheck within ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(token, {
        agentId,
        resolve,
        reject,
        timeout,
      });
    });

    return { token, result };
  }

  resolve(token: string, agentId: string, message: string): boolean {
    const pending = this.pending.get(token);
    if (!pending || pending.agentId !== agentId) {
      return false;
    }

    clearTimeout(pending.timeout);
    this.pending.delete(token);
    pending.resolve({ agentId, message });
    return true;
  }

  destroy(reason: string): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
    }
    this.pending.clear();
  }
}
