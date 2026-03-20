# Research: Phonon Audio Language

## Executive Summary

Phonon is a Rust-based live coding audio system created by Erik Garrison that combines TidalCycles-style pattern sequencing with a unified sample-rate signal graph. Unlike event-based systems (Tidal, Strudel), Phonon evaluates patterns at 44.1kHz, making patterns first-class continuous control signals. It is a substantial codebase (~160k lines of Rust) with 130+ DSP nodes, a full pattern system, polyphonic sample playback, and live coding support. Phonon is a strong candidate as a foundation for audiotoy, but requires work to target WASM/browser. The most pragmatic path is using Phonon's DSL and compiler as a specification language that generates Web Audio API graphs, while contributing WASM-friendly refactors upstream.

---

## 1. Architecture Deep Dive

### Paradigm: Signal-Graph with Pattern Integration

Phonon is a **hybrid dataflow/imperative** system:

- **Dataflow**: Audio processing flows through a directed graph of signal nodes (oscillators, filters, effects, math ops). Every node evaluates sample-by-sample at the audio sample rate.
- **Pattern-as-signal**: Unlike Tidal/Strudel where patterns generate discrete events, Phonon patterns evaluate at 44.1kHz and produce continuous control signals. A pattern like `"110 220 440"` applied to an oscillator frequency means the frequency literally steps through those values at pattern rate.
- **Imperative shell**: The `.ph` DSL uses bus assignments (`~name: expression`) and an output declaration (`out: expression`) that get compiled to a signal graph.

The core data structures live in `src/unified_graph.rs` (22k lines):
- `Signal` enum: `Value(f32)`, `Node(NodeId)`, `Bus(String)`, `Pattern(String)`, `Expression(Box<SignalExpr>)`
- `SignalNode` enum: ~40 variants covering sources (oscillators, patterns, samples, noise), processors (filters, effects, envelopes), math, and analysis
- `UnifiedSignalGraph`: the main engine holding nodes, buses, sample loader, voice manager, and evaluation state

### Synthesis Primitives

**Oscillators** (4 waveforms + variants):
- `sine`, `saw`, `square`, `triangle` — basic continuous waveforms
- `noise` — white noise generator
- 130+ DSP node implementations in `src/nodes/` including: FM oscillator, PM oscillator, polyblep, additive synth, Karplus-Strong, wavetable, VCO, blip, impulse, granular

**Filters**:
- `lpf`, `hpf` — biquad-based low/high pass with Q control
- Moog ladder, state variable filter (SVF), bandpass, notch, resonz, one-pole, parametric EQ, formant, DJ filter, crossover

**Effects**:
- Reverb (Freeverb, FDN reverb, Dattorro reverb, lush reverb)
- Delay (feedback, tape, multitap, ping-pong)
- Distortion (soft clipping), bitcrusher, chorus, phaser, flanger, tremolo, vibrato
- Compressor, limiter, gate, expander, sidechain compressor
- Vocoder, ring modulator, frequency shifter, pitch shifter, spectral freeze
- Stereo: auto-pan, stereo widener, merger/splitter

**Envelopes**:
- ADSR, AD, AR, ASR envelope generators
- Custom breakpoint envelopes via `segments`
- Envelope follower, onset envelope

**SuperDirt Synths** (7 built-in):
- `superkick`, `supersnare`, `superhat`, `supersaw`, `superpwm`, `superchip`, `superfm`

### Audio Routing / Patching

Signal chaining uses the `#` operator:
```phonon
~bass: saw 55 # lpf 800 0.9 # reverb 0.7 0.5 0.3
```

Bus system provides named signal routing:
```phonon
~lfo: sine 0.25
~bass: saw 55 # lpf (~lfo * 2000 + 500) 0.8
out: ~bass * 0.3
```

Arithmetic operators (`+`, `-`, `*`, `/`) combine signals. Pattern transforms chain with `$`:
```phonon
~drums: s "bd sn" $ fast 2 $ every 4 rev
```

### Runtime

