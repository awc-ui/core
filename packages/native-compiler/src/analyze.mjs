import ts from 'typescript';
import postcss from 'postcss';

const UNSUPPORTED = Symbol('unsupported');
// Parse constants, never execute a component or its initializers during compilation.
export function literal(node) {
  if (!node) return UNSUPPORTED;
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) return literal(node.expression);
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) return -Number(node.operand.text);
  if (ts.isArrayLiteralExpression(node)) {
    const values = node.elements.map(literal);
    return values.includes(UNSUPPORTED) ? UNSUPPORTED : values;
  }
  if (ts.isObjectLiteralExpression(node)) {
    const values = [];
    for (const p of node.properties) {
      if (!ts.isPropertyAssignment(p) || ts.isComputedPropertyName(p.name)) return UNSUPPORTED;
      const value = literal(p.initializer);
      if (value === UNSUPPORTED) return UNSUPPORTED;
      values.push([p.name.text, value]);
    }
    return Object.fromEntries(values);
  }
  return UNSUPPORTED;
}

function decorator(node, name) {
  return (ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [])
    .find(d => ts.isCallExpression(d.expression) && d.expression.expression.getText() === name);
}
function options(node, name) {
  const d = decorator(node, name);
  const result = d ? literal(d.expression.arguments[0]) : UNSUPPORTED;
  return result === UNSUPPORTED ? {} : result;
}
function choices(type) {
  if (!type || !ts.isUnionTypeNode(type)) return [];
  const result = type.types.map(t => ts.isLiteralTypeNode(t) ? literal(t.literal) : UNSUPPORTED);
  return result.every(x => typeof x === 'string') ? result : [];
}
function jsx(node) {
  if (ts.isParenthesizedExpression(node)) return jsx(node.expression);
  if (ts.isJsxText(node)) return { kind: 'text', value: node.text.replace(/\s+/g, ' ').trim() };
  if (ts.isJsxExpression(node)) return node.expression ? {kind: 'expression', source: node.expression.getText()} : null;
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
    const opening = ts.isJsxElement(node) ? node.openingElement : node;
    return {
      kind: 'element', tag: opening.tagName.getText(),
      attributes: opening.attributes.properties.map(p => ts.isJsxSpreadAttribute(p)
        ? {kind: 'spread', source: p.expression.getText()}
        : {name: p.name.getText(), value: p.initializer ? (ts.isStringLiteral(p.initializer) ? p.initializer.text : p.initializer.expression?.getText()) : true}),
      children: ts.isJsxElement(node) ? node.children.map(jsx).filter(Boolean) : [],
    };
  }
  if (ts.isJsxFragment(node)) return {kind: 'fragment', children: node.children.map(jsx).filter(Boolean)};
  return {kind: 'expression', source: node.getText()};
}

const WEB_IDENTIFIERS = new Map([
  ['document', ['DOM_GLOBAL', 'Document access requires a native adapter.']],
  ['window', ['DOM_GLOBAL', 'Window access requires a native adapter.']],
  ['MutationObserver', ['DOM_OBSERVER', 'DOM mutation observation has no direct native counterpart.']],
  ['ResizeObserver', ['DOM_OBSERVER', 'Native layout measurement must replace ResizeObserver.']],
  ['IntersectionObserver', ['DOM_OBSERVER', 'Native visibility tracking must replace IntersectionObserver.']],
  ['ElementInternals', ['HTML_FORM', 'HTML form association requires explicit native form state.']],
  ['HTMLCanvasElement', ['CANVAS', 'Canvas drawing requires a native drawing implementation.']],
  ['getComputedStyle', ['CSS_RUNTIME', 'Computed CSS must become native theme/layout values.']],
  ['requestAnimationFrame', ['ANIMATION_FRAME', 'Animation timing requires a native lifecycle adapter.']],
]);
const WEB_MEMBERS = new Map([
  ['querySelector', 'DOM_QUERY'], ['querySelectorAll', 'DOM_QUERY'], ['shadowRoot', 'SHADOW_DOM'],
  ['assignedElements', 'SLOT_INTROSPECTION'], ['assignedNodes', 'SLOT_INTROSPECTION'],
  ['getBoundingClientRect', 'DOM_LAYOUT'], ['classList', 'DOM_MUTATION'],
  ['setFormValue', 'HTML_FORM'], ['setValidity', 'HTML_FORM'], ['attachShadow', 'SHADOW_DOM'],
]);

