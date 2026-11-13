import { parse } from "parse5";

const JAVASCRIPT_TYPES = new Set(["", "module", "text/javascript", "application/javascript"]);

function inlineScripts(html) {
  const nodes = [parse(html, { sourceCodeLocationInfo: true, scriptingEnabled: true })];
  const scripts = [];
  while (nodes.length) {
    const node = nodes.pop();
    if (node.tagName === "script") {
      const attributes = new Map(node.attrs.map(({ name, value }) => [name, value]));
      const type = (attributes.get("type") || "").trim();
      const source = node.childNodes.map((child) => child.value || "").join("");
      if (!attributes.has("src") && JAVASCRIPT_TYPES.has(type) && source.trim()) {
        scripts.push({ source, module: type === "module", line: node.sourceCodeLocation?.startTag.endLine || 1 });
      }
    }
    // Template content is inert and is kept separately by the HTML parser.
    for (let i = (node.childNodes?.length || 0) - 1; i >= 0; i--) nodes.push(node.childNodes[i]);
  }
  return scripts;
}

export { inlineScripts };
