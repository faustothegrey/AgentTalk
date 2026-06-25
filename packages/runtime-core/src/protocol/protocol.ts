export const PROTOCOL_PREFIX = '[AgentTalk]:';

export const PROTOCOL_PACKET_TYPES = ['READY', 'REQ', 'RES', 'EVT'] as const;

export type ProtocolPacketType = (typeof PROTOCOL_PACKET_TYPES)[number];
export type OutboundProtocolPacketType = ProtocolPacketType;

export interface ParsedProtocolLine {
  packetType: ProtocolPacketType;
  payloadJson: string;
}

export function isProtocolLine(line: string): boolean {
  return line.startsWith(PROTOCOL_PREFIX);
}

export function splitProtocolLine(line: string): ParsedProtocolLine | null {
  if (!isProtocolLine(line)) {
    return null;
  }

  const body = line.slice(PROTOCOL_PREFIX.length);
  const colonIdx = body.indexOf(':');
  if (colonIdx === -1) {
    return null;
  }

  const packetType = body.slice(0, colonIdx);
  if (!isProtocolPacketType(packetType)) {
    return null;
  }

  return {
    packetType,
    payloadJson: body.slice(colonIdx + 1),
  };
}

export function serializeProtocolLine(type: ProtocolPacketType, payload: unknown): string {
  return `${PROTOCOL_PREFIX}${type}:${JSON.stringify(payload)}\n`;
}

function isProtocolPacketType(value: string): value is ProtocolPacketType {
  return (PROTOCOL_PACKET_TYPES as readonly string[]).includes(value);
}

/**
 * Legacy support for scripts/lib/protocol.mjs helper functions
 */

export function emitReady(payload: string | Record<string, unknown>): void {
  const normalizedPayload = typeof payload === 'string' ? { session: payload } : payload;
  process.stdout.write(serializeProtocolLine('READY', normalizedPayload));
}

export function emitEvent(payload: unknown): void {
  process.stdout.write(serializeProtocolLine('EVT', payload));
}

export function emitRequest(payload: unknown): void {
  process.stdout.write(serializeProtocolLine('REQ', payload));
}

/**
 * Parses a protocol line. Returns null if the line is not a valid AgentTalk protocol line.
 */
export function parseInboundProtocolLine(line: string): { type: string; json: string } | null {
  const parsed = splitProtocolLine(line);
  if (!parsed) {
    return null;
  }
  return {
    type: parsed.packetType,
    json: parsed.payloadJson,
  };
}
