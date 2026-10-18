import type { Replay } from "./pitch";
import type { Moment } from "./analytics";

export type PressureNarration = {
  key: "pressure.casual" | "pressure.analyst";
  team: string;
  count: number;
  control: number;
  eventIds: string[];
  tickTimesMs: number[];
  startMs: number;
  endMs: number;
};

// This is a presentation template over the Go detector, not a v2 agent cue.
export function pressureNarration(moment: Moment, replay: Replay, persona: string): PressureNarration | undefined {
  const team = replay.match.teams.find(team => team.id === moment.teamId);
  const count = moment.values.actions, control = moment.values.finalThird;
  const startMs = Math.max(replay.match.startMs, moment.windowStartMs);
  if (moment.type !== "SUSTAINED_PRESSURE" || moment.evidenceKind !== "event" || !team
      || !Number.isInteger(count) || count < 1 || count !== moment.reasons.length
      || new Set(moment.reasons).size !== count || !Number.isFinite(control) || control < 0 || control > 1
      || !Number.isSafeInteger(moment.windowStartMs) || moment.windowStartMs < 0 || moment.windowEndMs !== moment.timeMs
      || moment.windowStartMs > moment.windowEndMs || moment.timeMs > replay.match.endMs
      || moment.timeMs < replay.match.startMs
      || !moment.tickTimesMs.length || !moment.tickTimesMs.every(time => Number.isSafeInteger(time) && time >= startMs && time <= moment.timeMs)) return;
  for (const id of moment.reasons) {
    const event = replay.events.find(event => event.id === id);
    if (!event || event.teamId !== moment.teamId || event.outcome !== "COMPLETE"
        || !["PASS", "CARRY", "CROSS", "CORNER"].includes(event.type)
        || event.timeMs < startMs || event.timeMs > moment.windowEndMs) return;
  }
  return { key: persona === "ANALYST" ? "pressure.analyst" : "pressure.casual", team: team.name, count, control,
    eventIds: [...moment.reasons], tickTimesMs: [...moment.tickTimesMs], startMs, endMs: moment.windowEndMs };
}
