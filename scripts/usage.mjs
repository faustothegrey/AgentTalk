#!/usr/bin/env node
// Resource-meter reader for the AgentTalk out-of-band usage endpoint (LB-11).
// Polls http://127.0.0.1:9899/{usage,tokens} and prints a compact, human-readable
// summary so agents don't re-parse the raw JSON by eye each session.
//
// Usage:  node scripts/usage.mjs           # pretty summary
//         node scripts/usage.mjs --json    # raw merged JSON passthrough
//
// STRICTLY best-effort / NEVER blocking (AGENT.md Resource Monitoring): a down or
// jittery meter prints a one-line notice and exits 0. Never treat a failed read as
// a blocker. The `claude` block can return ok:false (e.g. "Usage credits are off").

const BASE = process.env.AGENTTALK_METER ?? 'http://127.0.0.1:9899';
const RAW = process.argv.includes('--json');

async function get(path) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${BASE}${path}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return { __error: `HTTP ${res.status}` };
    return await res.json();
  } catch (e) {
    return { __error: e?.name === 'AbortError' ? 'timeout' : String(e?.message ?? e) };
  }
}

const pct = (n) => (typeof n === 'number' ? `${n}%` : '—');
const bar = (used) => {
  if (typeof used !== 'number') return '';
  const filled = Math.round(used / 10);
  return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}]`;
};

function fmtProvider(name, block) {
  if (!block) return `  ${name.padEnd(12)} (absent)`;
  if (block.ok === false) {
    const why = block.parsed?.usage_credits ?? 'ok:false';
    return `  ${name.padEnd(12)} unavailable — ${why}`;
  }
  const p = block.parsed ?? {};
  // claude shape
  if (p.current_week_all_models || p.current_session) {
    const wk = p.current_week_all_models ?? {};
    const ss = p.current_session ?? {};
    return [
      `  ${name.padEnd(12)} weekly ${bar(wk.used_percent)} ${pct(wk.used_percent)} used` +
        (wk.resets ? `  (resets ${wk.resets})` : ''),
      `  ${''.padEnd(12)} session ${bar(ss.used_percent)} ${pct(ss.used_percent)} used` +
        (ss.resets ? `  (resets ${ss.resets})` : ''),
    ].join('\n');
  }
  // codex shape
  if (p.weekly_limit || p.five_hour_limit) {
    const wk = p.weekly_limit ?? {};
    const fh = p.five_hour_limit ?? {};
    return [
      `  ${name.padEnd(12)} weekly ${bar(wk.used_percent)} ${pct(wk.used_percent)} used` +
        (wk.resets ? `  (resets ${wk.resets})` : ''),
      `  ${''.padEnd(12)} 5h      ${bar(fh.used_percent)} ${pct(fh.used_percent)} used` +
        (fh.resets ? `  (resets ${fh.resets})` : ''),
    ].join('\n');
  }
  // antigravity / gemini shape
  if (typeof p.highest_used_percent === 'number') {
    return `  ${name.padEnd(12)} ${bar(p.highest_used_percent)} ${pct(p.highest_used_percent)} used` +
      ` (${p.window ?? '?'})`;
  }
  return `  ${name.padEnd(12)} ${JSON.stringify(p)}`;
}

const usage = await get('/usage');
const tokens = await get('/tokens');

if (RAW) {
  console.log(JSON.stringify({ usage, tokens }, null, 2));
  process.exit(0);
}

console.log('— AgentTalk resource meter —');
if (usage.__error) {
  console.log(`  /usage unavailable: ${usage.__error} (best-effort — carry on)`);
} else {
  for (const name of ['claude', 'codex', 'antigravity']) {
    console.log(fmtProvider(name, usage[name]));
  }
  if (usage.last_update) console.log(`  (updated ${usage.last_update})`);
}

if (!tokens.__error && tokens.claude?.ok && tokens.claude.tokens_last_30_days) {
  const t = tokens.claude.tokens_last_30_days.totals ?? {};
  const m = (n) => (typeof n === 'number' ? `${(n / 1e6).toFixed(1)}M` : '—');
  console.log(
    `  claude 30d tokens: in ${m(t.input_tokens)} / out ${m(t.output_tokens)} / ` +
      `cache-read ${m(t.cache_read_input_tokens)}`,
  );
}
process.exit(0);
