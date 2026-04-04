import { describe, expect, it } from 'vitest';
import { createConversationRuntime, extractSystemRequiredCall } from '../../scripts/lib/conversation-runtime.mjs';

describe('conversation-runtime', () => {
  it('extracts agreement_proposal from system reminder payloads', () => {
    const call = extractSystemRequiredCall({
      type: 'message_received',
      from: 'system',
      payload: 'Reminder (2/2): please call agreement_proposal now. Planning will be interrupted if you do not comply.',
    });

    expect(call).toBe('agreement_proposal');
  });

  it('extracts agreement_reached from system reminder payloads', () => {
    const call = extractSystemRequiredCall({
      type: 'message_received',
      from: 'system',
      payload: 'Your peer has proposed agreement. Please call `agreement_reached` to confirm.',
    });

    expect(call).toBe('agreement_reached');
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
});
