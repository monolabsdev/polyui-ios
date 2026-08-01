import { create } from 'zustand';

import { type ChatMessage } from '@/domain/poly';

type AppState = {
  activeAgentId: string | null;
  draft: string;
  messages: ChatMessage[];
  temporary: boolean;
  hostRevealed: boolean;
  setActiveAgent: (agentId: string) => void;
  setDraft: (draft: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  setTemporary: (temporary: boolean) => void;
  setHostRevealed: (revealed: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  activeAgentId: null,
  draft: '',
  messages: [],
  temporary: false,
  hostRevealed: false,
  setActiveAgent: (activeAgentId) => set({ activeAgentId }),
  setDraft: (draft) => set({ draft }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message], draft: '' })),
  setTemporary: (temporary) => set({ temporary }),
  setHostRevealed: (hostRevealed) => set({ hostRevealed }),
}));
