import { describe, it, expect } from 'vitest';
import { AGENTTALK_MCP_TOOLS } from '../mcp-tools.js';
import fs from 'fs';
import path from 'path';

describe('MCP Tools Drift Guard', () => {
  it('should ensure the wire-contract mcpTools exactly match AGENTTALK_MCP_TOOLS', () => {
    const contractPath = path.resolve(__dirname, '../../../../contracts/wire-contract.json');
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

    const contractTools = new Set(contract.data.mcpTools);
    const registeredTools = new Set(AGENTTALK_MCP_TOOLS.map(t => t.name));

    expect(contractTools).toEqual(registeredTools);
  });
});
