---
name: confluence-spec-manager
description: Draft, review, rewrite, clean, and prepare Confluence-ready technical specifications. Use when Codex is asked to create or improve API specs, batch job specs, request/response schemas, sequence/flow documentation, field mappings, runbooks, or Confluence page content; when a user wants Markdown, Confluence storage XML, or a review report; or when Codex needs to read or edit Confluence pages with user-provided Atlassian credentials.
---

# Confluence Spec Manager

Use this skill to produce portable, company-neutral technical specs that can be pasted into Confluence or sent through Confluence APIs. Keep all spec prose in English unless the user explicitly asks otherwise.

Do not embed corporate URLs, service names, credentials, private system names, or copied internal page content into reusable output unless the user explicitly provides that information for the current task.

## Start Here

Classify the task:

- `draft`: create a new spec from requirements, code, OpenAPI, database schema, schedule, or user notes.
- `review`: inspect an existing spec and report missing sections, inconsistencies, unclear behavior, and formatting issues.
- `rewrite`: restructure or clean an existing spec while preserving intended behavior.
- `confluence-read`: read a Confluence page to summarize or review it.
- `confluence-edit`: prepare or apply an update to a Confluence page.

Then classify the spec type:

- `api`: HTTP API or callback endpoint.
- `batch`: scheduled, triggered, or manually-run batch job.
- `generic`: other technical Confluence page.

Ask only for missing inputs that affect correctness. For API specs, usually ask for layer, method/path, purpose, request schema, response schema, dependencies, error cases, and sample payloads. For batch specs, usually ask for schedule, trigger, manual run behavior, config, inputs/outputs, dependencies, and failure handling.

## Reference Loading

Load only the references needed for the task:

- Read [usage-guide.md](references/usage-guide.md) when the user asks how to use the skill, wants example prompts, or needs onboarding guidance.
- Read [api-spec.md](references/api-spec.md) for API spec drafting, review, rewrite, schema tables, samples, response codes, and API page structure.
- Read [api-layer-behavior.md](references/api-layer-behavior.md) when the API layer is BFF, orchestration, core, adaptor, middleware, callback, or unknown.
- Read [batch-job-spec.md](references/batch-job-spec.md) for batch job specs, schedules, triggers, manual runs, config, SQL/config examples, and field mappings.
- Read [confluence-output.md](references/confluence-output.md) when the user asks for Markdown, Confluence storage XML, ADF guidance, Confluence API read/edit, or credential instructions.
- Read [review-checklist.md](references/review-checklist.md) for review reports, quality gates, rewrite plans, and cleanup passes.

## Workflow

1. Determine task type, spec type, output format, and whether live Confluence access is requested.
2. Gather missing inputs. Do not invent contract details; mark unknowns as `TBD` only when useful and visible.
3. Draft, review, or rewrite using the relevant reference files.
4. Keep page content portable: avoid company-specific assumptions unless supplied for this task.
5. For live Confluence read/edit, follow [confluence-output.md](references/confluence-output.md). Ask for base URL, page ID or URL, email, and Atlassian API token. Never store credentials in files or generated docs.
6. For edits, produce a dry-run preview first unless the user explicitly asks to execute and all credentials are present.
7. Return the requested format plus a short list of unresolved assumptions or missing inputs.

## Output Modes

- `markdown`: Confluence-friendly Markdown with clear headings and tables.
- `confluence-storage`: Confluence storage XHTML/XML fragments suitable for REST API update workflows.
- `review-report`: findings ordered by severity, followed by recommended changes.
- `rewrite-plan`: section-by-section cleanup plan before rewriting large pages.

When no output mode is specified, use Markdown for drafts and rewrites, and `review-report` for reviews.

## Safety Rules

- Never print, save, commit, or include Atlassian API tokens in generated artifacts.
- Treat credentials pasted by users as sensitive even when they appear in the chat.
- Do not update live Confluence pages without an explicit user request for execution.
- Prefer read-only inspection before editing existing pages.
- Preserve intended API behavior and batch behavior when cleaning formatting.
