# Research: Web Audio Foundations & Cross-Platform Input

*Research task for audiotoy — establishing what we can build on reliably.*

---

## 1. Web Audio API: Current State

### 1.1 Browser Compatibility

The Web Audio API enjoys broad support across all modern browsers, with a compatibility score of ~92% on caniuse.com.

| Feature | Chrome | Firefox | Safari | Edge | Mobile Chrome | Mobile Safari |
|---------|--------|---------|--------|------|---------------|---------------|
| Web Audio API (core) | 35+ | 25+ | 14.1+ | 79+ | 35+ | 14.5+ |
| AudioWorklet | 66+ | 76+ | 14.1+ | 79+ | 66+ | 14.5+ |
| OfflineAudioContext | 35+ | 25+ | 14.1+ | 79+ | 35+ | 14.5+ |
| AnalyserNode | 35+ | 25+ | 14.1+ | 79+ | 35+ | 14.5+ |
| StereoPannerNode | 42+ | 37+ | 14.1+ | 79+ | 42+ | 14.5+ |
| ConstantSourceNode | 56+ | 52+ | 14.1+ | 79+ | 56+ | 14.5+ |

**Key takeaway:** The Web Audio API is production-ready across all target platforms. Safari's support has matured significantly since 14.1 (2021), and mobile Safari — historically the weakest link — now supports AudioWorklet and the full node graph.

### 1.2 AudioWorklet vs ScriptProcessorNode

**ScriptProcessorNode is deprecated.** It should not be used in new projects. All browsers still support it for backwards compatibility, but it has fundamental design flaws:

- Runs on the **main thread**, competing with UI/DOM operations
- Uses asynchronous event handling, introducing unpredictable latency
- Buffer size choices are limited (256–16384 samples) with no fine-grained control

**AudioWorklet is the replacement and our required approach.** It provides:

- Execution on a **dedicated audio rendering thread** — zero main-thread contention
- Synchronous processing alongside built-in AudioNodes
- 128-sample (render quantum) processing blocks (~2.66ms at 48kHz)
- Access to `SharedArrayBuffer` for efficient data sharing with main thread/workers
- WASM integration for near-native DSP performance

**AudioWorklet architecture:**
```
Main Thread                    Audio Thread
─────────────                  ────────────
AudioWorkletNode  ←──port──→  AudioWorkletProcessor
  (DOM side)                    (process() callback)
```

The `AudioWorkletProcessor.process()` method is called synchronously for each render quantum. The processor must return `true` to stay alive or `false` to be garbage-collected.

**Security requirement:** AudioWorklet requires a **Secure Context** (HTTPS or localhost). This is non-negotiable for deployment.

### 1.3 Latency Characteristics

Web Audio latency has three components:

1. **Processing latency** (render quantum): 128 frames ≈ 2.66ms at 48kHz — this is the hard minimum
2. **Output latency** (`AudioContext.outputLatency`): platform-dependent buffering between browser and audio hardware
3. **Input latency** (for microphone): additional buffering from `getUserMedia` → `MediaStreamSourceNode`

**Measured output latency values:**

| Platform | Browser | Typical outputLatency |
|----------|---------|----------------------|
| Desktop Linux/Windows | Chrome | ~24ms |
| Desktop Linux/Windows | Firefox | ~15ms |
| macOS | Chrome | ~10-20ms |
| macOS | Safari | ~10-20ms |
| Android (flagship) | Chrome | ~20-40ms |
| iOS | Safari | ~20-40ms |

**Mobile-specific concerns:**
- Mobile audio stacks add additional buffering layers vs desktop
- Low-latency paths consume significantly more CPU and battery
- `AudioContext.baseLatency` reports the minimum achievable latency for the device
- iOS has historically had higher latency, though recent versions (iOS 17+) have improved

**The `latencyHint` constructor option** allows requesting `"interactive"` (lowest latency), `"balanced"`, or `"playback"` (highest latency, most efficient). For our audio toys, use `"interactive"`:

```javascript
const ctx = new AudioContext({ latencyHint: "interactive" });
```

**Recommendation:** For musical interaction, target total touch-to-sound latency under 20ms on desktop and accept 20-40ms on mobile. This is achievable with AudioWorklet + `"interactive"` latency hint. Users perceive latency above ~50ms as noticeably laggy.

### 1.4 Known Gotchas

#### Autoplay Policy
All modern browsers block `AudioContext` from starting until a user gesture (click, tap, keydown). This is the single most common source of "audio doesn't work" bugs.

