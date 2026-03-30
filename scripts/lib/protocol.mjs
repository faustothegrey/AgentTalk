export const PROTOCOL_PREFIX = '[AgentTalk]:';

export function emitReady(sessionId) {
  console.log(`${PROTOCOL_PREFIX}READY:${JSON.stringify({ session: sessionId })}`);
}

export function emitEvent(payload) {
  console.log(`${PROTOCOL_PREFIX}EVT:${JSON.stringify(payload)}`);
}

export function emitRequest(payload) {
  console.log(`${PROTOCOL_PREFIX}REQ:${JSON.stringify(payload)}`);
}

export function parseInboundProtocolLine(line) {
  if (!line.startsWith(PROTOCOL_PREFIX)) {
    return null;
  }

  const body = line.slice(PROTOCOL_PREFIX.length);
  const colonIndex = body.indexOf(':');
  if (colonIndex === -1) {
    return null;
  }

  return {
    type: body.slice(0, colonIndex),
    json: body.slice(colonIndex + 1),
  };
}
