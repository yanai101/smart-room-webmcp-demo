// Registers WebMCP tools via navigator.modelContext if available.
// Returns status without touching the DOM — callers decide how to display it.
import { WEBMCP_TOOLS } from './webmcpTools';

export type WebMcpRegistrationStatus = 'registered' | 'fallback' | 'failed';

let status: WebMcpRegistrationStatus = 'fallback';

export function getWebMcpRegistrationStatus(): WebMcpRegistrationStatus {
  return status;
}

export function registerWebMcpTools(): WebMcpRegistrationStatus {
  if (!('modelContext' in navigator) || !navigator.modelContext) {
    console.warn('[SmartRoom] navigator.modelContext unavailable — using window.smartRoom fallback');
    status = 'fallback';
    return status;
  }
  try {
    for (const tool of WEBMCP_TOOLS) {
      navigator.modelContext.registerTool({
        name:        tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute:     tool.execute,
      });
    }
    console.info('[SmartRoom] WebMCP tools registered:', WEBMCP_TOOLS.map(t => t.name).join(', '));
    status = 'registered';
  } catch (err) {
    console.error('[SmartRoom] WebMCP registration failed:', err);
    status = 'failed';
  }
  return status;
}
