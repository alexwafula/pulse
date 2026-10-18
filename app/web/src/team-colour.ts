// A team keeps its colour whatever its position in match.teams: the generated
// scenarios list Bastion City first, the corner fixture lists Aurora Vale first.
export type TeamKit = "a" | "b";

const kits: Record<string, TeamKit> = { aurora: "a", bastion: "b" };

/** The team's kit; an unknown id falls back to its position (teams[0] -> a, teams[1] -> b). */
export function teamKit(teamId: string, teamIds: readonly string[]): TeamKit {
  return kits[teamId] ?? (teamIds.indexOf(teamId) === 1 ? "b" : "a");
}

/** The CSS custom property holding the team's colour (tokens.css, `.experience`). */
export function teamColourToken(teamId: string, teamIds: readonly string[]): string {
  return `--c-team-${teamKit(teamId, teamIds)}`;
}

/** The team's colour as authored in tokens.css, for example "#b8374d"; empty outside the experience. */
export function teamColour(teamId: string, teamIds: readonly string[]): string {
  return getComputedStyle(document.body).getPropertyValue(teamColourToken(teamId, teamIds)).trim();
}
