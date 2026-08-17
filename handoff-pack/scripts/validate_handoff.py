#!/usr/bin/env python3
"""Validate the stable, evidence-oriented HANDOFF.md structure."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import json
from pathlib import Path
import re
import sys
from typing import Sequence


ENGLISH_HEADINGS = [
    "Handoff Metadata",
    "Executive Summary",
    "Objective and Acceptance Criteria",
    "Scope",
    "Verified Current State",
    "Completed Work",
    "Work in Progress",
    "Key Decisions and Rationale",
    "Changed Files and Components",
    "Validation and Test Results",
    "Known Issues, Risks and Blockers",
    "Dependencies and Environment Notes",
    "Assumptions and User-Reported Context",
    "Open Questions",
    "Recommended Next Actions",
    "Restart Instructions",
    "Starter Prompt for the Receiving Agent",
    "Final Verification Checklist",
]

THAI_HEADINGS = [
    "ข้อมูลการส่งต่องาน",
    "บทสรุปสำหรับผู้รับช่วง",
    "เป้าหมายและเกณฑ์การยอมรับ",
    "ขอบเขต",
    "สถานะปัจจุบันที่ตรวจสอบแล้ว",
    "งานที่เสร็จแล้ว",
    "งานที่กำลังดำเนินการ",
    "การตัดสินใจสำคัญและเหตุผล",
    "ไฟล์และส่วนประกอบที่เปลี่ยน",
    "ผลการตรวจสอบและการทดสอบ",
    "ปัญหา ความเสี่ยง และสิ่งกีดขวาง",
    "การพึ่งพาและสภาพแวดล้อม",
    "สมมติฐานและบริบทจากผู้ใช้",
    "คำถามที่ยังเปิดอยู่",
    "ขั้นตอนถัดไปที่แนะนำ",
    "วิธีเริ่มทำงานต่อ",
    "พรอมต์เริ่มต้นสำหรับเอเจนต์ผู้รับช่วง",
    "รายการตรวจสอบสุดท้าย",
]

ENGLISH_CHECKLIST = [
    "Objective is clear",
    "Acceptance criteria are recorded or marked as missing",
    "Branch and commit were verified",
    "Uncommitted changes are documented",
    "Completed and remaining work are separated",
    "Tests are recorded accurately",
    "Failures and blockers are visible",
    "Next actions are actionable",
    "Assumptions are separated from facts",
    "No secret values are included",
    "Receiving-agent starter prompt is present",
]

THAI_CHECKLIST = [
    "เป้าหมายชัดเจน",
    "บันทึกเกณฑ์การยอมรับหรือระบุว่ายังไม่มี",
    "ตรวจสอบสาขาและคอมมิตแล้ว",
    "บันทึกการเปลี่ยนแปลงที่ยังไม่ได้คอมมิตไว้แล้ว",
    "แยกงานที่เสร็จแล้วออกจากงานที่เหลือ",
    "บันทึกผลการทดสอบอย่างถูกต้อง",
    "แสดงความล้มเหลวและสิ่งกีดขวางอย่างชัดเจน",
    "ขั้นตอนถัดไปนำไปปฏิบัติได้",
    "แยกสมมติฐานออกจากข้อเท็จจริง",
    "ไม่มีค่าความลับอยู่ในเอกสาร",
    "มีพรอมต์เริ่มต้นสำหรับเอเจนต์ผู้รับช่วง",
]

ALLOWED_STATUSES = {"Passed", "Failed", "Not run", "Blocked"}
WARNING_SIZE_BYTES = 64 * 1024
ERROR_SIZE_BYTES = 256 * 1024
TITLE_ALIASES = {"Project Handoff", "เอกสารส่งต่องานโครงการ"}

PRIVATE_KEY_RE = re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")
CREDENTIAL_URL_RE = re.compile(r"https?://[^\s/:@]+:[^\s/@]+@", re.IGNORECASE)
SENSITIVE_QUERY_RE = re.compile(
    r"[?&](?:access_token|api_key|token|password|secret)=", re.IGNORECASE
)
KNOWN_TOKEN_RE = re.compile(r"\b(?:sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16})\b")
ASSIGNMENT_RE = re.compile(
    r"(?i)\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|password|client[_-]?secret|secret)\b\s*[:=]\s*[`\"']?([^\s`\"']+)"
)
NAMED_ASSIGNMENT_RE = re.compile(
    r"(?i)\b([a-z][a-z0-9_-]*)\b\s*[:=]\s*[`\"']?([^\s`\"']+)"
)
URI_USERINFO_RE = re.compile(
    r"\b([A-Za-z][A-Za-z0-9+.-]*)://([^\s/?#@]*)@(?=[^\s/?#]+)",
    re.IGNORECASE,
)
SAFE_URI_USERNAMES = {"git", "hg", "svn"}

TITLE_RE = re.compile(r"^#\s+(.+?)\s*$")
SECTION_RE = re.compile(r"^##\s+(\d+)\.\s+(.+?)\s*$")
FENCE_OPEN_RE = re.compile(r"^\s{0,3}(`{3,}|~{3,})(.*)$")
FENCE_CLOSE_RE = re.compile(r"^\s{0,3}(`{3,}|~{3,})[ \t]*$")
ORDERED_ITEM_RE = re.compile(r"^\s*\d+\.\s+\S")
CHECKBOX_RE = re.compile(r"^\s*-\s+\[(?: |x)\]\s+(.+?)\s*$", re.IGNORECASE)
TABLE_SEPARATOR_RE = re.compile(r"^:?-{3,}:?$")
INLINE_CODE_RE = re.compile(r"`[^`\n]+`")
NEEDS_INPUT_RE = re.compile(r"\[NEEDS INPUT(?:\s*:[^\]]*)?\]", re.IGNORECASE)
CRITICAL_FIELD_RE = re.compile(
    r"^\s*[-*+]\s+(?:"
    r"Objective|Acceptance\s+criteria|Definition\s+of\s+done|"
    r"เป้าหมาย|เกณฑ์การยอมรับ|นิยามของงานที่เสร็จสมบูรณ์|เงื่อนไขว่างานเสร็จ"
    r")\s*:\s*(.*?)\s*$",
    re.IGNORECASE,
)
BRANCH_VALUE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/-]*$")
COMMIT_VALUE_RE = re.compile(r"^[0-9a-fA-F]{7,40}$")
BRANCH_LABEL_RE = re.compile(
    r"^\s*(?:[-*+]\s+)?(?:Current\s+branch|Branch|สาขาปัจจุบัน|สาขา)\s*:\s*(.+?)\s*$",
    re.IGNORECASE,
)
COMMIT_LABEL_RE = re.compile(
    r"^\s*(?:[-*+]\s+)?(?:HEAD\s+commit|Commit|คอมมิต\s+HEAD|คอมมิต)\s*:\s*(.+?)\s*$",
    re.IGNORECASE,
)
UNAVAILABLE_VALUES = {"not available", "ไม่พร้อมใช้งาน", "detached head"}
GENERIC_NEXT_ACTION = (
    "put the safest actionable step first. include expected outcome, file/component, "
    "validation command, and dependency/blocker when known."
)
GENERIC_STARTER_PROMPT = (
    "write a concise project-specific prompt that tells the receiving agent to read "
    "applicable `agents.md` and `handoff.md`, verify branch/commit and working tree, "
    "review tests, avoid repeated work, start from recommended next actions, validate "
    "before completion claims, report discrepancies, and treat the handoff as potentially stale."
)
TABLE_HEADER_ALIASES = (
    {"command", "คำสั่ง"},
    {
        "working directory",
        "ไดเรกทอรีทำงาน",
        "ไดเรกทอรีที่ทำงาน",
        "โฟลเดอร์ทำงาน",
        "โฟลเดอร์ที่ทำงาน",
    },
    {"status", "สถานะ"},
    {"result", "ผลลัพธ์", "ผล"},
)
SENSITIVE_ASSIGNMENT_SUFFIXES = (
    "TOKEN",
    "PASSWORD",
    "API_KEY",
    "ACCESS_TOKEN",
    "AUTH_TOKEN",
    "CLIENT_SECRET",
    "SESSION_COOKIE",
    "SESSION_TOKEN",
    "SECRET_KEY",
    "SECRET_ACCESS_KEY",
    "PRIVATE_KEY",
)


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


def _opening_fence_marker(line: str) -> str | None:
    match = FENCE_OPEN_RE.match(line)
    if not match:
        return None
    marker = match.group(1)
    info = match.group(2)
    if marker[0] == "`" and "`" in info:
        return None
    return marker


def _closing_fence_marker(line: str) -> str | None:
    match = FENCE_CLOSE_RE.match(line)
    return match.group(1) if match else None


def _structural_lines(lines: list[str]) -> list[tuple[int, str]]:
    """Return lines outside fenced code blocks with their one-based numbers."""

    visible: list[tuple[int, str]] = []
    fence_character: str | None = None
    fence_length = 0
    for number, line in enumerate(lines, 1):
        if fence_character is None:
            marker = _opening_fence_marker(line)
            if marker:
                fence_character = marker[0]
                fence_length = len(marker)
                continue
            visible.append((number, line))
            continue

        marker = _closing_fence_marker(line)
        if marker and marker[0] == fence_character and len(marker) >= fence_length:
            fence_character = None
            fence_length = 0
    return visible


def _section_headers(lines: list[str]) -> list[tuple[int, int, str]]:
    headers: list[tuple[int, int, str]] = []
    for line_number, line in _structural_lines(lines):
        match = SECTION_RE.match(line)
        if match:
            headers.append((line_number, int(match.group(1)), match.group(2).strip()))
    return headers


def parse_sections(text: str) -> tuple[str | None, list[tuple[int, str, int, str]]]:
    """Parse the first level-one title and numbered level-two sections."""

    lines = text.splitlines()
    visible = _structural_lines(lines)
    title = next(
        (match.group(1).strip() for _, line in visible if (match := TITLE_RE.match(line))),
        None,
    )
    headers = _section_headers(lines)
    sections: list[tuple[int, str, int, str]] = []
    for index, (line_number, number, heading) in enumerate(headers):
        next_line = headers[index + 1][0] if index + 1 < len(headers) else len(lines) + 1
        body = "\n".join(lines[line_number: next_line - 1])
        sections.append((number, heading, line_number, body))
    return title, sections


def _is_redacted_assignment(value: str, line_tail: str) -> bool:
    normalized = value.strip().casefold()
    if normalized in {"redacted", "[redacted]", "<redacted>"}:
        return True
    if re.fullmatch(r"\$\{[A-Za-z_][A-Za-z0-9_]*\}", value):
        return True
    if re.fullmatch(r"\$[A-Za-z_][A-Za-z0-9_]*", value):
        return True
    return line_tail.lstrip("`\"'").upper().startswith("[NEEDS INPUT")


def _contains_credential_userinfo(line: str) -> bool:
    for match in URI_USERINFO_RE.finditer(line):
        userinfo = match.group(2)
        if ":" in userinfo:
            _, password = userinfo.split(":", 1)
            if password:
                return True
            continue
        if userinfo and userinfo.casefold() not in SAFE_URI_USERNAMES:
            return True
    return False


def _is_sensitive_assignment_name(name: str) -> bool:
    normalized = name.replace("-", "_").upper()
    return any(normalized.endswith(suffix) for suffix in SENSITIVE_ASSIGNMENT_SUFFIXES)


def detect_secrets(lines: list[str]) -> list[Finding]:
    """Report likely secret values without including any matched text."""

    findings: list[Finding] = []
    for line_number, line in enumerate(lines, 1):
        line_codes: set[str] = set()
        if (
            CREDENTIAL_URL_RE.search(line)
            or SENSITIVE_QUERY_RE.search(line)
            or _contains_credential_userinfo(line)
        ):
            line_codes.add("credential-url")
        if PRIVATE_KEY_RE.search(line) or KNOWN_TOKEN_RE.search(line):
            line_codes.add("secret-value")
        for match in ASSIGNMENT_RE.finditer(line):
            value = match.group(1)
            if not _is_redacted_assignment(value, line[match.start(1) :]):
                line_codes.add("secret-value")
        for match in NAMED_ASSIGNMENT_RE.finditer(line):
            if not _is_sensitive_assignment_name(match.group(1)):
                continue
            value = match.group(2)
            if not _is_redacted_assignment(value, line[match.start(2) :]):
                line_codes.add("secret-value")
        if "credential-url" in line_codes:
            findings.append(
                Finding(
                    "credential-url",
                    "Possible credential-bearing URL detected; redact the value.",
                    line_number,
                )
            )
        if "secret-value" in line_codes:
            findings.append(
                Finding(
                    "secret-value",
                    "Possible secret value detected; redact the value.",
                    line_number,
                )
            )
    return findings


def _top_level_titles(text: str) -> list[tuple[str, int]]:
    titles: list[tuple[str, int]] = []
    for line_number, line in _structural_lines(text.splitlines()):
        match = TITLE_RE.match(line)
        if match:
            titles.append((match.group(1).strip(), line_number))
    return titles


def _strip_inline_formatting(value: str) -> str:
    value = value.strip()
    while len(value) >= 2:
        if value.startswith("`") and value.endswith("`"):
            value = value[1:-1].strip()
            continue
        if value.startswith("**") and value.endswith("**"):
            value = value[2:-2].strip()
            continue
        break
    return value


def _visible_section_lines(
    section: tuple[int, str, int, str],
) -> list[tuple[int, str]]:
    section_line = section[2]
    return [
        (section_line + offset, line)
        for offset, line in _structural_lines(section[3].splitlines())
    ]


def _validate_metadata(
    lines: list[tuple[int, str]], errors: list[Finding]
) -> None:
    for line_number, line in lines:
        branch_match = BRANCH_LABEL_RE.match(line)
        if branch_match:
            value = _strip_inline_formatting(branch_match.group(1))
            if value.casefold() not in UNAVAILABLE_VALUES and not BRANCH_VALUE_RE.fullmatch(value):
                errors.append(
                    Finding(
                        "invalid-branch",
                        "Branch metadata must be a plausible branch name or an explicit unavailable value.",
                        line_number,
                    )
                )

        commit_match = COMMIT_LABEL_RE.match(line)
        if commit_match:
            value = _strip_inline_formatting(commit_match.group(1))
            if value.casefold() not in UNAVAILABLE_VALUES and not COMMIT_VALUE_RE.fullmatch(value):
                errors.append(
                    Finding(
                        "invalid-commit",
                        "Commit metadata must be a 7-40 character hexadecimal object ID or an explicit unavailable value.",
                        line_number,
                    )
                )


def _validate_critical_fields(
    lines: list[tuple[int, str]], errors: list[Finding]
) -> None:
    for line_number, line in lines:
        match = CRITICAL_FIELD_RE.match(line)
        if match and not _strip_inline_formatting(match.group(1)):
            errors.append(
                Finding(
                    "empty-evidence-section",
                    "Objective, acceptance criteria, and definition-of-done labels must contain evidence or an explicit NEEDS INPUT marker.",
                    line_number,
                )
            )


def _table_cells(line: str) -> list[str] | None:
    stripped = line.strip()
    if "|" not in stripped:
        return None
    if stripped.startswith("|"):
        stripped = stripped[1:]
    if stripped.endswith("|"):
        stripped = stripped[:-1]

    cells: list[str] = []
    current: list[str] = []
    for character in stripped:
        if character == "|":
            preceding_backslashes = 0
            for existing in reversed(current):
                if existing != "\\":
                    break
                preceding_backslashes += 1
            if preceding_backslashes % 2:
                current.append(character)
                continue
            cells.append("".join(current).strip())
            current = []
            continue
        current.append(character)
    cells.append("".join(current).strip())
    return cells if len(cells) > 1 else None


def _is_test_table_header(cells: list[str]) -> bool:
    if len(cells) != 4:
        return False
    return all(
        cell.casefold() in aliases
        for cell, aliases in zip(cells, TABLE_HEADER_ALIASES)
    )


def _is_test_table_separator(cells: list[str] | None) -> bool:
    return bool(
        cells
        and len(cells) == 4
        and all(TABLE_SEPARATOR_RE.fullmatch(cell) for cell in cells)
    )


def _validate_test_table(
    visible_lines: list[tuple[int, str]],
    section_line: int,
    errors: list[Finding],
    warnings: list[Finding],
) -> None:
    contract_line = section_line
    data_rows: list[tuple[int, list[str]]] | None = None

    for index, (line_number, line) in enumerate(visible_lines):
        cells = _table_cells(line)
        if cells is None or not _is_test_table_header(cells):
            continue
        contract_line = line_number
        if index + 1 >= len(visible_lines):
            continue
        separator_line_number, separator_line = visible_lines[index + 1]
        if separator_line_number != line_number + 1:
            continue
        separator = _table_cells(separator_line)
        if not _is_test_table_separator(separator):
            continue

        candidate_rows: list[tuple[int, list[str]]] = []
        previous_line_number = separator_line_number
        for row_line_number, row_line in visible_lines[index + 2 :]:
            if row_line_number != previous_line_number + 1:
                break
            row_cells = _table_cells(row_line)
            if row_cells is None:
                break
            candidate_rows.append((row_line_number, row_cells))
            previous_line_number = row_line_number

        if candidate_rows and all(len(row_cells) == 4 for _, row_cells in candidate_rows):
            data_rows = candidate_rows
            break

    if data_rows is None:
        errors.append(
            Finding(
                "invalid-test-status",
                "Validation results must use a four-column Command, Working Directory, Status, and Result table with a separator and at least one data row.",
                contract_line,
            )
        )
        return

    for line_number, cells in data_rows:
        status = cells[2]
        if status not in ALLOWED_STATUSES:
            errors.append(
                Finding(
                    "invalid-test-status",
                    "Validation table status must be Passed, Failed, Not run, or Blocked.",
                    line_number,
                )
            )
        if not INLINE_CODE_RE.search(cells[0]):
            warnings.append(
                Finding(
                    "command-formatting",
                    "Format each validation command as inline code in the Command column.",
                    line_number,
                )
            )


def _section_map(
    sections: list[tuple[int, str, int, str]],
) -> dict[int, tuple[int, str, int, str]]:
    result: dict[int, tuple[int, str, int, str]] = {}
    for section in sections:
        result.setdefault(section[0], section)
    return result


def _fences_balanced(lines: list[str]) -> bool:
    fence_character: str | None = None
    fence_length = 0
    for line in lines:
        if fence_character is None:
            marker = _opening_fence_marker(line)
            if not marker:
                continue
            fence_character = marker[0]
            fence_length = len(marker)
            continue

        marker = _closing_fence_marker(line)
        if marker and marker[0] == fence_character and len(marker) >= fence_length:
            fence_character = None
            fence_length = 0
    return fence_character is None


def validate_text(text: str, path: Path) -> ValidationResult:
    """Validate one decoded handoff document."""

    lines = text.splitlines()
    visible_document_lines = _structural_lines(lines)
    size_bytes = len(text.encode("utf-8"))
    errors: list[Finding] = []
    warnings: list[Finding] = []

    if size_bytes > ERROR_SIZE_BYTES:
        errors.append(
            Finding(
                "file-size-error",
                "Document exceeds the 256 KiB maximum size.",
            )
        )
    elif size_bytes > WARNING_SIZE_BYTES:
        warnings.append(
            Finding(
                "file-size-warning",
                "Document exceeds 64 KiB; consider replacing bulk content with concise evidence references.",
            )
        )

    title, sections = parse_sections(text)
    titles = _top_level_titles(text)
    if title is None:
        errors.append(Finding("missing-title", "A supported level-one handoff title is required."))
    else:
        if title not in TITLE_ALIASES:
            errors.append(
                Finding(
                    "invalid-title",
                    "The level-one title must use a supported English or Thai alias.",
                    titles[0][1] if titles else None,
                )
            )
        if len(titles) != 1:
            errors.append(
                Finding(
                    "invalid-title",
                    "The document must contain exactly one level-one title.",
                    titles[1][1] if len(titles) > 1 else None,
                )
            )

    numbers = [section[0] for section in sections]
    for expected in range(1, 19):
        occurrences = [section for section in sections if section[0] == expected]
        if not occurrences:
            errors.append(
                Finding(
                    "missing-section",
                    f"Required numbered section {expected} is missing.",
                )
            )
        elif len(occurrences) > 1:
            errors.append(
                Finding(
                    "duplicate-section",
                    f"Numbered section {expected} appears more than once.",
                    occurrences[1][2],
                )
            )

    if numbers != list(range(1, 19)):
        errors.append(
            Finding(
                "section-order",
                "Numbered sections must appear exactly once in ascending order from 1 through 18.",
                sections[0][2] if sections else None,
            )
        )

    for number, heading, line_number, body in sections:
        if not 1 <= number <= 18:
            errors.append(
                Finding(
                    "invalid-section-heading",
                    "Only numbered sections 1 through 18 are supported.",
                    line_number,
                )
            )
            continue
        allowed_headings = {ENGLISH_HEADINGS[number - 1], THAI_HEADINGS[number - 1]}
        if heading not in allowed_headings:
            errors.append(
                Finding(
                    "invalid-section-heading",
                    f"Section {number} must use its supported English or Thai heading alias.",
                    line_number,
                )
            )
        if not any(line.strip() for _, line in _visible_section_lines((number, heading, line_number, body))):
            warnings.append(
                Finding(
                    "empty-evidence-section",
                    f"Section {number} has no recorded content or explicit none marker.",
                    line_number,
                )
            )

    for line_number, line in enumerate(lines, 1):
        if NEEDS_INPUT_RE.search(line):
            warnings.append(
                Finding(
                    "needs-input",
                    "An unresolved NEEDS INPUT marker remains.",
                    line_number,
                )
            )

    if not _fences_balanced(lines):
        errors.append(
            Finding(
                "unbalanced-fence",
                "Fenced code blocks must have a matching closing fence.",
            )
        )

    _validate_metadata(visible_document_lines, errors)
    sections_by_number = _section_map(sections)

    objective = sections_by_number.get(3)
    if objective:
        _validate_critical_fields(_visible_section_lines(objective), errors)

    test_section = sections_by_number.get(10)
    if test_section:
        _validate_test_table(
            _visible_section_lines(test_section), test_section[2], errors, warnings
        )

    next_actions = sections_by_number.get(15)
    if next_actions:
        next_action_lines = _visible_section_lines(next_actions)
        next_action_body = "\n".join(line for _, line in next_action_lines).casefold()
        if GENERIC_NEXT_ACTION in next_action_body:
            errors.append(
                Finding(
                    "next-actions",
                    "Replace the generic next-action scaffold with a project-specific action or an explicit NEEDS INPUT marker.",
                    next_actions[2],
                )
            )
        elif not any(ORDERED_ITEM_RE.match(line) for _, line in next_action_lines):
            errors.append(
                Finding(
                    "next-actions",
                    "Recommended Next Actions must contain at least one ordered-list item.",
                    next_actions[2],
                )
            )

    restart = sections_by_number.get(16)
    if restart:
        steps = sum(
            bool(ORDERED_ITEM_RE.match(line))
            for _, line in _visible_section_lines(restart)
        )
        if steps < 3:
            errors.append(
                Finding(
                    "restart-instructions",
                    "Restart Instructions must contain at least three ordered steps.",
                    restart[2],
                )
            )

    starter = sections_by_number.get(17)
    if starter:
        body = "\n".join(line for _, line in _visible_section_lines(starter))
        has_handoff = "handoff.md" in body.casefold()
        has_branch = bool(re.search(r"\bbranch\b", body, re.IGNORECASE)) or "สาขา" in body
        has_validation = bool(re.search(r"\bvalidat(?:e|es|ed|ing|ion)\b", body, re.IGNORECASE)) or "ตรวจสอบ" in body
        if GENERIC_STARTER_PROMPT in body.casefold():
            errors.append(
                Finding(
                    "starter-prompt",
                    "Replace the generic starter-prompt scaffold with a project-specific prompt or an explicit NEEDS INPUT marker.",
                    starter[2],
                )
            )
        elif not (has_handoff and has_branch and has_validation):
            errors.append(
                Finding(
                    "starter-prompt",
                    "Starter Prompt must mention HANDOFF.md, branch verification, and validation.",
                    starter[2],
                )
            )

    checklist = sections_by_number.get(18)
    if checklist:
        checkbox_items = [
            (line_number, match.group(1).strip())
            for line_number, line in _visible_section_lines(checklist)
            if (match := CHECKBOX_RE.match(line))
        ]
        if len(checkbox_items) != 11:
            errors.append(
                Finding(
                    "final-checklist",
                    "Final Verification Checklist must contain exactly eleven checkbox items.",
                    checklist[2],
                )
            )
        else:
            for index, (line_number, label) in enumerate(checkbox_items):
                allowed = {
                    ENGLISH_CHECKLIST[index].casefold(),
                    THAI_CHECKLIST[index].casefold(),
                }
                if label.casefold() not in allowed:
                    errors.append(
                        Finding(
                            "final-checklist",
                            "Final Verification Checklist must use all eleven canonical labels in order; each label may use its English or Thai alias.",
                            line_number,
                        )
                    )
                    break

    errors.extend(detect_secrets(lines))
    return ValidationResult(path=path, size_bytes=size_bytes, errors=errors, warnings=warnings)


def render_human(result: ValidationResult) -> str:
    lines: list[str] = []
    for severity, findings in (("ERROR", result.errors), ("WARNING", result.warnings)):
        for finding in findings:
            location = str(finding.line) if finding.line is not None else "-"
            lines.append(f"{severity} {finding.code} line {location}: {finding.message}")
    lines.append(
        f"Summary: {len(result.errors)} error(s), {len(result.warnings)} warning(s)."
    )
    return "\n".join(lines)


def _argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate an evidence-based HANDOFF.md file.")
    parser.add_argument("path", type=Path, help="UTF-8 HANDOFF.md file to validate")
    parser.add_argument("--json", action="store_true", dest="as_json", help="emit JSON")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="return validation failure when warnings are present",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = _argument_parser()
    try:
        args = parser.parse_args(argv)
    except SystemExit as exc:
        return int(exc.code)

    try:
        raw = args.path.read_bytes()
        text = raw.decode("utf-8")
    except (OSError, UnicodeError):
        print("validate_handoff: unable to read UTF-8 input", file=sys.stderr)
        return 2

    result = validate_text(text, args.path)
    if args.as_json:
        print(json.dumps(result.as_dict(), ensure_ascii=False, indent=2))
    else:
        print(render_human(result))

    if result.errors or (args.strict and result.warnings):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
