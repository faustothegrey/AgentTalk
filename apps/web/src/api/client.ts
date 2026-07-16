export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed with status: ${response.status}`);
    }
    return response;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

export const api = {
  agents: {
    list: () => fetchWithTimeout('/api/agents').then(r => r.json()),
    create: (data: any) => fetchWithTimeout('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),
    start: (id: string, data: any) => fetchWithTimeout(`/api/agents/${id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),
    remove: (id: string) => fetchWithTimeout(`/api/agents/${id}`, {
      method: 'DELETE',
    }),
  },
  teams: {
    // BL-049: the endpoint existed server-side from the start, but nothing here ever called it —
    // leaving the UI with no way to resync teams after missing their broadcasts.
    list: () => fetchWithTimeout('/api/teams').then(r => r.json()),
    create: (data: any) => fetchWithTimeout('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),
    assignTask: (teamId: string, data: any) => fetchWithTimeout(`/api/teams/${teamId}/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),
  },
  conversations: {
    list: () => fetchWithTimeout('/api/conversations').then(r => r.json()),
    delete: (id: string) => fetchWithTimeout(`/api/conversations/${id}`, {
      method: 'DELETE',
    }),
  },
  scheduler: {
    list: () => fetchWithTimeout('/api/scheduler/jobs').then(r => r.json()),
    getStatus: () => fetchWithTimeout('/api/scheduler/status').then(r => r.json()),
    toggle: (enabled: boolean) => fetchWithTimeout('/api/scheduler/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }).then(r => r.json()),
    createJob: (data: any) => fetchWithTimeout('/api/scheduler/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),
    updateJob: (id: string, patch: any) => fetchWithTimeout(`/api/scheduler/jobs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(r => r.json()),
    runNow: (id: string) => fetchWithTimeout(`/api/scheduler/jobs/${encodeURIComponent(id)}/run`, {
      method: 'POST',
    }),
    deleteJob: (id: string) => fetchWithTimeout(`/api/scheduler/jobs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  },
  drive: {
    getStatus: () => fetchWithTimeout('/api/integrations/google-drive/status').then(r => r.json()),
    getResources: () => fetchWithTimeout('/api/integrations/google-drive/resources').then(r => r.json()),
  },
  usage: {
    capture: (data: any) => fetchWithTimeout('/api/usage-stats/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }, 80000).then(r => r.json()),
  },
};
