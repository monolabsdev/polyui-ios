import { Host } from '@expo/ui';
import {
  Button,
  BottomSheet,
  HStack,
  Label,
  List,
  ProgressView,
  RNHostView,
  Section,
  TabView,
  Text,
  TextField,
  type TextFieldRef,
  useNativeState,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  frame,
  listStyle,
  padding,
  tabViewStyle,
  textFieldStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { MarkdownMessage } from '@/components/markdown-message';
import PairingContent from '@/components/pairing-content.ios';
import { cacheMessage } from '@/data/conversation-cache';
import { fetchAgents } from '@/data/agents';
import { loadHostMessages, sendHostMessage } from '@/network/poly-api';
import { type Agent, type ChatMessage } from '@/domain/poly';
import { useAppStore } from '@/state/app-store';

export default function HomeScreen() {
  const router = useRouter();
  const [tab, setTab] = useState('workspace');
  const [pairingPresented, setPairingPresented] = useState(false);
  const { data: agents = [], isLoading, isError } = useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
  });
  const activeAgentId = useAppStore((state) => state.activeAgentId);
  const setActiveAgent = useAppStore((state) => state.setActiveAgent);
  const setMessages = useAppStore((state) => state.setMessages);

  useEffect(() => {
    if (agents[0] && !activeAgentId) setActiveAgent(agents[0].id);
  }, [activeAgentId, agents, setActiveAgent]);

  useEffect(() => {
    if (!activeAgentId) return;
    void loadHostMessages().then(setMessages).catch(() => undefined);
  }, [activeAgentId, setMessages]);

  return (
    <Host style={{ flex: 1 }} seedColor="#0A84FF">
      <TabView selection={tab} onSelectionChange={setTab} modifiers={[tabViewStyle({ type: 'automatic' })]}>
        <TabView.Tab value="workspace" label="Workspace" systemImage="rectangle.3.group">
          <WorkspaceTab
            agents={agents}
            isLoading={isLoading}
            isError={isError}
            onPair={() => setPairingPresented(true)}
            onSettings={() => router.push('/settings')}
          />
        </TabView.Tab>
        <TabView.Tab value="chat" label="Chat" systemImage="bubble.left.and.bubble.right">
          <ChatTab agents={agents} />
        </TabView.Tab>
        <TabView.Tab value="activity" label="Activity" systemImage="bell">
          <ActivityTab />
        </TabView.Tab>
      </TabView>

      <BottomSheet isPresented={pairingPresented} onIsPresentedChange={setPairingPresented}>
        <PairingContent onDone={() => setPairingPresented(false)} />
      </BottomSheet>
    </Host>
  );
}

function WorkspaceTab({
  agents,
  isLoading,
  isError,
  onPair,
  onSettings,
}: {
  agents: Agent[];
  isLoading: boolean;
  isError: boolean;
  onPair: () => void;
  onSettings: () => void;
}) {
  return (
    <List modifiers={[listStyle('insetGrouped')]}>
      <Section title="Hosts">
        {isLoading ? <ProgressView /> : null}
        {isError ? <Label title="Unable to load hosts" systemImage="exclamationmark.triangle" /> : null}
        {agents.map((agent) => <HostRow key={agent.id} agent={agent} />)}
      </Section>
      <Section title="Quick actions">
        <Button label="Pair a host" systemImage="qrcode.viewfinder" onPress={onPair} />
        <Button label="Settings" systemImage="gearshape" onPress={onSettings} />
      </Section>
    </List>
  );
}

