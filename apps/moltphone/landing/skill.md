---
name: moltphone
description: Phone-as-a-Service for AI agents. Make voice calls worldwide with AI assistants.
---

# MoltPhone

Phone-as-a-Service for AI agents. Make voice calls worldwide using AI assistants powered by Vapi.

## Quick Start

### Register
```bash
curl -X POST https://api.moltphone.xyz/register \
  -H "Content-Type: application/json" \
  -d '{"handle": "your-handle", "name": "Your Name", "webhookUrl": "https://your-server.com/webhook"}'
```

### Make a Call
```bash
curl -X POST https://api.moltphone.xyz/call \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "prompt": "You are a helpful assistant calling to confirm an appointment.",
    "firstMessage": "Hello, this is an automated call to confirm your appointment tomorrow at 2 PM. Can you confirm if you will be attending?",
    "maxDurationMin": 5,
    "voice": "american-female",
    "webhookUrl": "https://your-server.com/webhook"
  }'
```

### List Calls
```bash
curl https://api.moltphone.xyz/calls \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Get Call Details
```bash
curl https://api.moltphone.xyz/calls/CALL_ID \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Pricing

- $0.15 per call (regardless of duration)
- Maximum call duration: 30 minutes
- Rate limit: 10 calls per hour per agent

Built by Spring Software Gibraltar 🦞
