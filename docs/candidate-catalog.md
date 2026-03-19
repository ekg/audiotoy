# Candidate Catalog: 16 Audio Toys

*A definitive catalog of audio toy concepts, each specified with enough detail to be independently implementable. Synthesized from the creative vision (spark-vision.md) and four research documents covering Web Audio, Rust/WASM synthesis, Phonon integration, and agent musicality evaluation.*

---

## Selection Rationale

From the 20 concepts in the creative vision, 16 were selected to maximize diversity while maintaining implementability. Four concepts were set aside:

- **Glass Harmonium** — modal physical modeling of glass resonance is extremely challenging to do well; its meditative territory is covered by Pendulum Choir and Drone Painter
- **Particle Organ** — physics-based sequencing overlaps with Murmuration and Pendulum Choir
- **Raga Machine** — microtonal physical modeling requires deep cultural-musical design work beyond current scope; Crystal Lattice covers non-standard tuning territory
- **Light Table** — color-to-sound spatial composition overlaps with Drone Painter

---

## Diversity Checklist

| Requirement | Met By |
|---|---|
| **6+ synthesis techniques** | Physical modeling, additive, FM, granular, wavetable, formant, spectral, ring modulation, subtractive, Karplus-Strong (10 techniques) |
| **5+ interaction paradigms** | Touch/tap, spatial placement, drawing/painting, voice/breath, camera/body, physics simulation, keyboard/typing, cellular automata seeding, observation/parameter tuning (9 paradigms) |
| **Ambient to rhythmic range** | Ambient: Moss Radio, Drone Painter, Constellation Engine. Rhythmic: Volcano Drum, Murmuration, Mycelium Network |
| **2+ Phonon-based** | Mycelium Network, Pendulum Choir (with fallback to pure Web Audio) |
| **2+ WASM synthesis** | Grain Storm, Magma Flow, Tide Pool |
| **2+ microphone/voice input** | Breath Garden, Moss Radio, Shadow Puppets |
| **2+ multiplayer/shareable** | Shadow Puppets (multi-person camera), Constellation Engine (shareable URL), Tide Pool (co-playable multi-touch), Crystal Lattice (shareable URL) |

---

## The 16 Toys

---

### 1. Pendulum Choir

**Concept:** A row of pendulums hangs from the top of the screen. Drag each to set its length — shorter pendulums swing faster and sing higher. Release them and listen as they phase: initially synchronized, they gradually drift apart, creating evolving rhythmic and harmonic patterns. Moments of alignment produce clear chords; maximum divergence produces shimmering clusters. Gravity is adjustable.

**Interaction Model:**
- *Primary:* Drag to set pendulum length; tap to release
- *Secondary:* Slider or vertical drag to adjust gravity; tap a pendulum to mute/unmute

**Synthesis Technique:** Pure sine wave / additive synthesis. Each pendulum is a sine oscillator (or simple harmonic stack of 2–3 partials). Musical interest comes entirely from phasing relationships, not timbre complexity. Frequencies derived from pendulum length via the period formula T = 2π√(L/g).

**Visual Design:** Pendulums rendered as weighted lines with glowing bobs. The bob brightness pulses with the oscillator amplitude. Faint arcs trace recent motion paths, creating visual phasing patterns that mirror the sonic phasing. Background darkens as pendulums drift out of sync, brightens at moments of alignment.

**Technical Approach:** Pure Web Audio API. Each pendulum is an `OscillatorNode` → `GainNode` (amplitude modulated by pendulum position). Physics simulation runs on the main thread (simple harmonic motion — computationally trivial). Canvas 2D for rendering. **Phonon opportunity:** Pendulum frequencies and phasing map naturally to Phonon's "patterns as signals" paradigm — once the WASM port is ready, the phasing engine could be expressed as a Phonon program where each pendulum is a bus with a sine oscillator modulated by a continuous pattern.

**Complexity Estimate:** S

**Unique Quality:** Makes Steve Reich's phasing process visible and tangible. The connection between physics, mathematics, and musical form is laid bare — you can *see* why the harmonies change. Simple enough for a child; deep enough to study for hours.

**Accessibility Notes:** Drag is the only interaction needed. Pendulums start at default lengths that produce a pleasant chord, so even before the user touches anything, releasing them (a single tap) produces beautiful phasing. Gravity slider provides a second axis of control that's immediately intuitive — "slower" and "faster."

---

### 2. Dream Typewriter

**Concept:** Type freely. Each letter has a sonic soul — vowels are sustained tones, consonants are percussive transients, spaces are rests. Words become melodic phrases shaped by their phonetic content. Sentences become compositions. Type fast for frenetic energy; type slowly for contemplative melody. Punctuation adds structure — commas are breaths, periods are cadences, question marks are rising intervals.

**Interaction Model:**
- *Primary:* Keyboard typing (physical keyboard or on-screen)
- *Secondary:* Backspace erases the last tone; shift modifies timbre (louder, brighter)

**Synthesis Technique:** Formant synthesis for vowels (two-pole resonant filters shaping a harmonically rich source, with formant frequencies mapped to the five vowel shapes: ah/eh/ee/oh/oo) plus shaped noise bursts for consonants (plosives = short broadband bursts, fricatives = filtered noise, nasals = low-frequency resonance). Pitch follows a melodic contour seeded by letter position in the alphabet, constrained to a pentatonic scale to guarantee consonance.

**Visual Design:** Letters appear on screen as they're typed, each with a color corresponding to its timbre (warm vowel colors vs. sharp consonant colors). Letters pulse and glow as their sound plays. Completed words drift upward slowly, creating a scrolling visual score of the improvisation.

**Technical Approach:** Pure Web Audio API. Vowels: `OscillatorNode` (sawtooth) → two `BiquadFilterNode` (bandpass, formant frequencies) → `GainNode` (ADSR envelope via `linearRampToValueAtTime`). Consonants: `AudioBufferSourceNode` (noise buffer) → `BiquadFilterNode` → `GainNode` (short envelope). Use `event.code` for layout-independent key mapping. Canvas 2D for text rendering.

