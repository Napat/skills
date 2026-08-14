# Handoff Pack Design

## Summary

Create `handoff-pack`, a portable Agent Skill that creates, updates, and audits an evidence-based `HANDOFF.md` at a software project's repository root. The handoff is a durable repository artifact for a developer or AI agent continuing the work without the original transcript.

The skill does not transfer accounts, conversations, permissions, or ownership. It does not commit, push, open pull requests, merge, deploy, publish, or modify external systems unless the user separately and explicitly requests that action.

## Goals

- Support Thai and English requests and produce `HANDOFF.md` in the user's language unless another language is requested.
- Ground repository claims in local Git state, project files, commands run directly, user-provided context, or authoritative read-only connected sources.
- Separate verified facts, user-reported context, assumptions, unknowns, tests not run, and conflicting evidence.
- Preserve useful human-written context when updating an existing handoff while replacing stale machine-derived state.
- Provide deterministic, standard-library-only helpers for Git state collection and handoff validation.
- Keep the canonical skill compatible with ChatGPT/Codex, Claude Code, Gemini CLI, and Google Antigravity.
- Produce a validated `skill.zip` distribution artifact without committing generated archives.

## Non-goals

- Transfer a Codex or ChatGPT task, account, session, or permission.
- Synchronize uncommitted changes between machines.
- Render `HANDOFF.md` entirely from a script; the agent must synthesize purpose, decisions, risks, and next actions from evidence.
- Require GitHub or any other connector.
- Perform network access or external writes by default.
- Replace repository-specific instructions, issue trackers, pull requests, or CI systems.

## Portability Strategy

Maintain one canonical `handoff-pack/` directory using the open Agent Skills structure. Avoid Claude-only frontmatter fields and tool-specific command syntax in the core workflow.

- Use only `name` and `description` in `SKILL.md` frontmatter.
- Keep OpenAI-specific UI metadata in optional `agents/openai.yaml`; other hosts may ignore it.
- Use Python 3 and the standard library for bundled scripts.
- Describe tool actions by intent, such as "run a local command" or "read project instructions," rather than naming a host-specific tool.
- Document installation in the repository root `README.md`:
  - ChatGPT/Codex: copy or symlink into a discovered `.agents/skills/` location, or import the packaged skill in a supported ChatGPT desktop workflow.
  - Gemini CLI and Antigravity: copy or symlink into `.agents/skills/`; mention Gemini's `.gemini/skills/` alternative.
  - Claude Code: copy or symlink into `.claude/skills/`.

## Repository Changes

```text
skills/
├── README.md                                      # Add catalog, compatibility, installation, and usage
├── handoff-pack/
│   ├── SKILL.md                                   # Workflow control plane
│   ├── agents/
│   │   └── openai.yaml                            # ChatGPT/Codex UI metadata
│   ├── scripts/
│   │   ├── collect_repo_state.py                  # Read-only Git state collector
│   │   └── validate_handoff.py                    # HANDOFF.md validator
│   └── references/
│       ├── handoff-template.md                    # Required 18-section output contract
│       ├── evidence-rules.md                      # Evidence classification and conflict rules
│       └── quality-gates.md                       # Hard failures and warnings
└── tests/
    └── test_handoff_pack.py                       # Standard-library unit and acceptance tests
```

Do not add a skill-local `README.md`, an assets directory, copied tool-specific variants, or generated examples. Keep repository-development tests outside the packaged skill directory so `skill.zip` contains only runtime files.

## Skill Metadata

Use this identity:

- Directory and frontmatter name: `handoff-pack`
- Display name: `Handoff Pack`
- Short description: `Create and validate evidence-based HANDOFF.md files`
- Default prompt: `Use $handoff-pack to prepare an evidence-based HANDOFF.md for the current project.`

Write a concise bilingual trigger description that front-loads `HANDOFF.md`, project handoff, branch continuation, handover, audit, `เตรียม handoff`, `สร้าง HANDOFF.md`, `อัปเดต HANDOFF.md`, `ตรวจสอบ handoff`, and `สรุปงานเพื่อส่งต่อ`. Keep invocation policy implicit by default.

## Skill Workflow

### 1. Select the operating mode

Choose one mode from the user's request:

- `create`: create a new repository-root `HANDOFF.md`.
- `update`: update an existing handoff while preserving still-relevant human context.
- `audit`: validate and compare an existing handoff with current evidence without editing unless the user asks for edits.
- `non-git`: create or audit from available notes and files while marking Git metadata unavailable.

