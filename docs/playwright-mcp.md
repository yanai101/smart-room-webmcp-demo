# Running the Demo with Playwright MCP

## What this demonstrates

Stage 3 of the demo shows Playwright MCP: an LLM agent that has access to a real browser and uses snapshots and clicks to fulfill a natural-language prompt.

The key insight this stage illustrates:

> The agent **can** complete the task — but only after understanding the UI. It needs to take accessibility snapshots, reason about the element structure, identify controls, and click them one by one.

The Smart Room's controls are rendered entirely inside a `<canvas>` using Three.js. Playwright MCP can still operate the page because it uses accessibility snapshots and visual reasoning, not raw DOM selectors. But it takes multiple round-trips.

---

## Setup

### Option 1 — Official Playwright MCP server (recommended)

```bash
npx @playwright/mcp@latest
```

This starts the MCP server on stdio. Configure your MCP client (Claude Code, VS Code MCP, etc.) to use it.

### Option 2 — Via MCP client config

In `~/.claude/settings.json` or your MCP client config:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

---

## Running the demo

1. Start the app:

   ```bash
   npm run dev
   ```

2. Open `http://localhost:5174` in Claude Code or your MCP-enabled environment.

3. Give the agent this prompt:

   ```
   Open http://localhost:5174.
   Inspect the page.
   Prepare the room for night coding.
   ```

### Expected behavior

The agent will:
- Navigate to the page and take an accessibility snapshot
- See the app shell (nav buttons, panel, canvas) but **not** the Three.js room objects
- Use visual reasoning and screenshots to identify the UI
- Try to find controls for "computer", "room light", "desk lamp", "curtains"
- Eventually discover it must interact through available UI elements or conclude the controls aren't accessible
- May succeed via the stage navigation UI, but cannot directly manipulate the room

This is the contrast with Stage 4 (WebMCP): the agent has browser access but not capability access.

---

## Reveal question for the audience

After the agent attempts to complete the task, ask it:

```
What DOM elements represent the computer, the desk lamp, and the curtains?
```

**Expected answer**: It should not find real DOM elements for those objects, because they are Three.js meshes rendered inside `<canvas id="room">`.

This is the moment that sets up the WebMCP transition: the agent has full browser access and still cannot directly address the application's capabilities.

---

## Running the Playwright tests

These tests prove the same thing in code:

```bash
npm run test:pw
```

Or with a visible browser:

```bash
npm run test:pw:headed
```

Or with the Playwright UI:

```bash
npm run test:pw:ui
```

The tests in `tests/traditional-playwright.spec.ts` assert that **zero** DOM elements exist for room objects — reproducing exactly what an agent running `getByRole` would encounter.
