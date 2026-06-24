#!/usr/bin/env python3
"""Resolve current stable pinned Go, Alpine, and Docker image versions.

This script uses only the Python standard library so the skill can be shared
without extra package dependencies.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass
from html import unescape
from typing import Any
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


GO_DOWNLOADS_URL = "https://go.dev/dl/?mode=json"
ALPINE_RELEASES_URL = "https://www.alpinelinux.org/releases/"
DOCKER_TAGS_URL = "https://hub.docker.com/v2/repositories/library/{repo}/tags"


@dataclass(frozen=True)
class Version:
    parts: tuple[int, ...]
    raw: str

    @classmethod
    def parse(cls, raw: str) -> "Version":
        nums = tuple(int(x) for x in re.findall(r"\d+", raw))
        if not nums:
            raise ValueError(f"cannot parse version: {raw!r}")
        return cls(nums, raw)


def fetch_text(url: str, timeout: float) -> str:
    req = Request(url, headers={"User-Agent": "go-service-builder/1.0"})
    with urlopen(req, timeout=timeout) as resp:  # nosec B310: official HTTPS URLs only
        return resp.read().decode("utf-8", errors="replace")


def fetch_json(url: str, timeout: float) -> Any:
    return json.loads(fetch_text(url, timeout))


def go_release(timeout: float) -> dict[str, str]:
    data = fetch_json(GO_DOWNLOADS_URL, timeout)
    candidates: list[tuple[Version, str]] = []
    for item in data:
        raw = item.get("version", "")
        if not raw.startswith("go"):
            continue
        if any(mark in raw for mark in ("beta", "rc")):
            continue
        version = raw.removeprefix("go")
        candidates.append((Version.parse(version), version))
    if not candidates:
        raise RuntimeError("no stable Go release found")
    _, patch = max(candidates, key=lambda x: x[0].parts)
    major_minor = ".".join(patch.split(".")[:2])
    return {
        "version": patch,
        "module_go": major_minor,
        "source": GO_DOWNLOADS_URL,
    }


def alpine_release(timeout: float) -> dict[str, str]:
    html = unescape(fetch_text(ALPINE_RELEASES_URL, timeout))
    matches = set(re.findall(r"\bv?(\d+\.\d+)(?:\.\d+)?\b", html))
    versions = [(Version.parse(v), v) for v in matches if v.startswith("3.")]
    if not versions:
        raise RuntimeError("no stable Alpine release found")
    _, minor = max(versions, key=lambda x: x[0].parts)
    return {
        "version": minor,
        "source": ALPINE_RELEASES_URL,
    }


def docker_tags(repo: str, name_filter: str, timeout: float) -> list[str]:
    tags: list[str] = []
    page = 1
    while page <= 5:
        query = urlencode({"page_size": 100, "page": page, "name": name_filter})
        url = f"{DOCKER_TAGS_URL.format(repo=quote(repo))}?{query}"
        data = fetch_json(url, timeout)
        tags.extend(item.get("name", "") for item in data.get("results", []))
        if not data.get("next"):
            break
        page += 1
    return [t for t in tags if t]


def choose_golang_alpine_tag(go_patch: str, alpine_minor: str, timeout: float) -> dict[str, Any]:
    prefix = f"{go_patch}-alpine"
    tags = docker_tags("golang", prefix, timeout)
    exact = f"{go_patch}-alpine{alpine_minor}"
    if exact in tags:
        return {
            "tag": exact,
            "source": "https://hub.docker.com/_/golang",
            "matched_exact_alpine": True,
            "available_matching_tags": sorted(tags),
        }

    versioned_tags = []
    for tag in tags:
        m = re.fullmatch(re.escape(prefix) + r"(\d+\.\d+)", tag)
        if m:
            versioned_tags.append((Version.parse(m.group(1)), tag))
    if versioned_tags:
        _, tag = max(versioned_tags, key=lambda x: x[0].parts)
        return {
            "tag": tag,
            "source": "https://hub.docker.com/_/golang",
            "matched_exact_alpine": False,
            "available_matching_tags": sorted(tags),
            "warning": f"exact tag {exact!r} was not listed; selected newest listed Alpine variant",
        }

    fallback = f"{go_patch}-alpine"
    if fallback in tags:
        return {
            "tag": fallback,
            "source": "https://hub.docker.com/_/golang",
            "matched_exact_alpine": False,
            "available_matching_tags": sorted(tags),
            "warning": "only non-Alpine-minor golang alpine tag was listed",
        }

    raise RuntimeError(f"no official golang alpine tag found for {go_patch}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--timeout", type=float, default=20.0, help="HTTP timeout in seconds")
    args = parser.parse_args()

    resolved_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    go = go_release(args.timeout)
    alpine = alpine_release(args.timeout)
    golang_image = choose_golang_alpine_tag(go["version"], alpine["version"], args.timeout)

    result = {
        "resolved_at": resolved_at,
        "go": go,
        "alpine": alpine,
        "images": {
            "builder": {
                "image": f"golang:{golang_image['tag']}",
                **golang_image,
            },
            "runtime": {
                "image": f"alpine:{alpine['version']}",
                "tag": alpine["version"],
                "source": ALPINE_RELEASES_URL,
            },
        },
        "policy": {
            "write_latest": False,
            "prefer_small_runtime": "alpine",
        },
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"resolve_versions.py: {exc}", file=sys.stderr)
        raise SystemExit(1)
