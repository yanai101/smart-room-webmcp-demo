// All stage definitions — metadata, HTML panels, scripted run sequences.
// Each stage imports roomActions directly (not window.smartRoom).
import type { Stage } from './stageTypes';
import { delay, appendLog, countUp } from './stageRunner';
import {
  turnOnComputer, turnOffRoomLight, turnOnDeskLamp, closeCurtains,
  setRoomMode, resetRoom,
} from '../room/roomActions';
import { WEBMCP_TOOLS } from '../webmcp/webmcpTools';
import { getWebMcpRegistrationStatus } from '../webmcp/registerWebMcpTools';

// ── HTML template helpers ─────────────────────────────────────────────────

function promptBox() {
  return `<div class="prompt-box">
    <span class="prompt-label">Prompt</span>
    <span class="prompt-text">"Prepare the room for night coding"</span>
  </div>`;
}

function speakerNote(note: string) {
  return `<div class="speaker-notes-panel">
    <button class="speaker-notes-toggle">⦿ Speaker Notes ▾</button>
    <p class="speaker-note-text">${note}</p>
  </div>`;
}

function codeBlock(lang: string, html: string) {
  return `<div class="code-block">
    <div class="code-header">
      <span class="code-lang">${lang}</span>
      <div class="code-dots"><span></span><span></span><span></span></div>
    </div>
    <div class="code-body"><pre>${html}</pre></div>
  </div>`;
}

function archFlow(steps: string[], highlight?: number) {
  return `<div class="architecture">
    <div class="arch-label">Architecture</div>
    <div class="arch-flow">${steps.map((s,i) => `
      <div class="arch-step${i===highlight?' highlight':''}">${s}</div>
      ${i<steps.length-1?'<div class="arch-arrow-down">↓</div>':''}
    `).join('')}</div>
  </div>`;
}

function timelineHtml(steps: {label:string,type:'ok'|'fail'|'warn'|'neutral'}[]) {
  return `<div class="timeline">${steps.map((s,i) => `
    <span class="timeline-step ${s.type==='fail'?'fail-step':s.type==='ok'?'ok-step':''}">${s.label}</span>
    ${i<steps.length-1?'<span class="timeline-sep">→</span>':''}
  `).join('')}</div>`;
}

function metricsHtml(items: {label:string,value:string,cls?:string}[]) {
  return `<div class="metrics">${items.map(m=>`
    <div class="metric">
      <span class="metric-label">${m.label}</span>
      <span class="metric-value ${m.cls??''}">${m.value}</span>
    </div>
  `).join('')}</div>`;
}

function wireRunBtn(container: HTMLElement, stage: Stage) {
  container.querySelector('#run-btn')!.addEventListener('click', () => stage.run(container));
  container.querySelector('.speaker-notes-toggle')!.addEventListener('click', function() {
    const note = container.querySelector('.speaker-note-text') as HTMLElement;
    note.hidden = !note.hidden;
  });
}

// ── Stage 1: Manual Browser Automation ───────────────────────────────────

