# Audio Toy Scaffold

Common template for building interactive audio toys. Each toy is a self-contained HTML file that uses the shared engine modules.

## Quick Start

```bash
# Start the dev server (Node.js 18+, no dependencies)
node dev-server.js

# Open the example
# http://localhost:3000/examples/theremin.html
```

## Creating a New Toy

1. Copy `template.html` to `examples/my-toy.html`
2. Fill in `setup()`, `onInput()`, and `render()`
3. Open `http://localhost:3000/examples/my-toy.html`

The dev server provides live reload — save and it refreshes automatically.

## API

### `createToy(config)`

The main entry point. Handles audio initialization, autoplay policy, input binding, canvas setup, and the UI shell.

```javascript
import { createToy } from './lib/toy.js';

createToy({
  name: 'My Toy',
  description: 'How to interact with this toy.',

  setup(ctx) {
    // Build your audio graph, return state
    const osc = ctx.audio.createOscillator();
    osc.connect(ctx.masterGain);
    osc.start();
    return { osc };
  },

  onInput(ctx, state, event) {
    // Respond to pointer, keyboard, MIDI, mic, or motion
    if (event.type === 'pointer-move' && event.active) {
      state.osc.frequency.value = event.x * 1000 + 100;
    }
  },

  render(ctx, state, time) {
    // Draw visuals (called every frame)
    ctx.ctx2d.clearRect(0, 0, ctx.width, ctx.height);
  },

  teardown(ctx, state) {
    state.osc.stop();
  },

  options: {
    visual: 'canvas2d',     // 'canvas2d' | 'webgl' | 'none'
    inputs: ['pointer', 'keyboard'],
    background: '#000',
  },
});
```

### Context Object (`ctx`)

Passed to all callbacks:

| Property | Type | Description |
|----------|------|-------------|
| `audio` | `AudioContext` | The Web Audio context |
| `masterGain` | `GainNode` | Master volume node |
| `analyser` | `AnalyserNode` | Output analyser for visualization |
| `connect(node)` | Function | Connect a node to the output chain |
| `sampleRate` | `number` | Audio sample rate (e.g. 48000) |
| `currentTime` | `number` | Current audio time in seconds |
| `canvas` | `HTMLCanvasElement` | The canvas element |
| `ctx2d` | `CanvasRenderingContext2D` | 2D context (if visual='canvas2d') |
| `gl` | `WebGLRenderingContext` | WebGL context (if visual='webgl') |
| `width` / `height` | `number` | Canvas CSS dimensions |
| `pointers` | `Map` | Active pointers: `pointerId → {x, y, pressure}` |
| `keys` | `Set` | Currently held key codes |
| `capabilities` | `Object` | `{ webAudio, audioWorklet, sharedArrayBuffer, wasm }` |

### Input Events

All input types are unified into a single event stream:

| Event Type | Key Properties |
|-----------|---------------|
| `pointer-down` | `x`, `y`, `pointerId`, `pointerType`, `pressure` |
| `pointer-move` | `x`, `y`, `pointerId`, `active` (whether pointer is pressed) |
| `pointer-up` | `x`, `y`, `pointerId` |
| `key-down` | `key` (physical code, e.g. `'KeyA'`, `'Space'`) |
| `key-up` | `key` |
| `midi` | `midiData` (Uint8Array) |
| `motion` | `motion.alpha`, `motion.beta`, `motion.gamma` |

Coordinates `x` and `y` are normalized to 0–1 relative to the canvas.

### Options

| Option | Values | Default |
|--------|--------|---------|
| `visual` | `'canvas2d'`, `'webgl'`, `'none'` | `'canvas2d'` |
| `inputs` | Array of: `'pointer'`, `'keyboard'`, `'mic'`, `'midi'`, `'motion'` | `['pointer', 'keyboard']` |
| `background` | CSS color string | `'#000'` |

## Architecture

```
scaffold/
├── lib/
│   ├── toy.js      ← createToy() entry point, lifecycle orchestration
│   ├── audio.js    ← AudioContext, autoplay, AudioWorklet, capabilities
│   ├── input.js    ← Unified pointer/keyboard/mic/MIDI/motion input
│   ├── visual.js   ← Canvas/WebGL setup, responsive sizing, rAF loop
│   └── ui.js       ← Splash screen, controls, info overlay, share
├── template.html   ← Copy this to start a new toy
├── examples/
│   └── theremin.html  ← Working example demonstrating all features
├── dev-server.js   ← Zero-dependency dev server with live reload
└── README.md
```

### Audio Pipeline

```
Your nodes → AnalyserNode → MasterGain → AudioContext.destination
                  ↑              ↑
            (visualization)  (volume control)
```

Use `ctx.connect(node)` to route audio through the analyser and master gain. The analyser provides data for visualization, and the master gain handles the volume slider.

### Autoplay Handling

Browsers block audio until a user gesture. The scaffold handles this automatically:
1. A splash screen ("tap to start") covers the page on load
2. On tap/click, the AudioContext is resumed
3. `setup()` is called only after audio is ready
4. Any subsequent interaction also attempts to resume (handles background tab suspension)

### Mobile Support

- Touch is the primary input — Pointer Events provide unified mouse/touch/pen handling
- `touch-action: none` prevents browser gestures from stealing events
- Canvas is responsive via ResizeObserver
- Viewport meta tag prevents pinch-to-zoom
- Touch targets in the UI are 44px minimum

## Adding WASM Synthesis

For toys that need custom DSP beyond Web Audio's built-in nodes:

```javascript
setup(ctx) {
  // Check capabilities
  if (!ctx.capabilities.audioWorklet) {
    // Fall back to simpler synthesis
  }

  // Register a worklet processor
  // (audio.js provides registerWorklet() for this)
}
```

The dev server sets the required CORS headers (`Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`) for SharedArrayBuffer access, which WASM AudioWorklet integration may need.
