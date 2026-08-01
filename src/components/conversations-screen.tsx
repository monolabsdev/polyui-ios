import { Host } from '@expo/ui';
import {
  Button,
  HStack,
  Image,
  List,
  Menu,
  ProgressView,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  listStyle,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, PlatformColor } from 'react-native';

import { openHostConversation } from '@/hooks/use-conversation';
import {
  deleteHostConversation,
  fetchHostConversations,
  renameHostConversation,
  syncHostConversations,
  type HostConversation,
} from '@/network/poly-api';
import { useAppStore } from '@/state/app-store';
import { hapticPress } from '@/utils/haptics';

export default function ConversationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const activeAgentId = useAppStore((state) => state.activeAgentId);
  const [query, setQuery] = useState('');
  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchHostConversations,
  });
  const sync = useQuery({
    queryKey: ['conversation-sync'],
    queryFn: syncHostConversations,
    retry: false,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (sync.dataUpdatedAt) void queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }, [queryClient, sync.dataUpdatedAt]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return (conversations.data?.conversations ?? []).filter((conversation) =>
      !conversation.isArchived
      && (!needle || conversation.title.toLocaleLowerCase().includes(needle)),
    );
  }, [conversations.data?.conversations, query]);

  const refresh = async () => {
    await sync.refetch();
    await Promise.all([conversations.refetch(), queryClient.invalidateQueries({ queryKey: ['runtimes'] })]);
  };

  const open = async (conversation: HostConversation) => {
    try {
      await openHostConversation(activeAgentId, conversation);
      router.back();
    } catch (cause) {
      Alert.alert('Could not open chat', cause instanceof Error ? cause.message : 'Try again.');
    }
  };

  const rename = (conversation: HostConversation) => {
    Alert.prompt('Rename chat', undefined, (title) => {
      if (!title?.trim()) return;
      void renameHostConversation(conversation.id, title)
        .then(refresh)
        .catch((cause: unknown) => {
          Alert.alert('Could not rename chat', cause instanceof Error ? cause.message : 'Try again.');
        });
    }, 'plain-text', conversation.title);
  };

  const remove = (conversation: HostConversation) => {
    Alert.alert('Delete chat?', 'Messages in this chat will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteHostConversation(conversation.id)
            .then(async () => {
              if (conversations.data?.selectedConversationId === conversation.id) {
                await openHostConversation(activeAgentId);
              }
              await refresh();
            })
            .catch((cause: unknown) => {
              Alert.alert('Could not delete chat', cause instanceof Error ? cause.message : 'Try again.');
            });
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Chats', headerLargeTitle: true }} />
      <Stack.SearchBar placeholder="Search chats" onChangeText={(event) => setQuery(event.nativeEvent.text)} />
      <Host style={{ flex: 1 }} seedColor={PlatformColor('label')}>
        {conversations.isLoading || (sync.isFetching && !conversations.data?.lastSyncedAt) ? (
          <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'center' })]}>
            <ProgressView />
            <Text modifiers={[foregroundStyle('secondary')]}>Syncing chats…</Text>
          </VStack>
        ) : conversations.isError ? (
          <VStack spacing={8} modifiers={[padding({ all: 24 })]}>
            <Text modifiers={[font({ textStyle: 'headline' })]}>Could not load chats</Text>
            <Button label="Try again" onPress={() => void conversations.refetch()} />
          </VStack>
        ) : visible.length === 0 ? (
          <VStack spacing={8} modifiers={[padding({ all: 24 })]}>
            <Text modifiers={[font({ textStyle: 'headline' })]}>
              {query ? 'No matching chats' : 'No chats yet'}
            </Text>
            <Text modifiers={[foregroundStyle('secondary')]}>Start a chat from the main screen.</Text>
          </VStack>
        ) : (
          <List modifiers={[listStyle('plain')]}>
            <Section>
              {sync.isFetching ? (
                <HStack spacing={8}>
                  <ProgressView />
                  <Text modifiers={[foregroundStyle('secondary')]}>Syncing with desktop…</Text>
                </HStack>
              ) : sync.isError ? (
                <Button
                  onPress={() => hapticPress(() => void sync.refetch())}
                  modifiers={[buttonStyle('plain'), accessibilityLabel('Retry chat sync')]}
                >
                  <HStack spacing={8}>
                    <Image systemName="icloud" size={16} modifiers={[foregroundStyle('secondary')]} />
                    <Text modifiers={[foregroundStyle('secondary')]}>Sync paused — tap to retry</Text>
                  </HStack>
                </Button>
              ) : conversations.data?.lastSyncedAt ? (
                <HStack spacing={8}>
                  <Image systemName="icloud" size={16} modifiers={[foregroundStyle('secondary')]} />
                  <Text modifiers={[foregroundStyle('secondary')]}>
                    Synced {formatDistanceToNow(new Date(conversations.data.lastSyncedAt), { addSuffix: true })}
                  </Text>
                </HStack>
              ) : null}
            </Section>
            <Section>
              {visible.map((conversation) => (
                <HStack key={conversation.id} spacing={10}>
                  <Button
                    onPress={() => hapticPress(() => void open(conversation))}
                    modifiers={[
                      buttonStyle('plain'),
                      frame({ maxWidth: Infinity, alignment: 'leading' }),
                      accessibilityLabel(`Open ${conversation.title}`),
                    ]}
                  >
                    <VStack spacing={3} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
                      <Text modifiers={[font({ textStyle: 'body', weight: 'medium' }), lineLimit(1)]}>
                        {conversation.title || 'Untitled chat'}
                      </Text>
                      <Text
                        modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}
                      >
                        {formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}
                      </Text>
                    </VStack>
                  </Button>
                  <Spacer />
                  {conversations.data?.selectedConversationId === conversation.id ? (
                    <Image systemName="checkmark" size={14} modifiers={[foregroundStyle('secondary')]} />
                  ) : null}
                  <Menu
                    label={<Image systemName="ellipsis" size={16} modifiers={[frame({ width: 30, height: 30 })]} />}
                    modifiers={[buttonStyle('plain'), accessibilityLabel(`Actions for ${conversation.title}`)]}
                  >
                    <Button label="Rename" systemImage="pencil" onPress={() => hapticPress(() => rename(conversation))} />
                    <Button label="Delete" systemImage="trash" role="destructive" onPress={() => hapticPress(() => remove(conversation))} />
                  </Menu>
                </HStack>
              ))}
            </Section>
          </List>
        )}
      </Host>
    </>
  );
}
