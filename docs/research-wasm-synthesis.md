# Research: Rust/WASM Audio Synthesis

> Research into building high-performance audio synthesis in Rust compiled to WebAssembly for browser-based audio toys.

## 1. Rust Audio Crate Ecosystem

### Key Crates and WASM Compatibility

| Crate | Purpose | WASM-Compatible | Notes |
|-------|---------|-----------------|-------|
| **dasp** | Low-level PCM/DSP primitives (samples, buffers, signal types, conversions) | Yes | No dynamic allocations, no dependencies. Excellent WASM fit. `dasp_graph` adds dynamic audio graph routing. |
| **fundsp** | High-level audio DSP with inline graph notation | Yes | Supports `no_std` (disable `std` feature). Composable, zero-cost abstractions. Current version 0.23.0. |
| **cpal** | Cross-platform audio I/O | Yes | Has dedicated Web Audio and AudioWorklet backends. Requires Rust 1.82+ for wasm32-unknown; nightly for AudioWorklet backend. |
| **synthrs** | Toy synthesizer library (waveforms, filters, envelopes) | Yes | Lightweight. Good for prototyping. Supports basic waveforms and filters. |
| **twang** | Audio synthesis with real-time processing | Partial | Newer crate, less mature ecosystem support. |
| **web-audio-api** | W3C Web Audio API implementation in Rust | N/A (native) | Implements the Web Audio spec natively in Rust — useful for testing audio code outside the browser. |

**Deprecated/Not Recommended:**
- `RustAudio/synth` — deprecated, very old design patterns. The maintainers recommend using `dasp` instead.

### WASM Compatibility Constraints

- **No filesystem access**: Crates that read/write files directly (e.g., WAV I/O) need feature-gating or alternative APIs under WASM.
- **No threading by default**: Standard `std::thread` is unavailable. Threading requires nightly Rust + `atomics` target feature + SharedArrayBuffer.
- **No system audio**: `cpal`'s native backends (ALSA, CoreAudio, WASAPI) are unavailable — the Web Audio backend is used instead.
- **`no_std` advantage**: Crates supporting `no_std` (like `fundsp`, `dasp`) tend to compile to WASM cleanly since they avoid OS-specific APIs.

### Building Custom DSP in Rust — Patterns and Best Practices

1. **Sample-level processing**: Write `process()` functions that operate on `&mut [f32]` buffers (typically 128 samples at 44.1–48kHz). This is the universal interface expected by AudioWorkletProcessor.
2. **Stateful processors**: Encapsulate filter state, phase accumulators, and delay lines in structs that implement a processing trait.
3. **Graph composition**: Use `dasp_graph` for dynamically wiring processors together, or `fundsp`'s inline notation for static graphs.
4. **Avoid allocations in the audio thread**: Pre-allocate all buffers. No `Vec::push()`, no `Box::new()`, no string formatting in the render callback.
5. **Use `#[inline]` liberally**: For small DSP functions called per-sample, inlining is critical for performance.

## 2. WASM Integration

### Compilation Toolchain

**Standard approach (wasm-pack + wasm-bindgen):**
```bash
# Install
cargo install wasm-pack

# Build
wasm-pack build --target web --release
```

This produces:
- `pkg/*.wasm` — the compiled WebAssembly module
- `pkg/*.js` — JavaScript glue code (wasm-bindgen generated)
- `pkg/*.d.ts` — TypeScript type definitions

**For AudioWorklet support (requires nightly):**
```bash
RUSTFLAGS='-C target-feature=+atomics,+bulk-memory,+mutable-globals' \
  cargo +nightly build --target wasm32-unknown-unknown -Z build-std=std,panic_abort
```

### Connecting WASM to Web Audio API (AudioWorklet + WASM)

The standard integration pattern:

```
Main Thread                    Audio Thread (AudioWorklet)
┌─────────────┐               ┌──────────────────────────┐
│ Load WASM   │──postMessage──▶│ AudioWorkletProcessor    │
│ Create      │               │  ├─ Instantiate WASM      │
│ AudioWorklet│               │  ├─ Call process() each   │
│ Node        │               │  │   128-sample quantum   │
│             │◀─postMessage──│  └─ Return audio buffers  │
└─────────────┘               └──────────────────────────┘
```

**Step-by-step:**
1. Fetch/compile the `.wasm` binary on the main thread.
2. Register an `AudioWorkletProcessor` via `audioContext.audioWorklet.addModule()`.
3. Send the compiled WASM module to the worklet via `port.postMessage()`.
4. Inside the worklet, instantiate the WASM module and call into Rust's `process()` function each audio quantum (128 samples).

