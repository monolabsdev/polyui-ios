import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  cancelHostRequest,
  loadHostMessages,
  loadPairedHost,
  loadStoredHostMessages,
  selectHostConversation,
  sendHostMessage,
  startNewConversation,
  type AgentActivity,
  type HostConversation,
  HostJobPendingError,
} from '@/network/poly-api';
import { useAppStore } from '@/state/app-store';
import { beginForegroundApproval } from '@/services/notifications';
import { ON_DEVICE_AGENT_ID, streamOnDeviceMessage } from '@/services/on-device-ai';
import { shouldPulseStreamHaptic } from '@/utils/chat-behavior';

export function useConversation(activeAgentId: string | null) {
  const allMessages = useAppStore((state) => state.messages);
  const draft = useAppStore((state) => state.draft);
  const setDraft = useAppStore((state) => state.setDraft);
  const setMessages = useAppStore((state) => state.setMessages);
  const addMessage = useAppStore((state) => state.addMessage);
  const setGenerationActive = useAppStore((state) => state.setGenerationActive);
  const messages = useMemo(
    () => allMessages.filter((message) => message.agentId === activeAgentId),
    [activeAgentId, allMessages],
  );
  const temporary = useAppStore((state) => state.temporary);
  const onDeviceModelId = useAppStore((state) => state.onDeviceModelId);
  const [sending, setSending] = useState(false);
  const [jobPending, setJobPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedMessageId, setFailedMessageId] = useState<string | null>(null);
  const [activity, setActivity] = useState<AgentActivity | null>(null);
  const [canStop, setCanStop] = useState(false);
  const activeRequestId = useRef<string | null>(null);
  const activeLocalStop = useRef<(() => void) | null>(null);
  const activeApprovalEnd = useRef<(() => void) | null>(null);
  const preservedPartial = useRef<{ userId: string } | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    if (!activeAgentId || sending || temporary) return;
    if (activeAgentId === ON_DEVICE_AGENT_ID) {
      let cancelled = false;
      void loadCachedMessages(ON_DEVICE_AGENT_ID).then((cachedMessages) => {
        if (cancelled || useAppStore.getState().messages.some((message) => message.agentId === ON_DEVICE_AGENT_ID)) return;
        setMessages([
          ...useAppStore.getState().messages.filter((message) => message.agentId !== ON_DEVICE_AGENT_ID),
          ...cachedMessages,
        ]);
      });
      return () => {
        cancelled = true;
      };
    }
    let cancelled = false;
    let syncing = false;
    let lastSnapshot: string | null = null;

    const sync = async () => {
      if (syncing) return;
      syncing = true;
      try {
        const remoteMessages = await loadHostMessages();
        const preserved = preservedPartial.current;
        if (preserved) {
          const userIndex = remoteMessages.findIndex((message) => message.id === preserved.userId);
          const hasFinalAssistant = userIndex >= 0
            && remoteMessages.slice(userIndex + 1).some((message) => message.role === 'assistant');
          if (userIndex < 0 || !hasFinalAssistant) return;
          preservedPartial.current = null;
          activeRequestId.current = null;
          setCanStop(false);
          setJobPending(false);
          setError(null);
          setGenerationActive(false);
        }
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
  }, [activeAgentId, sending, temporary, setGenerationActive, setMessages]);

  const send = (message: ChatMessage, history: ChatMessage[]) => {
    if (!activeAgentId || sending || jobPending) return;
    setError(null);
    setFailedMessageId(null);
    setActivity(null);
    setCanStop(false);
    setJobPending(false);
    preservedPartial.current = null;
    activeApprovalEnd.current?.();
    activeApprovalEnd.current = null;
    activeLocalStop.current = null;
    stopped.current = false;
    const assistantId = Crypto.randomUUID();
    addMessage({ ...message, id: assistantId, role: 'assistant', content: '' });
    if (!temporary) void cacheMessage(message);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGenerationActive(true);
    setSending(true);
    let lastStreamHapticAt = Date.now();
    let remainsActive = false;
    const local = activeAgentId === ON_DEVICE_AGENT_ID;
    const sendPromise = local
      ? (() => {
        const stream = streamOnDeviceMessage(
          [...history, message],
          onDeviceModelId ?? 'apple-fm',
          (chunk) => {
            appendToMessage(assistantId, chunk);
            const now = Date.now();
            if (shouldPulseStreamHaptic(lastStreamHapticAt, now)) {
              lastStreamHapticAt = now;
              void Haptics.selectionAsync();
            }
          },
        );
        activeLocalStop.current = stream.stop;
        setCanStop(true);
        return stream.promise.then((content) => {
          const assistant: ChatMessage = {
            id: assistantId,
            agentId: ON_DEVICE_AGENT_ID,
            role: 'assistant',
            content,
            createdAt: new Date().toISOString(),
          };
          replaceMessage(assistantId, { content });
          if (!temporary) void cacheMessage(assistant);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
        });
      })()
      : sendHostMessage(
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
        (content) => replaceMessage(assistantId, { content }),
        (id, finalContent) => {
          replaceMessage(assistantId, { id, content: finalContent });
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
        },
        (requestId) => {
          activeRequestId.current = requestId;
          setCanStop(true);
        },
        (nextActivity) => {
          setActivity(['complete', 'completed', 'done'].includes(nextActivity.status ?? '')
            ? null
            : nextActivity);
        },
        (approval) => {
          const endApproval = beginForegroundApproval(approval.approvalId);
          if (!endApproval) return;
          activeApprovalEnd.current = endApproval;
          const detail = [approval.command, approval.paths?.join('\n'), approval.cwd]
            .filter(Boolean)
            .join('\n\n');
          const respond = (approved: boolean) => {
            endApproval();
            activeApprovalEnd.current = null;
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
      );
    void sendPromise
      .catch((cause: unknown) => {
        if (cause instanceof HostJobPendingError) {
          remainsActive = true;
          preservedPartial.current = { userId: message.id };
          activeRequestId.current = cause.requestId;
          setCanStop(true);
          setJobPending(true);
          setActivity({ kind: 'reconnecting', status: 'running' });
          setError(cause.message);
          return;
        }
        if (stopped.current) {
          const assistant = useAppStore.getState().messages.find((item) => item.id === assistantId);
          if (!assistant?.content) removeMessage(assistantId);
          else if (local && !temporary) void cacheMessage(assistant);
          return;
        }
        const assistant = useAppStore.getState().messages.find((item) => item.id === assistantId);
        if (assistant?.content) {
          preservedPartial.current = { userId: message.id };
          setFailedMessageId(null);
        } else {
          removeMessage(assistantId);
          setFailedMessageId(message.id);
        }
        setError(cause instanceof Error ? cause.message : 'Poly host chat failed.');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      })
      .finally(() => {
        activeApprovalEnd.current?.();
        activeApprovalEnd.current = null;
        activeLocalStop.current = null;
        if (!remainsActive) {
          activeRequestId.current = null;
          setCanStop(false);
          setActivity(null);
        }
        setGenerationActive(remainsActive);
        setSending(false);
      });
  };

  const sendMessage = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || !activeAgentId || sending || jobPending) return;
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
    if (sending || jobPending || !failedMessageId) return;
    const message = state.messages.find((item) => item.id === failedMessageId);
    if (!message || !activeAgentId) return;
    const history = state.messages.filter(
      (item) => item.agentId === activeAgentId && item.id !== failedMessageId,
    );
    send(message, history);
  };

  const stop = () => {
    if (activeLocalStop.current) {
      stopped.current = true;
      setCanStop(false);
      activeLocalStop.current();
      return;
    }
    const requestId = activeRequestId.current;
    if (!requestId) return;
    stopped.current = true;
    setCanStop(false);
    setActivity({ kind: 'task', text: 'Stopping', status: 'running' });
    void cancelHostRequest(requestId)
      .then(() => {
        activeRequestId.current = null;
        preservedPartial.current = null;
        setJobPending(false);
        setGenerationActive(false);
        setCanStop(false);
        setActivity(null);
        setError(null);
      })
      .catch((cause: unknown) => {
        stopped.current = false;
        setCanStop(true);
        setError(cause instanceof Error ? cause.message : 'Could not stop request.');
      });
  };

  return {
    messages,
    draft,
    setDraft,
    sending: sending || jobPending,
    canStop,
    activity,
    error,
    canRetry: Boolean(failedMessageId),
    sendMessage,
    retry,
    stop,
  };
}

