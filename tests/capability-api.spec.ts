/**
 * Stage 4 — Capability API (the WebMCP idea)
 *
 * Demonstrates that calling the capability layer directly — the same
 * functions that WebMCP tools call — reaches the target state
 * deterministically, instantly, with a single call.
 *
 * Note: this test does not use navigator.modelContext (browser WebMCP API).
 * It exercises window.smartRoom, which is the exact same function layer
 * that WebMCP execute() callbacks call. The point is identical:
 * "when you expose capabilities, you don't need to understand the UI."
 */
import { test, expect } from '@playwright/test';

type RoomState = { computer: boolean; roomLight: boolean; deskLamp: boolean; curtains: string };

test('setRoomMode("night-coding") reaches target state in one call', async ({ page }) => {
  await page.goto('/');

  // Start from a known clean state
  await page.evaluate(() => (window as any).smartRoom.resetRoom());

  const before = await page.evaluate(() => (window as any).smartRoom.getState() as RoomState);
  expect(before.computer).toBe(false);
  expect(before.roomLight).toBe(true);
  expect(before.deskLamp).toBe(false);
  expect(before.curtains).toBe('open');

  // One capability call — same as the WebMCP tool call shown on stage
  await page.evaluate(() => (window as any).smartRoom.setRoomMode('night-coding'));

  // Allow tween animations to complete (they're async/frame-based)
  await page.waitForTimeout(1500);

  const after = await page.evaluate(() => (window as any).smartRoom.getState() as RoomState);

  // State must match the night-coding target exactly
  expect(after).toEqual<RoomState>({
    computer:  true,
    roomLight: false,
    deskLamp:  true,
    curtains:  'closed',
  });

  await page.screenshot({ path: 'test-results/capability-night-coding.png' });
});

test('individual capability calls update state independently', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => (window as any).smartRoom.resetRoom());

  await page.evaluate(() => (window as any).smartRoom.turnOnComputer());
  const s1 = await page.evaluate(() => (window as any).smartRoom.getState() as RoomState);
  expect(s1.computer).toBe(true);
  expect(s1.roomLight).toBe(true); // unchanged

  await page.evaluate(() => (window as any).smartRoom.turnOffRoomLight());
  const s2 = await page.evaluate(() => (window as any).smartRoom.getState() as RoomState);
  expect(s2.computer).toBe(true);  // preserved
  expect(s2.roomLight).toBe(false);
});

test('resetRoom returns room to initial state', async ({ page }) => {
  await page.goto('/');

  // Drive to night-coding mode
  await page.evaluate(() => (window as any).smartRoom.setRoomMode('night-coding'));
  await page.waitForTimeout(200);

  // Reset
  await page.evaluate(() => (window as any).smartRoom.resetRoom());

  const state = await page.evaluate(() => (window as any).smartRoom.getState() as RoomState);
  expect(state).toEqual<RoomState>({
    computer:  false,
    roomLight: true,
    deskLamp:  false,
    curtains:  'open',
  });
});

test('window.smartRoom is exposed for DevTools and agent verification', async ({ page }) => {
  await page.goto('/');

  const api = await page.evaluate(() => {
    const room = (window as any).smartRoom;
    return {
      hasGetState:         typeof room?.getState === 'function',
      hasSetRoomMode:      typeof room?.setRoomMode === 'function',
      hasResetRoom:        typeof room?.resetRoom === 'function',
      hasTurnOnComputer:   typeof room?.turnOnComputer === 'function',
      hasTurnOffRoomLight: typeof room?.turnOffRoomLight === 'function',
      hasTurnOnDeskLamp:   typeof room?.turnOnDeskLamp === 'function',
      hasCloseCurtains:    typeof room?.closeCurtains === 'function',
    };
  });

  expect(api).toEqual({
    hasGetState: true, hasSetRoomMode: true, hasResetRoom: true,
    hasTurnOnComputer: true, hasTurnOffRoomLight: true,
    hasTurnOnDeskLamp: true, hasCloseCurtains: true,
  });
});
