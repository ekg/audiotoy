/**
 * Audio engine initialization and management.
 *
 * Handles AudioContext creation, autoplay policy, AudioWorklet setup,
 * sample rate negotiation, and graceful fallback.
 */

/**
 * Create and configure an AudioContext with autoplay policy handling.
 * Returns a context that may be in 'suspended' state until user gesture.
 *
 * @param {Object} [options]
 * @param {number} [options.sampleRate] - Force a specific sample rate (not recommended)
 * @returns {{ ctx: AudioContext, resume: () => Promise<void>, sampleRate: number, state: () => AudioContextState }}
 */
export function createAudioEngine(options = {}) {
  const ctxOptions = { latencyHint: 'interactive' };
  if (options.sampleRate) {
    ctxOptions.sampleRate = options.sampleRate;
  }

  let ctx;
  try {
    ctx = new AudioContext(ctxOptions);
  } catch (e) {
    // Fallback: try without options
    try {
      ctx = new AudioContext();
    } catch (e2) {
      return null; // No Web Audio support
    }
  }

  // Master gain for volume control
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);

  // Analyser for optional visualization
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.connect(masterGain);

  let resumed = false;

  async function resume() {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    resumed = true;
  }

  // Monitor state changes (background tab suspension, etc.)
  ctx.onstatechange = () => {
    if (ctx.state === 'interrupted' || ctx.state === 'suspended') {
      // Will be re-resumed on next user gesture via the UI shell
    }
  };

  // Handle visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && ctx.state === 'running') {
      // Browser may suspend — we'll resume when visible again
    } else if (!document.hidden && resumed && ctx.state === 'suspended') {
      ctx.resume();
    }
  });

  return {
    ctx,
    masterGain,
    analyser,
    resume,
    get sampleRate() { return ctx.sampleRate; },
    get state() { return ctx.state; },
    get isResumed() { return resumed; },

    /** Connect a node to the output (through analyser → master gain → destination) */
    connect(node) {
      node.connect(analyser);
    },

    /** Set master volume (0-1) */
    setVolume(v) {
      masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.02);
    },

    /** Get current audio time */
    get currentTime() { return ctx.currentTime; },
  };
}

/**
 * Register an AudioWorklet processor module.
 *
 * @param {AudioContext} ctx
 * @param {string} moduleURL - URL to the worklet processor JS file
 * @returns {Promise<boolean>} true if registered, false if AudioWorklet unavailable
 */
export async function registerWorklet(ctx, moduleURL) {
  if (!ctx.audioWorklet) {
    console.warn('AudioWorklet not supported — falling back to ScriptProcessorNode');
    return false;
  }
  try {
    await ctx.audioWorklet.addModule(moduleURL);
    return true;
  } catch (e) {
    console.warn('AudioWorklet registration failed:', e);
    return false;
  }
}

/**
 * Check browser audio capabilities.
 * @returns {Object} capability flags
 */
export function detectCapabilities() {
  return {
    webAudio: typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined',
    audioWorklet: typeof AudioContext !== 'undefined' && 'audioWorklet' in AudioContext.prototype,
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    wasm: typeof WebAssembly !== 'undefined',
  };
}
