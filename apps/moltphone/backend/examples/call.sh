#!/bin/bash
# MoltPhone AI Call — place a call, then read the transcript
# Usage:
#   ./call.sh              — place a call
#   ./call.sh transcript   — get latest call transcript

API_BASE="https://api.moltphone.xyz"
API_KEY="${MOLTPHONE_API_KEY:?Set MOLTPHONE_API_KEY env var}"
AUTH="Authorization: Bearer $API_KEY"

place_call() {
  echo "📞 Placing call..."
  curl -s -X POST "$API_BASE/call" \
    -H "$AUTH" \
    -H "Content-Type: application/json" \
    -d '{
      "to_number": "+35056001056",
      "assistant_config": {
        "first_message": "Hi, I would like to order a taxi from Nimbus house to the airport. 2 adults and 1 child.",
        "system_prompt": "You are a pesronal assistant. Your goal is to book a taxi... Do not present yourself as AI",
        "voice": "alice",
        "model": "gpt-4o-mini",
        "error_message": "Sorry, I didn't catch that. Could you repeat?"
      }
    }' | python3 -m json.tool
}

get_transcript() {
  echo "📋 Fetching latest call..."
  CALL_ID=$(curl -s "$API_BASE/calls?limit=1" -H "$AUTH" \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["calls"][0]["id"] if d.get("calls") else "")')

  if [ -z "$CALL_ID" ]; then
    echo "❌ No calls found"
    return 1
  fi

  echo "   Call ID: $CALL_ID"

  echo ""
  echo "── Call Details ──"
  curl -s "$API_BASE/calls/$CALL_ID" -H "$AUTH" \
    | python3 -c '
import sys, json
d = json.load(sys.stdin).get("call", {})
print("  Status:  " + d.get("status", "N/A"))
print("  To:      " + d.get("toNumber", "N/A"))
print("  Mode:    " + d.get("mode", "N/A"))
print("  Result:  " + str(d.get("callResult", "N/A")))
print("  Created: " + d.get("createdAt", "N/A"))
'

  echo ""
  echo "── Transcript ──"
  curl -s "$API_BASE/calls/$CALL_ID/transcript" -H "$AUTH" \
    | python3 -c '
import sys, json
data = json.load(sys.stdin)
entries = data.get("transcript", data.get("transcripts", []))
if not entries:
    print("  (no transcript yet)")
else:
    for e in sorted(entries, key=lambda x: x.get("timestamp", "")):
        role = "Caller" if e["role"] == "user" else "AI"
        print("  " + role + ": " + e["content"])
        print()
'
}

case "${1:-call}" in
  call)       place_call ;;
  transcript) get_transcript ;;
  *)          echo "Usage: ./call.sh [call|transcript]" ;;
esac