**Complexity Estimate:** S

**Unique Quality:** Turns writing — an activity everyone knows — into musical performance. Poetry sounds different from prose. The sonic result is unpredictable enough to surprise, structured enough to satisfy. No musical knowledge required; literacy is the only prerequisite.

**Accessibility Notes:** Just start typing — any key produces sound immediately. The pentatonic constraint means random key-mashing sounds musical. On-screen keyboard fallback for touch devices. Visual feedback (colored, pulsing letters) reinforces which keys produce which sounds, building intuition without instruction.

---

### 3. Volcano Drum

**Concept:** A dark, seething surface. Tap it — a geyser of percussive sound erupts. Each eruption is unique: a procedurally generated drum hit synthesized from shaped noise through resonant filters. Position on screen determines timbre (left = deep kick-like, right = sharp hat-like, center = snare-like). Rapid tapping builds polyrhythmic cascades. The surface remembers recent patterns and echoes them back as ghost rhythms with subtle variations.

**Interaction Model:**
- *Primary:* Multi-touch tap (velocity-sensitive via touch pressure or contact area; position determines timbre)
- *Secondary:* Long-press for sustained rumble; two-finger spread/pinch to adjust resonance

**Synthesis Technique:** Noise-based subtractive synthesis. White noise → bandpass filter bank (2–4 parallel `BiquadFilterNode` with different center frequencies) → amplitude envelope (sharp attack, variable decay). Filter center frequencies and Q values are mapped to tap position: x-axis controls the center frequency cluster (low-left to high-right), y-axis controls resonance/Q. Each hit randomizes filter parameters slightly within the position-defined range for organic variation.

**Visual Design:** Dark basalt-like surface rendered in Canvas 2D. Taps produce expanding ring eruptions — color and size map to the timbre (deep red rings for bass hits, white sparks for hi-hats). Ghost rhythm echoes appear as dimmer, translucent replicas of recent eruptions. The surface glows faintly where ghost rhythms are active.

**Technical Approach:** Pure Web Audio API. Noise source created once as a looping `AudioBufferSourceNode` (pre-generated white noise buffer). Each tap triggers a new signal path: noise → filters → gain envelope. Pointer Events for multi-touch with `setPointerCapture()`. Ghost rhythm system uses a circular buffer of recent tap events (position, time, velocity) and replays them with jittered timing and altered filter parameters after a configurable delay.

**Complexity Estimate:** S

**Unique Quality:** Percussion synthesis that's entirely procedural — no samples, yet every hit sounds organic and different. The ghost rhythm system means you're always playing with a phantom drummer who learned from you moments ago. The spatial timbre mapping makes the screen feel like a physical surface with different materials.

**Accessibility Notes:** Tap anywhere — every tap produces a satisfying hit immediately. The spatial mapping is discoverable through exploration (tap different spots, hear different timbres). Ghost rhythms reward even tentative tapping by making it sound like you're part of a larger ensemble. Works naturally with multi-touch — friends can play together on a shared screen.

---

### 4. Constellation Engine

**Concept:** A dark sky. Click to place stars. Brighter stars are louder; higher stars are higher pitched. As nearby stars recognize each other, faint lines connect them into constellations. A slow beam of light sweeps across the sky, and each star it touches sings — a soft, crystalline additive tone. Stars drift imperceptibly over time, so the music is never quite the same twice.

**Interaction Model:**
- *Primary:* Click/tap to place stars; drag to reposition
- *Secondary:* Double-tap to remove a star; pinch/scroll to adjust sweep speed; long-press a star to adjust its brightness (volume)

**Synthesis Technique:** Additive synthesis. Each star is a stack of harmonics (fundamental determined by vertical position, harmonic richness determined by brightness/size). When the sweep beam activates a star, its harmonics fade in with a soft attack (100–300ms) and long release (1–3s). Constellation lines create sympathetic resonance — when a star is activated, connected stars resonate faintly at reduced amplitude.

**Visual Design:** Black background with subtle star-field noise. Placed stars glow with intensity proportional to their volume. Constellation lines are faint, luminous threads. The sweep beam is a soft vertical gradient that moves left-to-right (or in a configurable arc). Stars brighten as the beam touches them. A subtle parallax effect on the background star-field adds depth.

**Technical Approach:** Pure Web Audio API. Each star: array of `OscillatorNode` (partials at integer multiples of fundamental) → individual `GainNode` per partial (harmonic weighting) → master `GainNode` (envelope). Sweep beam position tracked via `requestAnimationFrame`; stars activated when beam x-position crosses star x-position. Canvas 2D for rendering. **Shareable:** Star positions, sizes, and sweep speed encoded as a compact URL fragment (base64-encoded JSON), enabling users to share compositions as links.

**Complexity Estimate:** S

**Unique Quality:** Composition as astronomy. The visual metaphor makes pitch-space and time-space intuitive — no musical knowledge required. The slow stellar drift means your constellation evolves beyond your original intention, producing a living, gradually changing composition. Shareability via URL turns it into a social instrument.

**Accessibility Notes:** First click places a star and the sweep beam immediately activates it — instant feedback. Stars are large touch targets. The sweep beam provides automatic playback without requiring continuous interaction, so even a single placed star creates an ongoing experience. The "sky" metaphor is universally intuitive.

---

### 5. Breath Garden

**Concept:** Blow into your microphone. Your breath, analyzed for intensity and spectrum, sprouts sonic plants. A gentle sigh grows delicate wind-chime fronds. A strong gust raises thick trunks that pulse with sub-frequencies. Whisper to plant seeds that bloom later. The garden grows over minutes, becoming a lush ambient ecosystem sustained by your breath.

**Interaction Model:**
- *Primary:* Voice/breath input via microphone (intensity = growth speed; spectral brightness = plant type)
- *Secondary:* Tap a plant to prune/mute it; drag to rearrange the garden

