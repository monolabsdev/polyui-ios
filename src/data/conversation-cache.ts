import * as SQLite from 'expo-sqlite';

import { chatMessageSchema, type ChatMessage } from '@/domain/poly';

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
