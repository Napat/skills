# Explainer HTML 0.1.0 acceptance record

Date: 2026-10-05, Asia/Bangkok. One portable package is installed for Codex/Gemini CLI, Claude Code and Antigravity CLI. All four current clients discover the native skill. The agy behavioral trial exposed a return-edge label collision; the compiler repair, source/bundle checks, installed-copy checks and 36 browser cases now pass. Narration, MP4 and job-recovery results below come from the earlier post-rename acceptance run; the later repair did not change the player, voice adapters or exporter.

| Layer | Result | Evidence |
| --- | --- | --- |
| Skill Creator | Passed | Initializer used; quick_validate.py passed; UI metadata and 25 local links checked |
| Repository | Passed | All four skill validators and 52 existing tests passed |
| Source/package | Passed | Rebuilt bundle matches source; 44 pinned Archify files match hashes; relocated package runs without node_modules |
| Compiler/invariants | Passed | 14 tests, including nested cycles, Thai/duplicate labels, cache-hit return-edge repair, annotations, escaped code, TTS contracts, cache symlinks/LRU and concurrent renders |
| Browser | Passed after label repair | 36 cases: six fixtures, Chromium + WebKit, 390/768/1440 px; themes/modes, network isolation, controls, reduced motion, continuity and deterministic seek |
| Visual | Reviewed | Latest cache-hit Fit overview on desktop Chromium and mobile WebKit; earlier architecture/sequence boundaries, Thai player, dark components and MP4 frames; zoom required for dense diagrams at narrow widths |
| Narration | Passed | Real Kanya/Samantha PCM audio; sampled drift 3.149/0 ms, both below 100 ms |
| MP4 | Passed | Actual 1920×1080/30 fps H.264 + AAC; Thai output 15.5 seconds; frame/audio stream checks |
| Export camera | Passed | Eight focused-node observations fit in the 1080p export viewport after camera motion settles; actual settled MP4 frame reviewed |
| Recovery | Passed | Cancel, process kill, hash-verified frame reuse, encoder failure/resume, concurrent jobs and timeout; HTML preserved |
| Cross-host installation | Passed after label repair | Each of three installation directories has all 85 source-matching files; installed verifiers and cache-hit renders pass from an unrelated temporary working directory, without node_modules |
| Codex discovery | Passed | CLI 0.160.0: skills/list finds exactly one enabled user-scope explainer-html in the repository and an isolated workspace |
| Gemini CLI discovery | Passed | CLI 0.62.0: skills list reports explainer-html enabled at the shared ~/.agents/skills path |
| Claude Code discovery | Passed | CLI 2.1.289: native slash-command autocomplete displays /explainer-html and its description |
| Antigravity CLI discovery | Passed | agy 1.2.17: native /skills lists explainer-html in the Global section at ~/.gemini/antigravity-cli/skills |
| Independent Codex forward test | Passed before renaming | First-attempt Thai explanation, two diagrams, three tables, annotation/zoom/source/mobile/offline checks; wrapping observation corrected |
| Claude Code model execution | Blocked on current client | CLI 2.1.289 still reports `Credit balance too low`; discovery and installed compiler pass, but a Claude-generated artifact is not claimed |
| Antigravity CLI behavioral test | Partial | Native invocation read the installed skill and authored a Thai cache-hit spec, exposing the label collision. The corrected compiler passes that same input, but a completed post-repair agent invocation is not claimed; a new external model run awaits explicit transmission authorization |
| ElevenLabs/local live TTS | Not configured | Mocked provider contracts passed; no live claim |

The original implementation includes no answer-me-with-html code/dependency. Archify 3.0.1 is pinned at `2ab3cae7ac2c2a55d7386ca789d03c4fcd31816c` with licenses. Geometry checks are Archify's schema/renderer checks plus page composition validation; this report does not claim Archify's separate showcase/finalize workflow.

Label-repair evidence: the original agy input now passes on attempt 2, preserving all four nodes and four edges. The maintained cache-hit example passes within the same two-repair budget, and a variant with repeated edge labels also passes. Repairs use Archify's measured layout report and stable edge IDs; no pinned vendor code, relationships or label text were removed. Browser checks additionally confirm that Fit includes all four components.

Browser isolation detail: Chromium uses offline mode plus blocked network requests. WebKit 26.6's offline flag fails on even a minimal file URL in this environment; the WebKit run instead aborts every network request before navigation. Neither generated document made a network request. Human listening quality and screen-reader usability are not claimed by the automated audio/browser checks.

Reproducible sources and commands: [maintenance guide](../explainer-html/references/maintenance.md). Work continuity, exact temporary report paths and remaining model-provider checks: [checkpoint](explainer-html-progress.md). Samples are temporary; original semantic examples remain in [examples](../explainer-html/examples).

Installations: `~/.agents/skills/explainer-html` (Codex and Gemini), `~/.claude/skills/explainer-html`, and `~/.gemini/antigravity-cli/skills/explainer-html`. Antigravity desktop/IDE is documented but was not installed or interactively tested in this run. No host-specific fork or legacy command wrapper is required. See [host compatibility and official sources](../explainer-html/references/hosts.md).

Client upgrade verification: Codex 0.155.1 → 0.160.0 through its existing Homebrew cask; Gemini CLI 0.42.0 → 0.62.0 through its existing npm installation; agy 1.1.3 → 1.2.17 through its verified self-updater. Claude Code was already 2.1.289 when the latest-version comparison ran, matching the npm stable tag; no redundant installation was performed. These are the four agent CLIs in scope, not a general machine-wide upgrade.

CLI bundle SHA-256: `2bcfcb5f25449e9bdb9ae08bb3081cdeb6bfd30a74283654497bd649bcb49e91`. Existing `.archify/` output is excluded from publication. Check the repository's Git state and remote for publication status; a local acceptance report is not proof of a successful push.
