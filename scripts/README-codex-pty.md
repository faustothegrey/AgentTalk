# Codex CLI via node-pty

- Script: `scripts/codex-pty.mjs`
- NPM command: `npm run codex:pty -- [codex args...]`

## Examples

```bash
npm run codex:pty
npm run codex:pty -- --status-out /tmp/codex-status.txt
npm run codex:pty -- --status-out /tmp/codex-status.txt --status-wait-ms 9000 --status-capture-ms 8000
```

## Optional env vars

```bash
CODEX_CMD=codex npm run codex:pty
```

## Wrapper options

- `--status-out <path>`: auto-send `/status` and write captured terminal output to file.
- `--status-wait-ms <n>`: delay before sending `/status` (default: `7000`).
- `--status-capture-ms <n>`: capture window after `/status` is sent (default: `7000`).
- `--no-status-exit`: keep the Codex session open after writing the capture file.

## Note

- The wrapper adds `--no-alt-screen` by default for easier capture.
