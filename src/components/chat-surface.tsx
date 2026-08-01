import {
  HStack,
  Image,
  ProgressView,
  ScrollView,
  Text,
  type TextFieldRef,
  useNativeState,
  VStack,
} from '@expo/ui/swift-ui';
import {
  defaultScrollAnchor,
  defaultScrollAnchorForRole,
  font,
  foregroundStyle,
  frame,
  id,
  lineLimit,
  onTapGesture,
  padding,
  scrollDismissesKeyboard,
  scrollPosition,
  scrollTargetLayout,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef } from 'react';
import { scheduleOnUI } from 'react-native-worklets';

import { ChatComposer } from '@/components/chat-composer';
import { MessageBubble } from '@/components/message-bubble';
import { type Agent } from '@/domain/poly';
import { useConversation } from '@/hooks/use-conversation';
import { useHostReveal } from '@/hooks/use-host-reveal';
import { type AgentActivity } from '@/network/poly-api';
import { type OnDeviceModel } from '@/services/on-device-ai';
import { useAppStore } from '@/state/app-store';
import { shouldAutoScrollToBottom } from '@/utils/chat-behavior';

export function ChatSurface({
  agents,
  isError,
  reconnecting,
  onDeviceModel,
}: {
  agents: Agent[];
  isError: boolean;
  reconnecting: boolean;
  onDeviceModel: OnDeviceModel | null;
}) {
  const connected = Boolean(onDeviceModel) || (Boolean(agents[0]) && !isError);
  const activeAgentId = useAppStore(
    (state) => state.activeAgentId,
  );
  const { revealed: hostRevealed, reveal: revealHost } = useHostReveal();

  const {
    messages,
    sending,
    canStop,
    activity,
    error,
    canRetry,
    sendMessage,
    retry,
    stop,
  } = useConversation(activeAgentId);

  const inputRef = useRef<TextFieldRef>(null);
  const previousBottomTarget = useRef<string | null>(null);
  const autoScrollRequested = useRef(false);
  const draft = useNativeState('');
  const scrollTarget = useNativeState<string | null>(null);
  const lastMessage = messages.at(-1);
  const bottomTarget = lastMessage
    ? `${lastMessage.id}:${lastMessage.content.length}`
    : null;

  useEffect(() => {
    if (!bottomTarget) {
      previousBottomTarget.current = null;
      return;
    }

    const shouldScroll = shouldAutoScrollToBottom(
      previousBottomTarget.current,
      autoScrollRequested.current,
    );
    previousBottomTarget.current = bottomTarget;
    if (!shouldScroll) return;

    scheduleOnUI((target: string) => {
      'worklet';
      scrollTarget.value = target;
    }, bottomTarget);

    if (!sending) autoScrollRequested.current = false;
  }, [bottomTarget, scrollTarget, sending]);

  const send = () => {
    const value = draft.get().trim();

    if (!value || sending) {
      return;
    }

    autoScrollRequested.current = true;
    sendMessage(value);

    draft.set('');
    void inputRef.current?.clear();
  };

  const dismissKeyboard = () => {
    void inputRef.current?.blur();
  };

  return (
    <VStack
      spacing={0}
      modifiers={[
        frame({
          maxWidth: Infinity,
          maxHeight: Infinity,
        }),
      ]}
    >
      <ScrollView
        showsIndicators={false}
        modifiers={[
          defaultScrollAnchor('top'),
          defaultScrollAnchorForRole('top', 'alignment'),
          defaultScrollAnchorForRole('bottom', 'sizeChanges'),
          scrollPosition(scrollTarget, { anchor: 'bottom' }),
          scrollDismissesKeyboard('interactively'),
          ...(messages.length > 0
            // Handler runs only when the native tap gesture fires, never during render.
            // eslint-disable-next-line react-hooks/refs
            ? [onTapGesture(dismissKeyboard)]
            : []),
        ]}
      >
        <VStack
          spacing={0}
          modifiers={[
            frame({
              maxWidth: Infinity,
              alignment: 'leading',
            }),
            padding({
              horizontal: 20,
              top: 18,
              bottom: 0,
            }),
            scrollTargetLayout(),
          ]}
        >
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              isStreaming={sending && message.id === messages.at(-1)?.id}
              message={message}
            />
          ))}

          {error ? (
            <Text
              modifiers={[
                font({ textStyle: 'footnote' }),
                foregroundStyle('secondary'),
                padding({ top: 4, bottom: 12 }),
                ...(canRetry ? [onTapGesture(() => retry())] : []),
              ]}
            >
              {error}{canRetry ? ' · Tap to retry' : ''}
            </Text>
          ) : null}

          {bottomTarget ? (
            <Text modifiers={[id(bottomTarget), frame({ height: 24 })]}> </Text>
          ) : null}
        </VStack>
      </ScrollView>

      <VStack
        spacing={0}
        modifiers={[
          frame({
            maxWidth: Infinity,
          }),
          padding({
            horizontal: 20,
            bottom: 6,
          }),
        ]}
      >
        {sending && activity ? (
          <HStack
            spacing={6}
            modifiers={[
              frame({ maxWidth: Infinity, alignment: 'leading' }),
              padding({ bottom: 5 }),
            ]}
          >
            <ProgressView />
            <Text
              modifiers={[
                font({ textStyle: 'caption2' }),
                foregroundStyle('secondary'),
                lineLimit(1),
              ]}
            >
              {activityLabel(activity)}
            </Text>
          </HStack>
        ) : null}

        <HStack
          alignment="center"
          spacing={4}
          modifiers={[
            frame({
              maxWidth: Infinity,
              alignment: 'leading',
            }),
            ...(connected && !onDeviceModel && !hostRevealed
              ? [onTapGesture(() => void revealHost())]
              : []),
          ]}
        >
          <Image
            systemName="circle.fill"
            size={7}
            modifiers={[
              foregroundStyle(connected ? 'primary' : 'secondary'),
            ]}
          />

          {onDeviceModel ? (
            <>
              <Text
                modifiers={[
                  font({
                    textStyle: 'caption2',
                  }),
                  foregroundStyle('secondary'),
                ]}
              >
                On-device ·
              </Text>
              <Text
                modifiers={[
                  font({
                    textStyle: 'caption2',
                  }),
                  foregroundStyle('secondary'),
                ]}
              >
                {onDeviceModel.label}
              </Text>
            </>
          ) : connected ? (
            <>
              <Text
                modifiers={[
                  font({
                    textStyle: 'caption2',
                  }),
                  foregroundStyle('secondary'),
                ]}
              >
                Connected ·
              </Text>

              <Text
                modifiers={[
                  font({
                    textStyle: 'caption2',
                  }),
                  foregroundStyle('secondary'),
                ]}
              >
                {hostRevealed
                  ? agents[0]?.host.replace(/^https?:\/\//, '')
                  : '•'.repeat(agents[0]?.host.replace(/^https?:\/\//, '').length ?? 0)}
              </Text>
            </>
          ) : (
            <Text
              modifiers={[
                font({
                  textStyle: 'caption2',
                }),
                foregroundStyle('secondary'),
              ]}
            >
              {reconnecting ? 'Reconnecting…' : 'Disconnected'}
            </Text>
          )}
        </HStack>
      </VStack>

      <VStack
        spacing={0}
        modifiers={[
          frame({
            maxWidth: Infinity,
          }),
          padding({
            horizontal: 16,
            top: 0,
            bottom: 10,
          }),
        ]}
      >
        <ChatComposer
          draft={draft}
          inputRef={inputRef}
          sending={sending}
          canStop={canStop}
          onSend={send}
          onStop={stop}
        />
      </VStack>
    </VStack>
  );
}

function activityLabel(activity: AgentActivity) {
  if (activity.kind === 'reasoning') return 'Thinking';
  if (activity.kind === 'reconnecting') return 'Reconnecting to response';
  if (activity.kind === 'terminal') return activity.command ? `Running ${activity.command}` : 'Running command';
  if (activity.kind === 'file') return activity.paths?.[0] ? `Editing ${activity.paths[0]}` : 'Editing files';
  return activity.text || (activity.kind === 'plan' ? 'Updating plan' : 'Working');
}
