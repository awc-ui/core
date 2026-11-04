# Native method transport

Status: shared Laboratory command validation, client correlation and result polling are implemented and tested. The FAB setter uses its existing immediate acknowledgement. Native FAB Menu lifecycle evidence is recorded separately in the [migration audit](md-fab-menu.md); a supported wire contract alone does not certify a native adapter. The Methods panel requires that adapter's declared method capability.

## Immediate FAB setter

The existing request remains `{ "command": "method", "method": "setMenuIcon", "arguments": ["close"] }` for a selected `md-fab`. A string or null is required. Null and empty string clear the temporary override; nonempty whitespace is preserved. A successful native acknowledgement means the attached controller accepted/applied the temporary state, not that animation finished. Authored icon properties and slot nodes remain intact.

## Lifecycle calls

For a selected `md-fab-menu`, the client sends:

```json
{"command":"method","target":"component","callId":"m-1","method":"whenClosed","arguments":[]}
```

The permitted methods are `show`, `close` and `whenClosed`, each with an empty argument array. `component` identifies the selected menu inside its composed preview; it never means an arbitrary DOM selector or OS target. The separate anchor is found through the native authored-ID registry. Call IDs contain 1–80 ASCII letters, digits, hyphens or underscores; the browser generates monotonically increasing IDs within one session and never reuses them.

The host accepts promptly, starts the actual public native async method outside its input queue, and returns:

```json
{"ack":true,"methodCall":{"callId":"m-1","status":"accepted"}}
```

Acceptance does not resolve the browser promise. A per-call rejection is nonfatal:

```json
{"ack":true,"methodCall":{"callId":"m-1","status":"rejected","error":{"code":"METHOD_CALLS_BUSY","message":"Wait for pending methods."}}}
```

Retain at most 32 records per session, counting pending and completed/unacknowledged calls. Do not evict a pending promise. Reject additional calls with `METHOD_CALLS_BUSY`. Repeating a retained call ID with the same request is idempotent; a different request with that ID is rejected with `METHOD_CALL_ID_MISMATCH`.

## Result queries and cleanup

The result query is immediate and must not await any lifecycle method:

```json
{"command":"method-results","callIds":["m-1"],"acknowledged":[]}
```

Each array contains at most 32 distinct call IDs; an ID cannot be in both arrays. Return exactly one correlated result per queried ID:

```json
{"ack":true,"methodResults":[{"callId":"m-1","status":"pending"}]}
```

Terminal results are `fulfilled`, or `rejected` with `{ "code": "UPPERCASE_CODE", "message": "Explanation" }`. Error codes are 1–80 uppercase letters, digits or underscores; messages are 1–512 characters. All three lifecycle methods return void. An unknown ID is explicitly rejected with `UNKNOWN_METHOD_CALL`, never left pending indefinitely.

The client starts querying after acceptance and backs off from 250ms to a maximum of 2s when no call finishes. It continues while the visual frame stream is paused. A terminal result settles only its own promise. The next query acknowledges consumed IDs, allowing the host to release those records. A final acknowledgement-only query runs after the final completion; no polling remains afterward. Result queries are idempotent; an accepted method is never automatically replayed after transport failure.

`show` completes after the source-equivalent initial closed render/paint and opening state commit. `close` completes after initiating the close operation, even while the menu is still open during the close delay. `whenClosed` completes after the active opening cycle and finite shell motion finish; reopening keeps that cycle pending until its subsequent close. Native teardown resolves its own lifecycle waiters. Replacing or closing a Laboratory session rejects its browser promises, clears timers and ignores replies from the old session.

Shared regression evidence covers acceptance versus completion, close input while `whenClosed` is pending, paused-stream polling, bounded outstanding calls, unknown/busy results, exact result correlation, final acknowledgement and stale-session cleanup. Native timing, idempotent retention and anchor lifecycle remain verification obligations of each host implementation.
