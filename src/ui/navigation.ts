import { renderStage, getCurrentIndex } from '../stages/renderStage';
import { resetRoom } from '../room/roomActions';
import { showFinalSlide, hideFinalSlide } from './finalSlide';

export function initNavigation(): void {
  document.getElementById('btn-prev')!.addEventListener('click', () => renderStage(getCurrentIndex() - 1));
  document.getElementById('btn-next')!.addEventListener('click', () => renderStage(getCurrentIndex() + 1));

  document.getElementById('btn-reset')!.addEventListener('click', () => {
    resetRoom();
    renderStage(getCurrentIndex());
  });

  document.getElementById('btn-final')!.addEventListener('click', showFinalSlide);

  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'ArrowLeft')                  renderStage(getCurrentIndex() - 1);
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); renderStage(getCurrentIndex() + 1); }
    if (e.key === 'Escape')                     hideFinalSlide();
  });
}
