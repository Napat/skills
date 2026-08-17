# Quality Gates

Require all ten gates before reporting a handoff ready: Factual integrity; Repository-state accuracy; Test-result accuracy; Secret safety; Actionability; Recipient independence; Conciseness; Idempotent updates; No unauthorized external writes; No unsupported completion claims.

## Hard failures

- A secret value or credential-bearing URL is included.
- Branch or commit information is fabricated or contradicts directly observed state without disclosure.
- Required structure cannot be parsed or contains duplicate numbered sections.
- A failed or unrun test is reported as passed.
- Existing `HANDOFF.md` is overwritten with unrelated content or useful human context is silently discarded.
- The bundled validator reports an error.

## Warnings

- Acceptance criteria, intended recipient, PR URL, or optional metadata is unknown.
- Tests were not run and an explicit reason is recorded.
- The project is not a Git repository.
- `[NEEDS INPUT: ...]` remains visible.
- The handoff exceeds 64 KiB but not 256 KiB.

## Finalization

For create or update, run `scripts/validate_handoff.py` against the draft, fix every error, keep warnings visible, and confirm repeated updates do not duplicate sections before replacing `HANDOFF.md`. During an audit, run the validator first but do not fix or rewrite the handoff; report its errors and warnings, compare its claims with current evidence, and recommend a separately authorized update when needed. Never claim the repository is secret-free; state only which checks ran.