### 2. Locate and instruct

Resolve the repository root with Git when possible and record the actual working directory. Locate and read applicable `AGENTS.md` files plus useful repository-level instructions such as `README`, `CONTRIBUTING`, task documents, architecture documents, package scripts, and CI configuration. Do not read secret files merely to gather context.

### 3. Collect evidence

When a local repository is available, require `scripts/collect_repo_state.py`. Supplement its JSON with relevant file inspection, explicit user context, safe validation commands, and authoritative read-only issue or pull-request data only when requested and available.

Classify each material claim internally as:

- Verified
- User-provided
- Unknown or inferred
- Stale
- Conflicting

Repository state observed directly takes precedence over stale handoff or conversation claims, but contradictions must remain visible.

### 4. Determine objective and progress

Determine the objective from explicit user instructions, authoritative issue or pull-request context, existing handoff content, task/design documents, relevant conversation context, and repository changes, in that order. Use `[NEEDS INPUT: objective]` when no reliable objective can be established.

Separate in-scope, out-of-scope, deferred, completed, partially completed, not started, and blocked work. Changed files alone never prove completion.

### 5. Validate the project safely

Discover validation commands from user instructions, applicable `AGENTS.md`, repository documentation, package/build configuration, CI configuration, then the existing handoff. Run only safe, local, non-destructive commands by default.

Record every command with its exact working directory, one of `Passed`, `Failed`, `Not run`, or `Blocked`, a concise result, the evidence source, and a reason when it was not run. Never omit failures or convert user-reported results into locally observed results.

Before writing, inspect the evidence selected for inclusion and the proposed handoff content for likely secret values. Do not open excluded secret files such as `.env` to perform this check. Redact any detected value, identify only its file or location, and warn the user without repeating it.

### 6. Create or update the handoff

Load all three references directly from `SKILL.md` at their required gates:

- Load `handoff-template.md` before creating or updating the document.
- Load `evidence-rules.md` before classifying claims or resolving conflicts.
- Load `quality-gates.md` before finalizing the result.

Write the file at the repository root by default. If no Git repository is available, write to the current project directory selected by the user or environment.

For updates, preserve still-relevant human decisions, rationale, blockers, and reported context; replace stale machine-derived Git state; mark resolved blockers; remove duplicate sections; and avoid duplicating content on repeated runs.

### 7. Validate and report

Require `scripts/validate_handoff.py` after every create or update. For audit mode, run the validator first and then compare claims with current repository state when available.

Report the output path, created/updated/audited status, branch and commit observed, evidence sources, validation commands and outcomes, important blockers, unconfirmed information, uncommitted-change warnings, secret warnings, and the safest next action. Do not report success if validation has errors.

## HANDOFF.md Contract

Use 18 numbered level-two sections under `# Project Handoff` or its localized equivalent:

1. Handoff Metadata
2. Executive Summary
3. Objective and Acceptance Criteria
4. Scope
5. Verified Current State
6. Completed Work
7. Work in Progress
8. Key Decisions and Rationale
9. Changed Files and Components
10. Validation and Test Results
11. Known Issues, Risks and Blockers
12. Dependencies and Environment Notes
13. Assumptions and User-Reported Context
14. Open Questions
15. Recommended Next Actions
16. Restart Instructions
17. Starter Prompt for the Receiving Agent
18. Final Verification Checklist

The stable numeric identifiers are the validation contract. The heading text and body may be Thai or English. The validator recognizes the required numeric sequence plus supported Thai and English heading aliases, allowing the entire artifact to follow the user's language without weakening structural validation.

Apply these section contracts:

- Metadata includes only known values from: generated-at timestamp, repository, working directory, current branch, HEAD commit, upstream, pull request, related ticket, intended recipient, and handoff purpose. Use ISO 8601 when the environment provides a reliable time.
- Executive Summary explains the objective, current state, and expected next step in approximately 3–8 sentences.
- Objective and Acceptance Criteria records the objective, acceptance criteria, and definition of done.
- Scope separates in-scope, out-of-scope, and deferred work.
- Verified Current State contains only directly verified facts, including branch/commit, working tree, implementation state, constraints, and verified pull-request or issue status.
- Completed Work cites evidence. Work in Progress separates staged, unstaged, untracked, unpushed, experimental, and generated state when present.
- Key Decisions and Rationale never invents rationale; it marks unknown rationale explicitly.
- Changed Files and Components uses `| Path or Component | Change | Status | Notes |`.
- Validation and Test Results uses `| Command | Working Directory | Status | Result |` and explains important failures below it.
- Each known issue, risk, or blocker records description, impact, evidence, mitigation/workaround, and owner only when known.
- Dependencies and Environment Notes records verified tool versions, setup commands, services, environment variable names without values, flags, and platform constraints.
- Assumptions and User-Reported Context keeps unverified claims separate from verified state.
- Open Questions lists unresolved questions that may affect implementation or acceptance.
- Recommended Next Actions is an ordered list sorted by dependency and impact. Each item includes the action, expected outcome, relevant file/component, validation command, and dependency/blocker when known. The first item is the safest actionable step.
- Restart Instructions tells the recipient to check out the branch, confirm the commit, read applicable instructions, review named files, run baseline validation, and continue with the first next action without relying on the original conversation.
- Starter Prompt is concise, copyable, and project-specific. It instructs the receiving agent to read `AGENTS.md` and `HANDOFF.md`, verify branch/commit and working tree, review test results, avoid repeating completed work, begin with Recommended Next Actions, validate before completion claims, report discrepancies, and treat the handoff as potentially stale.
- Final Verification Checklist contains the eleven checks from the source requirements: clear objective; criteria recorded or marked missing; verified branch/commit; documented uncommitted changes; separated completed/remaining work; accurate tests; visible failures/blockers; actionable next steps; separated assumptions/facts; no secret values; receiving-agent prompt present.

Use inline code or fenced code blocks for commands, paths, branches, and commit hashes. Keep large diffs out of the document.

Use `[NEEDS INPUT: ...]` as the machine-readable marker for critical unknowns in either language. Check final checklist boxes only when supported by evidence.

## Repository State Collector

Implement `collect_repo_state.py` as a read-only Python CLI:

```text
python3 scripts/collect_repo_state.py [--path PATH] [--recent-commits N] [--output FILE]
```

Default to JSON on stdout. `--output` writes the same UTF-8 JSON to the selected path. Emit a versioned object with these logical groups:

- `schema_version`, `collected_at`, `requested_path`, `working_directory`
- `git_available`, `repository_root`
- `head`: branch, detached flag, full SHA, short SHA, latest subject
- `upstream`: name, local ahead count, local behind count, determinability reason
- `remotes`: name plus sanitized fetch/push URLs
- `working_tree`: clean flag and staged, unstaged, untracked, deleted, and renamed path records
- `diff_stats`: staged and unstaged summaries without diff content
- `operation_state`: merge/rebase/cherry-pick/revert/bisect indicators
- `recent_commits`
- `submodules`: collected only when `.gitmodules` exists
- `warnings`

Set `schema_version` to `1`. Default `--recent-commits` to 10 and accept 0–100. Use subprocess argument arrays and Git plumbing/porcelain commands that work without a shell. Never fetch. Tolerate missing Git and non-Git directories as successful observations with `git_available: false`.

Use these collector exit semantics:

- `0`: valid JSON produced, including non-Git mode
- `2`: invalid CLI usage
- `3`: unexpected Git or process failure prevented valid output
- `4`: explicit output file could not be written

Sanitize remote URLs by removing user information from HTTP(S) URLs, passwords from all parsed URL forms, and query strings or fragments that may contain tokens. Never read `.env` contents, file bodies, logs, or complete diffs.

## Handoff Validator

Implement `validate_handoff.py` as a deterministic Python CLI:

```text
python3 scripts/validate_handoff.py HANDOFF.md [--json] [--strict]
```

Human-readable output is the default. JSON output includes `valid`, `errors`, `warnings`, and file metadata. Use these exit semantics:

- `0`: no errors; warnings allowed without `--strict`
- `1`: validation errors, or any warning when `--strict` is enabled
- `2`: invalid CLI usage or unreadable input

Check:

- required title and 18 numbered sections
- duplicate top-level or numbered sections
- section order
- unresolved `[NEEDS INPUT]` markers as warnings
- allowed validation statuses
- plausible branch and commit formatting when values are present
- actionable ordered items in Recommended Next Actions
- Restart Instructions, receiving-agent Starter Prompt, and Final Verification Checklist
- hidden assumptions or user-reported claims when obvious structural sections are empty
- balanced fenced code blocks and command code formatting
- a warning above 64 KiB and an error above 256 KiB
- likely credential values and credential-bearing URLs

