import messages from "../static/locales.json";

export type Locale = "en-GB" | "sw-KE" | "hi-IN";
const catalog: Record<Locale, Record<string, string>> = messages;
const originals = new WeakMap<Text, { source: string; rendered: string }>();
const attributes = new WeakMap<Element, Map<string, { source: string; rendered: string }>>();

export function supportedLocale(value: string | null | undefined): value is Locale {
  return value === "en-GB" || value === "sw-KE" || value === "hi-IN";
}

export function locale(): Locale {
  const value = document.body.dataset.locale;
  return supportedLocale(value) ? value : "en-GB";
}

export function t(key: string, values: Record<string, string | number> = {}): string {
  const text = catalog[locale()][key] ?? catalog["en-GB"][key] ?? key;
  return text.replace(/\{([a-zA-Z]+)\}/g, (placeholder, name: string) => String(values[name] ?? placeholder));
}

export function localize(root: Node = document.body): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.parentElement?.closest("script,style,svg,code,[data-no-translate]")) continue;
    const previous = originals.get(node);
    const source = previous && node.data === previous.rendered ? previous.source : node.data;
    const key = source.trim();
    const rendered = key ? source.replace(key, t(key)) : source;
    originals.set(node, { source, rendered });
    if (node.data !== rendered) node.data = rendered;
  }
  const elements = root instanceof Element ? [root, ...root.querySelectorAll("[aria-label],[title],[placeholder]")] : [];
  for (const element of elements) {
    if (element.closest("[data-no-translate]")) continue;
    const stored = attributes.get(element) ?? new Map();
    for (const name of ["aria-label", "title", "placeholder"]) {
      const value = element.getAttribute(name);
      if (value === null) continue;
      const previous = stored.get(name);
      const source = previous && value === previous.rendered ? previous.source : value;
      const rendered = t(source);
      stored.set(name, { source, rendered });
      if (value !== rendered) element.setAttribute(name, rendered);
    }
    attributes.set(element, stored);
  }
}

export function observeLocalization(): void {
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "characterData") localize(record.target.parentNode ?? document.body);
      else for (const node of record.addedNodes) {
        if (node instanceof Element) localize(node);
        else if (node instanceof Text && node.parentNode) localize(node.parentNode);
      }
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  localize();
}
