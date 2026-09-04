# WORLDS — J.A.R.V.I.S. Orb Dashboard

A voice-driven heads-up display: one reactive core orb, a ring of live telemetry
gauges, and a command line that talks back. No frameworks, no build step, no
network calls — open `index.html` and it runs.

## Run it

```bash
# any static server works; file:// works too
python3 -m http.server 8000
# → http://localhost:8000
```

Microphone and speech recognition need a secure context, so use `localhost` or
HTTPS if you want voice. Everything else works straight off the filesystem.

## Controls

| Input | Does |
| --- | --- |
| `Space` | Toggle listening |
| `/` | Focus the command line |
| `Esc` | Cut off speech, stop listening, drop to standby |
| "jarvis …" | Optional wake word — it's stripped before routing |

Type or say: `status`, `power`, `thermal`, `uplink`, `time`, `date`,
`12 * (7 + 3)`, `set a timer for 5 minutes`, `red alert`, `mute`, `clear`, `help`.

## What the orbs actually read

The dashboard is honest about its data. Anything labelled **· SIM** is a
generated waveform for the look; everything else is a real browser signal.

| Orb | Source |
| --- | --- |
| Core | measured frame rate |
| Memory | `performance.memory` JS heap (Chromium), simulated elsewhere |
| Uplink | `navigator.connection.downlink`, simulated where unsupported |
| Power | Battery Status API |
| Audio | live microphone RMS once you grant access |
| Load, Thermal, Shield | simulated |

Gauges only ramp toward red where a high (or low) reading is genuinely bad —
a pegged frame rate and a full battery stay cool-colored.

## Layout

```
index.html              markup + mount points
assets/css/jarvis.css   HUD theme
assets/js/
  util.js               event bus, single rAF loop, canvas DPR fitting
  audio.js              mic analyser (+ synthetic idle signal before permission)
  orb.js                CoreOrb and GaugeOrb canvas renderers
  telemetry.js          the feeds and the orb grid
  voice.js              SpeechRecognition in, speechSynthesis out
  commands.js           intent router + a no-eval arithmetic parser
  app.js                boot sequence, state machine, DOM wiring
tools/build_single.py   inlines everything into one shareable file
```

Every widget draws from one `requestAnimationFrame` loop (`J.onFrame`) and
modules talk over a small event bus (`J.bus`) instead of reaching into each
other's DOM.

## Single-file build

```bash
python3 tools/build_single.py              # dist/jarvis.html  — standalone
python3 tools/build_single.py --fragment   # dist/jarvis.fragment.html — embeddable
```

## Browser support

Speech recognition is Chromium/Safari only; without it the HUD logs a notice and
stays fully usable by keyboard. Speech synthesis, battery, and network info each
degrade the same way — the dashboard never hard-depends on an optional API.
