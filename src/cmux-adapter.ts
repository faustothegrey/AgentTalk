import type { CreatePaneResult, SurfaceReadResult } from './types.js';
import { runCmux } from './utils/shell.js';

export interface CmuxAdapter {
  createPane(splitDirection: 'right' | 'down', anchorSurfaceRef?: string): Promise<CreatePaneResult>;
  sendText(surfaceRef: string, text: string): Promise<void>;
  readSurface(surfaceRef: string): Promise<SurfaceReadResult>;
  notify(title: string, body?: string, surfaceRef?: string): Promise<void>;
}

export class CmuxAdapterImpl implements CmuxAdapter {
  /**
   * Creates a new pane via `cmux new-split`.
   * Returns refs for the newly created workspace, pane, and surface.
   */
  async createPane(
    splitDirection: 'right' | 'down',
    anchorSurfaceRef?: string,
  ): Promise<CreatePaneResult> {
    const args = ['new-pane', '--type', 'terminal', '--direction', splitDirection];

    if (anchorSurfaceRef) {
      args.push('--surface', anchorSurfaceRef);
    }

    const output = await runCmux(args);
    return this.parseCreatePaneResult(output);
  }

  /**
   * Sends text input to a target surface via `cmux send`.
   */
  async sendText(surfaceRef: string, text: string): Promise<void> {
    await runCmux(['send', '--surface', surfaceRef, text]);
  }

  /**
   * Reads the current screen content via `cmux read-screen`.
   * V1 uses 400 lines of scrollback.
   */
  async readSurface(surfaceRef: string): Promise<SurfaceReadResult> {
    const lines = '400';
    const raw = await runCmux([
      'read-screen',
      '--surface',
      surfaceRef,
      '--scrollback',
      '--lines',
      lines,
    ]);

    return {
      text: raw,
      raw,
    };
  }

  /**
   * Sends a system notification via `cmux notify`.
   */
  async notify(title: string, body?: string, surfaceRef?: string): Promise<void> {
    const args = ['notify', '--title', title];

    if (body) {
      args.push('--body', body);
    }

    if (surfaceRef) {
      args.push('--surface', surfaceRef);
    }

    await runCmux(args);
  }

  /**
   * Internal helper to parse the output of `cmux new-split`.
   * Expects format containing: workspace:<n>, pane:<n>, surface:<n>
   */
  private parseCreatePaneResult(output: string): CreatePaneResult {
    // Example output: "OK pane:4 surface:6 workspace:2"
    const workspaceMatch = output.match(/workspace:\d+/);
    const paneMatch = output.match(/pane:\d+/);
    const surfaceMatch = output.match(/surface:\d+/);

    if (!workspaceMatch || !surfaceMatch) {
      throw new Error(`Failed to parse cmux new-split output: "${output}"`);
    }

    return {
      workspaceRef: workspaceMatch[0],
      paneRef: paneMatch ? paneMatch[0] : surfaceMatch[0].replace('surface:', 'pane:'),
      surfaceRef: surfaceMatch[0],
    };
  }
}
