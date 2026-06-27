# Live-test API gateways & models

**Status:** Living reference (started 2026-06-27). Append as we add gateways/models — keep each entry dated and
backed by a real verified ping (verify, don't assert).
**Purpose:** the curated set of **real provider endpoints + models** usable for *live* (non-mocked) tests of the
API path — the `tools`/`tool_choice`/`response_format` transport, the protocol gates, provider-parity checks, the
M10-T4 probe, etc. The mocked-`fetch` unit tests don't need this; the live harness does.

---

## Gateways

### OpenRouter — ✅ confirmed working 2026-06-27
- **Provider id:** `openrouter` (already wired in `packages/llm-client/src/api-client.ts`).
- **Env key:** `OPENROUTER_API_KEY` (present in this env; `sk-or-v1…`).
- **Base URL:** `https://openrouter.ai/api/v1` (OpenAI-compatible `/chat/completions`).
- **Model catalog:** `GET /models` (Bearer auth) → **339 models** as of 2026-06-27, including many free ones.
- **Why it matters:** one key unlocks a large multi-vendor model pool behind an OpenAI-compatible surface, so a
  single gateway can stand in for several providers in live tests without holding each vendor's key.

*(Other gateways already in the provider table — `google`/`GEMINI_API_KEY`, `nous`/`HERMES_API_KEY` — are
documented in the code's provider table; add live-verification notes here as we exercise them.)*

---

## Free models (verified pingable 2026-06-27)

> ⚠️ **The `:free` tier is rate-limited / intermittent.** Providers return *"Provider returned error"* under load
> (seen live on `gemma-4-31b:free`, which then worked on retry). **Do not gate CI / a required check on a `:free`
> model** — use one of the cheap-paid fallbacks below for anything that must be reliable. Free models are fine for
> exploratory pings and non-blocking smokes.

**Best free picks (clean instruct output — returned a terse `pong` directly):**
| Model id | Notes |
|---|---|
| `google/gemma-4-26b-a4b-it:free` | Cleanest free instruct response on first try. Good default free ping. |
| `google/gemma-4-31b-it:free` | Clean output when it responds; errored once then succeeded (tier flakiness). |

**Free but reasoning-heavy (work, but spend the token budget on a `reasoning` field; `content` may be `null` at low
`max_tokens` — raise `max_tokens` and read `reasoning`):**
`nvidia/nemotron-3-ultra-550b-a55b:free`, `nvidia/nemotron-3-super-120b-a12b:free`,
`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`, `liquid/lfm-2.5-1.2b-thinking:free`,
`poolside/laguna-xs.2:free`, `poolside/laguna-m.1:free`. Not ideal for terse or structured-envelope pings.

**Special:** `openrouter/free` — OpenRouter's auto-routed free endpoint (pick-a-free-model-for-you).

---

## Reliable cheap fallbacks (paid, but effectively free per call)

For live tests that must not flake on the free tier — a ping costs a rounding error:
| Model id | Prompt price / token | Verified |
|---|---|---|
| `meta-llama/llama-3.3-70b-instruct` | `$0.0000001` | ✅ `pong`, 2026-06-27 |
| `openai/gpt-4o-mini` | `$0.00000015` | (cheap, well-known; not yet pinged here) |

---

## How to use / extend

- **List models:** `curl -s https://openrouter.ai/api/v1/models -H "Authorization: Bearer $OPENROUTER_API_KEY"`.
- **Ping a model:** POST `/chat/completions` with `{model, messages, max_tokens}` (OpenAI shape).
- **Adding more (incl. non-free):** we'll add models as necessity needs. When adding one, **ping it first**, then
  append a dated row here with the verified result — same discipline as the free list above. Non-free models get
  their own table when we add the first one.

See `logbook.md` LB-42 for the confirming run.
