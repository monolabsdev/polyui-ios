import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { z } from 'zod';

import { chatMessageSchema, relayPairingPayloadSchema, type Agent, type ChatMessage } from '@/domain/poly';
import { createSessionKeyPair } from '@/security/session-crypto';
import { relayRequest, type RelaySession } from '@/network/relay-client';

const hostKey = 'poly.paired-host.v2';
const hostSessionSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('direct'), id: z.string(), name: z.string(), baseUrl: z.string().url(), token: z.string(),
    conversationId: z.string(), model: z.string(), providerType: z.string(), providerConfigId: z.number().nullable(), connectionId: z.string().nullable(),
  }),
  z.object({
    mode: z.literal('relay'), id: z.string(), name: z.string(), conversationId: z.string(), model: z.string(), providerType: z.string(), providerConfigId: z.number().nullable(), connectionId: z.string().nullable(),
    relayUrl: z.string().url(), hostId: z.string(), pairingToken: z.string(), hostPublicKey: z.string(), deviceSecretKey: z.string(), devicePublicKey: z.string(),
  }),
]);
type HostSession = z.infer<typeof hostSessionSchema>;

const modelsSchema = z.object({ ok: z.literal(true), models: z.array(z.object({ name: z.string(), providerType: z.string(), providerConfigId: z.number().nullable().optional(), connectionId: z.string().nullable().optional() })) });
const conversationsSchema = z.object({ ok: z.literal(true), conversations: z.array(z.object({ id: z.string(), title: z.string() })) });
const messagesSchema = z.object({ ok: z.literal(true), messages: z.array(z.object({ id: z.string(), conversationId: z.string(), role: z.enum(['user', 'assistant', 'system']), content: z.string(), createdAt: z.string().datetime(), model: z.string().nullable().optional(), provider: z.string().nullable().optional() })) });

export async function loadPairedHost() {
  const value = await SecureStore.getItemAsync(hostKey);
  if (!value) return null;
  try { return hostSessionSchema.parse(JSON.parse(value)); } catch { await SecureStore.deleteItemAsync(hostKey); return null; }
}

