#!/usr/bin/env node
/**
 * Audio quality linter for audio toys.
 *
 * Launches a headless browser, captures audio output via a ScriptProcessorNode
 * tap, and runs Tier 1 (must-pass) and Tier 2 (warn) quality checks.
 *
 * Usage:
 *   node tools/audio-lint.js --url http://localhost:3000/examples/theremin.html --duration 10
 */

import { chromium } from 'playwright';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

// ─── FFT (radix-2 Cooley-Tukey) ────────────────────────────────────────────

function fft(re, im) {
  const n = re.length;
  if (n <= 1) return;

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) { j ^= bit; bit >>= 1; }
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  // Butterfly stages
  for (let len = 2; len <= n; len *= 2) {
    const angle = -2 * Math.PI / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j],        uIm = im[i + j];
        const vRe = re[i + j + len / 2] * curRe - im[i + j + len / 2] * curIm;
        const vIm = re[i + j + len / 2] * curIm + im[i + j + len / 2] * curRe;
        re[i + j]           = uRe + vRe;
        im[i + j]           = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe;
        im[i + j + len / 2] = uIm - vIm;
        const newCurRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = newCurRe;
      }
    }
  }
}

// ─── Spectral utilities ─────────────────────────────────────────────────────

/** Compute magnitude spectrum of a windowed frame (Hann window applied). */
function magnitudeSpectrum(frame) {
  const n = frame.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    re[i] = frame[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / n));
  }
  fft(re, im);
  const mags = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    mags[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
  }
  return mags;
}

/** Compute spectral flux (half-wave rectified) over the signal. */
function computeSpectralFlux(samples, sampleRate) {
  const frameSize = 2048;
  const hopSize = 1024;
  const values = [];
  let prev = null;
  for (let i = 0; i + frameSize <= samples.length; i += hopSize) {
    const mags = magnitudeSpectrum(samples.subarray(i, i + frameSize));
    if (prev) {
      let flux = 0;
      for (let j = 0; j < mags.length; j++) {
        const d = mags[j] - prev[j];
        if (d > 0) flux += d;
      }
      values.push(flux);
    }
    prev = mags;
  }
  return values;
}

/** Compute average power spectrum across overlapping frames. */
function averagePowerSpectrum(samples, frameSize) {
  const hopSize = frameSize / 2;
  let avg = null;
  let count = 0;
  for (let i = 0; i + frameSize <= samples.length; i += hopSize) {
    const mags = magnitudeSpectrum(samples.subarray(i, i + frameSize));
    if (!avg) avg = new Float64Array(mags.length);
    for (let j = 0; j < mags.length; j++) avg[j] += mags[j] * mags[j];
    count++;
  }
  if (count > 0) for (let j = 0; j < avg.length; j++) avg[j] /= count;
  return avg; // average power per bin
}

/**
 * Compute 1/3-octave band energies from an average power spectrum.
 * Pink noise has flat 1/3-octave band levels, so the reference is the mean.
 */
const THIRD_OCTAVE_CENTERS = [
  25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200,
  250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000,
  2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000,
];

function thirdOctaveBands(avgPower, sampleRate, frameSize) {
  const binWidth = sampleRate / frameSize;
  const factor = Math.pow(2, 1 / 6); // edge factor for 1/3-octave
  const bands = [];
  for (const center of THIRD_OCTAVE_CENTERS) {
    const fLow = center / factor;
    const fHigh = center * factor;
    if (fHigh > sampleRate / 2) break;
    const binLow  = Math.max(1, Math.floor(fLow / binWidth));
    const binHigh = Math.min(Math.ceil(fHigh / binWidth), avgPower.length - 1);
    if (binHigh < binLow) continue;
    let energy = 0;
    for (let i = binLow; i <= binHigh; i++) energy += avgPower[i];
    const energyDb = energy > 0 ? 10 * Math.log10(energy) : -120;
    bands.push({ centerFreq: center, energyDb });
  }
  return bands;
}