**Required pattern:**
```javascript
// Create context early, but it starts in "suspended" state
const ctx = new AudioContext();

// Resume on first user interaction
document.addEventListener('click', async () => {
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}, { once: true });
```

**Best practice:** Show a "Tap to start" / "Click to begin" splash screen. This is standard UX for audio toys and doubles as a loading screen.

The `navigator.getAutoplayPolicy()` method (Firefox 112+, not yet in Chrome/Safari) can detect the current policy state, but cross-browser support is incomplete — don't rely on it.

#### Audio Context Suspension
- `AudioContext` can be suspended by the browser when the tab is backgrounded
- Listen for `ctx.onstatechange` and prompt the user when the context is interrupted
- On iOS Safari, audio contexts are suspended when the device locks or the app is backgrounded — there is no workaround for background audio in a web page

#### Sample Rate Mismatches
- `AudioContext` uses the device's native sample rate by default (commonly 44100 or 48000 Hz)
- Forcing a specific sample rate via the constructor (`new AudioContext({ sampleRate: 44100 })`) is supported but may cause resampling overhead
- **Recommendation:** Accept the device default sample rate and design synthesis algorithms to be sample-rate-independent

#### Safari-Specific Quirks
- Safari's Web Audio implementation has historically lagged behind Chrome/Firefox
- `AudioWorklet` in Safari can have edge-case issues with module loading
- Safari uses a 44100 Hz default sample rate even when the hardware supports 48000 Hz
- Safari limits the number of concurrent `AudioContext` instances (typically to 4-6)
- Test early and often on Safari/iOS — it remains the most likely source of cross-browser bugs

#### Context Limit
- Browsers limit the number of `AudioContext` instances. Chrome allows ~6 per origin.
- **Best practice:** Create a single `AudioContext` per application and reuse it.

---

## 2. Cross-Platform Input

### 2.1 Pointer Events — The Recommended Approach

**Use Pointer Events, not Touch Events.** Pointer Events are the modern, unified input model.

| API | Mouse | Touch | Pen/Stylus | Multi-touch |
|-----|-------|-------|------------|-------------|
| Mouse Events | Yes | No | No | No |
| Touch Events | No | Yes | No | Yes |
| **Pointer Events** | **Yes** | **Yes** | **Yes** | **Yes** |

Pointer Events provide a single event model across all input types with rich properties:

- `pointerId` — unique identifier per active pointer (essential for multi-touch)
- `pointerType` — `"mouse"`, `"touch"`, or `"pen"`
- `pressure` — normalized 0-1 pressure value (touch/pen)
- `width` / `height` — contact geometry (touch)
- `tiltX` / `tiltY` — pen tilt angles
- `isPrimary` — distinguishes the first touch from subsequent ones

**Browser support:** Universal in all modern browsers. No polyfill needed.

**Key events for musical interfaces:**
```javascript
element.addEventListener('pointerdown', onStart);
element.addEventListener('pointermove', onMove);
element.addEventListener('pointerup', onEnd);
element.addEventListener('pointercancel', onEnd);  // Don't forget this!
```

**Critical: Use `touch-action: none` CSS** on interactive elements to prevent browser gestures (scroll, zoom) from stealing pointer events:
```css
.instrument-surface {
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
```

### 2.2 Multi-Touch Handling for Musical Interfaces

Multi-touch is essential for many of our audio toy concepts (Tide Pool, Glass Harmonium, Volcano Drum).

**Pattern: Track active pointers by ID:**
```javascript
const activePointers = new Map();

element.addEventListener('pointerdown', (e) => {
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  element.setPointerCapture(e.pointerId);
});

element.addEventListener('pointermove', (e) => {
  if (activePointers.has(e.pointerId)) {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
});

element.addEventListener('pointerup', (e) => {
  activePointers.delete(e.pointerId);
});
```

**Use `setPointerCapture()`** to ensure move/up events continue even if the pointer leaves the element. This is essential for continuous interactions like sliding along a surface.

**Practical limits:** Most devices support 5-10 simultaneous touch points. Check `navigator.maxTouchPoints` for the device's capability.

### 2.3 Accelerometer / Gyroscope (DeviceOrientation)

Relevant for: Particle Organ (gravity tilt), Glass Harmonium (water sloshing), any tilt-based interaction.

**API:** `DeviceOrientationEvent` and `DeviceMotionEvent`

