// A team keeps its colour whatever its position in match.teams: the generated
// scenarios list Bastion City first, the corner fixture lists Aurora Vale first.
// The server maps each team id to a kit (app/internal/transport/http/team_kit.go)
// and renders it as data-team-kit on the team's .team-name strip, so the first
// paint is already right; this module only reads what the server rendered.
export type TeamKit = "a" | "b";

/**
 * The team's server-rendered kit. /legacy renders none and keeps its positional
 * palette, so there the kit follows position (teams[0] -> a, teams[1] -> b).
 */
export function teamKit(teamId: string, teamIds: readonly string[]): TeamKit {
  const rendered = document.querySelector<HTMLElement>(`.team-name[data-team-id="${CSS.escape(teamId)}"]`)?.dataset.teamKit;
  if (rendered === "a" || rendered === "b") return rendered;
  return teamIds.indexOf(teamId) === 1 ? "b" : "a";
}

/** The team's colour as authored in tokens.css, for example "#b8374d"; empty outside the experience. */
export function teamColour(teamId: string, teamIds: readonly string[]): string {
  return getComputedStyle(document.body).getPropertyValue(`--c-team-${teamKit(teamId, teamIds)}`).trim();
}