Phonon is an **interpreter** with a two-stage pipeline:
1. **Parse**: `compositional_parser.rs` (3.8k lines) parses `.ph` files into an AST of `Statement`/`Expr` types
2. **Compile**: `compositional_compiler.rs` (11.5k lines) compiles the AST into a `UnifiedSignalGraph`
3. **Evaluate**: The graph evaluates sample-by-sample via `eval_node()` — no JIT, no compilation to machine code

For live coding, the file is re-parsed and re-compiled on every file save, then the graph is atomically swapped (via `arc-swap`) into the audio thread. A ring buffer decouples the synthesis thread from the audio callback for lock-free real-time operation.

Offline rendering (`phonon render`) processes the graph in 512-sample blocks, writing to WAV via `hound`.

---

## 2. WASM / Browser Viability

### Current State: Not WASM-compatible

Phonon cannot currently compile to `wasm32-unknown-unknown`. Key blockers:

| Dependency | Role | WASM-compatible? |
|-----------|------|-----------------|
| `cpal` | Audio output (ALSA/JACK/CoreAudio) | No — uses OS audio APIs |
| `tokio` | Async runtime | Partial — needs `wasm` feature, limited |
| `midir` | MIDI input | No — uses OS MIDI APIs |
| `notify` | File watching | No — uses OS filesystem APIs |
| `crossterm` + `ratatui` | Terminal UI | No — terminal-specific |
| `core_affinity` | CPU thread pinning | No — OS-specific |
| `rack` (VST3 hosting) | Plugin hosting | No — native plugin API |
| `rayon` | Parallel processing | No — uses threads |

**WASM-safe components** (the important ones):
- Pattern system (`pattern.rs`, `mini_notation_v3.rs`) — pure Rust, no OS deps
- Signal graph evaluation (`unified_graph.rs`) — pure math + state, no OS deps
- Parser/compiler (`compositional_parser.rs`, `compositional_compiler.rs`) — pure Rust
- All DSP nodes (`src/nodes/*.rs`) — pure math
- Sample loader — needs file I/O replaced, but the sample decoding logic is portable

### Effort to Add WASM Support

**Medium effort (2-4 weeks)**, structured as:

1. **Feature-gate OS dependencies** (~3 days): Make `cpal`, `midir`, `notify`, `crossterm`, `ratatui`, `core_affinity`, `rack`, `rayon` optional behind a `native` feature flag. The core graph + pattern + compiler have no OS dependencies.

2. **Create `wasm` feature** (~2 days): Add `wasm-bindgen` exports for key APIs: parse program, compile to graph, render N samples. Replace `cpal` output with Web Audio API via `wasm-bindgen`.

3. **Sample loading** (~3 days): Replace file-based sample loading with a mechanism to load samples from `ArrayBuffer` / `fetch()` in the browser.

4. **Audio output bridge** (~3 days): Create a `ScriptProcessorNode` or `AudioWorklet` that calls `graph.process_buffer()` per audio callback.

5. **Testing + integration** (~1 week): Verify DSP behavior matches native. Build minimal web demo.

### Alternative: Transpile to Web Audio API

Instead of running Phonon in WASM, we could **transpile Phonon programs to Web Audio API graphs**:

- Parse + compile the `.ph` program in WASM (lightweight — just the parser/compiler)
- Walk the `UnifiedSignalGraph` and emit equivalent Web Audio API `AudioNode` connections
- Simpler for basic use cases but loses Phonon's sample-rate pattern evaluation (Web Audio nodes don't evaluate patterns at sample rate)
- **Limitation**: Web Audio API has a fixed set of nodes. Phonon's 130+ node types can't all map to native Web Audio nodes. Custom DSP would still need `AudioWorklet` + WASM.

### Recommended Approach: Hybrid

Use WASM for the full Phonon engine via AudioWorklet:
- Parse/compile in a web worker (keeps UI responsive)
- Run the signal graph in an `AudioWorkletProcessor` compiled to WASM
- Samples loaded via `fetch()` and passed as `Float32Array`
- This preserves Phonon's unique sample-rate pattern evaluation

---

## 3. Strengths & Limitations

### Strengths