| Property | Description | Range |
|----------|-------------|-------|
| `alpha` | Rotation around Z axis (compass) | 0-360° |
| `beta` | Front-back tilt | -180° to 180° |
| `gamma` | Left-right tilt | -90° to 90° |
| `acceleration` | Linear acceleration (m/s²) | device-dependent |
| `rotationRate` | Angular velocity (°/s) | device-dependent |

**Platform-specific requirements:**

- **iOS 13+:** Requires explicit permission via `DeviceOrientationEvent.requestPermission()`. Must be called from a user gesture handler. HTTPS required.
- **Android:** Granted automatically, no permission dialog. HTTPS still required.
- **Desktop:** Generally unavailable (no hardware), but some laptops have accelerometers.

**iOS permission pattern:**
```javascript
async function requestMotion() {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    const permission = await DeviceOrientationEvent.requestPermission();
    if (permission === 'granted') {
      window.addEventListener('deviceorientation', handleOrientation);
    }
  } else {
    // Android or desktop — just listen
    window.addEventListener('deviceorientation', handleOrientation);
  }
}
```

**Recommendation:** Treat motion input as an enhancement, not a requirement. Always provide an alternative (e.g., mouse position for tilt on desktop). Use the Generic Sensor API (`Accelerometer`, `Gyroscope`) as a modern alternative where supported (Chrome/Edge only — not Safari/Firefox).

### 2.4 Keyboard Input

Relevant for: Dream Typewriter, desktop fallback controls, MIDI-like keyboard playing.

**Use `KeyboardEvent`** with `event.code` (physical key position) rather than `event.key` (character value) for musical interfaces — ensures consistent mapping regardless of keyboard layout.

**Key considerations:**
- `keydown` fires repeatedly when held — use a `Set` to track held keys and ignore repeats
- `keyup` is needed for note-off events
- Some key combinations are intercepted by the OS/browser (Ctrl+W, Cmd+Q, etc.) — avoid them
- `event.preventDefault()` on handled keys to prevent scrolling (Space, arrows)

**Pattern for musical keyboard:**
```javascript
const heldKeys = new Set();

document.addEventListener('keydown', (e) => {
  if (heldKeys.has(e.code)) return; // Ignore repeat
  heldKeys.add(e.code);
  noteOn(e.code);
});

document.addEventListener('keyup', (e) => {
  heldKeys.delete(e.code);
  noteOff(e.code);
});
```

### 2.5 Microphone Input (getUserMedia)

Relevant for: Breath Garden, Moss Radio, Shadow Puppets (if audio reactive).

**Browser support:** Universal across modern browsers. Requires HTTPS and user permission.

```javascript
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: false,  // We want raw input
    noiseSuppression: false,
    autoGainControl: false,
  }
});
const source = ctx.createMediaStreamSource(stream);
```

**Important constraints for audio toys:**
- Disable `echoCancellation`, `noiseSuppression`, and `autoGainControl` — these are designed for voice calls and will destroy musical/ambient signals
- Microphone permission is per-origin and persistent after first grant
- `MediaStreamSourceNode` feeds live audio into the Web Audio graph
- Latency: typically 10-50ms additional input latency depending on platform
- **Always** provide a visual indicator when the microphone is active (browsers do this in the tab, but show it in-app too)
- On iOS Safari, microphone access requires the page to be in the foreground

### 2.6 MIDI Input (Web MIDI API)

Relevant for: Any toy that could accept external controller input (knobs, pads, keyboards).

**Browser support (as of 2025):**

| Browser | Support |
|---------|---------|
| Chrome | 43+ (full) |
| Edge | 79+ (full) |
| Firefox | 108+ (full, with permission prompt) |
| Safari | **Not supported** |
| Mobile Chrome (Android) | Supported (with USB OTG) |
| Mobile Safari (iOS) | **Not supported** |

**Safari does not and will not support Web MIDI** — Apple has explicitly declined due to fingerprinting concerns.

**Recommendation:** Treat MIDI as a progressive enhancement for desktop users, primarily Chrome/Firefox. Never make it a requirement. For Safari users, MIDI is inaccessible without third-party browser extensions (Jazz-Plugin).

**Basic MIDI input pattern:**
```javascript
if (navigator.requestMIDIAccess) {
  const midi = await navigator.requestMIDIAccess();
  for (const input of midi.inputs.values()) {
    input.onmidimessage = (msg) => {
      const [status, note, velocity] = msg.data;
      if ((status & 0xf0) === 0x90 && velocity > 0) noteOn(note, velocity);
      if ((status & 0xf0) === 0x80 || velocity === 0) noteOff(note);
    };
  }
}
```

