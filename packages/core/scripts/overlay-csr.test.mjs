import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createCsrTestEnvironment, delay, until } from './lib/csr-test-environment.mjs';

// Run the built CSR custom elements, not Stencil's spec proxies. The real
// lifecycle, event handlers, focus code and render queue execute in jsdom;
// geometry and Web Animations are substituted because jsdom cannot paint.
// Build Core first, then run: node --test scripts/overlay-csr.test.mjs
const environment = createCsrTestEnvironment('<button id="overlay-trigger">Create resource</button>');
const { view } = environment;

// Give the menu a known viewport and surface before its first positioning
// callback. No application reposition() call repairs an incorrect first show.
const opener = document.getElementById('overlay-trigger');
opener.getBoundingClientRect = () => ({
  x: 700, y: 100, left: 700, top: 100, right: 880, bottom: 140, width: 180, height: 40,
});
for (const [name, size] of [['offsetWidth', 200], ['offsetHeight', 160]]) {
  const original = Object.getOwnPropertyDescriptor(view.HTMLElement.prototype, name);
  Object.defineProperty(view.HTMLElement.prototype, name, {
    configurable: true,
    get() {
      return this.classList.contains('md-menu__surface') ? size : original?.get?.call(this) ?? 0;
    },
  });
}

await environment.define(['md-dialog', 'md-side-sheet', 'md-menu', 'md-menu-item', 'md-fab', 'md-fab-menu', 'md-fab-menu-item']);

async function completes(promise, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), 2000); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function escape(target = document.activeElement) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
}
function focusedInside(element) {
  return document.activeElement === element || element.contains(document.activeElement);
}
function mount(t, tag) {
  const element = document.createElement(tag);
  element.headline = 'Test overlay';
  if (tag === 'md-side-sheet') element.variant = 'modal';
  if (tag === 'md-menu') {
    element.anchor = opener.id;
    const item = document.createElement('md-menu-item');
    item.headline = 'Create instance';
    element.append(item);
  } else {
    const button = document.createElement('button');
    button.textContent = 'Save';
    element.append(button);
  }
  const events = [];
  for (const [eventName, name] of [['mdOpen', 'open'], ['mdClose', 'close'], ['mdCancel', 'cancel']]) {
    element.addEventListener(eventName, (event) => { if (event.target === element) events.push(name); });
  }
  opener.focus();
  document.body.append(element);
  t.after(() => element.remove());
  return { element, events };
}

after(() => environment.close());

for (const tag of ['md-dialog', 'md-side-sheet']) {
  test(`${tag}: append/show opens after its closed render, focuses inside and handles Escape`, async (t) => {
    const { element, events } = mount(t, tag);
    const showing = element.show();
    assert.equal(element.open, false, 'an immediate CSR show must preserve the initial closed render');
    await completes(showing, `${tag} show() did not resolve`);
    await until(() => focusedInside(element) && events.includes('open'));
    assert.deepEqual(events, ['open']);
    assert.equal(document.body.style.overflow, 'hidden');
    assert.ok(element.classList.contains(`${tag}--open`));
    if (tag === 'md-dialog') assert.ok(element.classList.contains('md-dialog--animating'), 'first show must enter through the animation watcher');

    const closed = element.whenClosed();
    escape();
    await completes(closed, `${tag} Escape did not finish its open cycle`);
    assert.equal(element.open, false);
    assert.deepEqual(events, ['open', 'cancel', 'close']);
    assert.equal(document.body.style.overflow, '');
    assert.equal(document.activeElement, opener);
    assert.ok(element.isConnected, 'Core leaves removal to the caller after whenClosed()');
  });
}

test('md-menu: immediate append/show positions against its anchor and restores focus after Escape', async (t) => {
  const { element, events } = mount(t, 'md-menu');
  const showing = element.show();
  assert.equal(element.open, false);
  await completes(showing, 'menu show() did not resolve');
  await until(() => element.style.top === '144px' && focusedInside(element));
  assert.equal(element.style.left, '700px');
  assert.deepEqual(events, ['open']);
  assert.equal(opener.getAttribute('aria-expanded'), 'true');
  const closed = element.whenClosed();
  escape();
  assert.ok(element.isConnected);
  await completes(closed, 'menu Escape did not finish its open cycle');
  assert.equal(element.open, false);
  assert.deepEqual(events, ['open', 'close']);
  assert.equal(opener.getAttribute('aria-expanded'), 'false');
  assert.equal(document.activeElement, opener);
});

for (const tag of ['md-dialog', 'md-side-sheet', 'md-menu']) {
  test(`${tag}: whenClosed waits for finite shell motion and ignores nested control animations`, async (t) => {
    const { element, events } = mount(t, tag);
    await element.show();
    await until(() => focusedInside(element));
    const shell = element.shadowRoot.querySelector(tag === 'md-menu' ? '.md-menu__surface' : '[part="container"]');
    assert.ok(shell);
    const shellMotion = deferred();
    const spinner = document.createElement('span');
    // An animation inside a slotted control's own shadow root is not shell
    // motion, even if that animation is finite (a spinner may repeat itself).
    const control = document.createElement('div');
    control.attachShadow({ mode: 'open' }).append(spinner);
    element.append(control);
    const never = new Promise(() => {});
    let animationReads = 0;
    element.getAnimations = (options) => {
      animationReads++;
      assert.equal(options.subtree, true);
      return [
        { effect: { target: shell, getTiming: () => ({ iterations: 1 }) }, finished: shellMotion.promise },
        { effect: { target: control, getTiming: () => ({ iterations: Infinity }) }, finished: never },
        { effect: { target: spinner, getTiming: () => ({ iterations: 1 }) }, finished: never },
      ];
    };
    let completed = false;
    const closed = element.whenClosed().then(() => { completed = true; });
    await element.close();
    await until(() => events.includes('close') && animationReads > 0);
    assert.equal(completed, false, 'mdClose alone is not permission to remove an animating shell');
    assert.ok(element.isConnected);
    shellMotion.resolve();
    await completes(closed, `${tag} waited for a nested control animation`);
    assert.equal(element.open, false);
    if (tag !== 'md-menu') assert.equal(document.activeElement, opener);
  });
}