**Synthesis Technique:** FM synthesis. Each plant is an FM voice: breath envelope modulates carrier/modulator ratio. Gentle breath (low amplitude, low spectral centroid) → near-sinusoidal tones (low modulation index), producing wind-chime-like sounds. Strong breath (high amplitude, high centroid) → complex metallic spectra (high modulation index), producing rich, evolving timbres. Each plant's FM parameters are seeded by the spectral characteristics of the breath that spawned it, then follow their own slow LFO-driven evolution.

**Visual Design:** Dark soil at the bottom, growing upward. Plants are stylized, generative forms — procedural L-system branching structures. Color maps to pitch (low = earth tones, high = sky colors). Plants sway gently, modulated by their own sound. New growth animates visibly when breath is detected. Canvas 2D for plant rendering with possible WebGL upgrade for many plants.

**Technical Approach:** Pure Web Audio API with AudioWorklet for breath analysis. Microphone input via `getUserMedia` with `echoCancellation: false, noiseSuppression: false, autoGainControl: false`. `AnalyserNode` for real-time spectral analysis of breath (centroid, RMS). FM voices built from pairs of `OscillatorNode` with `GainNode` controlling modulation depth. Each plant's parameters stored in a state object; LFOs via additional low-frequency `OscillatorNode` instances.

**Complexity Estimate:** M

**Unique Quality:** Breath is the most intimate interface. The garden metaphor turns abstract synthesis parameters into something anyone understands — nurturing, growing, tending. The mapping from breath character to plant type means that different breathing styles produce genuinely different gardens. A whispered garden sounds fundamentally different from a shouted one.

**Accessibility Notes:** Blow into the microphone — a plant appears. That's the entire learning curve. A visual prompt ("Breathe here...") appears near a microphone icon. The garden persists and plays back even when you stop breathing, so brief engagement produces lasting results. On devices without microphone access, a fallback mode lets users tap to "breathe" with intensity mapped to tap position.

---

### 6. Silk Weaver

**Concept:** A loom fills the screen. Draw horizontal threads — these become sustained drones at the pitch of their vertical position. Draw vertical threads — these become rhythmic pulses. Where threads cross, they modulate each other through ring modulation, producing metallic, bell-like sidebands. A sparse weave is an open, spacious composition; a dense weave is a thick, clanging wall of interlocking tones.

**Interaction Model:**
- *Primary:* Drawing horizontal and vertical strokes on a grid-like canvas
- *Secondary:* Tap a thread to mute/unmute; drag a thread to change its position (pitch/timing); pinch to zoom the grid

**Synthesis Technique:** Ring modulation / amplitude modulation. Horizontal threads: `OscillatorNode` (sine or triangle) at pitch determined by y-position, sustained indefinitely. Vertical threads: `OscillatorNode` at frequency determined by x-position, gated to pulse rhythmically. At each crossing point, the two signals are multiplied (ring modulated), producing sum and difference frequencies. The intersection tones are mixed into the output alongside the original threads.

**Visual Design:** A warp-and-weft grid rendered on Canvas 2D. Horizontal threads glow steadily; vertical threads pulse with their rhythm. Intersection points flare with color when ring modulation is active — the color represents the sum/difference frequencies. Thread colors indicate pitch (spectral rainbow). Dense areas of the weave glow more intensely.

**Technical Approach:** Pure Web Audio API. Horizontal threads: `OscillatorNode` → `GainNode`. Vertical threads: `OscillatorNode` → `GainNode` (rhythmic envelope via `setValueCurveAtTime`). Ring modulation at crossings: use one oscillator as input to a `GainNode` whose gain is controlled by the other oscillator (the standard Web Audio ring mod pattern). This limits polyphony — budget ~30 crossing points on mobile, ~100 on desktop. Canvas 2D for grid rendering.

**Complexity Estimate:** M

**Unique Quality:** Ring modulation usually sounds harsh and alien. The weaving metaphor domesticates it — crossing threads create something new at their intersection. The visual-sonic mapping is rigorous: you can see exactly which threads produce which sounds, and where the complex timbres emerge.

**Accessibility Notes:** Draw a single horizontal line — you hear a drone. Draw a vertical line crossing it — you hear the intersection modulation. The grid provides structure that guides drawing. Pre-drawn "starter threads" can show the concept before the user adds their own. The weaving metaphor is familiar and tactile.

---

### 7. Crystal Lattice

**Concept:** Build a crystalline structure by placing atoms in 2D space. When atoms are close enough, bonds form — and each bond is a vibrating string. Pluck any bond by clicking it, and the vibration propagates through the lattice, each bond resonating at its own pitch (determined by its length). A hexagonal lattice sounds like a harp; a chaotic graph sounds like a prepared piano.

**Interaction Model:**
- *Primary:* Click/tap to place atoms; click a bond to pluck it
- *Secondary:* Drag atoms to reshape the lattice (bonds stretch and repitch in real-time); shake/tilt device to excite all bonds simultaneously

**Synthesis Technique:** Karplus-Strong string synthesis. Each bond runs an independent Karplus-Strong algorithm: a short burst of filtered noise fed into a delay line with feedback and a simple low-pass filter. Delay length (= string length = pitch) is determined by the Euclidean distance between bonded atoms. When a bond is plucked, energy propagates to connected bonds with reduced amplitude and slight delay, simulating physical coupling.

**Visual Design:** Atoms rendered as luminous nodes; bonds as taut lines that visually vibrate when plucked (oscillating displacement perpendicular to the bond). Vibration amplitude decays visually as the sound decays. Energy propagation visible as a traveling pulse along bonds. Color encodes pitch (short/high bonds = blue, long/low bonds = red). Canvas 2D, with potential WebGL upgrade for large lattices.

