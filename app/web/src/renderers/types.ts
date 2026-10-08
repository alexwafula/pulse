export type Position = { x: number; y: number; z?: number };
export type RenderPlayer = { id: string; name: string; number: number; home: boolean };
export type SceneState = {
  players: Map<string, Position>;
  ball: Position;
  path?: { from: Position; to: Position };
  selectedPlayer?: string;
};
export interface PitchRenderer {
  update(state: SceneState): void;
  draw(): void;
  resetCamera(): void;
  destroy(): void;
}
