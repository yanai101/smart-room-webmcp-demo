// Stable selector constants for Playwright tests.
// Tests should use these instead of raw strings to stay resilient to HTML refactors.
export const TEST_IDS = {
  canvas:           'room',
  panel:            'panel',
  runStageButton:   'run-btn',
  resetRoomButton:  'btn-reset',
  speakerModeButton:'btn-speaker',
  webMcpStatus:     'webmcp-status-badge',
  finalSlide:       'final-slide',
} as const;