export async function createNewConversation(activeAgentId: string | null, isTemporary: boolean) {
  if (!activeAgentId) return;
  if (useAppStore.getState().generationActive) return;
  const hasMessages = useAppStore
    .getState()
    .messages.some((message) => message.agentId === activeAgentId);
  if (!hasMessages) return;
  if (activeAgentId === ON_DEVICE_AGENT_ID) {
    await clearCachedMessages(activeAgentId);
    useAppStore.setState((state) => ({
      messages: state.messages.filter((message) => message.agentId !== activeAgentId),
      draft: '',
      temporary: isTemporary,
    }));
    return;
  }
  await startNewConversation(isTemporary);
  await clearCachedMessages(activeAgentId);
  useAppStore.setState((state) => ({
    messages: state.messages.filter((message) => message.agentId !== activeAgentId),
    draft: '',
  }));
}

export async function switchToOnDeviceConversation(sourceAgentId: string | null) {
  const state = useAppStore.getState();
  const localMessages = await loadCachedMessages(ON_DEVICE_AGENT_ID);
  const sourceMessages = sourceAgentId
    ? state.messages.filter((message) => message.agentId === sourceAgentId)
    : [];
  const messages = localMessages.length
    ? localMessages
    : sourceMessages.map((message) => ({
      ...message,
      id: Crypto.randomUUID(),
      agentId: ON_DEVICE_AGENT_ID,
    }));
  if (!localMessages.length && messages.length) {
    await replaceCachedMessages(ON_DEVICE_AGENT_ID, messages);
  }
  useAppStore.setState((current) => ({
    activeAgentId: ON_DEVICE_AGENT_ID,
    messages: [
      ...current.messages.filter((message) => message.agentId !== sourceAgentId && message.agentId !== ON_DEVICE_AGENT_ID),
      ...messages,
    ],
    temporary: false,
  }));
}

export async function openHostConversation(
  activeAgentId: string | null,
  conversation?: HostConversation,
) {
  if (useAppStore.getState().generationActive) {
    throw new Error('Finish the current response before switching chats.');
  }
  const host = await loadPairedHost();
  const agentId = activeAgentId && activeAgentId !== ON_DEVICE_AGENT_ID
    ? activeAgentId
    : host?.id;
  if (!agentId) return;
  if (conversation) await selectHostConversation(conversation);
  const messages = conversation
    ? await loadStoredHostMessages(conversation.id)
    : await loadHostMessages();
  await replaceCachedMessages(agentId, messages);
  useAppStore.setState((state) => ({
    messages: [
      ...state.messages.filter((message) => message.agentId !== agentId),
      ...messages,
    ],
    activeAgentId: agentId,
    temporary: false,
    draft: '',
  }));
  useAppStore.getState().setOnDeviceMode(false);
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
