#!/usr/bin/env python3
"""Validate a Codex skill folder with only Python standard library modules."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def parse_frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---\n"):
        raise ValueError("SKILL.md must start with YAML frontmatter")
    end = text.find("\n---\n", 4)
    if end == -1:
        raise ValueError("SKILL.md frontmatter must end with ---")
    data: dict[str, str] = {}
    for line in text[4:end].splitlines():
        if not line.strip():
            continue
        if ":" not in line:
            raise ValueError(f"invalid frontmatter line: {line!r}")
        key, value = line.split(":", 1)
        data[key.strip()] = value.strip().strip('"')
    return data


def validate(skill_path: Path) -> list[str]:
    errors: list[str] = []
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        return [f"missing {skill_md}"]

    try:
        frontmatter = parse_frontmatter(skill_md.read_text(encoding="utf-8"))
    except Exception as exc:
        return [str(exc)]

    name = frontmatter.get("name", "")
    description = frontmatter.get("description", "")

    if not name:
        errors.append("frontmatter is missing name")
    elif not NAME_RE.fullmatch(name):
        errors.append(f"invalid skill name: {name!r}")

    if skill_path.name != name:
        errors.append(f"folder name {skill_path.name!r} must match skill name {name!r}")

    if not description:
        errors.append("frontmatter is missing description")
    elif len(description) < 80:
        errors.append("description should be specific enough to trigger the skill")

    agents_yaml = skill_path / "agents" / "openai.yaml"
    if not agents_yaml.exists():
        errors.append("missing agents/openai.yaml")

    for rel in [
        "references/usage-guide.md",
        "references/archetypes.md",
        "references/code-patterns.md",
        "references/kustomize-patterns.md",
        "references/version-policy.md",
        "scripts/resolve_versions.py",
    ]:
        if not (skill_path / rel).exists():
            errors.append(f"missing {rel}")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("skill_path", help="Path to a Codex skill folder")
    args = parser.parse_args()

    skill_path = Path(args.skill_path).resolve()
    errors = validate(skill_path)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print(f"OK: {skill_path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

