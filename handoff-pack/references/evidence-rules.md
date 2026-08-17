# Evidence Rules

| Class | Meaning | Treatment |
| --- | --- | --- |
| Verified | Observed from Git, repository files, commands run directly, or an authoritative connected source | State as current fact and identify the source |
| User-provided | Explicitly stated by the user but not independently checked | Keep under User-Reported Context or label the source |
| Unknown or inferred | Not confirmed by available evidence | Mark unknown or assumption; never convert silently to fact |
| Stale | Previously true but older than current repository or authoritative state | Replace machine-derived state and preserve the contradiction when material |
| Conflicting | Two available sources disagree | Report both, prefer direct current repository state for repository facts, and request input only when blocking |

## Tests

- Record a directly observed command with exit code 0 as `Passed` only for what it actually checks.
- Record a directly observed command with non-zero exit as `Failed` or `Blocked`; never omit it.
- Treat a user or CI result as user-provided unless an authoritative connected result was read directly.
- Give a concise reason for `Not run`.

## Repository Precedence

Prefer current directly observed repository state over stale `HANDOFF.md` or conversation claims. Report contradictions instead of silently erasing context. Never treat working-tree presence as proof of commit or push state. Mark local-only changes as unavailable to a recipient who only checks out a remote branch. Treat remote-tracking refs as local evidence that may be stale; do not claim current remote state without a separately authorized read.
