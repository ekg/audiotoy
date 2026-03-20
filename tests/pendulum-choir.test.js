import { test, expect } from '@playwright/test';
import { loadToy, dismissSplash, injectAudioCapture, verifyAudioOutput } from './helpers.js';

test.describe('Pendulum Choir', () => {
  test.beforeEach(async ({ page }) => {
    await injectAudioCapture(page);
  });

  test('loads without JS errors', async ({ page }) => {
    const errors = await loadToy(page, 'pendulum-choir');
    await dismissSplash(page);
    expect(errors).toEqual([]);
  });

  test('AudioContext starts after splash dismiss', async ({ page }) => {
    await loadToy(page, 'pendulum-choir');
    await dismissSplash(page);

    const state = await page.evaluate(() => window.__toyAudioContext?.state);
    expect(state).toBe('running');
  });

  test('pendulums produce audio output automatically', async ({ page }) => {
    await loadToy(page, 'pendulum-choir');
    await dismissSplash(page);

    // Pendulums start swinging automatically after splash dismiss
    // Wait a bit for audio to be generated
    await page.waitForTimeout(1000);

    const result = await verifyAudioOutput(page);
    expect(result.hasOutput).toBe(true);
  });

  test('click interaction works without errors', async ({ page }) => {
    const errors = await loadToy(page, 'pendulum-choir');
    await dismissSplash(page);

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();

    // Click in the middle area where pendulum bobs should be
    await canvas.click({ position: { x: box.width / 2, y: box.height * 0.6 } });
    await page.waitForTimeout(300);

    // Drag interaction
    await canvas.click({ position: { x: box.width * 0.3, y: box.height * 0.5 } });
    await page.waitForTimeout(300);

    expect(errors).toEqual([]);
  });

  test('canvas renders pendulums', async ({ page }) => {
    await loadToy(page, 'pendulum-choir');
    await dismissSplash(page);
    await page.waitForTimeout(500);

    const canvasInfo = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return { exists: false };
      return { exists: true, width: c.width, height: c.height };
    });
    expect(canvasInfo.exists).toBe(true);
    expect(canvasInfo.width).toBeGreaterThan(0);
  });
});
