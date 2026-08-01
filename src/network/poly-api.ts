import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { fetch } from 'expo/fetch';
import { z } from 'zod';

import { chatMessageSchema, relayPairingPayloadSchema, type Agent, type ChatMessage } from '@/domain/poly';
import { createSessionKeyPair } from '@/security/session-crypto';
import { relayRequest, type RelaySession } from '@/network/relay-client';
import { createStreamEventParser, readResponseStream } from '@/network/stream-events';

const hostKey = 'poly.paired-host.v2';
const hostRuntimeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('chat-model'), connection_id: z.string(), model_id: z.string() }),
  z.object({
    kind: z.literal('coding-agent'),
    installation_id: z.string(),
    agent_kind: z.enum(['codex', 'claude-code']),
    workspace_id: z.string(),
    agent_session_id: z.string().nullable().optional(),
  }),
]);
const runtimeChoiceSchema = z.object({
  id: z.string(),
  kind: z.enum(['chat-model', 'coding-agent']),
  group: z.enum(['Coding agents', 'Cloud models', 'Local models']),
  label: z.string(),
  detail: z.string(),
  available: z.boolean(),
  providerType: z.string().nullable(),
  runtime: hostRuntimeSchema.nullable(),
});
const runtimesSchema = z.object({ ok: z.literal(true), runtimes: z.array(runtimeChoiceSchema) });

export type HostRuntime = z.infer<typeof hostRuntimeSchema>;
export type RuntimeChoice = z.infer<typeof runtimeChoiceSchema>;
export type AgentApproval = {
  requestId: string;
  approvalId: string;
  action?: string;
  command?: string;
  paths?: string[];
  cwd?: string;
};

const hostSessionSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('direct'), id: z.string(), name: z.string(), baseUrl: z.string().url(), token: z.string(),
    conversationId: z.string(), model: z.string(), providerType: z.string(), providerConfigId: z.number().nullable(), connectionId: z.string().nullable(), isTemporary: z.boolean().default(false), runtime: hostRuntimeSchema.optional(), runtimeLabel: z.string().optional(),
  }),
  z.object({
    mode: z.literal('relay'), id: z.string(), name: z.string(), conversationId: z.string(), model: z.string(), providerType: z.string(), providerConfigId: z.number().nullable(), connectionId: z.string().nullable(),
    relayUrl: z.url(), hostId: z.string(), pairingToken: z.string(), hostPublicKey: z.string(), deviceSecretKey: z.string(), devicePublicKey: z.string(), isTemporary: z.boolean().default(false), runtime: hostRuntimeSchema.optional(), runtimeLabel: z.string().optional(),
  }),
]);
type HostSession = z.infer<typeof hostSessionSchema>;

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

function sameRuntime(left: HostRuntime | undefined, right: HostRuntime | null) {
  if (!left || !right || left.kind !== right.kind) return false;
  if (left.kind === 'chat-model' && right.kind === 'chat-model') {
    return left.connection_id === right.connection_id && left.model_id === right.model_id;
  }
  return left.kind === 'coding-agent' && right.kind === 'coding-agent'
    && left.agent_kind === right.agent_kind
    && left.installation_id === right.installation_id
    && left.workspace_id === right.workspace_id;
}

function withRuntime(host: HostSession, choice: RuntimeChoice): HostSession {
  if (!choice.available || !choice.runtime) throw new Error(`${choice.label} is unavailable.`);
  const runtime = choice.runtime;
  return {
    ...host,
    runtime,
    runtimeLabel: choice.label,
    model: runtime.kind === 'chat-model' ? runtime.model_id : choice.label,
    providerType: choice.providerType ?? (runtime.kind === 'coding-agent' ? runtime.agent_kind : ''),
    providerConfigId: null,
    connectionId: runtime.kind === 'chat-model' ? runtime.connection_id : null,
  } as HostSession;
}

