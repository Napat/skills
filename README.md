# Napat Agent Skills

Personal, portable Agent Skills by Napat.

This repository contains self-contained skills that follow the open Agent Skills folder convention. Keep one canonical skill folder and install it into a discovery path supported by Codex CLI/IDE, Claude Code, Gemini CLI, or Antigravity. ChatGPT desktop can use a local or imported skill through its Skills UI; ChatGPT web and mobile use skills bundled in plugins rather than a raw local folder. Do not maintain tool-specific forks of the core workflow.

## Skill Catalog

| Skill | Purpose | Documentation |
| --- | --- | --- |
| `go-service-builder` | Build or update production-oriented Go service and Kustomize project skeletons. | [Usage guide](go-service-builder/references/usage-guide.md) |
| `confluence-spec-manager` | Draft, review, rewrite, clean, and prepare Confluence-ready technical specs. | [Usage guide](confluence-spec-manager/references/usage-guide.md) |
| `handoff-pack` | Create, update, or audit evidence-based project `HANDOFF.md` files in English or Thai. | [Skill instructions](handoff-pack/SKILL.md) |
| `explainer-html` | Compile technical explanations into offline HTML, narrated walkthroughs and resumable MP4 exports. | [Skill instructions](explainer-html/SKILL.md) |

## Supported Hosts

| Host | User scope | Project scope |
| --- | --- | --- |
| ChatGPT desktop | Skills sidebar or an imported skill package | Desktop project context or imported skill |
| Codex CLI/IDE | `~/.agents/skills/handoff-pack` | `<repo>/.agents/skills/handoff-pack` |
| Claude Code | `~/.claude/skills/handoff-pack` | `<repo>/.claude/skills/handoff-pack` |
| Gemini CLI | `~/.agents/skills/handoff-pack` or `~/.gemini/skills/handoff-pack` | `<repo>/.agents/skills/handoff-pack` or `<repo>/.gemini/skills/handoff-pack` |
| Antigravity 2.0 | `~/.gemini/config/skills/handoff-pack` | `<repo>/.agents/skills/handoff-pack` |
| Antigravity CLI (agy) | `~/.gemini/antigravity-cli/skills/handoff-pack` | `<repo>/.agents/skills/handoff-pack` or the CLI workspace skills location |

Keep one canonical folder; copy or symlink it into the host's discovered path. `agents/openai.yaml` is optional ChatGPT desktop/Codex metadata and does not fork the skill workflow.

## Repository Layout

```text
skills/
├── README.md
├── LICENSE
├── .gitignore
├── scripts/
│   └── validate_skill.py
└── <skill-name>/
    ├── SKILL.md
    ├── agents/
    │   └── openai.yaml  # optional host metadata
    ├── references/
    │   └── *.md         # optional detailed guidance
    ├── scripts/         # optional deterministic helpers
    └── assets/          # optional output resources
```

## Install Skills

Choose the user-scope or project-scope discovery path for the target host. For example, install `handoff-pack` into the portable user path used by Codex CLI/IDE and Gemini CLI:

```bash
mkdir -p ~/.agents/skills
cp -R handoff-pack ~/.agents/skills/
```

Install every top-level skill into that user path:

```bash
skills_target="$HOME/.agents/skills"
mkdir -p "$skills_target"
for skill_file in */SKILL.md; do
  skill_dir="${skill_file%/SKILL.md}"
  cp -R "$skill_dir" "$skills_target/"
done
```

For ChatGPT desktop, import the canonical folder or packaged skill through the Skills sidebar. ChatGPT web and mobile require a plugin-bundled skill. For project-scoped filesystem discovery, copy the canonical folder below the appropriate directory in that project, such as `<repo>/.agents/skills/`, `<repo>/.claude/skills/`, `<repo>/.gemini/skills/`, or the Antigravity project skills location. Reload or restart the host after installing or updating skills when required for discovery.

## Use Skills

Use host-specific explicit invocation syntax:

- ChatGPT: `@handoff-pack`
- Codex: `$handoff-pack`
- Claude Code: `/handoff-pack`
- Gemini CLI and Antigravity: ask for `handoff-pack` by name or use the host's skills list/reload command.

```text
Use $<skill-name> to ...
```

Read the linked skill instructions or references before changing a skill:

- [Go service builder usage guide](go-service-builder/references/usage-guide.md)
- [Confluence spec manager usage guide](confluence-spec-manager/references/usage-guide.md)
- [Handoff Pack instructions](handoff-pack/SKILL.md)
- [Explainer HTML instructions](explainer-html/SKILL.md)

## Explainer HTML

The same `explainer-html/` package serves Codex, Claude Code, Gemini CLI and Antigravity. Use `$explainer-html` in Codex, `/explainer-html` in Claude Code or agy, or ask Gemini CLI to use `explainer-html`. Normal HTML generation requires Node.js 22+ and a shell, with no npm installation; parsers and Archify 3.0.1 are included with licenses and pinned hashes.

Install the complete folder at `~/.agents/skills/explainer-html/` for Codex and Gemini CLI, `~/.claude/skills/explainer-html/` for Claude Code, or `~/.gemini/antigravity-cli/skills/explainer-html/` for agy. Antigravity desktop/IDE uses `~/.gemini/config/skills/explainer-html/`. Include the bundled CLI, source, assets, references and vendor files; omit development-only `node_modules`, test outputs and caches. Run the installed `scripts/verify.mjs`, then a sample render. See [host compatibility](explainer-html/references/hosts.md) for current official sources and native skill discovery on current stable clients.

Examples:

