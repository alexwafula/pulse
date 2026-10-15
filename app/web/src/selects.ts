import $ from "jquery";
import install from "select2/dist/js/select2.js";
import type { Options } from "select2";
import { t } from "./i18n";

install(window, $);
let opened: HTMLSelectElement | undefined;

export function closeDropdowns(): void {
  if (opened?.isConnected && $(opened).data("select2")) $(opened).select2("close");
  opened = undefined;
}

export function syncSelects(): void {
  for (const select of document.querySelectorAll<HTMLSelectElement>("select.select2-hidden-accessible")) {
    $(select).trigger("change.select2");
  }
}

export function enhanceSelects(root: ParentNode = document): void {
  for (const select of root.querySelectorAll<HTMLSelectElement>("select:not([hidden])")) {
    if ($(select).data("select2")) continue;
    const options: Options = {
      width: "100%", dropdownParent: $(document.body),
      minimumResultsForSearch: 0,
      templateSelection: data => Array.from(select.options).find(option => option.value === String(data.id))?.text ?? data.text,
      templateResult: data => "id" in data ? Array.from(select.options).find(option => option.value === String(data.id))?.text ?? data.text : data.text,
      matcher: (params, data) => {
        const id = "id" in data ? String(data.id) : undefined;
        const text = Array.from(select.options).find(option => option.value === id)?.text ?? data.text;
        return !params.term?.trim() || text.toLocaleLowerCase().includes(params.term.trim().toLocaleLowerCase()) ? {...data, text} : null;
      },
      language: { noResults: () => t("No results found"), searching: () => t("Search") },
    };
    $(select).select2(options);
    const selection = select.nextElementSibling?.querySelector<HTMLElement>("[role=combobox]");
    const label = select.labels?.[0]?.cloneNode(true) as HTMLElement | undefined;
    label?.querySelectorAll("select,.select2-container").forEach(element => element.remove());
    selection?.setAttribute("aria-label", select.getAttribute("aria-label") ?? label?.textContent?.trim() ?? select.id);
    if (select.hasAttribute("aria-describedby")) selection?.setAttribute("aria-describedby", select.getAttribute("aria-describedby")!);
    $(select).on("select2:opening", () => {
      if (opened && opened !== select) $(opened).select2("close");
      opened = select;
    });
    $(select).on("select2:open", () => {
      document.dispatchEvent(new CustomEvent("pulse:dropdown", { detail: { open: true } }));
      document.querySelector<HTMLInputElement>(".select2-container--open .select2-search__field")?.focus();
    });
    $(select).on("select2:close", () => {
      if (opened === select) opened = undefined;
      document.dispatchEvent(new CustomEvent("pulse:dropdown", { detail: { open: false } }));
    });
    $(select).on("select2:select", () => select.dispatchEvent(new Event("change", { bubbles: true })));
  }
}

export function initializeSelects(): void {
  enhanceSelects();
  document.addEventListener("htmx:beforeCleanupElement", event => {
    const root = event.target;
    if (!(root instanceof Element)) return;
    const selects = root instanceof HTMLSelectElement ? [root] : root.querySelectorAll<HTMLSelectElement>("select.select2-hidden-accessible");
    for (const select of selects) if ($(select).data("select2")) {
      if (opened === select) closeDropdowns();
      $(select).off("select2:opening select2:open select2:close select2:select").select2("destroy");
    }
  });
  // HTMX restores class/style attributes during settle; enhancing earlier
  // leaves a live widget with a visible native select once those classes reset.
  document.addEventListener("htmx:afterSettle", event => {
    if (event.target instanceof Element) enhanceSelects(event.target);
  });
  document.addEventListener("pulse:selection", event => {
    if (event.target instanceof HTMLSelectElement && $(event.target).data("select2")) $(event.target).trigger("change.select2");
  });
  let viewportWidth = innerWidth;
  window.addEventListener("resize", () => {
    if (viewportWidth !== innerWidth) { viewportWidth = innerWidth; closeDropdowns(); }
  });
  const dismiss = (event: Event): void => {
    if (event.target instanceof Element && event.target.closest(".select2-results")) return;
    closeDropdowns();
  };
  document.addEventListener("wheel", dismiss, {passive:true});
  document.addEventListener("touchmove", dismiss, {passive:true});
}
