import {
  Button,
  HStack,
  Image,
  TextField,
  type TextFieldRef,
  type useNativeState,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  background,
  buttonStyle,
  disabled,
  foregroundStyle,
  frame,
  glassEffect,
  lineLimit,
  padding,
  shapes,
  submitLabel,
  textFieldStyle,
} from '@expo/ui/swift-ui/modifiers';
import { type RefObject } from 'react';
import { PlatformColor } from 'react-native';

export function ChatComposer({
  draft,
  inputRef,
  sending,
  onSend,
}: {
  draft: ReturnType<typeof useNativeState<string>>;
  inputRef: RefObject<TextFieldRef | null>;
  sending: boolean;
  onSend: () => void;
}) {
  return (
    <HStack
      alignment="bottom"
      spacing={8}
      modifiers={[
        frame({
          maxWidth: Infinity,
        }),
        padding({
          horizontal: 12,
          vertical: 8,
        }),
        glassEffect({
          glass: {
            variant: 'regular',
            interactive: true,
          },
          shape: 'roundedRectangle',
          cornerRadius: 23,
        }),
      ]}
    >
      <TextField
        ref={inputRef}
        text={draft}
        placeholder="Ask anything"
        axis="vertical"
        modifiers={[
          textFieldStyle('plain'),
          submitLabel('return'),
          lineLimit({ min: 1, max: 5 }),
          frame({
            minHeight: 30,
            maxWidth: Infinity,
            alignment: 'center',
          }),
        ]}
      />

      <Button
        onPress={onSend}
        modifiers={[
          buttonStyle('plain'),
          background(PlatformColor('label'), shapes.circle()),
          disabled(sending),
          accessibilityLabel('Send message'),
        ]}
      >
        <Image
          systemName="arrow.up"
          size={14}
          modifiers={[
            frame({
              width: 30,
              height: 30,
              alignment: 'center',
            }),
            foregroundStyle(PlatformColor('systemBackground')),
          ]}
        />
      </Button>
    </HStack>
  );
}
