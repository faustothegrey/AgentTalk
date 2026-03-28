import { describe, it, expect } from 'vitest';
import { CmuxAdapterImpl } from '../cmux-adapter.js';

describe('CmuxAdapterImpl', () => {
  const adapter = new CmuxAdapterImpl();

  describe('parseCreatePaneResult', () => {
    it('should correctly parse valid cmux new-split output', () => {
      const output = 'OK pane:4 surface:6 workspace:2';
      const result = (adapter as any).parseCreatePaneResult(output);
      
      expect(result).toEqual({
        workspaceRef: 'workspace:2',
        paneRef: 'pane:4',
        surfaceRef: 'surface:6',
      });
    });

    it('should correctly parse valid cmux output even with different ordering', () => {
      const output = 'workspace:99 pane:101 OK surface:202';
      const result = (adapter as any).parseCreatePaneResult(output);
      
      expect(result).toEqual({
        workspaceRef: 'workspace:99',
        paneRef: 'pane:101',
        surfaceRef: 'surface:202',
      });
    });

    it('should throw an error on malformed output missing workspace', () => {
      const output = 'OK pane:4 surface:6';
      expect(() => (adapter as any).parseCreatePaneResult(output)).toThrow(/Failed to parse cmux new-split output/);
    });

    it('should throw an error on empty output', () => {
      const output = '';
      expect(() => (adapter as any).parseCreatePaneResult(output)).toThrow(/Failed to parse cmux new-split output/);
    });
  });
});
