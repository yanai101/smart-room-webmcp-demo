// Pure capability layer — no DOM, no Three.js, no stage logic.
// These functions are called by: stage run sequences, WebMCP tools, window.smartRoom, Playwright tests.
import type { RoomMode } from './roomTypes';
import { setRoomState, resetRoomState } from './roomState';

export function turnOnComputer():   void { setRoomState({ computer: true }); }
export function turnOffComputer():  void { setRoomState({ computer: false }); }
export function turnOffRoomLight(): void { setRoomState({ roomLight: false }); }
export function turnOnRoomLight():  void { setRoomState({ roomLight: true }); }
export function turnOnDeskLamp():   void { setRoomState({ deskLamp: true }); }
export function turnOffDeskLamp():  void { setRoomState({ deskLamp: false }); }
export function closeCurtains():    void { setRoomState({ curtains: 'closed' }); }
export function openCurtains():     void { setRoomState({ curtains: 'open' }); }

export function setRoomMode(mode: RoomMode | string): void {
  if (mode === 'night-coding') {
    turnOnComputer(); turnOffRoomLight(); turnOnDeskLamp(); closeCurtains();
  } else if (mode === 'presentation') {
    turnOffComputer(); turnOnRoomLight(); turnOffDeskLamp(); openCurtains();
  } else if (mode === 'sleep') {
    turnOffComputer(); turnOffRoomLight(); turnOffDeskLamp(); closeCurtains();
  } else if (mode === 'reset') {
    resetRoom();
  }
}

export function resetRoom(): void {
  resetRoomState();
}
