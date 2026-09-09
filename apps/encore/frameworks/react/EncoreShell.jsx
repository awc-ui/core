// Generated from src/shell.js by scripts/generate-framework-shells.mjs. Edit the shell source.
import { useLayoutEffect, useRef } from 'react';
import { mountEncore } from '../../src/app.js';
export function EncoreShell() {
  const root = useRef(null);
  useLayoutEffect(() => mountEncore(root.current, { framework: 'react' }), []);
  return <div ref={root} className="encore-framework-host"><a className={"skip-link"} href={"#main"}>
{"Skip to content"}
</a>
{"\n    "}
<header className={"site-header"}>
<md-app-bar variant={"small"}>
{"\n      "}
<a slot={"leading"} className={"brand"} href={"#/discover"} aria-label={"Encore home"}>
<span className={"brand-symbol"} aria-hidden={"true"}>
{"e"}
</span>
{"encore"}
<span className={"brand-dot"}>
{"."}
</span>
</a>
{"\n      "}
<nav slot={"headline"} className={"desktop-nav"} aria-label={"Main navigation"}>
<md-button href={"#/discover"} data-nav={"discover"} variant={"text"}>
{"Discover"}
</md-button>
<md-button href={"#/saved"} data-nav={"saved"} variant={"text"}>
{"Saved shows"}
</md-button>
<md-button href={"#/tickets"} data-nav={"tickets"} variant={"text"} icon={"confirmation_number"}>
{"My tickets"}
</md-button>
</nav>
{"\n      "}
<div slot={"trailing"} className={"header-actions"}>
<md-select id={"framework"} label={"Framework"} value={"react"} variant={"outlined"}>
<md-select-option value={"html"}>
{"HTML"}
</md-select-option>
<md-select-option value={"react"}>
{"React"}
</md-select-option>
<md-select-option value={"vue"}>
{"Vue"}
</md-select-option>
<md-select-option value={"angular"}>
{"Angular"}
</md-select-option>
<md-select-option value={"svelte"}>
{"Svelte"}
</md-select-option>
</md-select>
{"\n      "}
<md-tooltip text={"Appearance"}>
<md-icon-button data-action={"appearance"} icon={"tune"} aria-label={"Appearance"} />
</md-tooltip>
</div>
{"\n    "}
</md-app-bar>
</header>
{"\n    "}
<md-progress-indicator id={"action-progress"} class={"action-progress"} variant={"linear"} indeterminate={""} label={"Working"} hidden={""} />
{"\n    "}
<main id={"main"} tabIndex={"-1"} />
{"\n    "}
<footer className={"site-footer"}>
<a className={"brand"} href={"#/discover"}>
{"encore."}
</a>
<p>
{"Demo shows and checkout. No payment is taken."}
</p>
<a href={"https://awc-ui.dev/"} target={"_blank"} rel={"noreferrer"}>
{"Made with AWC UI ↗"}
</a>
</footer>
{"\n    "}
<md-navigation-bar class={"mobile-nav"} label-behavior={"always"} aria-label={"Main navigation"}>
<md-navigation-tab label={"Discover"} icon={"explore"} href={"#/discover"} />
<md-navigation-tab label={"Saved"} icon={"favorite"} href={"#/saved"} />
<md-navigation-tab label={"My tickets"} icon={"confirmation_number"} href={"#/tickets"} />
</md-navigation-bar>
{"\n    "}
<md-side-sheet id={"appearance"} variant={"modal"} headline={"Make it yours"} side={"end"} closeable={""} aria-label={"Appearance settings"}>
{"\n      "}
<div className={"settings-content"}>
<p className={"muted"}>
{"The same AWC components, your kind of atmosphere."}
</p>
{"\n      "}
<md-select label={"Theme"} data-pref={"theme"} value={"light"} full-width={""}>
<md-select-option value={"light"}>
{"Light"}
</md-select-option>
<md-select-option value={"dark"}>
{"Dark"}
</md-select-option>
<md-select-option value={"system"}>
{"System"}
</md-select-option>
</md-select>
{"\n      "}
<md-select label={"Accent colour"} data-pref={"accent"} value={"violet"} full-width={""}>
<md-select-option value={"violet"}>
{"Electric violet"}
</md-select-option>
<md-select-option value={"rose"}>
{"Backstage rose"}
</md-select-option>
<md-select-option value={"teal"}>
{"Midnight teal"}
</md-select-option>
</md-select>
{"\n      "}
<md-list label={"Layout"} interaction-mode={"multi-action"}>
<md-list-item headline={"Compact spacing"} supporting-text={"A little more room for the shows."}>
<md-switch slot={"trailing"} data-pref={"compact"} aria-label={"Compact spacing"} />
</md-list-item>
<md-list-item headline={"Right-to-left layout"} supporting-text={"Explore the library’s RTL support."}>
<md-switch slot={"trailing"} data-pref={"direction"} aria-label={"Right-to-left layout"} />
</md-list-item>
</md-list>
{"\n      "}
<md-divider />
<p className={"muted"}>
{"Built with AWC UI web components in five real framework builds."}
</p>
<md-button href={"https://awc-ui.dev/showcase/encore/"} target={"_blank"} variant={"outlined"} trailing-icon={"open_in_new"}>
{"Explore the components"}
</md-button>
</div>
{"\n    "}
</md-side-sheet>
{"\n    "}
<md-dialog id={"cancel-dialog"} headline={"Cancel this demo booking?"} icon={"confirmation_number"} scrim-dismissible={"false"}>
<p>
{"Your tickets will move to Cancelled and become available to book again."}
</p>
<p className={"muted"}>
{"This is a demo. No payment or refund is processed."}
</p>
<md-button slot={"actions"} data-action={"keep-booking"} variant={"text"}>
{"Keep tickets"}
</md-button>
<md-button slot={"actions"} data-action={"confirm-cancel"} variant={"filled"}>
{"Cancel booking"}
</md-button>
</md-dialog>
{"\n    "}
<md-snackbar id={"notice"} closeable={""} position={"bottom"} auto-hide-duration={"5500"} /></div>;
}
