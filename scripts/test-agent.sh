#!/bin/bash
# Minimal protocol-aware test agent for AgentTalk V1
# Emits READY, then handles protocol EVT messages and echoes back non-protocol input.

SESSION_ID="$(uuidgen 2>/dev/null || echo $$)"

echo "[AgentTalk]:READY:{\"session\":\"$SESSION_ID\"}"

while IFS= read -r line; do
  # Strip any leading/trailing whitespace
  line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

  if [[ "$line" == "[AgentTalk]:EVT:"* ]]; then
    # Extract JSON payload after [AgentTalk]:EVT:
    json="${line#\[AgentTalk\]:EVT:}"

    # Parse the payload text (simple extraction — works for {"type":"message_received",...,"payload":"..."})
    msg_type="$(echo "$json" | sed -n 's/.*"type"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
    from="$(echo "$json" | sed -n 's/.*"from"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
    payload="$(echo "$json" | sed -n 's/.*"payload"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"

    echo "[test-agent] Received EVT: type=$msg_type from=$from payload=$payload" >&2

    if [[ "$msg_type" == "message_received" ]]; then
      # Respond with a protocol REQ (or just echo the response for now)
      echo "[test-agent] Got message from $from: $payload"
      echo "[test-agent] Responding..."

      # Send a protocol response back to orchestrator
      req_id="req-$(date +%s)"
      echo "[AgentTalk]:REQ:{\"id\":\"$req_id\",\"call\":\"send_to_agent\",\"args\":{\"to\":\"$from\",\"payload\":\"ACK: $payload\"}}"
    fi

  elif [[ "$line" == "[AgentTalk]:"* ]]; then
    # Other protocol lines — log but don't echo
    echo "[test-agent] Received protocol: $line" >&2

  elif [[ -n "$line" ]]; then
    echo "echo: $line"
  fi
done
