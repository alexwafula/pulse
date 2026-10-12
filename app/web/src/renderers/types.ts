export type Position = { x: number; y: number; z?: number };
export type RenderPlayer = { id: string; name: string; number: number; home: boolean };
export type ControlField = { cols: number; rows: number; values: number[]; homeTeamGrid: boolean };
export type CameraMode = "broadcast" | "tactical" | "follow";
export type SceneState = {
  players: Map<string, Position>;
  ball: Position;
  path?: { from: Position; to: Position };
  control?: ControlField;
  selectedPlayer?: string;
};
export interface PitchRenderer {
  update(state: SceneState): void;
  draw(): void;
  resetCamera(): void;
  setCamera?(mode: CameraMode): void;
  destroy(): void;
}
