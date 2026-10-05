---
name: explainer-html
description: Explain technical concepts, architectures, protocols and trade-offs with a standalone offline HTML page, or a narrated visual walkthrough and optional MP4. Use for explicit HTML explanations and technical explanations that benefit from diagrams or interactive steps; ordinary short answers and full application development do not need this skill.
license: MIT
---

# Explainer HTML

Turn a concise semantic explanation into an interactive HTML file. The bundled compiler owns layout, Archify routing, styling and playback. Use the same package in Codex, Claude Code, Gemini CLI and Antigravity. Node.js 22+ and a shell are sufficient for HTML generation. Host setup and discovery checks are in [hosts.md](references/hosts.md); ordinary explanations do not require reading that guide.

## Choose the explanation

Start from the reader's question and the evidence available. Keep one idea per section. Use architecture for relationships, sequence for time-ordered messages, trees for hierarchy, and tables for comparisons. State assumptions as assumptions; a polished diagram is not evidence that a system behaves that way. Do not invent measurements or blanket operational rules. Label illustrative values and architecture choices as assumptions.

Read [syntax.md](references/syntax.md) when authoring a spec. Match the user's language (Thai and English supported in this release). Defaults are shadcn, auto color mode, video off. Use a narrated player when requested; read [video.md](references/video.md) for beats and voices. MP4 is a separate requested export; read [export.md](references/export.md).

## Compile the explanation

Resolve this skill's actual directory from the loaded SKILL.md path, independently of the workspace or host name. Invoke its bundled entrypoint through the host's shell tool; no Codex-specific tools or APIs are required. Do not assume a global render command or install npm packages for normal use. Use --help when the interface is unclear. Pass only semantic content through stdin:

````bash
node "<actual-skill-directory>/scripts/render.mjs" render --engine archify --theme shadcn --mode auto --json <<'SPEC_EOF'
---
schema: 1
title: "A request and its response"
---
## Follow the request
The client asks the service for data.

```architecture
nodes:
  client: {label: "Client", kind: client}
  api: {label: "API", kind: service}
edges:
  - {id: request, from: client, to: api, label: "GET /items"}
```
SPEC_EOF
````

Replace the path placeholder before execution. Do not emit generated CSS, SVG coordinates, scripts or HTML wrappers in the chat. Use this package's pinned renderer, not a separately installed Archify or another layout engine.

If the host's shell does not support the heredoc above, write the same UTF-8 spec to its temporary directory and pass the filename after render. Quote paths, including paths with spaces. Use the host's normal activation and tool-permission flow.

Use IDs for identity and labels for display. Reuse IDs across scenes for persistent objects. Preserve every relationship while repairing input. The compiler tries an initial placement and two geometry repairs. If it still fails, revise the referenced input or split independent topics into sections while retaining the described relationships.

## Deliver and verify

The JSON result provides html, preview, source, provider, warnings and validation. Link the returned absolute HTML path, or open it with an available host file/browser viewer. A platform-specific preview tool is optional. Report narration fallback. Structural validation is automatic; browser checks and visual review are separate activities. Do not describe interactivity, audio playback or MP4 as verified without running the relevant check.

For a complex result, inspect actual labels, scroll/zoom, controls, narrow-screen layout and theme in an available browser. If browser access is unavailable, deliver the structurally validated artifact and identify the unverified check. Compilation is not a screenshot review.

HTML embeds source, runtime, CSS, SVG and any audio. It fetches no fonts, scripts or voices. Markdown links remain links; images become alt text. Raw HTML and code are escaped.

Outputs default to an owned OS temporary cache. Add --save /absolute/path/page.html when the user requests a permanent copy or supplies a destination. Temporary items expire after 72 hours or under the 512 MiB LRU budget. Do not silently copy drafts to persistent user directories.

## Continue after interruption

Keep returned paths and export job IDs in the task's progress note. A successful compile writes a receipt beside its source. Voice failure reports an openable caption preview; rerunning the same spec reuses audio clips. Exports retain immutable snapshots and checked frame checkpoints. Use status followed by resume for stopped jobs; see [export.md](references/export.md) for recovery boundaries.

Examples: [architecture](examples/architecture.md), [cache hit with return edges](examples/cache-hit.md), [sequence](examples/sequence.md), [annotations](examples/components.md), [Thai narration](examples/thai-video.md). Maintainers use [maintenance.md](references/maintenance.md) for packaging and behavioral validation.
