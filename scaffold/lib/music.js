/**
 * Music theory utility library for audio toys.
 *
 * Provides pitch/tuning tables, scale quantization, chord helpers,
 * consonance checks, and polyphonic voice management with gain staging.
 *
 * Pure ES module, no dependencies.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const A4_FREQ = 440;
const A4_MIDI = 69;
const SEMITONES_PER_OCTAVE = 12;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Flat equivalents for parsing
const FLAT_TO_SHARP = {
  'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#',
  'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B',
};

// ─── 1. Pitch & Tuning ──────────────────────────────────────────────────────

/**
 * Convert MIDI note number to frequency (A440 equal temperament).
 * @param {number} midi - MIDI note number (0-127)
 * @returns {number} Frequency in Hz
 */
export function midiToFreq(midi) {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / SEMITONES_PER_OCTAVE);
}

/**
 * Convert frequency to the nearest MIDI note number.
 * @param {number} freq - Frequency in Hz
 * @returns {number} MIDI note number (may be fractional for detuned pitches)
 */
export function freqToMidi(freq) {
  return A4_MIDI + SEMITONES_PER_OCTAVE * Math.log2(freq / A4_FREQ);
}

/**
 * Convert frequency to the nearest integer MIDI note number.
 * @param {number} freq - Frequency in Hz
 * @returns {number} Nearest integer MIDI note number
 */
export function freqToNearestMidi(freq) {
  return Math.round(freqToMidi(freq));
}

/**
 * Parse a note name like "C4", "F#3", "Bb5" into a MIDI note number.
 * @param {string} name - Note name with octave (e.g., "C4", "F#3", "Bb5")
 * @returns {number} MIDI note number
 */