const stage1: Stage = {
  id: 'manual', label: 'Manual', number: 1, color: 'var(--red)',
  speakerNote: 'The agent is clicking pixels and hoping.',

  render(container) {
    container.innerHTML = `<div class="stage-panel" style="--stage-color:var(--red)">
      <span class="stage-badge">Stage 1 of 5</span>
      <h2 class="stage-title">Manual Browser Automation</h2>
      ${promptBox()}
      ${codeBlock('playwright.ts', `<span class="c-kw">await</span> page.<span class="c-fn">locator</span>(<span class="c-str">"canvas"</span>).<span class="c-fn">click</span>({
  position: { x: <span class="c-num">420</span>, y: <span class="c-num">230</span> }
});

<span class="c-kw">await</span> page.<span class="c-fn">locator</span>(<span class="c-str">"canvas"</span>).<span class="c-fn">click</span>({
  position: { x: <span class="c-num">180</span>, y: <span class="c-num">120</span> }
});

<span class="c-kw">await</span> page.<span class="c-fn">locator</span>(<span class="c-str">"canvas"</span>).<span class="c-fn">click</span>({
  position: { x: <span class="c-num">300</span>, y: <span class="c-num">410</span> }
});`)}
      <button class="run-btn" id="run-btn">▶ Run Manual Automation</button>
      <div class="log-stream" id="log-stream" hidden></div>
      <div class="results"   id="results"    hidden></div>
      ${speakerNote('The agent is clicking pixels and hoping.')}
    </div>`;
    wireRunBtn(container, stage1);
  },

  async run(container) {
    const runBtn  = container.querySelector('#run-btn') as HTMLButtonElement;
    const logEl   = container.querySelector('#log-stream') as HTMLElement;
    const results = container.querySelector('#results') as HTMLElement;
    runBtn.disabled = true; logEl.innerHTML = ''; results.hidden = true; logEl.hidden = false;
    resetRoom();

    await delay(400);  appendLog(logEl, 'Clicking canvas at 420,230', 'command');
    await delay(700);  appendLog(logEl, 'Trying to locate computer...', 'info');
    await delay(900);  appendLog(logEl, 'No element under cursor', 'warning');
    await delay(700);  appendLog(logEl, 'Clicking canvas at 180,120', 'command');
    await delay(700);  appendLog(logEl, 'Trying to locate room light...', 'info');
    await delay(900);  appendLog(logEl, 'Something changed — uncertain what', 'warning');
    turnOnDeskLamp();  // wrong action — demonstrates fragile automation
    await delay(700);  appendLog(logEl, 'Clicking canvas at 300,410', 'command');
    await delay(900);  appendLog(logEl, 'Unexpected result', 'warning');
    await delay(500);  appendLog(logEl, '✗ Automation Failed', 'error');

    await delay(600);
    results.hidden = false;
    results.innerHTML = `
      <div class="verdict fail">❌ Automation Failed</div>
      ${timelineHtml([{label:'click',type:'neutral'},{label:'click',type:'neutral'},{label:'click',type:'neutral'},{label:'fail',type:'fail'}])}
      ${metricsHtml([
        {label:'Clicks',value:'3'},{label:'Reasoning',value:'0'},
        {label:'Success',value:'Failed',cls:'fail'},{label:'Room State',value:'Wrong',cls:'fail'},
      ])}
      <div class="message">"The agent is clicking pixels and hoping."</div>`;
    runBtn.disabled = false;
  },
};

// ── Stage 2: Traditional Playwright ──────────────────────────────────────

const stage2: Stage = {
  id: 'playwright', label: 'Playwright', number: 2, color: 'var(--red)',
  speakerNote: "Real selectors — but a canvas exposes nothing to the DOM, so even proper Playwright can't find the controls.",

  render(container) {
    container.innerHTML = `<div class="stage-panel" style="--stage-color:var(--red)">
      <span class="stage-badge">Stage 2 of 5</span>
      <h2 class="stage-title">Traditional Playwright</h2>
      ${promptBox()}
      <p style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.5">
        Using proper semantic locators — the <em>right</em> way to automate the browser.
      </p>
      ${codeBlock('test.spec.ts', `<span class="c-kw">await</span> page.<span class="c-fn">getByRole</span>(<span class="c-str">'button'</span>, { name: <span class="c-str">'Power'</span> }).<span class="c-fn">click</span>();

<span class="c-kw">await</span> page.<span class="c-fn">getByLabel</span>(<span class="c-str">'Room Light'</span>).<span class="c-fn">click</span>();

<span class="c-kw">await</span> page.<span class="c-fn">getByTestId</span>(<span class="c-str">'desk-lamp'</span>).<span class="c-fn">click</span>();

<span class="c-kw">await</span> page.<span class="c-fn">getByRole</span>(<span class="c-str">'button'</span>, { name: <span class="c-str">'Curtains'</span> }).<span class="c-fn">click</span>();`)}
      <button class="run-btn" id="run-btn">▶ Run Playwright Test</button>
      <div class="log-stream" id="log-stream" hidden></div>
      <div class="results"   id="results"    hidden></div>
      ${speakerNote("Real selectors — but a canvas exposes nothing to the DOM, so even proper Playwright can't find the controls.")}
    </div>`;
    wireRunBtn(container, stage2);
  },

  async run(container) {
    const runBtn  = container.querySelector('#run-btn') as HTMLButtonElement;
    const logEl   = container.querySelector('#log-stream') as HTMLElement;
    const results = container.querySelector('#results') as HTMLElement;
    runBtn.disabled = true; logEl.innerHTML = ''; results.hidden = true; logEl.hidden = false;
    resetRoom();

    await delay(500);  appendLog(logEl, 'playwright test --headed', 'command');
    await delay(700);  appendLog(logEl, 'Running 1 test in 1 file...', 'info');
    await delay(800);  appendLog(logEl, "Locating getByRole('button', { name: 'Power' })", 'command');
    await delay(1000); appendLog(logEl, 'Waiting for element...', 'info');
    await delay(1200); appendLog(logEl, "Locating getByLabel('Room Light')", 'command');
    await delay(1000); appendLog(logEl, 'Waiting for element...', 'info');
    await delay(1200); appendLog(logEl, "Locating getByTestId('desk-lamp')", 'command');
    await delay(1000); appendLog(logEl, 'Waiting for element...', 'info');
    await delay(1500); appendLog(logEl, '⏱ TimeoutError: locator.click: Timeout 30000ms exceeded', 'error');
    await delay(400);  appendLog(logEl, '  0 elements matched any selector', 'error');
    await delay(400);  appendLog(logEl, '  The room is a <canvas>. There is nothing in the DOM.', 'warning');

    await delay(700);
    results.hidden = false;
    results.innerHTML = `
      <div class="verdict fail">❌ TimeoutError — 0 Elements Found</div>
      ${timelineHtml([{label:'launch',type:'neutral'},{label:'locate',type:'neutral'},{label:'wait',type:'neutral'},{label:'timeout',type:'fail'}])}
      ${metricsHtml([
        {label:'Selectors Tried',value:'4'},{label:'Elements Found',value:'0',cls:'fail'},
        {label:'Success',value:'Failed',cls:'fail'},{label:'Room Changed',value:'No',cls:'fail'},
      ])}
      <div class="message">"Real selectors, but a canvas exposes nothing to the DOM to select."</div>`;
    runBtn.disabled = false;
  },
};

