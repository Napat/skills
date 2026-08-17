#!/usr/bin/env python3
"""Collect sanitized, read-only repository state as versioned JSON."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from typing import Sequence
import urllib.parse


SCHEMA_VERSION = 1
DEFAULT_RECENT_COMMITS = 10
MAX_RECENT_COMMITS = 100


class CollectorError(RuntimeError):
    """Raised when repository discovery succeeded but collection cannot continue."""


def _has_explicit_uri_scheme(value: str) -> bool:
    return bool(re.match(r"^[A-Za-z][A-Za-z0-9+.-]*://", value))


def _sanitized_scp_remote(value: str) -> str | None:
    host_start = value.rfind("@") + 1
    separator_index = value.find(":", host_start)
    if separator_index < 0:
        return None
    if any(
        path_separator in value[:separator_index]
        for path_separator in ("/", "\\")
    ):
        return None
    host = value[host_start:separator_index]
    remote_path = value[separator_index + 1 :]
    if not host or not remote_path or any(character.isspace() for character in host):
        return None
    return value[host_start:]


def _is_local_filesystem_remote(value: str) -> bool:
    if _has_explicit_uri_scheme(value):
        return False
    if value.startswith(("/", "./", "../", "\\\\")) or re.match(
        r"^[A-Za-z]:[\\/]", value
    ):
        return True
    if re.match(r"^[A-Za-z]:", value) and (
        "\\" in value or (os.name == "nt" and "/" in value)
    ):
        return True
    if "@" not in value:
        return False
    prefix, _ = value.rsplit("@", 1)
    if _sanitized_scp_remote(value) is not None:
        return False
    return ":" not in prefix or "/" in prefix or "\\" in prefix


def sanitize_remote_url(value: str) -> str:
    """Remove credentials, queries, and fragments from a Git remote URL."""

    if "\r" in value or "\n" in value:
        raise CollectorError("Remote URL contains an unsafe line break")
    value = value.strip().split("?", 1)[0].split("#", 1)[0]
    if _is_local_filesystem_remote(value):
        return value
    if not _has_explicit_uri_scheme(value):
        if "@" in value:
            sanitized_scp = _sanitized_scp_remote(value)
            if sanitized_scp is not None:
                return sanitized_scp
            raise CollectorError("Scheme-less remote URL is ambiguous")
        return value
    try:
        parsed = urllib.parse.urlsplit(value)
        hostname = parsed.hostname or ""
        port = parsed.port
    except ValueError as exc:
        raise CollectorError("Remote URL could not be sanitized") from exc
    if ":" in hostname and not hostname.startswith("["):
        hostname = f"[{hostname}]"
    if port is not None:
        hostname = f"{hostname}:{port}"
    return urllib.parse.urlunsplit((parsed.scheme, hostname, parsed.path, "", ""))


def run_git(
    path: Path,
    args: Sequence[str],
    *,
    check: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Run Git without a shell and without exposing command output in errors."""

    environment = os.environ.copy()
    environment.update({"GIT_NO_LAZY_FETCH": "1", "GIT_OPTIONAL_LOCKS": "0"})
    try:
        return subprocess.run(
            ["git", "-C", str(path), *args],
            text=True,
            encoding="utf-8",
            errors="replace",
            capture_output=True,
            check=check,
            env=environment,
        )
    except (OSError, subprocess.CalledProcessError) as exc:
        raise CollectorError("Git could not collect the requested repository state") from exc


def parse_name_status(raw: str, source: str) -> list[dict[str, str]]:
    """Parse NUL-delimited output from ``git diff --name-status -z``."""

    tokens = raw.split("\0")
    if tokens and tokens[-1] == "":
        tokens.pop()

    records: list[dict[str, str]] = []
    index = 0
    while index < len(tokens):
        status_token = tokens[index]
        index += 1
        inline_path: str | None = None
        if "\t" in status_token:
            status_token, inline_path = status_token.split("\t", 1)
        if not status_token:
            raise CollectorError("Git returned malformed path status data")

        if status_token.startswith(("R", "C")):
            if inline_path is None:
                if index >= len(tokens):
                    raise CollectorError("Git returned incomplete rename status data")
                old_path = tokens[index]
                index += 1
            else:
                old_path = inline_path
            if index >= len(tokens):
                raise CollectorError("Git returned incomplete rename status data")
            path = tokens[index]
            index += 1
            records.append(
                {
                    "path": path,
                    "old_path": old_path,
                    "status": status_token,
                    "source": source,
                }
            )
            continue

        if inline_path is None:
            if index >= len(tokens):
                raise CollectorError("Git returned incomplete path status data")
            path = tokens[index]
            index += 1
        else:
            path = inline_path
        records.append({"path": path, "status": status_token, "source": source})

    return records


