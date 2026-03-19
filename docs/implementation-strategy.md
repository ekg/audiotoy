# Implementation Strategy: Audio Toy Workgraph Design

*How to structure the workgraph for implementing all 16 audio toys — the task pattern, quality gates, shared infrastructure, and scaling approach.*

---

## 1. Task Pattern Per Toy

Each toy is a single self-contained HTML file built on the shared scaffold (`scaffold/lib/*.js`). The task pattern varies by complexity tier.

### Phase 1: S-Complexity (Pendulum Choir, Volcano Drum, Dream Typewriter, Constellation Engine)

```
implement-{toy}  ──▶  verify-{toy}
```

**Two tasks per toy.** S-complexity toys use only pure Web Audio API and Canvas 2D — no WASM, no WebGL, no camera. A single agent can implement the complete toy (audio + visuals + input) in one session.

- **`implement-{toy}`** — Write the full toy as a single HTML file in `toys/{toy}.html`. Uses the scaffold's `createToy()` API. Covers:
  - Audio synthesis graph (oscillators, filters, gain envelopes)
  - Input handling (pointer events, keyboard, multi-touch)
  - Visual rendering (Canvas 2D)
  - Any toy-specific state logic (physics sim, ghost rhythms, sweep beam, etc.)

- **`verify-{toy}`** — Run the audio linter, manually test in browser (desktop + mobile viewport), verify scaffold integration. Fix issues found. This is a quality gate — the toy is not done until verify passes.

**Why two tasks, not more:** S-toys are 200–400 lines of code in a single file. Splitting into sub-tasks (audio, visuals, input) would create more coordination overhead than the work itself. The scaffold handles boilerplate; the agent only writes the toy-specific logic.

**Why not one task:** Separating implementation from verification ensures a fresh perspective on quality. The verifier can run the audio linter objectively and test edge cases the implementer might miss.

### Phase 2: M-Complexity (Drone Painter, Silk Weaver, Breath Garden, Crystal Lattice, Cellular Choir, Moss Radio)

```
implement-{toy}  ──▶  verify-{toy}  ──▶  polish-{toy}
                                              │
                                              ▼
                                        (loop back to verify if needed)
```

**Three tasks per toy.** M-complexity toys introduce new techniques (AudioWorklet, microphone input, complex state management). They're 400–800 lines and may need iteration.

- **`implement-{toy}`** — Same scope as S-toys but more complex. May require an AudioWorklet processor file alongside the main HTML.

- **`verify-{toy}`** — Audio linter + browser testing + interaction testing. For mic-based toys, verify permission flow and fallback behavior. For AudioWorklet toys, verify worklet registration and message passing.

- **`polish-{toy}`** — Address issues from verification. Tune audio parameters for musicality (use spectrogram visual assessment). Optimize for mobile performance. This task has `--max-iterations 2` — if verification is clean, skip polish.

**File scope:** Some M-toys need 2 files (HTML + AudioWorklet processor JS). Both files live in `toys/`.

### Phase 3: L-Complexity (Murmuration, Shadow Puppets, Grain Storm, Magma Flow, Mycelium Network, Tide Pool)

```
implement-{toy}-engine  ──┐
                          ├──▶  integrate-{toy}  ──▶  verify-{toy}  ──▶  polish-{toy}
implement-{toy}-shell   ──┘
```

**Four tasks per toy.** L-complexity toys have heavy computational components (WASM, WebGL, camera processing) that are architecturally separate from the Web Audio toy shell.

- **`implement-{toy}-engine`** — Build the computational engine: WASM module (Rust), WebGL shaders, or camera pipeline. This is the novel, technically challenging work. Output: a standalone module that can be tested independently.

- **`implement-{toy}-shell`** — Build the toy's audio + visual + input layer using the scaffold, with placeholder/mock data where the engine will plug in. This can run in parallel with the engine task since they modify different files.

- **`integrate-{toy}`** — Wire engine into shell. Connect WASM to AudioWorklet, WebGL to render loop, camera to audio parameters. This is where the pieces come together. Depends on both engine and shell.

- **`verify-{toy}`** and **`polish-{toy}`** — Same as M-tier.

**Parallel opportunity:** Engine and shell tasks can run simultaneously (different files). This halves the wall-clock time for the most complex toys.

---

## 2. Quality Gates

### Gate 1: Audio Linter (Automated — must pass)

Every toy must pass the audio linter before being marked as done. The linter (`tools/audio-lint.js`) runs against the toy in a headless browser using `OfflineAudioContext`:

