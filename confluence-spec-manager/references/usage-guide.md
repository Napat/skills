# Usage Guide

Use `confluence-spec-manager` when drafting, reviewing, rewriting, cleaning, or publishing technical specs intended for Confluence. The skill is intentionally portable: provide your organization-specific names, URLs, table names, service names, and credentials only for the current task.

## Capabilities

Use the skill to:

- Draft API specs, callback specs, and batch job specs.
- Review existing specs for missing sections, inconsistent contracts, unclear operational behavior, and formatting issues.
- Rewrite or clean specs while preserving intended behavior.
- Produce Markdown for manual Confluence paste.
- Produce Confluence storage XML fragments for REST API update workflows.
- Read or edit live Confluence pages when the user provides credentials for the current task.

The skill keeps reusable instructions company-neutral. Supply private URLs, service names, table names, and page content only when they are needed for the current task.

## Quick Prompts

Draft an API spec:

```text
Use confluence-spec-manager to draft a Markdown API spec for POST /orders.
Layer is orchestration. It validates the cart, calls payment-service, writes order status, and returns code/message/data.
Include request/response schema tables, sample JSON, response code table, and a PlantUML sequence diagram.
```

Review an API spec:

```text
Use confluence-spec-manager to review this API spec for missing sections, inconsistent schemas, response-code gaps, and layer-specific behavior issues.
Return a review-report with severity, location, issue, and recommendation.
```

Rewrite and clean an existing spec:

```text
Use confluence-spec-manager to clean this Confluence API page.
Keep the contract behavior unchanged, normalize headings and tables, redact secrets, and return Markdown ready to paste into Confluence.
```

Draft a batch job spec:

```text
Use confluence-spec-manager to draft a batch job spec for batch-daily-settlement.
It runs every day at 17:01 Asia/Bangkok, reads settlement records from a database, writes a report to SFTP, and can be manually rerun by business_date.
Include schedule, trigger, manual run, config, field mapping, retry, monitoring, and PlantUML flow.
```

Prepare Confluence storage XML:

```text
Use confluence-spec-manager to convert this Markdown spec into Confluence storage XML.
Keep code blocks as Confluence code macros and leave PlantUML as a clearly marked macro placeholder.
```

Read or edit a live Confluence page:

```text
Use confluence-spec-manager to review this Confluence page and suggest a cleaned rewrite.
Base URL is https://example.atlassian.net/wiki and page URL is <page-url>.
Ask me for the email and API token before accessing Confluence.
```

## Information To Provide

For all specs:

- Desired task: `draft`, `review`, `rewrite`, `clean`, `confluence-read`, or `confluence-edit`.
- Output format: `markdown`, `confluence-storage`, `review-report`, or `rewrite-plan`.
- Target audience: developers, QA, operations, partner integrators, or mixed audience.
- Any organization-specific naming or formatting rules to apply for this task.

For API specs:

- API layer: BFF, orchestration, core, adaptor, middleware, callback, or unknown.
- Method and path.
- Purpose and consumers.
- Authentication and authorization behavior.
- Request headers, path parameters, query parameters, and body schema.
- Response schema and response codes.
- Downstream services, database tables, queues, files, or external systems.
- Idempotency, retry, timeout, and error behavior.
- Sample request and response payloads if available.

For batch job specs:

- Job name and purpose.
- Runtime: CronJob, scheduler, pipeline, worker, script, or external scheduler.
- Schedule, timezone, and missed-run behavior.
- Trigger types: schedule, manual, event, file, topic, or API.
- Manual run command/API/pipeline, parameters, and permissions.
- Inputs, outputs, and dependencies.
- Config keys with safe placeholder examples.
- Field mapping, retry, partial success, monitoring, and recovery behavior.

For live Confluence access:

- Confluence base URL, such as `https://example.atlassian.net/wiki`.
- Page ID or page URL.
- Atlassian account email.
- Atlassian API token.
- Whether the task is read-only, preview update, or execute update.

## Output Modes

- `markdown`: Confluence-friendly Markdown with headings, tables, and fenced code blocks.
- `confluence-storage`: Confluence storage XHTML/XML fragments for REST API page updates.
- `review-report`: Findings ordered by severity with recommended fixes.
- `rewrite-plan`: Section-by-section cleanup plan before rewriting a large page.

When no output mode is specified, the skill defaults to Markdown for drafts and rewrites, and `review-report` for reviews.

## Getting An Atlassian API Token

Only provide a token when live Confluence read or edit is needed.

1. Open `https://id.atlassian.com/manage-profile/security/api-tokens`.
2. Select `Create API token`.
3. Use a clear label such as `codex-confluence-spec-edit`.
4. Copy the token once and provide it only for the current task.
5. Revoke or rotate the token after the task if it was pasted into chat or terminal.

Never place the token in a spec, README, source file, commit, or generated output.

## Live Confluence Safety

- Ask for credentials only when live Confluence read or edit is requested.
- Prefer read-only inspection before edits.
- For edits, prepare a dry-run preview before execution unless the user explicitly asks to execute.
- Do not execute writes if page ID, current version, title, target body, or credentials are ambiguous.
- After an executed update, re-read page metadata to verify the version changed.

## Validation

Run the repository validator:

```bash
python3 scripts/validate_skill.py confluence-spec-manager
```

Expected output:

```text
OK: confluence-spec-manager
```

## Typical Outputs

Markdown draft:

```text
# Create Order - POST /orders

## Overview
...
```

Review report:

```text
| Severity | Location | Issue | Recommendation |
| --- | --- | --- | --- |
| High | Response Schema | Sample response contains fields not listed in schema. | Add missing schema rows or correct the sample. |
```

Confluence storage XML:

```xml
<h1>Change Log</h1>
<table>
  <tbody>
    <tr><th>Date</th><th>Updated By</th><th>Description</th><th>Status</th></tr>
  </tbody>
</table>
```

## Follow-Up Prompts

Useful follow-up requests:

```text
Convert this API spec into Confluence storage XML and preserve all code blocks.
```

```text
Review only the request/response schema consistency and sample JSON validity.
```

```text
Create a rewrite-plan first, then wait before rewriting the full page.
```

```text
Add a manual-run section with required parameters and a dry-run example.
```

```text
Prepare a dry-run preview for updating the Confluence page, but do not execute the update.
```