function addToken(baseUrl: string, path: string, token: string) {
  const url = new URL(path, baseUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

async function direct(
  host: Extract<HostSession, { mode: 'direct' }>,
  path: string,
  init?: RequestInit,
  onStream?: (data: string) => void,
) {
  const response = await fetch(addToken(host.baseUrl, path, host.token), init);
  return { status: response.status, body: await readResponseStream(response, onStream) };
}

async function request(host: HostSession, path: string, init?: RequestInit, onStream?: (data: string) => void) {
  if (host.mode === 'relay') {
    return relayRequest(host as RelaySession, { method: init?.method ?? 'GET', path, body: typeof init?.body === 'string' ? init.body : undefined }, onStream);
  }
  return direct(host, path, init, onStream);
}

async function json<T>(response: { status: number; body: string }, schema: z.ZodType<T>) {
  if (response.status < 200 || response.status >= 300) throw new Error(`Poly host request failed (${response.status}).`);
  const value = JSON.parse(response.body) as unknown;
  const result = (value as { ok?: boolean }).ok === false ? z.object({ error: z.string().optional() }).parse(value) : value;
  if ((result as { error?: string }).error) throw new Error((result as { error: string }).error);
  return schema.parse(value);
}

type DefaultModel = { connectionId: string; name: string };

type HostSetup =
  | { mode: 'direct'; id: string; name: string; baseUrl: string; token: string }
  | { mode: 'relay'; id: string; name: string } & RelaySession;

async function bootstrap(host: HostSetup, defaultModel?: DefaultModel): Promise<HostSession> {
  const result = await json(await request(host as HostSession, '/api/runtimes'), runtimesSchema);
  const runtime = result.runtimes.find((item) =>
    item.runtime?.kind === 'chat-model'
      && item.runtime.connection_id === defaultModel?.connectionId
      && item.runtime.model_id === defaultModel?.name,
  ) ?? result.runtimes.find((item) => item.available && item.runtime);
  if (!runtime) throw new Error('Poly host has no available runtimes.');
  const conversations = await json(await request(host as HostSession, '/api/conversations'), conversationsSchema);
  const conversation = conversations.conversations[0] ?? { id: Crypto.randomUUID(), title: 'iPhone' };
  if (!conversations.conversations[0]) {
    await request(host as HostSession, '/api/conversations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: conversation.id, title: conversation.title, is_temporary: false }) });
  }
  return saveHost(withRuntime({ ...host, conversationId: conversation.id, model: '', providerType: '', providerConfigId: null, connectionId: null } as HostSession, runtime));
}

export async function pairHost(raw: string) {
  let payload: z.infer<typeof relayPairingPayloadSchema> | null = null;
  try { payload = relayPairingPayloadSchema.parse(JSON.parse(raw)); } catch { /* direct URL */ }
  if (payload) {
    const keys = createSessionKeyPair();
    const session: RelaySession = { relayUrl: payload.relayUrl, hostId: payload.hostId, pairingToken: payload.pairingToken, hostPublicKey: payload.hostPublicKey, deviceSecretKey: keys.secretKey, devicePublicKey: keys.publicKey };
    await json(await relayRequest(session, { method: 'GET', path: '/api/status' }), z.object({ ok: z.literal(true) }));
    const host = await bootstrap({ mode: 'relay', id: payload.hostId, name: payload.hostName, ...session }, payload.defaultModel);
    return saveHost(host);
  }
  const url = new URL(raw);
  const token = url.searchParams.get('token');
  if (url.pathname !== '/mobile.html' || !token) throw new Error('Invalid Poly pairing code.');
  const base = url.origin;
  await json(await fetch(`${base}/pair/verify?token=${encodeURIComponent(token)}`).then(async (response) => ({ status: response.status, body: await response.text() })), z.object({ ok: z.literal(true) }));
  const name = url.searchParams.get('model');
  const connectionId = url.searchParams.get('connectionId');
  return bootstrap(
    { mode: 'direct', id: base, name: url.hostname, baseUrl: base, token },
    name && connectionId ? { name, connectionId } : undefined,
  );
}

export async function fetchAgents(): Promise<Agent[]> {
  const host = await loadPairedHost();
  if (!host) return [];
  await json(await request(host, '/api/presence', { method: 'POST' }), z.object({ ok: z.literal(true) }));
  return [{ id: host.id, name: host.name, host: host.mode === 'relay' ? 'Remote relay' : host.baseUrl, status: 'online', lastSeenAt: new Date().toISOString() }];
}

export async function fetchHostRuntimes() {
  const host = await loadPairedHost();
  if (!host) return { runtimes: [] as RuntimeChoice[], selectedRuntime: null as RuntimeChoice | null };
  const result = await json(await request(host, '/api/runtimes'), runtimesSchema);
  const selectedRuntime = result.runtimes.find((choice) => sameRuntime(host.runtime, choice.runtime))
    ?? result.runtimes.find((choice) =>
      choice.runtime?.kind === 'chat-model'
        && choice.runtime.connection_id === host.connectionId
        && choice.runtime.model_id === host.model,
    )
    ?? result.runtimes.find((choice) => choice.available && choice.runtime)
    ?? null;
  if (selectedRuntime?.runtime && !sameRuntime(host.runtime, selectedRuntime.runtime)) {
    await saveHost(withRuntime(host, selectedRuntime));
  }
  return { runtimes: result.runtimes, selectedRuntime };
}

export async function selectHostRuntime(choice: RuntimeChoice): Promise<void> {
  const host = await loadPairedHost();
  if (!host) throw new Error('Pair a Poly host first.');
  await saveHost(withRuntime(host, choice));
}

export async function approveHostRequest(approval: AgentApproval, approved: boolean): Promise<void> {
  const host = await loadPairedHost();
  if (!host) throw new Error('Pair a Poly host first.');
  await json(
    await request(host, '/api/approval', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        request_id: approval.requestId,
        approval_id: approval.approvalId,
        approved,
      }),
    }),
    z.object({ ok: z.literal(true) }),
  );
}

