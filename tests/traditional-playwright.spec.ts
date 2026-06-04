/**
 * Stage 2 — Traditional Playwright
 *
 * Demonstrates the DOM limitation: even the right Playwright selectors
 * fail because all room controls live inside a <canvas>, not the DOM.
 * This is the "TimeoutError: 0 elements matched" that Stage 2 shows on stage.
 *
 * These tests assert absence — they prove what Playwright *cannot* find,
 * which is the whole point of the talk.
 */
import { test, expect } from '@playwright/test';

test('getByRole finds zero room-control buttons', async ({ page }) => {
  await page.goto('/');

  // Playwright sees the canvas, not the Three.js meshes inside it.
  // These are exactly the selectors shown in the Stage 2 code block.
  await expect(page.getByRole('button', { name: /power/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /curtains/i })).toHaveCount(0);
  await expect(page.getByLabel('Room Light')).toHaveCount(0);
  await expect(page.getByTestId('desk-lamp')).toHaveCount(0);
});

test('getByRole finds zero interactive room controls', async ({ page }) => {
  await page.goto('/');

  // No sliders, checkboxes, or switches for the room state either
  await expect(page.getByRole('slider')).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('switch')).toHaveCount(0);

  // The canvas element is present — that's all Playwright sees
  const canvasCount = await page.locator('canvas').count();
  expect(canvasCount).toBe(1);

  // Confirm: the entire interactive room surface is a single <canvas>
  const canvasId = await page.locator('canvas').getAttribute('id');
  expect(canvasId).toBe('room');
});

test('DOM has no elements representing Three.js objects', async ({ page }) => {
  await page.goto('/');

  // There are no data attributes, aria labels, or ids that correspond
  // to room objects. The mesh names exist only in JavaScript memory.
  const roomObjectSelectors = [
    '[data-object="computer"]',
    '[data-object="lamp"]',
    '[data-object="curtain"]',
    '[aria-label*="computer"]',
    '[aria-label*="lamp"]',
    '#computer', '#desk-lamp', '#curtains', '#room-light',
  ];

  for (const selector of roomObjectSelectors) {
    await expect(page.locator(selector)).toHaveCount(0,
      { message: `Expected no DOM element for ${selector} — room objects are Three.js meshes, not DOM nodes` }
    );
  }
});
