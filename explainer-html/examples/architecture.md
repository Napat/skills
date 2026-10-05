---
schema: 1
title: "From request to durable work"
subtitle: "One request, two paths: a quick response and reliable background processing."
theme: shadcn
mode: auto
---
## Acknowledge first, process reliably

The API stores the request before acknowledging it. A worker consumes queued work and records the outcome.

```architecture
direction: LR
nodes:
  browser: {label: "🌐 Browser", kind: client}
  api: {label: "API", kind: service}
  queue: {label: "Work queue", kind: queue}
  worker: {label: "Worker", kind: service}
  store: {label: "Results", kind: database}
edges:
  - {id: request, from: browser, to: api, label: "POST /jobs"}
  - {id: publish, from: api, to: queue, label: "job.created", kind: async}
  - {id: consume, from: queue, to: worker, label: "consume", kind: async}
  - {id: persist, from: worker, to: store, label: "commit"}
groups:
  - {id: platform, label: "Application boundary", members: [api, queue, worker, store]}
```

## Choose the contract

| Property | Synchronous request | Queued job |
| --- | --- | --- |
| Immediate final result | [✓] Available | [✗] Poll or subscribe |
| Absorb traffic bursts | [!] Capacity bound | [✓] Buffer work |
| Duplicate handling | [!] Retry safely | [!] Idempotent consumer |

Accepting a job and completing it are separate events. Show both states to the caller.
