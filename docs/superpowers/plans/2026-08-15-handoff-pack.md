# Handoff Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, validate, package, commit, and publish a portable `handoff-pack` Agent Skill that creates, updates, and audits evidence-based project `HANDOFF.md` files.

**Architecture:** Keep one open-standard skill directory with a concise `SKILL.md`, three directly linked references, OpenAI-only UI metadata, and two standard-library Python CLIs. The agent synthesizes handoff content; the collector supplies sanitized repository evidence and the validator enforces the durable document contract. Repository-level `unittest` coverage exercises the scripts and static skill contract, while fresh-agent scenarios test behavior.

**Tech Stack:** Markdown, YAML, Python 3 standard library, Git CLI, `unittest`, Agent Skills open format

## Global Constraints

- Use only `name` and `description` in `handoff-pack/SKILL.md` frontmatter.
- Keep `SKILL.md` below 500 lines and use imperative instructions.
- Support Thai and English triggers; write `HANDOFF.md` in the user's language unless another language is requested.
- Use only the Python standard library in bundled scripts and repository tests.
- Keep bundled scripts usable on macOS, Linux, and Windows where Git and Python 3 are available; do not require a POSIX shell at runtime.
- Never fetch from inside `collect_repo_state.py`; local ahead/behind information comes from existing refs only.
- Never read `.env` contents, file bodies, complete diffs, secret values, or credential-bearing remote URLs.
- Treat non-Git mode as a valid observation, not a failure.
- Use stable section numbers `1` through `18` as the localized `HANDOFF.md` structure contract.
- Keep audit mode read-only unless the user explicitly requests an update.
- Do not make commit, push, PR, merge, deploy, publish, connector-write, branch-switch, stash, reset, or delete behavior part of the skill.
- Keep repository-development tests outside `handoff-pack/`; package only runtime skill files.
- Generate `skill.zip` outside the repository and do not commit it.
- Preserve unrelated user-owned changes. Stop if the working tree contains unexpected files or overlapping edits.

---

## File Map

| Path | Responsibility |
| --- | --- |
| `handoff-pack/SKILL.md` | Trigger metadata, operating modes, ordered workflow, safety boundaries, and reference/script gates |
| `handoff-pack/agents/openai.yaml` | ChatGPT/Codex display name, short description, and default prompt |
| `handoff-pack/scripts/collect_repo_state.py` | Read-only, sanitized, versioned Git/non-Git JSON collection |
| `handoff-pack/scripts/validate_handoff.py` | Human/JSON validation with errors, warnings, strict mode, and stable exit codes |
| `handoff-pack/references/handoff-template.md` | Localizable 18-section document schema and receiving-agent prompt contract |
| `handoff-pack/references/evidence-rules.md` | Verified/user-provided/unknown/stale/conflicting evidence rules |
| `handoff-pack/references/quality-gates.md` | Mandatory hard failures, warnings, and finalization checklist |
| `tests/test_handoff_pack.py` | Script behavior, security, localization, metadata, and documentation contract tests |
| `README.md` | Multi-host catalog, installation paths, validation, and invocation examples |

---

### Task 1: Repository State Collector

**Files:**
- Create through initializer: `handoff-pack/SKILL.md`
- Create through initializer: `handoff-pack/agents/openai.yaml`
- Create: `handoff-pack/scripts/collect_repo_state.py`
- Create: `tests/test_handoff_pack.py`
- Leave generated `SKILL.md` uncommitted until Task 3 replaces every generated marker

**Interfaces:**
- Consumes: local path, installed Git CLI when available, existing local Git refs
- Produces: `collect_repo_state(path: Path, recent_commits: int) -> dict[str, object]`
- Produces: `sanitize_remote_url(value: str) -> str`
- Produces CLI: `python3 handoff-pack/scripts/collect_repo_state.py [--path PATH] [--recent-commits N] [--output FILE]`
- Produces collector exit codes: `0` valid JSON, `2` CLI usage, `3` execution failure, `4` output-write failure

- [ ] **Step 1: Run a no-skill behavioral baseline before creating `handoff-pack/`**

Create a temporary Git repository with an empty baseline commit and one untracked file. Store its resolved absolute path as `HANDOFF_BASELINE_REPO`. Dispatch a fresh agent without the proposed skill using this prompt after replacing the shell variable with its value:

```text
Prepare a handoff for this repository so another developer can continue safely. Do not commit or push. Repository: ${HANDOFF_BASELINE_REPO}
```

Record the returned artifact and observable gaps in the execution notes. Score whether it includes exact branch/commit, local-only state, evidence classification, accurate test status, actionable next steps, restart instructions, and a receiving-agent prompt. Do not provide the intended answer or this plan to the baseline agent.

Expected: at least one requirement is missing or insufficiently evidenced; this is the documentation-TDD RED observation. If the baseline unexpectedly satisfies every item, add a harder dirty-tree plus stale-handoff scenario before authoring the skill.

- [ ] **Step 2: Write failing collector tests**

Create `tests/test_handoff_pack.py` with the shared helpers and collector tests below. Test code may use `Path.write_text()` only inside temporary test directories.

