import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useOnDeviceModels } from '@/hooks/use-on-device-models';
import {
  fetchAgents,
  fetchHostRuntimes,
  selectHostRuntime,
  syncHostConversations,
  type RuntimeChoice,
} from '@/network/poly-api';
import { ON_DEVICE_AGENT_ID, type OnDeviceModel } from '@/services/on-device-ai';
import { useAppStore } from '@/state/app-store';

export function useAgents() {
  const agentsQuery = useQuery({
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
  const agents = agentsQuery.data ?? [];
  const firstAgentId = agents[0]?.id;
  const { isError } = agentsQuery;
  const activeAgentId = useAppStore((state) => state.activeAgentId);
  const onDeviceModelId = useAppStore((state) => state.onDeviceModelId);
  const setActiveAgent = useAppStore((state) => state.setActiveAgent);
  const setOnDeviceMode = useAppStore((state) => state.setOnDeviceMode);
  const setOnDeviceModelId = useAppStore((state) => state.setOnDeviceModelId);
  const onDevice = useOnDeviceModels();
  const runtimes = useQuery({
    queryKey: ['runtimes'],
    queryFn: fetchHostRuntimes,
    enabled: Boolean(agents[0]),
    staleTime: 30_000,
  });
  useQuery({
    queryKey: ['conversation-sync'],
    queryFn: syncHostConversations,
    enabled: Boolean(agents[0]),
    retry: false,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (activeAgentId) return;
    if (onDevice.onDeviceMode) {
      if (onDevice.loading) return;
      if (onDevice.selectedModel?.available) {
        if (onDeviceModelId !== onDevice.selectedModel.id) setOnDeviceModelId(onDevice.selectedModel.id);
        setActiveAgent(ON_DEVICE_AGENT_ID);
        return;
      }
      setOnDeviceMode(false);
    }
    if (!agentsQuery.isFetched) return;
    if (firstAgentId) {
      setActiveAgent(firstAgentId);
    } else if (onDevice.selectedModel?.available) {
      setOnDeviceModelId(onDevice.selectedModel.id);
      setOnDeviceMode(true);
      setActiveAgent(ON_DEVICE_AGENT_ID);
    }
  }, [activeAgentId, agentsQuery.isFetched, firstAgentId, onDevice.loading, onDevice.onDeviceMode, onDevice.selectedModel, onDeviceModelId, setActiveAgent, setOnDeviceMode, setOnDeviceModelId]);

  const reconnecting = Boolean(agents[0]) && isError;
  const chooseRuntime = async (choice: RuntimeChoice) => {
    setOnDeviceMode(false);
    if (agents[0]) setActiveAgent(agents[0].id);
    await selectHostRuntime(choice);
    await runtimes.refetch();
  };

  const chooseOnDeviceModel = async (model: OnDeviceModel) => {
    await onDevice.selectModel(model);
    setActiveAgent(ON_DEVICE_AGENT_ID);
  };
  const selectedOnDeviceModel = activeAgentId === ON_DEVICE_AGENT_ID && onDevice.onDeviceMode
    ? onDevice.selectedModel
    : null;

  return {
    agents,
    isError,
    reconnecting,
    runtimes: runtimes.data?.runtimes ?? [],
    selectedRuntime: runtimes.data?.selectedRuntime ?? null,
    chooseRuntime,
    chooseOnDeviceModel,
    onDeviceModels: onDevice.models,
    selectedOnDeviceModel,
    onDeviceAvailable: onDevice.available,
    usingOnDevice: Boolean(selectedOnDeviceModel?.available),
    generationActive: onDevice.generationActive,
    onDevice,
  };
}