| Check | Method | Threshold |
|-------|--------|-----------|
| **Renders without error** | Page loads, no JS errors | Pass/fail |
| **Not silent** | Max absolute sample > 0.001 | Pass/fail |
| **No clipping** | Samples at ±1.0 | Fail if >0.1% |
| **No DC offset** | Mean of samples | Fail if \|mean\| > 0.01 |
| **Some evolution** | Spectral flux CV | Warn if < 0.05 |
| **Frequency balance** | Per-band energy vs pink noise ref | Warn if >10dB deviation |
| **Dynamic range** | RMS variation | Warn if < 6 dB |

The linter is a shared infrastructure task (`build-audio-linter`) that must be built before verify tasks run.

### Gate 2: Interaction Testing (Manual checklist in verify task)

Each verify task includes a checklist:
- [ ] Toy loads and shows splash screen
- [ ] First touch/click produces sound immediately
- [ ] Multi-touch works (for pointer-based toys)
- [ ] Keyboard input works (for keyboard-based toys)
- [ ] Volume slider works
- [ ] Play/pause works
- [ ] Canvas resizes on window resize
- [ ] No console errors
- [ ] Acceptable performance (60fps visual, no audio glitches)

### Gate 3: Musicality Assessment (Spectrogram — for polish tasks)

During polish, generate a spectrogram and assess:
- Is there harmonic structure (not just noise)?
- Does the sound evolve over time?
- Is there dynamic contrast?
- Does interaction meaningfully change the sound?

This uses the spectrogram generator (`tools/audio-spectrogram.js`) — a later infrastructure task.

### Promotion Flow

```
Draft  ──[linter passes]──▶  Verified  ──[polish complete]──▶  Done
```

- **Draft:** Implementation complete, not yet tested.
- **Verified:** Linter passes, interaction checklist passes.
- **Done:** Polished, musically assessed, ready to ship.

For S-complexity toys, verified = done (no polish task unless verify finds issues).

---

## 3. Shared Infrastructure

### Must Build Before Toy Implementation

| Task | Purpose | Needed By | Files |
|------|---------|-----------|-------|
| `build-audio-linter` | Automated quality gate | All verify tasks | `tools/audio-lint.js` |

### Build Before Phase 2

| Task | Purpose | Needed By | Files |
|------|---------|-----------|-------|
| `build-audio-features` | Feature extraction for snapshot testing | Snapshot harness | `tools/audio-features.js` |
| `build-spectrogram` | Visual musicality assessment | Polish tasks | `tools/audio-spectrogram.js` |

### Build Before Phase 3

| Task | Purpose | Needed By | Files |
|------|---------|-----------|-------|
| `build-wasm-worklet-bridge` | WASM module loading in AudioWorklet | Grain Storm, Magma Flow, Tide Pool, Murmuration | `scaffold/lib/wasm-worklet.js` |
| `build-webgl-scaffold` | Particle systems, shader pipeline | Grain Storm, Murmuration, Magma Flow, Tide Pool | `scaffold/lib/webgl.js` |
| `build-mic-pipeline` | getUserMedia + feature extraction | Breath Garden, Moss Radio, Shadow Puppets | Extends `scaffold/lib/input.js` |

### Not Extracted as Shared (Toy-Specific)

These techniques are used by only 1–2 toys each and don't justify a shared module:
- Karplus-Strong (Crystal Lattice only)
- Reaction-diffusion simulation (Magma Flow only)
- Boids simulation (Murmuration only)
- Silhouette extraction (Shadow Puppets only)
- Game of Life (Cellular Choir only)
- Phonon integration (Mycelium Network, with Pendulum Choir upgrade)

---

## 4. Scaling Strategy

### Concurrency

**Phase 1:** All 4 S-toys can be implemented in parallel — they are independent single-file implementations with no shared state. Maximum 4 concurrent implement tasks + 1 audio-linter task = 5 agents.

**Phase 2:** Up to 3 M-toys in parallel. Each is 1–2 files; no shared file conflicts. Verify and polish tasks serialize per toy but parallelize across toys.

**Phase 3:** Up to 2 L-toys in parallel. Each L-toy has 4 tasks; engine+shell run in parallel within a toy. With 2 toys in flight, that's 4 concurrent tasks. More than 2 L-toys risks resource contention (WASM compilation, WebGL context limits in headless testing).

**Total agent budget:** Peak concurrency of ~5 agents during Phase 1, ~4 during Phase 2, ~4 during Phase 3.

### Same Files = Sequential

**Critical rule:** No two tasks should modify the same file concurrently.

- Each toy is its own file (`toys/{name}.html`) — no conflicts between toys
- Shared scaffold files (`scaffold/lib/*.js`) are read-only during toy implementation — they were established by `architecture-common-scaffold`
- Infrastructure tasks modify `tools/` — no overlap with toy files
- If a scaffold bug is discovered, file a separate fix task that blocks the affected toy

### Failure Handling

