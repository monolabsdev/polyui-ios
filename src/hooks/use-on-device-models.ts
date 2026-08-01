import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  activateOnDeviceModel,
  cancelOnDeviceDownload,
  deleteOnDeviceModel,
  downloadOnDeviceModel,
  getOnDeviceState,
  ON_DEVICE_AGENT_ID,
  type OnDeviceModel,
} from '@/services/on-device-ai';
import { useAppStore } from '@/state/app-store';

export function useOnDeviceModels() {
  const queryClient = useQueryClient();
  const onDeviceMode = useAppStore((state) => state.onDeviceMode);
  const onDeviceModelId = useAppStore((state) => state.onDeviceModelId);
  const activeAgentId = useAppStore((state) => state.activeAgentId);
  const generationActive = useAppStore((state) => state.generationActive);
  const setOnDeviceMode = useAppStore((state) => state.setOnDeviceMode);
  const setOnDeviceModelId = useAppStore((state) => state.setOnDeviceModelId);
  const setActiveAgent = useAppStore((state) => state.setActiveAgent);
  const downloadingId = useAppStore((state) => state.onDeviceDownloadId);
  const downloadProgress = useAppStore((state) => state.onDeviceDownloadProgress);
  const setOnDeviceDownload = useAppStore((state) => state.setOnDeviceDownload);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['on-device-models'],
    queryFn: getOnDeviceState,
    retry: false,
    staleTime: 30_000,
  });
  const selectedModel = query.data?.models.find((model) => model.id === onDeviceModelId)
    ?? query.data?.models.find((model) => model.id === query.data.selectedModelId)
    ?? null;

  useEffect(() => {
    if (downloadingId || !query.data) return;
    const nativeDownload = query.data.models.find((model) => model.status === 'downloading');
    if (nativeDownload) setOnDeviceDownload(nativeDownload.id, 0);
  }, [downloadingId, query.data, setOnDeviceDownload]);

  const selectModel = async (model: OnDeviceModel) => {
    setError(null);
    try {
      await activateOnDeviceModel(model.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not activate on-device model.');
      throw cause;
    }
    setOnDeviceModelId(model.id);
    setOnDeviceMode(true);
    setActiveAgent(ON_DEVICE_AGENT_ID);
    await queryClient.invalidateQueries({ queryKey: ['on-device-models'] });
  };

  const downloadModel = async (model: OnDeviceModel) => {
    if (downloadingId) return;
    setError(null);
    setOnDeviceDownload(model.id, 0);
    try {
      await downloadOnDeviceModel(model.id, (progress) => setOnDeviceDownload(model.id, progress));
      await queryClient.invalidateQueries({ queryKey: ['on-device-models'] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Model download failed.');
    } finally {
      setOnDeviceDownload(null);
    }
  };

  const cancelDownload = async () => {
    if (!downloadingId) return;
    await cancelOnDeviceDownload(downloadingId).catch(() => undefined);
    setOnDeviceDownload(null);
    await queryClient.invalidateQueries({ queryKey: ['on-device-models'] });
  };

  const deleteModel = async (model: OnDeviceModel) => {
    setError(null);
    try {
      await deleteOnDeviceModel(model.id);
      if (onDeviceModelId === model.id) {
        setOnDeviceModelId(null);
        setOnDeviceMode(false);
        if (activeAgentId === ON_DEVICE_AGENT_ID) setActiveAgent(null);
      }
      await queryClient.invalidateQueries({ queryKey: ['on-device-models'] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove model.');
    }
  };

  return {
    models: query.data?.models ?? [],
    selectedModel,
    available: query.data?.available ?? false,
    nativeAvailable: query.data?.nativeAvailable ?? false,
    loading: query.isLoading,
    isError: query.isError,
    onDeviceMode,
    generationActive,
    downloadingId,
    downloadProgress,
    error,
    selectModel,
    downloadModel,
    cancelDownload,
    deleteModel,
    refresh: query.refetch,
  };
}