async function saveHost(host: HostSession) {
  await SecureStore.setItemAsync(hostKey, JSON.stringify(host), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return host;
}

function addToken(baseUrl: string, path: string, token: string) {
  const url = new URL(path, baseUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

async function direct(host: Extract<HostSession, { mode: 'direct' }>, path: string, init?: RequestInit) {
  const response = await fetch(addToken(host.baseUrl, path, host.token), init);
  return { status: response.status, body: await response.text() };
}

async function request(host: HostSession, path: string, init?: RequestInit, onStream?: (data: string) => void) {
  if (host.mode === 'relay') {
    return relayRequest(host as RelaySession, { method: init?.method ?? 'GET', path, body: typeof init?.body === 'string' ? init.body : undefined }, onStream);
  }
  return direct(host, path, init);
}

async function json<T>(response: { status: number; body: string }, schema: z.ZodType<T>) {
  if (response.status < 200 || response.status >= 300) throw new Error(`Poly host request failed (${response.status}).`);
  const value = JSON.parse(response.body) as unknown;
  const result = (value as { ok?: boolean }).ok === false ? z.object({ error: z.string().optional() }).parse(value) : value;
  if ((result as { error?: string }).error) throw new Error((result as { error: string }).error);
  return schema.parse(value);
}

type HostSetup =
  | { mode: 'direct'; id: string; name: string; baseUrl: string; token: string }
  | { mode: 'relay'; id: string; name: string } & RelaySession;

async function bootstrap(host: HostSetup): Promise<HostSession> {
  const models = await json(await request(host as HostSession, '/api/models'), modelsSchema);
  const model = models.models[0];
  if (!model) throw new Error('Poly host has no enabled models.');
  const conversations = await json(await request(host as HostSession, '/api/conversations'), conversationsSchema);
  const conversation = conversations.conversations[0] ?? { id: Crypto.randomUUID(), title: 'iPhone' };
  if (!conversations.conversations[0]) {
    await request(host as HostSession, '/api/conversations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: conversation.id, title: conversation.title, is_temporary: false }) });
  }
  return saveHost({ ...host, conversationId: conversation.id, model: model.name, providerType: model.providerType, providerConfigId: model.providerConfigId ?? null, connectionId: model.connectionId ?? null } as HostSession);
}

export async function pairHost(raw: string) {
  let payload: z.infer<typeof relayPairingPayloadSchema> | null = null;
  try { payload = relayPairingPayloadSchema.parse(JSON.parse(raw)); } catch { /* direct URL */ }
  if (payload) {
    const keys = createSessionKeyPair();
    const session: RelaySession = { relayUrl: payload.relayUrl, hostId: payload.hostId, pairingToken: payload.pairingToken, hostPublicKey: payload.hostPublicKey, deviceSecretKey: keys.secretKey, devicePublicKey: keys.publicKey };
    await json(await relayRequest(session, { method: 'GET', path: '/api/status' }), z.object({ ok: z.literal(true) }));
    const host = await bootstrap({ mode: 'relay', id: payload.hostId, name: payload.hostName, ...session });
    return saveHost(host);
  }
  const url = new URL(raw);
  const token = url.searchParams.get('token');
  if (url.pathname !== '/mobile.html' || !token) throw new Error('Invalid Poly pairing code.');
  const base = url.origin;
  await json(await fetch(`${base}/pair/verify?token=${encodeURIComponent(token)}`).then(async (response) => ({ status: response.status, body: await response.text() })), z.object({ ok: z.literal(true) }));
  return bootstrap({ mode: 'direct', id: base, name: url.hostname, baseUrl: base, token });
}

export async function fetchAgents(): Promise<Agent[]> {
  const host = await loadPairedHost();
  if (!host) return [];
  await json(await request(host, '/api/status'), z.object({ ok: z.literal(true) }));
  return [{ id: host.id, name: host.name, host: host.mode === 'relay' ? 'Remote relay' : host.baseUrl, status: 'online', lastSeenAt: new Date().toISOString() }];
}

export async function loadHostMessages(): Promise<ChatMessage[]> {
  const host = await loadPairedHost();
  if (!host) return [];
  const result = await json(await request(host, `/api/messages?conversationId=${encodeURIComponent(host.conversationId)}`), messagesSchema);
  return result.messages.map((message) => chatMessageSchema.parse({ ...message, agentId: host.id }));
}

export async function sendHostMessage(history: ChatMessage[], userMessage: ChatMessage, onChunk: (chunk: string) => void, onDone: (id: string, content: string) => void) {
  const host = await loadPairedHost();
  if (!host) throw new Error('Pair a Poly host first.');
  await json(await request(host, '/api/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: userMessage.id, conversation_id: host.conversationId, role: 'user', content: userMessage.content, model: host.model, provider: host.providerType, is_temporary: false }) }), z.object({ ok: z.literal(true) }));
  let buffer = '';
  let finalContent = '';
  const consume = (data: string) => {
    buffer += data;
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const event of events) {
      const name = event.match(/^event:\s*(.+)$/m)?.[1] ?? 'message';
      const value = event.match(/^data:\s*(.+)$/m)?.[1];
      if (!value) continue;
      const body = JSON.parse(value) as { content?: string; id?: string; error?: string };
      if (name === 'chunk') { finalContent += body.content ?? ''; onChunk(body.content ?? ''); }
      if (name === 'done') { finalContent = body.content ?? finalContent; onDone(body.id ?? Crypto.randomUUID(), finalContent); }
      if (name === 'error') throw new Error(body.error ?? 'Poly host chat failed.');
    }
  };
  await request(host, '/api/chat-stream', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: host.model, messages: [...history, userMessage].map(({ role, content }) => ({ role, content })), conversation_id: host.conversationId, is_temporary: false, provider_type: host.providerType, provider_config_id: host.providerConfigId, connection_id: host.connectionId }) }, consume);
}

export async function forgetPairedHost() { await SecureStore.deleteItemAsync(hostKey); }