```python
from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
COLLECTOR = ROOT / "handoff-pack" / "scripts" / "collect_repo_state.py"
VALIDATOR = ROOT / "handoff-pack" / "scripts" / "validate_handoff.py"


def run(command: list[str], cwd: Path, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=cwd,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        check=check,
    )


def git(cwd: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return run(["git", *args], cwd)


def init_repo(path: Path) -> None:
    git(path, "init", "-b", "main")
    git(path, "config", "user.name", "Handoff Test")
    git(path, "config", "user.email", "handoff@example.invalid")
    (path / "tracked.txt").write_text("v1\n", encoding="utf-8")
    (path / "rename-me.txt").write_text("rename\n", encoding="utf-8")
    (path / "delete-me.txt").write_text("delete\n", encoding="utf-8")
    git(path, "add", ".")
    git(path, "commit", "-m", "baseline")


def run_collector(path: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return run([sys.executable, str(COLLECTOR), "--path", str(path), *args], ROOT, check=False)


def load_script(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise AssertionError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


class CollectorTests(unittest.TestCase):
    def test_non_git_directory_is_valid_json(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            result = run_collector(Path(raw))
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(result.stdout)
        self.assertEqual(data["schema_version"], 1)
        self.assertFalse(data["git_available"])
        self.assertIsNone(data["repository_root"])

    def test_missing_git_is_valid_non_git_observation(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            result = subprocess.run(
                [sys.executable, str(COLLECTOR), "--path", raw],
                cwd=ROOT,
                text=True,
                encoding="utf-8",
                errors="replace",
                capture_output=True,
                env={**os.environ, "PATH": ""},
                check=False,
            )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(json.loads(result.stdout)["git_available"])

    def test_clean_repository_records_head(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            repo = Path(raw)
            init_repo(repo)
            result = run_collector(repo, "--recent-commits", "1")
            expected_sha = git(repo, "rev-parse", "HEAD").stdout.strip()
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(result.stdout)
        self.assertTrue(data["git_available"])
        self.assertEqual(data["head"]["branch"], "main")
        self.assertEqual(data["head"]["commit"], expected_sha)
        self.assertTrue(data["working_tree"]["clean"])
        self.assertEqual(len(data["recent_commits"]), 1)

    def test_dirty_detached_repository_classifies_paths(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            repo = Path(raw)
            init_repo(repo)
            (repo / "tracked.txt").write_text("staged\n", encoding="utf-8")
            git(repo, "add", "tracked.txt")
            (repo / "tracked.txt").write_text("unstaged\n", encoding="utf-8")
            git(repo, "mv", "rename-me.txt", "renamed.txt")
            (repo / "delete-me.txt").unlink()
            (repo / "untracked.txt").write_text("local\n", encoding="utf-8")
            git(repo, "checkout", "--detach")
            result = run_collector(repo)
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(result.stdout)
        self.assertTrue(data["head"]["detached"])
        self.assertIsNone(data["head"]["branch"])
        self.assertFalse(data["working_tree"]["clean"])
        self.assertIn("tracked.txt", {item["path"] for item in data["working_tree"]["staged"]})
        self.assertIn("tracked.txt", {item["path"] for item in data["working_tree"]["unstaged"]})
        self.assertIn("untracked.txt", data["working_tree"]["untracked"])
        self.assertTrue(data["working_tree"]["renamed"])
        self.assertIn("delete-me.txt", data["working_tree"]["deleted"])

    def test_remote_credentials_are_removed(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            repo = Path(raw)
            init_repo(repo)
            git(repo, "remote", "add", "origin", "https://user:fake-value@example.invalid/org/repo.git?token=fake#part")
            result = run_collector(repo)
        self.assertEqual(result.returncode, 0, result.stderr)
        remote_text = json.dumps(json.loads(result.stdout)["remotes"])
        self.assertIn("https://example.invalid/org/repo.git", remote_text)
        self.assertNotIn("fake-value", remote_text)
        self.assertNotIn("?token", remote_text)
        self.assertNotIn("#part", remote_text)

    def test_local_upstream_ahead_count_uses_existing_refs(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            base = Path(raw)
            remote = base / "remote.git"
            repo = base / "repo"
            remote.mkdir()
            repo.mkdir()
            git(remote, "init", "--bare")
            init_repo(repo)
            git(repo, "remote", "add", "origin", str(remote))
            git(repo, "push", "-u", "origin", "main")
            (repo / "ahead.txt").write_text("ahead\n", encoding="utf-8")
            git(repo, "add", "ahead.txt")
            git(repo, "commit", "-m", "ahead")
            result = run_collector(repo)
        data = json.loads(result.stdout)
        self.assertEqual(data["upstream"]["name"], "origin/main")
        self.assertEqual(data["upstream"]["ahead"], 1)
        self.assertEqual(data["upstream"]["behind"], 0)

    def test_output_file_and_argument_validation(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw)
            output = path / "state.json"
            result = run_collector(path, "--output", str(output))
            invalid = run_collector(path, "--recent-commits", "101")
            unwritable = run_collector(path, "--output", str(path / "missing" / "state.json"))
            data = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "")
        self.assertFalse(data["git_available"])
        self.assertEqual(invalid.returncode, 2)
        self.assertEqual(unwritable.returncode, 4)

    def test_operation_and_submodule_state(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            base = Path(raw)
            child = base / "child"
            repo = base / "repo"
            child.mkdir()
            repo.mkdir()
            init_repo(child)
            init_repo(repo)
            run(["git", "-c", "protocol.file.allow=always", "submodule", "add", str(child), "modules/child"], repo)
            git(repo, "commit", "-am", "add submodule")
            git_dir = Path(git(repo, "rev-parse", "--git-dir").stdout.strip())
            if not git_dir.is_absolute():
                git_dir = repo / git_dir
            (git_dir / "MERGE_HEAD").write_text("0" * 40 + "\n", encoding="ascii")
            result = run_collector(repo)
        data = json.loads(result.stdout)
        self.assertTrue(data["operation_state"]["merge"])
        self.assertEqual(data["submodules"][0]["path"], "modules/child")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run the collector tests to verify RED**

Run:

```bash
python3 -m unittest discover -s tests -p 'test_handoff_pack.py' -v
```

Expected: FAIL because `handoff-pack/scripts/collect_repo_state.py` does not exist.

- [ ] **Step 4: Initialize the skill using the required initializer**

Run exactly once from the repository root:

```bash
python3 /Users/napatrungruangbangchan/.codex/skills/.system/skill-creator/scripts/init_skill.py handoff-pack \
  --path . \
  --resources scripts,references \
  --interface display_name="Handoff Pack" \
  --interface short_description="Create and validate evidence-based HANDOFF.md files" \
  --interface default_prompt='Use $handoff-pack to prepare an evidence-based HANDOFF.md for the current project.'
```

Expected: `handoff-pack/`, `agents/`, `scripts/`, and `references/` exist. Do not stage the generated `SKILL.md` until Task 3 replaces all generated markers.

- [ ] **Step 5: Implement the collector**

Use these exact public constants in `collect_repo_state.py`:

```python
SCHEMA_VERSION = 1
DEFAULT_RECENT_COMMITS = 10
MAX_RECENT_COMMITS = 100


class CollectorError(RuntimeError):
    pass
```

Implement these exact function signatures: `sanitize_remote_url(value: str) -> str`, `run_git(path: Path, args: Sequence[str], *, check: bool = False) -> subprocess.CompletedProcess[str]`, `parse_name_status(raw: str, source: str) -> list[dict[str, str]]`, `collect_repo_state(path: Path, recent_commits: int) -> dict[str, object]`, `serialize_json(data: dict[str, object]) -> str`, and `main(argv: Sequence[str] | None = None) -> int`.

Implement URL sanitation with parsed host reconstruction and no user info, query, or fragment:

```python
def sanitize_remote_url(value: str) -> str:
    value = value.strip()
    if "://" not in value:
        if "@" in value and ":" in value.split("@", 1)[1]:
            return value.split("@", 1)[1]
        return value.split("?", 1)[0].split("#", 1)[0]
    parsed = urllib.parse.urlsplit(value)
    hostname = parsed.hostname or ""
    if ":" in hostname and not hostname.startswith("["):
        hostname = f"[{hostname}]"
    if parsed.port is not None:
        hostname = f"{hostname}:{parsed.port}"
    return urllib.parse.urlunsplit((parsed.scheme, hostname, parsed.path, "", ""))
