# Research: Agent Musicality & Aesthetic Evaluation

How can autonomous agents evaluate the musicality and aesthetic quality of the audio synthesis they create? This document surveys perceptual metrics, aesthetic heuristics, practical tooling, and testing strategies — then distills them into a minimum viable "taste engine" for agent-driven audio development.

---

## 1. Perceptual Metrics

### 1.1 Spectral Analysis

These are the workhorses of computational audio analysis. Each captures a different facet of timbral character.

**Spectral Centroid** — the "center of mass" of the spectrum, measured in Hz. Higher values correlate with perceived brightness. A centroid consistently above ~5 kHz suggests harshness or excessive high-frequency energy; below ~300 Hz suggests muddiness. For audio toys, a centroid in the 800–3000 Hz range typically sounds present and engaging without being fatiguing.

**Spectral Flux** — the frame-to-frame change in spectral energy. High flux means the sound is evolving rapidly (percussive attacks, timbral sweeps). Low flux means stasis. Interesting audio typically has moderate flux with occasional peaks — pure stasis is boring, constant high flux is chaotic. This is one of the best single metrics for "is something happening?"

**Spectral Flatness** — ratio of geometric mean to arithmetic mean of the power spectrum (0 = tonal, 1 = noise-like). Values near 0 indicate clear pitch content; values above 0.8 indicate predominantly noise. Most pleasing audio sits between 0.05–0.5, with variation over time. A flatness that never changes suggests the sound lacks timbral evolution.

**Spectral Rolloff** — the frequency below which a given percentage (typically 85%) of spectral energy is concentrated. Useful for detecting if audio is too bass-heavy or too bright.

**Spectral Bandwidth** — the width of the spectrum around the centroid. Narrow bandwidth = focused tone; wide = rich/complex. Audio toys benefit from moderate-to-wide bandwidth to sound full.

#### What These Tell Us About "Interestingness"

A single static metric says little. The *variance over time* of each metric is what correlates with perceived interestingness:
- **Static centroid + low flux** = drone or stuck tone → boring
- **Varying centroid + moderate flux** = evolving timbre → engaging
- **High flux + high flatness** = noise chaos → fatiguing
- **Periodic centroid oscillation + low flatness** = melodic movement → musical

**Recommendation:** Track each metric's mean, variance, and range over 5–10 second windows. Flag audio where any metric's variance is near zero (stasis) or where all metrics have high variance simultaneously (chaos).

### 1.2 Roughness & Dissonance

**Plomp-Levelt Model** — when two sinusoidal components are close in frequency (within ~25% of the critical bandwidth), they produce beating that is perceived as roughness. Maximum roughness occurs at about 25% of the critical bandwidth apart (~30 Hz at low frequencies, ~75 Hz in the midrange). This is the psychoacoustic basis for consonance/dissonance.

**Practical calculation:** Decompose the signal into partials (via FFT peaks or sinusoidal modeling), compute pairwise roughness using the Plomp-Levelt curve, sum. Libraries like `essentia` and `librosa` can help, but in a browser context we'd implement this from FFT bin data.

**Application for agents:** A roughness value isn't inherently good or bad — dissonance creates tension, which is musically valuable. What matters is whether roughness *changes* over time (tension/release) vs. stays constant (fatiguing). Flag sustained high roughness (>10 seconds) as a potential issue.

### 1.3 Rhythmic Regularity & Complexity

**Onset Detection** — identify when new sonic events begin. The Web Audio API's `AnalyserNode` provides real-time spectral data; onset detection works by looking for sudden increases in spectral flux or broadband energy.

**Inter-Onset Interval (IOI) Analysis** — measure the time between consecutive onsets. Regular IOIs suggest rhythmic pulse; irregular IOIs suggest arrhythmic or random texture. The *coefficient of variation* of IOIs (std/mean) is a simple complexity measure:
- CV < 0.1 → metronomic (mechanical, potentially boring)
- CV 0.1–0.4 → rhythmic with variation (groovy, musical)
- CV > 0.6 → no clear pulse (ambient, chaotic, or broken)

**nPVI (normalized Pairwise Variability Index)** — measures local rhythmic contrast. Higher values indicate more syncopation/swing. Values around 30–60 are typical for engaging rhythm.

