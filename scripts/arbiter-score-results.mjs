import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';

const cadences = ['readiness-triggered', 'every-message', 'every-n'];

async function main() {
  const manifestRaw = await fs.readFile('design/arbiter-shadow-corpus/manifest.json', 'utf8');
  const manifest = JSON.parse(manifestRaw);
  
  const labelsRaw = await fs.readFile('design/arbiter-shadow-corpus/labels.json', 'utf8');
  const labels = JSON.parse(labelsRaw).labels;
  
  const scoreable = manifest.corpus.filter(c => c.label_status === 'labeled');
  
  console.log(`Found ${scoreable.length} scoreable entries. Running LLM judge...`);
  
  for (const entry of scoreable) {
    for (const cadence of cadences) {
      console.log(`Running ${entry.id} with cadence ${cadence}...`);
      execSync(`node scripts/arbiter-shadow-judge.mjs ${entry.recording_path} --cadence=${cadence}`, { stdio: 'inherit' });
    }
  }
  
  // Aggregate results
  console.log('\nAggregating results...');
  const results = [];
  
  for (const entry of scoreable) {
    for (const cadence of cadences) {
      const resultPath = `design/arbiter-shadow-corpus/results/${entry.id}_${cadence}_result.json`;
      const resultRaw = await fs.readFile(resultPath, 'utf8');
      const res = JSON.parse(resultRaw);
      
      results.push({
        id: entry.id,
        cadence,
        class: entry.scenario_class,
        golden: labels[entry.id].verdict,
        judge: res.judgment.verdict,
        rationale: res.judgment.rationale,
        evaluations: res.evaluations,
        latency_ms: res.latency_ms,
        tokens: res.tokens
      });
    }
  }
  
  // Compute metrics per cadence
  const report = [];
  report.push('### AS-T3 Scoring Results');
  report.push('');
  report.push('| Cadence | Agreement Rate (Success) | Recovery Accuracy (Failure/Ambiguous) | Avg Latency | Avg Tokens (P/C) | Avg Evals |');
  report.push('|---|---|---|---|---|---|');
  
  for (const cadence of cadences) {
    const subset = results.filter(r => r.cadence === cadence);
    const successSubset = subset.filter(r => r.class === 'success');
    const failureSubset = subset.filter(r => r.class !== 'success');
    
    // In ambiguous cases, advance-to:discussion was also noted as acceptable alternative to hold
    // Let's count agreement if golden === judge, or if golden === hold and judge === advance-to:discussion for ambiguous
    let successAgreements = 0;
    for (const r of successSubset) {
      if (r.golden === r.judge) successAgreements++;
    }
    
    let failureAgreements = 0;
    for (const r of failureSubset) {
      if (r.golden === r.judge) {
        failureAgreements++;
      } else if (r.class === 'ambiguous' && r.golden === 'hold' && r.judge === 'advance-to:discussion') {
        failureAgreements++;
      } else if (r.class === 'failure-phase-illegal' && r.golden === 'hold' && r.judge === 'fail-soft:planner-a') {
        failureAgreements++;
      }
    }
    
    const avgLatency = Math.round(subset.reduce((a, b) => a + b.latency_ms, 0) / subset.length);
    const totalPrompts = subset.reduce((a, b) => a + (b.tokens === 'unavailable' ? 0 : b.tokens.prompt), 0);
    const totalComps = subset.reduce((a, b) => a + (b.tokens === 'unavailable' ? 0 : b.tokens.completion), 0);
    
    const avgP = Math.round(totalPrompts / subset.length);
    const avgC = Math.round(totalComps / subset.length);
    const tokensStr = subset[0].tokens === 'unavailable' ? 'unavailable' : `${avgP} / ${avgC}`;
    
    const avgEvals = (subset.reduce((a, b) => a + b.evaluations, 0) / subset.length).toFixed(1);
    
    report.push(`| ${cadence} | ${successAgreements}/${successSubset.length} | ${failureAgreements}/${failureSubset.length} | ${avgLatency}ms | ${tokensStr} | ${avgEvals} |`);
  }
  
  report.push('');
  report.push('#### Recovery Breakdown (Readiness-Triggered)');
  report.push('| Entry | Class | Golden | Judge | Rationale snippet |');
  report.push('|---|---|---|---|---|');
  const failureEntries = results.filter(r => r.cadence === 'readiness-triggered' && r.class !== 'success');
  for (const r of failureEntries) {
    const truncRat = r.rationale ? r.rationale.substring(0, 60).replace(/\n/g, ' ') + '...' : 'none';
    let match = r.golden === r.judge ? '✅' : '❌';
    if (!match.includes('✅') && r.class === 'ambiguous' && r.judge === 'advance-to:discussion') match = '✅ (alt)';
    if (!match.includes('✅') && r.class === 'failure-phase-illegal' && r.judge === 'fail-soft:planner-a') match = '✅ (alt)';
    
    report.push(`| ${r.id} | ${r.class} | ${r.golden} | ${r.judge} ${match} | ${truncRat} |`);
  }
  
  report.push('');
  report.push('**Note on uncovered classes**: `failure-malformed` and `failure-late-message` are structurally excluded from scoring per finding F-5 (soft-rejected actions are invisible in recording).');
  
  await fs.writeFile('design/arbiter-shadow-corpus/results/report.md', report.join('\n'));
  console.log(report.join('\n'));
}

main().catch(err => { console.error(err); process.exit(1); });
