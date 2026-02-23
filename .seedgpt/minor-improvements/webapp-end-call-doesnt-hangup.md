# Enhancement: Webapp End Call Button Only Hides Progress UI, Doesn't Send Server Request

## Description
The "End Call" button (`#end-call-btn`, line 2646-2649) only stops the local timer
and switches back to the form view. It does NOT call `POST /call/end/:id` on the
backend to actually instruct Twilio to hang up. The call continues on Twilio's side.

This is a UX gap — users think they ended the call, but it keeps running and
consuming Twilio minutes until the AI or the other party hangs up naturally.

## Priority
Medium

## Affected Area
`apps/moltphone/webapp/index.html`, lines 2646-2649