```

Parse staged and unstaged paths from `git diff --name-status -z` and `git diff --cached --name-status -z`. Each normal item is `{"path": path, "status": code, "source": source}`. Each rename/copy additionally includes `old_path`. Collect untracked paths with `git ls-files --others --exclude-standard -z`. Build deleted and renamed summaries from those records.

Populate this exact top-level shape for Git and non-Git modes:

```python
data = {
    "schema_version": SCHEMA_VERSION,
    "collected_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    "requested_path": str(path),
    "working_directory": str(path.resolve()),
    "git_available": False,
    "repository_root": None,
    "head": {"branch": None, "detached": False, "commit": None, "short_commit": None, "subject": None},
    "upstream": {"name": None, "ahead": None, "behind": None, "reason": "not available"},
    "remotes": [],
    "working_tree": {"clean": True, "staged": [], "unstaged": [], "untracked": [], "deleted": [], "renamed": []},
    "diff_stats": {"staged": "", "unstaged": ""},
    "operation_state": {"merge": False, "rebase": False, "cherry_pick": False, "revert": False, "bisect": False},
    "recent_commits": [],
    "submodules": [],
    "warnings": [],
}
```

Represent each remote as `{"name": str, "fetch_urls": list[str], "push_urls": list[str]}` after sanitizing every URL. Do not collapse fetch and push URLs into one field.

Use `shutil.which("git")` and `git -C <path> rev-parse --show-toplevel` for discovery. A missing command or non-repository response returns the non-Git object with exit `0`. Once a repository is discovered, collect:

```text
symbolic-ref --quiet --short HEAD
rev-parse HEAD
rev-parse --short HEAD
log -1 --format=%s
rev-parse --abbrev-ref --symbolic-full-name @{upstream}
rev-list --left-right --count HEAD...@{upstream}
remote
remote get-url --all <name>
remote get-url --push --all <name>
diff --cached --name-status -z
diff --name-status -z
ls-files --others --exclude-standard -z
diff --cached --shortstat
diff --shortstat
log -<N> --format=%H%x00%h%x00%s%x1e
```

Use `git rev-parse --git-path` plus path existence for operation markers. Consider both `rebase-merge` and `rebase-apply`. Run `git submodule status --recursive` only when repository-root `.gitmodules` exists; parse the leading state character, 40-character commit, path, and optional detail without opening `.gitmodules`.

Write stdout only when `--output` is absent. Catch an explicit output `OSError` and return `4`. Catch `CollectorError` after Git discovery, print a concise error to stderr without sensitive command output, and return `3`. Let `argparse` return `2` for invalid ranges through a type function that accepts only `0..100`.

- [ ] **Step 6: Run collector tests to verify GREEN**

Run:

```bash
python3 -m unittest discover -s tests -p 'test_handoff_pack.py' -v
```

Expected: all eight `CollectorTests` pass with no network access.

- [ ] **Step 7: Run collector smoke checks**

Run:

```bash
python3 handoff-pack/scripts/collect_repo_state.py --path . --recent-commits 2
python3 handoff-pack/scripts/collect_repo_state.py --path /private/tmp --recent-commits 0
```

Expected: first command reports this repository without diff content or credential-bearing remotes; second command returns valid non-Git JSON when `/private/tmp` is outside a repository.

- [ ] **Step 8: Commit only collector implementation and its tests**

```bash
git add handoff-pack/scripts/collect_repo_state.py tests/test_handoff_pack.py
git commit -m "Add handoff repository state collector"
```

Do not stage the generated `handoff-pack/SKILL.md` or `handoff-pack/agents/openai.yaml` yet.

---

### Task 2: Handoff Validator

**Files:**
- Create: `handoff-pack/scripts/validate_handoff.py`
- Modify: `tests/test_handoff_pack.py`

**Interfaces:**
- Consumes: UTF-8 Markdown file with stable numbered sections
- Produces: `validate_text(text: str, path: Path) -> ValidationResult`
- Produces: `ValidationResult.errors: list[Finding]` and `ValidationResult.warnings: list[Finding]`
- Produces CLI: `python3 handoff-pack/scripts/validate_handoff.py HANDOFF.md [--json] [--strict]`
- Produces validator exit codes: `0` valid, `1` validation failure, `2` usage/unreadable input

- [ ] **Step 1: Append failing validator helpers and tests**

Add these constants and helpers above the test classes:

```python
ENGLISH_HEADINGS = [
    "Handoff Metadata", "Executive Summary", "Objective and Acceptance Criteria", "Scope",
    "Verified Current State", "Completed Work", "Work in Progress", "Key Decisions and Rationale",
    "Changed Files and Components", "Validation and Test Results", "Known Issues, Risks and Blockers",
    "Dependencies and Environment Notes", "Assumptions and User-Reported Context", "Open Questions",
    "Recommended Next Actions", "Restart Instructions", "Starter Prompt for the Receiving Agent",
    "Final Verification Checklist",
]

THAI_HEADINGS = [
    "ข้อมูลการส่งต่องาน", "บทสรุปสำหรับผู้รับช่วง", "เป้าหมายและเกณฑ์การยอมรับ", "ขอบเขต",
    "สถานะปัจจุบันที่ตรวจสอบแล้ว", "งานที่เสร็จแล้ว", "งานที่กำลังดำเนินการ", "การตัดสินใจสำคัญและเหตุผล",
    "ไฟล์และส่วนประกอบที่เปลี่ยน", "ผลการตรวจสอบและการทดสอบ", "ปัญหา ความเสี่ยง และสิ่งกีดขวาง",
    "การพึ่งพาและสภาพแวดล้อม", "สมมติฐานและบริบทจากผู้ใช้", "คำถามที่ยังเปิดอยู่",
    "ขั้นตอนถัดไปที่แนะนำ", "วิธีเริ่มทำงานต่อ", "พรอมต์เริ่มต้นสำหรับเอเจนต์ผู้รับช่วง",
    "รายการตรวจสอบสุดท้าย",
]


def valid_handoff(headings: list[str] = ENGLISH_HEADINGS, title: str = "Project Handoff") -> str:
    bodies = {
        1: "- Current branch: `main`\n- HEAD commit: `0123456789abcdef0123456789abcdef01234567`",
        9: "| Path or Component | Change | Status | Notes |\n| --- | --- | --- | --- |\n| `app.py` | Updated | Complete | Verified |",
        10: "| Command | Working Directory | Status | Result |\n| --- | --- | --- | --- |\n| `python3 -m unittest` | `.` | Passed | 12 tests passed |",
        13: "- None reported.",
        14: "- None.",
        15: "1. Re-run `python3 -m unittest` and continue in `app.py`; expected outcome: green baseline; blocker: none.",
        16: "1. Checkout `main`.\n2. Confirm the HEAD commit.\n3. Read `AGENTS.md` when present.\n4. Run `python3 -m unittest`.",
        17: "Read `AGENTS.md` when present and `HANDOFF.md`. Verify the branch, commit, working tree, and tests. Start with Recommended Next Actions, validate changes, and report discrepancies because this handoff may be stale.",
        18: "\n".join(["- [x] Verified item"] * 11),
    }
    if headings == THAI_HEADINGS:
        bodies.update({
            1: "- สาขาปัจจุบัน: `main`\n- คอมมิต HEAD: `0123456789abcdef0123456789abcdef01234567`",
            13: "- ไม่มีบริบทที่ผู้ใช้รายงานเพิ่มเติม",
            14: "- ไม่มีคำถามที่เปิดอยู่",
            15: "1. รัน `python3 -m unittest` อีกครั้งแล้วทำงานต่อใน `app.py`; ผลที่คาดหวัง: baseline ผ่าน; blocker: ไม่มี",
            16: "1. Checkout `main`\n2. ยืนยันคอมมิต HEAD\n3. อ่าน `AGENTS.md` หากมี\n4. รัน `python3 -m unittest`",
            17: "อ่าน `AGENTS.md` หากมีและ `HANDOFF.md` ตรวจสอบสาขา คอมมิต working tree และผลทดสอบ เริ่มจากขั้นตอนถัดไป ตรวจสอบงานก่อนสรุป และรายงานความคลาดเคลื่อนเพราะ handoff อาจล้าสมัย",
        })
    sections = []
    for number, heading in enumerate(headings, 1):
        body = bodies.get(number, "- Verified content.")
        sections.append(f"## {number}. {heading}\n\n{body}")
    return f"# {title}\n\n" + "\n\n".join(sections) + "\n"


