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


if __name__ == "__main__":
    unittest.main()