**Technical Approach:** AudioWorklet with custom Karplus-Strong implementation in JavaScript. Each bond maintains its own delay buffer and filter state. Pluck events and propagation managed on the main thread; audio synthesis in the worklet. Communication via `MessagePort` for pluck events and parameter updates. **Shareable:** Lattice topology (atom positions) encoded as URL fragment, enabling users to share their crystal instruments. Bond formation uses a distance threshold — atoms within range auto-bond.

**Complexity Estimate:** M

**Unique Quality:** You build both the instrument and the composition space simultaneously. The topology of your crystal *is* the harmonic language. A lattice with regular spacing creates a tuned instrument; an irregular lattice creates a unique, microtonal sound-world. Physically plausible propagation means one pluck can cascade through the entire structure.

**Accessibility Notes:** Place two atoms near each other — a bond forms. Tap the bond — it sounds. That three-step sequence is the entire tutorial. Auto-bonding removes the need to explicitly connect atoms. A "starter crystal" (pre-placed hexagonal lattice) gives new users something to pluck immediately. Propagation means a single pluck produces a rich, cascading result.

---

### 8. Drone Painter

**Concept:** An empty canvas. Choose a color and paint. But instead of depositing pigment, each stroke deposits a sustained drone. Color determines harmonic content — warm reds are odd-harmonic-rich, cool blues are even-harmonic-pure, greens add detuned unisons, purples introduce sub-harmonics. Brush size controls amplitude. Vertical position sets fundamental pitch. Paint a landscape and hear it as a massive, breathing drone composition.

**Interaction Model:**
- *Primary:* Painting / brush strokes with color selection (continuous drawing gesture)
- *Secondary:* Eraser tool removes drones; opacity slider controls drone amplitude; tilt/pan to "scan" across a painting larger than the screen

**Synthesis Technique:** Additive synthesis with spectral shaping. Each pixel of paint contributes to a persistent bank of oscillators. The canvas is divided into pitch rows (y-axis = fundamental frequency, logarithmic mapping). Each painted region adds oscillator energy at that row's frequency with harmonic weighting determined by color: red = odd harmonics (square-wave-like), blue = even harmonics (hollow, clarinet-like), green = slightly detuned pairs (chorus effect), yellow = bright, all harmonics (sawtooth-like), purple = sub-harmonics (octave below). Brush size maps to the loudness of the contribution.