// ── Stage 3: Playwright MCP ───────────────────────────────────────────────

const stage3: Stage = {
  id: 'playwright-mcp', label: 'Playwright MCP', number: 3, color: 'var(--amber)',
  speakerNote: 'The agent can use the browser, but it still needs to understand the UI.',

  render(container) {
    container.innerHTML = `<div class="stage-panel" style="--stage-color:var(--amber)">
      <span class="stage-badge">Stage 3 of 5</span>
      <h2 class="stage-title">Playwright MCP</h2>
      ${promptBox()}
      ${archFlow(['Prompt','LLM','Playwright MCP','Browser → UI'], 2)}
      <button class="run-btn" id="run-btn" style="--stage-color:var(--amber)">▶ Run Playwright MCP</button>
      <div class="log-stream" id="log-stream" hidden></div>
      <div class="results"   id="results"    hidden></div>
      ${speakerNote('The agent can use the browser, but it still needs to understand the UI.')}
    </div>`;
    wireRunBtn(container, stage3);
  },

  async run(container) {
    const runBtn  = container.querySelector('#run-btn') as HTMLButtonElement;
    const logEl   = container.querySelector('#log-stream') as HTMLElement;
    const results = container.querySelector('#results') as HTMLElement;
    runBtn.disabled = true; logEl.innerHTML = ''; results.hidden = true; logEl.hidden = false;
    resetRoom();

    await delay(400);  appendLog(logEl, 'browser_navigate("http://localhost:5173")', 'command');
    await delay(800);  appendLog(logEl, 'Opening smart room...', 'info');
    await delay(700);  appendLog(logEl, 'browser_snapshot()', 'command');
    await delay(900);  appendLog(logEl, 'Found 37 interactive elements', 'success');
    await delay(1000); appendLog(logEl, '[reasoning] Searching for room controls...', 'reasoning');
    await delay(900);  appendLog(logEl, 'browser_snapshot({ region: "panel" })', 'command');
    await delay(800);  appendLog(logEl, 'Found settings panel with power controls', 'success');
    await delay(1000); appendLog(logEl, '[reasoning] Identifying power toggle for computer', 'reasoning');
    await delay(800);  appendLog(logEl, 'browser_click({ element: "Power toggle" })', 'command');
    turnOnComputer();
    await delay(800);  appendLog(logEl, 'browser_snapshot()', 'command');
    await delay(600);  appendLog(logEl, 'Verified: computer = ON ✓', 'success');
    await delay(800);  appendLog(logEl, '[reasoning] Locate room light control', 'reasoning');
    await delay(700);  appendLog(logEl, 'browser_click({ element: "Room Light" })', 'command');
    turnOffRoomLight();
    await delay(800);  appendLog(logEl, '[reasoning] Locate desk lamp toggle', 'reasoning');
    await delay(700);  appendLog(logEl, 'browser_click({ element: "Desk Lamp" })', 'command');
    turnOnDeskLamp();
    await delay(800);  appendLog(logEl, 'browser_click({ element: "Curtains → Close" })', 'command');
    closeCurtains();
    await delay(1200); appendLog(logEl, 'browser_snapshot()', 'command');
    await delay(700);  appendLog(logEl, '✓ All states verified', 'success');

    await delay(700);
    results.hidden = false;
    results.innerHTML = `
      <div class="verdict warn">⚠ Agent had to understand the UI first</div>
      <div class="verdict success" style="margin-top:8px">✅ Success</div>
      ${timelineHtml([{label:'snapshot',type:'neutral'},{label:'reason',type:'neutral'},{label:'click',type:'neutral'},{label:'snapshot',type:'neutral'},{label:'repeat×3',type:'neutral'},{label:'success',type:'ok'}])}
      ${metricsHtml([
        {label:'Snapshots',value:'4'},{label:'Actions',value:'8'},
        {label:'Reasoning Steps',value:'5'},{label:'Success',value:'✓',cls:'success'},
      ])}
      <div class="message">"The agent can use the browser, but it still needs to understand the UI."</div>`;
    runBtn.disabled = false;
  },
};

