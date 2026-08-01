import { create } from 'zustand';

import {
  getOnDeviceMode,
  getOnDeviceModelId,
  setOnDeviceMode as persistOnDeviceMode,
  setOnDeviceModelId as persistOnDeviceModelId,
} from '@/data/settings-storage';
import { type ChatMessage } from '@/domain/poly';

type AppState = {
  activeAgentId: string | null;
  draft: string;
  messages: ChatMessage[];
  temporary: boolean;
  hostRevealed: boolean;
  onDeviceMode: boolean;
  onDeviceModelId: string | null;
  onDeviceDownloadId: string | null;
  onDeviceDownloadProgress: number;
  generationActive: boolean;
  setActiveAgent: (agentId: string | null) => void;
  setDraft: (draft: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  setTemporary: (temporary: boolean) => void;
  setHostRevealed: (revealed: boolean) => void;
  setOnDeviceMode: (enabled: boolean) => void;
  setOnDeviceModelId: (modelId: string | null) => void;
  setOnDeviceDownload: (modelId: string | null, progress?: number) => void;
  setGenerationActive: (active: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  activeAgentId: null,
  draft: '',
  messages: [],
  temporary: false,
  hostRevealed: false,
  onDeviceMode: getOnDeviceMode(),
  onDeviceModelId: getOnDeviceModelId(),
  onDeviceDownloadId: null,
  onDeviceDownloadProgress: 0,
  generationActive: false,
  setActiveAgent: (activeAgentId) => set({ activeAgentId }),
  setDraft: (draft) => set({ draft }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message], draft: '' })),
  setTemporary: (temporary) => set({ temporary }),
  setHostRevealed: (hostRevealed) => set({ hostRevealed }),
  setOnDeviceMode: (onDeviceMode) => {
    persistOnDeviceMode(onDeviceMode);
    set({ onDeviceMode });
  },
  setOnDeviceModelId: (onDeviceModelId) => {
    persistOnDeviceModelId(onDeviceModelId);
    set({ onDeviceModelId });
  },
  setOnDeviceDownload: (onDeviceDownloadId, onDeviceDownloadProgress = 0) => set({
    onDeviceDownloadId,
    onDeviceDownloadProgress,
  }),
  setGenerationActive: (generationActive) => set({ generationActive }),
}));