Treat likely exposed secret values, malformed required structure, invalid test statuses, and extreme file size as errors. Treat missing optional metadata, explicit unresolved inputs, no pull request, unknown recipient, justified tests not run, and non-Git mode as warnings.

Secret checks must be conservative. Flag key/value assignments containing credential-like values, private-key blocks, known token prefixes, basic-auth URLs, and sensitive URL query keys. Do not flag a bare environment variable name such as `OPENAI_API_KEY` without an assigned value. Tests use fake, nonfunctional values only.

The validator performs deterministic structural Markdown checks without claiming to be a full CommonMark parser.

## Error Handling and Safety

- Continue in non-Git mode when Git is absent or the path is outside a repository.
- Mark unavailable metadata explicitly rather than inventing values.
- Surface collector warnings in the handoff when they affect reliability.
- Preserve a pre-existing `HANDOFF.md` until the replacement content is ready; use the host's normal safe file-edit mechanism.
- In audit mode, do not edit the file unless the user requested an update.
- Never expose secret values in output, errors, test fixtures, or handoff content.
- Never switch branches, stash, reset, delete project files, or install large dependencies automatically.
- Never imply local-only changes are present in a remote branch.
- Never perform connector writes without a separate explicit instruction.

## Testing Strategy

Use documentation TDD and script TDD:

1. Run fresh-agent baseline scenarios without `handoff-pack` and record observable omissions or unsafe assumptions.
2. Write failing standard-library tests for each collector and validator behavior.
3. Implement the minimum skill instructions and scripts that make the tests pass.
4. Forward-test the completed skill in a temporary repository with raw artifacts and a realistic handoff request.
5. Tighten instructions only for observed gaps, then rerun the relevant tests.

Cover at least:

1. Clean Git repository
2. Staged, unstaged, and untracked files
3. Detached HEAD
4. Non-Git directory
5. Missing required handoff sections
6. Unresolved `[NEEDS INPUT]`
7. Fake credential-bearing URL
8. Bare environment variable name without a value
9. Failed validation/test result
10. Existing handoff update without duplicated sections
11. Sanitized remote URLs
12. Thai and English heading variants

Run the repository validator and the system skill validator after script tests. Probe installed `codex`, `claude`, `gemini`, and `agy` CLIs read-only; perform host-native discovery tests only when the corresponding tool is already installed and usable without additional credentials or external changes. Report unavailable runtime checks separately from structural compatibility.

## Packaging and Delivery

Initialize the skill with the standard `init_skill.py` process and generate `agents/openai.yaml` through its interface arguments. Do not retain placeholder examples or unused directories.

After all checks pass:

1. Create a staging directory outside the repository.
2. Copy only `handoff-pack/` runtime files.
3. Create an archive named exactly `skill.zip` with `handoff-pack/` as its top-level directory.
4. Inspect the archive listing and extract it into another temporary directory.
5. Re-run skill validation and script smoke tests against the extracted package.
6. Return a clickable local path to `skill.zip`.

Do not commit `skill.zip`. Commit the canonical source, tests, root documentation, design, and implementation plan. Push the final verified commits to `origin/main`, as explicitly authorized by the user, only after confirming the local branch is fast-forward safe and the working tree contains no unrelated changes.

## Acceptance Criteria

- The canonical skill exists at `handoff-pack/` with only the required runtime files.
- `SKILL.md` stays below 500 lines, uses imperative instructions, and directly references all three reference files.
- Thai and English trigger requests select the intended workflow and output language.
- Both scripts use only the Python standard library and pass the required acceptance cases.
- Collector output never contains complete diffs, file contents, or unsanitized credential-bearing remotes.
- Validator distinguishes errors from warnings and implements documented exit codes.
- Create/update flows always run collection when local Git is available and validation after writing.
- Audit mode remains read-only unless editing is explicitly requested.
- No default commit, push, PR, deploy, publish, or connector write behavior exists inside the skill.
- The root documentation explains installation for ChatGPT/Codex, Claude Code, Gemini CLI, and Antigravity.
- `skill.zip` contains the canonical skill folder and passes post-extraction validation.
- Repository tests and skill validators pass before the implementation commit is pushed.
