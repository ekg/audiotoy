import { test, expect } from '@playwright/test';
import { loadToy, dismissSplash, injectAudioCapture, verifyAudioOutput } from './helpers.js';

test.describe('Constellation Engine', () => {
  test.beforeEach(async ({ page }) => {
    await injectAudioCapture(page);
  });

  test('loads without JS errors', async ({ page }) => {
    const errors = await loadToy(page, 'constellation-engine');
    await dismissSplash(page);
    expect(errors).toEqual([]);
  });

  test('AudioContext starts after splash dismiss', async ({ page }) => {
    await loadToy(page, 'constellation-engine');
    await dismissSplash(page);

    const state = await page.evaluate(() => window.__toyAudioContext?.state);
    expect(state).toBe('running');
  });

  test('click places a star and produces audio', async ({ page }) => {
    await loadToy(page, 'constellation-engine');
    await dismissSplash(page);

    // Click to place stars at different positions
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 200, y: 150 } });
    await page.waitForTimeout(200);
    await canvas.click({ position: { x: 300, y: 200 } });
    await page.waitForTimeout(200);
    await canvas.click({ position: { x: 400, y: 100 } });

    // Wait for the sweep beam to trigger stars
    await page.waitForTimeout(3000);

    // Check audio output
    const result = await verifyAudioOutput(page);
    expect(result.hasOutput).toBe(true);
  });

  test('no console errors during interaction', async ({ page }) => {
    const errors = await loadToy(page, 'constellation-engine');
    await dismissSplash(page);

    const canvas = page.locator('canvas');
    // Place several stars
    for (let i = 0; i < 5; i++) {
      await canvas.click({ position: { x: 100 + i * 80, y: 100 + i * 30 } });
      await page.waitForTimeout(100);
    }

    await page.waitForTimeout(1000);
    expect(errors).toEqual([]);
  });

  test('canvas renders content', async ({ page }) => {
    await loadToy(page, 'constellation-engine');
    await dismissSplash(page);
    await page.waitForTimeout(500);

    // Verify canvas is present and has dimensions
    const canvasInfo = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return c ? { width: c.width, height: c.height, exists: true } : { exists: false };
    });
    expect(canvasInfo.exists).toBe(true);
    expect(canvasInfo.width).toBeGreaterThan(0);
    expect(canvasInfo.height).toBeGreaterThan(0);
  });
});
