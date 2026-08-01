import type { BuiltInModel, DownloadableModel } from 'expo-ai-kit';

import { getOnDeviceModelId, setOnDeviceModelId } from '@/data/settings-storage';
import { type ChatMessage } from '@/domain/poly';

export const ON_DEVICE_AGENT_ID = 'on-device';

export type OnDeviceModel = {
  id: string;
  label: string;
  detail: string;
  available: boolean;
  meetsRequirements: boolean;
  downloadable: boolean;
  status: DownloadableModel['status'] | 'ready' | 'unavailable';
  sizeBytes: number | null;
  license: string | null;
  contextWindow: number;
};

export type OnDeviceState = {
  nativeAvailable: boolean;
  available: boolean;
  models: OnDeviceModel[];
  selectedModelId: string | null;
  activeModelId: string | null;
};

type Kit = typeof import('expo-ai-kit');

let activeGeneration: Promise<string> | null = null;

export async function getOnDeviceState(): Promise<OnDeviceState> {
  try {
    const kit = await import('expo-ai-kit');
    const [nativeAvailable, builtIns, downloadable] = await Promise.all([
      kit.isAvailable().catch(() => false),
      kit.getBuiltInModels().catch(() => [] as BuiltInModel[]),
      kit.getDownloadableModels().catch(() => [] as DownloadableModel[]),
    ]);
    const models = [
      ...builtIns.map((model) => toBuiltInModel(model)),
      ...downloadable.map((model) => toDownloadableModel(model)),
    ];
    const activeModelId = readActiveModel(kit);
    const preferredModelId = getOnDeviceModelId();
    const selectedModelId = [preferredModelId, activeModelId, ...models.map(({ id }) => id)]
      .find((id) => models.some((model) => model.id === id && model.available)) ?? null;
    return {
      nativeAvailable,
      available: models.some((model) => model.available),
      models,
      selectedModelId,
      activeModelId,
    };
  } catch {
    return {
      nativeAvailable: false,
      available: false,
      models: [],
      selectedModelId: null,
      activeModelId: null,
    };
  }
}

export async function activateOnDeviceModel(modelId: string): Promise<void> {
  const kit = await import('expo-ai-kit');
  const state = await getOnDeviceState();
  const model = state.models.find((item) => item.id === modelId);
  if (!model?.available) throw new Error(`${model?.label ?? modelId} is not ready on this device.`);
  await kit.setModel(modelId);
  setOnDeviceModelId(modelId);
}

export async function downloadOnDeviceModel(
  modelId: string,
  onProgress: (progress: number) => void,
): Promise<void> {
  const kit = await import('expo-ai-kit');
  const models = await kit.getDownloadableModels();
  const model = models.find((item) => item.id === modelId);
  if (!model) throw new Error('That on-device model is not available for this platform.');
  if (!model.meetsRequirements) throw new Error(`${model.name} needs more device memory.`);
  await kit.downloadModel(modelId, { onProgress });
}

export async function cancelOnDeviceDownload(modelId: string): Promise<void> {
  const kit = await import('expo-ai-kit');
  await kit.cancelDownload(modelId);
}

export async function deleteOnDeviceModel(modelId: string): Promise<void> {
  const kit = await import('expo-ai-kit');
  await kit.deleteModel(modelId);
  if (getOnDeviceModelId() === modelId) setOnDeviceModelId(null);
}

export type OnDeviceStream = {
  promise: Promise<string>;
  stop: () => void;
};

export function streamOnDeviceMessage(
  history: Pick<ChatMessage, 'role' | 'content'>[],
  modelId: string,
  onChunk: (chunk: string) => void,
): OnDeviceStream {
  const controller = new AbortController();
  let stopped = false;
  const run = async () => {
    const contextWindow = (await getOnDeviceState()).models.find((model) => model.id === modelId)?.contextWindow ?? 4096;
    const boundedHistory = limitHistory(history, contextWindow);
    const [{ streamText }, { expoAiKit }] = await Promise.all([
      import('ai'),
      import('expo-ai-kit/ai'),
    ]);
    let streamError: unknown;
    const result = streamText({
      model: expoAiKit(modelId),
      messages: boundedHistory.map(({ role, content }) => ({ role, content })),
      abortSignal: controller.signal,
      onError: ({ error }) => {
        streamError = error;
      },
    });
    let content = '';
    try {
      for await (const chunk of result.textStream) {
        content += chunk;
        onChunk(chunk);
      }
    } catch (error) {
      throw toError(streamError ?? error);
    }
    if (streamError) throw toError(streamError);
    return content;
  };

  if (activeGeneration) {
    return {
      promise: Promise.reject(new Error('On-device AI is already generating a response.')),
      stop: () => undefined,
    };
  }
  const promise = run().finally(() => {
    if (activeGeneration === promise) activeGeneration = null;
  });
  activeGeneration = promise;
  return {
    promise,
    stop: () => {
      if (stopped) return;
      stopped = true;
      controller.abort();
    },
  };
}

function toBuiltInModel(model: BuiltInModel): OnDeviceModel {
  return {
    id: model.id,
    label: model.name,
    detail: `Built in · ${model.contextWindow.toLocaleString()} token context`,
    available: model.available,
    meetsRequirements: model.available,
    downloadable: false,
    status: model.available ? 'ready' : 'unavailable',
    sizeBytes: null,
    license: null,
    contextWindow: model.contextWindow,
  };
}

function toDownloadableModel(model: DownloadableModel): OnDeviceModel {
  const available = model.meetsRequirements && ['downloaded', 'loading', 'ready'].includes(model.status);
  return {
    id: model.id,
    label: model.name,
    detail: `${model.parameterCount} · ${formatBytes(model.sizeBytes)} · ${model.status}`,
    available,
    meetsRequirements: model.meetsRequirements,
    downloadable: true,
    status: model.status,
    sizeBytes: model.sizeBytes,
    license: model.license,
    contextWindow: model.contextWindow,
  };
}

function readActiveModel(kit: Kit): string | null {
  try {
    return kit.getActiveModel();
  } catch {
    return null;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1_000_000_000) return `${Math.round(bytes / 1_000_000)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}

function limitHistory(history: Pick<ChatMessage, 'role' | 'content'>[], contextWindow: number) {
  const maxChars = Math.max(128, Math.floor(contextWindow * 0.75));
  const systemContent = history
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n');
  const system = systemContent
    ? [{ role: 'system' as const, content: clipText(systemContent, Math.floor(maxChars * 0.25)) }]
    : [];
  const turns = history.filter((message) => message.role !== 'system');
  let remaining = maxChars - (system[0]?.content.length ?? 0);
  const selected: Pick<ChatMessage, 'role' | 'content'>[] = [];

  for (let end = turns.length - 1; end >= 0;) {
    const start = turns[end].role === 'assistant' && end > 0 && turns[end - 1].role === 'user'
      ? end - 1
      : end;
    const turn = turns.slice(start, end + 1);
    const size = turn.reduce((total, message) => total + message.content.length, 0);
    if (size > remaining) {
      if (selected.length > 0 || remaining <= 0) break;
      const perMessage = Math.max(1, Math.floor(remaining / turn.length));
      selected.unshift(...turn.map((message) => ({
        ...message,
        content: clipText(message.content, perMessage),
      })));
      break;
    }
    selected.unshift(...turn);
    remaining -= size;
    end = start - 1;
  }

  return [...system, ...selected];
}

function clipText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  if (maxChars <= 1) return value.slice(0, maxChars);
  return `${value.slice(0, maxChars - 1)}…`;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