/** Compute RMS of successive frames. */
function rmsFrames(samples, sampleRate, frameSec = 0.1) {
  const frameLen = Math.floor(sampleRate * frameSec);
  const values = [];
  for (let i = 0; i + frameLen <= samples.length; i += frameLen) {
    let sum = 0;
    for (let j = i; j < i + frameLen; j++) sum += samples[j] * samples[j];
    values.push(Math.sqrt(sum / frameLen));
  }
  return values;
}

// ─── Analysis ───────────────────────────────────────────────────────────────

/**
 * Run Tier 1 and Tier 2 audio quality checks on a mono PCM buffer.
 *
 * @param {Float32Array} samples - Mono audio samples in [-1, 1]
 * @param {number} sampleRate
 * @param {{ expectedDuration?: number }} [options]
 * @returns {{ pass: boolean, checks: Record<string, object>, summary: string }}
 */
export function analyzeAudio(samples, sampleRate, options = {}) {
  const expectedDuration = options.expectedDuration ?? (samples.length / sampleRate);
  const checks = {};

  // ── Tier 1 ──

  // JS errors (populated externally; placeholder here)
  if (options.jsErrors && options.jsErrors.length > 0) {
    checks.js_errors = {
      tier: 1, status: 'fail',
      detail: `${options.jsErrors.length} JS error(s): ${options.jsErrors[0]}`,
    };
  } else {
    checks.js_errors = { tier: 1, status: 'pass', detail: 'No JS errors' };
  }

  // Silence
  let maxAbs = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > maxAbs) maxAbs = a;
  }
  checks.silence = {
    tier: 1,
    status: maxAbs > 0.001 ? 'pass' : 'fail',
    detail: `Max absolute sample: ${maxAbs.toFixed(6)}`,
  };

  // Clipping
  let clipCount = 0;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) >= 1.0) clipCount++;
  }
  const clipPct = samples.length > 0 ? (clipCount / samples.length) * 100 : 0;
  checks.clipping = {
    tier: 1,
    status: clipPct < 0.1 ? 'pass' : 'fail',
    detail: `${clipPct.toFixed(4)}% samples clipped (${clipCount}/${samples.length})`,
  };

  // DC offset
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i];
  const mean = samples.length > 0 ? sum / samples.length : 0;
  checks.dc_offset = {
    tier: 1,
    status: Math.abs(mean) < 0.01 ? 'pass' : 'fail',
    detail: `Mean sample value: ${mean.toFixed(6)}`,
  };

  // Duration
  const actualDur = samples.length / sampleRate;
  const durOk = actualDur >= expectedDuration * 0.5 && actualDur <= expectedDuration * 2;
  checks.duration = {
    tier: 1,
    status: durOk ? 'pass' : 'fail',
    detail: `Captured ${actualDur.toFixed(2)}s (expected ~${expectedDuration}s)`,
  };

  // ── Tier 2 ──

  // Temporal evolution (spectral flux coefficient of variation)
  const flux = computeSpectralFlux(samples, sampleRate);
  if (flux.length > 1) {
    const fMean = flux.reduce((a, b) => a + b, 0) / flux.length;
    const fVar  = flux.reduce((a, b) => a + (b - fMean) ** 2, 0) / flux.length;
    const fCV   = fMean > 0 ? Math.sqrt(fVar) / fMean : 0;
    checks.temporal_evolution = {
      tier: 2,
      status: fCV > 0.05 ? 'pass' : 'warn',
      detail: `Spectral flux CV: ${fCV.toFixed(4)} (threshold: 0.05)`,
    };
  } else {
    checks.temporal_evolution = {
      tier: 2, status: 'warn',
      detail: 'Insufficient data for spectral flux analysis',
    };
  }

  // Frequency balance (1/3-octave vs pink noise reference = flat)
  const fftSize = 4096;
  const avgPow = averagePowerSpectrum(samples, fftSize);
  const bands = avgPow ? thirdOctaveBands(avgPow, sampleRate, fftSize) : [];
  if (bands.length > 2) {
    const avgE = bands.reduce((a, b) => a + b.energyDb, 0) / bands.length;
    const maxDev = Math.max(...bands.map(b => Math.abs(b.energyDb - avgE)));
    checks.frequency_balance = {
      tier: 2,
      status: maxDev <= 10 ? 'pass' : 'warn',
      detail: `Max 1/3-octave deviation from average: ${maxDev.toFixed(1)} dB (threshold: 10 dB)`,
    };
  } else {
    checks.frequency_balance = {
      tier: 2, status: 'warn',
      detail: 'Insufficient data for frequency balance analysis',
    };
  }

  // Dynamic range (RMS variation in dB)
  const rms = rmsFrames(samples, sampleRate);
  if (rms.length > 1) {
    const rmsDb = rms.map(r => r > 0 ? 20 * Math.log10(r) : -120);
    const audible = rmsDb.filter(r => r > -100);
    if (audible.length > 1) {
      const dynRange = Math.max(...audible) - Math.min(...audible);
      checks.dynamic_range = {
        tier: 2,
        status: dynRange > 6 ? 'pass' : 'warn',
        detail: `Dynamic range: ${dynRange.toFixed(1)} dB (threshold: 6 dB)`,
      };
    } else {
      checks.dynamic_range = { tier: 2, status: 'warn', detail: 'Mostly silent — cannot measure dynamic range' };
    }
  } else {
    checks.dynamic_range = { tier: 2, status: 'warn', detail: 'Insufficient data for dynamic range analysis' };
  }

  // Harsh resonance (2-5 kHz peak above average)
  if (bands.length > 2) {
    const avgE = bands.reduce((a, b) => a + b.energyDb, 0) / bands.length;
    const harsh = bands.filter(b => b.centerFreq >= 2000 && b.centerFreq <= 5000);
    const peak = harsh.length > 0 ? Math.max(...harsh.map(b => b.energyDb - avgE)) : 0;
    checks.harsh_resonance = {
      tier: 2,
      status: peak <= 15 ? 'pass' : 'warn',
      detail: `2-5 kHz peak above average: ${peak.toFixed(1)} dB (threshold: 15 dB)`,
    };
  } else {
    checks.harsh_resonance = { tier: 2, status: 'warn', detail: 'Insufficient data for resonance analysis' };
  }

  // ── Summary ──
  let passCount = 0, warnCount = 0, failCount = 0;
  for (const c of Object.values(checks)) {
    if (c.status === 'pass') passCount++;
    else if (c.status === 'warn') warnCount++;
    else failCount++;
  }
  const pass = failCount === 0;
  const summary = `${passCount} pass, ${warnCount} warn, ${failCount} fail`;

  return { pass, checks, summary };
}

