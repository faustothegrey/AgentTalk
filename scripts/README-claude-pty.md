# Claude CLI via node-pty

- Script: `scripts/claude-pty.mjs`
- NPM command: `npm run claude:pty -- [claude args...]`

## Examples

```bash
npm run claude:pty
npm run claude:pty -- --usage-out /tmp/claude-usage.txt
npm run claude:pty -- --usage-out /tmp/claude-usage.txt --usage-wait-ms 9000 --usage-capture-ms 8000
```

## Optional env vars

```bash
CLAUDE_CMD=claude npm run claude:pty
```

## Wrapper options

- `--usage-out <path>`: auto-send `/usage` and write captured terminal output to file.
- `--usage-wait-ms <n>`: delay before sending `/usage` (default: `7000`).
- `--usage-capture-ms <n>`: capture window after `/usage` is sent (default: `6000`).
- `--no-usage-exit`: keep the Claude session open after writing the capture file.
