/**
 * createToy — the main entry point for building audio toys.
 *
 * Orchestrates audio engine, input, visuals, and UI into a cohesive
 * lifecycle. Each toy is a single call to createToy() with a config
 * object describing setup, rendering, and input handling.
 *
 * Usage:
 *   import { createToy } from './lib/toy.js';
 *
 *   createToy({
 *     name: 'My Toy',
 *     description: 'A brief description',
 *     setup(ctx) { ... return state; },
 *     onInput(ctx, state, event) { ... },
 *     render(ctx, state, time) { ... },
 *     options: { visual: 'canvas2d', inputs: ['pointer', 'keyboard'] },
 *   });
 */

import { createAudioEngine, detectCapabilities } from './audio.js';
import { createInputManager } from './input.js';
import { createVisualLayer } from './visual.js';
import { createUI } from './ui.js';

/**
 * @typedef {Object} ToyConfig
 * @property {string} name - Display name
 * @property {string} [description] - Description for info overlay
 * @property {(ctx: ToyContext) => any} setup - Initialize audio graph and return state
 * @property {(ctx: ToyContext, state: any, event: import('./input.js').ToyInputEvent) => void} [onInput] - Handle input events
 * @property {(ctx: ToyContext, state: any, time: number) => void} [render] - Visual render callback (called each frame)
 * @property {(ctx: ToyContext, state: any) => void} [teardown] - Cleanup
 * @property {Object} [options]
 * @property {'canvas2d'|'webgl'|'none'} [options.visual='canvas2d'] - Visual mode
 * @property {string[]} [options.inputs=['pointer','keyboard']] - Enabled input types
 * @property {string} [options.background='#000'] - Background color
 * @property {Object} [options.permalink] - Permalink config { getState, setState }
 */

/**
 * @typedef {Object} ToyContext
 * @property {AudioContext} audio - The AudioContext
 * @property {GainNode} masterGain - Master output gain
 * @property {AnalyserNode} analyser - Output analyser for visualization
 * @property {(node: AudioNode) => void} connect - Connect a node to the output chain
 * @property {number} sampleRate - Audio sample rate
 * @property {number} currentTime - Current audio time
 * @property {HTMLCanvasElement} canvas - The canvas element (null if visual='none')
 * @property {CanvasRenderingContext2D} ctx2d - 2D canvas context (null if visual='webgl')
 * @property {WebGLRenderingContext} gl - WebGL context (null if visual='canvas2d')
 * @property {number} width - Canvas CSS width
 * @property {number} height - Canvas CSS height
 * @property {Map} pointers - Currently active pointers
 * @property {Set} keys - Currently held keys
 * @property {Object} capabilities - Browser capability flags
 */

/**
 * Create an audio toy.
 *
 * @param {ToyConfig} config
 * @returns {Object} Toy instance with destroy() method
 */
export function createToy(config) {
  const {
    name = 'Audio Toy',
    description = '',
    setup,
    onInput,
    render,
    teardown,
    options = {},
  } = config;

  const visualMode = options.visual || 'canvas2d';
  const enabledInputs = options.inputs || ['pointer', 'keyboard'];
  const background = options.background || '#000';

  // Set up page
  document.title = name;
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.style.background = background;
  document.body.style.width = '100vw';
  document.body.style.height = '100dvh';

  // Add viewport meta if not present
  if (!document.querySelector('meta[name="viewport"]')) {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    document.head.appendChild(meta);
  }

  const capabilities = detectCapabilities();

  // Create container for the visual layer
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  document.body.appendChild(container);

  // Create visual layer
  const visual = createVisualLayer(container, {
    mode: visualMode,
    background,
    antialias: options.antialias,
  });

  // Create audio engine (starts suspended until user gesture)
  const audioEngine = createAudioEngine({
    sampleRate: options.sampleRate,
  });

  if (!audioEngine) {
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#fff;font-family:system-ui;font-size:18px;">Your browser does not support Web Audio.</div>';
    return { destroy() {} };
  }

  // Build context object passed to toy callbacks
  const ctx = {
    audio: audioEngine.ctx,
    masterGain: audioEngine.masterGain,
    analyser: audioEngine.analyser,
    connect: (node) => audioEngine.connect(node),
    get sampleRate() { return audioEngine.sampleRate; },
    get currentTime() { return audioEngine.currentTime; },
    canvas: visual.canvas,
    ctx2d: visual.ctx2d,
    gl: visual.gl,
    get width() { return visual.width; },
    get height() { return visual.height; },
    capabilities,
  };

  let state = null;
  let inputManager = null;

  // Create input manager (bound to canvas or container)
  const inputTarget = visual.canvas || container;
  inputManager = createInputManager(inputTarget, {
    pointer: enabledInputs.includes('pointer'),
    keyboard: enabledInputs.includes('keyboard'),
    mic: enabledInputs.includes('mic'),
    midi: enabledInputs.includes('midi'),
    motion: enabledInputs.includes('motion'),
    audioCtx: audioEngine.ctx,
  });

  // Expose input state on context
  ctx.pointers = inputManager.pointers;
  ctx.keys = inputManager.keys;

  // Wire input events to toy handler
  inputManager.onInput((event) => {
    // Also handle autoplay resume on any user gesture
    if (!audioEngine.isResumed) {
      audioEngine.resume();
    }
    if (onInput && state !== undefined) {
      onInput(ctx, state, event);
    }
  });

  // Create UI
  const ui = createUI({
    name,
    description,
    async onStart() {
      await audioEngine.resume();
      audioEngine.setVolume(0.75);

      // Call toy setup
      if (setup) {
        state = setup(ctx);
      }

      // Start render loop
      if (render) {
        visual.onRender((timestamp) => {
          render(ctx, state, timestamp);
        });
      }
      visual.start();

      // Enable mic if requested (needs to happen after user gesture)
      if (enabledInputs.includes('mic')) {
        inputManager.enableMic(audioEngine.ctx);
      }
    },
    onPlayPause(playing) {
      if (playing) {
        audioEngine.resume();
        visual.start();
      } else {
        audioEngine.ctx.suspend();
        visual.stop();
      }
    },
    onVolume(v) {
      audioEngine.setVolume(v);
    },
    permalink: options.permalink,
  });

  return {
    ctx,
    get state() { return state; },
    ui,
    audioEngine,
    visual,
    input: inputManager,
    destroy() {
      if (teardown && state !== undefined) {
        teardown(ctx, state);
      }
      visual.destroy();
      inputManager.destroy();
      ui.destroy();
      audioEngine.ctx.close();
      container.remove();
    },
  };
}