### 1.4 Dynamic Range & Envelope Characteristics

**RMS Envelope** — the overall loudness contour. Key questions:
- Does the amplitude change at all? (Constant RMS = flat, lifeless)
- Is there a reasonable dynamic range? (Target: at least 6 dB variation)
- Are there envelope shapes? (Attack-sustain-release patterns indicate intentional sound design)

**Crest Factor** — peak-to-RMS ratio. Low crest factor (<3 dB) = heavily compressed or clipping. High crest factor (>20 dB) = very sparse/impulsive. Range of 6–15 dB is typical for well-shaped audio.

**LUFS (Loudness Units Full Scale)** — perceptually-weighted loudness. Target -23 to -14 LUFS for audio toys (not too quiet, not slamming).

### 1.5 Harmonic vs. Inharmonic Ratio

**Harmonic-to-Noise Ratio (HNR)** — separates the periodic (pitched) component from the noise floor. Purely tonal sounds have high HNR; noise/texture has low HNR. Most interesting audio has both — a pitched foundation with some noise character.

**Inharmonicity** — measures how far partials deviate from integer multiples of the fundamental. Slight inharmonicity (like a piano string) sounds warm and alive; extreme inharmonicity sounds metallic or bell-like. Either can be desirable, but uncontrolled inharmonicity (e.g., from aliasing artifacts) sounds broken.

**Practical test:** If HNR > 25 dB and inharmonicity < 0.01, the sound is very "clean" — might be too sterile for an audio toy. If HNR < 5 dB, it's essentially noise — might need more tonal structure.

---

## 2. Heuristics for Beauty

### 2.1 Striking vs. Annoying: Codifiable Principles

These heuristics are well-supported by psychoacoustics and music cognition research:

| Principle | Striking | Annoying |
|-----------|----------|----------|
| **Frequency balance** | Energy distributed across lows, mids, highs | Concentrated in harsh zone (2–5 kHz) or muddy zone (<200 Hz) |
| **Temporal evolution** | Sound changes over time — sweeps, modulation, envelope | Static, unchanging tone or texture |
| **Dynamic contrast** | Quiet moments make loud moments impactful | Constant loudness = fatigue |
| **Spectral contrast** | Clear separation between frequency bands | Everything smeared together |
| **Surprise within structure** | Unexpected elements anchored to a pattern | Random = noise; too predictable = boring |
| **Resolution** | Tension resolves — dissonance to consonance, buildup to release | Perpetual unresolved tension |

### 2.2 Contrast, Surprise, Repetition, and Variation

This maps to information-theoretic models of aesthetic experience (Berlyne's arousal theory, Meyer's expectation theory):

**Optimal complexity hypothesis:** Aesthetic pleasure peaks at moderate information density. Too predictable (low entropy) → boring. Too unpredictable (high entropy) → chaotic. The sweet spot is *structured surprise* — patterns that establish expectations, then violate them in satisfying ways.

For automated evaluation:
- **Repetition rate:** Measure self-similarity over time (autocorrelation of spectral features). Some repetition is good (establishes pattern); total repetition is a loop.
- **Surprise metric:** Frame-to-frame prediction error of spectral features. Occasional high-surprise frames within a low-surprise baseline indicate interesting moments.
- **Variation depth:** How different are the contrasting sections? Subtle variation within a theme reads as sophisticated; total change reads as incoherent.

### 2.3 Frequency Distribution

Practical zones and their perceptual effects:

| Range | Character | Problem Signs |
|-------|-----------|---------------|
| **Sub-bass (20–60 Hz)** | Felt more than heard; physical weight | Excessive = rumble, mud, speaker damage |
| **Bass (60–250 Hz)** | Warmth, body, fundamental tones | Excessive = boomy, masks everything |
| **Low-mid (250–500 Hz)** | Body of most instruments | Excessive = boxy, muddy |
| **Mid (500–2000 Hz)** | Presence, clarity, definition | Excessive = honky, nasal |
| **Upper-mid (2–5 kHz)** | Attack, intelligibility, edge | Excessive = harsh, fatiguing, painful |
| **Presence (5–8 kHz)** | Air, brilliance, sibilance | Excessive = piercing, sibilant |
| **High (8–20 kHz)** | Sparkle, air, space | Excessive = hissy, thin |

