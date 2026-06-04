// Final slide full-screen overlay.
export function initFinalSlide(): void {
  const el = document.createElement('div');
  el.id = 'final-slide';
  el.setAttribute('hidden', '');
  el.innerHTML = `
    <button class="final-close-btn" id="final-close">✕ Back</button>
    <p class="final-slide-subtitle">The Evolution of Agent Communication</p>
    <h1 class="final-slide-title">The Prompt Never Changed</h1>
    <div class="final-slide-prompt">"Prepare the room for night coding"</div>
    <div class="final-columns">
      <div class="final-col col-manual">
        <div class="final-col-icon">❌</div>
        <div class="final-col-title">Manual Automation</div>
        <ul><li>❌ Pixels</li><li>❌ Coordinates</li><li>❌ Fragile</li></ul>
      </div>
      <div class="final-col col-pw">
        <div class="final-col-icon">❌</div>
        <div class="final-col-title">Traditional Playwright</div>
        <ul><li>❌ Selectors</li><li>❌ Nothing in DOM</li><li>❌ Timeout</li></ul>
      </div>
      <div class="final-col col-pwmcp">
        <div class="final-col-icon">⚠️</div>
        <div class="final-col-title">Playwright MCP</div>
        <ul><li>⚠ Understand UI</li><li>⚠ Snapshots</li><li>⚠ Multiple Steps</li></ul>
      </div>
      <div class="final-col col-webmcp">
        <div class="final-col-icon">✅</div>
        <div class="final-col-title">WebMCP</div>
        <ul><li>✅ Capabilities</li><li>✅ Tool Discovery</li><li>✅ Direct Actions</li></ul>
      </div>
    </div>
    <p class="final-footer">
      Stop teaching agents <strong>where to click</strong>.<br>
      Start teaching applications <strong>how to communicate</strong>.
    </p>`;
  document.body.appendChild(el);
  el.querySelector('#final-close')!.addEventListener('click', hideFinalSlide);
}

export function showFinalSlide(): void {
  document.getElementById('final-slide')!.removeAttribute('hidden');
}

export function hideFinalSlide(): void {
  document.getElementById('final-slide')!.setAttribute('hidden', '');
}
