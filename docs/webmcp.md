# WebMCP Integration

## What this demonstrates

Stage 4 shows a different communication model: instead of an agent reasoning about the UI, the **application exposes its capabilities directly** as callable tools.

> "Playwright MCP understands the interface. WebMCP understands the capabilities."

The same prompt — _"Prepare the room for night coding"_ — is fulfilled with a single tool call:

```json
{ "tool": "setRoomMode", "args": { "mode": "night-coding" } }
```

No snapshots. No reasoning about DOM structure. No multi-step navigation. One call, instant response.

---

## Architecture

```
roomActions.ts          (pure capability layer — no DOM, no Three.js)
     ↓ setRoomState()
roomState.ts            (module state, subscription system)
     ↓ subscribe
scene.ts                (Three.js animations, reacts to state changes)

webmcpTools.ts          (WEBMCP_TOOLS — single source of truth for tool definitions)
     ↓
registerWebMcpTools.ts  (registers tools via navigator.modelContext)

exposeTestApi.ts        (window.smartRoom — same roomActions, for DevTools/tests)
```

`WEBMCP_TOOLS` in `src/webmcp/webmcpTools.ts` is the **single source of truth** for all WebMCP tool definitions. It is used by:
- `registerWebMcpTools.ts` — for real `navigator.modelContext.registerTool()` registration
- `stageData.ts` (Stage 4 panel) — for the visual tool discovery list and "What WebMCP Sees" comparison
- Stage 4 run sequence — for Phase 1 (tool discovery) log animation

There is no duplication of tool names or descriptions.

---

## How registration works

At startup, `src/main.ts` calls `registerWebMcpTools()`. Each tool in `WEBMCP_TOOLS` is registered via `navigator.modelContext.registerTool()` if the API is available. The tool's `execute()` callback calls the same `roomActions` functions that the app uses internally.

```typescript
navigator.modelContext.registerTool({
  name: "setRoomMode",
  description: "Prepare the Smart Room for a named activity mode",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["night-coding", "presentation", "sleep", "reset"] }
    },
    required: ["mode"]
  },
  execute(args) {
    setRoomMode(args.mode);  // same roomActions function the app uses
    return { success: true, state: getRoomState() };
  }
});
```

---

## Browser support

`navigator.modelContext` is not yet in any stable browser. The app handles this gracefully:

- **WebMCP available** — tools register, Stage 4 badge shows green "N tools registered"
- **WebMCP unavailable** — badge shows amber "WebMCP unavailable — using window.smartRoom"
- The conference demo works in both cases — the visual story never breaks

---

## Testing the capability layer today

Even without a WebMCP-enabled browser, the real capability layer is accessible.

### DevTools Console

```javascript
// One call — same as the WebMCP tool execute() callback
window.smartRoom.setRoomMode("night-coding")

// State is updated synchronously (state changes; animations are visual-only)
window.smartRoom.getState()
// → { computer: true, roomLight: false, deskLamp: true, curtains: "closed" }

// Other modes
window.smartRoom.setRoomMode("presentation")
window.smartRoom.setRoomMode("reset")

// Individual actions
window.smartRoom.turnOnComputer()
window.smartRoom.turnOffRoomLight()
window.smartRoom.turnOnDeskLamp()
window.smartRoom.closeCurtains()
```

### Playwright tests

```bash
npm run test:pw
```

The `tests/capability-api.spec.ts` file proves:
1. `setRoomMode("night-coding")` reaches the exact target state in one call
2. Individual capability calls update state independently
3. `resetRoom()` returns to the initial state
4. All capability functions are exposed and callable

State assertions use the synchronous state model — `setRoomMode` and `getState` are called in the same `page.evaluate` to eliminate any timing ambiguity. Three.js animations are visual-only and do not affect the state module.

---

## Registered tools

| Tool | Description | Args |
|---|---|---|
| `turnOnComputer` | Turn on the computer in the Smart Room | none |
| `turnOffRoomLight` | Turn off the main ceiling light | none |
| `turnOnDeskLamp` | Turn on the warm desk lamp | none |
| `closeCurtains` | Close the curtains | none |
| `setRoomMode` | Prepare the room for a named mode | `mode: "night-coding" \| "presentation" \| "sleep" \| "reset"` |
| `resetRoom` | Reset the Smart Room to initial state | none |

---

## The talk's core claim

_"These are not just fake logs. The room actions are real functions. Playwright tests can prove what the browser can and cannot see. And when WebMCP is available, these tools register against those same actions."_

The visual demo tells the story. The capability layer proves it's real.
