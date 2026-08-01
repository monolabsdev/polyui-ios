import {
  BottomSheet,
  Host,
  VStack,
} from '@expo/ui/swift-ui';
import {
  frame,
} from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, PlatformColor } from 'react-native';

import { ChatHeader } from '@/components/chat-header';
import { ChatSurface } from '@/components/chat-surface';
import PairingContent from '@/components/pairing-content';
import { useAgents } from '@/hooks/use-agents';
import { createNewConversation, switchToOnDeviceConversation } from '@/hooks/use-conversation';
import { setConversationTemporary, type RuntimeChoice } from '@/network/poly-api';
import { ON_DEVICE_AGENT_ID, type OnDeviceModel } from '@/services/on-device-ai';
import { useAppStore } from '@/state/app-store';

export default function HomeScreen() {
  const router = useRouter();
  const [pairingPresented, setPairingPresented] = useState(false);

  const activeAgentId = useAppStore((state) => state.activeAgentId);
  const hasMessages = useAppStore((state) =>
    state.messages.some((message) => message.agentId === state.activeAgentId),
  );
  const temporary = useAppStore((state) => state.temporary);
  const setTemporary = useAppStore((state) => state.setTemporary);
  const {
    agents,
    isError,
    reconnecting,
    runtimes,
    selectedRuntime,
    chooseRuntime,
    chooseOnDeviceModel,
    onDeviceModels,
    selectedOnDeviceModel,
    usingOnDevice,
    generationActive,
  } = useAgents();
  const changeOnDeviceModel = async (model: OnDeviceModel) => {
    const sourceAgentId = activeAgentId;
    await chooseOnDeviceModel(model);
    await switchToOnDeviceConversation(sourceAgentId);
  };

  const toggleTemporary = () => {
    const next = !temporary;
    setTemporary(next);
    if (hasMessages) {
      void createNewConversation(activeAgentId, next);
    } else if (activeAgentId && activeAgentId !== ON_DEVICE_AGENT_ID) {
      void setConversationTemporary(next);
    }
  };

  const changeRuntime = async (runtime: RuntimeChoice) => {
    if (!runtime.runtime) return;
    if (activeAgentId !== ON_DEVICE_AGENT_ID && hasMessages && selectedRuntime?.runtime?.kind !== runtime.runtime.kind) {
      await createNewConversation(activeAgentId, temporary);
    }
    await chooseRuntime(runtime);
  };

  return (
    <Host style={{ flex: 1 }} seedColor={PlatformColor('label')}>
      <VStack
        spacing={0}
        modifiers={[
          frame({
            maxWidth: Infinity,
            maxHeight: Infinity,
          }),
        ]}
      >
        <ChatHeader
          agents={agents}
          hasMessages={hasMessages}
          isError={isError}
          isTemporary={temporary}
          runtimes={runtimes}
          selectedRuntime={selectedRuntime}
          onDeviceModels={onDeviceModels}
          selectedOnDeviceModel={selectedOnDeviceModel}
          generationActive={generationActive}
          onPair={() => setPairingPresented(true)}
          onChats={() => router.push('/conversations')}
          onSettings={() => {
            useAppStore.getState().setHostRevealed(false);
            router.push('/settings');
          }}
          onNewConversation={() => void createNewConversation(activeAgentId, temporary)}
          onSelectRuntime={(runtime) => void changeRuntime(runtime).catch(() => undefined)}
          onSelectOnDeviceModel={(model) => void changeOnDeviceModel(model).catch((cause: unknown) => {
            Alert.alert(
              'On-device model unavailable',
              cause instanceof Error ? cause.message : 'Could not activate this model.',
            );
          })}
          onToggleTemporary={toggleTemporary}
        />

        <ChatSurface
          agents={agents}
          isError={isError}
          reconnecting={reconnecting}
          onDeviceModel={usingOnDevice ? selectedOnDeviceModel : null}
        />
      </VStack>

      <BottomSheet
        isPresented={pairingPresented}
        onIsPresentedChange={setPairingPresented}
      >
        <PairingContent
          onDone={() => setPairingPresented(false)}
        />
      </BottomSheet>
    </Host>
  );
}
