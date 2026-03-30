import { describe, it, expect, vi } from 'vitest';
import { ProcessOutputParser } from '../agents/process-output-parser.js';

describe('ProcessOutputParser', () => {
  function createParser() {
    const onProtocolLine = vi.fn();
    const onPlainText = vi.fn();
    const parser = new ProcessOutputParser({ onProtocolLine, onPlainText });
    return { parser, onProtocolLine, onPlainText };
  }

  it('should emit plain text lines', () => {
    const { parser, onPlainText, onProtocolLine } = createParser();
    parser.feed('hello world\n');

    expect(onPlainText).toHaveBeenCalledWith('hello world\n');
    expect(onProtocolLine).not.toHaveBeenCalled();
  });

  it('should emit protocol lines', () => {
    const { parser, onProtocolLine, onPlainText } = createParser();
    parser.feed('[AgentTalk]:READY:{"session":"123"}\n');

    expect(onProtocolLine).toHaveBeenCalledWith('[AgentTalk]:READY:{"session":"123"}');
    expect(onPlainText).not.toHaveBeenCalled();
  });

  it('should buffer partial lines until newline arrives', () => {
    const { parser, onPlainText } = createParser();
    parser.feed('partial');
    expect(onPlainText).not.toHaveBeenCalled();

    parser.feed(' rest\n');
    expect(onPlainText).toHaveBeenCalledWith('partial rest\n');
  });

  it('should handle multiple lines in one chunk', () => {
    const { parser, onPlainText, onProtocolLine } = createParser();
    parser.feed('line one\n[AgentTalk]:READY:{"session":"s1"}\nline two\n');

    expect(onPlainText).toHaveBeenCalledWith('line one\n');
    expect(onProtocolLine).toHaveBeenCalledWith('[AgentTalk]:READY:{"session":"s1"}');
    expect(onPlainText).toHaveBeenCalledWith('line two\n');
  });

  it('should wait for a newline before emitting a protocol line during streaming', () => {
    const { parser, onProtocolLine } = createParser();
    parser.feed('[AgentTalk]:READY:{"session":"123"}');

    expect(onProtocolLine).not.toHaveBeenCalled();
  });

  it('should flush a trailing protocol line on EOF', () => {
    const { parser, onProtocolLine } = createParser();
    parser.feed('[AgentTalk]:READY:{"session":"123"}');
    parser.flush();

    expect(onProtocolLine).toHaveBeenCalledWith('[AgentTalk]:READY:{"session":"123"}');
  });

  it('should buffer split protocol packets across chunks', () => {
    const { parser, onProtocolLine, onPlainText } = createParser();
    parser.feed('[AgentTalk]:READY:{"sess');
    parser.feed('ion":"123"}\n');

    expect(onProtocolLine).toHaveBeenCalledWith('[AgentTalk]:READY:{"session":"123"}');
    expect(onPlainText).not.toHaveBeenCalled();
  });

  it('should suppress expected echoes', () => {
    const { parser, onProtocolLine, onPlainText } = createParser();
    parser.expectEcho('[AgentTalk]:EVT:{"type":"test"}\n');

    parser.feed('[AgentTalk]:EVT:{"type":"test"}\n');
    expect(onProtocolLine).not.toHaveBeenCalled();
    expect(onPlainText).not.toHaveBeenCalled();
  });

  it('should suppress expected echoes split across chunks', () => {
    const { parser, onProtocolLine, onPlainText } = createParser();
    parser.expectEcho('[AgentTalk]:EVT:{"type":"test"}\n');

    parser.feed('[AgentTalk]:EV');
    parser.feed('T:{"type":"test"}\n');

    expect(onProtocolLine).not.toHaveBeenCalled();
    expect(onPlainText).not.toHaveBeenCalled();
  });

  it('should pass through non-matching text even with pending echoes', () => {
    const { parser, onPlainText } = createParser();
    parser.expectEcho('[AgentTalk]:EVT:{"type":"test"}\n');

    parser.feed('different text\n');
    expect(onPlainText).toHaveBeenCalledWith('different text\n');
  });

  it('should strip ANSI codes', () => {
    const { parser, onPlainText } = createParser();
    parser.feed('\x1b[32mgreen text\x1b[0m\n');

    expect(onPlainText).toHaveBeenCalledWith('green text\n');
  });

  it('should preserve blank lines and indentation in plain text', () => {
    const { parser, onPlainText, onProtocolLine } = createParser();
    parser.feed('  indented\n\nline two\n');

    expect(onPlainText).toHaveBeenNthCalledWith(1, '  indented\n');
    expect(onPlainText).toHaveBeenNthCalledWith(2, '\n');
    expect(onPlainText).toHaveBeenNthCalledWith(3, 'line two\n');
    expect(onProtocolLine).not.toHaveBeenCalled();
  });
});