// ── Stage 4: WebMCP ───────────────────────────────────────────────────────

const stage4: Stage = {
  id: 'webmcp', label: 'WebMCP', number: 4, color: 'var(--cyan)',
  speakerNote: 'The agent no longer needs to understand the UI. The application exposes capabilities directly.',

  render(container) {
    const regStatus  = getWebMcpRegistrationStatus();
    const statusText = regStatus === 'registered' ? `${WEBMCP_TOOLS.length} tools registered`
                     : regStatus === 'failed'     ? 'Tool registration failed'
                     :                              'WebMCP unavailable — using window.smartRoom';
    const toolChips = WEBMCP_TOOLS.map(t => `<span class="webmcp-tool-chip">${t.name}</span>`).join('');
    const toolFns   = WEBMCP_TOOLS.map(t => `<div class="sees-fn">${t.name}()</div>`).join('');

    container.innerHTML = `<div class="stage-panel" style="--stage-color:var(--cyan)">
      <span class="stage-badge">Stage 4 of 5</span>
      <h2 class="stage-title">WebMCP</h2>
      ${promptBox()}
      ${archFlow(['Prompt','LLM','Tool Discovery','Capability Call','Application Logic'], 2)}
      <div class="webmcp-real-integration">
        <div class="webmcp-real-integration-title">Real WebMCP Integration</div>
        <div class="webmcp-real-integration-api">navigator.modelContext.registerTool(…)</div>
        <span id="webmcp-status-badge" class="webmcp-status-badge ${regStatus}">${statusText}</span>
        <div class="webmcp-real-integration-tools">${toolChips}</div>
      </div>
      <button class="run-btn" id="run-btn">▶ Run WebMCP</button>
      <div class="log-stream" id="log-stream" hidden></div>
      <div class="results"   id="results"    hidden></div>
      ${speakerNote('The agent no longer needs to understand the UI. The application exposes capabilities directly.')}
    </div>`;
    wireRunBtn(container, stage4);
  },

  async run(container) {
    const runBtn  = container.querySelector('#run-btn') as HTMLButtonElement;
    const logEl   = container.querySelector('#log-stream') as HTMLElement;
    const results = container.querySelector('#results') as HTMLElement;
    runBtn.disabled = true; logEl.innerHTML = ''; results.hidden = true; logEl.hidden = false;
    resetRoom();
    const toolFns = WEBMCP_TOOLS.map(t => `<div class="sees-fn">${t.name}()</div>`).join('');

    await delay(300);  appendLog(logEl, '◆ Phase 1: Tool Discovery', 'phase-head');
    for (const tool of WEBMCP_TOOLS) {
      await delay(280);  appendLog(logEl, `✓ ${tool.name}()`, 'success');
    }

    await delay(600);  appendLog(logEl, '◆ Phase 2: Agent Reasoning', 'phase-head');
    await delay(400);  appendLog(logEl, '[need] computer ON', 'reasoning');
    await delay(300);  appendLog(logEl, '[need] room light OFF', 'reasoning');
    await delay(300);  appendLog(logEl, '[need] desk lamp ON', 'reasoning');
    await delay(300);  appendLog(logEl, '[need] curtains CLOSED', 'reasoning');
    await delay(400);  appendLog(logEl, '[decision] setRoomMode covers all requirements', 'reasoning');

    await delay(600);  appendLog(logEl, '◆ Phase 3: Tool Call', 'phase-head');
    await delay(400);  appendLog(logEl, '{ "tool": "setRoomMode", "args": { "mode": "night-coding" } }', 'command');

    await delay(700);  appendLog(logEl, '◆ Phase 4: Execution', 'phase-head');
    await delay(400);  appendLog(logEl, 'setRoomMode("night-coding")', 'command');
    setRoomMode('night-coding');   // ← the moment — room changes instantly
    await delay(500);  appendLog(logEl, '✓ Room prepared successfully', 'success');

    await delay(800);
    results.hidden = false;
    results.innerHTML = `
      <div class="verdict success">✅ Room Prepared Successfully</div>
      ${timelineHtml([{label:'discover tools',type:'ok'},{label:'call tool',type:'ok'},{label:'success',type:'ok'}])}
      ${metricsHtml([
        {label:'Tool Calls',value:'1',cls:'success'},{label:'Reasoning Steps',value:'1',cls:'success'},
        {label:'Success',value:'✓',cls:'success'},{label:'Time',value:'<1s',cls:'success'},
      ])}

      <div class="section-sep"></div>

      <div class="arch-label" style="margin-bottom:8px">What Each Approach Sees</div>
      <div class="sees-comparison">
        <div class="sees-card playwright">
          <div class="sees-card-header">Playwright MCP Sees</div>
          <div class="sees-card-body">&lt;canvas /&gt;</div>
        </div>
        <div class="sees-card webmcp">
          <div class="sees-card-header">WebMCP Sees</div>
          <div class="sees-card-body">${toolFns}</div>
        </div>
      </div>

      <div class="section-sep"></div>

      <div class="comparison-section">
        <div class="comparison-label">Real World Examples</div>
        <div class="comparison-grid">
          <div class="comparison-card playwright">
            <div class="comparison-card-title">Playwright MCP</div>
            <ul><li>Login flows</li><li>Forms &amp; CRUD</li><li>Admin panels</li><li>DOM-based UI</li></ul>
          </div>
          <div class="comparison-card webmcp">
            <div class="comparison-card-title">WebMCP</div>
            <ul><li>Three.js / WebGL</li><li>Figma &amp; Canva</li><li>VS Code</li><li>Maps &amp; Canvas</li></ul>
          </div>
        </div>
        <p class="comparison-caption">WebMCP becomes most valuable when the UI is no longer represented by the DOM.</p>
      </div>

      <div class="section-sep"></div>

      <div class="wow-moment">
        <div class="wow-counters">
          <div class="wow-counter manual">  <div class="wow-counter-label">Manual</div>    <div class="wow-counter-value" id="c-manual">0s</div></div>
          <div class="wow-counter pw">      <div class="wow-counter-label">Playwright</div><div class="wow-counter-value">∞</div></div>
          <div class="wow-counter pwmcp">   <div class="wow-counter-label">PW MCP</div>    <div class="wow-counter-value" id="c-pwmcp">0s</div></div>
          <div class="wow-counter webmcp">  <div class="wow-counter-label">WebMCP</div>    <div class="wow-counter-value">&lt;1s</div></div>
        </div>
        <div class="wow-tagline">Same Prompt. Same Application.<br><span>Different Communication Model.</span></div>
      </div>`;

    setTimeout(() => {
      const cm = results.querySelector('#c-manual') as HTMLElement | null;
      const cp = results.querySelector('#c-pwmcp')  as HTMLElement | null;
      if (cm) countUp(cm, 15, 1200, 's');
      if (cp) countUp(cp, 8,  1000, 's');
    }, 400);

    runBtn.disabled = false;
  },
};

export const stages: Stage[] = [stage1, stage2, stage3, stage4];
