# Gemini CLI via node-pty

This project includes a minimal PTY launcher:

- Script: `scripts/gemini-pty.mjs`
- NPM command: `npm run gemini:pty -- [gemini args...]`

## Examples

```bash
npm run gemini:pty
npm run gemini:pty -- --model gemini-2.5-flash
npm run gemini:pty -- -p "Say hello" --output-format text
npm run gemini:pty -- --stats-out /tmp/gemini-stats.txt
```

## Optional env vars

```bash
GEMINI_CMD=gemini npm run gemini:pty
```

Use `GEMINI_CMD` if your executable is not named `gemini`.

## Wrapper options

- `--stats-out <path>`: auto-send `/stats` and write captured terminal output to the file.
- `--stats-wait-ms <n>`: delay before sending `/stats` (default: `2000`).
- `--stats-capture-ms <n>`: capture window after `/stats` is sent (default: `5000`).
- `--no-stats-exit`: keep the Gemini session open after writing the stats file.

## Notes

- The launcher requires an interactive terminal (TTY).
