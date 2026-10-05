# Explainer HTML implementation checkpoint

User-approved implementation, 2026-10-05. The latest requests authorize current skill-standard review, one shared package for Codex/Claude Code/Gemini CLI/Antigravity, stable client upgrades before testing, local installation for Codex/Claude/agy, and commit/push to `Napat/skills`. Upgrades and native discovery are complete. The agy trial exposed a return-edge label overlap; a compiler repair and regression test are implemented and pass. All 36 browser cases pass and all three installed copies match the final package. Implementation and installation acceptance are complete, with external model checks limited as recorded below. Determine Git publication status from the local commit and remote, as described in the resume instructions. Preserve untracked `.archify/` user output and exclude it from the commit. Do not copy code from answer-me-with-html.

## Decisions

- Canonical package: `explainer-html/`; same package for Codex, Claude Code, Gemini CLI and Antigravity. Use native skill discovery and no legacy command wrapper.
- Original compiler, layout, CSS, player, TTS and exporter. Archify renderer/router only, vendored under its MIT license.
- Archify 3.0.1 commit `2ab3cae7ac2c2a55d7386ca789d03c4fcd31816c`; hashes in `vendor/archify.lock.json`.
- Node 22+, prebuilt CLI with bundled parsing dependencies. No runtime npm installation for HTML generation.
- Defaults: shadcn, auto color mode, video off. Thai and English narration.
- Outputs and export jobs live in an owned OS temporary cache; explicit saved files are independent of cleanup.
- Export uses immutable HTML, isolated Chromium, ffmpeg. Checkpoint frames allow a stopped export to resume with the same job ID. Credentials never enter HTML or job metadata.

## Current checkpoint

Latest regression: the original agy-generated cache-hit diagram failed all three spacing-only attempts because its response label remained on the client node. The compiler now reads Archify's structured layout report, maps measured connections back to stable edge IDs and moves obstructed labels within the same two-repair budget. It keeps topology, labels and groups intact; pinned vendor files are unchanged. The failing original input now passes on attempt 2. A regression also covers repeated edge labels. All 14 compiler tests pass, and the rebuilt bundle matches source. Browser checks now include `examples/cache-hit.md` (six fixtures, 36 browser/width cases). The live agy session ended during the approval-service interruption before a successful agent-generated artifact; do not mislabel the subsequent direct compiler reproduction as agy completion.

Current bundle: `2bcfcb5f25449e9bdb9ae08bb3081cdeb6bfd30a74283654497bd649bcb49e91`. All three installed copies were refreshed, matched against the 85-file source manifest and passed the cache-hit regression render from an unrelated directory. Current metadata/reference checks pass with 25 local links.

Initialized with skill-creator. Original compiler, player/themes, TTS, CLI/export/recovery, references/examples and license notices implemented. CLI source/bundle manifest and 44 Archify file hashes verified. Fourteen invariant tests pass, including nested cyclic graphs, duplicate labels, namespace/escaping, status markers preserving code, voice contracts, cache ownership and relocation without node_modules.

The final label repair passed 36 browser cases (six fixtures × three widths × two engines): `/private/tmp/explainer-html-label-repair-browser/browser-report.json`. The earlier post-rename run passed real Kanya/Samantha narration, audio-clock timing and actual MP4, plus cancellation, killed-worker recovery, failed encoder, concurrent jobs and timeout tests: `/private/tmp/explainer-html-media-acceptance/media-report.json`. Voice, player and export code were unchanged by the label repair; those media results were not rerun afterward.

All related identifiers use the new name: folder/frontmatter, `Explainer HTML` display name, `$explainer-html`, `@napat/explainer-html`, `EXPLAINER_HTML_*` environment settings, `window.explainerHtml`, generator/cache ownership, references, tests and bundled CLI. A case-insensitive scan found no old identifiers in the authored package or repository documentation. Skill-creator validation, all four repository validators, 52 existing repository tests, 14 compiler tests and bundle/vendor checks pass after renaming.

Complete copies are installed at `~/.agents/skills/explainer-html` (Codex and Gemini), `~/.claude/skills/explainer-html`, and `~/.gemini/antigravity-cli/skills/explainer-html`. Each has 85 files, 3,176,844 bytes, matching source hashes, excluding development dependencies and caches. The prior Codex installation was backed up in an OS temporary directory. Each installed verifier and cache-hit render passed from an unrelated temporary working directory. Evidence: `/private/tmp/explainer-html-cross-host-install.json` includes the latest hashes, installed verifier results and cache-hit renders. The older `cross-host-smoke.json` covers the previous architecture-only smoke run and is not the final installation receipt.

All four hosts discover the native skill: Codex `skills/list` finds one enabled entry in two workspaces; Gemini `skills list` shows Enabled at the shared path; Claude's slash autocomplete shows `/explainer-html`; agy's `/skills` shows the Global entry. Evidence: `/private/tmp/explainer-html-{codex,gemini,claude,agy}-discovery.json`. These observations are distinct from model behavior and browser/media acceptance. No legacy command wrapper was installed.

Verified current stable clients: Claude Code 2.1.289 (already current when checked against npm), Codex 0.160.0 (upgraded from 0.155.1 through Homebrew), Gemini CLI 0.62.0 (upgraded from 0.42.0 through npm), and agy 1.2.17 (upgraded from 1.1.3 through its verified updater). The original installation managers and account settings are retained.

Standard review is recorded in `references/hosts.md`. Requirements stay in the body rather than the optional compatibility frontmatter field because the installed skill-creator validator does not recognize that newer optional field. The shared name/description/license frontmatter passes both validators. The latest package checks found 25 reference links, 15 source inputs and 44 vendor files; all 14 compiler tests pass; the 52 repository tests passed during the host-compatibility work and their source was unchanged by the later label repair.

