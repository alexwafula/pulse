import type { Replay } from "./pitch";

export type PlaybackRange = { startMs: number; endMs: number };

export function trackingFrameIndex(frames: Replay["tracking"], timeMs: number): number {
  let low = 0, high = frames.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (frames[middle].timeMs <= timeMs) low = middle;
    else high = middle - 1;
  }
  return low;
}

// Event timestamps mark the action's start, not the end of its recorded flight.
// Stop before the next event; use tracking rather than a guessed physical outcome.
export function actionPlaybackRange(replay: Replay, event: Replay["events"][number]): PlaybackRange {
  const next = replay.events.find(candidate => candidate.timeMs > event.timeMs);
  const limit = Math.min(replay.match.endMs, next ? next.timeMs - 1 : replay.match.endMs);
  let movementEnd = event.timeMs;
  const frames = replay.tracking;
  for (let index = trackingFrameIndex(frames, event.timeMs); index + 1 < frames.length; index++) {
    const first = frames[index], second = frames[index + 1];
    if (first.timeMs >= limit) break;
    if (Math.hypot(second.ball.x - first.ball.x, second.ball.y - first.ball.y, second.ball.z - first.ball.z) > .001) {
      movementEnd = Math.min(second.timeMs, limit);
    }
  }
  const endMs = Math.min(limit, movementEnd > event.timeMs ? movementEnd + 300 : event.timeMs + 1000);
  return { startMs: event.timeMs, endMs: Math.max(event.timeMs, endMs) };
}

export function evidencePlaybackRange(replay: Replay, range: PlaybackRange, eventIds: string[]): PlaybackRange {
  const last = [...replay.events].reverse().find(event => eventIds.includes(event.id));
  return {
    startMs: Math.max(replay.match.startMs, range.startMs),
    endMs: Math.min(replay.match.endMs, Math.max(range.endMs, last ? actionPlaybackRange(replay, last).endMs : range.endMs)),
  };
}

export function advancePlayback(clock: number, elapsedMs: number, rate: number, endMs: number): number {
  return Math.min(endMs, clock + Math.max(0, elapsedMs) * rate);
}
