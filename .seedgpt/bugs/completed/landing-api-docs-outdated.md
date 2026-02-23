# Bug: Landing Page API Docs Use Outdated Request Schema

## Description
The landing page (`apps/moltphone/landing/index.html`) shows an API example with
the **old** request schema (`to`, `prompt`, `firstMessage`, `maxDurationMin`, `voice`)
instead of the **current** schema (`to_number`, `assistant_config.first_message`,
`assistant_config.system_prompt`, `assistant_config.voice`, `assistant_config.model`).

A user following the landing page example will receive a `400 Validation failed` error.

## Severity
**High** — developer-facing documentation is fundamentally wrong; API calls will fail.

## Affected Area
`apps/moltphone/landing/index.html`, lines 656-668

## Repro Steps
1. Visit `https://moltphone.xyz`
2. Scroll to the "API Examples → Make a phone call" section
3. Copy the curl command and execute it with a real API key
4. Observe a 400 validation error

## Expected
The API example should match the current `POST /call` schema defined in
`apps/moltphone/backend/src/routes/calls.ts` and `openapi.yml`.

## Actual
Example uses deprecated field names; calls fail.