export function analyzeSource(source, fileName, manifest = {}) {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (file.parseDiagnostics.length) throw new Error(`${fileName}: ${ts.flattenDiagnosticMessageText(file.parseDiagnostics[0].messageText, '\n')}`);
  const cls = file.statements.find(s => ts.isClassDeclaration(s) && decorator(s, 'Component'));
  if (!cls) throw new Error(`${fileName}: no @Component class`);
  const config = options(cls, 'Component');
  if (!/^md-[a-z0-9-]+$/.test(config.tag)) throw new Error(`${fileName}: invalid component tag`);
  const diagnostics = [];
  const seen = new Set();
  const diagnose = (code, message, node, severity = 'warning') => {
    if (seen.has(code)) return;
    seen.add(code);
    diagnostics.push({code, severity, message, line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1});
  };
  const properties = [], state = [], events = [], methods = [];
  let render = null;
  for (const member of cls.members) {
    if (ts.isPropertyDeclaration(member) && decorator(member, 'Prop')) {
      const settings = options(member, 'Prop');
      const value = literal(member.initializer);
      const type = member.type?.getText(file) ?? (value === UNSUPPORTED ? 'unknown' : typeof value);
      properties.push({name: member.name.getText(file), type, default: member.initializer?.getText(file) ?? '',
        ...(value === UNSUPPORTED ? {} : {defaultValue: value}), options: choices(member.type),
        mutable: Boolean(settings.mutable), reflect: Boolean(settings.reflect),
        attribute: settings.attribute === false ? null : settings.attribute ?? member.name.getText(file).replace(/[A-Z]/g, m => `-${m.toLowerCase()}`),
        optional: Boolean(member.questionToken), description: ts.getJSDocCommentsAndTags(member).map(d => typeof d.comment === 'string' ? d.comment : '').filter(Boolean).join('\n')});
      if (value === UNSUPPORTED && member.initializer) diagnose('DYNAMIC_DEFAULT', 'A dynamic prop initializer requires a native default adapter.', member);
      if (/=>/.test(type)) diagnose('CALLABLE_PROP', 'Callable props require target-specific callback signatures.', member);
    }
    if (ts.isPropertyDeclaration(member) && decorator(member, 'State')) state.push({name:member.name.getText(file),type:member.type?.getText(file)??'inferred',initializer:member.initializer?.getText(file)??''});
    if (ts.isPropertyDeclaration(member) && decorator(member, 'Event')) {
      const settings = options(member, 'Event');
      events.push({name:settings.eventName??member.name.getText(file),detail:member.type?.typeArguments?.[0]?.getText(file)??'void',cancelable:settings.cancelable!==false,bubbles:settings.bubbles!==false,composed:settings.composed!==false});
    }
    if (ts.isMethodDeclaration(member) && decorator(member, 'Method')) methods.push({name:member.name.getText(file),parameters:member.parameters.map(p=>({name:p.name.getText(),type:p.type?.getText()??'unknown'})),returnType:member.type?.getText()??'inferred'});
    if (ts.isMethodDeclaration(member) && member.name.getText() === 'render') {
      const ret = member.body?.statements.find(ts.isReturnStatement);
      render = ret?.expression ? jsx(ret.expression) : null;
    }
  }
  function visit(node) {
    if (ts.isIdentifier(node) && WEB_IDENTIFIERS.has(node.text)) {
      const [code,message] = WEB_IDENTIFIERS.get(node.text); diagnose(code,message,node);
    }
    if (ts.isPropertyAccessExpression(node) && WEB_MEMBERS.has(node.name.text)) diagnose(WEB_MEMBERS.get(node.name.text), `${node.name.text} depends on browser semantics and requires a native adapter.`,node);
    ts.forEachChild(node,visit);
  }
  visit(cls);
  if (events.some(e=>e.cancelable)) diagnose('CANCELABLE_EVENT', 'DOM cancellation, bubbling and composed paths are not implied by a native callback.',cls);
  return {tag:config.tag,className:cls.name.text,properties,state,events,methods,
    slots:manifest.slots??[],cssParts:manifest.cssParts??[],cssProperties:manifest.cssProperties??[],
    render,diagnostics,source:{file:fileName,styleUrl:config.styleUrl??null,shadow:Boolean(config.shadow),formAssociated:Boolean(config.formAssociated)}};
}

export function analyzeCSS(css, fileName) {
  const root = postcss.parse(css,{from:fileName});
  const rules = [];
  root.walkRules(rule=>rules.push({selector:rule.selector,context:rule.parent.type==='atrule'?`@${rule.parent.name} ${rule.parent.params}`:null,
    declarations:(rule.nodes??[]).filter(x=>x.type==='decl').map(x=>({property:x.prop,value:x.value,important:x.important??false}))}));
  return rules;
}

export function extractTokens(css) {
  const rules = analyzeCSS(css,'tokens.css');
  const light = {}, dark = {}, scopes = [];
  for(const rule of rules){
    const values = Object.fromEntries(rule.declarations.filter(d=>d.property.startsWith('--')).map(d=>[d.property,d.value]));
    if(!Object.keys(values).length) continue;
    scopes.push({selector:rule.selector,context:rule.context,values});
    if(rule.selector.trim()===':root' && !rule.context) Object.assign(light,values);
    if(/data-theme\s*=\s*["']dark["']/.test(rule.selector) && !rule.context) Object.assign(dark,values);
  }
  return {light,dark:{...light,...dark},scopes};
}
