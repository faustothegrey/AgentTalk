import { useState, useCallback } from 'react';
import { api } from '../api/client';
import { Agent } from '../api/types';

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.agents.list();
      setAgents(data);
    } catch (err) {
      console.error('[useAgents] Failed to fetch agents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const removeAgent = useCallback(async (id: string) => {
    try {
      await api.agents.remove(id);
      setAgents(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('[useAgents] Failed to remove agent:', err);
      throw err;
    }
  }, []);

  const updateAgentStatus = useCallback((id: string, status: string) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  }, []);

  const updateAgentUsage = useCallback((id: string, usage: { total: number; limit: number }) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, usage } : a));
  }, []);

  return {
    agents,
    setAgents,
    loading,
    fetchAgents,
    removeAgent,
    updateAgentStatus,
    updateAgentUsage,
  };
}