test('whenClosed also completes when a shell animation is canceled', async (t) => {
  const { element } = mount(t, 'md-dialog');
  await element.show();
  await until(() => focusedInside(element));
  const motion = deferred();
  let observed = false;
  element.getAnimations = () => {
    observed = true;
    return [{ effect: { target: element, getTiming: () => ({ iterations: 1 }) }, finished: motion.promise }];
  };
  const closed = element.whenClosed();
  await element.close();
  await until(() => observed);
  motion.reject(new Error('Animation canceled'));
  await completes(closed, 'a canceled shell animation must not reject or strand whenClosed()');
});

for (const tag of ['md-dialog', 'md-side-sheet', 'md-menu']) {
  test(`${tag}: closing before its initial load cancels a pending show`, async (t) => {
    const { element, events } = mount(t, tag);
    const showing = element.show();
    const closed = element.whenClosed();
    await element.close();
    await completes(Promise.all([showing, closed]), `${tag} left an initial show/close promise pending`);
    await delay(60);
    assert.equal(element.open, false);
    assert.deepEqual(events, [], 'a canceled initial show must not emit a late mdOpen');
    assert.equal(document.body.style.overflow, '');
    assert.equal(document.activeElement, opener);
  });

  test(`${tag}: closing immediately after show prevents its queued focus from running`, async (t) => {
    const { element, events } = mount(t, tag);
    await element.show();
    assert.equal(document.activeElement, opener, 'show resolves before its queued focus frame');
    const closed = element.whenClosed();
    await element.close();
    await completes(closed, `${tag} immediate close did not complete`);
    await delay(60);
    assert.equal(element.open, false);
    assert.deepEqual(events, ['open', 'close']);
    assert.equal(document.activeElement, opener, 'a stale opening callback must not steal focus after dismissal');
    assert.equal(document.body.style.overflow, '');
  });
}

for (const slotted of [false, true]) {
  test(`persistent FAB menu preserves its ${slotted ? 'slotted' : 'property'} icon and current label across dismissal`, async (t) => {
    const fab = document.createElement('md-fab');
    fab.id = `overlay-fab-${slotted}`;
    fab.icon = 'add';
    fab.label = 'Create';
    const authoredIcon = document.createElement('span');
    authoredIcon.slot = 'icon';
    authoredIcon.textContent = 'custom-add';
    if (slotted) fab.append(authoredIcon);
    const menu = document.createElement('md-fab-menu');
    menu.anchor = fab.id;
    menu.placement = 'up';
    menu.menuLabel = 'Create resources';
    const item = document.createElement('md-fab-menu-item');
    item.icon = 'dns';
    item.textContent = 'Create instance';
    menu.append(item);
    document.body.append(fab, menu);
    t.after(() => { menu.remove(); fab.remove(); });
    await until(() => menu.classList.contains('hydrated') && fab.classList.contains('hydrated'));
    const slotHidden = () => fab.classList.contains('md-fab--menu-icon');
    const renderedIcon = () => [...fab.shadowRoot.querySelectorAll('[part="icon"]')].find((icon) => !slotHidden() || !icon.closest('slot[name="icon"]'))?.textContent;
    fab.focus();
    fab.click();
    await until(() => menu.open && renderedIcon() === 'close');
    assert.equal(fab.icon, 'add', 'the menu must not overwrite the authored icon property');
    assert.equal(fab.getAttribute('aria-expanded'), 'true');
    fab.icon = 'cloud';
    fab.label = 'Create resource';
    await until(() => fab.getAttribute('aria-label') === 'Create resource');
    assert.equal(renderedIcon(), 'close', 'an authored update must not replace the open-menu affordance');
    if (slotted) {
      assert.equal(authoredIcon.parentNode, fab);
      assert.ok(slotHidden());
    }
    const closed = menu.whenClosed();
    item.dispatchEvent(new CustomEvent('mdClick', { bubbles: true, composed: true }));
    await completes(closed, 'FAB item dismissal did not finish');
    await until(() => slotted ? !slotHidden() : renderedIcon() === 'cloud');
    assert.equal(menu.open, false);
    assert.equal(fab.icon, 'cloud');
    assert.equal(fab.getAttribute('aria-label'), 'Create resource');
    assert.equal(document.activeElement, fab);
    if (slotted) assert.equal(authoredIcon.parentNode, fab, 'closing restores the original slotted node');
    fab.click();
    await until(() => menu.open);
    const escaped = menu.whenClosed();
    escape(fab);
    await completes(escaped, 'FAB Escape did not finish');
    assert.equal(fab.getAttribute('aria-expanded'), 'false');
    assert.equal(document.activeElement, fab);
  });
}