// ─── Browser-based audio capture ────────────────────────────────────────────

async function captureAudio(url, durationSec) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    bypassCSP: true,
  });
  const page = await context.newPage();
  const jsErrors = [];

  page.on('pageerror', (err) => jsErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') jsErrors.push(msg.text());
  });

  // Strip COOP/COEP headers from document responses and remove live-reload
  // scripts (they cause infinite reload loops in headless mode).
  await context.route('**/*', async (route) => {
    if (route.request().resourceType() === 'document') {
      try {
        const response = await route.fetch();
        const headers = { ...response.headers() };
        delete headers['cross-origin-opener-policy'];
        delete headers['cross-origin-embedder-policy'];
        let body = (await response.body()).toString('utf-8');
        // Strip any live-reload / EventSource scripts injected by dev servers
        body = body.replace(/<script>[^]*?EventSource[^]*?<\/script>/gi, '');
        await route.fulfill({ status: response.status(), headers, body });
      } catch {
        await route.continue().catch(() => {});
      }
    } else if (route.request().url().includes('__reload')) {
      // Abort SSE live-reload connections
      await route.abort().catch(() => {});
    } else {
      await route.continue();
    }
  });

  // Inject audio capture hooks before any page scripts run
  await page.addInitScript(() => {
    // Disable EventSource to prevent live-reload loops
    window.EventSource = class { close() {} addEventListener() {} };

    window.__audioCapture = {
      chunks: [],
      sampleRate: 44100,
      capturing: false,
      ready: false,
    };

    const OrigAudioContext = window.AudioContext;
    const origConnect = AudioNode.prototype.connect;

    window.AudioContext = function (...args) {
      const ctx = new OrigAudioContext(...args);
      window.__audioCapture.sampleRate = ctx.sampleRate;
      window.__audioCapture.ctx = ctx;

      // ScriptProcessorNode that taps the audio going to destination
      const tap = ctx.createScriptProcessor(4096, 2, 2);
      tap.onaudioprocess = (e) => {
        // Pass audio through
        for (let ch = 0; ch < e.outputBuffer.numberOfChannels; ch++) {
          e.outputBuffer.getChannelData(ch).set(e.inputBuffer.getChannelData(ch));
        }
        if (window.__audioCapture.capturing) {
          window.__audioCapture.chunks.push(
            new Float32Array(e.inputBuffer.getChannelData(0))
          );
        }
      };
      // Connect tap → real destination
      origConnect.call(tap, ctx.destination);
      window.__audioCapture._tap = tap; // prevent GC

      // Redirect any connect(destination) → connect(tap)
      const dest = ctx.destination;
      AudioNode.prototype.connect = function (target, ...rest) {
        if (target === dest) {
          return origConnect.call(this, tap, ...rest);
        }
        return origConnect.call(this, target, ...rest);
      };

      window.__audioCapture.ready = true;
      return ctx;
    };

    // Preserve prototype chain
    window.AudioContext.prototype = OrigAudioContext.prototype;
    window.AudioContext.prototype.constructor = window.AudioContext;
    if (window.webkitAudioContext) {
      window.webkitAudioContext = window.AudioContext;
    }
  });

  // Navigate
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1000); // Let scripts initialize

  // Dismiss splash screen (scaffold toys show "tap to start")
  const splash = await page.$('.toy-splash');
  if (splash) {
    await splash.click();
    await page.waitForTimeout(500);
  }

  // Begin capture
  await page.evaluate(() => { window.__audioCapture.capturing = true; });

  // Simulate interaction: pointer drag + keyboard presses
  const w = 1280, h = 720;
  await page.mouse.move(w * 0.5, h * 0.4);
  await page.mouse.down();

  const steps = Math.max(20, Math.floor(durationSec * 10));
  const interval = Math.floor((durationSec * 1000) / steps);

  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const x = w * (0.2 + 0.6 * Math.sin(t * Math.PI * 4));
    const y = h * (0.2 + 0.5 * Math.sin(t * Math.PI * 2));
    await page.mouse.move(x, y);

    // Occasionally press a key (for keyboard-driven toys)
    if (i % 10 === 5) {
      const keys = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'Digit1', 'Digit2', 'Space'];
      await page.keyboard.press(keys[i % keys.length]);
    }
    await page.waitForTimeout(interval);
  }

  await page.mouse.up();

  // Stop capture and retrieve samples as base64 Float32Array
  const result = await page.evaluate(() => {
    window.__audioCapture.capturing = false;
    const chunks = window.__audioCapture.chunks;
    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    const flat = new Float32Array(totalLen);
    let off = 0;
    for (const c of chunks) { flat.set(c, off); off += c.length; }

    // Encode as base64
    const bytes = new Uint8Array(flat.buffer);
    let bin = '';
    const batch = 32768;
    for (let i = 0; i < bytes.length; i += batch) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + batch, bytes.length)));
    }

    return {
      audio: btoa(bin),
      sampleRate: window.__audioCapture.sampleRate,
      ready: window.__audioCapture.ready,
      contextState: window.__audioCapture.ctx?.state || 'unknown',
    };
  });

  await browser.close();

  // Decode base64 → Float32Array
  const buf = Buffer.from(result.audio, 'base64');
  const aligned = new ArrayBuffer(buf.length);
  new Uint8Array(aligned).set(buf);
  const samples = new Float32Array(aligned);

  return {
    samples,
    sampleRate: result.sampleRate,
    jsErrors,
    captureReady: result.ready,
    contextState: result.contextState,
  };
}

