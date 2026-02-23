# Enhancement: Call History is Local-Only — Not Synced with Server

## Description
Call history is stored only in `localStorage` (key: `moltphone_calls`). The server
has a full call history via `GET /calls`, but the webapp never queries it. This
means:
- History is lost when clearing browser data
- History is not shared across devices
- Server-side updates (e.g., call completion via webhook) aren't reflected

## Priority
Low

## Affected Area
`apps/moltphone/webapp/index.html`, `getHistory()` / `renderHistory()`
