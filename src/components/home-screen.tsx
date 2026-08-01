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
import { PlatformColor } from 'react-native';

import { ChatHeader } from '@/components/chat-header';
import { ChatSurface } from '@/components/chat-surface';
import PairingContent from '@/components/pairing-content';
import { useAgents } from '@/hooks/use-agents';
import { createNewConversation } from '@/hooks/use-conversation';
import { setConversationTemporary, type RuntimeChoice } from '@/network/poly-api';
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
  } = useAgents();

  const toggleTemporary = () => {
    const next = !temporary;
    setTemporary(next);
    if (hasMessages) {
      void createNewConversation(activeAgentId, next);
    } else {
      void setConversationTemporary(next);
    }
  };

  const changeRuntime = async (runtime: RuntimeChoice) => {
    if (!runtime.runtime) return;
    if (hasMessages && selectedRuntime?.runtime?.kind !== runtime.runtime.kind) {
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
          onPair={() => setPairingPresented(true)}
          onSettings={() => {
            useAppStore.getState().setHostRevealed(false);
            router.push('/settings');
          }}
          onNewConversation={() => void createNewConversation(activeAgentId, temporary)}
          onSelectRuntime={(runtime) => void changeRuntime(runtime).catch(() => undefined)}
          onToggleTemporary={toggleTemporary}
        />

        <ChatSurface agents={agents} isError={isError} reconnecting={reconnecting} />
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
