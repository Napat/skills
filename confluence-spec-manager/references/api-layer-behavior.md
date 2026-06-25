# API Layer Behavior

Use this reference to tailor API specs by layer. If the layer is unknown, ask the user to classify it; if they cannot, infer carefully from the endpoint name and dependencies and label the inference.

## BFF Layer

Purpose: shape client-facing behavior for web or mobile clients.

Document:

- Client channel and consumer.
- Request validation and normalization.
- Authentication/session assumptions.
- Calls to orchestration/core services.
- Client-specific response shaping.
- User-facing error mapping.
- Feature flags or app-version behavior when relevant.

Review focus:

- Does the response match client needs without leaking internal models?
- Are downstream errors mapped to stable client errors?
- Are channel-specific fields and optional fields explained?

## Orchestration Layer

Purpose: coordinate multiple downstream calls or business steps.

Document:

- Ordered downstream calls.
- Branches, fallback behavior, retries, and compensation.
- Transaction boundary and idempotency key.
- Aggregated response mapping.
- Timeout budget per dependency.

Review focus:

- Does the sequence diagram show all major branches?
- Are partial failures handled explicitly?
- Is idempotency defined for retryable requests?
- Are downstream response fields mapped into the API response?

## Core Layer

Purpose: own domain rules and persistent state.

Document:

- Domain validations.
- Database tables or domain repositories touched.
- State transitions.
- Uniqueness, locking, concurrency, and idempotency.
- Audit fields and event publication when applicable.

Review focus:

- Are business rules specific enough to implement?
- Are database writes and state transitions clear?
- Are duplicate requests, race conditions, and rollback behavior covered?

## Adaptor Layer

Purpose: wrap an external system or protocol.

Document:

- External endpoint, protocol, and environment.
- Authentication/token behavior.
- Request/response transformation.
- External error mapping.
- Retry and timeout policy.
- Sensitive data masking.

Review focus:

- Are external contracts separated from internal contracts?
- Are credentials and tokens handled safely?
- Are timeout/retry policies explicit and bounded?
- Are external error codes mapped to internal codes?

## Middleware Or Access-Control Layer

Purpose: enforce cross-cutting checks before forwarding.

Document:

- Policy checks.
- Required headers or tokens.
- Pass-through and blocked cases.
- Error behavior when validation fails.
- Downstream target when validation passes.

Review focus:

- Are allow/deny conditions deterministic?
- Are security failures distinguishable from system failures?

## Callback Or Webhook

Purpose: receive asynchronous notification from another system.

Document:

- Sender identity and authentication.
- Duplicate callback handling.
- Ordering assumptions.
- Correlation keys.
- Acknowledgement response.
- Reconciliation process for missed callbacks.

Review focus:

- Is idempotency mandatory and testable?
- Is the acknowledgement behavior explicit?
- Is replay or signature validation documented?