def run_validator(path: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return run([sys.executable, str(VALIDATOR), str(path), *args], ROOT, check=False)
```

Append this test class before `unittest.main()`:

```python
class ValidatorTests(unittest.TestCase):
    def validate_content(self, content: str, *args: str) -> subprocess.CompletedProcess[str]:
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "HANDOFF.md"
            path.write_text(content, encoding="utf-8")
            return run_validator(path, *args)

    def test_valid_english_and_thai_documents(self) -> None:
        english = self.validate_content(valid_handoff(), "--json")
        thai = self.validate_content(valid_handoff(THAI_HEADINGS, "เอกสารส่งต่องานโครงการ"), "--json")
        self.assertEqual(english.returncode, 0, english.stdout)
        self.assertEqual(thai.returncode, 0, thai.stdout)
        self.assertTrue(json.loads(english.stdout)["valid"])
        self.assertTrue(json.loads(thai.stdout)["valid"])

    def test_missing_duplicate_and_out_of_order_sections_are_errors(self) -> None:
        missing = valid_handoff().replace("## 4. Scope\n\n- Verified content.\n\n", "")
        duplicate = valid_handoff() + "\n## 4. Scope\n\nDuplicate.\n"
        reordered = valid_handoff().replace("## 1. Handoff Metadata", "## 2. Handoff Metadata", 1)
        duplicate_title = valid_handoff() + "\n# Project Handoff\n"
        for content in (missing, duplicate, reordered, duplicate_title):
            result = self.validate_content(content, "--json")
            self.assertEqual(result.returncode, 1)
            self.assertTrue(json.loads(result.stdout)["errors"])

    def test_placeholder_warns_and_strict_fails(self) -> None:
        content = valid_handoff().replace("- Verified content.", "- [NEEDS INPUT: objective]", 1)
        normal = self.validate_content(content, "--json")
        strict = self.validate_content(content, "--json", "--strict")
        self.assertEqual(normal.returncode, 0)
        self.assertTrue(json.loads(normal.stdout)["warnings"])
        self.assertEqual(strict.returncode, 1)

    def test_invalid_test_status_is_error_and_failed_is_allowed(self) -> None:
        invalid = valid_handoff().replace("| Passed |", "| Success |")
        failed = valid_handoff().replace("| Passed |", "| Failed |")
        self.assertEqual(self.validate_content(invalid).returncode, 1)
        self.assertEqual(self.validate_content(failed).returncode, 0)

    def test_invalid_branch_commit_and_plain_command_are_reported(self) -> None:
        invalid_branch = valid_handoff().replace("Current branch: `main`", "Current branch: `bad branch`")
        invalid_commit = valid_handoff().replace(
            "0123456789abcdef0123456789abcdef01234567", "not-a-commit"
        )
        plain_command = valid_handoff().replace("| `python3 -m unittest` |", "| python3 -m unittest |")
        self.assertEqual(self.validate_content(invalid_branch).returncode, 1)
        self.assertEqual(self.validate_content(invalid_commit).returncode, 1)
        plain_result = self.validate_content(plain_command, "--json")
        self.assertTrue(json.loads(plain_result.stdout)["warnings"])

    def test_secret_value_and_credential_url_are_errors_without_echo(self) -> None:
        secret = "api_key = fake-secret-value-that-must-not-be-echoed"
        url = "https://user:fake-password@example.invalid/repo.git"
        content = valid_handoff().replace("- Verified content.", f"- {secret}\n- {url}", 1)
        result = self.validate_content(content, "--json")
        self.assertEqual(result.returncode, 1)
        self.assertNotIn("fake-secret-value", result.stdout)
        self.assertNotIn("fake-password", result.stdout)

    def test_bare_environment_variable_name_is_not_a_secret(self) -> None:
        content = valid_handoff().replace("- Verified content.", "- Required variable: `OPENAI_API_KEY`", 1)
        result = self.validate_content(content, "--json")
        codes = {item["code"] for item in json.loads(result.stdout)["errors"]}
        self.assertNotIn("secret-value", codes)

    def test_next_actions_commands_fences_and_checklist_are_checked(self) -> None:
        no_action = valid_handoff().replace("1. Re-run `python3 -m unittest`", "Re-run python3 -m unittest")
        bad_fence = valid_handoff() + "\n```text\nunclosed\n"
        short_checklist = valid_handoff().replace("\n".join(["- [x] Verified item"] * 11), "- [x] One item")
        for content in (no_action, bad_fence, short_checklist):
            self.assertEqual(self.validate_content(content).returncode, 1)

    def test_file_size_thresholds(self) -> None:
        warning = valid_handoff() + ("x" * (65 * 1024))
        error = valid_handoff() + ("x" * (257 * 1024))
        warning_result = self.validate_content(warning, "--json")
        error_result = self.validate_content(error, "--json")
        self.assertEqual(warning_result.returncode, 0)
        self.assertTrue(json.loads(warning_result.stdout)["warnings"])
        self.assertEqual(error_result.returncode, 1)
```

- [ ] **Step 2: Run validator tests to verify RED**

Run:

```bash
python3 -m unittest discover -s tests -p 'test_handoff_pack.py' -v
```

Expected: collector tests pass and validator tests fail because `validate_handoff.py` does not exist.

- [ ] **Step 3: Implement the validator**

Use these exact constants and public types:

```python
ALLOWED_STATUSES = {"Passed", "Failed", "Not run", "Blocked"}
WARNING_SIZE_BYTES = 64 * 1024
ERROR_SIZE_BYTES = 256 * 1024
TITLE_ALIASES = {"Project Handoff", "เอกสารส่งต่องานโครงการ"}


@dataclass(frozen=True)
class Finding:
    code: str
    message: str
    line: int | None = None

    def as_dict(self) -> dict[str, object]:
        return {"code": self.code, "message": self.message, "line": self.line}


@dataclass
class ValidationResult:
    path: Path
    size_bytes: int
    errors: list[Finding]
    warnings: list[Finding]

    @property
    def valid(self) -> bool:
        return not self.errors

    def as_dict(self) -> dict[str, object]:
        return {
            "valid": self.valid,
            "path": str(self.path),
            "size_bytes": self.size_bytes,
            "errors": [item.as_dict() for item in self.errors],
            "warnings": [item.as_dict() for item in self.warnings],
        }
```

Implement these exact function signatures: `parse_sections(text: str) -> tuple[str | None, list[tuple[int, str, int, str]]]`, `detect_secrets(lines: list[str]) -> list[Finding]`, `validate_text(text: str, path: Path) -> ValidationResult`, `render_human(result: ValidationResult) -> str`, and `main(argv: Sequence[str] | None = None) -> int`.

Define all 18 English and Thai aliases as constants copied from the test file. Parse only level-one title and level-two numbered sections with anchored regular expressions. Keep each section's number, heading text, starting line, and body. Add errors for missing, duplicate, unknown alias, or out-of-order numbers.

Implement checks with stable finding codes:

```text
missing-title
invalid-title
missing-section
duplicate-section
section-order
invalid-section-heading
needs-input
invalid-test-status
invalid-branch
invalid-commit
next-actions
restart-instructions
starter-prompt
final-checklist
empty-evidence-section
unbalanced-fence
command-formatting
file-size-warning
file-size-error
secret-value
credential-url
```

Within section 10, parse Markdown table data rows, ignore the header and separator, and require the third column to be in `ALLOWED_STATUSES`. Require the first column of every data row to contain backtick-formatted command text. Within section 15 require at least one ordered-list item. Within section 16 require at least three ordered steps. Within section 17 require `HANDOFF.md` plus branch/สาขา and validation/ตรวจสอบ language. Within section 18 require exactly eleven checkbox lines matching `- [ ]` or `- [x]` case-insensitively.

Validate branch and commit only when matching metadata labels are present. Accept `Not available`, `ไม่พร้อมใช้งาน`, and `Detached HEAD` as explicit unavailable/special values. Otherwise require branch `[A-Za-z0-9][A-Za-z0-9._/-]*` and commit `[0-9a-fA-F]{7,40}`.

Detect secrets without returning matched text. Report only finding code, safe message, and line number. Use conservative patterns for:

```python
PRIVATE_KEY_RE = re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")
CREDENTIAL_URL_RE = re.compile(r"https?://[^\s/:@]+:[^\s/@]+@", re.IGNORECASE)
SENSITIVE_QUERY_RE = re.compile(r"[?&](?:access_token|api_key|token|password|secret)=", re.IGNORECASE)
KNOWN_TOKEN_RE = re.compile(r"\b(?:sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16})\b")
ASSIGNMENT_RE = re.compile(
    r"(?i)\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|password|client[_-]?secret|secret)\b\s*[:=]\s*[`\"']?([^\s`\"']+)"
)
```

Ignore assignment values equal to redaction/placeholder forms: `REDACTED`, `[REDACTED]`, `<redacted>`, `${NAME}`, `$NAME`, and strings beginning with `[NEEDS INPUT`. A bare variable name without `:` or `=` never matches.

In human output print `ERROR <code> line <n>: <safe message>` and `WARNING <code> line <n>: <safe message>`, followed by a count summary. In JSON output serialize `ValidationResult.as_dict()` with UTF-8 characters preserved. Unreadable or undecodable input prints a safe stderr error and returns `2`. `--strict` returns `1` if warnings exist but does not rewrite `valid`; `valid` means no errors.

- [ ] **Step 4: Run validator tests to verify GREEN**

Run:

```bash
python3 -m unittest discover -s tests -p 'test_handoff_pack.py' -v
```

Expected: all collector and validator tests pass.

- [ ] **Step 5: Verify no fake secret is printed**

Run the single secret test verbosely:

```bash
python3 -m unittest test_handoff_pack.ValidatorTests.test_secret_value_and_credential_url_are_errors_without_echo -v
```

Set the command working directory to the absolute `tests/` directory so `test_handoff_pack` imports directly.

Expected: PASS and no fake value appears in output.

- [ ] **Step 6: Commit validator implementation**

```bash
git add handoff-pack/scripts/validate_handoff.py tests/test_handoff_pack.py
git commit -m "Add evidence-based handoff validator"
```

---

### Task 3: Skill Instructions, References, and Metadata

**Files:**
- Replace generated: `handoff-pack/SKILL.md`
- Regenerate: `handoff-pack/agents/openai.yaml`
- Create: `handoff-pack/references/handoff-template.md`
- Create: `handoff-pack/references/evidence-rules.md`
- Create: `handoff-pack/references/quality-gates.md`
- Modify: `tests/test_handoff_pack.py`

**Interfaces:**
- Consumes: collector JSON, user context, applicable repository instructions, optional authoritative read-only connected context
- Produces: repository-root `HANDOFF.md` or a read-only audit report
- Requires: collector for local Git create/update/audit comparison; validator after create/update and first during audit
- Produces OpenAI UI metadata with no MCP or connector dependency

- [ ] **Step 1: Add failing static contract tests**

Append this class before `unittest.main()`:

```python
class SkillContractTests(unittest.TestCase):
    def test_runtime_layout_and_frontmatter(self) -> None:
        skill = ROOT / "handoff-pack"
        expected = {
            "SKILL.md",
            "agents/openai.yaml",
            "scripts/collect_repo_state.py",
            "scripts/validate_handoff.py",
            "references/handoff-template.md",
            "references/evidence-rules.md",
            "references/quality-gates.md",
        }
        actual = {str(path.relative_to(skill)) for path in skill.rglob("*") if path.is_file() and "__pycache__" not in path.parts}
        self.assertEqual(actual, expected)
        text = (skill / "SKILL.md").read_text(encoding="utf-8")
        frontmatter = text.split("---", 2)[1]
        keys = {line.split(":", 1)[0].strip() for line in frontmatter.splitlines() if ":" in line}
        self.assertEqual(keys, {"name", "description"})
        self.assertIn("name: handoff-pack", frontmatter)
        self.assertLess(len(text.splitlines()), 500)
        self.assertNotRegex(text, r"\b(?:TODO|TBD|FIXME)\b")

    def test_bilingual_triggers_workflow_and_boundaries(self) -> None:
        text = (ROOT / "handoff-pack" / "SKILL.md").read_text(encoding="utf-8")
        for phrase in (
            "HANDOFF.md", "project handoff", "Prepare a handoff", "Audit the existing handoff",
            "เตรียม handoff", "สร้าง HANDOFF.md", "อัปเดต HANDOFF.md", "ตรวจสอบ handoff", "สรุปงานเพื่อส่งต่อ",
        ):
            self.assertIn(phrase, text)
        for path in (
            "references/handoff-template.md", "references/evidence-rules.md", "references/quality-gates.md",
            "scripts/collect_repo_state.py", "scripts/validate_handoff.py",
        ):
            self.assertIn(path, text)
        for boundary in ("commit", "push", "merge", "deploy", "publish", "account", "conversation"):
            self.assertIn(boundary, text.lower())

    def test_template_and_evidence_references(self) -> None:
        references = ROOT / "handoff-pack" / "references"
        template = (references / "handoff-template.md").read_text(encoding="utf-8")
        for number in range(1, 19):
            self.assertRegex(template, rf"(?m)^## {number}\. ")
        self.assertIn("| Path or Component | Change | Status | Notes |", template)
        self.assertIn("| Command | Working Directory | Status | Result |", template)
        evidence = (references / "evidence-rules.md").read_text(encoding="utf-8")
        for category in ("Verified", "User-provided", "Unknown or inferred", "Stale", "Conflicting"):
            self.assertIn(category, evidence)
        gates = (references / "quality-gates.md").read_text(encoding="utf-8")
        for gate in ("Factual integrity", "Secret safety", "Recipient independence", "Idempotent updates"):
            self.assertIn(gate, gates)
        self.assertIn("Hard failures", gates)
        self.assertIn("Warnings", gates)

    def test_openai_metadata(self) -> None:
        metadata = (ROOT / "handoff-pack" / "agents" / "openai.yaml").read_text(encoding="utf-8")
        self.assertIn('display_name: "Handoff Pack"', metadata)
        self.assertIn('short_description: "Create and validate evidence-based HANDOFF.md files"', metadata)
        self.assertIn("$handoff-pack", metadata)
        self.assertNotIn("dependencies:", metadata)
```

- [ ] **Step 2: Run static contract tests to verify RED**

Run:

```bash
python3 -m unittest discover -s tests -p 'test_handoff_pack.py' -v
```

Expected: collector and validator tests pass; `SkillContractTests` fail because references are absent and generated `SKILL.md` still contains template markers.

- [ ] **Step 3: Replace `SKILL.md` with the workflow control plane**

Use this frontmatter and section order:

```markdown
---
name: handoff-pack
description: Use when creating, updating, or auditing a software-project HANDOFF.md; preparing a branch, repository, task, or Codex handoff for another developer or agent; or when requests say Prepare a handoff, Audit the existing handoff, เตรียม handoff, สร้าง HANDOFF.md, อัปเดต HANDOFF.md, ตรวจสอบ handoff, สรุปงานเพื่อส่งต่อ, or เตรียมงานให้คนหรือ agent อื่นทำต่อ.
---

# Handoff Pack

Create a durable, evidence-based `HANDOFF.md` that lets a recipient continue safely without the original transcript. Never represent this workflow as an account, permission, ownership, conversation, or Codex-task transfer.

## Operating Mode

Classify the request as `create`, `update`, `audit`, or `non-git`. Treat audit as read-only unless the user requests editing. Write the handoff in the user's language unless the user selects another language.

## Required Resources

- Read [handoff-template.md](references/handoff-template.md) before creating or updating.
- Read [evidence-rules.md](references/evidence-rules.md) before classifying facts or resolving contradictions.
- Read [quality-gates.md](references/quality-gates.md) before finalizing.
- Run `scripts/collect_repo_state.py` whenever a local Git repository is available.
- Run `scripts/validate_handoff.py` after every create or update; run it first for an audit.

## Workflow

1. Locate the repository root and record the actual working directory. Continue in non-Git mode when unavailable.
2. Read applicable `AGENTS.md` and useful repository instructions without opening secret files merely for context.
3. Collect repository state with the bundled collector and supplement it with relevant files, user context, safe validation, and requested authoritative read-only issue or PR context.
4. Determine the objective from explicit instructions, authoritative issue/PR context, existing handoff, task/design documents, conversation context, then repository changes. Use `[NEEDS INPUT: objective]` rather than inventing it.
5. Separate scope and progress into completed, partial, not started, deferred, and blocked states. Changed files alone do not prove completion.
6. Discover validation commands from user instructions, `AGENTS.md`, repository docs, build/package configuration, CI, then the existing handoff. Run only safe local commands.
7. Inspect proposed content for likely secret values without opening excluded secret files. Redact values and report only safe locations.
8. Create or update repository-root `HANDOFF.md`; preserve useful human decisions and unresolved context while replacing stale machine-derived state. Avoid duplicate sections.
9. Validate the result and fix errors. Keep warnings visible.
10. Report the path, operation, branch/commit, evidence, commands/results, blockers, unknowns, uncommitted-change risk, secret warnings, and safest next action.

## Evidence and Test Rules

Record directly observed commands separately from user-reported results. Use only `Passed`, `Failed`, `Not run`, or `Blocked`. Never omit a failure, claim a test passed without execution or authoritative evidence, claim a file is committed from working-tree presence, or confuse the current branch with a destination branch.

## External Context

Use local Git and repository files as primary evidence. When the user requests a supplied issue or PR and a connector is available, read it without commenting, assigning, editing, merging, or making any other external write unless separately authorized.

## Safety Boundaries

Do not automatically commit, amend, push, force-push, open a PR, merge, deploy, publish, create tickets, assign people, switch branches, stash, reset, delete project files, run shared migrations, expose secrets, or claim to transfer an account or conversation. Ask only when missing information blocks a useful handoff; mark non-blocking gaps explicitly.
```

Keep the final `SKILL.md` concise; add operational details to references rather than expanding these sections.

- [ ] **Step 4: Write the complete handoff template reference**

Create `references/handoff-template.md` with:

```markdown
# HANDOFF.md Template

Use the user's language. Keep the numeric section identifiers stable. Translate the title and heading text when writing Thai; the validator recognizes the Thai aliases documented below. Include only evidence-supported values and leave final checklist items unchecked when unsupported.

# Project Handoff

## 1. Handoff Metadata

- Generated at: `[ISO 8601 when reliable]`
- Repository: `[known value only]`
- Working directory: `[known value only]`
- Current branch: `[branch, Detached HEAD, or Not available]`
- HEAD commit: `[full SHA or Not available]`
- Upstream branch: `[known value only]`
- Pull request: `[known value only]`
- Related issue or ticket: `[known value only]`
- Intended recipient: `[known value only]`
- Handoff purpose: `[known value only]`

## 2. Executive Summary

Write 3–8 sentences covering objective, current state, and the recipient's expected next step.

## 3. Objective and Acceptance Criteria

- Objective:
- Acceptance criteria:
- Definition of done:

## 4. Scope

- In scope:
- Out of scope:
- Deferred:

## 5. Verified Current State

Record only directly verified repository, command, file, or authoritative-source facts.

## 6. Completed Work

List completed work with supporting evidence.

## 7. Work in Progress

Separate staged, unstaged, untracked, unpushed, experimental, and generated work.

## 8. Key Decisions and Rationale

Record known decisions and rationale. Mark unknown rationale explicitly.

## 9. Changed Files and Components

| Path or Component | Change | Status | Notes |
| --- | --- | --- | --- |

## 10. Validation and Test Results

| Command | Working Directory | Status | Result |
| --- | --- | --- | --- |

Use only `Passed`, `Failed`, `Not run`, or `Blocked`. Explain important failures below the table.

## 11. Known Issues, Risks and Blockers

For each item record description, impact, evidence, mitigation/workaround, and owner only when known.

## 12. Dependencies and Environment Notes

Record verified tool versions, setup commands, services, environment variable names without values, feature flags, and platform constraints.

## 13. Assumptions and User-Reported Context

Keep assumptions and unverified user reports separate from Verified Current State.

## 14. Open Questions

List questions that may affect implementation or acceptance.

## 15. Recommended Next Actions

1. Put the safest actionable step first. Include expected outcome, file/component, validation command, and dependency/blocker when known.

## 16. Restart Instructions

1. Checkout the expected branch.
2. Confirm the expected commit.
3. Read applicable `AGENTS.md` and `HANDOFF.md`.
4. Review named files.
5. Run baseline validation.
6. Continue with the first Recommended Next Action.

## 17. Starter Prompt for the Receiving Agent

Write a concise project-specific prompt that tells the receiving agent to read applicable `AGENTS.md` and `HANDOFF.md`, verify branch/commit and working tree, review tests, avoid repeated work, start from Recommended Next Actions, validate before completion claims, report discrepancies, and treat the handoff as potentially stale.

## 18. Final Verification Checklist

- [ ] Objective is clear
- [ ] Acceptance criteria are recorded or marked as missing
- [ ] Branch and commit were verified
- [ ] Uncommitted changes are documented
- [ ] Completed and remaining work are separated
- [ ] Tests are recorded accurately
- [ ] Failures and blockers are visible
- [ ] Next actions are actionable
- [ ] Assumptions are separated from facts
- [ ] No secret values are included
- [ ] Receiving-agent starter prompt is present

## Thai Heading Aliases

Use the 18 Thai headings defined in `tests/test_handoff_pack.py` with the same numbers. Keep `[NEEDS INPUT: ...]` as the stable machine-readable unknown marker.
```

- [ ] **Step 5: Write evidence and quality references**

Create `references/evidence-rules.md` as a concise decision table:

```markdown
# Evidence Rules

| Class | Meaning | Treatment |
| --- | --- | --- |
| Verified | Observed from Git, repository files, commands run directly, or an authoritative connected source | State as current fact and identify the source |
| User-provided | Explicitly stated by the user but not independently checked | Keep under User-Reported Context or label the source |
| Unknown or inferred | Not confirmed by available evidence | Mark unknown or assumption; never convert silently to fact |
| Stale | Previously true but older than current repository or authoritative state | Replace machine-derived state and preserve the contradiction when material |
| Conflicting | Two available sources disagree | Report both, prefer direct current repository state for repository facts, and request input only when blocking |

## Tests

- A command observed with exit code 0 may be recorded as `Passed` only for what it actually checks.
- A command observed with non-zero exit is `Failed` or `Blocked`; never omit it.
- A user or CI result is user-provided unless an authoritative connected result was read directly.
- `Not run` requires a concise reason.

## Repository Precedence

Current directly observed repository state takes precedence over stale `HANDOFF.md` or conversation claims. Report contradictions instead of silently erasing context. Working-tree presence does not prove commit or push state, and local-only changes are unavailable to a recipient who only checks out a remote branch.
```

Create `references/quality-gates.md` with the exact gates and severities:

```markdown
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

Run `scripts/validate_handoff.py`. Fix every error. Keep warnings visible in the user summary. Confirm repeated updates do not duplicate sections. Never claim the repository is secret-free; state only which checks ran.
```

- [ ] **Step 6: Regenerate OpenAI metadata and remove generated leftovers**

Run:

```bash
python3 /Users/napatrungruangbangchan/.codex/skills/.system/skill-creator/scripts/generate_openai_yaml.py handoff-pack \
  --interface display_name="Handoff Pack" \
  --interface short_description="Create and validate evidence-based HANDOFF.md files" \
  --interface default_prompt='Use $handoff-pack to prepare an evidence-based HANDOFF.md for the current project.'
chmod +x handoff-pack/scripts/collect_repo_state.py handoff-pack/scripts/validate_handoff.py
```

Remove only unused initializer-generated examples if any exist. Do not create an assets directory or skill-local README.

- [ ] **Step 7: Run contract and skill validators to verify GREEN**

Run:

```bash
python3 -m unittest discover -s tests -p 'test_handoff_pack.py' -v
python3 /Users/napatrungruangbangchan/.codex/skills/.system/skill-creator/scripts/quick_validate.py handoff-pack
python3 scripts/validate_skill.py handoff-pack
wc -l handoff-pack/SKILL.md
```

Expected: all tests pass; both validators report success; `SKILL.md` is below 500 lines.

- [ ] **Step 8: Commit the completed runtime skill contract**

```bash
git add handoff-pack/SKILL.md handoff-pack/agents/openai.yaml handoff-pack/references handoff-pack/scripts tests/test_handoff_pack.py
git commit -m "Add portable handoff pack skill"
```

---

### Task 4: Multi-host Documentation and Behavioral Forward Test

**Files:**
- Modify: `README.md`
- Modify when a behavioral gap is proven: `handoff-pack/SKILL.md`
- Modify when a behavioral gap is proven: `handoff-pack/references/*.md`
- Modify: `tests/test_handoff_pack.py`

**Interfaces:**
- Consumes: canonical `handoff-pack/` folder
- Produces: documented install paths for ChatGPT/Codex, Claude Code, Gemini CLI, and Antigravity
- Produces: a fresh-agent-created and validator-accepted temporary `HANDOFF.md`

- [ ] **Step 1: Add failing README portability test**

Append:

```python
class RepositoryDocumentationTests(unittest.TestCase):
    def test_readme_documents_supported_hosts_and_paths(self) -> None:
        text = (ROOT / "README.md").read_text(encoding="utf-8")
        for host in ("ChatGPT", "Codex", "Claude Code", "Gemini CLI", "Antigravity"):
            self.assertIn(host, text)
        for path in (".agents/skills", ".claude/skills", ".gemini/skills"):
            self.assertIn(path, text)
        for prompt in ("Prepare a handoff", "เตรียม handoff", "Audit the existing handoff", "ตรวจสอบ handoff"):
            self.assertIn(prompt, text)
        for scenario in ("CI fix", "Repository unavailable", "Dirty working tree", "Read-only audit"):
            self.assertIn(scenario, text)
```

- [ ] **Step 2: Run the README test to verify RED**

Run:

```bash
python3 -m unittest discover -s tests -p 'test_handoff_pack.py' -v
```

Expected: only `RepositoryDocumentationTests` fails because the existing README is Codex-only.

- [ ] **Step 3: Update root documentation**

Change the repository description from Codex-only to portable Agent Skills. Add `handoff-pack` to the catalog and document:

```markdown
## Supported Hosts

| Host | User scope | Project scope |
| --- | --- | --- |
| ChatGPT/Codex | `~/.agents/skills/handoff-pack` | `<repo>/.agents/skills/handoff-pack` |
| Claude Code | `~/.claude/skills/handoff-pack` | `<repo>/.claude/skills/handoff-pack` |
| Gemini CLI | `~/.agents/skills/handoff-pack` or `~/.gemini/skills/handoff-pack` | `<repo>/.agents/skills/handoff-pack` or `<repo>/.gemini/skills/handoff-pack` |
| Antigravity | platform global skills directory when configured | `<repo>/.agents/skills/handoff-pack` |

Keep one canonical folder; copy or symlink it into the host's discovered path. `agents/openai.yaml` is optional ChatGPT/Codex metadata and does not fork the skill workflow.

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
```

Update generic install loops and headings so they describe Agent Skills while retaining existing Codex instructions where still accurate. Do not add a skill-local README.

- [ ] **Step 4: Run all repository tests**

Run:

```bash
python3 -m unittest discover -s tests -p 'test_handoff_pack.py' -v
python3 scripts/validate_skill.py --all
```

Expected: all tests pass and every top-level skill validates.

- [ ] **Step 5: Forward-test normal dirty-repository handoff with the skill**

Create a fresh temporary Git repository containing a baseline commit, one staged file, one unstaged edit, and one untracked file. Store its resolved path as `HANDOFF_FORWARD_REPO`. Dispatch a fresh agent with only the raw repository and this prompt after replacing the shell variable with its value:

```text
Use $handoff-pack at /Users/napatrungruangbangchan/workdir/napat/skills/handoff-pack to prepare this temporary branch for another developer. Create HANDOFF.md in ${HANDOFF_FORWARD_REPO}, do not commit or push, and use English.
```

Do not give the agent the expected output, suspected gaps, baseline report, or design conclusions. After it finishes, run:

```bash
python3 handoff-pack/scripts/validate_handoff.py "${HANDOFF_FORWARD_REPO}/HANDOFF.md" --json
```

Expected: exit `0`; all 18 sections exist; staged, unstaged, and untracked work is distinguished; the starter prompt is project-specific; no commit/push claim appears.

- [ ] **Step 6: Forward-test idempotent update and read-only audit**

Dispatch a fresh receiving agent against the same raw repository and existing handoff:

```text
Use $handoff-pack at /Users/napatrungruangbangchan/workdir/napat/skills/handoff-pack to update the existing HANDOFF.md in ${HANDOFF_FORWARD_REPO} after a local validation failure. Preserve useful decisions, record the failure accurately, and do not commit or push.
```

Validate again, then count each `## <number>.` heading and confirm every number appears exactly once. Record the file hash. Dispatch a separate audit request:

```text
Use $handoff-pack at /Users/napatrungruangbangchan/workdir/napat/skills/handoff-pack to audit HANDOFF.md in ${HANDOFF_FORWARD_REPO} read-only and report whether it is ready. Do not edit any file.
```

Recalculate the file hash. Expected: update validates without duplicated sections; audit reports prioritized findings and leaves the hash unchanged.

- [ ] **Step 7: Close only observed behavioral gaps**

Before closing the forward-test gate, create a separate non-Git temporary directory containing only user notes, store its resolved path as `HANDOFF_THAI_NON_GIT_DIR`, and dispatch a fresh agent with this Thai prompt after replacing the variable with its value:

```text
Use $handoff-pack at /Users/napatrungruangbangchan/workdir/napat/skills/handoff-pack to create HANDOFF.md from the supplied notes in ${HANDOFF_THAI_NON_GIT_DIR}. The repository is unavailable. Write the handoff in Thai, mark Git facts unavailable, and do not invent files or test results.
```

Run the validator on the resulting file. Expected: exit `0` with allowed non-Git/unknown warnings, Thai title and heading aliases, user-reported context separated from verified state, and no fabricated branch, commit, file, or test claim.

If a forward test fails, first add a focused failing assertion to `tests/test_handoff_pack.py` or a repeatable temporary-repo check. Then minimally patch `SKILL.md` or the directly relevant reference, rerun the failed scenario, and rerun all tests. Do not add speculative instructions.

- [ ] **Step 8: Commit documentation and any evidence-driven refinement**

```bash
git add README.md tests/test_handoff_pack.py handoff-pack/SKILL.md handoff-pack/references
git commit -m "Document handoff pack across agent hosts"
```

If no skill/reference refinement was needed, stage only `README.md` and the test file.

---

### Task 5: Package, Verify, and Publish

**Files:**
- Read/verify: all files from Tasks 1–4
- Create outside repository: the `skill.zip` path under the directory returned by `mktemp -d`
- Modify repository only if verification proves a defect; apply TDD before fixing

**Interfaces:**
- Consumes: committed `handoff-pack/` tree at `HEAD`
- Produces: `skill.zip` with `handoff-pack/` as its only top-level directory
- Produces: pushed `origin/main` equal to local `HEAD`

- [ ] **Step 1: Probe installed host CLIs without changing their state**

Run:

```bash
command -v codex
command -v claude
command -v gemini
command -v agy
```

For each installed command, run only `<command> --version`. Record absent tools as `Not available`. Do not install, link, authenticate, or change user-level skill configuration. Treat these probes separately from structural compatibility.

- [ ] **Step 2: Run the complete fresh verification suite**

Run:

```bash
python3 -m unittest discover -s tests -p 'test_handoff_pack.py' -v
python3 /Users/napatrungruangbangchan/.codex/skills/.system/skill-creator/scripts/quick_validate.py handoff-pack
python3 scripts/validate_skill.py --all
python3 handoff-pack/scripts/collect_repo_state.py --path . --recent-commits 3
git diff --check
git status --short --branch
```

Expected: all tests and validators pass, collector emits safe JSON, diff check is clean, and no unrelated changes exist.

- [ ] **Step 3: Commit any remaining intended files before packaging**

If the implementation plan itself is the only intended unpushed pre-existing commit and Tasks 1–4 are already committed, do not create an empty commit. Otherwise stage exact intended paths, inspect `git diff --cached`, and commit with a specific message. Confirm:

```bash
git status --short --branch
```

Expected: clean working tree and local `main` ahead of `origin/main` only by the reviewed handoff-pack commits.

- [ ] **Step 4: Build `skill.zip` from committed runtime files**

Create a temporary package root and store its resolved path in `HANDOFF_PACKAGE_ROOT`:

```bash
HANDOFF_PACKAGE_ROOT=$(mktemp -d)
git archive --format=tar --prefix=handoff-pack/ --output="${HANDOFF_PACKAGE_ROOT}/staging.tar" HEAD:handoff-pack
mkdir "${HANDOFF_PACKAGE_ROOT}/staging"
tar -xf "${HANDOFF_PACKAGE_ROOT}/staging.tar" -C "${HANDOFF_PACKAGE_ROOT}/staging"
```

Validate the staged `handoff-pack/`, then create the ZIP directly from the same committed tree:

```bash
python3 /Users/napatrungruangbangchan/.codex/skills/.system/skill-creator/scripts/quick_validate.py "${HANDOFF_PACKAGE_ROOT}/staging/handoff-pack"
git archive --format=zip --prefix=handoff-pack/ --output="${HANDOFF_PACKAGE_ROOT}/skill.zip" HEAD:handoff-pack
python3 -m zipfile -l "${HANDOFF_PACKAGE_ROOT}/skill.zip"
```

Expected: archive name is exactly `skill.zip`; every entry is under `handoff-pack/`; no `__pycache__`, test file, root documentation, design, plan, secret file, or generated repository artifact is present.

- [ ] **Step 5: Extract and revalidate the package**

Create an extraction directory, then run:

```bash
mkdir "${HANDOFF_PACKAGE_ROOT}/extracted"
python3 -m zipfile -e "${HANDOFF_PACKAGE_ROOT}/skill.zip" "${HANDOFF_PACKAGE_ROOT}/extracted"
python3 /Users/napatrungruangbangchan/.codex/skills/.system/skill-creator/scripts/quick_validate.py "${HANDOFF_PACKAGE_ROOT}/extracted/handoff-pack"
python3 "${HANDOFF_PACKAGE_ROOT}/extracted/handoff-pack/scripts/collect_repo_state.py" --path "${HANDOFF_PACKAGE_ROOT}/extracted" --recent-commits 0
python3 "${HANDOFF_PACKAGE_ROOT}/extracted/handoff-pack/scripts/validate_handoff.py" --help
```

Expected: extracted skill validates, collector returns valid non-Git JSON, validator help exits `0`, and the archive remains outside the repository.

- [ ] **Step 6: Check remote drift and fast-forward safety**

Run:

```bash
git fetch origin
git rev-list --left-right --count origin/main...HEAD
git merge-base --is-ancestor origin/main HEAD
git status --short --branch
```

Expected: behind count is `0`, `origin/main` is an ancestor of `HEAD`, and the working tree is clean. If remote `main` advanced, stop; inspect and integrate safely without force-pushing.

- [ ] **Step 7: Push the explicitly authorized final commits**

Run:

```bash
git push origin main
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
```

Expected: push succeeds and the two final SHAs are identical. Never force-push.

- [ ] **Step 8: Final handoff to the user**

Report:

- pushed branch and final commit SHA
- source files added or updated
- collector, validator, unit, static-contract, forward-test, extracted-package, and repo-validator results separately
- installed-host CLI probes separately from documented structural compatibility
- important safety boundaries
- exact example invocations in Thai and English
- clickable absolute path to `${HANDOFF_PACKAGE_ROOT}/skill.zip`, resolved to its actual value

Do not claim a host-native runtime test passed for any CLI that was absent, unauthenticated, or only version-probed.