1. **Unique architecture**: "Patterns as signals" is genuinely novel. Continuous parameter modulation via patterns is impossible in Tidal/Strudel. This creates a different creative space.

2. **Rich DSP library**: 130+ node types covering oscillators, filters, effects, envelopes, analysis, math. Rivals SuperCollider's UGen library.

3. **TidalCycles pattern compatibility**: Full mini-notation support (`"bd(3,8)"`, `"bd*4"`, `"<bd sn>"`, etc.) means existing Tidal knowledge transfers. 40+ pattern transforms implemented.

4. **Pure Rust**: No external audio engine dependency (unlike Tidal→SuperCollider). Single binary, no GC pauses, predictable latency (<1ms).

5. **Live coding**: File-watching with atomic graph swap provides instant feedback. Ring buffer architecture ensures glitch-free audio.

6. **Extensive test suite**: ~12k test annotations, multi-level testing methodology (pattern query, onset detection, audio characteristics).

7. **Same author**: Since Erik is the author of both Phonon and audiotoy, there are no licensing/contribution barriers.

### Limitations & Known Issues

1. **No WASM support** (see above) — requires feature-gating work.

2. **Oscillators are continuous, not event-triggered**: Unlike samples (which use a voice manager), oscillators run continuously. You can't play a "note" on a sine wave that starts and stops — it's always producing sound. The `synth` keyword exists as a workaround for polyphonic event-triggered synthesis, but it's less flexible.

3. **No polyphonic synth voices**: Only 1 instance of each oscillator runs at a time. Multiple simultaneous notes require multiple bus assignments or the `synth` keyword.

4. **Transform chaining order sensitivity**: `s "bd sn" $ rev $ fast 2` doesn't work correctly — transforms must be applied left-to-right.

5. **Large codebase**: 160k lines of Rust with significant technical debt (many `#[allow(clippy::...)]` suppressions, numerous `.bak` files, broken test files named `broke.ph.*`).

6. **Performance**: Sample-by-sample evaluation (not block-based for the core graph) limits throughput vs. block-processing architectures. The `process_buffer` path exists but isn't universally used.

7. **Several known bugs** documented in `broke.ph.*` files:
   - Delay is not bus-specific and not bussable
   - `fast` doesn't properly speed cycles in some contexts
   - Stack operations multiply volume unexpectedly
   - Volume increases unexpectedly
   - Thread count not respected, multithreading has poor performance
   - `ar` (attack-release) envelopes don't exist
   - Can't render in some configurations despite 30% CPU usage

8. **Documentation drift**: Some docs describe features that don't exist or use outdated syntax.

---

## 4. Integration Strategy for Audiotoy

### Option A: Phonon as Backend Synthesis Engine (WASM)

**Approach**: Compile Phonon's core (parser + compiler + signal graph + DSP nodes) to WASM. Run full Phonon evaluation in an `AudioWorkletProcessor`.

**Pros**: Full Phonon expressiveness, sample-rate pattern evaluation, 130+ nodes
**Cons**: Large WASM binary (~5-10MB), 2-4 weeks to port, carries Phonon's bugs and tech debt
**Best for**: If audiotoy wants to be "Phonon in the browser"

### Option B: Phonon as Specification Language

**Approach**: Use Phonon's `.ph` DSL as the authoring format for audio toys. Parse and compile in WASM (lightweight), but generate Web Audio API graphs or custom AudioWorklet configs rather than running Phonon's engine.

**Pros**: Lightweight, familiar syntax for Tidal users, separates specification from implementation
**Cons**: Loses sample-rate pattern evaluation, limited to what Web Audio can express, dual implementation maintenance
**Best for**: If audiotoy has its own audio engine and wants a nice DSL

### Option C: Phonon as Live-Coding Interface

**Approach**: Embed a code editor in the browser that accepts `.ph` syntax. Parse + compile in WASM, then map to whatever audio engine audiotoy uses.

**Pros**: Great for power users, live-coding is a killer feature
**Cons**: Steep learning curve for casual users, still needs a separate audio engine
**Best for**: "Advanced mode" in audiotoy

### Option D: Phonon as Testing/Prototyping Tool (Desktop)