def _empty_state(path: Path) -> dict[str, object]:
    return {
        "schema_version": SCHEMA_VERSION,
        "collected_at": datetime.now(timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z"),
        "requested_path": str(path),
        "working_directory": str(path.resolve()),
        "git_available": False,
        "repository_root": None,
        "head": {
            "branch": None,
            "detached": False,
            "commit": None,
            "short_commit": None,
            "subject": None,
        },
        "upstream": {
            "name": None,
            "ahead": None,
            "behind": None,
            "reason": "not available",
        },
        "remotes": [],
        "working_tree": {
            "clean": True,
            "staged": [],
            "unstaged": [],
            "untracked": [],
            "deleted": [],
            "renamed": [],
        },
        "diff_stats": {"staged": "", "unstaged": ""},
        "operation_state": {
            "merge": False,
            "rebase": False,
            "cherry_pick": False,
            "revert": False,
            "bisect": False,
        },
        "recent_commits": [],
        "submodules": [],
        "warnings": [],
    }


def _required_git(path: Path, args: Sequence[str]) -> subprocess.CompletedProcess[str]:
    result = run_git(path, args)
    if result.returncode != 0:
        raise CollectorError("Git could not collect the requested repository state")
    return result


def _optional_git(path: Path, args: Sequence[str]) -> subprocess.CompletedProcess[str] | None:
    result = run_git(path, args)
    return result if result.returncode == 0 else None


def _unique_strings(values: Sequence[str]) -> list[str]:
    return list(dict.fromkeys(values))


def _has_git_marker(path: Path) -> bool:
    candidate = path.resolve()
    if not candidate.is_dir():
        candidate = candidate.parent
    for directory in (candidate, *candidate.parents):
        marker = directory / ".git"
        try:
            if marker.is_file() or marker.is_dir():
                return True
        except OSError as exc:
            raise CollectorError("Git repository marker could not be inspected") from exc
    return False


def _configured_remote_values(
    root: Path,
    key: str,
    *,
    required: bool,
) -> list[str]:
    result = run_git(root, ["config", "--null", "--get-all", key])
    if result.returncode != 0:
        if not required and result.returncode == 1 and result.stdout == "":
            return []
        raise CollectorError("Configured remote URLs could not be inspected")
    if result.stdout and not result.stdout.endswith("\0"):
        raise CollectorError("Configured remote URL records were malformed")
    values = result.stdout.split("\0")[:-1] if result.stdout else []
    if any("\r" in value or "\n" in value for value in values):
        raise CollectorError("Configured remote URL contains an unsafe line break")
    return values


def _effective_remote_values(
    result: subprocess.CompletedProcess[str],
    expected_count: int,
) -> list[str]:
    values = result.stdout.splitlines()
    if len(values) != expected_count:
        raise CollectorError("Effective remote URL record count did not match configuration")
    return values


def _collect_remotes(root: Path) -> list[dict[str, object]]:
    names = [name for name in _required_git(root, ["remote"]).stdout.splitlines() if name]
    remotes: list[dict[str, object]] = []
    for name in names:
        configured_fetch = _configured_remote_values(
            root, f"remote.{name}.url", required=True
        )
        configured_push = _configured_remote_values(
            root, f"remote.{name}.pushurl", required=False
        )
        fetch = _required_git(root, ["remote", "get-url", "--all", name])
        push = _required_git(root, ["remote", "get-url", "--push", "--all", name])
        fetch_urls = _unique_strings(
            [
                sanitize_remote_url(value)
                for value in _effective_remote_values(fetch, len(configured_fetch))
            ]
        )
        expected_push_count = len(configured_push or configured_fetch)
        push_urls = _unique_strings(
            [
                sanitize_remote_url(value)
                for value in _effective_remote_values(push, expected_push_count)
            ]
        )
        remotes.append(
            {"name": name, "fetch_urls": fetch_urls, "push_urls": push_urls}
        )
    return remotes


def _git_path_exists(root: Path, marker: str) -> bool:
    result = _required_git(root, ["rev-parse", "--git-path", marker])
    marker_path = Path(result.stdout.strip())
    if not marker_path.is_absolute():
        marker_path = root / marker_path
    return marker_path.exists()


def _collect_recent_commits(root: Path, count: int) -> list[dict[str, str]]:
    if count == 0:
        return []
    result = _optional_git(
        root,
        [f"log", f"-{count}", "--format=%H%x00%h%x00%s%x1e"],
    )
    if result is None:
        return []
    commits: list[dict[str, str]] = []
    for raw_record in result.stdout.split("\x1e"):
        record = raw_record.strip("\r\n")
        if not record:
            continue
        fields = record.split("\0", 2)
        if len(fields) != 3:
            raise CollectorError("Git returned malformed recent commit data")
        commit, short_commit, subject = fields
        commits.append(
            {
                "commit": commit,
                "short_commit": short_commit,
                "subject": subject,
            }
        )
    return commits


def _collect_submodules(root: Path, warnings: list[str]) -> list[dict[str, str]]:
    if not (root / ".gitmodules").exists():
        return []
    result = _optional_git(root, ["submodule", "status", "--recursive"])
    if result is None:
        warnings.append("Submodule status could not be determined from local state.")
        return []

    submodules: list[dict[str, str]] = []
    pattern = re.compile(
        r"^(.)([0-9a-fA-F]{40})\s+(.+?)(?:\s+\((.*)\))?$"
    )
    for line in result.stdout.splitlines():
        match = pattern.match(line)
        if match is None:
            warnings.append("One submodule status record could not be parsed.")
            continue
        state, commit, path, detail = match.groups()
        item = {"state": state, "commit": commit, "path": path}
        if detail is not None:
            item["detail"] = detail
        submodules.append(item)
    return submodules


def collect_repo_state(path: Path, recent_commits: int) -> dict[str, object]:
    """Collect local repository evidence without fetching or reading file bodies."""

    if not 0 <= recent_commits <= MAX_RECENT_COMMITS:
        raise ValueError(f"recent_commits must be between 0 and {MAX_RECENT_COMMITS}")

    path = Path(path)
    data = _empty_state(path)
    warnings = data["warnings"]
    assert isinstance(warnings, list)

    if shutil.which("git") is None:
        warnings.append("Git executable was not found; repository state was not collected.")
        return data

    discovery = run_git(path, ["rev-parse", "--show-toplevel"])
    if discovery.returncode != 0 or not discovery.stdout.strip():
        if _has_git_marker(path):
            raise CollectorError("Git repository discovery failed inside a working tree")
        return data

    root = Path(discovery.stdout.strip()).resolve()
    data["git_available"] = True
    data["repository_root"] = str(root)

    branch_result = _optional_git(root, ["symbolic-ref", "--quiet", "--short", "HEAD"])
    branch = branch_result.stdout.strip() if branch_result is not None else None
    head = data["head"]
    assert isinstance(head, dict)
    head["branch"] = branch or None
    head["detached"] = branch_result is None

    commit_result = _optional_git(root, ["rev-parse", "HEAD"])
    short_result = _optional_git(root, ["rev-parse", "--short", "HEAD"])
    subject_result = _optional_git(root, ["log", "-1", "--format=%s"])
    if commit_result is not None:
        head["commit"] = commit_result.stdout.strip() or None
    if short_result is not None:
        head["short_commit"] = short_result.stdout.strip() or None
    if subject_result is not None:
        head["subject"] = subject_result.stdout.rstrip("\r\n") or None
    if commit_result is None:
        warnings.append("HEAD commit is not available in this repository.")

    upstream = data["upstream"]
    assert isinstance(upstream, dict)
    upstream_result = _optional_git(
        root,
        ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
    )
    if upstream_result is None or not upstream_result.stdout.strip():
        upstream["reason"] = "no configured upstream in local Git state"
    else:
        upstream["name"] = upstream_result.stdout.strip()
        counts = _optional_git(
            root, ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]
        )
        if counts is None:
            upstream["reason"] = "configured upstream could not be compared using local refs"
        else:
            fields = counts.stdout.split()
            if len(fields) != 2:
                raise CollectorError("Git returned malformed upstream counts")
            try:
                ahead, behind = (int(value) for value in fields)
            except ValueError as exc:
                raise CollectorError("Git returned malformed upstream counts") from exc
            upstream["ahead"] = ahead
            upstream["behind"] = behind
            upstream["reason"] = "computed from existing local refs without fetching"

    data["remotes"] = _collect_remotes(root)

    staged = parse_name_status(
        _required_git(root, ["diff", "--cached", "--name-status", "-z"]).stdout,
        "staged",
    )
    unstaged = parse_name_status(
        _required_git(root, ["diff", "--name-status", "-z"]).stdout,
        "unstaged",
    )
    untracked_raw = _required_git(
        root, ["ls-files", "--others", "--exclude-standard", "-z"]
    ).stdout
    untracked = [value for value in untracked_raw.split("\0") if value]
    changed_records = [*staged, *unstaged]
    deleted = _unique_strings(
        [item["path"] for item in changed_records if item["status"].startswith("D")]
    )
    renamed = [
        dict(item)
        for item in changed_records
        if item["status"].startswith(("R", "C"))
    ]
    working_tree = data["working_tree"]
    assert isinstance(working_tree, dict)
    working_tree.update(
        {
            "clean": not (staged or unstaged or untracked),
            "staged": staged,
            "unstaged": unstaged,
            "untracked": untracked,
            "deleted": deleted,
            "renamed": renamed,
        }
    )

    diff_stats = data["diff_stats"]
    assert isinstance(diff_stats, dict)
    diff_stats["staged"] = _required_git(
        root, ["diff", "--cached", "--shortstat"]
    ).stdout.strip()
    diff_stats["unstaged"] = _required_git(
        root, ["diff", "--shortstat"]
    ).stdout.strip()

    operation_state = data["operation_state"]
    assert isinstance(operation_state, dict)
    operation_state.update(
        {
            "merge": _git_path_exists(root, "MERGE_HEAD"),
            "rebase": _git_path_exists(root, "rebase-merge")
            or _git_path_exists(root, "rebase-apply"),
            "cherry_pick": _git_path_exists(root, "CHERRY_PICK_HEAD"),
            "revert": _git_path_exists(root, "REVERT_HEAD"),
            "bisect": _git_path_exists(root, "BISECT_START"),
        }
    )

    data["recent_commits"] = _collect_recent_commits(root, recent_commits)
    data["submodules"] = _collect_submodules(root, warnings)
    return data


def serialize_json(data: dict[str, object]) -> str:
    """Serialize collector output deterministically as UTF-8-friendly JSON."""

    return json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def _recent_commit_count(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("must be an integer from 0 through 100") from exc
    if not 0 <= parsed <= MAX_RECENT_COMMITS:
        raise argparse.ArgumentTypeError("must be an integer from 0 through 100")
    return parsed


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Collect sanitized local Git or non-Git state as JSON."
    )
    parser.add_argument("--path", type=Path, default=Path("."))
    parser.add_argument(
        "--recent-commits",
        type=_recent_commit_count,
        default=DEFAULT_RECENT_COMMITS,
        metavar="N",
    )
    parser.add_argument("--output", type=Path)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    try:
        data = collect_repo_state(args.path, args.recent_commits)
        payload = serialize_json(data)
    except CollectorError:
        print("collect_repo_state: repository state collection failed", file=sys.stderr)
        return 3

    if args.output is not None:
        try:
            args.output.write_text(payload, encoding="utf-8")
        except OSError:
            print("collect_repo_state: unable to write output file", file=sys.stderr)
            return 4
    else:
        sys.stdout.write(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