The independent forward test before renaming completed: a Thai queued-job explanation compiled on the first attempt, with real Chrome checks and offline reload. It found a mobile number wrapping issue; fixed with non-wrapping, non-shrinking counters. Browser checks cover player zoom/pan, SVG keyboard activation and reduced motion. Both original skill validators and all 52 existing repository tests passed before renaming.

Remaining external acceptance: Claude Code 2.1.289 discovers the native skill, but its configured API provider still reports `Credit balance too low`. No successful Claude-generated artifact is claimed. Retry model behavior after the account is usable; discovery and installed compiler checks have passed. ElevenLabs and local endpoint live tests remain unconfigured; their mocked contracts passed. No provider keys or account settings were changed. The original agy invocation found the regression but ended before completion. A new post-repair agy model run was rejected by automatic approval review because it would transmit a local example, skill instructions and standard client context to the external model service. An explicit authorization question is pending; do not retry that transmission through another path without the user's answer. Native discovery and local installed-package rendering already pass. This optional model retest does not block the authorized local installation or Git publication.

Source examples are maintained under `explainer-html/examples`. Temporary artifacts may expire; regenerate from source if absent.

CLI bundle SHA-256: `2bcfcb5f25449e9bdb9ae08bb3081cdeb6bfd30a74283654497bd649bcb49e91`. The canonical manifest is `explainer-html/scripts/build-manifest.json`.

## Resume instructions

1. Read this file, then inspect `git status --short` and `explainer-html/package.json`.
2. Inspect source and tests before overwriting any work. There may be valid work after this checkpoint.
3. Build with `npm run build` in `explainer-html`; `npm ci` only if development dependencies are missing. Runtime consumers use `node scripts/render.mjs`.
4. Run focused tests for the next unfinished stage. Record actual evidence below; distinguish structural, browser, visual and media checks.
5. Run skill-creator quick validation and `python3 scripts/validate_skill.py --all` before delivery.
6. All three installations, four native discovery checks and the final browser suite are complete. Inspect publication first: compare local HEAD with remote main. If unpublished, stage only README.md, docs/explainer-html-acceptance.md, this checkpoint and explainer-html/; commit and push the authorized changes. Do not include `.archify/`, node_modules or temporary acceptance artifacts. Git author is Napat Rungruangbangchan; use the authenticated Napat account per command for this remote without changing the user's globally active GitHub account. Never overwrite remote work or force-push. The optional agy model retest remains gated on the explicit transmission authorization above.
7. For later package changes, rebuild when runtime inputs change, validate, update installed copies and compare hashes. Do not fetch an older GitHub copy over newer local work. Avoid repeating completed browser/media checks without relevant runtime changes. Claude/provider acceptance remains as recorded above.

## Evidence

- Initial repository: `main`, origin `https://github.com/Napat/skills.git`; existing untracked `.archify/` preserved.
- Environment: macOS ARM, Node 22.23.1, Chrome 154, WebKit 26.6, ffmpeg/ffprobe, macOS Kanya/Samantha. Real speech, waveform, duration and codec checks passed; no human listening/voice-quality review is claimed.
- No credential values printed or persisted. Repository publication uses the already authenticated Napat account through a per-process environment; the globally active GitHub account is unchanged.
- Browser sandbox and speech services required an approved unsandboxed process. Sandboxed speech returned an empty WAV; explicit provider mode correctly retained a caption preview and returned failure. Unsandboxed speech passed.
- WebKit 26.6 is installed in an OS temporary browser cache. Use PLAYWRIGHT_BROWSERS_PATH to select that existing cache; do not bundle browser binaries in the skill.
- Final browser run: `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/explainer-html-browsers EXPLAINER_HTML_TEST_DIR=/private/tmp/explainer-html-label-repair-browser npm run test:browser`. All 36 cases passed. These OS temporary reports and browser downloads may expire; reinstall the test browser if absent.
- WebKit's `offline: true` fails even for a minimal local HTML probe on this Mac. WebKit tests instead abort all HTTP(S)/WebSocket requests before opening the file; no network requests occur. Chromium uses both offline mode and request blocking. Record this distinction rather than claiming WebKit's offline flag worked.
- Measured playback drift after renaming: Thai 3.149 ms, English 0 ms in the sampled checks (threshold 100 ms). Thai MP4: 1920×1080, 30 fps, H.264/AAC, 15.5 seconds.
- Visual review before renaming covered Thai player at phone/desktop sizes, shadcn dark components, blueprint sequence, architecture boundaries and MP4 frames. After renaming, re-inspected the mobile Thai player, desktop architecture and Thai MP4. Small-screen overview labels require zoom/pan; wide tables scroll internally. Camera motion takes 0.5 seconds and can temporarily crop incoming nodes. A separate 1080p export-browser check confirmed all eight focused-node observations fit after motion settles: `/private/tmp/explainer-html-media-acceptance/export-focus-report.json`. The reviewed settled MP4 frame is `/private/tmp/explainer-html-media-acceptance/thai-mp4-settled-frame.png`; context outside the focus may remain cropped.
- After the label repair, visual inspection of `/private/tmp/explainer-html-label-repair-browser/chromium-cache-hit-1440.png` and `webkit-cache-hit-390.png` confirmed that Fit includes every component and the repaired labels are clear of nodes. Mobile overview text is small; zoom/pan remains available.
- The workspace approval service temporarily ran out of credits during the preceding attempt; those two commands did not execute. After the user's continuation the same approval path succeeded and final browser/media tests ran. This is resolved, separate from the remaining Claude provider credit issue.
