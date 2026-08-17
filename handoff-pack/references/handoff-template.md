# HANDOFF.md Template

## Contents

- [Copy instructions](#copy-instructions)
- [Copy-ready scaffold](#copy-ready-scaffold)
- [Thai heading aliases](#thai-heading-aliases)
- [Thai checklist aliases](#thai-checklist-aliases)

## Copy Instructions

Copy only the content between `BEGIN HANDOFF COPY REGION` and `END HANDOFF COPY REGION`; exclude both marker comments and all reference material outside them. Resolve every supported field from evidence. Keep `[NEEDS INPUT: ...]` for unresolved facts so non-strict validation exposes warnings and strict validation prevents a readiness claim.

Use the user's language. Keep the numeric section identifiers stable. For Thai, replace the title, headings, and checklist labels with the exact aliases documented after the copy region. Leave a checklist item unchecked whenever its claim is unsupported.

## Copy-ready Scaffold

<!-- BEGIN HANDOFF COPY REGION -->
# Project Handoff

## 1. Handoff Metadata

- Generated at: `[NEEDS INPUT: reliable ISO 8601 timestamp]`
- Repository: `[NEEDS INPUT: repository name or Not available]`
- Working directory: `[NEEDS INPUT: selected project working directory]`
- Current branch: `Not available`
- HEAD commit: `Not available`
- Upstream branch: `Not available`
- Pull request: `Not available`
- Related issue or ticket: `Not available`
- Intended recipient: `[NEEDS INPUT: intended recipient]`
- Handoff purpose: `[NEEDS INPUT: handoff purpose]`

## 2. Executive Summary

[NEEDS INPUT: summarize the objective, current state, and recipient's next step in 3–8 sentences]

## 3. Objective and Acceptance Criteria

- Objective: [NEEDS INPUT: objective]
- Acceptance criteria: [NEEDS INPUT: evidence-based acceptance criteria]
- Definition of done: [NEEDS INPUT: definition of done]

## 4. Scope

- In scope: [NEEDS INPUT: in-scope work]
- Out of scope: [NEEDS INPUT: out-of-scope work or None]
- Deferred: [NEEDS INPUT: deferred work or None]

## 5. Verified Current State

[NEEDS INPUT: directly verified repository, command, file, or authoritative-source facts]

## 6. Completed Work

[NEEDS INPUT: completed work with supporting evidence, or None]

## 7. Work in Progress

[NEEDS INPUT: staged, unstaged, untracked, unpushed, experimental, and generated work, or None]

## 8. Key Decisions and Rationale

[NEEDS INPUT: known decisions and rationale, with unknown rationale marked explicitly]

## 9. Changed Files and Components

| Path or Component | Change | Status | Notes |
| --- | --- | --- | --- |
| [NEEDS INPUT: path or component] | [NEEDS INPUT: change] | [NEEDS INPUT: status] | [NEEDS INPUT: evidence or notes] |

## 10. Validation and Test Results

| Command | Working Directory | Status | Result |
| --- | --- | --- | --- |
| `[NEEDS INPUT: validation command or Not available]` | `[NEEDS INPUT: working directory]` | Not run | [NEEDS INPUT: explain why the command was not run] |

Use only `Passed`, `Failed`, `Not run`, or `Blocked`. Explain important failures below the table.

## 11. Known Issues, Risks and Blockers

[NEEDS INPUT: description, impact, evidence, mitigation or workaround, and owner when known, or None]

## 12. Dependencies and Environment Notes

[NEEDS INPUT: verified tool versions, setup commands, services, environment variable names without values, feature flags, and platform constraints]

## 13. Assumptions and User-Reported Context

[NEEDS INPUT: assumptions and unverified user reports kept separate from verified facts, or None]

## 14. Open Questions

[NEEDS INPUT: questions that may affect implementation or acceptance, or None]

## 15. Recommended Next Actions

1. [NEEDS INPUT: safest actionable next step, expected outcome, file or component, validation command, and dependency or blocker]

## 16. Restart Instructions

1. Checkout `[NEEDS INPUT: expected branch or Not available]`.
2. Confirm `[NEEDS INPUT: expected commit or Not available]`.
3. Read applicable `AGENTS.md` and `HANDOFF.md`.
4. Review `[NEEDS INPUT: named files or components]`.
5. Run `[NEEDS INPUT: baseline validation command or explain why unavailable]`.
6. Continue with the first Recommended Next Action.

## 17. Starter Prompt for the Receiving Agent

[NEEDS INPUT: write a project-specific receiving-agent prompt that requires reading AGENTS.md and HANDOFF.md, verifying the branch, commit, and working tree, reviewing tests, starting from Recommended Next Actions, running validation before completion claims, reporting discrepancies, and treating this handoff as potentially stale]

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
<!-- END HANDOFF COPY REGION -->

## Thai Heading Aliases

For a Thai handoff, use `# เอกสารส่งต่องานโครงการ` as the title. Preserve each stable numeric ID and use the following exact heading aliases.

| ID | English heading | Thai heading alias |
| --- | --- | --- |
| 1 | Handoff Metadata | ข้อมูลการส่งต่องาน |
| 2 | Executive Summary | บทสรุปสำหรับผู้รับช่วง |
| 3 | Objective and Acceptance Criteria | เป้าหมายและเกณฑ์การยอมรับ |
| 4 | Scope | ขอบเขต |
| 5 | Verified Current State | สถานะปัจจุบันที่ตรวจสอบแล้ว |
| 6 | Completed Work | งานที่เสร็จแล้ว |
| 7 | Work in Progress | งานที่กำลังดำเนินการ |
| 8 | Key Decisions and Rationale | การตัดสินใจสำคัญและเหตุผล |
| 9 | Changed Files and Components | ไฟล์และส่วนประกอบที่เปลี่ยน |
| 10 | Validation and Test Results | ผลการตรวจสอบและการทดสอบ |
| 11 | Known Issues, Risks and Blockers | ปัญหา ความเสี่ยง และสิ่งกีดขวาง |
| 12 | Dependencies and Environment Notes | การพึ่งพาและสภาพแวดล้อม |
| 13 | Assumptions and User-Reported Context | สมมติฐานและบริบทจากผู้ใช้ |
| 14 | Open Questions | คำถามที่ยังเปิดอยู่ |
| 15 | Recommended Next Actions | ขั้นตอนถัดไปที่แนะนำ |
| 16 | Restart Instructions | วิธีเริ่มทำงานต่อ |
| 17 | Starter Prompt for the Receiving Agent | พรอมต์เริ่มต้นสำหรับเอเจนต์ผู้รับช่วง |
| 18 | Final Verification Checklist | รายการตรวจสอบสุดท้าย |

Keep `[NEEDS INPUT: ...]` as the stable machine-readable unknown marker while translating surrounding prose.

## Thai Checklist Aliases

Use each Thai checklist label only at its matching position. English and Thai labels may be mixed position-by-position.

| Position | English label | Thai label |
| --- | --- | --- |
| 1 | Objective is clear | เป้าหมายชัดเจน |
| 2 | Acceptance criteria are recorded or marked as missing | บันทึกเกณฑ์การยอมรับหรือระบุว่ายังไม่มี |
| 3 | Branch and commit were verified | ตรวจสอบสาขาและคอมมิตแล้ว |
| 4 | Uncommitted changes are documented | บันทึกการเปลี่ยนแปลงที่ยังไม่ได้คอมมิตไว้แล้ว |
| 5 | Completed and remaining work are separated | แยกงานที่เสร็จแล้วออกจากงานที่เหลือ |
| 6 | Tests are recorded accurately | บันทึกผลการทดสอบอย่างถูกต้อง |
| 7 | Failures and blockers are visible | แสดงความล้มเหลวและสิ่งกีดขวางอย่างชัดเจน |
| 8 | Next actions are actionable | ขั้นตอนถัดไปนำไปปฏิบัติได้ |
| 9 | Assumptions are separated from facts | แยกสมมติฐานออกจากข้อเท็จจริง |
| 10 | No secret values are included | ไม่มีค่าความลับอยู่ในเอกสาร |
| 11 | Receiving-agent starter prompt is present | มีพรอมต์เริ่มต้นสำหรับเอเจนต์ผู้รับช่วง |
