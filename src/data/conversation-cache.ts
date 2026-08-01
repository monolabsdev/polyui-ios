import * as SQLite from 'expo-sqlite';

import { chatMessageSchema, type ChatMessage } from '@/domain/poly';
import type { HostConversation } from '@/network/poly-api';

const database = SQLite.openDatabaseAsync('poly.db');
let initialization: Promise<void> | null = null;

export async function initializeConversationCache() {
  initialization ??= database.then((db) => db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY NOT NULL,
        agent_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS synced_conversations (
        host_id TEXT NOT NULL,
        id TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_archived INTEGER NOT NULL,
        runtime_json TEXT,
        PRIMARY KEY (host_id, id)
      );
      CREATE TABLE IF NOT EXISTS synced_messages (
        host_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (host_id, id)
      );
      CREATE INDEX IF NOT EXISTS synced_messages_by_conversation
        ON synced_messages (host_id, conversation_id, created_at);
      CREATE TABLE IF NOT EXISTS conversation_sync_state (
        host_id TEXT PRIMARY KEY NOT NULL,
        last_synced_at TEXT NOT NULL
      );
    `));
  await initialization;
}

export async function cacheMessage(message: ChatMessage) {
  await initializeConversationCache();
  const db = await database;
  await db.runAsync(
    'INSERT OR REPLACE INTO messages (id, agent_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
    message.id,
    message.agentId,
    message.role,
    message.content,
    message.createdAt,
  );
}

export async function loadCachedMessages(agentId: string) {
  await initializeConversationCache();
  const db = await database;
  const rows = await db.getAllAsync<{
    id: string;
    agent_id: string;
    role: ChatMessage['role'];
    content: string;
    created_at: string;
  }>('SELECT id, agent_id, role, content, created_at FROM messages WHERE agent_id = ? ORDER BY created_at', agentId);

  return rows.map((row) =>
    chatMessageSchema.parse({
      id: row.id,
      agentId: row.agent_id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    }),
  );
}

export async function replaceCachedMessages(agentId: string, messages: ChatMessage[]) {
  await initializeConversationCache();
  const db = await database;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('DELETE FROM messages WHERE agent_id = ?', agentId);
    for (const message of messages) {
      await transaction.runAsync(
        'INSERT INTO messages (id, agent_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
        message.id,
        message.agentId,
        message.role,
        message.content,
        message.createdAt,
      );
    }
  });
}

export async function clearCachedMessages(agentId: string) {
  await initializeConversationCache();
  const db = await database;
  await db.runAsync('DELETE FROM messages WHERE agent_id = ?', agentId);
}

type ConversationRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_archived: number;
  runtime_json: string | null;
};

export async function loadSyncedConversations(hostId: string) {
  await initializeConversationCache();
  const db = await database;
  const [rows, state] = await Promise.all([
    db.getAllAsync<ConversationRow>(
      `SELECT id, title, created_at, updated_at, is_archived, runtime_json
       FROM synced_conversations WHERE host_id = ? ORDER BY updated_at DESC`,
      hostId,
    ),
    db.getFirstAsync<{ last_synced_at: string }>(
      'SELECT last_synced_at FROM conversation_sync_state WHERE host_id = ?',
      hostId,
    ),
  ]);

  return {
    conversations: rows.map((row): HostConversation => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isArchived: Boolean(row.is_archived),
      runtime: parseRuntime(row.runtime_json),
    })),
    lastSyncedAt: state?.last_synced_at ?? null,
  };
}

export async function loadSyncedMessages(hostId: string, conversationId: string) {
  await initializeConversationCache();
  const db = await database;
  const rows = await db.getAllAsync<{
    id: string;
    role: ChatMessage['role'];
    content: string;
    created_at: string;
  }>(
    `SELECT id, role, content, created_at FROM synced_messages
     WHERE host_id = ? AND conversation_id = ? ORDER BY created_at`,
    hostId,
    conversationId,
  );
  return rows.map((row) => chatMessageSchema.parse({
    id: row.id,
    agentId: hostId,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }));
}

export async function applyConversationSync(
  hostId: string,
  conversations: HostConversation[],
  messagesByConversation: ReadonlyMap<string, ChatMessage[]>,
  syncedAt: string,
) {
  await initializeConversationCache();
  const db = await database;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const stored = await transaction.getAllAsync<{ id: string }>(
      'SELECT id FROM synced_conversations WHERE host_id = ?',
      hostId,
    );
    const remoteIds = new Set(conversations.map(({ id }) => id));
    for (const { id } of stored) {
      if (remoteIds.has(id)) continue;
      await transaction.runAsync(
        'DELETE FROM synced_messages WHERE host_id = ? AND conversation_id = ?',
        hostId,
        id,
      );
      await transaction.runAsync(
        'DELETE FROM synced_conversations WHERE host_id = ? AND id = ?',
        hostId,
        id,
      );
    }
    for (const conversation of conversations) {
      await transaction.runAsync(
        `INSERT OR REPLACE INTO synced_conversations
         (host_id, id, title, created_at, updated_at, is_archived, runtime_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        hostId,
        conversation.id,
        conversation.title,
        conversation.createdAt,
        conversation.updatedAt,
        conversation.isArchived ? 1 : 0,
        conversation.runtime ? JSON.stringify(conversation.runtime) : null,
      );
      const messages = messagesByConversation.get(conversation.id);
      if (!messages) continue;
      await transaction.runAsync(
        'DELETE FROM synced_messages WHERE host_id = ? AND conversation_id = ?',
        hostId,
        conversation.id,
      );
      for (const message of messages) {
        await transaction.runAsync(
          `INSERT INTO synced_messages
           (host_id, conversation_id, id, role, content, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          hostId,
          conversation.id,
          message.id,
          message.role,
          message.content,
          message.createdAt,
        );
      }
    }
    await transaction.runAsync(
      `INSERT OR REPLACE INTO conversation_sync_state (host_id, last_synced_at)
       VALUES (?, ?)`,
      hostId,
      syncedAt,
    );
  });
}

export async function clearSyncedHost(hostId: string) {
  await initializeConversationCache();
  const db = await database;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('DELETE FROM synced_messages WHERE host_id = ?', hostId);
    await transaction.runAsync('DELETE FROM synced_conversations WHERE host_id = ?', hostId);
    await transaction.runAsync('DELETE FROM conversation_sync_state WHERE host_id = ?', hostId);
  });
}

function parseRuntime(value: string | null): HostConversation['runtime'] {
  if (!value) return null;
  try {
    return JSON.parse(value) as HostConversation['runtime'];
  } catch {
    return null;
  }
}
