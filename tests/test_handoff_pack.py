from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock


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

    def test_run_git_disables_lazy_fetch_and_optional_locks(self) -> None:
        module = load_script(COLLECTOR, "handoff_pack_collector_git_environment")
        completed = subprocess.CompletedProcess(["git"], 0, stdout="", stderr="")
        with mock.patch.object(module.subprocess, "run", return_value=completed) as mocked:
            module.run_git(Path("repository"), ["status"])
        environment = mocked.call_args.kwargs["env"]
        self.assertEqual(environment["GIT_NO_LAZY_FETCH"], "1")
        self.assertEqual(environment["GIT_OPTIONAL_LOCKS"], "0")

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

    def test_one_letter_scheme_remote_credentials_are_removed(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            repo = Path(raw)
            init_repo(repo)
            git(
                repo,
                "remote",
                "add",
                "origin",
                "x://user:fake-password@example.invalid/repo.git",
            )
            result = run_collector(repo)
        self.assertEqual(result.returncode, 0, result.stderr)
        remote_text = json.dumps(json.loads(result.stdout)["remotes"])
        self.assertIn("x://example.invalid/repo.git", remote_text)
        self.assertNotIn("user:", remote_text)
        self.assertNotIn("fake-password", remote_text)

    def test_scp_remote_userinfo_query_and_fragment_are_removed(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            repo = Path(raw)
            init_repo(repo)
            git(
                repo,
                "remote",
                "add",
                "origin",
                "git@example.invalid:org/repo.git?token=fake-value#part",
            )
            result = run_collector(repo)
        self.assertEqual(result.returncode, 0, result.stderr)
        remote_text = json.dumps(json.loads(result.stdout)["remotes"])
        self.assertIn("example.invalid:org/repo.git", remote_text)
        self.assertNotIn("git@", remote_text)
        self.assertNotIn("fake-value", remote_text)
        self.assertNotIn("#part", remote_text)

    def test_absolute_local_remote_with_at_sign_is_preserved(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            base = Path(raw)
            remote = base / "owner@example.invalid" / "remote.git"
            remote.mkdir(parents=True)
            git(remote, "init", "--bare")
            repo = base / "repo"
            repo.mkdir()
            init_repo(repo)
            git(repo, "remote", "add", "origin", str(remote))
            result = run_collector(repo)
        self.assertEqual(result.returncode, 0, result.stderr)
        remotes = json.loads(result.stdout)["remotes"]
        self.assertEqual(remotes[0]["fetch_urls"], [str(remote)])
        self.assertEqual(remotes[0]["push_urls"], [str(remote)])

    def test_bare_relative_local_remote_with_at_sign_is_preserved(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            repo = Path(raw)
            init_repo(repo)
            remote = repo / "owner@example.invalid" / "remote.git"
            remote.mkdir(parents=True)
            git(remote, "init", "--bare")
            configured_remote = "owner@example.invalid/remote.git"
            git(repo, "remote", "add", "origin", configured_remote)
            result = run_collector(repo)
        self.assertEqual(result.returncode, 0, result.stderr)
        remotes = json.loads(result.stdout)["remotes"]
        self.assertEqual(remotes[0]["fetch_urls"], [configured_remote])
        self.assertEqual(remotes[0]["push_urls"], [configured_remote])

    def test_relative_local_path_with_scp_like_suffix_is_preserved(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            repo = Path(raw)
            init_repo(repo)
            configured_remote = "folder/git@example.invalid:remote.git"
            remote = repo / "folder" / "git@example.invalid:remote.git"
            remote.mkdir(parents=True)
            git(remote, "init", "--bare")
            git(repo, "remote", "add", "origin", configured_remote)
            result = run_collector(repo)
        self.assertEqual(result.returncode, 0, result.stderr)
        remotes = json.loads(result.stdout)["remotes"]
        self.assertEqual(remotes[0]["fetch_urls"], [configured_remote])
        self.assertEqual(remotes[0]["push_urls"], [configured_remote])

    def test_windows_drive_relative_remote_with_at_sign_is_preserved(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            repo = Path(raw)
            init_repo(repo)
            configured_remote = "C:owner@example.invalid\\remote.git"
            git(repo, "remote", "add", "origin", configured_remote)
            result = run_collector(repo)
        self.assertEqual(result.returncode, 0, result.stderr)
        remotes = json.loads(result.stdout)["remotes"]
        self.assertEqual(remotes[0]["fetch_urls"], [configured_remote])
        self.assertEqual(remotes[0]["push_urls"], [configured_remote])

    def test_explicit_local_remote_path_forms_are_recognized(self) -> None:
        module = load_script(COLLECTOR, "handoff_pack_collector_local_paths")
        local_paths = (
            "/tmp/owner@example.invalid/repo.git",
            "./owner@example.invalid/repo.git",
            "../owner@example.invalid/repo.git",
            "C:\\owner@example.invalid\\repo.git",
            "C:/owner@example.invalid/repo.git",
            "\\\\server\\owner@example.invalid\\repo.git",
            "//server/owner@example.invalid/repo.git",
            "owner@example.invalid/remote.git",
            "\\owner@example.invalid\\remote.git",
            "C:folder\\owner@example.invalid\\remote.git",
            "C:owner@example.invalid\\remote.git",
        )
        for remote in local_paths:
            with self.subTest(remote=remote):
                self.assertTrue(module._is_local_filesystem_remote(remote))
                self.assertEqual(module.sanitize_remote_url(remote), remote)

    def test_malformed_remote_returns_sanitized_execution_failure(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            repo = Path(raw)
            init_repo(repo)
            git(
                repo,
                "remote",
                "add",
                "origin",
                "https://user:fake-value@example.invalid:notaport/org/repo.git",
            )
            result = run_collector(repo)
        self.assertEqual(result.returncode, 3)
        self.assertEqual(result.stdout, "")
        self.assertEqual(
            result.stderr,
            "collect_repo_state: repository state collection failed\n",
        )
        self.assertNotIn("Traceback", result.stderr)
        self.assertNotIn("fake-value", result.stderr)

    def test_ambiguous_scheme_less_remote_fails_without_secret_echo(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            repo = Path(raw)
            init_repo(repo)
            git(
                repo,
                "remote",
                "add",
                "origin",
                "user:fake-password@example.invalid/org/repo.git",
            )
            result = run_collector(repo)
        self.assertEqual(result.returncode, 3)
        self.assertEqual(result.stdout, "")
        self.assertEqual(
            result.stderr,
            "collect_repo_state: repository state collection failed\n",
        )
        self.assertNotIn("Traceback", result.stderr)
        self.assertNotIn("fake-password", result.stderr)

    def test_newline_bearing_remote_fails_without_secret_echo(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            repo = Path(raw)
            init_repo(repo)
            git(
                repo,
                "remote",
                "add",
                "origin",
                "https://example.invalid/org/repo.git\nsecret=fake-token",
            )
            result = run_collector(repo)
        self.assertEqual(result.returncode, 3)
        self.assertEqual(result.stdout, "")
        self.assertEqual(
            result.stderr,
            "collect_repo_state: repository state collection failed\n",
        )
        self.assertNotIn("Traceback", result.stderr)
        self.assertNotIn("fake-token", result.stderr)

    def test_invalid_git_marker_is_an_execution_failure(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            apparent_root = Path(raw)
            (apparent_root / ".git").mkdir()
            nested = apparent_root / "nested"
            nested.mkdir()
            result = run_collector(nested)
        self.assertEqual(result.returncode, 3)
        self.assertEqual(result.stdout, "")
        self.assertEqual(
            result.stderr,
            "collect_repo_state: repository state collection failed\n",
        )
        self.assertNotIn("Traceback", result.stderr)

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

    def test_prefixed_secret_assignments_are_errors_without_echo(self) -> None:
        assignments = {
            "OPENAI_API_KEY": "fake-openai-value-that-must-not-be-echoed",
            "DB_PASSWORD": "fake-database-value-that-must-not-be-echoed",
            "OAUTH_CLIENT_SECRET": "fake-oauth-value-that-must-not-be-echoed",
        }
        for name, value in assignments.items():
            with self.subTest(name=name):
                content = valid_handoff().replace(
                    "- Verified content.", f"- {name} = {value}", 1
                )
                result = self.validate_content(content, "--json")
                data = json.loads(result.stdout)
                self.assertEqual(result.returncode, 1)
                self.assertIn("secret-value", {item["code"] for item in data["errors"]})
                self.assertNotIn(value, result.stdout)

    def test_bare_and_redacted_prefixed_secret_names_are_allowed(self) -> None:
        safe_values = "\n".join(
            [
                "- Required variables: `OPENAI_API_KEY`, `DB_PASSWORD`, `OAUTH_CLIENT_SECRET`",
                "- OPENAI_API_KEY = [REDACTED]",
                "- DB_PASSWORD: <redacted>",
                "- OAUTH_CLIENT_SECRET=${OAUTH_CLIENT_SECRET}",
                "- API_KEY=$API_KEY",
                "- SECRET=[NEEDS INPUT: provision securely]",
            ]
        )
        content = valid_handoff().replace("- Verified content.", safe_values, 1)
        result = self.validate_content(content, "--json")
        data = json.loads(result.stdout)
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertNotIn("secret-value", {item["code"] for item in data["errors"]})

    def test_generic_credential_urls_are_errors_without_echo(self) -> None:
        urls = {
            "token-only": "https://fake-token-only-that-must-not-be-echoed@example.invalid/repo.git",
            "empty-username": "https://:fake-empty-user-password@example.invalid/repo.git",
            "database": "postgresql://dbuser:fake-database-password@example.invalid/app",
            "sensitive-query": "https://example.invalid/repo?token=fake-query-value-that-must-not-be-echoed",
        }
        for name, url in urls.items():
            with self.subTest(name=name):
                content = valid_handoff().replace("- Verified content.", f"- {url}", 1)
                result = self.validate_content(content, "--json")
                data = json.loads(result.stdout)
                self.assertEqual(result.returncode, 1)
                self.assertIn("credential-url", {item["code"] for item in data["errors"]})
                self.assertNotIn(url, result.stdout)

    def test_common_vcs_userinfo_is_not_a_credential(self) -> None:
        content = valid_handoff().replace(
            "- Verified content.", "- Read-only remote: `ssh://git@example.invalid/repo.git`", 1
        )
        result = self.validate_content(content, "--json")
        data = json.loads(result.stdout)
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertNotIn("credential-url", {item["code"] for item in data["errors"]})

    def test_validation_table_contract_and_escaped_pipes(self) -> None:
        table = (
            "| Command | Working Directory | Status | Result |\n"
            "| --- | --- | --- | --- |\n"
            "| `python3 -m unittest` | `.` | Passed | 12 tests passed |"
        )
        invalid_tables = {
            "prose-only": "- Tests reportedly passed.",
            "header-only": (
                "| Command | Working Directory | Status | Result |\n"
                "| --- | --- | --- | --- |"
            ),
            "wrong-header": (
                "| Invocation | Working Directory | Status | Result |\n"
                "| --- | --- | --- | --- |\n"
                "| `python3 -m unittest` | `.` | Passed | 12 tests passed |"
            ),
            "three-columns": (
                "| Command | Status | Result |\n"
                "| --- | --- | --- |\n"
                "| `python3 -m unittest` | Passed | 12 tests passed |"
            ),
            "bad-separator": (
                "| Command | Working Directory | Status | Result |\n"
                "| --- | not-a-separator | --- | --- |\n"
                "| `python3 -m unittest` | `.` | Passed | 12 tests passed |"
            ),
            "detached-data-row": (
                "| Command | Working Directory | Status | Result |\n"
                "| --- | --- | --- | --- |\n"
                "Narrative text interrupts the table.\n"
                "| `python3 -m unittest` | `.` | Passed | 12 tests passed |"
            ),
        }
        for name, replacement in invalid_tables.items():
            with self.subTest(name=name):
                content = valid_handoff().replace(table, replacement)
                result = self.validate_content(content, "--json")
                codes = {item["code"] for item in json.loads(result.stdout)["errors"]}
                self.assertEqual(result.returncode, 1)
                self.assertIn("invalid-test-status", codes)

        escaped_pipe = valid_handoff().replace(
            "`python3 -m unittest`", "`printf 'left\\|right'`"
        )
        thai_table = valid_handoff().replace(
            "| Command | Working Directory | Status | Result |",
            "| คำสั่ง | ไดเรกทอรีทำงาน | สถานะ | ผลลัพธ์ |",
        )
        self.assertEqual(self.validate_content(escaped_pipe).returncode, 0)
        self.assertEqual(self.validate_content(thai_table).returncode, 0)

    def test_fenced_content_cannot_satisfy_content_gates(self) -> None:
        content = valid_handoff()
        content = content.replace(
            (
                "| Command | Working Directory | Status | Result |\n"
                "| --- | --- | --- | --- |\n"
                "| `python3 -m unittest` | `.` | Passed | 12 tests passed |"
            ),
            (
                "```markdown\n"
                "| Command | Working Directory | Status | Result |\n"
                "| --- | --- | --- | --- |\n"
                "| `python3 -m unittest` | `.` | Passed | 12 tests passed |\n"
                "```\nNo visible validation evidence yet."
            ),
        )
        content = content.replace(
            "1. Re-run `python3 -m unittest` and continue in `app.py`; expected outcome: green baseline; blocker: none.",
            "```text\n1. Hidden next action\n```\nNo visible ordered action yet.",
        )
        content = content.replace(
            "1. Checkout `main`.\n2. Confirm the HEAD commit.\n3. Read `AGENTS.md` when present.\n4. Run `python3 -m unittest`.",
            "```text\n1. Hidden step\n2. Hidden step\n3. Hidden step\n```\nNo visible restart steps yet.",
        )
        content = content.replace(
            "Read `AGENTS.md` when present and `HANDOFF.md`. Verify the branch, commit, working tree, and tests. Start with Recommended Next Actions, validate changes, and report discrepancies because this handoff may be stale.",
            "```text\nRead HANDOFF.md, verify the branch, and validate changes.\n```\nPrompt pending.",
        )
        content = content.replace(
            "\n".join(["- [x] Verified item"] * 11),
            "```markdown\n" + "\n".join(["- [x] Hidden item"] * 11) + "\n```\nChecklist pending.",
        )
        result = self.validate_content(content, "--json")
        codes = {item["code"] for item in json.loads(result.stdout)["errors"]}
        self.assertEqual(result.returncode, 1)
        self.assertTrue(
            {
                "invalid-test-status",
                "next-actions",
                "restart-instructions",
                "starter-prompt",
                "final-checklist",
            }.issubset(codes),
            codes,
        )

    def test_fenced_metadata_examples_are_ignored(self) -> None:
        content = valid_handoff().replace(
            "- HEAD commit: `0123456789abcdef0123456789abcdef01234567`",
            (
                "- HEAD commit: `0123456789abcdef0123456789abcdef01234567`\n\n"
                "```text\n"
                "- Current branch: `bad branch`\n"
                "- HEAD commit: `not-a-commit`\n"
                "```"
            ),
        )
        result = self.validate_content(content, "--json")
        codes = {item["code"] for item in json.loads(result.stdout)["errors"]}
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertNotIn("invalid-branch", codes)
        self.assertNotIn("invalid-commit", codes)

    def test_fenced_secrets_are_still_scanned_without_echo(self) -> None:
        value = "fake-fenced-secret-that-must-not-be-echoed"
        content = valid_handoff().replace(
            "- Verified content.",
            f"```text\nOPENAI_API_KEY={value}\n```\n- Example remains redacted in prose.",
            1,
        )
        result = self.validate_content(content, "--json")
        codes = {item["code"] for item in json.loads(result.stdout)["errors"]}
        self.assertEqual(result.returncode, 1)
        self.assertIn("secret-value", codes)
        self.assertNotIn(value, result.stdout)

    def test_sensitive_assignment_suffixes_are_errors_without_echo(self) -> None:
        assignments = {
            "GITHUB_TOKEN": "fake-github-value-that-must-not-be-echoed",
            "AWS_SECRET_ACCESS_KEY": "fake-aws-value-that-must-not-be-echoed",
            "SESSION_COOKIE": "fake-cookie-value-that-must-not-be-echoed",
            "AWS_SESSION_TOKEN": "fake-session-value-that-must-not-be-echoed",
            "SECRET_KEY": "fake-secret-key-value-that-must-not-be-echoed",
            "PRIVATE_KEY": "fake-private-key-value-that-must-not-be-echoed",
        }
        for name, value in assignments.items():
            with self.subTest(name=name):
                content = valid_handoff().replace(
                    "- Verified content.", f"- {name} = {value}", 1
                )
                result = self.validate_content(content, "--json")
                codes = {item["code"] for item in json.loads(result.stdout)["errors"]}
                self.assertEqual(result.returncode, 1)
                self.assertIn("secret-value", codes)
                self.assertNotIn(value, result.stdout)

    def test_assignment_classifier_avoids_unrelated_and_placeholder_values(self) -> None:
        safe_content = "\n".join(
            [
                "- TOKEN_COUNT=7",
                "- PUBLIC_KEY=public-material",
                "- Bare names: `GITHUB_TOKEN`, `AWS_SECRET_ACCESS_KEY`, `SESSION_COOKIE`, `PRIVATE_KEY`",
                "- GITHUB_TOKEN=[REDACTED]",
                "- AWS_SECRET_ACCESS_KEY=<redacted>",
                "- SESSION_COOKIE=${SESSION_COOKIE}",
                "- AWS_SESSION_TOKEN=$AWS_SESSION_TOKEN",
                "- SECRET_KEY=[NEEDS INPUT: provision securely]",
                "- PRIVATE_KEY=REDACTED",
            ]
        )
        content = valid_handoff().replace("- Verified content.", safe_content, 1)
        result = self.validate_content(content, "--json")
        codes = {item["code"] for item in json.loads(result.stdout)["errors"]}
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertNotIn("secret-value", codes)

    def test_fenced_gaps_cannot_make_validation_table_contiguous(self) -> None:
        table = (
            "| Command | Working Directory | Status | Result |\n"
            "| --- | --- | --- | --- |\n"
            "| `python3 -m unittest` | `.` | Passed | 12 tests passed |"
        )
        gap_after_header = (
            "| Command | Working Directory | Status | Result |\n"
            "```text\nignored example\n```\n"
            "| --- | --- | --- | --- |\n"
            "| `python3 -m unittest` | `.` | Passed | 12 tests passed |"
        )
        gap_after_separator = (
            "| Command | Working Directory | Status | Result |\n"
            "| --- | --- | --- | --- |\n"
            "```text\nignored example\n```\n"
            "| `python3 -m unittest` | `.` | Passed | 12 tests passed |"
        )
        for name, replacement in {
            "header-separator": gap_after_header,
            "separator-first-row": gap_after_separator,
        }.items():
            with self.subTest(name=name):
                result = self.validate_content(
                    valid_handoff().replace(table, replacement), "--json"
                )
                codes = {item["code"] for item in json.loads(result.stdout)["errors"]}
                self.assertEqual(result.returncode, 1)
                self.assertIn("invalid-test-status", codes)

        fence_after_row = table + (
            "\n```text\n| hidden | table | row | ignored |\n```\n"
            "Visible explanation after the complete table."
        )
        self.assertEqual(
            self.validate_content(valid_handoff().replace(table, fence_after_row)).returncode,
            0,
        )

    def test_language_tagged_inner_fence_line_does_not_close_outer_fence(self) -> None:
        fenced_examples = (
            "```markdown\n"
            "```python\n"
            "- Current branch: `bad branch`\n"
            "- HEAD commit: `not-a-commit`\n"
            "```\n"
            "~~~python\n"
            "- Current branch: `another bad branch`\n"
            "~~~\n"
            "- Verified content."
        )
        content = valid_handoff().replace("- Verified content.", fenced_examples, 1)
        result = self.validate_content(content, "--json")
        codes = {item["code"] for item in json.loads(result.stdout)["errors"]}
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertNotIn("invalid-branch", codes)
        self.assertNotIn("invalid-commit", codes)
        self.assertNotIn("unbalanced-fence", codes)

    def test_needs_input_inside_fence_warns_and_strict_fails(self) -> None:
        content = valid_handoff().replace(
            "- Verified content.",
            "```text\n[NEEDS INPUT: confirm external state]\n```\n- Verified content.",
            1,
        )
        normal = self.validate_content(content, "--json")
        strict = self.validate_content(content, "--json", "--strict")
        warnings = {item["code"] for item in json.loads(normal.stdout)["warnings"]}
        self.assertEqual(normal.returncode, 0, normal.stdout)
        self.assertIn("needs-input", warnings)
        self.assertEqual(strict.returncode, 1, strict.stdout)


if __name__ == "__main__":
    unittest.main()
