---
name: handoff-pack
description: Use when creating, updating, or auditing a software-project HANDOFF.md; preparing a branch, repository, task, or Codex handoff for another developer or agent; or when requests say Prepare a handoff, Audit the existing handoff, เตรียม handoff, สร้าง HANDOFF.md, อัปเดต HANDOFF.md, ตรวจสอบ handoff, สรุปงานเพื่อส่งต่อ, or เตรียมงานให้คนหรือ agent อื่นทำต่อ.
---

# Handoff Pack

For every project handoff, create a durable, evidence-based `HANDOFF.md` that lets a recipient continue safely without the original transcript. Never represent this workflow as an account, permission, ownership, conversation, or Codex-task transfer.

## Operating Mode

Classify the operation as `create`, `update`, or `audit`. Treat Git availability as an independent environment condition, not as another operation. Write the handoff in the user's language unless the user selects another language.

## Required Resources

- Read [handoff-template.md](references/handoff-template.md) before creating or updating.
- Read [evidence-rules.md](references/evidence-rules.md) before classifying facts or resolving contradictions.
- Read [quality-gates.md](references/quality-gates.md) before finalizing or reporting audit results.
- Run `scripts/collect_repo_state.py` for available local project state.
- Run `scripts/validate_handoff.py` after every create or update; run it first for an audit.

## Evidence Workflow

1. Select the project working directory. Use the repository root when Git identifies one. For non-Git create or update, write `HANDOFF.md` in the selected project working directory and mark Git fields as `Not available`.
2. Read applicable `AGENTS.md`, repository instructions, and relevant project files without opening secret files merely for context.
3. Collect local state with the bundled collector. Supplement it with user context, safe local validation, and authorized authoritative read-only context.
4. Use existing local refs and disclose that local refs may be stale. Do not infer remote freshness from local tracking refs.
5. Determine the objective from explicit instructions, authorized authoritative issue or PR context, an existing handoff, task or design documents, conversation context, then repository changes. Use `[NEEDS INPUT: objective]` rather than inventing it.
6. Separate completed, partial, not started, deferred, and blocked work. Never treat changed files alone as proof of completion.
7. Discover validation commands from user instructions, `AGENTS.md`, repository docs, build or package configuration, CI, then the existing handoff. Run only safe local commands that need no new dependency installation.
8. Inspect proposed content for likely secret values without opening excluded secret files. Redact values and report only safe locations.

## Create

Copy only the marked region from `references/handoff-template.md`, resolve every field supported by evidence, and leave unresolved facts as explicit `[NEEDS INPUT: ...]` markers. Validate the completed draft before writing or replacing repository content.

## Safe Update

1. Read the existing `HANDOFF.md` before drafting an update, and keep the original file intact while preparing a merged draft.
2. Preserve human decisions, user-provided context, and unresolved blockers. Refresh stale machine-derived repository state; mark a blocker resolved only with evidence.
3. Explain materially removed or condensed notes in the updated handoff instead of silently discarding context.
4. Preserve the stable 18-section order, merge content into existing sections, and avoid duplicate sections so repeated updates are idempotent.
5. Run the bundled validator against the separate draft, fix every error, and validate the draft before replacing the original.

## Audit

1. Run `scripts/validate_handoff.py` against the existing `HANDOFF.md` first.
2. Collect current local evidence without changing the project.
3. Compare every material handoff claim with current evidence and identify invalid structure, stale facts, contradictions, missing evidence, warnings, and recipient risks.
4. Work in report only mode and recommend a separate update when changes are needed.

Never create, update, fix, or write a file during an audit unless the user separately requests an update.

## Evidence and Test Rules

Record directly observed commands separately from user-reported results. Use only `Passed`, `Failed`, `Not run`, or `Blocked`. Never omit a failure, claim a test passed without execution or authoritative evidence, claim a file is committed from working-tree presence, or confuse the current branch with a destination branch.

## Network and External Context

Do not automatically run `git fetch`, `git pull`, access the network, or install dependencies. Use network access or read-only connector context only when it is necessary for the requested handoff and separately authorized. Never comment, assign, edit, merge, or make another external write unless separately authorized.

## Safety Boundaries

Do not automatically commit, amend, push, force-push, open a PR, merge, deploy, publish, create tickets, assign people, switch branches, stash, reset, delete project files, run shared migrations, expose secrets, or claim to transfer an account or conversation. Ask only when missing information blocks a useful handoff; mark non-blocking gaps explicitly.
