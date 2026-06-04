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

## How it works in this app

The Smart Room registers real tools via `navigator.modelContext.registerTool()` at startup:

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
  async execute(args) {
    setRoomMode(args.mode);          // calls the real room action
    return { success: true, state: getRoomState() };
  }
});
```

All five tools are registered from the same `WEBMCP_TOOLS` array that drives the visual tool list in the panel. Single source of truth.

---

## Browser support

`navigator.modelContext` is not yet in any stable browser. The app handles this gracefully:

- **WebMCP available**: tools register, the Stage 4 badge shows green "N tools registered"
- **WebMCP unavailable**: the badge shows amber "WebMCP unavailable — using window.smartRoom"
- The conference demo works in both cases — the visual story never breaks

---

## Testing the capability layer today

Even without a WebMCP-enabled browser, you can verify the real capability layer:

### DevTools Console

```javascript
// One call — same as the WebMCP tool execute() callback
window.smartRoom.setRoomMode("night-coding")

// Verify state
window.smartRoom.getState()
// → { computer: true, roomLight: false, deskLamp: true, curtains: "closed" }

// Try other modes
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

These tests run against the same function layer that WebMCP `execute()` callbacks call — proving the story is real, not simulated.

---

## Registered tools

| Tool | Description | Args |
|---|---|---|
| `turnOnComputer` | Turn on the computer in the Smart Room | none |
| `turnOffRoomLight` | Turn off the main ceiling light | none |
| `turnOnDeskLamp` | Turn on the warm desk lamp | none |
| `closeCurtains` | Close the curtains | none |
| `setRoomMode` | Prepare the room for a named mode | `mode: "night-coding" \| "presentation" \| "sleep" \| "reset"` |

---

## The talk's core claim

_"These are not just fake logs. The room actions are real functions. Playwright tests can prove what the browser can and cannot see. And when WebMCP is available, these tools register against those same actions."_

The visual demo tells the story. The capability layer proves it's real.