**Visual Design:** The painting itself is the visual — what you see is what you hear. A faint grid overlay shows pitch rows. Active drone regions pulse subtly with their sound energy. An optional "frequency spectrum" sidebar shows the summed harmonic content. Canvas 2D for painting (the user's brush strokes persist as a bitmap).

**Technical Approach:** Pure Web Audio API. A fixed bank of `OscillatorNode` instances (one per pitch row, ~40 rows covering the audible range in musical intervals). Each oscillator has per-harmonic `GainNode` control. As the user paints, the gain values for affected pitch rows are updated based on the painted color and density. This approach avoids creating/destroying oscillators dynamically. The canvas bitmap is the persistent state; audio gain values are recomputed from the bitmap when needed.

**Complexity Estimate:** M

**Unique Quality:** The most direct mapping between visual art and sound. You literally paint music — and the painting *is* a score that plays continuously. A sunset painting actually *sounds* like a sunset feels: warm, layered, slowly brightening. The bidirectional metaphor (painting = sound, sound = painting) is immediately graspable.

**Accessibility Notes:** Pick a color, draw anywhere — a drone appears. Painting is universally understood. The pitch-row grid provides subtle guidance without constraining freedom. Even a single brushstroke produces a sound, so engagement is instant. The eraser provides a clear "undo" mechanism. Works well on touch screens where finger-painting is natural.

---

### 9. Grain Storm

**Concept:** A frozen landscape of sound particles hovers in space — tiny fragments of recorded and synthetic audio. Draw paths through them with your cursor. Where your line passes, grains awaken and swirl in your wake, creating dense clouds of granular texture. Fast strokes produce stuttering cascades. Slow paths create shimmering sustains. The grains settle back to stillness when you stop.

**Interaction Model:**
- *Primary:* Drawing continuous paths (finger/cursor) through the grain field
- *Secondary:* Two-finger pinch to adjust grain density; shake/tilt for global grain scatter; tap a grain cluster to freeze it in a loop

**Synthesis Technique:** Granular synthesis. A source buffer (selectable from several pre-loaded textures: voice, cello, metal, water, noise) is sliced into overlapping grains (10–100ms each). Gesture dynamics control grain parameters: stroke speed → grain density (grains/second), stroke pressure → grain size, stroke position → playback position within the source buffer, vertical position → pitch transposition. Grains use Hanning or Gaussian windows for smooth overlap.

**Visual Design:** Grains rendered as small luminous particles suspended in a dark field (WebGL particle system). Particles glow when active, leave fading trails. Drawing path is visible as a luminous wake. Grain density creates visual density — sparse paths look like scattered fireflies, dense paths look like auroral curtains. Color maps to source buffer position.

**Technical Approach:** **WASM in AudioWorklet.** Granular synthesis at high density (hundreds of simultaneous grains) exceeds what JavaScript can reliably process within the 2.66ms render quantum. Rust `dsp-core` crate implements the grain scheduler, windowing, pitch-shifting, and mixing. Compiled via `wasm-pack`, loaded into AudioWorklet. Main thread handles gesture input (Pointer Events) and visual rendering (WebGL particle system). Parameter updates (grain position, density, pitch) sent to worklet via `MessagePort`. Source buffers loaded via `fetch()` and passed as `Float32Array`.

**Complexity Estimate:** L

**Unique Quality:** Makes granular synthesis — usually hidden behind parameter sliders — into a direct physical gesture. You literally sweep your hand through sound. The visual particle system creates an immediate, visceral connection between gesture and granular texture. The settleability of grains (they return to stillness) means the toy has natural breathing room.

**Accessibility Notes:** Draw anywhere — grains activate under your path immediately. The visual particles provide clear spatial feedback about where sound is happening. Different source textures are selectable from a simple palette (icons representing voice, strings, metal, water). The "frozen field" starting state is visually intriguing and invites touch. Works on mobile with single-finger drawing.

---

### 10. Murmuration

**Concept:** A flock of hundreds of sonic birds wheels and turns in the sky. Each bird emits a short tone when it changes direction sharply. Place attractors (birds flock toward) or repellers (birds scatter away). The collective motion generates cascading rhythmic patterns — dense clusters produce rapid trills, dispersed flocks create sparse, spacious textures.

**Interaction Model:**
- *Primary:* Tap to place attractor; long-press to place repeller
- *Secondary:* Drag attractor/repeller to move it; double-tap to remove; slider for flock cohesion/separation parameters

**Synthesis Technique:** Wavetable synthesis. Each bird's waveform is selected from a set of 8–16 wavetables (bell, pluck, chirp, etc.) based on its "species" (assigned at flock creation). Waveform morphs based on speed — slow birds play smoother wavetables, fast birds play brighter, more harmonically rich ones. Pitch determined by y-position (height = pitch). A note triggers when angular velocity exceeds a threshold (sharp direction change).

**Visual Design:** WebGL particle/instanced rendering. Each bird is a small triangle or wing-shape that banks and turns. Flock behavior follows Reynolds boids (separation, alignment, cohesion) with attractor/repeller forces added. Attractors glow warmly; repellers pulse with warning colors. Sound-emitting birds flash briefly. Trails optional for visual density at lower flock sizes.

**Technical Approach:** **Hybrid: Web Audio API + WASM for physics.** Boids simulation (N-body with spatial hashing for O(n log n) neighbor lookups) runs in a WASM module on a Web Worker for smooth 60fps with 200–500 birds. Audio synthesis uses Web Audio API: a pool of pre-created `OscillatorNode` → `GainNode` voices, allocated from a voice pool when birds trigger notes and released after decay. WebGL for rendering. Flock state communicated from worker to main thread via `SharedArrayBuffer` or `postMessage` per frame.

**Complexity Estimate:** L

**Unique Quality:** Three degrees of indirection — you shape forces that shape the flock that shapes the music — yet the connection between gesture and sound feels immediate. Emergent polyrhythm from collective behavior is impossible to achieve through direct sequencing. No two performances are alike, even with identical attractor placement.

**Accessibility Notes:** Tap the sky — an attractor appears and birds gather, creating a dense burst of sound. That single action demonstrates the core mechanic. The flock is visually mesmerizing even before interaction, drawing users in. Removing all attractors lets the flock drift freely, producing ambient texture. The attractor/repeller metaphor (gravity-like) is physically intuitive.

---

### 11. Magma Flow

**Concept:** A field of molten color slowly churns. Two chemical species react and diffuse — one glowing red (mapped to low frequencies), one electric blue (mapped to high frequencies). Touch the screen to inject reagents. Where red dominates, deep drones rumble. Where blue pools, crystalline overtones shimmer. The boundary between them — the reaction front — generates the most complex, evolving timbres.

**Interaction Model:**
- *Primary:* Touch to inject reagent (tap for blue species, long-press for red species)
- *Secondary:* Two-finger drag to adjust reaction rate; tilt to influence flow direction; slider for diffusion speed

**Synthesis Technique:** Spectral synthesis. The reaction-diffusion field (Gray-Scott model) is sampled across its width to generate a frequency spectrum. Each column of the field maps to a time slice; each row maps to a frequency band. Red concentration at a frequency = amplitude of that band. Blue concentration = amplitude of a higher band. The boundary region produces rapid spectral modulation as concentrations oscillate. Implemented as a bank of sine oscillators (32–64 bands) with amplitudes driven by the simulation.

**Visual Design:** WebGL shader-rendered reaction-diffusion field. The simulation itself is the visual — colors represent chemical concentrations and directly correspond to the frequency bands being heard. Injection points ripple outward. The field breathes and pulses with organic, biological movement. Color palette: deep red/orange for low-frequency species, electric blue/white for high-frequency species, purple/magenta for reaction fronts.

**Technical Approach:** **WASM for reaction-diffusion simulation + WebGL for rendering + Web Audio API for synthesis.** The Gray-Scott reaction-diffusion model runs on a 2D grid (256×256 or higher). This is compute-intensive at real-time rates — WASM provides the necessary performance (the simulation involves per-cell multiply-add operations across the entire grid every frame). The WASM module outputs the grid state; WebGL renders it as a texture; the audio engine samples one row (or averaged rows) to drive oscillator amplitudes. Oscillators are a fixed bank of `OscillatorNode` + `GainNode` pairs in Web Audio API.

**Complexity Estimate:** L

**Unique Quality:** Genuine self-organization. The music emerges from the same equations that govern animal coat patterns, chemical oscillations, and morphogenesis. Touch is catalytic, not dictatorial — you can't precisely control the patterns, only influence them. The visual and sonic are rigorously coupled: you hear exactly what you see.

**Accessibility Notes:** Touch the screen — color and sound ripple outward. The reaction-diffusion runs autonomously, so even without interaction, the field evolves and produces changing sound. The visual spectacle draws users in before they even notice the sound. Injection is satisfying because the system responds dramatically to each touch. The two-species metaphor (red vs. blue) is simple to grasp.

---

### 12. Shadow Puppets

**Concept:** Your webcam captures your silhouette against a bright background. Your shadow becomes an instrument. Raise your arms — pitch rises. Spread wide — sound fans across stereo space. Move quickly — intensity and distortion increase. Hold still — the sound crystallizes into a pure, shimmering tone. Multiple people can play together, their shadows creating harmonic counterpoint.

**Interaction Model:**
- *Primary:* Camera / full-body gesture (silhouette area, vertical center of mass, horizontal spread, motion speed)
- *Secondary:* Tap screen to toggle between different timbral modes; slider for sensitivity

**Synthesis Technique:** Layered FM synthesis with gamelan-inspired tuning. The base sound is an FM pair (carrier + modulator) with slightly inharmonic partials mimicking metalophone and gong timbres. Silhouette vertical center → carrier frequency (low = low pitch, high = high). Silhouette area → modulation index (large shadow = rich harmonics, small = pure tone). Motion speed → amplitude + modulation depth (movement = energy, stillness = clarity). Horizontal spread → stereo pan width.

**Visual Design:** The webcam feed is processed to extract silhouettes (background subtraction or simple luminance threshold). Silhouettes are rendered as dark shapes against a glowing, reactive background. The background color responds to the sound: warmer colors for lower pitches, cooler for higher. Motion trails show recent movement. When multiple people are present, each silhouette gets a distinct background glow color.

**Technical Approach:** Camera input via `getUserMedia` (video stream). Silhouette extraction: Canvas 2D `getImageData()` → luminance threshold → connected component analysis (for multi-person detection). Feature extraction (center of mass, area, spread, frame-to-frame motion) computed per frame on main thread. Audio synthesis: pure Web Audio API FM synthesis (2–3 `OscillatorNode` pairs per detected person). **Multiplayer by nature:** multiple people in the camera frame produce separate silhouettes, each driving their own FM voice. Canvas 2D for rendering the processed silhouettes and reactive background.

**Complexity Estimate:** L

**Unique Quality:** The whole body as instrument. No screen to touch, no mouse to hold — just move. Deeply accessible, including for those who can't use traditional pointer-based input devices. The gamelan-inspired tuning rewards both motion (energetic metallic textures) and stillness (pure, bell-like tones). Naturally multiplayer — just step into the frame.

**Accessibility Notes:** Stand in front of the camera — sound appears immediately from your silhouette. The "try moving" prompt is sufficient instruction. Movement speed maps to energy, so tentative swaying produces gentle sound and vigorous dancing produces intense sound — matching expectations perfectly. Works for anyone who can be seen by a camera, regardless of motor ability. Fallback to mouse-driven "virtual shadow" for devices without cameras.

---

### 13. Moss Radio

**Concept:** Press play, and the toy begins listening to whatever is around you — traffic, birdsong, conversation, silence. It captures short fragments and slowly transforms them: stretching time, shifting pitch down by octaves, layering copies with slight detuning. Your mundane sound environment is revealed as a lush ambient soundscape. A conversation becomes whale song. Traffic becomes tidal rhythm.

**Interaction Model:**
- *Primary:* Passive microphone listening (the environment is the input)
- *Secondary:* Slider for transformation depth (subtle ↔ extreme); slider for time-stretch factor; tap to "freeze" the current texture as a loop

**Synthesis Technique:** Real-time granular time-stretching and spectral processing of live microphone input. Incoming audio is continuously buffered (rolling 10–30 second window). Grains are extracted from the buffer with large overlap and variable playback rate (time-stretching without pitch change) or with pitch-shift (octave down via halved playback rate). Multiple time-stretched copies are layered with slight detuning (±2–5 cents) and stereo spread to create width and richness. A gentle reverb (convolution or feedback delay network) adds space.

**Visual Design:** A mossy, organic background that grows and shifts in response to audio input. Louder inputs produce brighter, more active growth. The transformed audio's spectral content is visualized as slowly shifting color fields — spectral centroid maps to hue, amplitude maps to brightness, spectral flatness maps to texture (smooth vs. noisy). Canvas 2D with generative texture algorithms.

**Technical Approach:** AudioWorklet for real-time granular processing of microphone input. The worklet maintains a circular buffer of recent input, performs grain extraction, time-stretching, and pitch-shifting per render quantum. This is compute-intensive — initially implemented in JavaScript AudioWorklet, with WASM upgrade path if performance is insufficient on mobile. Microphone: `getUserMedia` with raw settings → `MediaStreamSourceNode` → custom AudioWorklet → `GainNode` → reverb → destination. Main thread handles UI and visualization via `AnalyserNode` tapped from the output.

**Complexity Estimate:** M

**Unique Quality:** Requires no skill and no action. Just turn it on and listen to your world transformed. The most contemplative toy — it teaches you to hear differently. Works in any environment because any environment contains beauty. The transformation reveals hidden musicality in everyday sound.

**Accessibility Notes:** Tap "Listen" — the toy starts immediately transforming ambient sound. Zero musical skill required; zero ongoing interaction required. The sliders provide gentle control without demanding attention. The "freeze" button captures a particularly beautiful moment. Visual feedback confirms the microphone is active and processing. On devices without microphone access, a fallback mode processes a built-in ambient recording.

---

### 14. Cellular Choir

**Concept:** A grid of cells pulses with life and death according to Conway's Game of Life. Each living cell sings — pitch determined by column position, vowel sound (ah, eh, ee, oh, oo) determined by neighbor count. Births are bright attacks; deaths are soft releases. Stable structures produce sustained chords. Gliders trace melodic lines. Oscillators create rhythmic patterns. Seed the grid by drawing initial patterns.

**Interaction Model:**
- *Primary:* Drawing initial cell patterns on the grid (toggle cells alive/dead)
- *Secondary:* Speed slider for simulation rate; pause/step buttons; tap to place preset patterns (glider, blinker, glider gun); clear button

**Synthesis Technique:** Formant synthesis. Each living cell is a voice: a harmonically rich source (sawtooth or pulse oscillator) shaped by two formant filters (bandpass `BiquadFilterNode`) that select vowel shapes. Neighbor count (0–8) maps to vowel: 0–1 neighbors = "ah" (open), 2 = "eh", 3 = "ee" (bright, birth-sustaining), 4 = "oh", 5+ = "oo" (closed, crowded). Column position maps to pitch on a pentatonic scale. Voice polyphony is managed by a voice pool — maximum ~50 simultaneous voices on mobile, ~150 on desktop, with priority given to newly born and recently changed cells.

**Visual Design:** Grid of cells rendered on Canvas 2D. Living cells glow with color corresponding to their vowel (warm open vowels to cool closed vowels). Birth events flash bright; death events fade gradually. A subtle glow around cell clusters shows their sonic density. Optional spectrogram sidebar shows the choir's harmonic structure.

**Technical Approach:** Pure Web Audio API with voice pooling. Game of Life simulation runs on main thread (simple per-cell neighbor counting — fast enough even for 64×64 grids). Voice pool pre-allocates `OscillatorNode` → formant `BiquadFilterNode` chain → `GainNode` per voice. Birth event allocates a voice from the pool with attack envelope; death event triggers release envelope and returns voice to pool. Formant filter frequencies updated when neighbor count changes. Grid rendering via Canvas 2D with `requestAnimationFrame`.

**Complexity Estimate:** M

**Unique Quality:** A digital choir singing music no human composed. Different initial patterns produce wildly different compositions — a single glider gun becomes a perpetual melody machine. The cellular automata rules are simple enough to learn but produce endlessly surprising musical results. The formant synthesis gives the cells an eerily vocal quality.

**Accessibility Notes:** Draw a few cells — tap Start — music begins. Pre-loaded patterns (accessible from a pattern palette) let users hear interesting results immediately without understanding Game of Life rules. The "step" button lets users advance one generation at a time to understand the cause-and-effect relationship between cell patterns and sound. Pentatonic scale constraint ensures all combinations sound musical.

---

### 15. Mycelium Network

**Concept:** Tap dark earth to plant spores. They germinate and send out fungal threads — thin, branching lines that seek other spores. When threads connect two spores, a signal begins to pulse between them. Each connection pulses at a rate determined by its length. Complex networks create complex polyrhythmic webs. Nutrients (audio energy) flow through the network, creating patterns that ripple outward from high-connectivity nodes.

**Interaction Model:**
- *Primary:* Tap to plant spores (fungal nodes)
- *Secondary:* Long-press a spore to remove it; drag to adjust a spore's position (reconnects automatically); slider for network growth speed

**Synthesis Technique:** FM synthesis with network-determined routing. Each spore is an FM operator (carrier oscillator). Connections between spores define modulation routing — a connected spore modulates the carrier frequency of its neighbor. The network topology *is* the FM algorithm: a simple pair of connected spores produces basic FM; a hub-and-spoke pattern creates a complex modulation stack; a ring produces feedback FM. Connection length determines modulation rate. Connection thickness (grows over time) determines modulation depth.

**Visual Design:** Dark earth background. Spores are luminous nodes that pulse with their oscillator frequency. Threads are thin, branching lines that grow procedurally (L-system or random walk targeting nearby spores). Signal pulses travel visibly along threads as bright packets. Dense network regions glow more intensely. Canvas 2D for rendering, with organic, hand-drawn aesthetic (slight line irregularity).

**Technical Approach:** **Phonon-based (primary) with Web Audio API fallback.** This toy is the strongest candidate for Phonon integration. Each spore maps to a Phonon bus with an FM oscillator. Connections map to Phonon's signal routing (`#` operator). Signal pulsing maps to Phonon's pattern system — connection length determines pattern speed. The network topology generates a `.ph` program that is parsed, compiled, and evaluated in a WASM AudioWorklet. **Fallback:** Pure Web Audio API with `OscillatorNode` pairs per connection. FM modulation via connecting one oscillator's output to another's frequency `AudioParam`. Limited to ~20 simultaneous connections on mobile due to the cost of FM chains. **Note:** Phonon WASM port is a prerequisite; use Web Audio fallback until ready.

**Complexity Estimate:** L

**Unique Quality:** The FM synthesis algorithm is literally visible as the mycelium network. Adding a new spore doesn't just add a sound — it rewires the entire synthesis architecture. This is modular synthesis made biological. The emergent behavior of network growth means the sound evolves autonomously as threads find and connect spores.

**Accessibility Notes:** Tap to plant a spore — it begins to hum. Plant a second nearby — a thread connects them, and the sound complexifies. Two taps demonstrate the core mechanic. Network growth is autonomous and visually captivating, rewarding patience. The biological metaphor (planting, growing) is universally understood. Removing spores provides a clear "simplify" action.

---

### 16. Tide Pool

**Concept:** Touch the screen and watch ripples of sound expand outward like stones dropped in still water. Each pool is a vibrating membrane — tap gently for high, shimmering rings; press firmly for deep, resonant pulses. Where ripples collide, they interfere and create new harmonics. The surface builds an ever-shifting liquid chord from the geometry of your touches.

**Interaction Model:**
- *Primary:* Multi-touch tap and hold (pressure/area maps to excitation intensity)
- *Secondary:* Drag to create continuous wave sources; two-finger pinch to adjust membrane tension (global pitch)

**Synthesis Technique:** Physical modeling — 2D waveguide mesh (digital waveguide network simulating a vibrating membrane). The mesh is a grid of delay lines connected at junctions, with scattering coefficients that determine wave propagation, reflection, and interference. Excitation is injected at touch points. The membrane's boundary conditions (fixed edges) create standing wave patterns that produce pitched, resonant tones. Mesh density and tension parameters control the fundamental pitch and modal structure.

**Visual Design:** WebGL shader rendering the membrane displacement as a height field with specular lighting — the surface looks like disturbed water. Ripples propagate visually in sync with the audio waveguide, ensuring perfect visual-sonic correlation. Color encodes displacement amplitude (blue for troughs, white for crests). Multi-touch points shown as glowing contact circles.

**Technical Approach:** **WASM in AudioWorklet.** The 2D waveguide mesh computation (a grid of coupled delay lines, each requiring multiply-add operations per sample) is the most computationally demanding synthesis in the catalog. A 32×32 mesh has 1024 junctions, each requiring ~10 operations per sample at 48kHz — roughly 500M operations/second. This is feasible in optimized WASM with SIMD but would overwhelm JavaScript. Rust `dsp-core` crate implements the mesh with `#[target_feature(enable = "simd128")]` for WASM SIMD. Grid size adapts to device capability (16×16 on mobile, 32×32+ on desktop). Visual rendering: WebGL with the mesh displacement data uploaded as a texture each frame via `SharedArrayBuffer` (or `postMessage` fallback). Touch input via Pointer Events with pressure support.

**Complexity Estimate:** L

**Unique Quality:** The physics of wave interference *is* the composition engine. You don't choose harmonies — they emerge from the geometry of where you touch. This is the most physically authentic simulation in the catalog: real wave mechanics produce real acoustic phenomena (modes, nodes, interference patterns). The touch-to-sound connection is the most viscerally immediate — you feel like you're touching water.

**Accessibility Notes:** Touch the surface — a ripple of sound expands. The water metaphor is universally understood. Pressure sensitivity rewards varied touch (gentle vs. firm) but isn't required — any touch produces a satisfying response. Multi-touch is naturally discoverable when two fingers produce interfering waves. The membrane tension control (pinch) maps to an intuitive "tighter = higher" physical metaphor. Works on shared screens for collaborative play.

---

## Implementation Ordering

### Phase 1: Foundations (S-complexity, shared infrastructure)

Build these first — they establish core patterns reused by later toys.

| Order | Toy | Complexity | Shared Infrastructure Established |
|-------|-----|-----------|----------------------------------|
| 1 | **Pendulum Choir** | S | AudioContext lifecycle, oscillator management, physics-to-audio mapping, Canvas 2D rendering loop, parameter UI (sliders) |
| 2 | **Volcano Drum** | S | Multi-touch Pointer Events, noise synthesis, filter chains, amplitude envelopes, tap-based interaction |
| 3 | **Dream Typewriter** | S | Keyboard input handling, formant synthesis, text rendering, event-triggered voice allocation |
| 4 | **Constellation Engine** | S | Spatial placement interaction, additive synthesis, sweep/sequencing, URL-based sharing |

### Phase 2: Expanding Techniques (M-complexity, new synthesis methods)

Each toy introduces a new synthesis technique or interaction modality.

| Order | Toy | Complexity | New Technique Introduced |
|-------|-----|-----------|-------------------------|
| 5 | **Drone Painter** | M | Persistent oscillator bank, painting interaction, color-to-harmonic mapping |
| 6 | **Silk Weaver** | M | Ring modulation, grid-based composition, intersection-based synthesis |
| 7 | **Breath Garden** | M | Microphone input (`getUserMedia`), FM synthesis, breath analysis |
| 8 | **Crystal Lattice** | M | AudioWorklet (custom JS), Karplus-Strong, graph topology, network propagation |
| 9 | **Cellular Choir** | M | Voice pooling, Game of Life simulation, formant filter automation |
| 10 | **Moss Radio** | M | Live audio processing in AudioWorklet, granular time-stretching, environmental input |

### Phase 3: Advanced (L-complexity, WASM and complex systems)

These require WASM, WebGL, or camera processing infrastructure.

| Order | Toy | Complexity | Advanced Requirement |
|-------|-----|-----------|---------------------|
| 11 | **Murmuration** | L | WASM boids physics, WebGL particle rendering, voice pool at scale |
| 12 | **Shadow Puppets** | L | Camera input + silhouette extraction, multi-person detection |
| 13 | **Grain Storm** | L | WASM granular engine, WebGL particle visualization |
| 14 | **Magma Flow** | L | WASM reaction-diffusion, WebGL shader rendering, spectral bank |
| 15 | **Mycelium Network** | L | Phonon WASM integration, dynamic FM routing topology |
| 16 | **Tide Pool** | L | WASM 2D waveguide mesh with SIMD, WebGL height-field rendering |

### Shared Infrastructure Groups

Toys that share technical foundations should be built near each other:

| Infrastructure | Toys | Build With |
|---|---|---|
| **Oscillator management + envelopes** | Pendulum Choir, Constellation Engine, Drone Painter | Phase 1–2 |
| **Multi-touch + Pointer Events** | Volcano Drum, Tide Pool | Phase 1, 3 |
| **Formant synthesis** | Dream Typewriter, Cellular Choir | Phase 1, 2 |
| **Microphone input pipeline** | Breath Garden, Moss Radio, Shadow Puppets | Phase 2, 3 |
| **AudioWorklet (JS)** | Crystal Lattice, Moss Radio | Phase 2 |
| **WASM AudioWorklet** | Grain Storm, Magma Flow, Tide Pool, Murmuration | Phase 3 |
| **WebGL rendering** | Grain Storm, Murmuration, Magma Flow, Tide Pool | Phase 3 |
| **FM synthesis** | Breath Garden, Mycelium Network | Phase 2, 3 |
| **Voice pooling** | Cellular Choir, Murmuration | Phase 2, 3 |
| **Phonon integration** | Mycelium Network, Pendulum Choir (upgrade) | Phase 3 |
| **Camera input** | Shadow Puppets | Phase 3 |
| **Shareable URLs** | Constellation Engine, Crystal Lattice | Phase 1, 2 |

### Critical Path

The most valuable shared infrastructure, in build order:

1. **Audio scaffold** (AudioContext lifecycle, autoplay handling, gain management) — needed by all 16 toys
2. **Pointer Events handler** (multi-touch, pressure, capture) — needed by 12 of 16 toys
3. **Canvas 2D rendering loop** (requestAnimationFrame, responsive sizing) — needed by 12 of 16 toys
4. **Oscillator/voice management** (create, envelope, release, pooling) — needed by 10 of 16 toys
5. **AudioWorklet scaffold** (processor registration, message passing, parameter handling) — needed by 6 of 16 toys
6. **Microphone input pipeline** (getUserMedia, AnalyserNode, feature extraction) — needed by 3 toys
7. **WASM AudioWorklet bridge** (module loading, memory sharing, parameter passing) — needed by 4 toys
8. **WebGL rendering scaffold** (particle system, shader pipeline, texture upload) — needed by 4 toys