**Pink noise as reference:** A "balanced" spectrum roughly follows a -3 dB/octave slope (pink noise). Audio that deviates sharply from this in any band for extended periods likely has a tonal balance issue.

**Automated check:** Compute 1/3-octave band energies, compare to a -3 dB/octave reference. Flag bands that exceed the reference by more than 10 dB for more than 3 seconds.

### 2.4 Silence and Space

Silence is not absence — it's a structural element. In audio toys:
- **Micro-silence** (10–100 ms gaps): Creates rhythmic articulation, prevents smearing
- **Macro-silence** (>500 ms): Creates sections, breathing room, anticipation
- **Constant sound with no silence:** Quickly becomes background noise, loses engagement

**Automated check:** Measure the percentage of time the signal is below -40 dBFS. If it's 0% over a 30-second window, flag "no breathing room." If it's >80%, flag "mostly silent — possibly broken."

### 2.5 Cultural vs. Universal Aesthetic Principles

**Likely universal** (psychoacoustic basis):
- Preference for octaves and simple frequency ratios (2:1, 3:2)
- Discomfort with sustained roughness in the 2–5 kHz range (where hearing is most sensitive)
- Preference for sounds with clear onset transients (they're easier to parse)
- Familiarity effect — some repetition is necessary for engagement

**Culturally variable:**
- Scale systems (12-TET vs. just intonation vs. non-Western tunings)
- Rhythmic feel (swing, straight, complex meters)
- Timbre preferences (bright vs. dark, clean vs. distorted)
- Consonance/dissonance thresholds (what counts as "resolved")

**Implication for agents:** Build the automated evaluation around universal principles. Don't hard-code Western music theory assumptions about which intervals or scales are "correct." Instead, evaluate structural properties: does the audio have pattern, contrast, evolution, and balance?

---

## 3. Practical Approaches for Agents

### 3.1 Headless Browser + Web Audio API

**Feasibility: High.** This is the most natural approach for a project already built on Web Audio.

**Architecture:**
1. Agent generates/modifies Web Audio synthesis code
2. Launches headless Chromium (via Puppeteer or Playwright)
3. Injects the synthesis code into a page with an `OfflineAudioContext`
4. Renders N seconds of audio to a buffer
5. Runs analysis on the buffer (either in-browser via AnalyserNode or by exporting WAV and analyzing externally)

**Key advantage:** `OfflineAudioContext` renders faster than real-time — a 30-second analysis takes <1 second of wall-clock time.

**Implementation sketch:**
```javascript
// In the headless browser context:
const offline = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

// ... set up the synthesis graph on `offline` ...

const buffer = await offline.startRendering();
const channelData = buffer.getChannelData(0);

// Run analysis on channelData
const analysis = analyzeAudio(channelData, sampleRate);
```

**AnalyserNode for spectral data:**
```javascript
const analyser = offline.createAnalyser();
analyser.fftSize = 2048;
// Connect synthesis output → analyser → destination
// After rendering, read frequency/time-domain data
```

Note: `AnalyserNode` with `OfflineAudioContext` has some browser-specific quirks. An alternative is to export the raw PCM buffer and compute FFTs directly (e.g., using a lightweight FFT library like `fft.js`).

### 3.2 Audio Linter

A simple pass/fail checker for common problems. This is the highest-value, lowest-effort tool to build.

**Proposed checks:**

| Check | Method | Threshold |
|-------|--------|-----------|
| **Clipping** | Count samples at ±1.0 | Fail if >0.1% of samples clip |
| **DC Offset** | Mean of all samples | Fail if \|mean\| > 0.01 |
| **Dead Silence** | Max absolute sample value | Fail if max < 0.001 (whole buffer silent) |
| **Near Silence** | RMS of buffer | Warn if RMS < -60 dBFS |
| **Harsh Resonance** | Peak-to-average ratio in 2–5 kHz band | Warn if >15 dB above pink noise reference |
| **No Evolution** | Spectral flux variance | Warn if flux CV < 0.05 over 10 seconds |
| **Excessive Noise** | Spectral flatness | Warn if mean flatness > 0.85 |
| **Duration** | Buffer length | Fail if <0.5s or >300s |

**Output format:** JSON with pass/warn/fail for each check, plus human-readable summary. This can be consumed programmatically by the agent.

```json
{
  "pass": true,
  "checks": {
    "clipping": { "status": "pass", "detail": "0.00% samples clipped" },
    "dc_offset": { "status": "pass", "detail": "mean = 0.0003" },
    "dead_silence": { "status": "pass", "detail": "max amplitude = 0.72" },
    "evolution": { "status": "warn", "detail": "spectral flux CV = 0.03 — sound may be static" }
  },
  "summary": "3 pass, 1 warn, 0 fail"
}
```

### 3.3 Spectral Visualization + Visual Assessment

**Approach:** Generate spectrogram images that agents can assess using their multimodal (vision) capabilities.

**What to visualize:**
1. **Spectrogram** (time × frequency × amplitude) — the single most informative visualization. Shows harmonic structure, evolution, transients, noise, and frequency balance at a glance.
2. **Waveform** — shows amplitude envelope, clipping, silence, dynamic range.
3. **Spectrum snapshot** — average spectrum over the full duration, overlaid with a pink noise reference curve.

**Implementation options:**
- **In-browser Canvas rendering:** Draw the spectrogram to a `<canvas>`, screenshot via Puppeteer. Lightweight, no external dependencies.
- **Export WAV + external tool:** Use `sox` or `ffmpeg` to generate spectrograms as PNG files. More robust but adds a dependency.
- **Web-based:** Use a library like `wavesurfer.js` for in-browser visualization, then screenshot.

**Agent visual assessment prompts:**
An agent examining a spectrogram image could be prompted:
- "Does this spectrogram show harmonic structure (horizontal bands) or just noise (uniform fill)?"
- "Is there visible evolution over time, or does the pattern repeat identically?"
- "Are there any abnormally bright bands suggesting resonance?"
- "Is energy distributed across the frequency range, or concentrated in one area?"

This is surprisingly effective — multimodal models can identify clipping (flat-topped waveforms), resonance (bright horizontal lines), silence (blank regions), and structural patterns in spectrograms.

### 3.4 Reference Comparison

**Spectral fingerprinting:** Compute a compact spectral summary of a "known-good" audio toy output, then compare new outputs against it.

**Approach:**
1. Curate a small library of reference recordings (5–10 examples of "good" audio toy output)
2. For each, compute a feature vector: [mean centroid, centroid variance, mean flux, flux variance, mean flatness, mean RMS, RMS variance, onset rate]
3. For new audio, compute the same vector and measure Euclidean distance to the nearest reference
4. Flag outputs that are >2 standard deviations from all references

**Limitations:** This biases toward producing sounds similar to the references. Use it as a sanity check, not as the primary quality metric. It catches gross failures (silence, pure noise, clipping) better than it distinguishes "good" from "great."

### 3.5 Multimodal "Listening" via Spectrograms

This deserves special attention as it's the most novel and potentially powerful approach for LLM-based agents.

**How it works:**
1. Render audio via OfflineAudioContext
2. Generate a spectrogram image (linear or mel-scaled, with time on x-axis, frequency on y-axis, color-mapped amplitude)
3. Pass the spectrogram image to the agent's vision capability
4. Agent provides qualitative assessment

**Strengths:**
- Leverages the agent's existing multimodal reasoning
- Can detect patterns that simple metrics miss (structural coherence, aesthetic balance)
- Provides natural-language feedback that can inform code changes

**Limitations:**
- Not deterministic — different assessments on the same image
- Can't hear actual audio — misses phase relationships, stereo imaging, temporal micro-structure
- Mel spectrograms emphasize perceptually relevant frequencies but lose fine frequency resolution

**Best practice:** Use spectrogram visual assessment as a *complement* to quantitative metrics, not a replacement. The metrics catch objective failures; the visual assessment catches subjective quality.

---

## 4. Testing Framework

### 4.1 Automated Audio Quality Tests

**Test structure (three tiers):**

**Tier 1: Smoke tests (gate — must pass)**
- Audio renders without errors
- Output is not silent
- No clipping
- No DC offset
- Duration is within expected range
- Sample rate matches expected value

**Tier 2: Quality checks (warn — should pass)**
- Spectral balance within ±10 dB of pink noise reference per band
- Some temporal evolution (spectral flux CV > 0.05)
- Dynamic range > 6 dB
- No sustained harsh resonance (2–5 kHz peak)
- At least some tonal content (spectral flatness < 0.8 for at least 30% of frames)

**Tier 3: Aesthetic assessment (inform — nice to pass)**
- Self-similarity analysis shows pattern + variation (not pure loop, not pure chaos)
- Roughness varies over time (tension/release)
- Onset regularity suggests intentional rhythm
- Spectral centroid trajectory suggests melodic/timbral movement
- Reference distance within 2σ of known-good examples

### 4.2 Snapshot Testing for Audio

**Concept:** Record a reference rendering of each audio toy, then compare future renderings against it to detect regressions.

**Challenge:** Audio synthesis with any stochastic element (randomness, noise, timing jitter) won't produce bit-identical output. Need a perceptual comparison, not a binary diff.

**Approach:**
1. **Feature-vector snapshot:** Instead of storing raw audio, store the analysis feature vector (centroid stats, flux stats, flatness, RMS, onset rate, etc.). Compare vectors with a tolerance.
2. **Spectral distance:** Compute the mean squared difference between mel spectrograms (downsampled to, say, 64 mel bands × 100 time frames). If distance exceeds threshold, flag regression.
3. **Hybrid:** Store both the feature vector and a low-res spectrogram. Feature vector for automated pass/fail; spectrogram for visual review when flagged.

**Tolerances:** Start generous (allow 20% deviation on each feature), tighten as the system matures. The goal is catching *regressions* (it got worse), not enforcing *perfection*.

### 4.3 Perceptual Difference Metrics

**Full-reference metrics** (require a reference signal):

- **PESQ (Perceptual Evaluation of Speech Quality):** ITU standard, primarily designed for speech. Produces a MOS (Mean Opinion Score) from 1–5. Available via C libraries. Overkill for audio toys and speech-specific — not recommended.

- **ViSQOL (Virtual Speech Quality Objective Listener):** Google's open-source alternative to PESQ. Has an "audio mode" that works beyond speech. Better fit than PESQ, but still assumes you have a reference signal to compare against. Useful for regression testing.

- **STOI (Short-Time Objective Intelligibility):** Speech-specific, not applicable.

**Simpler alternatives better suited to audio toys:**

- **Spectral Convergence:** `||S_ref - S_test|| / ||S_ref||` where S is the magnitude spectrogram. Simple, fast, and intuitive. Values <0.1 indicate very similar spectral content.

- **Log-Spectral Distance (LSD):** Mean squared difference of log magnitude spectra. Perceptually motivated (our hearing is logarithmic). Values <1.0 dB indicate high similarity.

- **Mel Cepstral Distortion (MCD):** Distance in MFCC space. Widely used in speech synthesis evaluation. Lower is better; <5 dB is generally considered acceptable.

**No-reference metrics** (no reference signal needed — evaluate quality in isolation):

- **Spectral flatness statistics** (as described above)
- **Signal-to-Noise Ratio** (estimated from harmonic analysis)
- **Audio linter checks** (clipping, DC offset, silence detection)
- **Feature trajectory analysis** (evolution metrics)

**Recommendation for this project:** Use **Spectral Convergence** and **Log-Spectral Distance** for regression/snapshot testing (they're simple, fast, and work well for musical audio). Use the **audio linter** and **feature trajectory analysis** as no-reference quality metrics.

---

## 5. Recommendation: Minimum Viable Taste Engine

### 5.1 Architecture

The MVP taste engine is a three-stage pipeline:

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│   Render     │────▶│   Analyze   │────▶│   Report         │
│ (Offline     │     │ (Metrics +  │     │ (JSON + optional │
│  AudioCtx)   │     │  Linter)    │     │  spectrogram)    │
└─────────────┘     └─────────────┘     └──────────────────┘
```

**Stage 1: Render** — Use `OfflineAudioContext` in headless Chromium to render the audio toy's output to a PCM buffer. Faster than real-time; deterministic for non-stochastic synthesis.

**Stage 2: Analyze** — Run the audio linter (Tier 1 + Tier 2 checks) and compute the feature vector. Optionally generate a spectrogram image.

**Stage 3: Report** — Output structured JSON with pass/warn/fail status, feature values, and actionable feedback messages. Optionally include spectrogram PNG for visual review.

### 5.2 What to Build

**Priority 1 — Audio Linter script (`tools/audio-lint.js`)**
- Runs in Node.js or headless browser
- Takes a URL or audio file path as input
- Runs Tier 1 (smoke) and Tier 2 (quality) checks
- Outputs JSON report
- Estimated effort: 1–2 tasks

**Priority 2 — Feature extractor (`tools/audio-features.js`)**
- Computes the core feature vector: spectral centroid (mean, var), spectral flux (mean, var), spectral flatness (mean), RMS (mean, var), onset rate, crest factor
- Used by the linter for its checks and by snapshot testing for regression detection
- Estimated effort: 1 task

**Priority 3 — Spectrogram generator (`tools/audio-spectrogram.js`)**
- Renders a mel spectrogram to Canvas/PNG
- Can be screenshotted and assessed by agents visually
- Also used for spectral convergence regression testing
- Estimated effort: 1 task

**Priority 4 — Snapshot test harness (`tools/audio-snapshot.js`)**
- Records reference feature vectors and spectrograms
- Compares new renders against references
- Reports spectral convergence and log-spectral distance
- Estimated effort: 1 task

### 5.3 Integration with Agent Workflow

```
Agent writes/modifies audio toy code
  │
  ▼
Agent runs: node tools/audio-lint.js --url http://localhost:3000/toy.html --duration 10
  │
  ▼
Linter renders audio, runs checks, outputs JSON
  │
  ├── All pass → Agent proceeds to commit
  ├── Warnings → Agent reviews and decides (can check spectrogram)
  └── Failures → Agent must fix before committing
```

For deeper assessment, the agent can:
1. Generate a spectrogram: `node tools/audio-spectrogram.js --url ... --out spectrogram.png`
2. View the spectrogram using multimodal vision
3. Make qualitative judgments about aesthetic quality

### 5.4 Feature Vector for Snapshot Testing

```javascript
// The canonical feature vector for audio comparison
const featureVector = {
  spectralCentroid: { mean, variance, min, max },
  spectralFlux:     { mean, variance },
  spectralFlatness: { mean },
  rms:              { mean, variance, min, max },
  crestFactor:      { value },
  onsetRate:        { value },  // onsets per second
  zeroCrossingRate: { mean },
  duration:         { value },
};
```

Two feature vectors are compared using normalized Euclidean distance. If distance > threshold (start with 0.3, calibrate empirically), flag as a potential regression.

### 5.5 What NOT to Build (Yet)

- **ML-based quality prediction:** Training a neural network to predict MOS scores requires labeled data we don't have. Defer until we have 100+ rated examples.
- **Real-time monitoring:** The offline render + analyze pipeline is sufficient. Real-time analysis adds complexity without proportional value for agent use.
- **Full PESQ/ViSQOL integration:** These are complex C/C++ libraries designed for speech. The simpler spectral metrics serve us better for musical audio.
- **Cultural style scoring:** Don't try to judge whether something sounds "jazzy" or "ambient." Stick to universal perceptual principles.

---

## 6. Summary

| Component | Purpose | Effort | Priority |
|-----------|---------|--------|----------|
| Audio Linter | Pass/fail quality gate | Small | P1 |
| Feature Extractor | Quantitative analysis | Small | P2 |
| Spectrogram Generator | Visual assessment | Small | P3 |
| Snapshot Harness | Regression detection | Medium | P4 |

The minimum viable taste engine gives agents three capabilities:
1. **Gate:** "Does this audio have obvious problems?" (linter — automated, fast)
2. **Measure:** "How does this audio compare to what we had before?" (feature vector + snapshot — automated, comparative)
3. **Judge:** "Does this audio sound interesting?" (spectrogram + multimodal vision — semi-automated, qualitative)

Together, these prevent the most common failure modes (silence, clipping, static drones, pure noise) while providing a structured path toward more sophisticated aesthetic evaluation as the project matures.
