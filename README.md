# Napat Skills

Personal Codex skills by Napat.

This repository is a collection of installable Codex skills. Each skill lives in its own top-level folder and can be copied into a local Codex skills directory independently.

## Skill Catalog

| Skill | Purpose | Usage Guide |
| --- | --- | --- |
| `go-service-builder` | Build or update production-oriented Go service and Kustomize project skeletons. | [usage-guide.md](go-service-builder/references/usage-guide.md) |
| `confluence-spec-manager` | Draft, review, rewrite, clean, and prepare Confluence-ready technical specs. | [usage-guide.md](confluence-spec-manager/references/usage-guide.md) |

## Repository Layout

```text
skills/
├── README.md
├── LICENSE
├── .gitignore
├── scripts/
│   └── validate_skill.py
├── <skill-name>/
│   ├── SKILL.md
│   ├── agents/
│   │   └── openai.yaml
│   ├── references/
│   │   └── usage-guide.md
│   ├── scripts/        # optional
│   └── assets/         # optional
```

## Install Skills

Create your local Codex skills directory:

```bash
mkdir -p ~/.codex/skills
```

Install one skill:

```bash
cp -R <skill-name> ~/.codex/skills/
```

Install every skill folder from this repository:

```bash
for skill in */SKILL.md; do
  cp -R "$(dirname "$skill")" ~/.codex/skills/
done
```

Restart Codex after installing or updating skills so they can be discovered.

## Use Skills

Invoke a skill by name in Codex:

```text
Use <skill-name> to ...
```

Read the relevant usage guide before using or changing a skill:

- [go-service-builder usage guide](go-service-builder/references/usage-guide.md)
- [confluence-spec-manager usage guide](confluence-spec-manager/references/usage-guide.md)

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
OK: go-service-builder
```

Some skills include additional validation commands in their usage guide.

## Skill Authoring Standards

Keep every skill self-contained and easy to install:

- Put primary agent-facing instructions in `SKILL.md`.
- Put detailed reusable guidance in `references/`.
- Put prompt examples and human onboarding in `references/usage-guide.md`.
- Put deterministic helpers in `scripts/` only when they are actually needed.
- Put UI metadata in `agents/openai.yaml`.
- Do not add `README.md` files inside skill folders; keep human repository docs in this root README.
- Keep skills portable unless a skill is intentionally private and clearly scoped that way.
- Do not commit secrets, tokens, or generated files that contain credentials.

Use progressive disclosure:

- Keep `SKILL.md` concise.
- Link reference files directly from `SKILL.md`.
- Split references by domain or workflow when a skill supports multiple modes.
- Keep skill-specific examples, prerequisites, and caveats in that skill's `references/usage-guide.md`.

## Add A New Skill

Initialize a new skill with the system skill creator:

```bash
python3 ~/.codex/skills/.system/skill-creator/scripts/init_skill.py my-skill \
  --path . \
  --resources references \
  --interface display_name="My Skill" \
  --interface short_description="Short human-facing description" \
  --interface default_prompt='Use $my-skill to ...'
```

If the system skill path differs on your machine, locate `skill-creator/scripts/init_skill.py` under your Codex skills directory.

After initialization:

1. Replace the generated `SKILL.md` TODOs.
2. Add only the reference files the skill needs.
3. Add `references/usage-guide.md`.
4. Run `python3 scripts/validate_skill.py --all`.
5. Try one realistic prompt before committing.

## Update An Existing Installation

After pulling changes:

```bash
git pull
for skill in */SKILL.md; do
  name="$(dirname "$skill")"
  rm -rf "$HOME/.codex/skills/$name"
  cp -R "$name" "$HOME/.codex/skills/"
done
```

Restart Codex after updating.

## Publish To GitHub

If this folder is not a Git repository yet:

```bash
git init
git branch -M main
git remote add origin https://github.com/Napat/skills.git
```

Commit and push:

```bash
git add .
git commit -m "Update Codex skills"
git push -u origin main
```

If the remote already exists, use:

```bash
git remote -v
git push
```
