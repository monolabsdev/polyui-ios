import * as SQLite from 'expo-sqlite';

import { chatMessageSchema, type ChatMessage } from '@/domain/poly';

const database = SQLite.openDatabaseAsync('poly.db');

export async function initializeConversationCache() {
  const db = await database;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY NOT NULL,
      agent_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

export async function cacheMessage(message: ChatMessage) {
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
