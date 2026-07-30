# Run `hmp1` — raw evidence

Preserved from `/tmp`, which does not survive a reboot. Grading: `../hmp1-grading.md`.

- **`recording.json`** — the orchestrator's run log: `run-start` → `agent-launched` → `goal-delivered` →
  `outcome`. 1m43s end to end.
- **`responses.ndjson`** — the worker's raw reply, the sidecar `launcher.mjs` derives from the recording path.
  It is the **only** durable record of what the worker actually said, and it is what R2 was graded against.

Kept because a grading that cites evidence living in a temp directory is a grading that cannot be re-checked.
