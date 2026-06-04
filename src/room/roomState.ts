import type { RoomState } from './roomTypes';

export const initialRoomState: RoomState = {
  computer:  false,
  roomLight: true,
  deskLamp:  false,
  curtains:  'open',
};

let state: RoomState = { ...initialRoomState };

// instant=true signals "cancel animations and apply immediately" to scene subscribers
type Listener = (state: RoomState, instant: boolean) => void;
const listeners: Listener[] = [];

export function getRoomState(): RoomState {
  return { ...state };
}

export function setRoomState(partial: Partial<RoomState>): void {
  state = { ...state, ...partial };
  const snap = { ...state };
  for (const l of listeners) l(snap, false);
}

export function resetRoomState(): void {
  state = { ...initialRoomState };
  const snap = { ...state };
  for (const l of listeners) l(snap, true);
}

export function subscribeRoomState(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    const i = listeners.indexOf(listener);
    if (i !== -1) listeners.splice(i, 1);
  };
}
