export function initSpeakerMode(): void {
  document.getElementById('btn-speaker')!.addEventListener('click', () => {
    document.body.toggleAttribute('data-speaker');
  });
}
