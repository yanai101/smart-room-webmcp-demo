// Manages current stage index and renders stages into the panel.
import { stages } from './stageData';
import { resetRoom } from '../room/roomActions';
import { showFinalSlide } from '../ui/finalSlide';

const panel = () => document.getElementById('panel') as HTMLElement;
const progressTrack = () => document.getElementById('progress-track') as HTMLElement;

let currentIndex = 0;

export function getCurrentIndex(): number { return currentIndex; }
export function getStageCount(): number   { return stages.length; }

export function renderStage(index: number): void {
  currentIndex = Math.max(0, Math.min(index, stages.length - 1));
  const stage = stages[currentIndex];
  resetRoom();

  const docVT = document as Document & { startViewTransition?(cb:()=>void):void };
  if (docVT.startViewTransition) {
    docVT.startViewTransition(() => stage.render(panel()));
  } else {
    stage.render(panel());
  }

  updateProgress();
}

function updateProgress(): void {
  const labels = ['Manual', 'Playwright', 'Playwright MCP', 'WebMCP', 'Agent-Ready'];
  progressTrack().innerHTML = labels.map((label, i) => {
    const isFinal   = i === labels.length - 1;
    const isDone    = i < currentIndex;
    const isActive  = i === currentIndex && !isFinal;
    return `
      ${i > 0 ? '<span class="progress-arrow">→</span>' : ''}
      <span class="progress-step ${isActive?'active':''} ${isDone?'done':''}"
            data-idx="${i}" ${isFinal?'data-final':''}>${label}</span>`;
  }).join('');

  progressTrack().querySelectorAll('.progress-step').forEach(el => {
    el.addEventListener('click', () => {
      if ((el as HTMLElement).dataset.final !== undefined) {
        showFinalSlide();
      } else {
        renderStage(parseInt((el as HTMLElement).dataset.idx ?? '0'));
      }
    });
  });
}
