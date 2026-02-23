#!/usr/bin/env python3
"""
MoltPhone AI Call Script — place calls, read transcripts.

Usage:
  python call.py                                # Interactive mode
  python call.py call --to +1234567890          # Quick call
  python call.py transcript                     # Latest call transcript
  python call.py health                         # Health check
"""

import argparse
import json
import os
import sys
import requests

# ─── Configuration ───────────────────────────────────────────────
API_BASE = "https://api.moltphone.xyz"
API_KEY = os.environ.get("MOLTPHONE_API_KEY", "")

DEFAULTS = {
    "first_message": "Hi, I would like to order a taxi from Nimbus house, Tradewinds to the airport. 2 adults and 1 child.",
    "system_prompt": (
        "You are a personal assistant, calling a taxi company in Gibraltar.\n"
        "Your goal and task is to order the taxi from Nimbus house, Tradewinds to the airport. 2 adults and 1 child."
        "Do not present yourself as AI, you are Dave Smith.\n"
        "Once the booking is confirmed and you have all the details, "
        "say goodbye politely and end your final message with [END_CALL]"
    ),
    "voice": "alice",
    "model": "gpt-5.1",
    "error_message": "Sorry, I didn't catch that. Could you repeat?",
}


def headers():
    return {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}


# ─── Commands ────────────────────────────────────────────────────

def cmd_health():
    """Health check."""
    try:
        r = requests.get(f"{API_BASE}/health", timeout=10)
        d = r.json()
        print(f"🏥 Health: {d.get('status')} | Service: {d.get('service')}")
    except Exception as e:
        print(f"❌ API unreachable: {e}")


def cmd_call(phone, config=None):
    """Place a call."""
    if not API_KEY:
        print("❌ Set MOLTPHONE_API_KEY env var"); return

    config = config or dict(DEFAULTS)
    payload = {"to_number": phone, "assistant_config": config}

    print(f"\n📞 Calling {phone}...")
    print(f"   Prompt: {config['system_prompt'][:80]}...")

    r = requests.post(f"{API_BASE}/call", json=payload, headers=headers(), timeout=30)
    d = r.json()

    if r.ok:
        call = d.get("call", d)
        print(f"✅ Call initiated!")
        print(f"   Call ID:    {call.get('id', 'N/A')}")
        print(f"   Twilio SID: {call.get('twilioCallSid', 'N/A')}")
        print(f"   Status:     {call.get('status', 'N/A')}")
        print(f"   Balance:    {d.get('remaining_balance', 'N/A')}")
    else:
        print(f"❌ Error ({r.status_code}): {json.dumps(d, indent=2)}")

    return d


def cmd_transcript(call_id=None):
    """Fetch and print transcript for a call (default: latest)."""
    if not API_KEY:
        print("❌ Set MOLTPHONE_API_KEY env var"); return

    # Get latest call if no ID given
    if not call_id:
        r = requests.get(f"{API_BASE}/calls?limit=1", headers=headers(), timeout=10)
        calls = r.json().get("calls", [])
        if not calls:
            print("❌ No calls found"); return
        call_id = calls[0]["id"]

    print(f"📋 Call ID: {call_id}\n")

    # Call details
    r = requests.get(f"{API_BASE}/calls/{call_id}", headers=headers(), timeout=10)
    call = r.json().get("call", {})
    print("── Call Details ──")
    print(f"  Status:  {call.get('status', 'N/A')}")
    print(f"  To:      {call.get('toNumber', 'N/A')}")
    print(f"  Mode:    {call.get('mode', 'N/A')}")
    print(f"  Created: {call.get('createdAt', 'N/A')}")

    # Transcript
    print("\n── Transcript ──")
    r = requests.get(f"{API_BASE}/calls/{call_id}/transcript", headers=headers(), timeout=10)
    data = r.json()
    entries = data.get("transcript", data.get("transcripts", []))

    if not entries:
        print("  (no transcript yet — call may still be in progress)")
    else:
        for e in sorted(entries, key=lambda x: x.get("timestamp", "")):
            role = "🧑 Caller" if e["role"] == "user" else "🤖 AI"
            print(f"  {role}: {e['content']}\n")


def cmd_calls(limit=5):
    """List recent calls."""
    if not API_KEY:
        print("❌ Set MOLTPHONE_API_KEY env var"); return

    r = requests.get(f"{API_BASE}/calls?limit={limit}", headers=headers(), timeout=10)
    calls = r.json().get("calls", [])

    if not calls:
        print("No calls found."); return

    print(f"{'ID':<24} {'Status':<12} {'To':<16} {'Created'}")
    print("─" * 75)
    for c in calls:
        print(f"{c['id']:<24} {c.get('status','?'):<12} {c.get('toNumber','?'):<16} {c.get('createdAt','?')[:19]}")


# ─── Main ────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="MoltPhone AI Call Tool")

    # Top-level --to shortcut (so `python call.py --to +123` works)
    parser.add_argument("--to", help="Phone number (E.164) — shortcut for 'call --to'")
    parser.add_argument("--system-prompt", help="Custom system prompt", default=DEFAULTS["system_prompt"])
    parser.add_argument("--first-message", help="Custom first message", default=DEFAULTS["first_message"])
    parser.add_argument("--error-message", help="Custom error message", default=DEFAULTS["error_message"])
    parser.add_argument("--model", default=DEFAULTS["model"])

    sub = parser.add_subparsers(dest="command")

    # call
    p_call = sub.add_parser("call", help="Place a call")
    p_call.add_argument("--to", required=True, help="Phone number (E.164)")
    p_call.add_argument("--system-prompt", help="Custom system prompt", default=DEFAULTS["system_prompt"])
    p_call.add_argument("--first-message", help="Custom first message", default=DEFAULTS["first_message"])
    p_call.add_argument("--error-message", help="Custom error message", default=DEFAULTS["error_message"])
    p_call.add_argument("--model", default=DEFAULTS["model"])

    # transcript
    p_tr = sub.add_parser("transcript", help="Get call transcript")
    p_tr.add_argument("--id", help="Call ID (default: latest)")

    # list
    p_ls = sub.add_parser("calls", help="List recent calls")
    p_ls.add_argument("--limit", type=int, default=5)

    # health
    sub.add_parser("health", help="Health check")

    args = parser.parse_args()

    # --to without subcommand → treat as "call"
    if not args.command and args.to:
        args.command = "call"

    if args.command == "health":
        cmd_health()
    elif args.command == "call":
        config = {
            "system_prompt": args.system_prompt,
            "first_message": args.first_message,
            "error_message": args.error_message,
            "model": args.model,
        }
        cmd_call(args.to, config)
    elif args.command == "transcript":
        cmd_transcript(args.id)
    elif args.command == "calls":
        cmd_calls(args.limit)
    else:
        print("=" * 50)
        print("  📞 MoltPhone AI Call Tool")
        print("=" * 50)
        cmd_health()
        print("\nUsage:")
        print("  python call.py --to +1234567890")
        print("  python call.py call --to +1234567890")
        print("  python call.py transcript")
        print("  python call.py calls")
        print("  python call.py health")


if __name__ == "__main__":
    main()
