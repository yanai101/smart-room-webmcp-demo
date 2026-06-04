/**
 * Stage 1 — Manual Browser Automation
 *
 * Demonstrates why pixel-coordinate clicking is fragile:
 * clicking at hardcoded canvas positions does not reliably reach
 * the target room state because Three.js objects have no DOM presence.
 */
import { test, expect } from '@playwright/test';

type RoomState = { computer: boolean; roomLight: boolean; deskLamp: boolean; curtains: string };

const NIGHT_CODING_STATE: RoomState = {
  computer: true,
  roomLight: false,
  deskLamp: true,
  curtains: 'closed',
};

test('pixel clicks on canvas do not reach night-coding state', async ({ page }) => {
  await page.goto('/');

  // Reset the room to a known initial state via the capability API
  await page.evaluate(() => (window as any).smartRoom.resetRoom());

  const initialState = await page.evaluate(() => (window as any).smartRoom.getState() as RoomState);
  expect(initialState.computer).toBe(false);
  expect(initialState.roomLight).toBe(true);

  // Simulate what a manual automation agent would do:
  // Click the canvas at hardcoded pixel coordinates, hoping to hit the right objects.
  // These are the same coordinates shown in the Stage 1 code block.
  const canvas = page.locator('#room');
  await canvas.click({ position: { x: 420, y: 230 } });
  await canvas.click({ position: { x: 180, y: 120 } });
  await canvas.click({ position: { x: 300, y: 410 } });

  // Wait briefly for any animations to settle
  await page.waitForTimeout(500);

  const stateAfterClicks = await page.evaluate(() => (window as any).smartRoom.getState() as RoomState);

  // The room must NOT be in night-coding state.
  // Canvas pixel clicks do not map to Three.js object interactions.
  expect(stateAfterClicks).not.toEqual(NIGHT_CODING_STATE);

  await page.screenshot({ path: 'test-results/manual-pixel-clicks.png' });
});

test('canvas is present but room objects have no DOM representation', async ({ page }) => {
  await page.goto('/');

  // The canvas exists
  await expect(page.locator('#room')).toHaveCount(1);

  // But the Three.js objects inside it have no DOM counterparts
  await expect(page.getByRole('button', { name: /computer/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /lamp/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /curtain/i })).toHaveCount(0);
  await expect(page.getByLabel(/room light/i)).toHaveCount(0);

  // The entire room is inaccessible to DOM-based tools
  const bodyHTML = await page.evaluate(() => document.body.innerHTML);
  expect(bodyHTML).not.toMatch(/turnOnComputer|deskLamp|curtain/i);
});