- **Implement fails:** Agent uses `wg fail` with reason. Coordinator re-dispatches to a different agent.
- **Verify fails:** Agent documents failures in task log. Polish task (or re-implementation) addresses them.
- **Audio linter fails:** Specific failure (clipping, silence, etc.) is logged. Implementer fixes the specific issue.
- **Persistent failure:** After 2 failed attempts, escalate to user. Some synthesis techniques may need design revision.

### Ordering Within Phases

Within each phase, toys are ordered by shared infrastructure overlap:

**Phase 1 order (all parallel, but numbered for priority):**
1. Pendulum Choir — establishes oscillator management pattern
2. Volcano Drum — establishes multi-touch + noise synthesis pattern
3. Dream Typewriter — establishes keyboard + formant synthesis pattern
4. Constellation Engine — establishes spatial placement + additive synthesis + URL sharing

**Phase 2 order (semi-parallel, respecting infrastructure deps):**
5. Drone Painter — painting interaction, oscillator bank (builds on Phase 1 patterns)
6. Silk Weaver — ring modulation, grid composition
7. Breath Garden — microphone input (needs `build-mic-pipeline`)
8. Crystal Lattice — AudioWorklet (needs worklet experience)
9. Cellular Choir — voice pooling, Game of Life
10. Moss Radio — live audio processing (needs mic pipeline + AudioWorklet)

**Phase 3 order (2 at a time, respecting WASM/WebGL deps):**
11. Murmuration — WASM boids + WebGL (needs `build-wasm-worklet-bridge` + `build-webgl-scaffold`)
12. Shadow Puppets — camera input (independent infrastructure)
13. Grain Storm — WASM granular + WebGL particles (shares infra with Murmuration)
14. Magma Flow — WASM reaction-diffusion + WebGL shaders
15. Mycelium Network — Phonon integration (depends on Phonon WASM port)
16. Tide Pool — WASM waveguide mesh + WebGL (most complex, built last)

---

## 5. Task Creation Template

### For creating a toy implementation task:

```bash
wg add "Implement: {Toy Name}" \
  --after strategy-implementation-workgraph \
  --verify "node tools/audio-lint.js --url http://localhost:3000/toys/{toy-slug}.html --duration 10 passes all Tier 1 checks" \
  -t "phase-{n},toy,{complexity}" \
  -d "## Objective
Implement {Toy Name} as a self-contained HTML file at toys/{toy-slug}.html using the scaffold.

### Read First
- docs/candidate-catalog.md § {Toy Name}
- scaffold/README.md
- scaffold/examples/theremin.html (reference implementation)

### Requirements
{Copy from candidate catalog: synthesis technique, interaction model, visual design, technical approach}

### Validation
- [ ] File exists at toys/{toy-slug}.html
- [ ] Uses createToy() from scaffold
- [ ] All interactions from the spec work
- [ ] Audio plays on first user gesture
- [ ] No console errors
- [ ] Responsive to window resize
- [ ] Mobile touch works"
```

### For creating a verify task:

```bash
wg add "Verify: {Toy Name}" \
  --after implement-{toy-slug} \
  --verify "node tools/audio-lint.js --url http://localhost:3000/toys/{toy-slug}.html --duration 10 outputs pass=true" \
  -t "phase-{n},verify,{complexity}" \
  -d "## Objective
Verify {Toy Name} meets quality standards.

### Checks
1. Run audio linter: node tools/audio-lint.js --url http://localhost:3000/toys/{toy-slug}.html --duration 10
2. Open in browser, run through interaction checklist
3. Test on mobile viewport (Chrome DevTools device mode)
4. Check performance (60fps, no audio glitches)

### Validation
- [ ] Audio linter: all Tier 1 checks pass
- [ ] Audio linter: no Tier 2 warnings (or documented exceptions)
- [ ] Interaction checklist: all items pass
- [ ] Mobile viewport: touch works, canvas resizes
- [ ] Performance: no dropped frames or audio glitches in 30s of use"
```

---

## 6. Summary

| Complexity | Toys | Tasks/Toy | Total Tasks | Parallel Capacity |
|------------|------|-----------|-------------|-------------------|
| S (Phase 1) | 4 | 2 | 8 | 4 simultaneous |
| M (Phase 2) | 6 | 3 | 18 | 3 simultaneous |
| L (Phase 3) | 6 | 4 | 24 | 2 simultaneous |
| Infrastructure | — | — | ~6 | As needed |
| **Total** | **16** | — | **~56** | — |

The design optimizes for:
- **Minimal coordination overhead** — S-toys are 2 tasks, not 5
- **Parallel throughput** — independent toys run simultaneously
- **Quality gates** — every toy passes the audio linter before it's done
- **Progressive complexity** — Phase 1 establishes patterns reused by Phase 2 and 3
- **File-level serialization** — no two agents ever touch the same file
