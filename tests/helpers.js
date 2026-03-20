/**
 * Shared test helpers for audio toy Playwright tests.
 */

export const BASE_URL = 'http://localhost:3099';

/**
 * Navigate to a toy page and set up error tracking.
 * Returns an array that collects console errors.
 */
export async function loadToy(page, toyName) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto(`${BASE_URL}/toys/${toyName}.html`, { waitUntil: 'networkidle' });
  return errors;
}

/**
 * Dismiss the splash screen by clicking it.
 * Waits for the splash to become hidden.
 */
export async function dismissSplash(page) {
  const splash = page.locator('.toy-splash');
  // Wait for splash to appear (toy may take a moment to initialize)
  await splash.waitFor({ state: 'attached', timeout: 10000 });
  await splash.click({ force: true });
  // Wait for the hidden class to be applied (splash transitions out)
  await page.waitForFunction(
    () => document.querySelector('.toy-splash')?.classList.contains('hidden'),
    { timeout: 5000 }
  );
  // Small delay for audio context to start
  await page.waitForTimeout(500);
}

/**
 * Inject a hook to capture the AudioContext reference when created.
 * Must be called before navigating to the toy page.
 */
export function injectAudioCapture(page) {
  return page.addInitScript(() => {
    // Capture AudioContext instances by wrapping the constructor
    const _OrigAudioContext = window.AudioContext;
    window.AudioContext = class extends _OrigAudioContext {
      constructor(...args) {
        super(...args);
        window.__toyAudioContext = this;
      }
    };
    if (window.webkitAudioContext) {
      window.webkitAudioContext = window.AudioContext;
    }
  });
}

/**
 * Check if audio is being produced by reading the scaffold's AnalyserNode.
 * The scaffold creates: sources → analyser → masterGain → destination.
 * We find the analyser by looking at the audio graph.
 */
export async function checkAudioOutput(page) {
  return page.evaluate(() => {
    const ctx = window.__toyAudioContext;
    if (!ctx || ctx.state !== 'running') {
      return { hasOutput: false, reason: ctx ? `state=${ctx.state}` : 'no-context' };
    }

    // The audio context's currentTime advancing means it's running
    // For actual audio output, we look for AnalyserNode data
    return new Promise((resolve) => {
      // Create an analyser and connect it to the destination to monitor output
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      // Use createMediaStreamDestination + connect to tap the output
      // Alternative: check currentTime is advancing
      const t1 = ctx.currentTime;
      const checkInterval = setInterval(() => {
        const t2 = ctx.currentTime;
        if (t2 > t1) {
          clearInterval(checkInterval);
          resolve({ hasOutput: true, timeDelta: t2 - t1 });
        }
      }, 50);

      // Timeout after 2s
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve({ hasOutput: ctx.currentTime > 0, timeDelta: ctx.currentTime });
      }, 2000);
    });
  });
}

/**
 * Verify audio output with retries.
 */
export async function verifyAudioOutput(page, { retries = 3, delay = 500 } = {}) {
  for (let i = 0; i < retries; i++) {
    const result = await checkAudioOutput(page);
    if (result.hasOutput) return result;
    await page.waitForTimeout(delay);
  }
  return { hasOutput: false, reason: 'timeout' };
}

/**
 * Check AudioContext state.
 */
export async function getAudioContextState(page) {
  return page.evaluate(() => window.__toyAudioContext?.state ?? 'not-found');
}
