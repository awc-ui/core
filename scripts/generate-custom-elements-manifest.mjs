#!/usr/bin/env node
/**
 * Generate the standard Custom Elements Manifest shipped by @awc-ui/core.
 *
 * scripts/generate-docs.mjs already extracts the public API from the Stencil
 * source into one JSON file per component. Reusing that data keeps the npm
 * discovery manifest aligned with the docs without adding another AST parser
 * or a dependency to the release toolchain.
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const root = join(scriptDir, "..");
const dataDir = join(root, "apps/docs/src/data/components");
const componentsDir = join(root, "packages/core/src/components");
const output = join(root, "packages/core/custom-elements.json");

function className(tag) {
  return tag
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function plainText(markdown) {
  return markdown
    .replace(/<!--[^]*?-->/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function componentSummary(markdown, title) {
  const body = markdown
    .replace(/^#[^\n]*\n/, "")
    .replace(/<!--[^]*?-->/g, "")
    .trim();
  const paragraph = body
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .find((part) => part && part !== "---" && !part.startsWith(">"));
  return plainText(paragraph ?? `${title} component for AWC UI.`);
}

function splitTopLevel(value, delimiter) {
  const parts = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === quote && value[index - 1] !== "\\") quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if ("({[<".includes(char)) depth += 1;
    if (")}]>".includes(char)) depth = Math.max(0, depth - 1);
    if (char === delimiter && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function parameters(raw) {
  return splitTopLevel(raw ?? "", ",").map((parameter) => {
    const colon = parameter.indexOf(":");
    if (colon === -1) return { name: parameter };
    const rawName = parameter.slice(0, colon).trim();
    let typeAndDefault = parameter.slice(colon + 1).trim();
    const defaultParts = splitTopLevel(typeAndDefault, "=");
    const defaultValue =
      defaultParts.length > 1 ? defaultParts.pop() : undefined;
    typeAndDefault = defaultParts.join(" = ").trim();
    return {
      name: rawName.replace(/\?$/, ""),
      ...(rawName.endsWith("?") || defaultValue ? { optional: true } : {}),
      ...(typeAndDefault ? { type: { text: typeAndDefault } } : {}),
      ...(defaultValue ? { default: defaultValue } : {}),
    };
  });
}

function declaration(component, description) {
  const name = className(component.tag);
  return {
    kind: "class",
    name,
    description,
    summary: description,
    customElement: true,
    tagName: component.tag,
    superclass: { name: "HTMLElement" },
    members: [
      ...component.props.map((prop) => ({
        kind: "field",
        name: prop.name,
        privacy: "public",
        type: { text: prop.type },
        ...(prop.default !== undefined && prop.default !== ""
          ? { default: prop.default }
          : {}),
      })),
      ...component.methods.map((method) => ({
        kind: "method",
        name: method.name,
        privacy: "public",
        parameters: parameters(method.params),
      })),
    ],
    attributes: component.props
      .filter((prop) => prop.attribute)
      .map((prop) => ({
        name: prop.attribute,
        fieldName: prop.name,
        type: { text: prop.type },
        ...(prop.default !== undefined && prop.default !== ""
          ? { default: prop.default }
          : {}),
      })),
    events: component.events.map((event) => ({
      name: event.name,
      type: { text: `CustomEvent<${event.detail || "unknown"}>` },
    })),
    slots: component.slots.map((slot) => ({
      name: slot.name === "(default)" ? "" : slot.name,
      ...(slot.description ? { description: slot.description } : {}),
    })),
    cssParts: component.cssParts.map((part) => ({
      name: part.name,
      ...(part.description ? { description: part.description } : {}),
    })),
    cssProperties: component.cssCustomProps.map((property) => ({
      name: property.name,
      ...(property.description ? { description: property.description } : {}),
    })),
  };
}

const files = (await readdir(dataDir))
  .filter((file) => file.endsWith(".json"))
  .sort();
const modules = [];

for (const file of files) {
  const component = JSON.parse(await readFile(join(dataDir, file), "utf8"));
  const sourceReadme = await readFile(
    join(componentsDir, component.tag, "readme.md"),
    "utf8",
  );
  const name = className(component.tag);
  const modulePath = `dist/components/${component.tag}.js`;
  modules.push({
    kind: "javascript-module",
    path: modulePath,
    declarations: [
      declaration(component, componentSummary(sourceReadme, component.title)),
    ],
    exports: [
      {
        kind: "js",
        name,
        declaration: { name, module: modulePath },
      },
      {
        kind: "custom-element-definition",
        name: component.tag,
        declaration: { name, module: modulePath },
      },
    ],
  });
}

await writeFile(
  output,
  `${JSON.stringify({ schemaVersion: "1.0.0", modules }, null, 2)}\n`,
  "utf8",
);

console.log(`✓ custom-elements.json: ${modules.length} elements -> ${output}`);
