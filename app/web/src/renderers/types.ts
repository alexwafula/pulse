import type { TeamKit } from "../team-colour";

export type Position = { x: number; y: number; z?: number };
/** `home` is list position (legacy palette); `kit` and `colour` follow the team itself (experience). */
export type RenderPlayer = { id: string; teamId: string; name: string; number: number; home: boolean; kit: TeamKit; colour: string };
/** Test hook: the "teamId:#colour" pairs a renderer painted its kits with. */
export const kitColours = (players: RenderPlayer[]): string =>
  [...new Map(players.map((player) => [player.teamId, player.colour]))].map(([id, colour]) => `${id}:${colour}`).join(" ");
export type ControlField = { cols: number; rows: number; values: number[]; homeTeamGrid: boolean };
export type CameraMode = "broadcast" | "tactical" | "follow";
export type SceneState = {
  players: Map<string, Position>;
  ball: Position;
  path?: { from: Position; to: Position };
  control?: ControlField;
  selectedPlayer?: string;
  timeMs?: number;
  velocities?: Map<string, { x: number; y: number }>;
};
export interface PitchRenderer {
  update(state: SceneState): void;
  /** Returns true while the camera is still easing and needs another frame. */
  draw(): boolean | void;
  resetCamera(): void;
  setCamera?(mode: CameraMode): void;
  destroy(): void;
}
