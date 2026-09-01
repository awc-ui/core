/**
 * The overview's compact-only quick-actions FAB menu.
 *
 * The React build gates this cluster behind `useMediaQuery('(max-width:
 * 899px)')` and MOUNTS or unmounts it — at desktop width the elements do not
 * exist, because the rail already carries the one FAB M3 allows there. This
 * build gets the same document the same way: the cluster ships in a
 * `<template data-quick-actions>` (inert — no live elements, no upgraded
 * components, invisible to the parity census) and is cloned in and out on the
 * same query, which mirrors the breakpoint `app.css` uses to swap the rail
 * for the navigation bar.
 *
 * The FAB and the menu wire themselves together by `anchor` id — opening,
 * `aria-expanded` and the icon morph are all the components' own. What the
 * page cannot know is where a menu item should GO: `md-fab-menu-item` has no
 * `value` prop, so the build stamped each target on `data-path`, already
 * localized, and a click is a full page load — which is this build's routing.
 * The menu closes itself and returns focus to the FAB; calling `close()` from
 * here is the documented anti-pattern.
 */

const COMPACT_QUERY = '(max-width: 899px)';

export function enhanceQuickActions(root = document) {
  const template = root.querySelector('template[data-quick-actions]');
  if (!template || template.hasAttribute('data-bound')) return;
  template.setAttribute('data-bound', '');

  const mq = window.matchMedia(COMPACT_QUERY);
  let mounted = [];

  const apply = () => {
    if (mq.matches && mounted.length === 0) {
      mounted = [...template.content.children].map((child) => child.cloneNode(true));
      for (const node of mounted) template.parentElement?.insertBefore(node, template);

      // Fresh clones each mount, so the listener binds each time and dies with
      // the elements — nothing to unbind on unmount.
      const menu = mounted.find((node) => node.tagName === 'MD-FAB-MENU');
      menu?.addEventListener('mdClick', (event) => {
        // mdClick carries no detail — the pressed row is the (composed,
        // retargeted) event.target, the md-fab-menu-item host.
        const path = event.target?.dataset?.path;
        if (path) window.location.assign(path);
      });
    } else if (!mq.matches && mounted.length > 0) {
      for (const node of mounted) node.remove();
      mounted = [];
    }
  };

  apply();
  mq.addEventListener('change', apply);
}
