/**
 * Stage 4 — Capability API (the WebMCP idea)
 *
 * Demonstrates that calling the capability layer directly — the same
 * functions that WebMCP tools call — reaches the target state
 * deterministically, instantly, with a single call.
 *
 * Architecture: roomActions → roomState (pure module state, no DOM/Three.js)
 * State changes are synchronous. Tween animations are visual-only and do NOT
 * affect the state module. Assertions can read state immediately after any call.
 *
 * Note: this test does not use navigator.modelContext (browser WebMCP API).
 * It exercises window.smartRoom, which is the exact same function layer
 * that WebMCP execute() callbacks call. The point is identical:
 * "when you expose capabilities, you don't need to understand the UI."
 */
import { test, expect } from '@playwright/test';

type RoomState = { computer: boolean; roomLight: boolean; deskLamp: boolean; curtains: string };

const NIGHT_CODING: RoomState = { computer: true, roomLight: false, deskLamp: true, curtains: 'closed' };
const INITIAL:      RoomState = { computer: false, roomLight: true, deskLamp: false, curtains: 'open' };

test('setRoomMode("night-coding") reaches target state in one call', async ({ page }) => {
  await page.goto('/');

  // State changes are synchronous — call and read in the same evaluate to
  // avoid any chance of a HMR reload or navigation resetting state between calls.
  const { before, after } = await page.evaluate(() => {
    const room = (window as any).smartRoom;
    room.resetRoom();
    const before = room.getState();
    room.setRoomMode('night-coding');
    const after = room.getState();
    return { before, after };
  });

  expect(before).toEqual<RoomState>(INITIAL);
  expect(after).toEqual<RoomState>(NIGHT_CODING);

  // Screenshot shows room visuals after state change (animations are visual-only)
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/capability-night-coding.png' });
});

test('individual capability calls update state independently', async ({ page }) => {
  await page.goto('/');

  const states = await page.evaluate(() => {
    const room = (window as any).smartRoom;
    room.resetRoom();

    room.turnOnComputer();
    const s1 = room.getState();

    room.turnOffRoomLight();
    const s2 = room.getState();

    return { s1, s2 };
  });

  // Computer on, other properties unchanged
  expect(states.s1.computer).toBe(true);
  expect(states.s1.roomLight).toBe(true);   // unchanged
  expect(states.s1.deskLamp).toBe(false);   // unchanged
  expect(states.s1.curtains).toBe('open');  // unchanged

  // Room light off, computer still on
  expect(states.s2.computer).toBe(true);    // preserved
  expect(states.s2.roomLight).toBe(false);
});

test('resetRoom returns room to initial state', async ({ page }) => {
  await page.goto('/');

  const state = await page.evaluate(() => {
    const room = (window as any).smartRoom;
    room.setRoomMode('night-coding');
    room.resetRoom();
    return room.getState();
  });

  expect(state).toEqual<RoomState>(INITIAL);
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
