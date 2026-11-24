/**
 * SSR runtime vendored from @stencil/react-output-target 1.6.2 (MIT).
 * Copyright (c) 2019-present Drifty Co. See THIRD_PARTY_LICENSES.md.
 *
 * Kept local so the serializer fix also ships to published-package consumers.
 * The upstream child resolver and client wrapper are preserved. Local changes:
 * escape attributes, apply declared Core props before server rendering, and
 * preserve the initial values supported by Core's browser attribute readers.
 * Regeneration must not overwrite this file.
 */
import l, { Fragment as N } from "react";
import { createComponent as C } from "@stencil/react-output-target/runtime";

const escapeAttribute = (value: unknown) => String(value).replace(/[&"'<>]/g, char => ({
  '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;',
}[char]));
// These Core components accept an array or its JSON attribute form.
const jsonArrayAttributes: Record<string, string | undefined> = {
  "md-autocomplete": "options",
  "md-multi-select": "options",
  "md-organization-chart": "nodes",
  "md-select": "options",
  "md-transfer-list": "items",
};

function getSsrArrayAttribute(tag: string, attribute: string, value: unknown[]) {
  if (jsonArrayAttributes[tag] === attribute) return attribute;
  if (attribute === "value" && (tag === "md-autocomplete" || tag === "md-multi-select") &&
      value.every(item => typeof item === "string")) {
    return "data-awc-initial-values";
  }
}

