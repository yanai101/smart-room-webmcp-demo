// Shared utilities for scripted stage run sequences.
export const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export type LogType = 'command' | 'info' | 'success' | 'error' | 'warning' | 'reasoning' | 'phase-head';

const LOG_ICONS: Record<LogType, string> = {
  command: '▸', info: '·', success: '✓', error: '✗',
  warning: '⚠', reasoning: '◈', 'phase-head': '◆',
};

export function appendLog(stream: HTMLElement, text: string, type: LogType = 'info'): void {
  const div = document.createElement('div');
  div.className = `log-line ${type}`;
  div.innerHTML = `<span class="log-icon">${LOG_ICONS[type]}</span><span>${text}</span>`;
  stream.appendChild(div);
  stream.scrollTop = stream.scrollHeight;
}

export function countUp(el: HTMLElement, target: number, duration: number, suffix = ''): void {
  const ease = (t: number) => 1-(1-t)**3;
  const start = performance.now();
  function step(now: number) {
    const p = Math.min((now-start)/duration, 1);
    el.textContent = Math.round(target * ease(p)) + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
