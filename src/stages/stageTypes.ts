export type StageId = 'manual' | 'playwright' | 'playwright-mcp' | 'webmcp';

export type Stage = {
  id: StageId;
  label: string;
  number: number;
  color: string;
  speakerNote: string;
  render(container: HTMLElement): void;
  run(container: HTMLElement): Promise<void>;
};
