# MP4 export and recovery

Deliver HTML first. Export runs independently without modifying it. Node.js 22+, Chromium/Chrome and ffmpeg with H.264/AAC encoders are required. Runtime npm installation is unnecessary.

```bash
node "<actual-skill-directory>/scripts/render.mjs" export /absolute/path/page.html --format mp4 --json
node "<actual-skill-directory>/scripts/render.mjs" status <job-id> --json
node "<actual-skill-directory>/scripts/render.mjs" cancel <job-id> --json
node "<actual-skill-directory>/scripts/render.mjs" resume <job-id> --json
```

Replace placeholders with real paths/IDs. Add --save /absolute/path/movie.mp4 for a requested permanent destination. By default MP4 lives in its temporary job directory. Complete encoding commits atomically, preserving an older saved file if export fails.

The worker snapshots validated HTML, verifies its hash, starts Chromium with an isolated profile, blocks network, and drives the same renderAt(t) function at 30 fps. Output is 1920×1080 H.264/YUV420p plus AAC. Captions-only pages receive silent audio. Auto mode resolves to light for reproducibility; choose light/dark explicitly for another result. User browser profiles are never used.

## Job states

| State | Action |
| --- | --- |
| queued / running | Inspect phase, nextFrame and totalFrames; avoid duplicates |
| completed | Verify image/audio at output before delivery |
| failed | Read error, fix the environment, resume |
| cancelled | Resume when the user wants to continue |
| interrupted | Worker stopped; resume the existing job |

Frames are written atomically and journaled with SHA-256. Resume validates the immutable snapshot and the longest valid contiguous frame prefix, continuing at the first missing/damaged frame. Incomplete encoding restarts using existing frames. Status detects dead workers even if they could not update their status.

Cancellation signals the isolated worker process group, including browser/encoder, and keeps checkpoints. Completed jobs cannot resume. Changed input or a changed package runtime requires a new render/export. Snapshots with an incompatible runtime are rejected.

Configuration:

- EXPLAINER_HTML_CHROME: absolute browser executable; standard macOS/Linux locations are detected.
- EXPLAINER_HTML_FFMPEG: executable, default ffmpeg on PATH.
- EXPLAINER_HTML_EXPORT_TIMEOUT: worker seconds, default 1800; each resume gets a new timeout.
- EXPLAINER_HTML_CACHE_DIR: empty temporary directory dedicated to this package, not a general-purpose directory.

## Lifetime and continuity

Owned cache directories: runs, audio, jobs. Default budget: 512 MiB/72 hours using LRU. Active processes remain protected even above budget. Cleanup follows no directory symlinks and never visits saved files outside the cache. Run gc --json for explicit collection.

Stopped jobs remain resumable while temporary files exist. For a long pause, preserve the spec at a user-approved destination and retain the job ID in task progress. OS cleanup/eviction can remove checkpoints; they are not a permanent archive.

For interrupted compilation, locate source.md, optional preview.html, result.json and manifest.json in the returned run directory. Rerun the source; cached audio is reused. Never infer completion from a partial frame/audio file. Report the usable HTML separately when MP4 fails.
