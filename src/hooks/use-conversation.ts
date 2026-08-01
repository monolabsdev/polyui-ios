import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Alert, AppState } from 'react-native';

import {
  cacheMessage,
  clearCachedMessages,
  loadCachedMessages,
  replaceCachedMessages,
} from '@/data/conversation-cache';
import { type ChatMessage } from '@/domain/poly';
import {
  approveHostRequest,
  loadHostMessages,
  sendHostMessage,
  startNewConversation,
} from '@/network/poly-api';
import { useAppStore } from '@/state/app-store';
import { shouldPulseStreamHaptic } from '@/utils/chat-behavior';

export function useConversation(activeAgentId: string | null) {
  const allMessages = useAppStore((state) => state.messages);
  const draft = useAppStore((state) => state.draft);
  const setDraft = useAppStore((state) => state.setDraft);
  const setMessages = useAppStore((state) => state.setMessages);
  const addMessage = useAppStore((state) => state.addMessage);
  const messages = useMemo(
    () => allMessages.filter((message) => message.agentId === activeAgentId),
    [activeAgentId, allMessages],
  );
  const temporary = useAppStore((state) => state.temporary);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedMessageId, setFailedMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeAgentId || sending || temporary) return;
    let cancelled = false;
    let syncing = false;
    let lastSnapshot: string | null = null;

    const sync = async () => {
      if (syncing) return;
      syncing = true;
      try {
        const remoteMessages = await loadHostMessages();
        const snapshot = JSON.stringify(remoteMessages);
        if (cancelled || snapshot === lastSnapshot) return;
        lastSnapshot = snapshot;
        const currentMessages = useAppStore.getState().messages.filter(
          (message) => message.agentId === activeAgentId,
        );
        if (JSON.stringify(currentMessages) !== snapshot) {
          setMessages(remoteMessages);
        }
        await replaceCachedMessages(activeAgentId, remoteMessages);
      } catch {
        const currentMessages = useAppStore.getState().messages.filter(
          (message) => message.agentId === activeAgentId,
        );
        if (!cancelled && currentMessages.length === 0) {
          const cachedMessages = await loadCachedMessages(activeAgentId);
          if (!cancelled) setMessages(cachedMessages);
        }
      } finally {
        syncing = false;
      }
    };

    void sync();
    const interval = setInterval(() => void sync(), 3_000);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      appState.remove();
    };
  }, [activeAgentId, sending, temporary, setMessages]);

  const send = (message: ChatMessage, history: ChatMessage[]) => {
    if (!activeAgentId || sending) return;
    setError(null);
    setFailedMessageId(null);
    const assistantId = Crypto.randomUUID();
    addMessage({ ...message, id: assistantId, role: 'assistant', content: '' });
    if (!temporary) void cacheMessage(message);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    let lastStreamHapticAt = Date.now();
    void sendHostMessage(
      history,
      message,
      (chunk) => {
        appendToMessage(assistantId, chunk);
        const now = Date.now();
        if (shouldPulseStreamHaptic(lastStreamHapticAt, now)) {
          lastStreamHapticAt = now;
          void Haptics.selectionAsync();
        }
      },
      (id, finalContent) => {
        replaceMessage(assistantId, { id, content: finalContent });
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      },
      (approval) => {
        const detail = [approval.command, approval.paths?.join('\n'), approval.cwd]
          .filter(Boolean)
          .join('\n\n');
        const respond = (approved: boolean) => {
          void approveHostRequest(approval, approved).catch((cause: unknown) => {
            setError(cause instanceof Error ? cause.message : 'Could not answer agent approval.');
          });
        };
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(approval.action ?? 'Agent approval', detail || 'Allow this agent action?', [
          {
            text: 'Deny',
            style: 'cancel',
            onPress: () => respond(false),
          },
          {
            text: 'Allow',
            onPress: () => respond(true),
          },
        ], { cancelable: false });
      },
    )
      .catch((cause: unknown) => {
        removeMessage(assistantId);
        setFailedMessageId(message.id);
        setError(cause instanceof Error ? cause.message : 'Poly host chat failed.');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      })
      .finally(() => setSending(false));
  };

  const sendMessage = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || !activeAgentId || sending) return;
    const message: ChatMessage = {
      id: Crypto.randomUUID(),
      agentId: activeAgentId,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    addMessage(message);
    send(message, messages);
  };

  const retry = () => {
    const state = useAppStore.getState();
    if (sending || !failedMessageId) return;
    const message = state.messages.find((item) => item.id === failedMessageId);
    if (!message || !activeAgentId) return;
    const history = state.messages.filter(
      (item) => item.agentId === activeAgentId && item.id !== failedMessageId,
    );
    send(message, history);
  };

  return { messages, draft, setDraft, sending, error, sendMessage, retry };
}

export async function createNewConversation(activeAgentId: string | null, isTemporary: boolean) {
  if (!activeAgentId) return;
  const hasMessages = useAppStore
    .getState()
    .messages.some((message) => message.agentId === activeAgentId);
  if (!hasMessages) return;
  await startNewConversation(isTemporary);
  await clearCachedMessages(activeAgentId);
  useAppStore.setState((state) => ({
    messages: state.messages.filter((message) => message.agentId !== activeAgentId),
    draft: '',
  }));
}

function appendToMessage(id: string, chunk: string) {
  useAppStore.setState((state) => ({
    messages: state.messages.map((item) =>
      item.id === id ? { ...item, content: item.content + chunk } : item,
    ),
  }));
}

function replaceMessage(id: string, patch: Partial<ChatMessage>) {
  useAppStore.setState((state) => ({
    messages: state.messages.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    ),
  }));
}

function removeMessage(id: string) {
  useAppStore.setState((state) => ({
    messages: state.messages.filter((item) => item.id !== id),
  }));
}
