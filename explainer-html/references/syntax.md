# Semantic syntax, version 1

## Contents

- Document
- Architecture and flow
- Sequence
- Tree and timeline
- Comparisons, code and annotations
- Validation

## Document

Input is UTF-8 Markdown, optional YAML frontmatter, and semantic YAML fences. Level-two headings create chapters (scenes in video). Text before the first chapter is an introduction. Without headings the document becomes one chapter.

```yaml
schema: 1
title: "What the reader will understand"
subtitle: "Optional context"
lang: th             # th or en; inferred if omitted
theme: shadcn        # shadcn or blueprint
mode: auto           # auto, light or dark
video: off           # on enables player; every scene then needs beats
voice: auto          # auto, elevenlabs, local, system or off
```

Surround frontmatter with `---` lines. CLI theme, mode and voice override these fields. Unknown frontmatter keys, unsupported schema versions, duplicate YAML keys and YAML aliases are errors. Maximum spec size is 2 MiB.

IDs start with an ASCII letter and contain letters, numbers, underscores or hyphens (maximum 64 characters). Labels can be Thai, English, emoji or repeated text. IDs must be unique within a scene, including nodes, edges and annotation anchors. Reuse the same ID in another scene for the same object.

## Architecture and flow

Use an architecture or flow fence. Both use this graph model and the bundled Archify router.

```yaml
direction: LR        # LR or TB
nodes:
  user: {label: "🌐 ผู้ใช้", kind: client}
  api: {label: "API", kind: service, description: "HTTP boundary"}
  queue: {label: "Queue", kind: queue}
  db: {label: "Database", kind: database}
edges:
  - {id: request, from: user, to: api, label: "POST /jobs"}
  - {id: enqueue, from: api, to: queue, label: "event", kind: async}
  - {id: write, from: api, to: db, label: "commit"}
groups:
  - {id: platform, label: "Platform", members: [api, queue]}
  - {id: storage, label: "Private data", parent: platform, members: [db]}
```

Node kinds: client, service, database, queue, decision, cloud, external. Native Archify kinds frontend, backend, messagebus, security and the store alias also work. The short form `api: "API"` uses the default service shape.

Edges use from, to, optional label, optional id, and optional kind: async or response. Missing edge IDs become edge-1, edge-2, etc. Supply IDs when beats reference edges or when they persist across scenes. Branches and cycles retain every edge.

Each node belongs directly to at most one group. Nest with parent; do not list a node in both child and parent. A group needs a node or nonempty child. Group IDs are structural; focus member nodes in beats. The compiler measures text conservatively and owns all coordinates.

Large graphs open at readable zoom and scroll within their panel. Fit reveals the entire graph; zoom buttons, drag, scroll and arrow keys allow inspection. Split unrelated topics when one large graph obscures the explanation.

## Sequence

Use a sequence fence with at least two participants. Mapping order sets left-to-right order; message order sets time order.

```yaml
participants:
  client: {label: "Client", kind: client}
  api: {label: "API", kind: service}
  db: {label: "Database", kind: database}
messages:
  - {id: request, from: client, to: api, label: "1 · GET /items/42"}
  - {id: query, from: api, to: db, label: "2 · SELECT", note: "id = 42"}
  - {id: result, from: db, to: api, label: "3 · row", kind: response}
  - {id: reply, from: api, to: client, label: "4 · 200 OK", kind: response}
```

Put meaningful step numbers in labels. note holds payload context; kind: async marks asynchronous messages. Participants can retain IDs in later architecture or sequence scenes.

## Tree and timeline

A tree fence accepts one root mapping or a list. Each item has label, optional id and children. Nesting is limited to 24 levels.

```yaml
- id: repo
  label: "📁 service/"
  children:
    - {id: entry, label: "cmd/"}
    - label: "internal/"
      children:
        - {id: domain, label: "domain/"}
```

A timeline fence accepts an ordered list; dates are displayed, not sorted. Quote dates as text.

```yaml
- {id: draft, date: "Week 1", label: "Design", status: "done"}
- {id: build, date: "Week 2", label: "Implementation", status: "active", detail: "Exercise error paths."}
```

## Comparisons, code and annotations

Use Markdown tables. `[✓]` is positive, `[✗]` negative and `[!]` a warning/trade-off. Include explanatory words. Code fences are escaped verbatim. A diff fence highlights lines starting with + and -.

Use annot for sentence/phrase annotations or code-annot for code tokens. text is the exact source; each note anchors an exact quote. Repeated quotes require a one-based occurrence. Missing or overlapping anchors are errors.

```yaml
text: "retry(); retry();"
notes:
  - id: secondRetry
    quote: "retry"
    occurrence: 2
    note: "The second attempt must remain idempotent."
```

Anchors are keyboard-accessible buttons that reveal notes. Escape text normally in YAML; do not embed HTML. See [video.md](video.md) for beats.

## Validation

Semantic errors return nonzero with line, component, code and optional hint. No partial topology is emitted as a successful diagram. Raw HTML, scripts and external image loads are unsupported. Ordinary HTTP(S)/mail links remain navigable, but no external asset is required.

The HTML receipt confirms schema/geometry and composition checks, not browser/visual review. Multiple SVGs have separate DOM ID namespaces; semantic IDs remain available for scene continuity.
