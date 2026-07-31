import { z } from 'zod';

export const connectionStatusSchema = z.enum(['online', 'busy', 'offline']);

export const agentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  host: z.string().min(1),
  status: connectionStatusSchema,
  lastSeenAt: z.string().datetime(),
});

export const chatMessageSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  createdAt: z.string().datetime(),
});

export const relayPairingPayloadSchema = z.object({
  version: z.literal(1),
  relayUrl: z.string().url(),
  hostId: z.string().min(1),
  hostName: z.string().min(1),
  pairingToken: z.string().min(1),
  hostPublicKey: z.string().length(64),
});

export type Agent = z.infer<typeof agentSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type RelayPairingPayload = z.infer<typeof relayPairingPayloadSchema>;
