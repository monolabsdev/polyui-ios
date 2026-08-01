import { expect, test } from 'bun:test';

import { createStreamEventParser, readResponseStream } from './stream-events';

test('forwards split SSE chunks to the parser', async () => {
  const encoder = new TextEncoder();
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('event: chunk\ndata: {"content":"hel'));
      controller.enqueue(encoder.encode('lo"}\n\nevent: done\ndata: {"content":"hello"}\n\n'));
      controller.close();
    },
  }));
  const events: string[] = [];
  const consume = createStreamEventParser(({ event, data }) => {
    events.push(`${event}:${JSON.parse(data).content}`);
  });

  await readResponseStream(response, consume);

  expect(events).toEqual(['chunk:hello', 'done:hello']);
});
