"use strict";
(() => {
  // app/web/src/pitch.ts
  var svgNS = "http://www.w3.org/2000/svg";
  var field = { x: 32, y: 20, width: 986, height: 640 };
  function required(selector) {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing element: ${selector}`);
    return element;
  }
  var playerLayer = required("#player-layer");
  var ball = required("#ball");
  var ballShadow = required("#ball-shadow");
  var eventPathLayer = required("#event-path-layer");
  var eventPath = required("#event-path");
  var eventStart = required("#event-start");
  var playButton = required("#play-button");
  var restartButton = required("#restart-button");
  var seek = required("#seek");
  var clockDisplay = required("#match-clock");
  var currentAction = required("#current-action");
  var eventList = required("#event-list");
  var detailTitle = required("#detail-title");
  var detailDescription = required("#detail-description");
  var eventCount = required("#event-count");
  var pitchStamp = required("#pitch-stamp");
  var startLabel = required("#start-label");
  var endLabel = required("#end-label");
  var speedButtons = [...document.querySelectorAll("[data-speed]")];
  var replay;
  var clock = 0;
  var speed = 4;
  var playing = false;
  var previousFrameTime = 0;
  var currentEventId = null;
  var playerElements = /* @__PURE__ */ new Map();
  var eventButtons = /* @__PURE__ */ new Map();
  var framePlayers = /* @__PURE__ */ new Map();
  function pitchPoint(point) {
    return {
      x: field.x + point.x / replay.match.pitch.length_m * field.width,
      y: field.y + point.y / replay.match.pitch.width_m * field.height
    };
  }
  function matchTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1e3);
    return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
  }
  function label(type) {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }
  function playerName(id) {
    return replay.match.players.find((player) => player.id === id)?.name ?? id;
  }
  function teamName(id) {
    return replay.match.teams.find((team) => team.id === id)?.name ?? id;
  }
  function eventSentence(event) {
    const actor = playerName(event.actor_id);
    const recipient = event.recipient_id ? playerName(event.recipient_id) : "";
    switch (event.type) {
      case "pass":
        return `${actor} passes to ${recipient}`;
      case "carry":
        return `${actor} carries the ball`;
      case "cross":
        return `${actor} sends a cross`;
      case "clearance":
        return `${actor} clears the ball`;
      case "corner":
        return `${actor} delivers a corner to ${recipient}`;
      case "shot":
        return `${actor} takes a shot`;
    }
  }
  function createPlayers() {
    const homeID = replay.match.teams[0].id;
    for (const player of replay.match.players) {
      const group = document.createElementNS(svgNS, "g");
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("r", "15");
      circle.setAttribute("class", player.team_id === homeID ? "player-home" : "player-away");
      const number = document.createElementNS(svgNS, "text");
      number.setAttribute("class", "player-number");
      number.textContent = String(player.number);
      const title = document.createElementNS(svgNS, "title");
      title.textContent = `${player.name}, ${teamName(player.team_id)}`;
      group.append(circle, number, title);
      playerLayer.append(group);
      playerElements.set(player.id, group);
    }
  }
  function createTimeline() {
    for (const event of replay.events) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", `Jump to ${matchTime(event.time_ms)}: ${eventSentence(event)}`);
      const time = document.createElement("span");
      time.className = "event-time";
      time.textContent = matchTime(event.time_ms);
      const copy = document.createElement("span");
      copy.className = "event-copy";
      const type = document.createElement("strong");
      type.textContent = label(event.type);
      const description = document.createElement("span");
      description.textContent = eventSentence(event);
      copy.append(type, description);
      button.append(time, copy);
      button.addEventListener("click", () => {
        playing = false;
        clock = event.time_ms;
        render();
      });
      item.append(button);
      eventList.append(item);
      eventButtons.set(event.id, button);
    }
  }
  function interpolate(a, b, fraction) {
    return a + (b - a) * fraction;
  }
  function renderPositions() {
    const frames = replay.tracking;
    let index = 0;
    while (index + 1 < frames.length && frames[index + 1].time_ms <= clock) index++;
    const first = frames[index];
    const second = frames[Math.min(index + 1, frames.length - 1)];
    const duration = second.time_ms - first.time_ms;
    const fraction = duration > 0 ? (clock - first.time_ms) / duration : 0;
    const nextPlayers = framePlayers.get(second.time_ms);
    for (const tracked of first.players) {
      const next = nextPlayers.get(tracked.player_id) ?? tracked;
      const point = pitchPoint({
        x: interpolate(tracked.x, next.x, fraction),
        y: interpolate(tracked.y, next.y, fraction)
      });
      playerElements.get(tracked.player_id)?.setAttribute("transform", `translate(${point.x} ${point.y})`);
    }
    const ballPoint = pitchPoint({
      x: interpolate(first.ball.x, second.ball.x, fraction),
      y: interpolate(first.ball.y, second.ball.y, fraction)
    });
    ball.setAttribute("cx", String(ballPoint.x));
    ball.setAttribute("cy", String(ballPoint.y));
    ballShadow.setAttribute("cx", String(ballPoint.x + 4));
    ballShadow.setAttribute("cy", String(ballPoint.y + 5));
  }
  function renderEvent() {
    const event = [...replay.events].reverse().find((candidate) => candidate.time_ms <= clock);
    const nextID = event?.id ?? "";
    if (nextID !== currentEventId) {
      if (currentEventId) eventButtons.get(currentEventId)?.removeAttribute("aria-current");
      if (event) {
        currentAction.textContent = `${label(event.type)} \xB7 ${eventSentence(event)}`;
        detailTitle.textContent = `${label(event.type)} at ${matchTime(event.time_ms)}`;
        detailDescription.textContent = `${teamName(event.team_id)} \xB7 ${event.outcome}`;
        eventButtons.get(nextID)?.setAttribute("aria-current", "true");
        const from = pitchPoint(event.from);
        const to = pitchPoint(event.to);
        eventPath.setAttribute("x1", String(from.x));
        eventPath.setAttribute("y1", String(from.y));
        eventPath.setAttribute("x2", String(to.x));
        eventPath.setAttribute("y2", String(to.y));
        eventStart.setAttribute("cx", String(from.x));
        eventStart.setAttribute("cy", String(from.y));
      } else {
        currentAction.textContent = `${replay.match.teams[0].name} building the attack`;
        detailTitle.textContent = "Awaiting first action";
        detailDescription.textContent = `The sequence starts at ${matchTime(replay.match.start_ms)}.`;
      }
      currentEventId = nextID;
    }
    eventPathLayer.style.display = event && clock - event.time_ms < 6500 ? "" : "none";
  }
  function render() {
    renderPositions();
    renderEvent();
    clockDisplay.textContent = matchTime(clock);
    seek.value = String(Math.round((clock - replay.match.start_ms) / (replay.match.end_ms - replay.match.start_ms) * 1e3));
    playButton.textContent = playing ? "Pause" : clock >= replay.match.end_ms ? "Replay" : "Play";
    playButton.setAttribute("aria-label", playButton.textContent);
  }
  function animate(time) {
    if (playing) {
      if (previousFrameTime) {
        clock = Math.min(replay.match.end_ms, clock + Math.min(time - previousFrameTime, 100) * speed);
        if (clock >= replay.match.end_ms) playing = false;
        render();
      }
      previousFrameTime = time;
    } else {
      previousFrameTime = 0;
    }
    requestAnimationFrame(animate);
  }
  async function start() {
    const response = await fetch("/api/replay", { cache: "no-store" });
    if (!response.ok) throw new Error(`Replay request failed: ${response.status}`);
    replay = await response.json();
    if (replay.schema_version !== "1.0.0" || replay.tracking.length < 2) {
      throw new Error("Unsupported replay data");
    }
    for (const frame of replay.tracking) {
      framePlayers.set(frame.time_ms, new Map(frame.players.map((player) => [player.player_id, player])));
    }
    clock = replay.match.start_ms;
    eventCount.textContent = `${replay.events.length} actions`;
    startLabel.textContent = matchTime(replay.match.start_ms);
    endLabel.textContent = matchTime(replay.match.end_ms);
    pitchStamp.textContent = `${replay.match.teams[0].name.toUpperCase()} ATTACKING ${replay.match.teams[0].attacking_direction.toUpperCase()}`;
    createPlayers();
    createTimeline();
    playButton.addEventListener("click", () => {
      if (clock >= replay.match.end_ms) clock = replay.match.start_ms;
      playing = !playing;
      render();
    });
    restartButton.addEventListener("click", () => {
      clock = replay.match.start_ms;
      playing = true;
      render();
    });
    seek.addEventListener("input", () => {
      clock = replay.match.start_ms + Number(seek.value) / 1e3 * (replay.match.end_ms - replay.match.start_ms);
      render();
    });
    for (const button of speedButtons) {
      button.addEventListener("click", () => {
        speed = Number(button.dataset.speed);
        for (const option of speedButtons) option.setAttribute("aria-pressed", String(option === button));
      });
    }
    playing = true;
    render();
    requestAnimationFrame(animate);
  }
  start().catch((error) => {
    currentAction.textContent = "Replay unavailable";
    detailTitle.textContent = "Could not load the match";
    detailDescription.textContent = error instanceof Error ? error.message : String(error);
    playButton.disabled = true;
    restartButton.disabled = true;
    seek.disabled = true;
  });
})();
