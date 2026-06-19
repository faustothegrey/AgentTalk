import re

with open('packages/observability/src/usage-history/capture.ts', 'r') as f:
    content = f.read()
    
content = content.replace("import { mkdtemp, readFile, rm } from 'fs/promises';", "")
content = content.replace("import { tmpdir } from 'os';", "")
content = content.replace("const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');", "")

with open('packages/observability/src/usage-history/capture.ts', 'w') as f:
    f.write(content)

with open('apps/orchestrator/src/server.ts', 'r') as f:
    content = f.read()

content = content.replace("  buildUsageHistoryEntry,\n", "")

with open('apps/orchestrator/src/server.ts', 'w') as f:
    f.write(content)
