# Review Checklist

Use this reference for spec reviews, cleanup, rewrites, and quality gates.

## Review Report Format

Lead with findings:

| Severity | Location | Issue | Recommendation |
| --- | --- | --- | --- |
| High | Section/table | What is wrong or missing. | Concrete fix. |

Severity:

- `High`: likely implementation ambiguity, incorrect contract, security issue, operational risk, or live-edit risk.
- `Medium`: missing useful detail, inconsistent structure, unclear failure behavior, incomplete examples.
- `Low`: formatting, naming, grammar, or minor cleanup.

Then include:

- Assumptions
- Missing inputs
- Suggested rewrite outline
- Optional cleaned draft when requested

## Universal Quality Gates

Check every spec for:

- Clear purpose and scope.
- Stable title and consistent naming.
- Change log with date, author/team, description, and status.
- Sequence or flow matches documented dependencies.
- Tables have complete headers and non-empty critical cells.
- Examples are valid for their language or payload type.
- Sensitive values are placeholders, never real secrets.
- Unknowns are marked as `TBD` and grouped in open questions.
- Deprecated or removed behavior is explicitly labeled.

## API Gates

Check:

- Method and path are consistent across title, endpoint section, and samples.
- Layer-specific behavior is documented.
- Request schema covers headers, path params, query params, and body as applicable.
- Mandatory request fields appear in sample requests.
- Response schema matches sample responses.
- Response code table includes success and meaningful failure scenarios.
- Auth, authorization, validation, idempotency, timeout, and retry behavior are clear.
- Downstream dependencies and data sources are named generically or as supplied by the user.

## Batch Gates

Check:

- Schedule has timezone.
- Trigger is explicit.
- Manual run instructions are actionable.
- Config values avoid real secrets.
- Input/output mapping is complete.
- Retry, partial success, duplicate handling, and recovery are clear.
- Monitoring and alerting are operationally useful.
- Related documents or upstream/downstream specs are linked or named.

## Rewrite Rules

When rewriting:

1. Preserve behavior and contract details.
2. Normalize headings to the relevant reference structure.
3. Convert prose lists into tables when fields, codes, config, schedules, or mappings are being described.
4. Keep original names supplied by the user unless they are clearly placeholders or typos.
5. Move unclear or conflicting details into `Assumptions and Open Questions`.
6. Do not silently delete sections; state what was removed or merged.

## Cleanup Rules

For cleanup-only tasks:

- Fix heading hierarchy.
- Normalize table headers.
- Keep samples in fenced code blocks.
- Redact secrets.
- Standardize date format to `YYYY-MM-DD`.
- Standardize statuses to `Draft`, `Ready for Review`, `Approved`, `Deprecated`, or `Removed`.
- Preserve links and macro placeholders.