**Approach**: Use desktop Phonon to prototype sounds and patterns, then manually translate to audiotoy's format.

**Pros**: Zero integration work, available today
**Cons**: No automated pipeline, manual translation is error-prone
**Best for**: Initial development phase before proper integration

### Recommended: Option A (full WASM port) with Option D as interim

**Rationale**:
- Phonon's unique value (patterns as signals) only works if we run the actual engine
- The parser/compiler/graph are already pure Rust — WASM porting is mechanical, not architectural
- Having the same author means we can refactor for WASM without upstream friction
- Use Option D immediately for prototyping while the WASM port is built

**Milestone plan**:
1. **Now**: Use desktop Phonon to prototype toy sounds (Option D)
2. **Phase 1**: Feature-gate OS dependencies, create `phonon-core` crate with no OS deps
3. **Phase 2**: Add `wasm-bindgen` exports, build AudioWorklet bridge
4. **Phase 3**: Build web UI with embedded `.ph` editor
5. **Phase 4**: Add toy-specific features (visual feedback, parameter sliders mapped to Phonon buses)

---

## 5. Symbiotic Development

### Bugs We'd Likely Find and Fix

1. **WASM compilation issues**: Feature-gating will expose implicit OS dependencies throughout the codebase
2. **Block processing gaps**: Consistent block-based rendering (needed for AudioWorklet's fixed buffer sizes) would fix performance issues
3. **Transform chaining bugs**: Using transforms heavily in toy definitions would surface ordering issues
4. **Memory management**: WASM's linear memory will expose any hidden memory leaks or unbounded growth
5. **Sample loading**: Browser-compatible sample loading would benefit the project generally

### Features That Benefit Both Projects

1. **`phonon-core` crate**: Separating the engine from CLI/TUI/OS dependencies benefits anyone wanting to embed Phonon
2. **Block-based rendering**: Proper block processing would improve native performance too
3. **Serializable graph**: If we serialize `UnifiedSignalGraph` for WASM transfer, it also enables save/load, undo/redo, and collaborative editing
4. **Visual graph representation**: Audiotoy's UI needs to visualize the signal graph — this visualization could be contributed back as a debugging tool
5. **Presets/patches**: A library of curated sounds for toys would double as Phonon example patches

### Structuring Contributions Back

- **Fork strategy**: Fork phonon, create `wasm` feature branch, contribute WASM-ready refactors as PRs to upstream
- **Crate split**: Propose splitting `phonon` into `phonon-core` (engine) + `phonon-cli` (binary) — this is the highest-value contribution
- **Bug fixes**: Fix `broke.ph.*` issues as encountered
- **Test improvements**: WASM testing infrastructure would benefit upstream
- **Documentation**: Accurate, tested documentation of current behavior

---

## 6. Key Metrics

| Metric | Value |
|--------|-------|
| Language | Rust (edition 2021) |
| Total source lines | ~160,000 |
| Core engine (`unified_graph.rs`) | 22,000 lines |
| DSP node types | 130+ (in `src/nodes/`) |
| Pattern transforms | 40+ |
| Test annotations | ~12,400 |
| Dependencies | 35 direct (many WASM-incompatible) |
| SuperDirt synths | 7 built-in |
| Sample library | 12,532 Dirt-Samples compatible |
| Voice polyphony | 64 simultaneous |
| Sample rate | 44,100 Hz (configurable) |
| Live coding latency | <1ms |

---

## 7. Conclusion

Phonon is a substantial, unique audio system that is well-suited as a foundation for audiotoy. Its "patterns as signals" paradigm is genuinely novel and enables creative possibilities not available in Tidal/Strudel. The codebase is large but functional, with an extensive test suite. The primary challenge is WASM/browser targeting, which requires 2-4 weeks of mechanical refactoring (feature-gating OS deps, adding wasm-bindgen exports). The same-author advantage eliminates the usual friction of building on someone else's project. The recommended path is to use desktop Phonon for immediate prototyping while building a `phonon-core` WASM target, culminating in a full in-browser Phonon engine powering audiotoy's interactive experiences.