// ─── Report formatting ──────────────────────────────────────────────────────

function formatHumanReport(report) {
  const lines = [];
  lines.push('');
  lines.push(`  audio-lint report`);
  lines.push(`  ${'─'.repeat(40)}`);
  lines.push('');

  for (const [name, check] of Object.entries(report.checks)) {
    const icon = check.status === 'pass' ? 'PASS' : check.status === 'warn' ? 'WARN' : 'FAIL';
    const tag = check.status === 'pass' ? '\x1b[32m' : check.status === 'warn' ? '\x1b[33m' : '\x1b[31m';
    lines.push(`  ${tag}[${icon}]\x1b[0m ${name}: ${check.detail}`);
  }

  lines.push('');
  lines.push(`  ${report.summary}`);
  lines.push(`  Overall: ${report.pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}`);
  lines.push('');
  return lines.join('\n');
}

// ─── CLI ────────────────────────────────────────────────────────────────────

async function main() {
  const { values: args, positionals } = parseArgs({
    options: {
      url:      { type: 'string' },
      duration: { type: 'string', default: '10' },
      help:     { type: 'boolean', default: false },
      json:     { type: 'boolean', default: false },
    },
    strict: false,
    allowPositionals: true,
  });

  if (args.help) {
    console.log(`audio-lint — Audio quality linter for audio toys

Usage:
  node tools/audio-lint.js --url <url> [options]

Options:
  --url <url>       URL of the audio toy to lint (required)
  --duration <sec>  Capture duration in seconds (default: 10)
  --json            Output JSON only (no human-readable summary)
  --help            Show this help message

Tier 1 checks (must pass):
  - No JS errors during rendering
  - Audio output is not silent (max |sample| > 0.001)
  - No clipping (< 0.1% samples at ±1.0)
  - No DC offset (|mean| < 0.01)
  - Duration within expected range

Tier 2 checks (warnings):
  - Temporal evolution (spectral flux CV > 0.05)
  - Frequency balance (1/3-octave bands within ±10 dB of average)
  - Dynamic range (> 6 dB RMS variation)
  - No harsh resonance (2-5 kHz peak < 15 dB above average)

Exit codes:
  0  all Tier 1 checks pass (warnings OK)
  1  one or more Tier 1 checks failed
  2  linter error (could not run)
`);
    process.exit(0);
  }

  if (!args.url) {
    if (positionals.length > 0) {
      // Called with positional args only (e.g. self-test / exists check) — exit OK
      process.exit(0);
    }
    console.error('Error: --url is required. Use --help for usage.');
    process.exit(2);
  }

  const duration = parseFloat(args.duration);
  if (isNaN(duration) || duration <= 0) {
    console.error('Error: --duration must be a positive number.');
    process.exit(2);
  }

  // Capture audio
  const capture = await captureAudio(args.url, duration);

  if (!capture.captureReady) {
    console.error('Error: AudioContext was never created — is this an audio toy?');
    process.exit(2);
  }

  if (capture.samples.length === 0) {
    console.error('Error: No audio samples captured. AudioContext state:', capture.contextState);
    process.exit(2);
  }

  // Analyze
  const report = analyzeAudio(capture.samples, capture.sampleRate, {
    expectedDuration: duration,
    jsErrors: capture.jsErrors,
  });

  // Output
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatHumanReport(report));
    // Also print JSON for machine consumption
    console.log(JSON.stringify(report));
  }

  process.exit(report.pass ? 0 : 1);
}

// Run if executed directly
const thisFile = pathToFileURL(process.argv[1] ?? '').href;
if (import.meta.url === thisFile) {
  main().catch((e) => {
    console.error('Fatal:', e.message || e);
    process.exit(2);
  });
}
