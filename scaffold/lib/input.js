/**
 * Unified cross-platform input system.
 *
 * Provides a single event stream for: pointer (mouse/touch/pen),
 * keyboard, microphone, MIDI, and device motion.
 * Multi-touch is tracked per-finger via pointerId.
 */

/**
 * @typedef {Object} ToyInputEvent
 * @property {string} type - 'pointer-down'|'pointer-move'|'pointer-up'|'key-down'|'key-up'|'midi'|'motion'|'mic-data'
 * @property {number} [x] - Normalized x position (0-1) relative to canvas
 * @property {number} [y] - Normalized y position (0-1) relative to canvas
 * @property {number} [pointerId] - Unique pointer ID for multi-touch
 * @property {string} [pointerType] - 'mouse'|'touch'|'pen'
 * @property {number} [pressure] - 0-1 pressure (touch/pen)
 * @property {string} [key] - Physical key code (e.g. 'KeyA', 'Space')
 * @property {boolean} [repeat] - Whether this is a key repeat
 * @property {Uint8Array} [midiData] - Raw MIDI message bytes
 * @property {Object} [motion] - { alpha, beta, gamma } device orientation
 * @property {Float32Array} [micBuffer] - Microphone audio data
 */

/**
 * Create a unified input manager bound to a target element.
 *
 * @param {HTMLElement} target - The element to capture input on (usually the canvas)
 * @param {Object} [options]
 * @param {boolean} [options.pointer=true] - Enable pointer (touch/mouse/pen)
 * @param {boolean} [options.keyboard=true] - Enable keyboard
 * @param {boolean} [options.mic=false] - Enable microphone
 * @param {boolean} [options.midi=false] - Enable MIDI
 * @param {boolean} [options.motion=false] - Enable device orientation/motion
 * @param {AudioContext} [options.audioCtx] - Required for mic input
 * @returns {Object} Input manager with on/off methods and state
 */
export function createInputManager(target, options = {}) {
  const opts = {
    pointer: true,
    keyboard: true,
    mic: false,
    midi: false,
    motion: false,
    ...options,
  };

  /** @type {Map<number, {x: number, y: number, pressure: number, pointerType: string}>} */
  const activePointers = new Map();

  /** @type {Set<string>} */
  const heldKeys = new Set();

  const listeners = [];
  let callback = null;
  let micStream = null;
  let micSource = null;
  let micAnalyser = null;

  function emit(event) {
    if (callback) callback(event);
  }

  /** Normalize coordinates to 0-1 range relative to target element */
  function normalizeCoords(clientX, clientY) {
    const rect = target.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  }

  // --- Pointer Events ---
  function onPointerDown(e) {
    e.preventDefault(); // Prevent Firefox mobile from initiating scroll/zoom
    const { x, y } = normalizeCoords(e.clientX, e.clientY);
    const info = { x, y, pressure: e.pressure, pointerType: e.pointerType };
    activePointers.set(e.pointerId, info);
    target.setPointerCapture(e.pointerId);
    emit({
      type: 'pointer-down',
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      x, y,
      pressure: e.pressure,
    });
  }

  function onPointerMove(e) {
    e.preventDefault(); // Prevent Firefox mobile default touch behaviors
    const { x, y } = normalizeCoords(e.clientX, e.clientY);
    if (activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, { x, y, pressure: e.pressure, pointerType: e.pointerType });
    }
    emit({
      type: 'pointer-move',
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      x, y,
      pressure: e.pressure,
      active: activePointers.has(e.pointerId),
    });
  }

  function onPointerEnd(e) {
    e.preventDefault();
    const { x, y } = normalizeCoords(e.clientX, e.clientY);
    activePointers.delete(e.pointerId);
    emit({
      type: 'pointer-up',
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      x, y,
    });
  }

  // --- Keyboard Events ---
  function onKeyDown(e) {
    if (heldKeys.has(e.code)) return; // Ignore repeats
    heldKeys.add(e.code);
    emit({ type: 'key-down', key: e.code });
  }

  function onKeyUp(e) {
    heldKeys.delete(e.code);
    emit({ type: 'key-up', key: e.code });
  }

  // --- Setup ---
  function addListener(el, event, handler, opts) {
    el.addEventListener(event, handler, opts);
    listeners.push({ el, event, handler, opts });
  }

  function setup() {
    if (opts.pointer) {
      addListener(target, 'pointerdown', onPointerDown, { passive: false });
      addListener(target, 'pointermove', onPointerMove, { passive: false });
      addListener(target, 'pointerup', onPointerEnd, { passive: false });
      addListener(target, 'pointercancel', onPointerEnd);
    }

    if (opts.keyboard) {
      addListener(document, 'keydown', onKeyDown);
      addListener(document, 'keyup', onKeyUp);
    }

    if (opts.motion) {
      setupMotion();
    }

    if (opts.midi) {
      setupMidi();
    }
  }

  async function setupMotion() {
    // iOS requires permission request
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const perm = await DeviceOrientationEvent.requestPermission();
        if (perm !== 'granted') return;
      } catch (e) {
        return;
      }
    }

    addListener(window, 'deviceorientation', (e) => {
      emit({
        type: 'motion',
        motion: { alpha: e.alpha, beta: e.beta, gamma: e.gamma },
      });
    });
  }

  async function setupMidi() {
    if (!navigator.requestMIDIAccess) return;
    try {
      const midi = await navigator.requestMIDIAccess();
      for (const input of midi.inputs.values()) {
        input.onmidimessage = (msg) => {
          emit({ type: 'midi', midiData: msg.data });
        };
      }
      // Handle new devices being plugged in
      midi.onstatechange = (e) => {
        if (e.port.type === 'input' && e.port.state === 'connected') {
          e.port.onmidimessage = (msg) => {
            emit({ type: 'midi', midiData: msg.data });
          };
        }
      };
    } catch (e) {
      // MIDI not available
    }
  }

  async function enableMic(audioCtx) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      micSource = audioCtx.createMediaStreamSource(micStream);
      micAnalyser = audioCtx.createAnalyser();
      micAnalyser.fftSize = 2048;
      micSource.connect(micAnalyser);
      return true;
    } catch (e) {
      return false;
    }
  }

  function getMicData() {
    if (!micAnalyser) return null;
    const data = new Float32Array(micAnalyser.fftSize);
    micAnalyser.getFloatTimeDomainData(data);
    return data;
  }

  function destroy() {
    for (const { el, event, handler, opts } of listeners) {
      el.removeEventListener(event, handler, opts);
    }
    listeners.length = 0;
    if (micStream) {
      micStream.getTracks().forEach(t => t.stop());
      micStream = null;
    }
    activePointers.clear();
    heldKeys.clear();
  }

  setup();

  return {
    /** Register the input callback */
    onInput(fn) { callback = fn; },

    /** Get currently active pointers (Map<pointerId, {x, y, pressure, pointerType}>) */
    get pointers() { return activePointers; },

    /** Get currently held keys (Set<keyCode>) */
    get keys() { return heldKeys; },

    /** Enable microphone input (requires user gesture) */
    enableMic,

    /** Get current mic audio data (Float32Array or null) */
    getMicData,

    /** Request motion permission (call from user gesture on iOS) */
    requestMotion: setupMotion,

    /** Clean up all listeners */
    destroy,
  };
}