---

## 3. Performance

### 3.1 Node and Oscillator Limits

The Web Audio API can handle a substantial number of nodes, but limits depend on device capability:

**Built-in nodes (OscillatorNode, BiquadFilterNode, GainNode, etc.):**
- These run as optimized native code — very cheap individually
- An `OscillatorNode` with linear interpolation wavetable lookup is computationally trivial
- A `BiquadFilterNode` requires 5 multiplications + 4 additions per sample — negligible
- **Desktop:** 200-500+ oscillators with filters is feasible
- **Mobile (flagship):** 50-150 oscillators with filters is a safe budget
- **Mobile (low-end):** 20-50 oscillators — must be conservative

**Expensive operations (in order of cost):**
1. **ConvolverNode** (convolution reverb) — very expensive, especially with long impulse responses. Budget 1-2 per application.
2. **HRTF panning** (`PannerNode` with HRTF model) — uses convolution internally. Use `equalpower` panning instead unless spatial audio is critical.
3. **AnalyserNode with FFT** — moderate cost. Use sparingly for visualization; don't create one per sound source.
4. **DynamicsCompressorNode** — moderate cost. One per output bus is fine.
5. **WaveShaperNode** — cheap if oversample is `"none"`, expensive with `"2x"` or `"4x"` oversampling.

**AudioWorklet (custom DSP):**
- Compute budget per render quantum (128 samples) at 48kHz: ~2.66ms
- If `process()` takes longer than 2.66ms, audio glitches (buffer underruns)
- WASM-based processors are 2-10x faster than equivalent JavaScript
- Profile with Chrome DevTools → Performance → enable "Web Audio" category

### 3.2 WebGL/Canvas + Audio Performance Budgets

For our audio toys, visuals and audio compete for the same CPU/GPU resources.

**Frame budget at 60fps:** 16.67ms per frame for rendering.

| Rendering approach | When to use | Performance |
|-------------------|-------------|-------------|
| **Canvas 2D** | Simple shapes, particles (<1000), UI overlays | Low GPU usage, moderate CPU |
| **WebGL** | Particles (1000+), shaders, reaction-diffusion, complex scenes | High GPU usage, low CPU |
| **CSS/SVG** | Static UI, simple animations | Lowest overhead |

**Practical budgets for audio toys:**

- **Audio thread:** Must complete processing within each render quantum (~2.66ms). This runs on a separate thread and doesn't directly compete with visuals.
- **Visual rendering (main thread):** Target 60fps (16.67ms/frame). On mobile, 30fps may be acceptable as a fallback.
- **Interaction handling (main thread):** Pointer events, UI updates — shares the main thread with visual rendering.

**Key insight:** AudioWorklet runs on a separate thread, so audio processing doesn't block rendering and vice versa. This is a major architectural advantage — heavy DSP in an AudioWorklet won't cause visual jank, and heavy rendering won't cause audio glitches (as long as neither thread starves the system of resources).

**WebGL recommendations:**
- Use WebGL for particle systems (Murmuration, Grain Storm), reaction-diffusion (Magma Flow), and any visualization with >500 animated elements
- Use Canvas 2D for simpler interfaces (Dream Typewriter, Constellation Engine, Light Table)
- Use `requestAnimationFrame` for all visual updates — never use `setInterval`
- On mobile, consider halving resolution (`canvas.width = window.innerWidth * 0.5 * devicePixelRatio`) for demanding effects

### 3.3 Graceful Degradation Strategies

1. **Feature detection first:** Check for AudioWorklet, getUserMedia, DeviceOrientation, Web MIDI before using them
2. **Performance tier detection:**
   - Check `navigator.hardwareConcurrency` for CPU core count
   - Check `navigator.deviceMemory` (Chrome only) for RAM
   - Measure actual AudioContext render time via `AudioContext.outputLatency`
   - Run a brief benchmark on first load (e.g., create 50 oscillators, measure glitches)
3. **Adaptive quality:**
   - Reduce oscillator/voice count on weaker devices
   - Lower visual fidelity (fewer particles, simpler shaders)
   - Increase buffer sizes for stability at the cost of latency
   - Disable convolution reverb, switch to delay-based reverb
4. **Fallback path:** If AudioWorklet is unavailable (very old browsers), either show an "update your browser" message or fall back to ScriptProcessorNode with a performance warning. Given our target audience, requiring a modern browser is acceptable.

---

