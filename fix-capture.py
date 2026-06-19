import re

with open('packages/observability/src/usage-history/capture.ts', 'r') as f:
    lines = f.readlines()

new_lines = []
in_spawn = False
for line in lines:
    if line.startswith("import { spawn } from 'child_process';"):
        continue
    if line.startswith("export function spawnAndWait("):
        in_spawn = True
        continue
    if in_spawn:
        if line.startswith("}"):
            in_spawn = False
        continue
    new_lines.append(line)

with open('packages/observability/src/usage-history/capture.ts', 'w') as f:
    f.writelines(new_lines)