- `Use $explainer-html to explain this API and queue architecture as offline HTML.`
- `อธิบาย cache miss ให้ junior ด้วย HTML ภาษาไทย พร้อมภาพและคำบรรยายเสียง`
- `Export this walkthrough to MP4, and keep the HTML available while it renders.`

Run the bundled compiler directly:

```bash
node explainer-html/scripts/render.mjs render explainer-html/examples/architecture.md --json
node explainer-html/scripts/render.mjs render explainer-html/examples/sequence.md --json
node explainer-html/scripts/render.mjs render explainer-html/examples/thai-video.md --voice system --json
```

Outputs are temporary by default. `--save /absolute/path/page.html` keeps a requested copy. HTML embeds its source, styles, SVG, player and rendered audio, with no CDN or network needed to open it. Blueprint and shadcn both support light/dark/auto. Large diagrams have readable zoom, pan and a Fit overview.

Mac narration uses installed Kanya/Samantha voices. Optional ElevenLabs and OpenAI-compatible endpoints use environment-only credentials. See [syntax](explainer-html/references/syntax.md), [video](explainer-html/references/video.md) and [export/recovery](explainer-html/references/export.md).

MP4 needs Chrome/Chromium and ffmpeg, runs in a separate worker, and returns a job ID. Commands `status`, `cancel` and `resume` manage the job. Resume checks the immutable HTML snapshot and frame hashes before reusing completed frames. Temporary checkpoints can expire; explicitly saved outputs are outside cache cleanup.

Maintainers can reproduce checks with `npm ci`, `npm run build`, `npm run check:bundle`, `node scripts/verify.mjs` and `npm test` inside `explainer-html/`. [Maintenance guidance](explainer-html/references/maintenance.md) describes browser/media acceptance. [Development checkpoint](docs/explainer-html-progress.md) records verified work and how to continue after an interruption.

## Handoff Pack Examples

- `Use $handoff-pack to prepare this branch for another developer.`
- `Prepare a handoff and create HANDOFF.md.`
- `เตรียม handoff ของ branch นี้ให้เพื่อนทำต่อ`
- `อัปเดต HANDOFF.md หลังแก้ CI`
- `Audit the existing handoff without editing it.`
- `ตรวจสอบ handoff นี้แบบ read-only`

### Concrete Workflows

- **Normal Git handoff:** `เตรียม handoff ของ branch นี้ให้เพื่อนทำต่อ` — inspect Git and instructions, run safe validation, create and validate `HANDOFF.md`, report local changes, and do not commit or push.
- **CI fix:** `อัปเดต HANDOFF.md หลังจากผมแก้ CI แล้ว` — preserve decisions, refresh repository evidence, and keep local test results separate from authoritative or unverified CI results.
- **Repository unavailable:** `ช่วยสร้าง HANDOFF.md จากโน้ตนี้ แต่ตอนนี้เข้าถึง repo ไม่ได้` — mark Git fields unavailable, keep claims under User-Reported Context, and provide recipient verification steps.
- **Read-only audit:** `ตรวจ HANDOFF.md นี้ว่าพร้อมส่งต่อหรือยัง` — validate and compare current evidence without editing unless requested.
- **Dirty working tree:** `ทำ handoff ให้ agent อื่นรับช่วง แต่ยังมีไฟล์ที่ไม่ได้ commit` — separate staged, unstaged, and untracked work and warn that checkout alone cannot transfer local-only changes.

## Validate Skills

Validate every top-level skill:

```bash
python3 scripts/validate_skill.py --all
```

Validate one skill:

```bash
python3 scripts/validate_skill.py <skill-name>
```

Expected output:

```text
OK: confluence-spec-manager
OK: explainer-html
OK: go-service-builder
OK: handoff-pack
```

Some skills include additional validation commands in their instructions or references.

## Skill Authoring Standards

Keep every skill self-contained and easy to install:

- Put primary agent-facing instructions in `SKILL.md`.
- Put detailed reusable guidance in `references/` only when needed.
- Put deterministic helpers in `scripts/` only when they add repeatable value.
- Put output resources in `assets/` only when the skill needs them.
- Put optional host metadata in `agents/`; do not let it fork the portable core workflow.
- Do not add `README.md` files inside skill folders; keep human repository documentation in this root README.
- Do not commit secrets, tokens, or generated files that contain credentials.

Use progressive disclosure:

- Keep `SKILL.md` concise and link each required reference directly.
- Split longer references by domain or workflow.
- Add a table of contents to reference files longer than 100 lines.
- Keep product-specific configuration optional unless the skill intentionally requires that product.

## Add a New Skill

When Codex's system `skill-creator` is available, initialize a portable skill with:

```bash
python3 ~/.codex/skills/.system/skill-creator/scripts/init_skill.py my-skill \
  --path . \
  --resources references \
  --interface display_name="My Skill" \
  --interface short_description="Short human-facing description" \
  --interface default_prompt='Use $my-skill to ...'
```

If the system skill path differs, locate `skill-creator/scripts/init_skill.py` in the Codex installation. Then:

1. Replace every generated placeholder in `SKILL.md`.
2. Keep only runtime files the skill actually needs.
3. Run `python3 scripts/validate_skill.py --all`.
4. Forward-test at least one realistic prompt before committing.

## Update an Existing Installation

After pulling repository changes, copy the canonical folders into the same host discovery path used for installation, or use symlinks so a checkout update is reflected automatically. Preserve any local customizations before replacing an installed copy, then reload the host when required.

## Publish to GitHub

If this folder is not a Git repository yet:

```bash
git init
git branch -M main
git remote add origin https://github.com/Napat/skills.git
```

Commit and push:

```bash
git add .
git commit -m "Update Agent Skills"
git push -u origin main
```

If the remote already exists, use:

```bash
git remote -v
git push
```
