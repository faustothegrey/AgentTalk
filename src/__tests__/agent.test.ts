import { describe, it, expect, afterEach } from 'vitest';
import { Agent } from '../agents/agent.js';
import { existsSync, rmSync, readFileSync } from 'fs';

const TRANSCRIPT_DIR = './test-transcripts-agent';

describe('Agent', () => {
  const agents: Agent[] = [];

  function createAgent(id: string): Agent {
    const agent = new Agent(id, TRANSCRIPT_DIR);
    agents.push(agent);
    return agent;
  }

  afterEach(async () => {
    for (const a of agents) await a.destroy();
    agents.length = 0;

    if (existsSync(TRANSCRIPT_DIR)) {
      rmSync(TRANSCRIPT_DIR, { recursive: true, force: true });
    }
  });

  describe('state transitions', () => {
    it('should allow valid transitions', () => {
      const agent = createAgent('t1');
      expect(agent.status).toBe('creating');

      agent.setStatus('starting');
      expect(agent.status).toBe('starting');

      agent.setStatus('ready');
      expect(agent.status).toBe('ready');

      agent.setStatus('busy');
      expect(agent.status).toBe('busy');

      agent.setStatus('ready');
      expect(agent.status).toBe('ready');
    });

    it('should reject invalid transitions', () => {
      const agent = createAgent('t2');

      // creating -> ready is not allowed
      expect(() => agent.setStatus('ready')).toThrow('Invalid transition: creating -> ready');
    });

    it('should allow terminated from any non-terminated state', () => {
      for (const from of ['creating', 'starting', 'ready', 'busy', 'error'] as const) {
        const agent = new Agent(`term-${from}`, TRANSCRIPT_DIR);
        agents.push(agent);

        // Drive to target state
        if (from === 'starting') agent.setStatus('starting');
        if (from === 'ready') { agent.setStatus('starting'); agent.setStatus('ready'); }
        if (from === 'busy') { agent.setStatus('starting'); agent.setStatus('ready'); agent.setStatus('busy'); }
        if (from === 'error') { agent.setStatus('starting'); agent.setStatus('error'); }

        expect(agent.status).toBe(from);
        agent.setStatus('terminated');
        expect(agent.status).toBe('terminated');
      }
    });

    it('should reject transitions out of terminated', () => {
      const agent = createAgent('t3');
      agent.setStatus('terminated');
      expect(() => agent.setStatus('starting')).toThrow('Invalid transition: terminated -> starting');
    });

    it('should allow error -> starting (restart)', () => {
      const agent = createAgent('t4');
      agent.setStatus('starting');
      agent.setStatus('error');
      agent.setStatus('starting');
      expect(agent.status).toBe('starting');
    });
  });

  describe('transcripts', () => {
    it('should write to transcript file', async () => {
      const agent = createAgent('transcript-test');
      agent.appendToTranscript('hello world\n');
      await agent.destroy();
      agents.pop(); // already destroyed

      const content = readFileSync(`${TRANSCRIPT_DIR}/transcript-test.log`, 'utf8');
      expect(content).toBe('hello world\n');
    });

    it('should not write empty strings', async () => {
      const agent = createAgent('empty-test');
      agent.appendToTranscript('');
      agent.appendToTranscript('data\n');
      await agent.destroy();
      agents.pop(); // already destroyed

      const content = readFileSync(`${TRANSCRIPT_DIR}/empty-test.log`, 'utf8');
      expect(content).toBe('data\n');
    });

    it('should allow destroy to be called more than once', async () => {
      const agent = createAgent('idempotent-destroy');
      agent.appendToTranscript('data\n');

      await agent.destroy();
      agents.pop(); // already destroyed

      await expect(agent.destroy()).resolves.toBeUndefined();

      const content = readFileSync(`${TRANSCRIPT_DIR}/idempotent-destroy.log`, 'utf8');
      expect(content).toBe('data\n');
    });
  });
});
