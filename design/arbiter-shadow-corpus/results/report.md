### AS-T3 Scoring Results

| Cadence | Agreement Rate (Success) | Recovery Accuracy (Failure/Ambiguous) | Avg Latency | Avg Tokens (P/C) | Avg Evals |
|---|---|---|---|---|---|
| readiness-triggered | 5/6 | 3/5 | 7592ms | 5210 / 327 | 6.2 |
| every-message | 5/6 | 3/5 | 14450ms | 8726 / 633 | 11.9 |
| every-n | 2/6 | 2/5 | 4530ms | 2518 / 182 | 3.4 |

#### Recovery Breakdown (Readiness-Triggered)
| Entry | Class | Golden | Judge | Rationale snippet |
|---|---|---|---|---|
| failure-phase-illegal | failure-phase-illegal | hold | hold ✅ | The planning process is currently in the discussion phase, b... |
| failure-bounded-correction | failure-bounded-correction | fail-soft:planner-a | hold ❌ | The consensus process is currently frozen due to an illegal ... |
| failure-non-converging | failure-non-converging | not-converged | hold ❌ | The discussion phase was interrupted due to the exhaustion o... |
| ambiguous-1 | ambiguous | hold | advance-to:discussion ✅ (alt) | The planners have completed the fact collection phase and ar... |
| ambiguous-2 | ambiguous | hold | advance-to:discussion ✅ (alt) | The planners have completed the fact collection phase and ar... |

**Note on uncovered classes**: `failure-malformed` and `failure-late-message` are structurally excluded from scoring per finding F-5 (soft-rejected actions are invisible in recording).