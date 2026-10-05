# Host compatibility and installation

Checked against official documentation on 2026-10-05. This is one portable Agent Skills package: the same SKILL.md, references, assets, source, bundled CLI and pinned Archify files go to every host. agents/openai.yaml supplies optional Codex UI metadata; the compiler does not read it.

## Shared contract

The [Agent Skills specification](https://agentskills.io/specification) defines name/description, optional metadata, supporting files and progressive disclosure. This package uses only name, description and license in frontmatter. Runtime requirements stay in the body and references so older validators that do not recognize the optional compatibility field can still validate it. It needs neither host-specific tool names nor startup hooks, injected shell commands, MCP servers, model selection or configuration changes. Keep the workflow in SKILL.md and the rendering logic in the bundled Node CLI.

The tested environment is macOS with Node.js 22+. Reading the generated HTML is fully offline. Narration providers and MP4 tools are separate optional capabilities; see [video](video.md) and [export](export.md). Compatibility with a host does not imply every operating system or voice provider has been tested.

## Discovery and invocation

Append explainer-html/ to each directory below. Install at one user path per host to avoid duplicate or stale definitions.

| Host | User directory | Project directory | Explicit use and discovery |
| --- | --- | --- | --- |
| Codex | ~/.agents/skills/ | .agents/skills/ | Use $explainer-html; inspect the skills selector |
| Claude Code | ~/.claude/skills/ | .claude/skills/ | /explainer-html; inspect the slash-command menu |
| Gemini CLI | ~/.agents/skills/ or ~/.gemini/skills/ | .agents/skills/ or .gemini/skills/ | Ask to use explainer-html; gemini skills list or /skills list |
| Antigravity CLI (agy) | ~/.gemini/antigravity-cli/skills/ | .agents/skills/ | /explainer-html; /skills in the TUI |
| Antigravity desktop/IDE | ~/.gemini/config/skills/ | .agents/skills/ | /explainer-html or the skill list in Customizations |

Codex and Gemini CLI can share the same ~/.agents/skills/explainer-html copy. Antigravity CLI and desktop use different global directories. The agy destination above is specifically for the CLI. Respect a deliberately customized host configuration directory instead of creating an unused default location.

Official sources: [Codex](https://learn.chatgpt.com/docs/build-skills), [Claude Code](https://code.claude.com/docs/en/skills), [Gemini discovery](https://geminicli.com/docs/cli/using-agent-skills/), [Gemini authoring](https://geminicli.com/docs/cli/creating-skills/), [Antigravity](https://www.antigravity.google/docs/skills) and [agy command reference](https://www.antigravity.google/docs/cli/reference/).

## Copy the package

Use a complete copy or a host-supported directory symlink. Copying makes installation independent of the development checkout. Exclude node_modules, test-results, .cache and OS metadata. Keep scripts, assets, src, vendor, license files and references together. Running from another working directory must still work.

Example for a new Codex/Gemini user installation, from the repository root:

```bash
target="$HOME/.agents/skills/explainer-html"
mkdir -p "$target"
rsync -a --exclude=node_modules --exclude=test-results --exclude=.cache --exclude=.DS_Store explainer-html/ "$target/"
node "$target/scripts/verify.mjs"
node "$target/scripts/render.mjs" render "$target/examples/architecture.md" --json
```

For Claude Code or agy, substitute the user directory from the table. Before updating an existing copy, compare it with the source and preserve local modifications. Do not copy build outputs or credentials from an agent's configuration directory into this package.

Codex detects changed skills automatically; use the next turn or restart if discovery has not refreshed. Gemini supports /skills reload. Start a fresh Claude Code or agy session after installation when necessary. Gemini may request skill-activation consent; installation does not bypass the host's permission controls.

## Host versions

Use current stable clients with native Agent Skills support. When discovery fails on an older client, check its official upgrade instructions and obtain authorization before upgrading the application. Verify the version of the executable actually selected by PATH after an upgrade. Keep one native skill installation per host instead of maintaining duplicate legacy slash-command wrappers.

## Verification boundaries

1. Package: run scripts/verify.mjs and the bundled compiler from each installed path, including a workspace outside the package. Compare installed file hashes with the canonical source.
2. Discovery: use the host's real selector/list command. Files on disk alone do not prove discovery.
3. Behavior: use a short realistic request in a temporary workspace, check the output, and record which host actually performed the task. Provider login, quota and credits can block this step independently of installation.
4. Browser/media: use the [maintenance checks](maintenance.md) for offline behavior, narration and MP4. Do not substitute successful host discovery for these checks.
