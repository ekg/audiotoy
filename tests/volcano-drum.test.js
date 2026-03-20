import { test, expect } from '@playwright/test';
import { loadToy, dismissSplash, injectAudioCapture, verifyAudioOutput } from './helpers.js';

test.describe('Volcano Drum', () => {
  test.beforeEach(async ({ page }) => {
    await injectAudioCapture(page);
  });

  test('loads without JS errors', async ({ page }) => {
    const errors = await loadToy(page, 'volcano-drum');
    await dismissSplash(page);
    expect(errors).toEqual([]);
  });

  test('AudioContext starts after splash dismiss', async ({ page }) => {
    await loadToy(page, 'volcano-drum');
    await dismissSplash(page);

    const state = await page.evaluate(() => window.__toyAudioContext?.state);
    expect(state).toBe('running');
  });

  test('tap produces audio output', async ({ page }) => {
    await loadToy(page, 'volcano-drum');
    await dismissSplash(page);

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();

    // Tap in different zones: left (kick), center (snare), right (hat)
    await canvas.click({ position: { x: box.width * 0.2, y: box.height * 0.5 } });
    await page.waitForTimeout(200);
    await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
    await page.waitForTimeout(200);
    await canvas.click({ position: { x: box.width * 0.8, y: box.height * 0.5 } });
    await page.waitForTimeout(300);

    const result = await verifyAudioOutput(page);
    expect(result.hasOutput).toBe(true);
  });

  test('multiple rapid taps work without errors', async ({ page }) => {
    const errors = await loadToy(page, 'volcano-drum');
    await dismissSplash(page);

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();

    // Rapid tapping across the surface
    for (let i = 0; i < 8; i++) {
      const x = box.width * (0.1 + Math.random() * 0.8);
      const y = box.height * (0.3 + Math.random() * 0.4);
      await canvas.click({ position: { x, y } });
      await page.waitForTimeout(100);
    }

    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('canvas renders eruption visuals', async ({ page }) => {
    await loadToy(page, 'volcano-drum');
    await dismissSplash(page);

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();

    // Tap to trigger eruptions
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
    await page.waitForTimeout(200);

    const canvasInfo = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return { exists: false };
      return { exists: true, width: c.width, height: c.height };
    });
    expect(canvasInfo.exists).toBe(true);
    expect(canvasInfo.width).toBeGreaterThan(0);
  });
});
