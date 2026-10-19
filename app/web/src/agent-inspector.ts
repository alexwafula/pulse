import type { Cue } from "./pitch";
import { t } from "./i18n";

export type Inspection = {
  cueId: string;
  source: string;
  deliveryMs: number;
  remoteOutcome: "accepted" | "rejected" | "unavailable" | "not-configured";
  gatePassed: boolean;
  factPack: { id: string; facts: { id: string; metric: string; value: number; unit: string; eventIds: string[] }[] };
  response: { draft: { text: string }; verification: Cue["verification"] };
  safety: { injectedText: string; rejected: boolean; fallbackPassed: boolean };
  reference?: {kind:string; capturedAt:string; observations:{role:string; responseId:string; model:string; durationMs:number; usage:{prompt_tokens:number;completion_tokens:number}; output: {text?:string;status?:string}}[]};
};

function text<K extends keyof HTMLElementTagNameMap>(tag: K, value: string, className = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = t(value); node.className = className;
  return node;
}

export function renderInspector(cue: Cue | undefined, inspection: Inspection | undefined): void {
  const panel = document.querySelector<HTMLDetailsElement>("#agent-inspector");
  if (!panel) return;
  panel.hidden = !cue || !inspection;
  const content = document.querySelector<HTMLElement>("#agent-inspector-content")!;
  content.replaceChildren();
  if (!cue || !inspection) { panel.open = false; return; }
  content.dataset.cueId = cue.id;
  const recorded = inspection.source === "python-recorded";
  const verified = cue.verification.status === "VERIFIED";
  const captured=inspection.reference?.kind==="captured-agent-run";
  const source = recorded ? "Recorded output" : verified ? "Agent output" : "Deterministic template";
  content.append(text("p", source, "inspection-source"));
  const delivery = text("p", "", "model-label");
  delivery.textContent = t("inspection.delivery", {ms: inspection.deliveryMs});
  content.append(delivery);
  const steps = document.createElement("ol"); steps.className = "inspection-steps";
  const step = (name: string, status: string, detail: string): HTMLLIElement => {
    const row = document.createElement("li"); row.append(text("strong", name), text("span", status, "inspection-status"), text("p", detail)); steps.append(row); return row;
  };
  const fact = step("Fact pack", "Computed", "Go-calculated source facts");
  for (const value of inspection.factPack.facts) {
    const code = text("code", `${value.metric} = ${value.value} ${value.unit}`);
    fact.append(code);
  }
  const packID = text("code", inspection.factPack.id); packID.dataset.noTranslate = ""; fact.append(packID);
  step("Explainer", captured?"Captured output":verified ? "Trace not retained" : "Not run", captured?inspection.reference!.observations[0].output.text ?? "":verified ? "Original Explainer output is unavailable." : "No model execution is claimed.");
  step("Narrator", recorded ? "Stored output" : verified ? "Returned output" : "Template", inspection.response.draft.text);
  step("Verifier", captured?"Captured decision":verified ? recorded ? "Stored decision" : "Returned decision" : "Not run", captured?"Captured role outputs and source references retained.":verified ? "Claim and evidence checks are retained; the original model execution trace is unavailable." : "Not model-verified");
  step("Go publication gate", inspection.gatePassed ? "Passed" : "Rejected", "Numbers, wording, audience and complete evidence checked again.");
  content.append(steps);
  if (inspection.remoteOutcome === "unavailable" || inspection.remoteOutcome === "rejected") {
    content.append(text("p", inspection.remoteOutcome === "rejected" ? "Python output rejected; Go template used." : "Python unavailable; Go template used.", "inspection-warning"));
  }
  if (recorded) content.append(text("p", captured?"No fresh model calls. Captured provider IDs and role outputs retained.":"No fresh model calls. Provider metadata for the original capture is unconfirmed.", "model-label"));
  const evidence = document.createElement("div"); evidence.className = "story-evidence";
  for (const id of cue.eventIds) {
    const button = text("button", id, "evidence-button"); button.type = "button"; button.dataset.factSource = id; button.title = `${t("Evidence")} / ${id}`; evidence.append(button);
    button.addEventListener("click", () => document.dispatchEvent(new CustomEvent("pulse:map-inspect", {detail:{eventId:id}})));
  }
  content.append(evidence);
  if (inspection.reference && ["reproduction-not-original-capture","captured-agent-run"].includes(inspection.reference.kind)) {
    const reference = document.createElement("details"); reference.className = "inspection-reference";
    reference.append(text("summary", captured?"Captured agent run":"Foundry reference run"), text("p", captured?"Original capture for this recorded output.":"New reproduction, not the original recording.", "model-label"));
    // A named model's Verifier output is advice; it must never read as that model having verified the claim.
    reference.append(text("p", "Role outputs are advisory. Go recomputes every fact and decides publication.", "model-label"));
    const when = text("time", inspection.reference.capturedAt); when.dateTime = inspection.reference.capturedAt; when.dataset.noTranslate = ""; reference.append(when);
    for (const observed of inspection.reference.observations) {
      const record = document.createElement("dl");
      const pair = (label: string, value: string): void => { const row = document.createElement("div"); row.append(text("dt", label), text("dd", value)); record.append(row); };
      pair("Role", {explainer:t("Explainer"),narrator:t("Narrator"),verifier:t("Verifier")}[observed.role] ?? observed.role);
      pair("Response ID", observed.responseId); pair("Model", observed.model);
      pair(observed.role === "verifier" ? "Advisory verdict" : "Output", observed.output.text ?? observed.output.status ?? "");
      pair("Tokens", `${observed.usage.prompt_tokens} / ${observed.usage.completion_tokens}`);
      pair("Duration", `${observed.durationMs} ms`);
      reference.append(record);
    }
    content.append(reference);
  }
  const safety = document.createElement("details"); safety.className = "inspection-safety";
  safety.append(text("summary", "Safety test"), text("p", "Injected test input, not a model response.", "model-label"));
  const injected = text("blockquote", inspection.safety.injectedText); injected.dataset.noTranslate = ""; safety.append(injected);
  const run = text("button", "Show test result", "evidence-button"); run.type = "button";
  run.addEventListener("click", () => {
    const result = text("p", inspection.safety.rejected && inspection.safety.fallbackPassed ? "Rejected by Go gate. Safe template passed." : "Safety check failed.", "inspection-safety-result");
    result.setAttribute("role", "status"); run.replaceWith(result);
  });
  safety.append(run); content.append(safety);
}
