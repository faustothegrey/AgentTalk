import fs from 'fs';
import path from 'path';
import readline from 'readline';

async function audit() {
  const filePath = path.join(process.cwd(), 'design/arbiter-shadow-corpus/sample-success.jsonl');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Corpus sample not found at ${filePath}`);
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity
  });

  const semanticEvidence = {
    hasGoal: false,
    hasFactCollection: false,
    hasAgreementProposal: false,
    hasAgreementAcceptance: false,
    hasPlanSubmitted: false,
    hasTerminalOutcome: false,
  };

  for await (const line of rl) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line);

    if (entry.kind === 'event' && entry.event === 'team_task_updated' && entry.payload.task) {
      const task = entry.payload.task;
      
      // Check transcript
      if (task.transcript) {
        for (const msg of task.transcript) {
          if (msg.from === 'user' && msg.payload && msg.payload.includes('Collaborative planning task')) {
            semanticEvidence.hasGoal = true;
          }
          if (msg.from === 'system' && msg.payload && msg.payload.includes('Fact collection phase started')) {
            semanticEvidence.hasFactCollection = true;
          }
          if (msg.payload && msg.payload.includes('Agreement proposed:')) {
            semanticEvidence.hasAgreementProposal = true;
          }
          if (msg.payload && msg.payload.includes('Agreement reached for proposal:')) {
            semanticEvidence.hasAgreementAcceptance = true;
          }
          if (msg.payload && msg.payload.includes('Planner finished and submitted the final plan')) {
            semanticEvidence.hasPlanSubmitted = true;
          }
        }
      }

      if (task.status === 'delegated') {
        semanticEvidence.hasTerminalOutcome = true;
      }
    }
  }

  const missing = Object.entries(semanticEvidence)
    .filter(([_, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    console.error('Audit failed! Missing evidence:', missing);
    process.exit(1);
  } else {
    console.log('Audit passed! The recording contains full semantic evidence (goal, phases, agreement, submittal, outcome).');
    process.exit(0);
  }
}

audit().catch(console.error);