export function noteNameToMidi(name) {
  const match = name.match(/^([A-Ga-g][#b]?)(-?\d+)$/);
  if (!match) throw new Error(`Invalid note name: "${name}"`);

  let notePart = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  const octave = parseInt(match[2], 10);

  // Convert flats to sharps
  if (FLAT_TO_SHARP[notePart]) {
    notePart = FLAT_TO_SHARP[notePart];
  }

  const semitone = NOTE_NAMES.indexOf(notePart);
  if (semitone === -1) throw new Error(`Unknown note: "${notePart}"`);

  // MIDI: C-1 = 0, C0 = 12, C4 = 60
  return (octave + 1) * SEMITONES_PER_OCTAVE + semitone;
}

/**
 * Convert a MIDI note number to a note name string.
 * @param {number} midi - MIDI note number
 * @returns {string} Note name with octave (e.g., "C4", "F#3")
 */
export function midiToNoteName(midi) {
  const note = NOTE_NAMES[((midi % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE];
  const octave = Math.floor(midi / SEMITONES_PER_OCTAVE) - 1;
  return `${note}${octave}`;
}

/**
 * Convert a note name to frequency.
 * @param {string} name - Note name with octave (e.g., "C4")
 * @returns {number} Frequency in Hz
 */
export function noteNameToFreq(name) {
  return midiToFreq(noteNameToMidi(name));
}

/**
 * Convert a frequency to the nearest note name.
 * @param {number} freq - Frequency in Hz
 * @returns {string} Nearest note name with octave
 */
export function freqToNoteName(freq) {
  return midiToNoteName(freqToNearestMidi(freq));
}

/**
 * Pre-computed frequency table: all semitones from C0 to C8.
 * Indexed as NOTE_TABLE[noteName] = frequency.
 * Also available as NOTE_TABLE_BY_MIDI[midiNumber] = { name, freq }.
 */
export const NOTE_TABLE = {};
export const NOTE_TABLE_BY_MIDI = {};

// Build tables: C0 (MIDI 12) through C8 (MIDI 108)
for (let midi = 12; midi <= 108; midi++) {
  const name = midiToNoteName(midi);
  const freq = parseFloat(midiToFreq(midi).toFixed(2));
  NOTE_TABLE[name] = freq;
  NOTE_TABLE_BY_MIDI[midi] = { name, freq };
}


// ─── 2. Scales & Keys ───────────────────────────────────────────────────────

/**
 * Scale definitions as arrays of semitone intervals from the root.
 */
export const SCALES = {
  major:            [0, 2, 4, 5, 7, 9, 11],
  natural_minor:    [0, 2, 3, 5, 7, 8, 10],
  harmonic_minor:   [0, 2, 3, 5, 7, 8, 11],
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10],
  blues:            [0, 3, 5, 6, 7, 10],
  dorian:           [0, 2, 3, 5, 7, 9, 10],
  mixolydian:       [0, 2, 4, 5, 7, 9, 10],
  whole_tone:       [0, 2, 4, 6, 8, 10],
  chromatic:        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

/**
 * Resolve a key name (e.g., "C", "F#", "Bb") to a semitone offset from C.
 * @param {string} key - Key name
 * @returns {number} Semitone offset (0-11)
 */
function keyToSemitone(key) {
  let normalized = key.charAt(0).toUpperCase() + key.slice(1);
  if (FLAT_TO_SHARP[normalized]) normalized = FLAT_TO_SHARP[normalized];
  const idx = NOTE_NAMES.indexOf(normalized);
  if (idx === -1) throw new Error(`Unknown key: "${key}"`);
  return idx;
}

/**
 * Get all MIDI note numbers in a scale across an octave range.
 * @param {string} key - Root key (e.g., "C", "F#")
 * @param {string} scale - Scale name from SCALES
 * @param {number} octaveLow - Starting octave (inclusive)
 * @param {number} octaveHigh - Ending octave (inclusive)
 * @returns {number[]} Sorted array of MIDI note numbers
 */
function getScaleMidiNotes(key, scale, octaveLow, octaveHigh) {
  const intervals = SCALES[scale];
  if (!intervals) throw new Error(`Unknown scale: "${scale}"`);
  const rootSemitone = keyToSemitone(key);

  const notes = [];
  for (let octave = octaveLow; octave <= octaveHigh; octave++) {
    const baseMidi = (octave + 1) * SEMITONES_PER_OCTAVE + rootSemitone;
    for (const interval of intervals) {
      const midi = baseMidi + interval;
      // Only include if within the octave range (handle wrap-around)
      if (midi >= (octaveLow + 1) * SEMITONES_PER_OCTAVE &&
          midi <= (octaveHigh + 1) * SEMITONES_PER_OCTAVE + SEMITONES_PER_OCTAVE) {
        notes.push(midi);
      }
    }
  }

  // Deduplicate and sort
  return [...new Set(notes)].sort((a, b) => a - b);
}

/**
 * Get all frequencies in a scale across an octave range.
 * @param {string} [key="C"] - Root key
 * @param {string} [scale="pentatonic_minor"] - Scale name
 * @param {number} [octaveLow=2] - Starting octave
 * @param {number} [octaveHigh=6] - Ending octave
 * @returns {number[]} Sorted array of frequencies in Hz
 */
export function getScaleFrequencies(key = 'C', scale = 'pentatonic_minor', octaveLow = 2, octaveHigh = 6) {
  return getScaleMidiNotes(key, scale, octaveLow, octaveHigh).map(midi => {
    return parseFloat(midiToFreq(midi).toFixed(2));
  });
}

/**
 * Snap a frequency to the nearest note in a given key + scale.
 *
 * @param {number} frequency - Input frequency in Hz
 * @param {string} [key="C"] - Root key
 * @param {string} [scale="pentatonic_minor"] - Scale name
 * @param {string} [direction] - "up" to snap up, "down" to snap down, omit for nearest
 * @returns {number} Quantized frequency in Hz
 */
export function quantizeToScale(frequency, key = 'C', scale = 'pentatonic_minor', direction) {
  const intervals = SCALES[scale];
  if (!intervals) throw new Error(`Unknown scale: "${scale}"`);
  const rootSemitone = keyToSemitone(key);

  // Convert frequency to fractional MIDI
  const midiFloat = freqToMidi(frequency);

  // Build the set of valid semitone classes for this scale
  const validClasses = new Set(intervals.map(i => (rootSemitone + i) % SEMITONES_PER_OCTAVE));

  // Find the nearest valid MIDI note
  if (direction === 'up') {
    let midi = Math.ceil(midiFloat);
    // If we're exactly on a note, check if it's valid
    if (Math.abs(midi - midiFloat) < 0.001) {
      const pc = ((midi % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;
      if (validClasses.has(pc)) {
        return parseFloat(midiToFreq(midi).toFixed(2));
      }
    }
    // Search upward
    midi = Math.ceil(midiFloat);
    while (true) {
      const pc = ((midi % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;
      if (validClasses.has(pc)) {
        return parseFloat(midiToFreq(midi).toFixed(2));
      }
      midi++;
      if (midi > 127) break;
    }
  } else if (direction === 'down') {
    let midi = Math.floor(midiFloat);
    // If we're exactly on a note, check if it's valid
    if (Math.abs(midi - midiFloat) < 0.001) {
      const pc = ((midi % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;
      if (validClasses.has(pc)) {
        return parseFloat(midiToFreq(midi).toFixed(2));
      }
    }
    // Search downward
    midi = Math.floor(midiFloat);
    while (true) {
      const pc = ((midi % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;
      if (validClasses.has(pc)) {
        return parseFloat(midiToFreq(midi).toFixed(2));
      }
      midi--;
      if (midi < 0) break;
    }
  } else {
    // Nearest: check the rounded MIDI and neighbors
    const midiRound = Math.round(midiFloat);
    let bestMidi = null;
    let bestDist = Infinity;

    // Search within a reasonable range (one octave in each direction)
    for (let m = midiRound - SEMITONES_PER_OCTAVE; m <= midiRound + SEMITONES_PER_OCTAVE; m++) {
      const pc = ((m % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;
      if (validClasses.has(pc)) {
        const dist = Math.abs(m - midiFloat);
        if (dist < bestDist) {
          bestDist = dist;
          bestMidi = m;
        }
      }
    }

    if (bestMidi !== null) {
      return parseFloat(midiToFreq(bestMidi).toFixed(2));
    }
  }

  // Fallback: return the nearest chromatic pitch
  return parseFloat(midiToFreq(Math.round(midiFloat)).toFixed(2));
}


// ─── 3. Chord & Harmony Helpers ──────────────────────────────────────────────

/**
 * Chord type definitions as arrays of semitone intervals from the root.
 */
export const CHORD_TYPES = {
  major:      [0, 4, 7],
  minor:      [0, 3, 7],
  dim:        [0, 3, 6],
  aug:        [0, 4, 8],
  sus2:       [0, 2, 7],
  sus4:       [0, 5, 7],
  '7':        [0, 4, 7, 10],
  maj7:       [0, 4, 7, 11],
  min7:       [0, 3, 7, 10],
  dim7:       [0, 3, 6, 9],
  aug7:       [0, 4, 8, 10],
  '9':        [0, 4, 7, 10, 14],
  add9:       [0, 4, 7, 14],
  '6':        [0, 4, 7, 9],
  min6:       [0, 3, 7, 9],
  power:      [0, 7],
};

/**
 * Interval names to semitone offsets.
 */
export const INTERVALS = {
  unison:          0,
  minor_second:    1,
  major_second:    2,
  minor_third:     3,
  major_third:     4,
  perfect_fourth:  5,
  tritone:         6,
  perfect_fifth:   7,
  minor_sixth:     8,
  major_sixth:     9,
  minor_seventh:   10,
  major_seventh:   11,
  octave:          12,
};

/**
 * Get the frequencies for a chord.
 * @param {string} root - Root note with octave (e.g., "C4") or just note name (e.g., "C", defaults to octave 4)
 * @param {string} [type="major"] - Chord type from CHORD_TYPES
 * @returns {number[]} Array of frequencies in Hz
 */
export function getChordFrequencies(root, type = 'major') {
  const chordIntervals = CHORD_TYPES[type];
  if (!chordIntervals) throw new Error(`Unknown chord type: "${type}"`);

  // If no octave specified, default to octave 4
  let rootMidi;
  if (/\d/.test(root)) {
    rootMidi = noteNameToMidi(root);
  } else {
    rootMidi = noteNameToMidi(root + '4');
  }

  return chordIntervals.map(interval => {
    return parseFloat(midiToFreq(rootMidi + interval).toFixed(2));
  });
}

/**
 * Get the frequency for an interval above a given frequency.
 * @param {number} freq - Base frequency in Hz
 * @param {string|number} interval - Interval name from INTERVALS or semitone count
 * @returns {number} New frequency in Hz
 */
export function getInterval(freq, interval) {
  const semitones = typeof interval === 'string' ? INTERVALS[interval] : interval;
  if (semitones === undefined) throw new Error(`Unknown interval: "${interval}"`);
  return parseFloat((freq * Math.pow(2, semitones / SEMITONES_PER_OCTAVE)).toFixed(2));
}

/**
 * Simple consonance check based on frequency ratio.
 * Compares the ratio to known consonant intervals (with tolerance).
 *
 * @param {number} freq1 - First frequency in Hz
 * @param {number} freq2 - Second frequency in Hz
 * @returns {boolean} True if the interval is roughly consonant
 */
export function isConsonant(freq1, freq2) {
  // Consonant ratios (sorted by consonance)
  const consonantRatios = [
    1,        // unison
    2,        // octave
    3 / 2,    // perfect fifth
    4 / 3,    // perfect fourth
    5 / 4,    // major third
    6 / 5,    // minor third
    5 / 3,    // major sixth
    8 / 5,    // minor sixth
  ];

  const ratio = Math.max(freq1, freq2) / Math.min(freq1, freq2);
  // Reduce to within one octave
  let r = ratio;
  while (r >= 2) r /= 2;

  const tolerance = 0.03;
  return consonantRatios.some(c => {
    let cr = c;
    while (cr >= 2) cr /= 2;
    return Math.abs(r - cr) < tolerance;
  });
}


// ─── 4. Voice Management ────────────────────────────────────────────────────

/**
 * Compute per-voice gain for a given voice count.
 * Uses a formula that reduces gain as voices increase to prevent clipping.
 *
 * @param {number} voiceCount - Number of active voices
 * @param {number} [baseGain=0.3] - Gain for a single voice
 * @returns {number} Per-voice gain value
 */
export function computeVoiceGain(voiceCount, baseGain = 0.3) {
  if (voiceCount <= 0) return 0;
  if (voiceCount === 1) return baseGain;
  // Scale down: baseGain / sqrt(voiceCount) gives a natural reduction
  // that preserves perceived loudness while preventing clipping
  return baseGain / Math.sqrt(voiceCount);
}

/**
 * Recommended DynamicsCompressorNode settings for a master bus.
 * Apply these to a compressor connected before the final output.
 */
export const MASTER_COMPRESSOR_SETTINGS = {
  threshold: -24,
  knee: 12,
  ratio: 4,
  attack: 0.003,
  release: 0.15,
};

/**
 * Create a DynamicsCompressorNode with recommended settings.
 * @param {AudioContext} audioCtx
 * @returns {DynamicsCompressorNode}
 */
export function createMasterCompressor(audioCtx) {
  const comp = audioCtx.createDynamicsCompressor();
  comp.threshold.value = MASTER_COMPRESSOR_SETTINGS.threshold;
  comp.knee.value = MASTER_COMPRESSOR_SETTINGS.knee;
  comp.ratio.value = MASTER_COMPRESSOR_SETTINGS.ratio;
  comp.attack.value = MASTER_COMPRESSOR_SETTINGS.attack;
  comp.release.value = MASTER_COMPRESSOR_SETTINGS.release;
  return comp;
}

/**
 * Polyphonic voice pool with oldest-voice stealing and automatic gain staging.
 *
 * Usage:
 *   const pool = new VoicePool(8);
 *   const voice = pool.allocate('note-60', audioCtx);
 *   // voice.gain is a GainNode — connect your oscillator through it
 *   // voice.connect(destinationNode) to route output
 *   pool.release('note-60', audioCtx);
 *
 * @param {number} maxVoices - Maximum simultaneous voices
 * @param {Object} [options]
 * @param {number} [options.baseGain=0.3] - Gain for a single voice
 * @param {number} [options.releaseTime=0.05] - Envelope release time in seconds
 */
export class VoicePool {
  constructor(maxVoices = 8, options = {}) {
    this.maxVoices = maxVoices;
    this.baseGain = options.baseGain || 0.3;
    this.releaseTime = options.releaseTime || 0.05;
    /** @type {Map<string, {gain: GainNode, startTime: number, connected: AudioNode|null}>} */
    this._voices = new Map();
    this._order = []; // Track insertion order for voice stealing
  }

  /** Number of currently active voices. */
  get activeCount() {
    return this._voices.size;
  }

  /**
   * Allocate a voice. If the pool is full, steals the oldest voice.
   *
   * @param {string} id - Unique identifier for this voice (e.g., pointer ID, note name)
   * @param {AudioContext} audioCtx - The AudioContext
   * @returns {{ gain: GainNode, connect: (dest: AudioNode) => void }}
   */
  allocate(id, audioCtx) {
    // If this ID already exists, release it first
    if (this._voices.has(id)) {
      this._releaseImmediate(id, audioCtx);
    }

    // Steal oldest voice if at capacity
    if (this._voices.size >= this.maxVoices) {
      const oldestId = this._order[0];
      if (oldestId !== undefined) {
        this._stealVoice(oldestId, audioCtx);
      }
    }

    // Create a gain node for this voice
    const gain = audioCtx.createGain();
    const targetGain = computeVoiceGain(this._voices.size + 1, this.baseGain);
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(targetGain, audioCtx.currentTime + 0.01);

    const voice = {
      gain,
      startTime: audioCtx.currentTime,
      connected: null,
    };

    this._voices.set(id, voice);
    this._order.push(id);

    // Re-balance existing voices
    this._rebalanceGains(audioCtx);

    return {
      gain,
      connect(dest) {
        gain.connect(dest);
        voice.connected = dest;
      },
    };
  }

  /**
   * Release a voice with a smooth fade-out.
   *
   * @param {string} id - Voice identifier
   * @param {AudioContext} audioCtx - The AudioContext
   */
  release(id, audioCtx) {
    const voice = this._voices.get(id);
    if (!voice) return;

    const now = audioCtx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + this.releaseTime);

    // Remove from tracking after release completes
    setTimeout(() => {
      this._removeVoice(id);
      this._rebalanceGains(audioCtx);
    }, this.releaseTime * 1000 + 20);
  }

  /**
   * Release all voices.
   * @param {AudioContext} audioCtx
   */
  releaseAll(audioCtx) {
    const ids = [...this._voices.keys()];
    for (const id of ids) {
      this.release(id, audioCtx);
    }
  }

  /**
   * Check if a voice with the given ID is active.
   * @param {string} id
   * @returns {boolean}
   */
  has(id) {
    return this._voices.has(id);
  }

  /**
   * Get a voice by ID.
   * @param {string} id
   * @returns {{ gain: GainNode, startTime: number }|undefined}
   */
  get(id) {
    return this._voices.get(id);
  }

  /** @private */
  _stealVoice(id, audioCtx) {
    const voice = this._voices.get(id);
    if (!voice) return;

    // Quick fade to avoid click
    const now = audioCtx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + 0.005);

    // Disconnect after fade
    setTimeout(() => {
      voice.gain.disconnect();
    }, 10);

    this._removeVoice(id);
  }

  /** @private */
  _releaseImmediate(id, audioCtx) {
    const voice = this._voices.get(id);
    if (!voice) return;

    const now = audioCtx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + 0.005);

    setTimeout(() => {
      voice.gain.disconnect();
    }, 10);

    this._removeVoice(id);
  }

  /** @private */
  _removeVoice(id) {
    this._voices.delete(id);
    const idx = this._order.indexOf(id);
    if (idx !== -1) this._order.splice(idx, 1);
  }

  /** @private - Rebalance all active voice gains */
  _rebalanceGains(audioCtx) {
    const count = this._voices.size;
    if (count === 0) return;

    const targetGain = computeVoiceGain(count, this.baseGain);
    const now = audioCtx.currentTime;

    for (const voice of this._voices.values()) {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(targetGain, now, 0.02);
    }
  }
}
