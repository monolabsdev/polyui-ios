import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  fetchAgents,
  fetchHostRuntimes,
  selectHostRuntime,
  type RuntimeChoice,
} from '@/network/poly-api';
import { useAppStore } from '@/state/app-store';

export function useAgents() {
  const { data: agents = [], isError } = useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    retry: false,
    refetchInterval: (query) => {
      if (query.state.status === 'error') {
        const failures = query.state.fetchFailureCount;
        return Math.min(1_000 * 2 ** Math.min(failures - 1, 5), 32_000);
      }
      return 10_000;
    },
  });
  const activeAgentId = useAppStore((state) => state.activeAgentId);
  const setActiveAgent = useAppStore((state) => state.setActiveAgent);
  const runtimes = useQuery({
    queryKey: ['runtimes'],
    queryFn: fetchHostRuntimes,
    enabled: Boolean(agents[0]),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (agents[0] && !activeAgentId) setActiveAgent(agents[0].id);
  }, [activeAgentId, agents, setActiveAgent]);

  const reconnecting = Boolean(agents[0]) && isError;
  const chooseRuntime = async (choice: RuntimeChoice) => {
    await selectHostRuntime(choice);
    await runtimes.refetch();
  };

  return {
    agents,
    isError,
    reconnecting,
    runtimes: runtimes.data?.runtimes ?? [],
    selectedRuntime: runtimes.data?.selectedRuntime ?? null,
    chooseRuntime,
  };
}
