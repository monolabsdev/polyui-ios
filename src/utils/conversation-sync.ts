type VersionedConversation = { id: string; updatedAt: string };

export function conversationsNeedingMessages(
  remote: VersionedConversation[],
  local: VersionedConversation[],
) {
  const localVersions = new Map(local.map((conversation) => [conversation.id, conversation.updatedAt]));
  return remote.filter((conversation) => localVersions.get(conversation.id) !== conversation.updatedAt);
}
