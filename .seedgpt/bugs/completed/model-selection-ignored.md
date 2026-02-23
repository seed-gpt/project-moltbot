# Bug: AI Model Selection Not Propagated E2E

## Description
When a user selects an AI model (e.g. "GPT-4o", "Claude Sonnet 4") in the MoltPhone webapp call form, the call always uses the hardcoded default model (`google/gemini-2.0-flash-001`) instead of the selected model.

## Reproduction Steps
1. Go to https://app.moltphone.xyz/
2. Fill out the call form
3. Select any model other than the default (e.g. "GPT-4o" or "GPT-4.1")
4. Submit the call
5. Observe: the AI always uses `google/gemini-2.0-flash-001` via OpenRouter

## Expected Behavior
The LLM session should use the model selected by the user (mapped to the correct OpenRouter model identifier).

## Actual Behavior
The model is stored in Firestore (`assistantConfig.model`) but never extracted or passed through the chain:
1. `twiml.ts` — does NOT read `assistantConfig.model` from Firestore or pass it as a ConversationRelay parameter
2. `conversation-relay.ts` — calls `createLLMSession(systemPrompt)` without a `model` argument (line 86)
3. `openai-llm.ts` — defaults to `google/gemini-2.0-flash-001` (line 24)

Additionally, the frontend sends model identifiers like `gpt-4o-mini`, `gpt-4o`, `gpt-4.1`, `gpt-5.1`, `claude-sonnet-4-20250514` but the backend uses OpenRouter, which requires different model IDs (e.g. `openai/gpt-4o-mini`, `anthropic/claude-sonnet-4`).

## Root Cause
The model field is validated and stored but never passed through the TwiML → WebSocket → LLM session chain. There is also no mapping from frontend model names to OpenRouter model IDs.

## Severity
**High** — Core feature is non-functional. All model selections are silently ignored.
