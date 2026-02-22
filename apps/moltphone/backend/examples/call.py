#!/usr/bin/env python3
"""
MoltPhone AI Call Script — standalone tool for placing and tuning AI calls.

Usage:
  python call.py                           # Interactive mode
  python call.py --to +1234567890          # Quick call with defaults
  python call.py --to +1234567890 --task "Schedule a meeting for tomorrow at 3pm"
"""

import argparse
import json
import requests
import sys

# ─── Configuration ───────────────────────────────────────────────
API_BASE = "https://api.moltphone.xyz"

# Default prompt settings — EDIT THESE to fine-tune the AI
DEFAULTS = {
    "first_message": "Hello, this is an AI assistant calling from MoltPhone. How can I help you today?",
    "system_prompt": (
        "You are a professional AI phone assistant from MoltPhone. "
        "Be polite, concise, and professional. "
        "If the person asks questions, answer helpfully. "
        "When the task is complete, thank them and say goodbye."
    ),
    "voice": "alice",
    "model": "gpt-4o-mini",
}


def call_webapp(phone: str, task: str, agent_name: str = "AI Assistant") -> dict:
    """Place a call using the webapp endpoint (no auth required)."""
    url = f"{API_BASE}/call/webapp"
    payload = {
        "phoneNumber": phone,
        "task": task,
        "agentName": agent_name,
    }
    print(f"\n📞 Calling {phone}...")
    print(f"   Task: {task}")
    print(f"   Agent: {agent_name}")
    print(f"   Endpoint: {url}\n")

    resp = requests.post(url, json=payload, timeout=30)
    data = resp.json()

    if resp.ok:
        print(f"✅ Call initiated!")
        print(f"   Call ID:    {data.get('callId', 'N/A')}")
        print(f"   Twilio SID: {data.get('twilioCallSid', 'N/A')}")
        print(f"   Status:     {data.get('status', 'N/A')}")
        print(f"   Mode:       {data.get('mode', 'N/A')}")
    else:
        print(f"❌ Error ({resp.status_code}): {json.dumps(data, indent=2)}")

    return data


def call_api(phone: str, config: dict, api_key: str) -> dict:
    """Place a call using the authenticated API endpoint."""
    url = f"{API_BASE}/call"
    payload = {
        "to_number": phone,
        "assistant_config": config,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    print(f"\n📞 Calling {phone} (API mode)...")
    print(f"   System prompt: {config['system_prompt'][:80]}...")
    print(f"   First message: {config['first_message'][:80]}...")
    print(f"   Model: {config.get('model', 'gpt-4o-mini')}")
    print(f"   Endpoint: {url}\n")

    resp = requests.post(url, json=payload, headers=headers, timeout=30)
    data = resp.json()

    if resp.ok:
        call = data.get("call", data)
        print(f"✅ Call initiated!")
        print(f"   Call ID:    {call.get('id', 'N/A')}")
        print(f"   Twilio SID: {call.get('twilioCallSid', 'N/A')}")
        print(f"   Status:     {call.get('status', 'N/A')}")
        print(f"   Mode:       {call.get('mode', 'N/A')}")
        print(f"   Balance:    {data.get('remaining_balance', 'N/A')}")
    else:
        print(f"❌ Error ({resp.status_code}): {json.dumps(data, indent=2)}")

    return data


def health_check():
    """Check if the API is reachable."""
    try:
        resp = requests.get(f"{API_BASE}/health", timeout=10)
        data = resp.json()
        print(f"🏥 Health: {data.get('status', 'unknown')} | Service: {data.get('service', 'unknown')}")
        return resp.ok
    except Exception as e:
        print(f"❌ API unreachable: {e}")
        return False


def interactive_mode():
    """Interactive prompt for placing calls."""
    print("=" * 60)
    print("  📞 MoltPhone AI Call Tool")
    print("=" * 60)

    if not health_check():
        print("\n⚠️  API is not reachable. Check your connection.")
        sys.exit(1)

    print("\n[1] Webapp call  (simple — phone + task, no auth)")
    print("[2] API call     (full control — custom prompt, needs API key)")
    print("[3] Health check")
    print("[q] Quit\n")

    choice = input("Choose mode: ").strip()

    if choice == "1":
        phone = input("\nPhone number (E.164, e.g. +1234567890): ").strip()
        task = input("Task description: ").strip()
        agent_name = input("Agent name [AI Assistant]: ").strip() or "AI Assistant"
        call_webapp(phone, task, agent_name)

    elif choice == "2":
        api_key = input("\nAPI key: ").strip()
        phone = input("Phone number (E.164): ").strip()

        print(f"\nCurrent defaults:")
        print(f"  System prompt: {DEFAULTS['system_prompt'][:80]}...")
        print(f"  First message: {DEFAULTS['first_message'][:80]}...")
        print(f"  Model: {DEFAULTS['model']}")
        print(f"  Voice: {DEFAULTS['voice']}")

        custom = input("\nCustomize prompt? [y/N]: ").strip().lower()
        config = dict(DEFAULTS)

        if custom == "y":
            sp = input(f"\nSystem prompt [{DEFAULTS['system_prompt'][:50]}...]: ").strip()
            if sp:
                config["system_prompt"] = sp

            fm = input(f"First message [{DEFAULTS['first_message'][:50]}...]: ").strip()
            if fm:
                config["first_message"] = fm

            model = input(f"Model [{DEFAULTS['model']}]: ").strip()
            if model:
                config["model"] = model

        call_api(phone, config, api_key)

    elif choice == "3":
        health_check()

    elif choice == "q":
        print("Bye! 👋")
    else:
        print("Invalid choice.")


def main():
    parser = argparse.ArgumentParser(description="MoltPhone AI Call Tool")
    parser.add_argument("--to", help="Phone number to call (E.164 format)")
    parser.add_argument("--task", help="Task description for the AI agent")
    parser.add_argument("--agent", default="AI Assistant", help="Agent name")
    parser.add_argument("--api-key", help="API key (uses authenticated endpoint)")
    parser.add_argument("--system-prompt", help="Custom system prompt")
    parser.add_argument("--first-message", help="Custom first message")
    parser.add_argument("--model", default="gpt-4o-mini", help="OpenAI model")
    parser.add_argument("--health", action="store_true", help="Health check only")
    args = parser.parse_args()

    if args.health:
        health_check()
        return

    if not args.to:
        interactive_mode()
        return

    if args.api_key:
        config = {
            "system_prompt": args.system_prompt or DEFAULTS["system_prompt"],
            "first_message": args.first_message or DEFAULTS["first_message"],
            "model": args.model,
            "voice": "alice",
        }
        call_api(args.to, config, args.api_key)
    else:
        task = args.task or "I am calling to have a brief conversation."
        call_webapp(args.to, task, args.agent)


if __name__ == "__main__":
    main()
