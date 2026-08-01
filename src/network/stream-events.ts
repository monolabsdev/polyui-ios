export type StreamEvent = {
  event: string;
  data: string;
};

export async function readResponseStream(
  response: Response,
  onChunk?: (chunk: string) => void,
) {
  if (!onChunk || !response.body) {
    const body = await response.text();
    onChunk?.(body);
    return body;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let body = '';

  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    const chunk = decoder.decode(next.value, { stream: true });
    body += chunk;
    onChunk(chunk);
  }

  const finalChunk = decoder.decode();
  if (finalChunk) {
    body += finalChunk;
    onChunk(finalChunk);
  }

  return body;
}

export function createStreamEventParser(onEvent: (event: StreamEvent) => void) {
  let buffer = '';
  return (chunk: string) => {
    buffer += chunk;
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      const event = frame.match(/^event:\s*(.+)$/m)?.[1] ?? 'message';
      const data = frame.match(/^data:\s*(.+)$/m)?.[1];
      if (data != null) onEvent({ event, data });
    }
  };
}
