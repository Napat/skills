# Package maintenance and acceptance

Runtime needs the complete skill folder and Node.js 22+. scripts/render.mjs bundles parsers. assets holds original styles/player, src holds compiler source, and vendor/archify holds the pinned renderer/router.

Keep the same package for every host. [Host compatibility](hosts.md) records discovery directories, invocation, optional UI metadata and evidence levels. Validate each installed copy separately; an account or model-provider failure must not be reported as a successful behavioral test.

Archify 3.0.1 commit: 2ab3cae7ac2c2a55d7386ca789d03c4fcd31816c. vendor/archify.lock.json records archive/file hashes. Preserve its license and [notices](../THIRD_PARTY_NOTICES.md). Do not silently update vendor files. answer-me-with-html was a design reference only; no code or assets are included.

In the skill directory:

```bash
npm ci
npm run build
npm run check:bundle
node scripts/verify.mjs
npm test
```

Build regenerates the CLI and source manifest. check:bundle builds in memory and compares bytes. verify.mjs checks bundle/source hashes, vendor, metadata and local documentation links without installing dependencies. Source changes must ship with a rebuilt bundle.

Browser/media tests use development-only Playwright and temporary outputs. Browser processes and macOS speech services may require execution outside a restrictive sandbox.

```bash
npx playwright install webkit
npm run test:browser
npm run test:media
```

PLAYWRIGHT_BROWSERS_PATH selects the browser cache. EXPLAINER_HTML_TEST_DIR and EXPLAINER_HTML_MEDIA_DIR select temporary evidence directories. Media tests need Kanya/Samantha on macOS, Chrome, ffmpeg and ffprobe. Configured ElevenLabs/local providers get live tests; absent configuration is reported separately from mocked contract checks.

Acceptance layers:

1. Skill metadata/links, skill-creator quick_validate.py, repository scripts/validate_skill.py --all.
2. Observable invariants: malformed input, topology, SVG namespaces, escaping, voice contracts, LRU/ownership, concurrency and relocated bundle.
3. Offline Chromium/WebKit at 390/768/1440 px, themes/modes, keyboard controls, annotations, deterministic seek, continuity and reduced motion.
4. Inspect generated screenshots: Thai, narrow layouts, boundaries, annotations. Assertions alone do not prove visual quality.
5. Real Thai/English audio, measured duration/drift ≤100 ms, real 1080p/30fps H.264/AAC, failure/cancel/concurrent/restart recovery. Codec/waveform checks do not replace listening to quality.
6. Independent forward test: copied skill, realistic prompt and raw input in temporary workspace, without expected answers or implementation conclusions. Inspect the actual artifact; fix demonstrated issues.

For development continuity, update the repository checkpoint docs/explainer-html-progress.md after validated stages, with evidence paths and remaining work. A file's existence is not completion evidence.
