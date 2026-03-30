export const PROTOCOL_PREFIX = '[AgentTalk]:';

export const PROTOCOL_PACKET_TYPES = ['READY', 'REQ', 'RES', 'EVT'] as const;

export type ProtocolPacketType = (typeof PROTOCOL_PACKET_TYPES)[number];
export type OutboundProtocolPacketType = Extract<ProtocolPacketType, 'RES' | 'EVT'>;

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

export function serializeProtocolLine(type: OutboundProtocolPacketType, payload: unknown): string {
  return `${PROTOCOL_PREFIX}${type}:${JSON.stringify(payload)}\n`;
}

function isProtocolPacketType(value: string): value is ProtocolPacketType {
  return (PROTOCOL_PACKET_TYPES as readonly string[]).includes(value);
}
