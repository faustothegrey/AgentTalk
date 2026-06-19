import { describe, expect, it } from 'vitest';
import {
  createConversationRuntime,
  extractSystemRequiredCall,
  STALE_DISCUSSION_THRESHOLD,
  AUTO_PROPOSE_THRESHOLD,
} from '@agenttalk/runtime-core/conversations/runtime';

describe('conversation-runtime', () => {
  it('extracts agreement_proposal from system reminder payloads', () => {
    const call = extractSystemRequiredCall({
      type: 'message_received',
      from: 'system',
      payload: 'Reminder (2/2): please call agreement_proposal now. Planning will be interrupted if you do not comply.',
    });

    expect(call).toBe('agreement_proposal');
  });

  it('extracts agreement_acceptance from system reminder payloads', () => {
    const call = extractSystemRequiredCall({
      type: 'message_received',
      from: 'system',
      payload: 'Your peer has proposed agreement. Please call `agreement_acceptance` to confirm.',
    });

    expect(call).toBe('agreement_acceptance');
  });

  it('ignores non-system messages and unrelated system text', () => {
    expect(extractSystemRequiredCall({
      type: 'message_received',
      from: 'planner-a',
      payload: 'please call agreement_proposal now',
    })).toBeNull();

    expect(extractSystemRequiredCall({
      type: 'message_received',
      from: 'system',
      payload: 'Planning interrupted because required event(s) were not received.',
    })).toBeNull();
  });

  it('adds replyToMessageId when replying to a message_received event', () => {
    const runtime = createConversationRuntime();
    const request = runtime.buildProtocolRequest(
      {
        type: 'message_received',
        from: 'planner-b',
        payload: 'hello',
        messageId: 'msg-42',
      },
      'ack',
    );

    expect(request.call).toBe('send_to_agent');
    expect(request.args).toEqual({
      to: 'planner-b',
      payload: 'ack',
      replyToMessageId: 'msg-42',
    });
  });

  it('shouldAutoPropose returns false before threshold', () => {
    const runtime = createConversationRuntime();
    runtime.startConversation(
      { type: 'conversation_start', peerIds: ['peer-a'], topic: 'execution plan for refactor', maxReplies: 20, initiator: false },
      () => {},
    );

    for (let i = 0; i < AUTO_PROPOSE_THRESHOLD - 1; i++) {
      runtime.recordStructuredMessageType('opinion');
    }

    expect(runtime.shouldAutoPropose()).toBe(false);
  });

  it('shouldAutoPropose returns true at threshold', () => {
    const runtime = createConversationRuntime();
    runtime.startConversation(
      { type: 'conversation_start', peerIds: ['peer-a'], topic: 'execution plan for refactor', maxReplies: 20, initiator: false },
      () => {},
    );

    for (let i = 0; i < AUTO_PROPOSE_THRESHOLD; i++) {
      runtime.recordStructuredMessageType('opinion');
    }

    expect(runtime.shouldAutoPropose()).toBe(true);
  });

  it('resets consecutive discussion counter on non-discussion message type', () => {
    const runtime = createConversationRuntime();
    runtime.startConversation(
      { type: 'conversation_start', peerIds: ['peer-a'], topic: 'execution plan for refactor', maxReplies: 20, initiator: false },
      () => {},
    );

    for (let i = 0; i < AUTO_PROPOSE_THRESHOLD - 1; i++) {
      runtime.recordStructuredMessageType('opinion');
    }
    runtime.recordStructuredMessageType('agreement_proposal');

    expect(runtime.shouldAutoPropose()).toBe(false);

    // Need full threshold again after reset
    for (let i = 0; i < AUTO_PROPOSE_THRESHOLD; i++) {
      runtime.recordStructuredMessageType('opinion');
    }
    expect(runtime.shouldAutoPropose()).toBe(true);
  });

  it('injects urgency into planning prompt after stale discussion threshold', () => {
    const runtime = createConversationRuntime();
    runtime.startConversation(
      { type: 'conversation_start', peerIds: ['peer-a'], topic: 'execution plan for refactor', maxReplies: 20, initiator: false },
      () => {},
    );

    for (let i = 0; i < STALE_DISCUSSION_THRESHOLD; i++) {
      runtime.recordStructuredMessageType('opinion');
    }

    const prompt = runtime.buildPrompt({
      type: 'message_received',
      from: 'peer-a',
      payload: 'I agree with everything.',
    });

    expect(prompt).toContain('WARNING');
    expect(prompt).toContain('agreement_proposal');
    expect(prompt).toContain(`${STALE_DISCUSSION_THRESHOLD} consecutive`);
  });

  it('does not inject urgency for non-planning conversations', () => {
    const runtime = createConversationRuntime();
    runtime.startConversation(
      { type: 'conversation_start', peerIds: ['peer-a'], topic: 'general discussion', maxReplies: 20, initiator: false },
      () => {},
    );

    for (let i = 0; i < STALE_DISCUSSION_THRESHOLD + 2; i++) {
      runtime.recordStructuredMessageType('opinion');
    }

    const prompt = runtime.buildPrompt({
      type: 'message_received',
      from: 'peer-a',
      payload: 'hello',
    });

    expect(prompt).not.toContain('WARNING');
  });
});
