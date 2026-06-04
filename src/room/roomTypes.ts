export type RoomMode = 'night-coding' | 'presentation' | 'sleep' | 'reset';

export type CurtainsState = 'open' | 'closed';

export type RoomState = {
  computer:  boolean;
  roomLight: boolean;
  deskLamp:  boolean;
  curtains:  CurtainsState;
};
