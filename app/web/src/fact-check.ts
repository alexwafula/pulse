import type { Cue } from "./pitch";
import { t } from "./i18n";

export function renderFactCheck(cue: Cue | undefined, source: string, matchTime: (time: number) => string): void {
  const panel = document.querySelector<HTMLDetailsElement>("#fact-check")!;
  panel.hidden = !cue;
  if (!cue) { panel.open = false; return; }
  const write = (id: string, value: string): void => { document.getElementById(id)!.textContent = value; };
  const verified = cue.verification.status === "VERIFIED";
  write("fact-check-publication", t(verified ? source === "python-recorded" ? "Verified (recorded)" : "Verified" : "Template"));
  write("fact-check-counts", verified ? `${cue.verification.claimsPassed} / ${cue.verification.claimsChecked}` : t("Not model-verified"));
  write("fact-check-window", `${matchTime(cue.replayStartMs)} - ${matchTime(cue.replayEndMs)}`);
  write("fact-check-facts", cue.factIds.join(", "));
  write("fact-check-policy", t(verified ? "Go publication checks passed" : "Deterministic template; Go publication checks passed"));
  const list = document.getElementById("fact-check-claims")!;
  list.replaceChildren();
  for (const claim of cue.verification.claims) {
    const row = document.createElement("li"), title = document.createElement("strong"), reason = document.createElement("span");
    title.textContent = `${claim.claimId} / ${t(claim.supported ? "Supported" : "Rejected")}`;
    reason.textContent = claim.reason;
    row.append(title, reason); list.append(row);
  }
  const row = document.createElement("li");
  for (const id of cue.eventIds) {
    const button = document.createElement("button");
    button.type = "button"; button.className = "evidence-button"; button.dataset.factSource = id;
    button.textContent = id; button.title = `${t("Evidence")} / ${id}`;
    row.append(button);
  }
  list.append(row);
}
