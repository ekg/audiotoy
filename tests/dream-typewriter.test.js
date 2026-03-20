import { test, expect } from '@playwright/test';
import { loadToy, dismissSplash, injectAudioCapture, verifyAudioOutput } from './helpers.js';

test.describe('Dream Typewriter', () => {
  test.beforeEach(async ({ page }) => {
    await injectAudioCapture(page);
  });

  test('loads without JS errors', async ({ page }) => {
    const errors = await loadToy(page, 'dream-typewriter');
    await dismissSplash(page);
    expect(errors).toEqual([]);
  });

  test('AudioContext starts after splash dismiss', async ({ page }) => {
    await loadToy(page, 'dream-typewriter');
    await dismissSplash(page);

    const state = await page.evaluate(() => window.__toyAudioContext?.state);
    expect(state).toBe('running');
  });

  test('typing produces audio output', async ({ page }) => {
    await loadToy(page, 'dream-typewriter');
    await dismissSplash(page);

    // Type some text including vowels (which produce singing sounds)
    await page.keyboard.type('hello world', { delay: 100 });
    await page.waitForTimeout(500);

    const result = await verifyAudioOutput(page);
    expect(result.hasOutput).toBe(true);
  });

  test('keyboard input renders letters on canvas', async ({ page }) => {
    await loadToy(page, 'dream-typewriter');
    await dismissSplash(page);

    // Type a few characters
    await page.keyboard.type('abc', { delay: 150 });
    await page.waitForTimeout(300);

    // Check canvas is rendering (non-blank)
    const canvasInfo = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return { exists: false };
      const ctx = c.getContext('2d');
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let nonBlack = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 0 || data[i + 1] > 0 || data[i + 2] > 0) nonBlack++;
      }
      return { exists: true, nonBlackPixels: nonBlack };
    });
    expect(canvasInfo.exists).toBe(true);
    expect(canvasInfo.nonBlackPixels).toBeGreaterThan(0);
  });

  test('no console errors during typing', async ({ page }) => {
    const errors = await loadToy(page, 'dream-typewriter');
    await dismissSplash(page);

    await page.keyboard.type('The quick brown fox jumps!', { delay: 50 });
    await page.waitForTimeout(500);

    expect(errors).toEqual([]);
  });
});
