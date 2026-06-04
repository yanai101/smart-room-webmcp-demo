// Exposes window.smartRoom for DevTools verification and Playwright capability tests.
// This is the ONLY file that writes to window.smartRoom.
// The presentation UI never depends on window.smartRoom — it imports roomActions directly.
import { getRoomState } from '../room/roomState';
import {
  turnOnComputer, turnOffRoomLight, turnOnDeskLamp,
  closeCurtains, setRoomMode, resetRoom,
} from '../room/roomActions';

export function exposeSmartRoomTestApi(): void {
  window.smartRoom = {
    getState:         getRoomState,
    resetRoom,
    turnOnComputer,
    turnOffRoomLight,
    turnOnDeskLamp,
    closeCurtains,
    setRoomMode,
  };
  console.info('[SmartRoom] Debug API ready. Try:\n  window.smartRoom.setRoomMode("night-coding")\n  window.smartRoom.getState()');
}
