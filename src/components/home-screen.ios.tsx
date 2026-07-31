import { Host } from '@expo/ui';
import {
  BottomSheet,
  Button,
  GlassEffectContainer,
  HStack,
  Image,
  Menu,
  RNHostView,
  ScrollView,
  Section,
  Spacer,
  Text,
  TextField,
  type TextFieldRef,
  useNativeState,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  background,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  font,
  foregroundStyle,
  frame,
  glassEffect,
  padding,
  textFieldStyle,
  tint,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { MarkdownMessage } from '@/components/markdown-message';
import PairingContent from '@/components/pairing-content.ios';
import { cacheMessage } from '@/data/conversation-cache';
import { fetchAgents } from '@/data/agents';
import { type Agent, type ChatMessage } from '@/domain/poly';
import { loadHostMessages, sendHostMessage } from '@/network/poly-api';
import { useAppStore } from '@/state/app-store';

export default function HomeScreen() {
  const router = useRouter();
  const [pairingPresented, setPairingPresented] = useState(false);
  const { data: agents = [], isError } = useQuery({
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
    <Host style={{ flex: 1 }} seedColor="#AF52DE">
      <VStack spacing={0}>
        <ChatHeader
          agents={agents}
          isError={isError}
          onPair={() => setPairingPresented(true)}
          onSettings={() => router.push('/settings')}
        />
        <ChatSurface agents={agents} />
      </VStack>

      <BottomSheet isPresented={pairingPresented} onIsPresentedChange={setPairingPresented}>
        <PairingContent onDone={() => setPairingPresented(false)} />
      </BottomSheet>
    </Host>
  );
}

function ChatHeader({
  agents,
  isError,
  onPair,
  onSettings,
}: {
  agents: Agent[];
  isError: boolean;
  onPair: () => void;
  onSettings: () => void;
}) {
  return (
    <GlassEffectContainer spacing={12} modifiers={[padding({ horizontal: 20, top: 8, bottom: 6 })]}>
      <HStack alignment="center">
        <Menu
          label={
            <ZStack alignment="topTrailing" modifiers={[glassEffect({ glass: { variant: 'regular', interactive: true }, shape: 'circle' }), frame({ width: 58, height: 48 })]}>
              <Image systemName="line.3.horizontal" size={24} modifiers={[foregroundStyle('primary')]} />
              <Text
                modifiers={[
                  font({ textStyle: 'caption2', weight: 'bold' }),
                  foregroundStyle('#FFFFFF'),
                  background('#FF3B30', shapes.circle()),
                  frame({ width: 21, height: 21 }),
                ]}
              >
                1
              </Text>
            </ZStack>
          }
          modifiers={[buttonStyle('plain'), accessibilityLabel('Open chats and settings')]}
        >
          <Button label="New chat" systemImage="square.and.pencil" />
          <Button label="Pair a host" systemImage="qrcode.viewfinder" onPress={onPair} />
          <Button label="Settings" systemImage="gearshape" onPress={onSettings} />
        </Menu>

        <Spacer />
        <Menu
          label={
            <HStack spacing={5} modifiers={[padding({ horizontal: 8, vertical: 7 })]}>
              <Text modifiers={[font({ textStyle: 'title3', weight: 'semibold' })]}>Chat</Text>
              <Image systemName="chevron.down" size={12} modifiers={[foregroundStyle('secondary')]} />
            </HStack>
          }
          modifiers={[buttonStyle('plain'), accessibilityLabel('Choose conversation')]}
        >
          <Button label={agents[0]?.name ?? 'No host paired'} systemImage="desktopcomputer" />
          {isError ? <Button label="Host unavailable" systemImage="wifi.exclamationmark" /> : null}
        </Menu>
        <Spacer />

        <Button
          label=""
          systemImage="bubble.left.and.bubble.right"
          modifiers={[
            buttonStyle('glass'),
            buttonBorderShape('circle'),
            controlSize('large'),
            accessibilityLabel('New conversation'),
          ]}
        />
      </HStack>
    </GlassEffectContainer>
  );
}

function ChatSurface({ agents }: { agents: Agent[] }) {
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
    const history = messages;
    const assistantId = Crypto.randomUUID();
    addMessage(message);
    addMessage({ ...message, id: assistantId, role: 'assistant', content: '' });
    void inputRef.current?.clear();
    void cacheMessage(message);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    void sendHostMessage(
      history,
      message,
      (chunk) => useAppStore.setState((state) => ({
        messages: state.messages.map((item) => item.id === assistantId ? { ...item, content: item.content + chunk } : item),
      })),
      (id, finalContent) => useAppStore.setState((state) => ({
        messages: state.messages.map((item) => item.id === assistantId ? { ...item, id, content: finalContent } : item),
      })),
    ).catch(() => useAppStore.setState((state) => ({
      messages: state.messages.filter((item) => item.id !== assistantId),
    }))).finally(() => setSending(false));
  };

  return (
    <VStack spacing={0}>
      <ScrollView showsIndicators={false}>
        <VStack spacing={0} modifiers={[padding({ horizontal: 24, top: 18, bottom: 18 })]}>
          {messages.length ? (
            <Section title={activeAgent?.name ?? 'Conversation'}>
              {messages.map((message) => (
                <HStack key={message.id} modifiers={[padding({ vertical: 5 })]}>
                  <RNHostView matchContents>
                    <MarkdownMessage content={message.content} isUser={message.role === 'user'} />
                  </RNHostView>
                </HStack>
              ))}
            </Section>
          ) : (
            <QuickStarts onSelect={setDraft} />
          )}
        </VStack>
      </ScrollView>

      <Composer
        draft={nativeDraft}
        inputRef={inputRef}
        sending={sending}
        onChange={setDraft}
        onSend={send}
      />
    </VStack>
  );
}

function QuickStarts({ onSelect }: { onSelect: (value: string) => void }) {
  return (
    <VStack spacing={22} modifiers={[padding({ top: 180, horizontal: 4 })]}>
      <QuickStart icon="photo.on.rectangle.angled" label="Create an image" onPress={() => onSelect('Create an image')} />
      <QuickStart icon="pencil" label="Write or edit" onPress={() => onSelect('Help me write or edit')} />
      <QuickStart icon="globe" label="Search the web" onPress={() => onSelect('Search the web for ')} />
    </VStack>
  );
}

function QuickStart({ icon, label, onPress }: { icon: 'photo.on.rectangle.angled' | 'pencil' | 'globe'; label: string; onPress: () => void }) {
  return (
    <Button
      onPress={() => {
        onPress();
        void Haptics.selectionAsync();
      }}
      modifiers={[buttonStyle('plain'), accessibilityLabel(label)]}
    >
      <HStack spacing={18} alignment="center">
        <Image systemName={icon} size={28} modifiers={[foregroundStyle('secondary')]} />
        <Text modifiers={[font({ textStyle: 'title3' }), foregroundStyle('secondary')]}>{label}</Text>
      </HStack>
    </Button>
  );
}

function Composer({
  draft,
  inputRef,
  sending,
  onChange,
  onSend,
}: {
  draft: ReturnType<typeof useNativeState<string>>;
  inputRef: RefObject<TextFieldRef | null>;
  sending: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <GlassEffectContainer spacing={10} modifiers={[padding({ horizontal: 14, bottom: 10, top: 5 })]}>
      <HStack
        spacing={9}
        modifiers={[
          padding({ horizontal: 10, vertical: 7 }),
          glassEffect({ glass: { variant: 'regular', interactive: true }, shape: 'capsule' }),
        ]}
      >
        <Button
          label=""
          systemImage="plus"
          modifiers={[buttonStyle('plain'), controlSize('large'), accessibilityLabel('Add attachment')]}
        />
        <TextField
          ref={inputRef}
          placeholder="Ask Poly"
          text={draft}
          onTextChange={onChange}
          modifiers={[textFieldStyle('plain'), frame({ minHeight: 38 })]}
        />
        <Spacer />
        <Button
          label=""
          systemImage="mic"
          modifiers={[buttonStyle('plain'), controlSize('large'), accessibilityLabel('Dictate message')]}
        />
        <Button
          label=""
          systemImage="waveform"
          onPress={onSend}
          modifiers={[
            buttonStyle('glassProminent'),
            buttonBorderShape('circle'),
            tint('#AF52DE'),
            disabled(sending),
            accessibilityLabel('Send message'),
          ]}
        />
      </HStack>
    </GlassEffectContainer>
  );
}
