const AGENT_COLOR_TOKENS = [
  { accent: '#5b9bd5', tint: 'rgba(91, 155, 213, 0.16)', glow: 'rgba(91, 155, 213, 0.32)' },
  { accent: '#e06c75', tint: 'rgba(224, 108, 117, 0.16)', glow: 'rgba(224, 108, 117, 0.32)' },
  { accent: '#98c379', tint: 'rgba(152, 195, 121, 0.16)', glow: 'rgba(152, 195, 121, 0.32)' },
  { accent: '#d19a66', tint: 'rgba(209, 154, 102, 0.16)', glow: 'rgba(209, 154, 102, 0.32)' },
  { accent: '#c678dd', tint: 'rgba(198, 120, 221, 0.16)', glow: 'rgba(198, 120, 221, 0.32)' },
  { accent: '#56b6c2', tint: 'rgba(86, 182, 194, 0.16)', glow: 'rgba(86, 182, 194, 0.32)' },
  { accent: '#e5c07b', tint: 'rgba(229, 192, 123, 0.16)', glow: 'rgba(229, 192, 123, 0.32)' },
  { accent: '#7fbbb3', tint: 'rgba(127, 187, 179, 0.16)', glow: 'rgba(127, 187, 179, 0.32)' },
];

function hashAgentId(agentId: string): number {
  let hash = 0;
  for (let i = 0; i < agentId.length; i += 1) {
    hash = (hash * 31 + agentId.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getAgentColor(agentId: string) {
  const token = AGENT_COLOR_TOKENS[hashAgentId(agentId) % AGENT_COLOR_TOKENS.length];
  return {
    ...token,
    text: '#f3f4f6',
    mutedText: '#cbd5e1',
  };
}
