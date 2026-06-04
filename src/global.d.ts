import type { RoomState } from './room/roomTypes';

declare global {
  interface Navigator {
    modelContext?: {
      registerTool(tool: {
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
        execute(args: Record<string, unknown>): unknown;
      }): void;
    };
  }

  interface Window {
    smartRoom: {
      getState(): RoomState;
      resetRoom(): void;
      turnOnComputer(): void;
      turnOffRoomLight(): void;
      turnOnDeskLamp(): void;
      closeCurtains(): void;
      setRoomMode(mode: string): void;
    };
  }
}