function HostRow({ agent }: { agent: Agent }) {
  const setActiveAgent = useAppStore((state) => state.setActiveAgent);
  return (
    <Button onPress={() => setActiveAgent(agent.id)} modifiers={[accessibilityLabel(`${agent.name}, ${agent.status}`)]}>
      <HStack spacing={12} modifiers={[padding({ vertical: 4 })]}>
        <Label
          title={agent.name}
          systemImage={agent.status === 'online' ? 'desktopcomputer' : 'wifi.slash'}
        />
        <VStack alignment="trailing" spacing={2} modifiers={[frame({ maxWidth: 180 })]}>
          <Text modifiers={[foregroundStyle(agent.status === 'online' ? '#34C759' : 'secondary'), font({ textStyle: 'caption' })]}>
            {agent.status === 'online' ? 'Online' : 'Offline'}
          </Text>
          <Text modifiers={[foregroundStyle('secondary'), font({ textStyle: 'caption2' })]}>{agent.host}</Text>
        </VStack>
      </HStack>
    </Button>
  );
}

function ChatTab({ agents }: { agents: Agent[] }) {
  const activeAgentId = useAppStore((state) => state.activeAgentId);
  const messages = useAppStore((state) => state.messages.filter((message) => message.agentId === activeAgentId));
  const draft = useAppStore((state) => state.draft);
  const setDraft = useAppStore((state) => state.setDraft);
  const addMessage = useAppStore((state) => state.addMessage);
  const activeAgent = agents.find((agent) => agent.id === activeAgentId);
  const nativeDraft = useNativeState(draft);
  const inputRef = useRef<TextFieldRef>(null);
  const [sending, setSending] = useState(false);

  const send = () => {
    const content = draft.trim();
    if (!content || !activeAgentId || sending) return;
    const message: ChatMessage = {
      id: Crypto.randomUUID(),
      agentId: activeAgentId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    addMessage(message);
    void inputRef.current?.clear();
    void cacheMessage(message);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    const history = messages;
    const assistantId = Crypto.randomUUID();
    addMessage({ ...message, id: assistantId, role: 'assistant', content: '' });
    void sendHostMessage(
      history,
      message,
      (chunk) => useAppStore.setState((state) => ({ messages: state.messages.map((item) => item.id === assistantId ? { ...item, content: item.content + chunk } : item) })),
      (id, finalContent) => useAppStore.setState((state) => ({ messages: state.messages.map((item) => item.id === assistantId ? { ...item, id, content: finalContent } : item) })),
    ).catch(() => useAppStore.setState((state) => ({ messages: state.messages.filter((item) => item.id !== assistantId) }))).finally(() => setSending(false));
  };

  return (
    <VStack spacing={0}>
      <List modifiers={[listStyle('plain')]}>
        <Section title={activeAgent?.name ?? 'Conversation'}>
          {messages.length ? messages.map((message) => (
            <HStack
              key={message.id}
              modifiers={[frame({ alignment: message.role === 'user' ? 'trailing' : 'leading' })]}
            >
              <RNHostView matchContents>
                <MarkdownMessage content={message.content} isUser={message.role === 'user'} />
              </RNHostView>
            </HStack>
          )) : <Label title="No messages yet" systemImage="bubble.left" />}
        </Section>
      </List>
      <HStack spacing={8} modifiers={[padding({ horizontal: 16, vertical: 10 })]}>
        <TextField
          ref={inputRef}
          placeholder="Message host"
          text={nativeDraft}
          onTextChange={setDraft}
          modifiers={[textFieldStyle('roundedBorder'), frame({ minHeight: 40 })]}
        />
        <Button
          label="Send"
          systemImage="arrow.up.circle.fill"
          onPress={send}
          modifiers={[buttonStyle('borderedProminent'), controlSize('regular'), tint('#0A84FF')]}
        />
      </HStack>
    </VStack>
  );
}

function ActivityTab() {
  return (
    <List modifiers={[listStyle('insetGrouped')]}>
      <Section title="Needs your attention">
        <Button label="Approve build cleanup" systemImage="checkmark.circle" />
      </Section>
      <Section title="Recent">
        <Label title="Agent completed a task" systemImage="checkmark.circle.fill" />
        <Label title="Studio Mac connected" systemImage="bolt.fill" />
      </Section>
    </List>
  );
}
