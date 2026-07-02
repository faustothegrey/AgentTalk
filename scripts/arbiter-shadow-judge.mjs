import fs from 'node:fs/promises';
import path from 'node:path';
import { ApiCompleter } from '@agenttalk/llm-client';

// The judgment vocabulary is the golden-label enum — loaded from the schema so it cannot drift from it.
const LABELS_SCHEMA_URL = new URL('../design/arbiter-shadow-corpus/labels.schema.json', import.meta.url);
const VERDICT_ENUM = JSON.parse(await fs.readFile(LABELS_SCHEMA_URL, 'utf8'))
  .properties.labels.additionalProperties.properties.verdict.enum;

const JUDGE_TOOL_BUILDER = () => ({
  type: 'function',
  function: {
    name: 'submit_judgment',
    description: 'Submit the final arbiter judgment on the consensus process.',
    parameters: {
      type: 'object',
      properties: {
        verdict: {
          type: 'string',
          enum: VERDICT_ENUM,
          description: 'The judgment verdict.'
        },
        rationale: {
          type: 'string',
          description: 'The rationale for this verdict.'
        }
      },
      required: ['verdict', 'rationale']
    }
  }
});

async function main() {
  const args = process.argv.slice(2);
  const entryPath = args.find(a => !a.startsWith('--'));
  const isMock = args.includes('--mock');
  const cadence = args.find(a => a.startsWith('--cadence='))?.split('=')[1] || 'readiness-triggered';
  const outDir = args.find(a => a.startsWith('--outdir='))?.split('=')[1] || 'design/arbiter-shadow-corpus/results';

  if (!entryPath) {
    console.error('Usage: node scripts/arbiter-shadow-judge.mjs <transcript.jsonl> [--mock] [--cadence=readiness-triggered|every-message|every-n]');
    process.exit(1);
  }

  const content = await fs.readFile(entryPath, 'utf8');
  const lines = content.split('\n').filter(Boolean);
  
  let currentTranscript = [];
  let currentPhase = '';
  let goal = '';
  let evaluations = 0;
  
  // Track cost and latency
  let totalLatencyMs = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let finalJudgment = null;
  let isCostUnavailable = false;

  const completer = isMock 
    ? { 
        async complete() { 
          return { 
            text: JSON.stringify({ verdict: 'converged', rationale: 'Mock judgment' }),
            usage: { prompt_tokens: 10, completion_tokens: 5 }
          }; 
        } 
      }
    : new ApiCompleter('google', 'gemini-2.5-flash', fetch, JUDGE_TOOL_BUILDER);

  for (const line of lines) {
    const event = JSON.parse(line);
    if (event.kind === 'event' && event.event === 'team_task_updated') {
      // Deterministic recordings wrap the task ({payload:{task:{…}}}); live-gate recordings carry it directly.
      const task = event.payload.task ?? event.payload;
      if (!task || typeof task !== 'object') continue;
      if (task.status) {
        currentPhase = task.status;
      }
      if (task.transcript) {
        const newTranscript = task.transcript;
        if (!goal && newTranscript.length > 0) {
          goal = newTranscript[0].payload;
        }

        if (newTranscript.length > currentTranscript.length) {
          const addedMessages = newTranscript.slice(currentTranscript.length);
          currentTranscript = newTranscript;

          let shouldTrigger = false;
          if (cadence === 'every-message') {
            shouldTrigger = true;
          } else if (cadence === 'every-n') {
            shouldTrigger = currentTranscript.length % 3 === 0;
          } else if (cadence === 'readiness-triggered') {
            // trigger on specific heuristic keywords in the new messages
            const triggerPattern = /(submit_plan|proposed|accepted|completed|exhausted|correction|declined|interrupted)/i;
            shouldTrigger = addedMessages.some(m => triggerPattern.test(m.payload));
          }

          if (shouldTrigger) {
            evaluations++;
            const prompt = `You are the Arbiter Judge. Your task is to evaluate the consensus process of a team of agents.
Goal: ${goal}
Current Phase: ${currentPhase}

Allowed judgment verdicts: ${JSON.stringify(VERDICT_ENUM)}

Transcript so far:
${JSON.stringify(currentTranscript, null, 2)}

Provide your judgment using the allowed vocabulary.`;

            const start = Date.now();
            const result = await completer.complete(prompt, { expectsStructured: true });
            const duration = Date.now() - start;
            totalLatencyMs += duration;

            if (result.usage) {
              totalPromptTokens += result.usage.prompt_tokens || 0;
              totalCompletionTokens += result.usage.completion_tokens || 0;
            } else {
              isCostUnavailable = true;
            }

            try {
              finalJudgment = JSON.parse(result.text);
            } catch (e) {
              finalJudgment = { verdict: 'error', rationale: 'Failed to parse judgment' };
            }
          }
        }
      }
    }
  }

  // If no triggers happened during the loop but we have a transcript, ensure at least one evaluation at the end
  if (evaluations === 0 && currentTranscript.length > 0) {
    evaluations++;
    const prompt = `You are the Arbiter Judge. Your task is to evaluate the consensus process of a team of agents.
Goal: ${goal}
Current Phase: ${currentPhase}

Allowed judgment verdicts: ${JSON.stringify(VERDICT_ENUM)}

Transcript:
${JSON.stringify(currentTranscript, null, 2)}

Provide your judgment using the allowed vocabulary.`;

    const start = Date.now();
    const result = await completer.complete(prompt, { expectsStructured: true });
    totalLatencyMs += (Date.now() - start);

    if (result.usage) {
      totalPromptTokens += result.usage.prompt_tokens || 0;
      totalCompletionTokens += result.usage.completion_tokens || 0;
    } else {
      isCostUnavailable = true;
    }

    try {
      finalJudgment = JSON.parse(result.text);
    } catch (e) {
      finalJudgment = { verdict: 'error', rationale: 'Failed to parse judgment' };
    }
  }

  const output = {
    entry: path.basename(entryPath),
    cadence,
    evaluations,
    judgment: finalJudgment,
    latency_ms: totalLatencyMs,
    tokens: isCostUnavailable ? 'unavailable' : {
      prompt: totalPromptTokens,
      completion: totalCompletionTokens
    }
  };

  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${path.basename(entryPath, '.jsonl')}_${cadence}_result.json`);
  await fs.writeFile(outPath, JSON.stringify(output, null, 2));

  console.log(JSON.stringify(output));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
