# Narrated walkthroughs

Set video: on. Every level-two scene needs a beats fence containing an ordered list. Keep one concise narration sentence per visual change. Stable IDs join objects across scenes; labels may change independently.

```yaml
- narration: "API ค้นข้อมูลในแคชก่อน"
  focus: [api, cache]
  reveal: [cache, lookup]
  state: {cache: active}
- narration: "ถ้าไม่พบ จึงอ่านฐานข้อมูล"
  focus: [api, database]
  reveal: [database, fallback]
  state: {cache: warning, database: active}
```

| Field | Meaning |
| --- | --- |
| narration | Required sentence; also caption/transcript |
| focus | IDs in this scene; camera uses their node bounds |
| reveal | IDs initially dimmed, then revealed at this beat |
| hide | IDs dimmed starting at this beat |
| state | ID → idle, active, done, warning or error |
| duration | Positive seconds for captions-only pacing; audio duration takes precedence |

Reveal/hide/state persist within the scene. Hidden objects remain faintly visible for context. Edges and ordinary component IDs support reveal/state; node IDs provide geometric camera focus. Shared SVG nodes interpolate positions/size, routes follow endpoints, and the camera pans. Transitions last 0.6 seconds, with 0.25 seconds between clips. Reduced motion preserves states without animated movement.

One embedded audio track is the clock. `window.explainerHtml.renderAt(seconds)` drives both playback and export. Controls include play/pause, seek, chapter navigation, transcript jumps and read-all. Space toggles playback and Left/Right seek outside form controls. Narration never starts automatically.

## Voices

| --voice | Behavior |
| --- | --- |
| auto | Configured language-capable ElevenLabs, configured local endpoint, macOS voice, then captions |
| elevenlabs | Require compatible ElevenLabs configuration |
| local | Require configured OpenAI-compatible endpoint |
| system | Require installed macOS voice for the language |
| off | Captions and estimated pacing, no synthesis |

Preferred macOS voices: Kanya (th_TH) and Samantha (en_US), then another installed voice for that locale. This release accepts lang: th/en. Voice assets must already be installed. Explicit selection fails when unavailable; auto records failures and continues. Results identify the provider. A caption preview is written before synthesis and remains available if synthesis fails.

ElevenLabs environment:

- ELEVENLABS_API_KEY: authentication, never place in a spec or HTML.
- ELEVENLABS_VOICE_ID: optional voice ID; defaults to a standard built-in voice.
- ELEVENLABS_MODEL_ID: optional; must advertise the language through /v1/models.

Local environment:

- EXPLAINER_HTML_TTS_URL: HTTP(S) base origin/prefix, without /v1/audio/speech or embedded credentials.
- EXPLAINER_HTML_TTS_API_KEY: optional bearer token.
- EXPLAINER_HTML_TTS_MODEL and EXPLAINER_HTML_TTS_VOICE: provider-specific values.

The local adapter posts input, response_format: wav, stream: false and configured model/voice to the base plus /v1/audio/speech. Response must be 16-bit PCM WAV. Mono/sample-rate conversion happens locally. ElevenLabs uses raw 22050 Hz PCM. Requests time out after 60 seconds; clips are limited to 64 MiB.

Cache keys include provider identity, model, voice, language and text. Rerunning an interrupted spec reuses completed clips. HTML playback needs no key or network. A valid waveform/duration does not prove a voice quality review.

Examples: [Thai narration](../examples/thai-video.md). Read [export.md](export.md) when MP4 or recovery is requested.