var U = {
  animationIterationCount: 1,
  aspectRatio: 1,
  borderImageOutset: 1,
  borderImageSlice: 1,
  borderImageWidth: 1,
  boxFlex: 1,
  boxFlexGroup: 1,
  boxOrdinalGroup: 1,
  columnCount: 1,
  columns: 1,
  flex: 1,
  flexGrow: 1,
  flexPositive: 1,
  flexShrink: 1,
  flexNegative: 1,
  flexOrder: 1,
  gridRow: 1,
  gridRowEnd: 1,
  gridRowSpan: 1,
  gridRowStart: 1,
  gridColumn: 1,
  gridColumnEnd: 1,
  gridColumnSpan: 1,
  gridColumnStart: 1,
  msGridRow: 1,
  msGridRowSpan: 1,
  msGridColumn: 1,
  msGridColumnSpan: 1,
  fontWeight: 1,
  lineHeight: 1,
  opacity: 1,
  order: 1,
  orphans: 1,
  scale: 1,
  tabSize: 1,
  widows: 1,
  zIndex: 1,
  zoom: 1,
  WebkitLineClamp: 1,
  // SVG-related properties
  fillOpacity: 1,
  floodOpacity: 1,
  stopOpacity: 1,
  strokeDasharray: 1,
  strokeDashoffset: 1,
  strokeMiterlimit: 1,
  strokeOpacity: 1,
  strokeWidth: 1
}, v = "px", F = (e) => typeof e == "number" || typeof e == "string";
function W(e) {
  return e.startsWith("--") ? e : e.replace(/[A-Z]/g, (t) => `-${t.toLowerCase()}`);
}
function D(e, t, n = v) {
  if (typeof t != "string" && typeof t != "number")
    throw new Error(
      "Invalid input: value of 'cssProperties' must be string or number."
    );
  const r = e.startsWith("--") || U[e] === 1;
  if (typeof t == "string" || t === 0 || r)
    return `${t}`;
  const i = (typeof n == "string" ? n : n[e]) || v;
  return `${t}${i}`;
}
function q(e, t) {
  if (typeof e != "object" || e === null)
    throw new TypeError(
      `[stringifyStyleDeclaration]: Expected 'styleDeclaration' to be a non-null object, but received ${e} (type:${typeof e}).`
    );
  const n = t != null && t.important ? "!important" : "";
  return Object.entries(e).filter(([r, i]) => F(i)).map(
    ([r, i]) => `${W(r)}:${D(
      r,
      i,
      t == null ? void 0 : t.unit
    )}${n};`
  ).join("");
}
function G(e, t = !1) {
  if (typeof e != "object" || e === null)
    throw new TypeError(
      `[stringifyCSSProperties]: Expected 'cssProperties' to be a non-null object, but received ${e} (type:${typeof e}).`
    );
  return q(e, typeof t == "boolean" ? {
    important: t
  } : t);
}
const E = {
  acceptCharset: "accept-charset",
  accessKey: "accesskey",
  allowFullScreen: "allowfullscreen",
  autoCapitalize: "autocapitalize",
  autoComplete: "autocomplete",
  autoCorrect: "autocorrect",
  autoFocus: "autofocus",
  autoPlay: "autoplay",
  autoSave: "autosave",
  cellPadding: "cellpadding",
  cellSpacing: "cellspacing",
  charSet: "charset",
  className: "class",
  classID: "classid",
  colSpan: "colspan",
  contentEditable: "contenteditable",
  contextMenu: "contextmenu",
  controlsList: "controlslist",
  crossOrigin: "crossorigin",
  dangerouslySetInnerHTML: "dangerouslysetinnerhtml",
  dateTime: "datetime",
  defaultChecked: "defaultchecked",
  defaultValue: "defaultvalue",
  disablePictureInPicture: "disablepictureinpicture",
  disableRemotePlayback: "disableremoteplayback",
  encType: "enctype",
  enterKeyHint: "enterkeyhint",
  fetchPriority: "fetchpriority",
  htmlFor: "for",
  formMethod: "formmethod",
  formAction: "formaction",
  formEncType: "formenctype",
  formNoValidate: "formnovalidate",
  formTarget: "formtarget",
  frameBorder: "frameborder",
  hrefLang: "hreflang",
  httpEquiv: "http-equiv",
  imageSizes: "imagesizes",
  imageSrcSet: "imagesrcset",
  inputMode: "inputmode",
  itemID: "itemid",
  itemProp: "itemprop",
  itemRef: "itemref",
  itemScope: "itemscope",
  itemType: "itemtype",
  keyParams: "keyparams",
  keyType: "keytype",
  marginWidth: "marginwidth",
  marginHeight: "marginheight",
  maxLength: "maxlength",
  mediaGroup: "mediagroup",
  noModule: "nomodule",
  noValidate: "novalidate",
  playsInline: "playsinline",
  radioGroup: "radiogroup",
  readOnly: "readonly",
  referrerPolicy: "referrerpolicy",
  rowSpan: "rowspan",
  spellCheck: "spellcheck",
  srcDoc: "srcdoc",
  srcLang: "srclang",
  srcSet: "srcset",
  tabIndex: "tabindex",
  useMap: "usemap",
  accentHeight: "accent-height",
  alignmentBaseline: "alignment-baseline",
  arabicForm: "arabic-form",
  attributeName: "attributename",
  attributeType: "attributetype",
  autoReverse: "autoreverse",
  baseFrequency: "basefrequency",
  baselineShift: "baseline-shift",
  baseProfile: "baseprofile",
  calcMode: "calcmode",
  capHeight: "cap-height",
  clipPath: "clip-path",
  clipPathUnits: "clippathunits",
  clipRule: "clip-rule",
  colorInterpolation: "color-interpolation",
  colorInterpolationFilters: "color-interpolation-filters",
  colorProfile: "color-profile",
  colorRendering: "color-rendering",
  contentScriptType: "contentscripttype",
  contentStyleType: "contentstyletype",
  diffuseConstant: "diffuseconstant",
  dominantBaseline: "dominant-baseline",
  enableBackground: "enable-background",
  externalResourcesRequired: "externalresourcesrequired",
  fillOpacity: "fill-opacity",
  fillRule: "fill-rule",
  filterRes: "filterres",
  filterUnits: "filterunits",
  floodOpacity: "flood-opacity",
  floodColor: "flood-color",
  fontFamily: "font-family",
  fontSize: "font-size",
  fontSizeAdjust: "font-size-adjust",
  fontStretch: "font-stretch",
  fontStyle: "font-style",
  fontVariant: "font-variant",
  fontWeight: "font-weight",
  glyphName: "glyph-name",
  glyphOrientationHorizontal: "glyph-orientation-horizontal",
  glyphOrientationVertical: "glyph-orientation-vertical",
  gradientTransform: "gradienttransform",
  gradientUnits: "gradientunits",
  horizAdvX: "horiz-adv-x",
  horizOriginX: "horiz-origin-x",
  imageRendering: "image-rendering",
  kernelMatrix: "kernelmatrix",
  kernelUnitLength: "kernelunitlength",
  keyPoints: "keypoints",
  keySplines: "keysplines",
  keyTimes: "keytimes",
  lengthAdjust: "lengthadjust",
  letterSpacing: "letter-spacing",
  lightingColor: "lighting-color",
  limitingConeAngle: "limitingconeangle",
  markerEnd: "marker-end",
  markerHeight: "markerheight",
  markerMid: "marker-mid",
  markerStart: "marker-start",
  markerUnits: "markerunits",
  markerWidth: "markerwidth",
  maskContentUnits: "maskcontentunits",
  maskUnits: "maskunits",
  numOctaves: "numoctaves",
  overlinePosition: "overline-position",
  overlineThickness: "overline-thickness",
  paintOrder: "paint-order",
  panose1: "panose-1",
  pathLength: "pathlength",
  patternContentUnits: "patterncontentunits",
  patternTransform: "patterntransform",
  patternUnits: "patternunits",
  pointerEvents: "pointer-events",
  pointsAtX: "pointsatx",
  pointsAtY: "pointsaty",
  pointsAtZ: "pointsatz",
  preserveAlpha: "preservealpha",
  preserveAspectRatio: "preserveaspectratio",
  primitiveUnits: "primitiveunits",
  refX: "refx",
  refY: "refy",
  renderingIntent: "rendering-intent",
  repeatCount: "repeatcount",
  repeatDur: "repeatdur",
  requiredExtensions: "requiredextensions",
  requiredFeatures: "requiredfeatures",
  shapeRendering: "shape-rendering",
  slot: "slot",
  specularConstant: "specularconstant",
  specularExponent: "specularexponent",
  spreadMethod: "spreadmethod",
  startOffset: "startoffset",
  stdDeviation: "stddeviation",
  stitchTiles: "stitchtiles",
  stopColor: "stop-color",
  stopOpacity: "stop-opacity",
  strikethroughPosition: "strikethrough-position",
  strikethroughThickness: "strikethrough-thickness",
  strokeDasharray: "stroke-dasharray",
  strokeDashoffset: "stroke-dashoffset",
  strokeLinecap: "stroke-linecap",
  strokeLinejoin: "stroke-linejoin",
  strokeMiterlimit: "stroke-miterlimit",
  strokeWidth: "stroke-width",
  strokeOpacity: "stroke-opacity",
  suppressContentEditableWarning: "suppresscontenteditablewarning",
  suppressHydrationWarning: "suppresshydrationwarning",
  surfaceScale: "surfacescale",
  systemLanguage: "systemlanguage",
  tableValues: "tablevalues",
  targetX: "targetx",
  targetY: "targety",
  textAnchor: "text-anchor",
  textDecoration: "text-decoration",
  textLength: "textlength",
  textRendering: "text-rendering",
  transformOrigin: "transform-origin",
  underlinePosition: "underline-position",
  underlineThickness: "underline-thickness",
  unicodeBidi: "unicode-bidi",
  unicodeRange: "unicode-range",
  unitsPerEm: "units-per-em",
  vectorEffect: "vector-effect",
  vertAdvY: "vert-adv-y",
  vertOriginX: "vert-origin-x",
  vertOriginY: "vert-origin-y",
  wordSpacing: "word-spacing",
  writingMode: "writing-mode",
  xChannelSelector: "xchannelselector",
  xHeight: "x-height",
  xlinkActuate: "xlink:actuate",
  xlinkArcrole: "xlink:arcrole",
  xlinkHref: "xlink:href",
  xlinkRole: "xlink:role",
  xlinkShow: "xlink:show",
  xlinkTitle: "xlink:title",
  xlinkType: "xlink:type",
  xmlBase: "xml:base",
  xmlLang: "xml:lang",
  xmlnsXlink: "xmlns:xlink",
  yChannelSelector: "ychannelselector",
  zoomAndPan: "zoomandpan"
}, V = "[react-output-target]", u = (e) => typeof e == "string" || typeof e == "number" || typeof e == "boolean", h = (e) => e == null, R = (e) => Array.isArray(e), B = (e) => !!e && /^\s*class\s+/.test(e.toString()), X = (e) => !!e && typeof e == "object" && "_payload" in e, Y = (e) => !!e && typeof e == "object" && "$$typeof" in e && ("render" in e || "type" in e && "compare" in e), K = (e) => async ({ children: t, ...n }: any = {}) => {
  if (!("process" in globalThis) || typeof window < "u")
    throw new Error("`createComponentForServerSideRendering` can only be run on the server");
  let r = "";
  const i = {};
  for (const [a, o] of Object.entries(n)) {
    // Component properties must reach Stencil unchanged, including explicit false,
    // null, numbers, objects and functions. Attributes alone can lose their type.
    if (a === "ref" || a === "key" || /^on/i.test(a)) continue;
    const componentProperty = Object.prototype.hasOwnProperty.call(e.properties, a);
    if (componentProperty) i[a] = o;
    if (o == null) continue;
    const c = e.properties[a] || E[a] || a;
    if (!/^[^\s"'<>/=]+$/.test(c)) continue;
    const arrayAttribute = Array.isArray(o) ? getSsrArrayAttribute(e.tagName, c, o) : undefined;
    if (arrayAttribute) {
      i[a] = o;
      r += ` ${arrayAttribute}="${escapeAttribute(JSON.stringify(o))}"`;
    } else if (a === "style" && typeof o === "object") {
      r += ` ${c}="${escapeAttribute(G(o))}"`;
    } else if (u(o)) {
      // A native disabled attribute disables form-associated custom elements
      // by presence. Keep the false property above for Stencil's initial render.
      // Other Stencil boolean props, ARIA and data attributes can use "false".
      if (o === false && (c === "disabled" || (!componentProperty && !/^(aria-|data-)/.test(c)))) continue;
      r += ` ${c}="${escapeAttribute(o)}"`;
    } else if (!componentProperty) {
      i[a] = o;
    }
  }
  let s = "";
  const p = e.transformTag ? e.transformTag(e.tagName) : e.tagName, x = `<${p}${r} suppressHydrationWarning="true">`;
  try {
    const a = await k(t), { renderToString: o } = await import("react-dom/server");
    s = o(a).replace(/\n\s+/g, "");
  } catch (a) {
    if (process.env.STENCIL_SSR_DEBUG) {
      const o = a instanceof Error ? a : new Error("Unknown error");
      console.warn(
        `${V} Failed to serialize light DOM for ${x.slice(0, -1)} />: ${o.message} - this may impact the hydration of the component`
      );
    }
  }
  let hostStyle: string | undefined;
  const P = `${x}${s}</${p}>`, { html: g, styles: b } = await e.renderToString(P, {
    fullDocument: !1,
    serializeShadowRoot: e.serializeShadowRoot ?? "declarative-shadow-dom",
    prettyHtml: !0,
    // Preserve final host styles through React's serializer, including when
    // paired with a Core renderer predating the quoted-CSS serialization fix.
    afterHydrate: (document) => {
      const host = document.querySelector(p);
      if (host?.hasAttribute('style')) {
        hostStyle = host.getAttribute('style');
        host.removeAttribute('style');
      }
    },
    ...Object.keys(i).length > 0 && {
      beforeHydrate: (a) => {
        const o = a.querySelector(p);
        if (o)
          for (const [c, m] of Object.entries(i))
            o[c] = m;
      }
    }
  });
  if (!g)
    throw new Error("No HTML returned from renderToString");
  const d = g.split(`
`), $ = "<!--r.1-->", w = d[1].includes('shadowrootmode="open"'), O = d[1].includes("shadowrootdelegatesfocus");
  let T;
  w && (T = d.slice(2, d.lastIndexOf("  </template>")).join(`
`).trim());
  const { default: M, attributesToProps } = await import("html-react-parser");
  const preservedStyle = hostStyle === undefined ? {} : attributesToProps({ style: hostStyle });
  const L = M, H = () => L(g, {
    transform(a, o) {
      if ("name" in o && (o.name === p || o.name === e.tagName)) {
        const c = { ...(a as l.ReactElement<any>).props, ...preservedStyle }, m = `${p}`;
        if (!w) {
          const { children: Z, ...I } = c || {}, j = d.slice(1, -1).join(`
`).trim().replace(new RegExp("(?<=>)\\s+(?=<)", "g"), "").replace(/\n\s+/g, ""), _ = b.length > 0 && b.map((f, A) => /* @__PURE__ */ l.createElement(
            "style",
            {
              href: `stencil-${f.id || e.tagName}`,
              key: f.id || A,
              id: f.id,
              precedence: "stencil",
              suppressHydrationWarning: !0,
              dangerouslySetInnerHTML: { __html: f.content || "" }
            }
          ));
          return /* @__PURE__ */ l.createElement(N, null, _, /* @__PURE__ */ l.createElement(m, { ...I, suppressHydrationWarning: !0, dangerouslySetInnerHTML: { __html: j } }));
        }
        return /* @__PURE__ */ l.createElement(m, { ...c, suppressHydrationWarning: !0 }, /* @__PURE__ */ l.createElement(
          "template",
          {
            shadowrootmode: "open",
            ...O ? { shadowrootdelegatesfocus: "" } : {},
            suppressHydrationWarning: !0,
            dangerouslySetInnerHTML: { __html: $ + T }
          }
        ), t);
      }
    }
  });
  return /* @__PURE__ */ l.createElement(H, null);
};
async function k(e) {
  return u(e) || h(e) ? e : (R(e) || (e = [e]), Promise.all(
    Array.from(e).map(async (t) => {
      if (u(t) || h(t))
        return t;
      if (R(t))
        return k(t);
      if (!l.isValidElement(t))
        return t;
      const { type: n, props: r } = t as l.ReactElement<any>, i = await S(n, r);
      return l.isValidElement(i) ? i : {
        ...t,
        props: {
          ...r,
          children: await k(r.children)
        },
        type: i
      };
    })
  ));
}
const S = async (e, t) => {
  let n = null;
  if (typeof e == "string")
    return e;
  if (B(e)) {
    const r = new e(t, void 0);
    n = r.render ? r.render() : r;
  } else if (X(e)) {
    const r = e._payload;
    let i;
    if (typeof e._init == "function" && r._result === void 0) {
      const s = await e._init(r);
      i = (s == null ? void 0 : s.default) ?? s;
    } else {
      const { default: s } = r._status === -1 ? await r._result() : r._result;
      i = s;
    }
    n = await S(i, t);
  } else {
    if (Y(e))
      return e;
    typeof e != "object" && (n = await e(t));
  }
  return !h(n) && !u(n) && l.isValidElement(n) && (n = await S(n.type, t)), n;
};
let y = null;
const ee = (e) => {
  if (typeof window < "u") {
    if (e.clientModule)
      return e.clientModule;
    if (C)
      return (C as any)({
        tagName: e.tagName,
        properties: e.properties
      });
  }
  return async (t) => {
    if (!e.hydrateModule)
      throw new Error(
        "`hydrateModule` is required when rendering a Stencil component on the server. This indicates a misconfiguration of the Stencil React output target."
      );
    let n = !1;
    y || (y = await e.hydrateModule, n = !0);
    const r = y;
    if (e.getTagTransformer && n) {
      const i = e.getTagTransformer();
      i && r.setTagTransformer(i);
    }
    return e.transformTag = r.transformTag, K({
      renderToString: r.renderToString,
      ...e
    })(t);
  };
};
export const createComponent: typeof import('@stencil/react-output-target/ssr').createComponent = ee;
export type { HydrateModule, SerializeShadowRootOptions } from '@stencil/react-output-target/ssr';
