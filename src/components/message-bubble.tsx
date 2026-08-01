import {
  HStack,
  ProgressView,
  Spacer,
  Text,
} from '@expo/ui/swift-ui';
import {
  background,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  onLongPressGesture,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { ActionSheetIOS, PlatformColor } from 'react-native';

import { type ChatMessage } from '@/domain/poly';

export function MessageBubble({
  isStreaming = false,
  message,
}: {
  isStreaming?: boolean;
  message: ChatMessage;
}) {
  const isUser = message.role === 'user';

  const showActions = () => {
    void Haptics.selectionAsync();
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Copy', 'Cancel'], cancelButtonIndex: 1 },
      (index) => {
        if (index === 0) void Clipboard.setStringAsync(message.content);
      },
    );
  };

  if (isUser) {
    return (
      <HStack
        spacing={0}
        modifiers={[
          frame({
            maxWidth: Infinity,
            alignment: 'trailing',
          }),
          padding({
            top: 5,
            bottom: 15,
          }),
        ]}
      >
        <Spacer minLength={48} />

        <Text
          modifiers={[
            font({ textStyle: 'body' }),
            foregroundStyle('primary'),
            fixedSize({ horizontal: false, vertical: true }),
            padding({
              horizontal: 16,
              vertical: 10,
            }),
            background(
              PlatformColor('secondarySystemBackground'),
              shapes.roundedRectangle({
                cornerRadius: 20,
              }),
            ),
            onLongPressGesture(showActions),
          ]}
        >
          {message.content}
        </Text>
      </HStack>
    );
  }

  if (!message.content && isStreaming) {
    return (
      <HStack
        modifiers={[
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          padding({ top: 14, bottom: 18 }),
        ]}
      >
        <ProgressView />
      </HStack>
    );
  }

  return (
    <HStack
      spacing={0}
      modifiers={[
        frame({
          maxWidth: Infinity,
          alignment: 'leading',
        }),
        padding({
          top: 14,
          bottom: 18,
        }),
      ]}
    >
      <Text
        markdownEnabled={!isStreaming && Boolean(message.content)}
        modifiers={[
          font({ textStyle: 'body' }),
          foregroundStyle(message.content ? 'primary' : 'secondary'),
          frame({
            maxWidth: Infinity,
            alignment: 'leading',
          }),
          fixedSize({ horizontal: false, vertical: true }),
          onLongPressGesture(showActions),
        ]}
      >
        {message.content || 'Response unavailable.'}
      </Text>
    </HStack>
  );
}
