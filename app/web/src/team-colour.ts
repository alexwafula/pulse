// A team keeps its colour whatever its position in match.teams: the generated
// scenarios list Bastion City first, the corner fixture lists Aurora Vale first.
export type TeamKit = "a" | "b";

// Aurora Vale's id is "vale" in every fixture.
const kits: Record<string, TeamKit> = { vale: "a", bastion: "b" };

/**
 * The team's kit. An unknown id takes the kit its opponent does not wear, or
 * its position when neither id is known (teams[0] -> a, teams[1] -> b).
 */
export function teamKit(teamId: string, teamIds: readonly string[]): TeamKit {
  const known = kits[teamId];
  if (known) return known;
  const opponent = kits[teamIds.find((id) => id !== teamId) ?? ""];
  if (opponent) return opponent === "a" ? "b" : "a";
  return teamIds.indexOf(teamId) === 1 ? "b" : "a";
}

/** The CSS custom property holding the team's colour (tokens.css, `.experience`). */
export function teamColourToken(teamId: string, teamIds: readonly string[]): string {
  return `--c-team-${teamKit(teamId, teamIds)}`;
}

/** The team's colour as authored in tokens.css, for example "#b8374d"; empty outside the experience. */
export function teamColour(teamId: string, teamIds: readonly string[]): string {
  return getComputedStyle(document.body).getPropertyValue(teamColourToken(teamId, teamIds)).trim();
}
