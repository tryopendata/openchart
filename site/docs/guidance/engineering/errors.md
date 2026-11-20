# Error handling

Every failure must reach a caller that can act on it. Follow the project's error contract. Handle a failure where recovery is possible, or pass it on with useful context. Never turn a failed operation into an apparent success.

## Keep failures distinguishable

Represent expected failures, such as invalid input or a missing item, with typed errors or the project's Result pattern. Give callers stable codes or variants and the fields they need to recover. Don't make callers parse message text, and don't return a bare false or null that loses the reason.

Catch only the failure types you can handle. Let unexpected bugs propagate to the outer handling boundary. Check returned errors, await promise rejections, and observe failures from spawned tasks or threads. Preserve cancellation and shutdown signals instead of treating them as ordinary recoverable failures.

When translating a lower-level failure, add the operation and safe context, preserving the original error as the cause. Keep its stack and cause chain available for diagnosis. Don't replace it with a generic "operation failed" error or repeat the entire cause in every wrapper's message.

## Choose recovery deliberately

- Fail immediately when a required dependency is unavailable or configuration is invalid. Don't start serving with a broken required component.
- Retry transient failures only when repeating the operation is safe. Bound attempts and elapsed time, use backoff, and respect a dependency's retry delay. Validation errors and programming bugs don't become correct through retries.
- Use a fallback only for an explicitly optional feature whose contract permits it. Report the degraded state through the appropriate result, log or status. A catch that returns empty data or defaults without a trace hides the failure.
- Release resources on every exit path using the language's scoped cleanup mechanism. A cleanup failure must not erase the primary failure; retain both when they affect recovery.

## Report at the handling boundary

Log once where the failure is handled or turned into a response, exit status or task result. Lower layers return or wrap it without also logging it. Libraries pass errors to callers and let them choose the reporting policy.

Record the operation, safe identifiers and the full cause chain in structured diagnostics. Use the project's severity policy: expected rejection is different from an unexpected fault. Ongoing outages may need an alert; don't introduce a circuit breaker without an actual dependency failure policy.

A message says what failed, why and what to do next when a remedy is known. Include expected versus actual constraints and valid choices where useful. For example: "Upload is 14 MB; the limit is 10 MB. Compress the file or split it." Don't invent a remedy when the cause is unknown; provide a diagnostic identifier if the system has one.

Keep user-facing text short and free of implementation details. Put stacks and payload details in protected diagnostics. Exclude secrets and personal data from both messages and logs; truncate or redact input values. Display a failure once in the place where the user can act on it.

Deeper: the `ce:handling-errors` skill, when installed.