export async function updateHostPushToken(
  token: string,
  environment: 'sandbox' | 'production',
  enabled: boolean,
): Promise<void> {
  const host = await loadPairedHost();
  if (!host) return;
  await json(
    await request(host, '/api/push-token', {
      method: enabled ? 'POST' : 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, environment }),
    }),
    z.object({ ok: z.literal(true) }),
  );
}

export async function loadHostMessages(): Promise<ChatMessage[]> {
  const host = await loadPairedHost();
  if (!host) return [];
  const result = await json(await request(host, `/api/messages?conversationId=${encodeURIComponent(host.conversationId)}`), messagesSchema);
  return result.messages.map((message) => chatMessageSchema.parse({ ...message, agentId: host.id }));
}

export async function sendHostMessage(
  history: ChatMessage[],
  userMessage: ChatMessage,
  onChunk: (chunk: string) => void,
  onDone: (id: string, content: string) => void,
  onApproval: (approval: AgentApproval) => void,
) {
  const host = await loadPairedHost();
  if (!host) throw new Error('Pair a Poly host first.');
  if (history.length === 0 && !host.isTemporary) {
    await ensureConversationOnHost(host);
  }
  await json(await request(host, '/api/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: userMessage.id, conversation_id: host.conversationId, role: 'user', content: userMessage.content, model: host.model, provider: host.providerType, is_temporary: host.isTemporary }) }), z.object({ ok: z.literal(true) }));
  let finalContent = '';
  const consume = createStreamEventParser(({ event, data }) => {
    const body = JSON.parse(data) as { content?: string; id?: string; error?: string } & Partial<AgentApproval>;
    if (event === 'chunk') { finalContent += body.content ?? ''; onChunk(body.content ?? ''); }
    if (event === 'done') {
      finalContent = body.content || finalContent;
      onDone(body.id ?? Crypto.randomUUID(), finalContent);
    }
    if (event === 'approval' && body.requestId && body.approvalId) {
      onApproval({ ...body, requestId: body.requestId, approvalId: body.approvalId });
    }
    if (event === 'error') throw new Error(body.error ?? 'Poly host chat failed.');
  });
  const response = await request(host, '/api/chat-stream', { method: 'POST', headers: { accept: 'text/event-stream', 'content-type': 'application/json' }, body: JSON.stringify({ model: host.model, messages: [...history, userMessage].map(({ role, content }) => ({ role, content })), conversation_id: host.conversationId, is_temporary: host.isTemporary, provider_type: host.providerType, provider_config_id: host.providerConfigId, connection_id: host.connectionId, runtime: host.runtime }) }, consume);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Poly host request failed (${response.status}).`);
  }
}

export async function startNewConversation(isTemporary = false): Promise<void> {
  const host = await loadPairedHost();
  if (!host) return;
  await saveHost({ ...host, conversationId: Crypto.randomUUID(), isTemporary });
}

export async function setConversationTemporary(isTemporary: boolean): Promise<void> {
  const host = await loadPairedHost();
  if (!host) return;
  await saveHost({ ...host, isTemporary });
}

async function ensureConversationOnHost(host: HostSession): Promise<void> {
  await json(
    await request(host, '/api/conversations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: host.conversationId, title: 'iPhone', is_temporary: false }) }),
    z.object({ ok: z.literal(true) }),
  );
}

export async function forgetPairedHost() { await SecureStore.deleteItemAsync(hostKey); }
