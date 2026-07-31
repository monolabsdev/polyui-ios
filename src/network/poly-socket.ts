import ReconnectingWebSocket from 'reconnecting-websocket';

export function connectPolySocket(url: string, onMessage: (message: string) => void) {
  const socket = new ReconnectingWebSocket(url);
  socket.addEventListener('message', (event) => onMessage(String(event.data)));
  return socket;
}