### The TextEncoder/TextDecoder Problem

**Critical issue**: `TextEncoder` and `TextDecoder` are not available in the AudioWorklet global scope, but `wasm-bindgen` generated JS glue code depends on them for string passing.

**Workarounds:**
1. **Polyfill**: Inject minimal TextEncoder/TextDecoder polyfills into the worklet scope before loading WASM.
2. **Avoid strings entirely**: Design the Rust↔JS interface to use only numeric types and typed arrays. This is the recommended approach for audio code anyway.
3. **Use `waw-rs`**: The [`waw-rs`](https://github.com/Marcel-G/waw-rs) crate abstracts away these issues, providing a clean API for Rust Web Audio Worklets.
4. **Manual binding**: Skip `wasm-pack` and use `wasm-bindgen` directly, manually copying bindings into the worklet processor class.

### Memory Management: Sharing Audio Buffers

**Direct WASM memory access (recommended for audio):**
```javascript
// JS side — read directly from WASM linear memory
const wasmMemory = wasmInstance.exports.memory;
const outputPtr = wasmInstance.exports.get_output_buffer_ptr();
const output = new Float32Array(wasmMemory.buffer, outputPtr, 128);
// Copy to AudioWorklet output
outputChannel.set(output);
```

**Key principles:**
- WASM linear memory is a single `ArrayBuffer` accessible from JS.
- Expose pointers to pre-allocated buffers from Rust via `#[wasm_bindgen]` exported functions.
- Avoid copying where possible — JS can read/write directly into WASM memory via `Float32Array` views.
- Be aware that the `ArrayBuffer` can be invalidated if WASM memory grows — re-create views after any operation that might trigger growth.

### Threading: SharedArrayBuffer and Atomics

**SharedArrayBuffer** enables zero-copy data sharing between the main thread and the AudioWorklet thread:
- Allocate a `SharedArrayBuffer` once, create views in both threads.
- Use `Atomics.store()`/`Atomics.load()` for lock-free parameter updates (e.g., changing a filter cutoff frequency in real-time).
- Avoids `postMessage()` overhead for continuous parameter streams.

**Requirements:**
- Cross-Origin headers: `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.
- Nightly Rust with `-C target-feature=+atomics,+bulk-memory,+mutable-globals`.
- Rebuild the Rust standard library with `-Z build-std`.

**For most audio toy use cases, SharedArrayBuffer is optional** — `postMessage()` for infrequent parameter changes and direct WASM memory access for audio buffers is sufficient and avoids the cross-origin header complexity.

## 3. Performance Characteristics

### WASM vs Native JS for Audio Processing

| Scenario | WASM Advantage | Notes |
|----------|---------------|-------|
| Simple oscillators (sine, square) | Minimal to none | JS is already fast for basic math. The WASM bridge overhead can negate gains. |
| Multi-voice polyphony (8+ voices) | Moderate (1.5–3x) | WASM's predictable performance shines with sustained computation. |
| Complex DSP (FFT, convolution, physical modeling) | Significant (2–5x) | No GC pauses, SIMD support, better memory layout. |
| SIMD-intensive (parallel sample processing) | Large (3–10x) | WASM SIMD (128-bit) is well-supported. Casey Primozic's FM synth demonstrates this. |
| Real-time granular synthesis / many effects | Significant | GC-free execution eliminates unpredictable latency spikes. |

**The crossover point**: For computations that take less than ~10% of the audio quantum budget (~2.9ms at 44.1kHz), JavaScript is fine. When processing approaches 30–50% of the budget (complex synthesis, many simultaneous voices/effects), WASM's predictable performance becomes valuable.

**The most important WASM advantage is not raw speed — it's determinism.** JavaScript's garbage collector can cause unpredictable latency spikes that manifest as audio glitches. WASM with Rust has no GC, making it inherently more suitable for real-time audio.

### Latency Implications

- **AudioWorklet quantum**: 128 samples ≈ 2.9ms at 44.1kHz. This is the minimum latency floor regardless of WASM vs JS.
- **WASM instantiation**: One-time cost of ~5–50ms to compile and instantiate the module. Use `WebAssembly.compileStreaming()` for faster startup.
- **Per-quantum overhead**: Calling into WASM from JS adds ~0.01–0.1ms per call — negligible relative to the 2.9ms quantum budget.
- **SharedArrayBuffer path**: Eliminates `postMessage()` latency for parameter updates, but adds cross-origin deployment complexity.

### Bundle Size Considerations

| Configuration | Typical Size | Compressed (gzip) |
|--------------|-------------|-------------------|
| Minimal synth (no dependencies) | 20–50 KB | 10–25 KB |
| With `fundsp` for DSP graphs | 100–300 KB | 50–150 KB |
| Full engine with multiple effects | 300–800 KB | 150–400 KB |

**Optimization techniques:**
1. **Cargo.toml release profile:**
   ```toml
   [profile.release]
   opt-level = "z"    # Optimize for size
   lto = true         # Link-time optimization
   codegen-units = 1  # Better optimization, slower compile
   strip = true       # Strip debug symbols
   ```
2. **wasm-opt post-processing:** `wasm-opt -Oz` can achieve 10–20% additional size reduction.
3. **Modular bundles:** Compile each audio effect/synth as a separate small WASM module rather than one monolithic binary. Load on demand.
4. **Avoid string-heavy APIs:** Strings bloat WASM bundles. Use numeric interfaces.

**Reference point:** Casey Primozic's 8-operator FM synthesizer compiles to **27 KB compressed** — well within acceptable limits for a web application.

## 4. Architecture Patterns

### Dual-Target Architecture (Native + WASM)

Recommended project structure:

```
audiotoy/
├── crates/
│   ├── dsp-core/          # Pure DSP logic — no platform deps
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   ├── oscillator.rs
│   │   │   ├── filter.rs
│   │   │   └── envelope.rs
│   │   └── Cargo.toml     # no_std compatible, dasp/fundsp deps
│   │
│   ├── wasm-bridge/       # WASM-specific bindings
│   │   ├── src/lib.rs     # #[wasm_bindgen] exports
│   │   └── Cargo.toml     # wasm-bindgen, wasm-pack target
│   │
│   └── native-runner/     # Native audio (for testing/development)
│       ├── src/main.rs    # cpal-based playback
│       └── Cargo.toml     # cpal dependency
│
├── web/                   # JS/TS frontend
│   ├── src/
│   │   ├── audio-worklet-processor.js
│   │   └── audio-engine.ts
│   └── package.json
│
└── Cargo.toml             # Workspace
```

**Key principle:** The `dsp-core` crate contains all audio logic and has zero platform dependencies. It operates on `&mut [f32]` buffers. The `wasm-bridge` and `native-runner` crates are thin wrappers that feed buffers to/from the platform audio system.

### Development Workflow

1. **Write and test DSP in native Rust** — fast compile times, debugger access, direct audio output via `cpal`.
2. **Compile to WASM** when ready to test in browser — `wasm-pack build` in the `wasm-bridge` crate.
3. **Hot-reloading**: Use `cargo watch` + `wasm-pack build` in a watch loop, combined with a dev server that reloads the WASM module. Alternatively, use Vite with a WASM plugin for fast browser reloads.

### Testing Audio Code

- **Unit tests**: Test DSP functions in pure Rust (`cargo test` in `dsp-core`). Assert on output buffers — e.g., verify a sine oscillator produces expected sample values.
- **Property tests**: Use `proptest` to verify invariants (output always in [-1.0, 1.0], filter stability, etc.).
- **Golden-file tests**: Generate reference audio buffers, save as test fixtures, compare against regression.
- **Native playback**: The `native-runner` crate enables listening to audio output directly without browser overhead.
- **`web-audio-api` crate**: Implements the W3C Web Audio API natively in Rust — useful for integration testing the full audio pipeline without a browser.

## 5. Practical Assessment

### When to Use WASM vs Pure Web Audio API

| Use Case | Recommendation | Rationale |
|----------|---------------|-----------|
| Simple tone generator / drone | **Pure Web Audio** | Built-in OscillatorNode, GainNode, etc. are sufficient and zero-setup. |
| Basic effects (delay, reverb using ConvolverNode) | **Pure Web Audio** | Built-in nodes are optimized and well-tested. |
| Interactive UI-driven audio (buttons triggering sounds) | **Pure Web Audio** | Latency isn't critical; complexity is low. |
| Custom synthesis (FM, wavetable, physical modeling) | **WASM** | Need custom algorithms not available as built-in nodes. |
| Polyphonic synth (8+ simultaneous voices) | **WASM** | Predictable performance under load. No GC spikes. |
| Real-time audio effects (custom filters, distortion, granular) | **WASM** | Per-sample processing benefits from WASM speed and determinism. |
| Educational visualizations of audio concepts | **Hybrid** | Use Web Audio for playback, WASM for computation-heavy analysis. |
| Generative / algorithmic music | **WASM** | Complex logic benefits from Rust's expressiveness and performance. |

### Recommendation for This Project

**Start with a hybrid approach:**

1. **Phase 1 — Pure Web Audio API**: Build the initial audio toys using the Web Audio API directly. This gives you:
   - Fastest time to working prototypes
   - Zero build complexity
   - Full browser compatibility
   - Sufficient for simple interactive toys

2. **Phase 2 — Introduce WASM for specific toys**: When a toy requires custom DSP that exceeds Web Audio's built-in capabilities:
   - Create the `dsp-core` Rust crate with the custom algorithm
   - Compile via `wasm-pack` and integrate into the AudioWorklet pipeline
   - Keep the Web Audio API for routing, output, and simple effects

3. **Phase 3 — Expand WASM coverage**: As the library of toys grows and patterns solidify, move more synthesis logic to Rust/WASM for consistency and performance.

**Do not start with WASM for everything.** The development overhead (nightly Rust, cross-origin headers for SharedArrayBuffer, TextEncoder polyfills, complex build pipelines) is significant. Use it where it provides clear value.

### Minimal Starter Template

For when WASM synthesis is needed, the minimal integration looks like:

**Rust side (`dsp-core/src/lib.rs`):**
```rust
#[no_mangle]
pub extern "C" fn process(output: *mut f32, len: usize, phase: f32, freq: f32) -> f32 {
    let output = unsafe { std::slice::from_raw_parts_mut(output, len) };
    let mut p = phase;
    let phase_inc = freq / 44100.0;
    for sample in output.iter_mut() {
        *sample = (p * 2.0 * std::f32::consts::PI).sin();
        p = (p + phase_inc) % 1.0;
    }
    p // return updated phase for next call
}
```

**JS side (`audio-worklet-processor.js`):**
```javascript
class RustSynthProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase = 0;
    this.port.onmessage = (e) => {
      if (e.data.type === 'wasm') {
        WebAssembly.instantiate(e.data.module).then(instance => {
          this.wasm = instance.exports;
        });
      }
    };
  }

  process(inputs, outputs) {
    if (!this.wasm) return true;
    const output = outputs[0][0];
    const ptr = this.wasm.alloc(output.length * 4);
    this.phase = this.wasm.process(ptr, output.length, this.phase, 440.0);
    output.set(new Float32Array(this.wasm.memory.buffer, ptr, output.length));
    return true;
  }
}
registerProcessor('rust-synth', RustSynthProcessor);
```

### Key References

- [FunDSP](https://github.com/SamiPerttu/fundsp) — High-level audio DSP library with WASM support
- [dasp](https://github.com/RustAudio/dasp) — Low-level DSP primitives, zero allocations
- [cpal](https://github.com/RustAudio/cpal) — Cross-platform audio I/O with Web Audio backend
- [wasm-bindgen Audio Worklet guide](https://rustwasm.github.io/docs/wasm-bindgen/examples/wasm-audio-worklet.html) — Official integration example
- [waw-rs](https://github.com/Marcel-G/waw-rs) — Convenience library for Rust Web Audio Worklets
- [Casey Primozic's FM Synth](https://cprimozic.net/blog/fm-synth-rust-wasm-simd/) — Production example of Rust+WASM+SIMD audio
- [Casey Primozic's Wavetable Synth](https://cprimozic.net/blog/buliding-a-wavetable-synthesizer-with-rust-wasm-and-webaudio/) — End-to-end Rust/WASM synth tutorial
- [Processing Web Audio with Rust and WASM (2025)](https://whoisryosuke.com/blog/2025/processing-web-audio-with-rust-and-wasm) — Recent practical guide
- [Rust + WASM Practical Guide (2026)](https://dasroot.net/posts/2026/03/rust-wasm-practical-guide/) — Up-to-date toolchain guide
- [wasm-bindgen TextEncoder issue #2367](https://github.com/rustwasm/wasm-bindgen/issues/2367) — The AudioWorklet TextEncoder/TextDecoder problem
- [wasm-pack AudioWorklet issue #689](https://github.com/rustwasm/wasm-pack/issues/689) — Tracking wasm-pack worklet support
- [Shrinking .wasm Size](https://rustwasm.github.io/book/game-of-life/code-size.html) — Official guide to WASM size optimization
- [Optimizing for Size (wasm-bindgen)](https://rustwasm.github.io/docs/wasm-bindgen/reference/optimize-size.html) — wasm-bindgen size optimization reference
