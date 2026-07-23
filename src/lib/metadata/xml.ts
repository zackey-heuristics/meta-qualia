import type { MetadataField } from "./types";

/** Reads every leaf element (no child elements) of an XML doc into label/value pairs, using the local (non-namespaced) tag name. */
export function xmlLeavesToFields(xmlText: string): MetadataField[] {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) return [];

  const fields: MetadataField[] = [];
  const walk = (el: Element) => {
    const childElements = [...el.children];
    if (childElements.length === 0) {
      const text = el.textContent?.trim();
      if (text) fields.push({ label: el.localName, value: text });
      return;
    }
    childElements.forEach(walk);
  };
  if (doc.documentElement) walk(doc.documentElement);
  return fields;
}
