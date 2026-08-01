import {
  Button,
  HStack,
  Image,
  Menu,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  disabled,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
} from '@expo/ui/swift-ui/modifiers';

import { type Agent } from '@/domain/poly';
import { useHostReveal } from '@/hooks/use-host-reveal';
import { type RuntimeChoice } from '@/network/poly-api';
import { hapticPress } from '@/utils/haptics';

const HEADER_BUTTON_SIZE = 36;
const HEADER_ICON_SIZE = 20;

const headerButtonFrame = frame({
  width: HEADER_BUTTON_SIZE,
  height: HEADER_BUTTON_SIZE,
  alignment: 'center',
});

export function ChatHeader({
  agents,
  hasMessages,
  isError,
  isTemporary,
  runtimes,
  selectedRuntime,
  onPair,
  onSettings,
  onNewConversation,
  onSelectRuntime,
  onToggleTemporary,
}: {
  agents: Agent[];
  hasMessages: boolean;
  isError: boolean;
  isTemporary: boolean;
  runtimes: RuntimeChoice[];
  selectedRuntime: RuntimeChoice | null;
  onPair: () => void;
  onSettings: () => void;
  onNewConversation: () => void;
  onSelectRuntime: (runtime: RuntimeChoice) => void;
  onToggleTemporary: () => void;
}) {
  const { revealed: hostRevealed, reveal: revealHost } = useHostReveal();

  return (
    <VStack
      modifiers={[
        padding({
          horizontal: 20,
          top: 8,
          bottom: 6,
        }),
      ]}
    >
      <HStack alignment="center">
        <Menu
          label={
            <Image
              systemName="line.3.horizontal"
              size={HEADER_ICON_SIZE}
              modifiers={[headerButtonFrame]}
            />
          }
          modifiers={[
            buttonStyle('glass'),
            buttonBorderShape('circle'),
            accessibilityLabel('Open menu'),
          ]}
        >
          <Button
            label="New chat"
            systemImage="square.and.pencil"
            onPress={() => hapticPress(onNewConversation)}
            modifiers={[disabled(!hasMessages)]}
          />

          <Button
            label="Pair a host"
            systemImage="qrcode.viewfinder"
            onPress={() => hapticPress(onPair)}
          />

          <Button
            label="Settings"
            systemImage="gearshape"
            onPress={() => hapticPress(onSettings)}
          />
        </Menu>

        <Spacer />

        <Menu
          label={
            <VStack
              spacing={1}
              modifiers={[
                padding({
                  horizontal: 8,
                  vertical: 5,
                }),
              ]}
            >
              <HStack spacing={5}>
                <Text
                  modifiers={[
                    font({
                      textStyle: 'title3',
                      weight: 'semibold',
                    }),
                    frame({ maxWidth: 190 }),
                    lineLimit(1),
                  ]}
                >
                  {selectedRuntime?.label ?? 'Chat'}
                </Text>

                <Image
                  systemName="chevron.down"
                  size={12}
                  modifiers={[foregroundStyle('secondary')]}
                />
              </HStack>
            </VStack>
          }
          modifiers={[
            buttonStyle('plain'),
            accessibilityLabel(`Choose runtime. Current: ${selectedRuntime?.label ?? 'none'}`),
          ]}
        >
          <Button
            label={agents[0]?.name ?? 'No host paired'}
            systemImage="desktopcomputer"
          />

          {agents[0] ? (
            <Button onPress={() => void revealHost()}>
              <HStack spacing={6}>
                <Image
                  systemName={hostRevealed ? 'network' : 'lock.fill'}
                  size={16}
                />

                <Text
                  modifiers={[
                    font({
                      textStyle: 'body',
                    }),
                  ]}
                >
                  {hostRevealed
                    ? agents[0].host.replace(/^https?:\/\//, '')
                    : '•'.repeat(agents[0].host.replace(/^https?:\/\//, '').length)}
                </Text>
              </HStack>
            </Button>
          ) : null}

          {isError ? (
            <Button
              label="Host unavailable"
              systemImage="wifi.exclamationmark"
            />
          ) : null}

          {(['Coding agents', 'Cloud models', 'Local models'] as const).map((group) => {
            const choices = runtimes.filter((runtime) => runtime.group === group);
            return choices.length ? (
              <Section key={group} title={group}>
                {choices.map((runtime) => (
                  <Button
                    key={runtime.id}
                    label={`${runtime.label} · ${runtime.detail}`}
                    systemImage={selectedRuntime?.id === runtime.id
                      ? 'checkmark'
                      : runtime.kind === 'coding-agent' ? 'terminal' : 'cpu'}
                    onPress={() => hapticPress(() => onSelectRuntime(runtime))}
                    modifiers={[disabled(!runtime.available || !runtime.runtime)]}
                  />
                ))}
              </Section>
            ) : null;
          })}
        </Menu>

        <Spacer />

        {hasMessages ? (
          <Button
            onPress={() => hapticPress(onNewConversation)}
            modifiers={[
              buttonStyle('glass'),
              buttonBorderShape('circle'),
              accessibilityLabel('New conversation'),
            ]}
          >
            <Image
              systemName="square.and.pencil"
              size={HEADER_ICON_SIZE}
              modifiers={[headerButtonFrame]}
            />
          </Button>
        ) : (
          <Button
            onPress={() => hapticPress(onToggleTemporary)}
            modifiers={[
              buttonStyle('glass'),
              buttonBorderShape('circle'),
              accessibilityLabel(
                isTemporary ? 'Disable temporary chat' : 'Enable temporary chat',
              ),
            ]}
          >
            <Image
              systemName={isTemporary ? 'checkmark.circle.fill' : 'circle.dashed'}
              size={HEADER_ICON_SIZE}
              modifiers={[
                headerButtonFrame,
                foregroundStyle(isTemporary ? 'primary' : 'secondary'),
              ]}
            />
          </Button>
        )}
      </HStack>
    </VStack>
  );
}
