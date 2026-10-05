---
title: "Make the structure visible"
subtitle: "Small visual components for code, decisions and change."
---
## Repository map
```tree
- id: root
  label: "📁 service/"
  children:
    - {id: cmd, label: "cmd/ — entrypoints"}
    - id: internal
      label: "internal/"
      children:
        - {id: handlers, label: "handlers/ — HTTP boundary"}
        - {id: domain, label: "domain/ — business rules"}
```
## Delivery milestones
```timeline
- {id: design, date: "Phase 1", label: "Agree on the contract", status: "done", detail: "Inputs, errors and ownership are explicit."}
- {id: build, date: "Phase 2", label: "Implement and verify", status: "active", detail: "Exercise both the happy path and failures."}
- {id: release, date: "Phase 3", label: "Release gradually", status: "planned"}
```
## Read the guarantee carefully
```annot
text: "A queued job is accepted. A queued job is not necessarily complete."
notes:
  - {id: accepted, quote: "accepted", note: "The system has taken responsibility for processing."}
  - {id: queued, quote: "queued job", occurrence: 2, note: "Use a separate status endpoint to report completion."}
```
```code-annot
text: "return response(202, job.id)"
notes:
  - {id: status, quote: "202", note: "Accepted for processing; the result may arrive later."}
```
```diff
- return response(200, "done")
+ return response(202, job.id)
```
## Compare the states
| Guarantee | Accepted | Completed |
| --- | --- | --- |
| Durable ownership | [✓] Yes | [✓] Yes |
| Final result | [✗] Pending | [✓] Available |
| Retry required | [!] Check status | [✗] Usually no |