## 4. Existing Art: Survey of Web Audio Toys & Instruments

### 4.1 Notable Projects

| Project | Interaction | Synthesis | Notable Pattern |
|---------|-------------|-----------|-----------------|
| **Patatap** (Jono Brandel) | Keyboard tap | Sample playback via buffer sources | Immediate audiovisual feedback; one key = one sample + animation |
| **Chrome Music Lab** (Google Creative Lab) | Various (touch, draw, arrange) | Tone.js-based synthesis | 14 experiments; educational focus; Song Maker uses grid sequencing |
| **Blob Opera** (Google Arts & Culture) | Drag to control vocal formants | ML-based vocal synthesis (DDSP) | Machine learning for real-time vocal modeling |
| **Ableton Learning Music** | Click/tap on grid | Sample + synth playback | Structured lessons; constraint-based composition (can't make "wrong" sounds) |
| **Typatone** (Lullatone) | Typing | Tone mapping per letter | Similar concept to our Dream Typewriter |
| **Plink** (DinahMoe) | Multiplayer touch/click | Pentatonic synth | Real-time multiplayer web audio via WebSocket |
| **Beadz** (various) | Circular step sequencer | Varied | Common pattern: circular/radial sequencer layout |
| **Viktor NV-1** | Knobs, sliders, keyboard | Full subtractive synth | Web-based virtual analog synthesizer |
| **Synth Kitchen** | Modular patching | Modular synth routing | Drag-to-connect modular synthesis interface |
| **Theremin** (femurdesign) | Mouse/touch position | Oscillator with vibrato | X = pitch, Y = volume; simplest possible mapping |

### 4.2 Patterns from Successful Projects

1. **Immediate feedback:** The best toys produce sound on the very first interaction with zero setup. Patatap and Chrome Music Lab both achieve this.
2. **Constraint-based design:** Pentatonic scales, pre-tuned grids, and harmonic constraints ensure that random input produces pleasant output (Ableton Learning Music, Song Maker).
3. **Visual-sonic coupling:** Every visual change corresponds to a sonic change and vice versa. This is universal across successful audio toys.
4. **Progressive disclosure:** Start simple, reveal depth over time. Chrome Music Lab's experiments start with a single interaction type and layer complexity.
5. **Shareable output:** Song Maker's shareable URLs drove viral adoption. Consider how outputs can be saved/shared.
6. **Single-page, instant-load:** Most successful audio toys are single-page applications with minimal dependencies. Loading screens kill the impulse to play.

### 4.3 Libraries and Frameworks

| Library | Purpose | Size | When to use |
|---------|---------|------|-------------|
| **Tone.js** | Full music framework: synths, effects, sequencing, transport | ~150KB min | Complex musical applications needing scheduling, sequencing, or rich synthesis |
| **Howler.js** | Audio playback: sprites, spatial, formats | ~7KB gzip | Sample playback, game audio, sound effects |
| **standardized-audio-context** | Cross-browser Web Audio wrapper | ~30KB | If you need to smooth over browser differences |
| **RNBO** (Cycling '74) | Export Max/MSP patches to Web Audio | Varies | If prototyping DSP in Max first |
| **Elementary Audio** | Functional reactive audio | ~50KB | If you prefer a functional programming model for DSP |

**Recommendation for audiotoy:**

**Use the Web Audio API directly, not Tone.js.** Rationale:
- Our toys need custom synthesis (physical modeling, granular, spectral) that Tone.js doesn't provide out of the box
- AudioWorklet-based custom DSP is our primary synthesis approach
- Tone.js adds scheduling and transport abstractions we may not need (our toys are mostly real-time interactive, not sequenced)
- Direct API use gives us full control over performance optimization
- Tone.js's architecture still relies partly on ScriptProcessorNode for some features (though it's migrating)

**Consider Tone.js selectively** for toys that need sequencing (Constellation Engine's sweeping beam, Cellular Choir's step-based playback) — it can be used alongside direct API usage.

**Howler.js** is useful only if a toy needs sample playback with format fallbacks, but our focus on synthesis makes it less relevant.

---

## 5. WASM + AudioWorklet Integration

For computationally demanding synthesis (physical modeling, granular, spectral), compiling DSP code to WebAssembly and running it inside an AudioWorklet provides the best performance.

### Architecture

```
Main Thread                 Audio Thread
─────────────               ────────────
JS App Logic                AudioWorkletProcessor
  │                           │
  ├─ SharedArrayBuffer ──────►├─ WASM Module
  │   (parameter data)        │   (DSP processing)
  │                           │
  └─ AudioWorkletNode ◄──────┘
      (output to speakers)
```

### Requirements

- **Cross-origin isolation headers** required for `SharedArrayBuffer`:
  ```
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  ```
- WASM modules must be loaded inside the AudioWorklet scope
- Emscripten supports direct AudioWorklet targeting via `-sAUDIO_WORKLET -sWASM_WORKERS`
- Rust/wasm-pack can also target AudioWorklet, though with more manual setup (see `docs/research-wasm-synthesis.md`)

### Performance Expectations

- WASM DSP is typically **2-10x faster** than equivalent JavaScript in an AudioWorklet
- A WASM physical modeling engine can handle complex multi-oscillator synthesis within the 2.66ms render quantum budget
- Memory management is explicit — no garbage collection pauses in the audio thread

---

## 6. Recommendations for audiotoy

### API Choices

| Concern | Recommendation | Rationale |
|---------|---------------|-----------|
| Audio synthesis | **Web Audio API (direct)** + AudioWorklet | Full control, maximum performance |
| Complex DSP | **WASM in AudioWorklet** | Near-native performance for physical modeling, granular |
| Input handling | **Pointer Events** | Unified mouse/touch/pen; multi-touch built-in |
| Motion sensing | **DeviceOrientation/Motion** | Wide mobile support; progressive enhancement only |
| Keyboard | **KeyboardEvent (event.code)** | Layout-independent key mapping |
| Microphone | **getUserMedia** with raw constraints | Universal support; disable voice processing |
| MIDI | **Web MIDI API** | Progressive enhancement; no Safari support |
| Visuals (simple) | **Canvas 2D** | Sufficient for most interfaces |
| Visuals (complex) | **WebGL** | Particle systems, shaders, reaction-diffusion |

### Architecture Principles

1. **Single AudioContext** per application — create on first user gesture
2. **AudioWorklet for all custom DSP** — never use ScriptProcessorNode
3. **WASM for heavy synthesis** — physical modeling, granular clouds, spectral processing
4. **Pointer Events for all interaction** — with `touch-action: none` on instrument surfaces
5. **Feature detection, not browser detection** — check for capabilities, degrade gracefully
6. **HTTPS everywhere** — required for AudioWorklet, getUserMedia, DeviceOrientation

### Mobile-First Design Constraints

- Touch is the primary input; mouse/keyboard are secondary
- Budget 50-100 simultaneous voices on mobile (less on low-end)
- Use `"interactive"` latency hint but accept 20-40ms on mobile
- Test on real iOS Safari early and continuously — it's the most constrained platform
- Provide visual "Tap to start" for autoplay policy compliance
- Handle `visibilitychange` events to pause/resume AudioContext

### Cross-Origin Requirements

If using WASM + SharedArrayBuffer in AudioWorklet, the server must send:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```
This affects all resources on the page (images, fonts, scripts must be same-origin or have CORS headers). Plan for this from the start.

---

## Sources

- [Web Audio API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [AudioWorklet — MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
- [Web Audio API — Can I use](https://caniuse.com/audio-api)
- [AudioWorklet API — Can I use](https://caniuse.com/mdn-api_audioworklet)
- [Web Audio API performance and debugging notes](https://padenot.github.io/web-audio-perf/)
- [AudioContext.outputLatency — MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/outputLatency)
- [Audio Worklet Design Pattern — Chrome Developers](https://developer.chrome.com/blog/audio-worklet-design-pattern/)
- [Autoplay guide — MDN](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)
- [Web Audio API best practices — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)
- [Pointer Events — W3C](https://www.w3.org/TR/pointerevents3/)
- [Multi-touch interaction — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Multi-touch_interaction)
- [Device orientation events — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Device_orientation_events)
- [getUserMedia — MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [Web MIDI API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API)
- [Web MIDI API — Can I use](https://caniuse.com/midi)
- [Emscripten Wasm Audio Worklets](https://emscripten.org/docs/api_reference/wasm_audio_worklets.html)
- [High Performance Web Audio with AudioWorklet — Mozilla Hacks](https://hacks.mozilla.org/2020/05/high-performance-web-audio-with-audioworklet-in-firefox/)
- [Tone.js](https://tonejs.github.io/)
- [Howler.js](https://howlerjs.com/)
- [Chrome Music Lab](https://musiclab.chromeexperiments.com/)
- [standardized-audio-context](https://github.com/chrisguttandin/standardized-audio-context)
