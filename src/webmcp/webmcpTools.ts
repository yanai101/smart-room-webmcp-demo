// Single source of truth for WebMCP tool definitions.
// Used by: registerWebMcpTools (real registration) and stage 4 panel (visual list).
import { turnOnComputer, turnOffRoomLight, turnOnDeskLamp, closeCurtains, setRoomMode, resetRoom } from '../room/roomActions';
import { getRoomState } from '../room/roomState';

type ToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(args: Record<string, unknown>): { success: boolean; state: ReturnType<typeof getRoomState> };
};

export const WEBMCP_TOOLS: ToolDef[] = [
  {
    name: 'turnOnComputer',
    description: 'Turn on the computer in the Smart Room',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: () => { turnOnComputer(); return { success: true, state: getRoomState() }; },
  },
  {
    name: 'turnOffRoomLight',
    description: 'Turn off the main ceiling light in the Smart Room',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: () => { turnOffRoomLight(); return { success: true, state: getRoomState() }; },
  },
  {
    name: 'turnOnDeskLamp',
    description: 'Turn on the warm desk lamp in the Smart Room',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: () => { turnOnDeskLamp(); return { success: true, state: getRoomState() }; },
  },
  {
    name: 'closeCurtains',
    description: 'Close the curtains in the Smart Room',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: () => { closeCurtains(); return { success: true, state: getRoomState() }; },
  },
  {
    name: 'setRoomMode',
    description: 'Prepare the Smart Room for a named activity mode',
    inputSchema: {
      type: 'object',
      properties: { mode: { type: 'string', enum: ['night-coding', 'presentation', 'sleep', 'reset'] } },
      required: ['mode'],
      additionalProperties: false,
    },
    execute: (args) => { setRoomMode(args['mode'] as string); return { success: true, state: getRoomState() }; },
  },
  {
    name: 'resetRoom',
    description: 'Reset the Smart Room to its initial state',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: () => { resetRoom(); return { success: true, state: getRoomState() }; },
  },
];
